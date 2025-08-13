import Loki from 'lokijs';
import path from 'path';
import { ensureDir } from '../utils/fileUtils.js';

// 确保数据库目录存在
const dbDir = './db';
ensureDir(dbDir);

// 初始化 LokiJS 数据库
const musicDB = new Loki(path.join(dbDir, 'music.db'), {
  autoload: true,
  autoloadCallback: () => {
    initializeCollections();
    console.log('数据库加载完成');
  },
  autosave: true,
  autosaveInterval: 5000 // 5秒自动保存
});

// 初始化集合
let musicCollection;
let configCollection;
let artistCollection;
let albumCollection;

// 初始化数据库集合
function initializeCollections() {
  // 音乐集合
  if (!musicDB.getCollection('music')) {
    musicCollection = musicDB.addCollection('music', {
      indices: ['id', 'type', 'path', 'title', 'artist', 'album', 'genre', 'favorite'],
      unique: ['id', 'path']
    });
  } else {
    musicCollection = musicDB.getCollection('music');
  }
  
  // 配置集合
  if (!musicDB.getCollection('config')) {
    configCollection = musicDB.addCollection('config', {
      indices: ['id'],
      unique: ['id']
    });
  } else {
    configCollection = musicDB.getCollection('config');
  }
  
  // 艺术家集合
  if (!musicDB.getCollection('artists')) {
    artistCollection = musicDB.addCollection('artists', {
      indices: ['id', 'name', 'normalizedName'],
      unique: ['id', 'normalizedName']
    });
  } else {
    artistCollection = musicDB.getCollection('artists');
  }
  
  // 专辑集合
  if (!musicDB.getCollection('albums')) {
    albumCollection = musicDB.addCollection('albums', {
      indices: ['id', 'title', 'artist', 'normalizedTitle'],
      unique: ['id']
    });
  } else {
    albumCollection = musicDB.getCollection('albums');
  }
}

// 歌手名称分隔符
const ARTIST_SEPARATORS = ['/', '、', ',', '，', '&', '&amp;', 'feat.', 'feat', 'ft.', 'ft', 'featuring', 'vs', 'VS'];

// 格式化歌手名称
function formatArtistNames(artistString) {
  if (!artistString || typeof artistString !== 'string') {
    return [];
  }
  
  let names = [artistString];
  
  // 按分隔符分割
  for (const separator of ARTIST_SEPARATORS) {
    const newNames = [];
    for (const name of names) {
      newNames.push(...name.split(separator).map(n => n.trim()).filter(n => n));
    }
    names = newNames;
  }
  
  // 去重并过滤空字符串
  return [...new Set(names)].filter(name => name.length > 0);
}

// 生成规范化的歌手名称（用于索引）
function normalizeArtistName(name) {
  return name.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').trim();
}

// 生成规范化的专辑标题（用于索引）
function normalizeAlbumTitle(title) {
  return title.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').trim();
}

const defaultConfig = {
  id: 'app_config',
  musicLibraryPaths: ['./music'],
  lastfmApiKey: '',
  musicbrainzUserAgent: 'NAS-Music-Server/1.0.0',
  enableLastfm: true,
  enableMusicbrainz: true,
  scanInterval: 3600000, // 1小时
  supportedFormats: ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'],
  coverSize: 300,
  language: 'zh-CN',
};

// 获取配置
export async function getConfig() {
  try {
    const config = configCollection.findOne({ id: 'app_config' });
    
      if (!config) {
        // 配置不存在，创建默认配置
      const newConfig = { ...defaultConfig };
      configCollection.insert(newConfig);
      musicDB.saveDatabase();
      return newConfig;
    }
    
    return config;
  } catch (error) {
    console.error('获取配置失败:', error);
    return defaultConfig;
  }
}

// 保存配置
export async function saveConfig(config) {
  try {
    const existing = configCollection.findOne({ id: 'app_config' });
    
    if (existing) {
      // 更新现有配置
      Object.assign(existing, config);
      configCollection.update(existing);
    } else {
      // 插入新配置
      const newConfig = { id: 'app_config', ...config };
      configCollection.insert(newConfig);
    }
    
    musicDB.saveDatabase();
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    throw error;
  }
}

