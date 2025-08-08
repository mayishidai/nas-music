import path from 'path';
import fs from 'fs/promises';
import * as mm from 'music-metadata';
import chokidar from 'chokidar';
import { musicDB, getConfig, saveConfig } from './database.js';

// 文件监控器
let watcher = null;

// 确保目录存在
export async function ensureDirectories() {
  const config = await getConfig();
  
  // 确保所有音乐库路径存在
  for (const libraryPath of config.musicLibraryPaths) {
    try {
      await fs.access(libraryPath);
    } catch {
      await fs.mkdir(libraryPath, { recursive: true });
    }
  }
}

// 扫描音乐文件
export async function scanMusicFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;
    const coverImage = common.picture && common.picture.length > 0 ? common.picture[0] : null;
    
    const track = {
      _id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'track',
      path: filePath,
      filename: path.basename(filePath),
      title: common.title || path.parse(filePath).name,
      artist: common.artist || '未知艺术家',
      albumArtist: common.albumartist || common.artist || '未知艺术家',
      album: common.album || '未知专辑',
      year: common.year || null,
      genre: common.genre ? common.genre.join(', ') : '未知流派',
      track: common.track?.no || null,
      disc: common.disk?.no || 1,
      duration: format.duration || 0,
      bitrate: format.bitrate || 0,
      sampleRate: format.sampleRate || 0,
      size: stats.size,
      coverImage: coverImage,
      favorite: false,
      addedAt: new Date().toISOString(),
      modifiedAt: stats.mtime.toISOString()
    };
    await new Promise((resolve, reject) => {
      musicDB.insert(track, (err, newDoc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(newDoc);
      });
    });
    return track;
  } catch (error) {
    console.error(`扫描文件失败 ${filePath}:`, error.message);
    return null;
  }
}

// 递归扫描目录
export async function scanDirectory(dirPath) {
  const config = await getConfig();
  const audioExtensions = config.supportedFormats || ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];
  const tracks = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subTracks = await scanDirectory(fullPath);
        tracks.push(...subTracks);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (audioExtensions.includes(ext)) {
          const track = await scanMusicFile(fullPath);
          if (track) {
            tracks.push(track);
          }
        }
      }
    }
  } catch (error) {
    console.error(`扫描目录失败 ${dirPath}:`, error.message);
  }
  
  return tracks;
}

// 构建专辑和艺术家索引
export async function buildIndexes() {
  try {
    // 获取所有音乐
    const tracks = await new Promise((resolve, reject) => {
      musicDB.find({ type: 'track' }, (err, docs) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(docs);
      });
    });

    const albumsMap = new Map();
    const artistsMap = new Map();
    const genresMap = new Map();

    tracks.forEach(track => {
      // 构建专辑索引
      const albumKey = `${track.albumArtist}_${track.album}`;
      if (!albumsMap.has(albumKey)) {
        albumsMap.set(albumKey, {
          _id: `album_${albumKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'album',
          name: track.album,
          artist: track.albumArtist,
          year: track.year,
          genre: track.genre,
          trackCount: 0,
          duration: 0,
          coverImage: track.coverImage,
          tracks: []
        });
      }
      const album = albumsMap.get(albumKey);
      album.tracks.push(track._id);
      album.trackCount++;
      album.duration += track.duration;

      // 构建艺术家索引
      if (!artistsMap.has(track.artist)) {
        artistsMap.set(track.artist, {
          _id: `artist_${track.artist.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'artist',
          name: track.artist,
          albumCount: 0,
          trackCount: 0,
          albums: new Set(),
          tracks: []
        });
      }
      const artist = artistsMap.get(track.artist);
      artist.tracks.push(track._id);
      artist.trackCount++;
      artist.albums.add(albumKey);

      // 构建流派索引
      if (track.genre && track.genre !== '未知流派') {
        const genres = track.genre.split(',').map(g => g.trim());
        genres.forEach(genre => {
          if (!genresMap.has(genre)) {
            genresMap.set(genre, {
              _id: `genre_${genre.replace(/[^a-zA-Z0-9]/g, '_')}`,
              type: 'genre',
              name: genre,
              trackCount: 0,
              tracks: []
            });
          }
          genresMap.get(genre).tracks.push(track._id);
          genresMap.get(genre).trackCount++;
        });
      }
    });

    // 更新艺术家专辑数量
    artistsMap.forEach(artist => {
      artist.albumCount = artist.albums.size;
      artist.albums = Array.from(artist.albums);
    });

    // 清除旧的索引数据
    const [oldAlbums, oldArtists, oldGenres] = await Promise.all([
      new Promise((resolve) => musicDB.find({ type: 'album' }, (err, docs) => resolve(err ? [] : docs))),
      new Promise((resolve) => musicDB.find({ type: 'artist' }, (err, docs) => resolve(err ? [] : docs))),
      new Promise((resolve) => musicDB.find({ type: 'genre' }, (err, docs) => resolve(err ? [] : docs)))
    ]);

    // 删除旧数据
    const allOldDocs = [...oldAlbums, ...oldArtists, ...oldGenres];
    for (const doc of allOldDocs) {
      try {
        await new Promise((resolve, reject) => {
          musicDB.remove({ _id: doc._id }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (error) {
        console.error('删除旧索引失败:', error);
      }
    }

    // 保存新的索引数据
    const allIndexes = [
      ...Array.from(albumsMap.values()),
      ...Array.from(artistsMap.values()),
      ...Array.from(genresMap.values())
    ];

    for (const index of allIndexes) {
      try {
        await new Promise((resolve, reject) => {
          // 检查是否已存在，如果存在则更新，否则插入
          musicDB.findOne({ _id: index._id }, (err, existingDoc) => {
            if (err) {
              reject(err);
              return;
            }
            if (existingDoc) {
              // 更新现有文档
              musicDB.update({ _id: index._id }, index, {}, (err, numReplaced) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(numReplaced);
              });
            } else {
              // 插入新文档
              musicDB.insert(index, (err, newDoc) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(newDoc);
              });
            }
          });
        });
      } catch (error) {
        console.error(`保存索引失败: ${index._id}`, error);
      }
    }

    console.log(`索引重建完成: ${albumsMap.size}个专辑, ${artistsMap.size}个艺术家, ${genresMap.size}个流派`);
  } catch (error) {
    console.error('构建索引失败:', error);
  }
}

// 全量扫描音乐库
export async function fullScan() {
  console.log('开始扫描音乐库...');
  await ensureDirectories();
  
  const config = await getConfig();
  let totalTracks = 0;
  
  // 清除旧的音乐数据
  const oldTracks = await new Promise((resolve) => {
    musicDB.find({ type: 'track' }, (err, docs) => resolve(err ? [] : docs));
  });
  for (const track of oldTracks) {
    try {
      await new Promise((resolve, reject) => {
        musicDB.remove({ _id: track._id }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      console.error('删除旧音乐数据失败:', error);
    }
  }
  
  // 扫描所有配置的音乐库路径
  for (const libraryPath of config.musicLibraryPaths) {
    console.log(`扫描路径: ${libraryPath}`);
    const tracks = await scanDirectory(libraryPath);
    totalTracks += tracks.length;
  }
  
  // 更新最后扫描时间
  config.lastScan = new Date().toISOString();
  await saveConfig(config);
  
  // 重建索引
  await buildIndexes();
  
  console.log(`扫描完成，共找到 ${totalTracks} 首音乐`);
  return totalTracks;
}

// 启动文件监控
export async function startFileWatcher() {
  if (watcher) {
    watcher.close();
  }
  
  const config = await getConfig();
  const audioExtensions = config.supportedFormats || ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];
  
  // 监控所有配置的音乐库路径
  watcher = chokidar.watch(config.musicLibraryPaths, {
    ignored: /(^|[\/\\])\../, // 忽略隐藏文件
    persistent: true,
    ignoreInitial: true
  });

  watcher
    .on('add', async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      
      if (audioExtensions.includes(ext)) {
        console.log(`检测到新文件: ${filePath}`);
        const track = await scanMusicFile(filePath);
        if (track) {
          await buildIndexes();
        }
      }
    })
    .on('unlink', async (filePath) => {
      console.log(`文件被删除: ${filePath}`);
      try {
        const tracks = await new Promise((resolve) => {
          musicDB.find({ type: 'track', path: filePath }, (err, docs) => resolve(err ? [] : docs));
        });
        
        if (tracks.length > 0) {
          const track = tracks[0];
          await new Promise((resolve, reject) => {
            musicDB.remove({ _id: track._id }, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          await buildIndexes();
        }
      } catch (error) {
        console.error('删除音乐记录失败:', error);
      }
    })
    .on('change', async (filePath) => {
      console.log(`文件被修改: ${filePath}`);
      try {
        const tracks = await new Promise((resolve) => {
          musicDB.find({ type: 'track', path: filePath }, (err, docs) => resolve(err ? [] : docs));
        });
        
        if (tracks.length > 0) {
          const oldTrack = tracks[0];
          // 删除旧记录
          await new Promise((resolve, reject) => {
            musicDB.remove({ _id: oldTrack._id }, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          // 重新扫描文件
          const newTrack = await scanMusicFile(filePath);
          if (newTrack) {
            await buildIndexes();
          }
        }
      } catch (error) {
        console.error('更新音乐记录失败:', error);
      }
    });

  console.log('文件监控已启动');
}

// 音乐推荐算法
export async function getRecommendations(trackId, limit = 10) {
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: trackId }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    if (!track || track.type !== 'track') return [];

    const allTracks = await new Promise((resolve, reject) => {
      musicDB.find({ type: 'track' }, (err, docs) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(docs);
      });
    });
    
    const scores = new Map();

    allTracks.forEach(t => {
      if (t._id === trackId) return;
      
      let score = 0;
      
      // 相同专辑 +50分
      if (t.album === track.album && t.albumArtist === track.albumArtist) {
        score += 50;
      }
      
      // 相同艺术家 +30分
      if (t.artist === track.artist) {
        score += 30;
      }
      
      // 相同流派 +20分
      if (t.genre === track.genre) {
        score += 20;
      }
      
      // 相同年代 +10分
      if (t.year && track.year && Math.abs(t.year - track.year) <= 2) {
        score += 10;
      }
      
      // 相似时长 +5分
      if (Math.abs(t.duration - track.duration) <= 30) {
        score += 5;
      }
      
      if (score > 0) {
        scores.set(t._id, score);
      }
    });

    // 按分数排序并返回推荐
    const sortedRecommendations = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([trackId]) => allTracks.find(t => t._id === trackId));

    return sortedRecommendations;
  } catch (error) {
    console.error('获取推荐失败:', error);
    return [];
  }
}

// 初始化音乐模块
export async function initMusicModule() {
  try {
    await startFileWatcher();
    console.log('音乐模块初始化完成');
    return true;
  } catch (error) {
    console.error('音乐模块初始化失败:', error);
    return false;
  }
}