// 获取音乐统计信息
export async function getMusicStats() {
  try {
    const tracks = musicCollection.find({ type: 'track' });
    const albums = albumCollection.find();
    const artists = artistCollection.find();

    console.log({
      tracks: tracks.length,
      albums: albums.length,
      artists: artists.length,
    })
    
    return {
      tracks: tracks.length,
      albums: albums.length,
      artists: artists.length,
    };
  } catch (error) {
    console.error('获取音乐统计失败:', error);
    return { tracks: 0, albums: 0, artists: 0 };
  }
}

// 根据路径查找音乐
export async function findTrackByPath(trackPath) {
  try {
    return musicCollection.findOne({ path: trackPath });
  } catch (error) {
    console.error('根据路径查找音乐失败:', error);
    return null;
  }
}

// 根据路径更新或插入音乐
export async function upsertTrackByPath(trackDoc) {
  try {
    const existing = musicCollection.findOne({ path: trackDoc.path });
    
    // 格式化歌手名称
    const artistNames = formatArtistNames(trackDoc.artist);
    const albumTitle = trackDoc.album || '';
    
    // 处理歌手数据
    const artistIds = [];
    for (const artistName of artistNames) {
      const normalizedName = normalizeArtistName(artistName);
      let artist = artistCollection.findOne({ normalizedName });
      
      if (!artist) {
        // 创建新歌手记录
        artist = {
          id: `artist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: artistName,
          normalizedName,
          trackCount: 0,
          albumCount: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        artistCollection.insert(artist);
      }
      
      artistIds.push(artist.id);
      
      // 更新歌手统计（只在新增记录时增加计数）
      if (!existing) {
        artist.trackCount++;
        artist.updated_at = new Date().toISOString();
        artistCollection.update(artist);
      }
    }
    
    // 处理专辑数据
    let albumId = null;
    if (albumTitle && artistNames.length > 0) {
      const normalizedTitle = normalizeAlbumTitle(albumTitle);
      const primaryArtist = artistNames[0]; // 使用第一个歌手作为专辑的主要歌手
      
      let album = albumCollection.findOne({ 
        normalizedTitle,
        artist: primaryArtist
      });
      
      if (!album) {
        // 创建新专辑记录
        album = {
          id: `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: albumTitle,
          normalizedTitle,
          artist: primaryArtist,
          artists: artistNames, // 保存所有相关歌手
          trackCount: 0,
          year: trackDoc.year,
          coverImage: trackDoc.coverImage,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        albumCollection.insert(album);
      }
      
      albumId = album.id;
      
      // 更新专辑统计（只在新增记录时增加计数）
      if (!existing) {
        album.trackCount++;
        album.updated_at = new Date().toISOString();
        albumCollection.update(album);
      }
    }
    
    // 更新或插入音乐记录
    const musicData = {
      ...trackDoc,
      artists: artistNames, // 保存格式化后的歌手列表
      artistIds, // 保存歌手ID列表
      albumId, // 保存专辑ID
      updated_at: new Date().toISOString()
    };
    
  if (existing) {
      console.log('更新现有记录', trackDoc.title);
      Object.assign(existing, musicData);
      musicCollection.update(existing);
    } else {
      console.log('插入新记录', trackDoc.title);
      const newTrack = {
        ...musicData,
        created_at: new Date().toISOString()
      };
      musicCollection.insert(newTrack);
    }
    
    musicDB.saveDatabase();
    return true;
  } catch (error) {
    console.error('更新或插入音乐失败:', error);
    throw error;
  }
}

// 根据ID删除音乐
export async function removeTrackById(trackId) {
  try {
    const track = musicCollection.findOne({ id: trackId });
    if (track) {
      musicCollection.remove(track);
      musicDB.saveDatabase();
      return true;
    }
    return false;
  } catch (error) {
    console.error('删除音乐失败:', error);
    throw error;
  }
}

// 根据库路径前缀删除音乐
export async function removeTracksByLibraryPathPrefix(libraryPath) {
  try {
    const normalizedPath = libraryPath.replace(/\\/g, '/');
    const tracks = musicCollection.find({ type: 'track' });
    const tracksToRemove = tracks.filter(track => 
      track.path && track.path.startsWith(normalizedPath)
    );
    
    tracksToRemove.forEach(track => {
      musicCollection.remove(track);
    });
    musicDB.saveDatabase();
    return tracksToRemove.length;
  } catch (error) {
    console.error('根据库路径删除音乐失败:', error);
    throw error;
  }
}

// 删除所有音乐
export async function deleteAllTracks() {
  try {
    const tracks = musicCollection.find({ type: 'track' });
    tracks.forEach(track => {
      musicCollection.remove(track);
    });
    musicDB.saveDatabase();
    return tracks.length;
  } catch (error) {
    console.error('删除所有音乐失败:', error);
    throw error;
  }
}

// 获取所有音乐
export async function getAllTracks() {
  try {
    return musicCollection.find({ type: 'track' });
  } catch (error) {
    console.error('获取所有音乐失败:', error);
    return [];
  }
}

// 获取媒体库统计信息
export async function getMediaLibraryStats(libraryId) {
  try {
    const statsKey = `media_library_${libraryId}`;
    const stats = configCollection.findOne({ id: statsKey });
    return stats ? stats.data : null;
  } catch (error) {
    console.error('获取媒体库统计失败:', error);
    return null;
  }
}

// 删除媒体库统计信息
export async function removeMediaLibraryStats(libraryId) {
  try {
    const statsKey = `media_library_${libraryId}`;
    const stats = configCollection.findOne({ id: statsKey });
    if (stats) {
      configCollection.remove(stats);
      musicDB.saveDatabase();
    }
    return true;
  } catch (error) {
    console.error('删除媒体库统计失败:', error);
    throw error;
  }
}

// 更新媒体库统计信息
export async function updateMediaLibraryStats(libraryId, tracks) {
  try {
    const statsKey = `media_library_${libraryId}`;
    const existing = configCollection.findOne({ id: statsKey });
    
    const stats = {
      trackCount: tracks.length,
      albumCount: new Set(tracks.map(t => t.album).filter(Boolean)).size,
      artistCount: new Set(tracks.map(t => t.artist).filter(Boolean)).size,
      lastScanned: new Date().toISOString()
    };

    console.log(stats)
    
    if (existing) {
      existing.data = stats;
      configCollection.update(existing);
    } else {
      configCollection.insert({ id: statsKey, data: stats });
    }
    musicDB.saveDatabase();
    return stats;
  } catch (error) {
    console.error('更新媒体库统计失败:', error);
    throw error;
  }
}

// 重建索引
export async function rebuildIndexes() {
  try {
    // LokiJS 会自动维护索引，这里只需要确保集合存在
    initializeCollections();
    return true;
  } catch (error) {
    console.error('重建索引失败:', error);
    throw error;
  }
}

// 根据ID查找音乐
export async function findTrackById(trackId) {
  try {
    return musicCollection.findOne({ id: trackId });
  } catch (error) {
    console.error('根据ID查找音乐失败:', error);
    return null;
  }
}

// 更新音乐
export async function updateTrack(trackId, updates) {
  try {
    const track = musicCollection.findOne({ id: trackId });
    if (track) {
      Object.assign(track, updates, { updated_at: new Date().toISOString() });
      musicCollection.update(track);
      musicDB.saveDatabase();
      return true;
    }
    return false;
  } catch (error) {
    console.error('更新音乐失败:', error);
    throw error;
  }
}

// 搜索音乐
export async function searchTracks(query, limit = 50) {
  try {
    if (!query || query.trim() === '') {
      return musicCollection.find({ type: 'track' }).limit(limit);
    }
    
    const searchTerm = query.toLowerCase();
    const tracks = musicCollection.find({ type: 'track' });
    
    // 简单的文本搜索
    const results = tracks.filter(track => {
      const title = (track.title || '').toLowerCase();
      const artist = (track.artist || '').toLowerCase();
      const album = (track.album || '').toLowerCase();
      const filename = (track.filename || '').toLowerCase();
      
      return title.includes(searchTerm) || 
             artist.includes(searchTerm) || 
             album.includes(searchTerm) || 
             filename.includes(searchTerm);
    });
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('搜索音乐失败:', error);
    return [];
  }
}

// 获取收藏的音乐
export async function getFavoriteTracks() {
  try {
    return musicCollection.find({ type: 'track', favorite: 1 });
  } catch (error) {
    console.error('获取收藏音乐失败:', error);
    return [];
  }
}

// 获取最近播放的音乐
export async function getRecentlyPlayedTracks(limit = 20) {
  try {
    const tracks = musicCollection.find({ type: 'track' });
    const tracksWithLastPlayed = tracks.filter(track => track.lastPlayed);
    return tracksWithLastPlayed
      .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
      .slice(0, limit);
  } catch (error) {
    console.error('获取最近播放音乐失败:', error);
    return [];
  }
}

// 获取专辑列表
export async function getAlbums() {
  try {
    return albumCollection.find();
  } catch (error) {
    console.error('获取专辑列表失败:', error);
    return [];
  }
}

// 获取艺术家列表
export async function getArtists() {
  try {
    return artistCollection.find();
  } catch (error) {
    console.error('获取艺术家列表失败:', error);
    return [];
  }
}

// 根据歌手名称查找歌手
export async function findArtistByName(artistName) {
  try {
    const normalizedName = normalizeArtistName(artistName);
    return artistCollection.findOne({ normalizedName });
  } catch (error) {
    console.error('根据歌手名称查找失败:', error);
    return null;
  }
}

// 根据歌手ID查找歌手
export async function findArtistById(artistId) {
  try {
    return artistCollection.findOne({ id: artistId });
  } catch (error) {
    console.error('根据歌手ID查找失败:', error);
    return null;
  }
}

// 根据专辑标题和歌手查找专辑
export async function findAlbumByTitleAndArtist(albumTitle, artistName) {
  try {
    const normalizedTitle = normalizeAlbumTitle(albumTitle);
    return albumCollection.findOne({ 
      normalizedTitle,
      artist: artistName
    });
  } catch (error) {
    console.error('根据专辑标题和歌手查找失败:', error);
    return null;
  }
}

// 根据专辑ID查找专辑
export async function findAlbumById(albumId) {
  try {
    return albumCollection.findOne({ id: albumId });
  } catch (error) {
    console.error('根据专辑ID查找失败:', error);
    return null;
  }
}

// 获取歌手的音乐列表
export async function getTracksByArtist(artistId, limit = 50) {
  try {
    const tracks = musicCollection.find({ type: 'track' });
    return tracks.filter(track => 
      track.artistIds && track.artistIds.includes(artistId)
    ).slice(0, limit);
  } catch (error) {
    console.error('获取歌手音乐列表失败:', error);
    return [];
  }
}

// 获取专辑的音乐列表
export async function getTracksByAlbum(albumId, limit = 50) {
  try {
    return musicCollection.find({ 
      type: 'track',
      albumId: albumId
    }).slice(0, limit);
  } catch (error) {
    console.error('获取专辑音乐列表失败:', error);
    return [];
  }
}

// 搜索歌手
export async function searchArtists(query, limit = 20) {
  try {
    if (!query || query.trim() === '') {
      return artistCollection.find().limit(limit);
    }
    
    const searchTerm = query.toLowerCase();
    const artists = artistCollection.find();
    
    const results = artists.filter(artist => {
      const name = (artist.name || '').toLowerCase();
      const normalizedName = (artist.normalizedName || '').toLowerCase();
      
      return name.includes(searchTerm) || normalizedName.includes(searchTerm);
    });
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('搜索歌手失败:', error);
    return [];
  }
}

// 搜索专辑
export async function searchAlbums(query, limit = 20) {
  try {
    if (!query || query.trim() === '') {
      return albumCollection.find().limit(limit);
    }
    
    const searchTerm = query.toLowerCase();
    const albums = albumCollection.find();
    
    const results = albums.filter(album => {
      const title = (album.title || '').toLowerCase();
      const artist = (album.artist || '').toLowerCase();
      const normalizedTitle = (album.normalizedTitle || '').toLowerCase();
      
      return title.includes(searchTerm) || 
             artist.includes(searchTerm) || 
             normalizedTitle.includes(searchTerm);
    });
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('搜索专辑失败:', error);
    return [];
  }
}

// 导出数据库实例（用于调试）
export { musicDB, musicCollection, configCollection, artistCollection, albumCollection };

export default {
  getConfig,
  saveConfig,
  getMusicStats,
  findTrackByPath,
  upsertTrackByPath,
  removeTrackById,
  removeTracksByLibraryPathPrefix,
  deleteAllTracks,
  getAllTracks,
  getMediaLibraryStats,
  removeMediaLibraryStats,
  updateMediaLibraryStats,
  rebuildIndexes,
  findTrackById,
  updateTrack,
  searchTracks,
  getFavoriteTracks,
  getRecentlyPlayedTracks,
  getAlbums,
  getArtists,
  // 新增的歌手相关函数
  findArtistByName,
  findArtistById,
  getTracksByArtist,
  searchArtists,
  // 新增的专辑相关函数
  findAlbumByTitleAndArtist,
  findAlbumById,
  getTracksByAlbum,
  searchAlbums,
};