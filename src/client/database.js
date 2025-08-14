import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';
import { ensureDir } from '../utils/fileUtils.js';

// 确保数据库目录存在
const dbDir = './db';
ensureDir(dbDir);

// 初始化 SQLite 数据库
const dbPath = path.join(dbDir, 'music.db');
const musicDB = new sqlite3.Database(dbPath);

// 生成MD5哈希
function generateMD5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// 合并歌手信息
async function mergeArtistInfo(artistName, normalizedName) {
  try {
    // 首先尝试查找现有的歌手记录
    let artist = await queryOne('SELECT * FROM artists WHERE normalizedName = ?', [normalizedName]);
    
    if (artist) {
      // 如果找到现有记录，检查名称是否需要更新
      if (artist.name !== artistName) {
        // 更新为更完整的名称
        await run('UPDATE artists SET name = ?, updated_at = ? WHERE id = ?', [
          artistName,
          new Date().toISOString(),
          artist.id
        ]);
        artist.name = artistName;
      }
      return artist;
    }
    
    // 如果没有找到，创建新记录
    const artistId = generateMD5(artistName);
    await run('INSERT INTO artists (id, name, normalizedName, trackCount, albumCount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      artistId,
      artistName,
      normalizedName,
      0,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    return { id: artistId, name: artistName, normalizedName, trackCount: 0 };
  } catch (error) {
    // 如果插入失败（可能是并发插入），重新查询
    if (error.message.includes('UNIQUE constraint failed')) {
      const existingArtist = await queryOne('SELECT * FROM artists WHERE normalizedName = ?', [normalizedName]);
      if (existingArtist) {
        // 更新名称如果需要
        if (existingArtist.name !== artistName) {
          await run('UPDATE artists SET name = ?, updated_at = ? WHERE id = ?', [
            artistName,
            new Date().toISOString(),
            existingArtist.id
          ]);
          existingArtist.name = artistName;
        }
        return existingArtist;
      }
    }
    throw error;
  }
}

// 合并专辑信息
async function mergeAlbumInfo(albumTitle, primaryArtist, artistNames, year, coverImage) {
  try {
    const normalizedTitle = normalizeAlbumTitle(albumTitle);
    
    // 首先尝试查找现有的专辑记录 - 使用更宽松的匹配条件
    let album = await queryOne('SELECT * FROM albums WHERE normalizedTitle = ? AND artist = ?', [
      normalizedTitle,
      primaryArtist
    ]);
    
    // 如果没有找到，尝试只按标准化标题查找
    if (!album) {
      album = await queryOne('SELECT * FROM albums WHERE normalizedTitle = ?', [normalizedTitle]);
    }
    
    // 如果仍然没有找到，尝试按原始标题查找
    if (!album) {
      album = await queryOne('SELECT * FROM albums WHERE title = ?', [albumTitle]);
    }
    
    if (album) {
      // 如果找到现有记录，检查是否需要更新信息
      const needsUpdate = album.title !== albumTitle || 
                         album.artists !== serializeArray(artistNames) ||
                         (year && album.year !== year) ||
                         (coverImage && album.coverImage !== coverImage) ||
                         album.artist !== primaryArtist;
      
      if (needsUpdate) {
        // 更新专辑信息
        await run('UPDATE albums SET title = ?, artist = ?, artists = ?, year = ?, coverImage = ?, updated_at = ? WHERE id = ?', [
          albumTitle,
          primaryArtist,
          serializeArray(artistNames),
          year || album.year,
          coverImage || album.coverImage,
          new Date().toISOString(),
          album.id
        ]);
        
        // 更新本地对象
        album.title = albumTitle;
        album.artist = primaryArtist;
        album.artists = serializeArray(artistNames);
        album.year = year || album.year;
        album.coverImage = coverImage || album.coverImage;
      }
      return album;
    }
    
    // 如果没有找到，创建新记录
    const albumId = generateMD5(albumTitle);
    try {
      await run('INSERT INTO albums (id, title, normalizedTitle, artist, artists, trackCount, year, coverImage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        albumId,
        albumTitle,
        normalizedTitle,
        primaryArtist,
        serializeArray(artistNames),
        0,
        year,
        coverImage,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      
      return { id: albumId, title: albumTitle, trackCount: 0 };
    } catch (insertError) {
      // 如果插入失败（可能是并发插入），重新查询
      if (insertError.message.includes('UNIQUE constraint failed')) {
        // 尝试多种方式查找现有记录
        let existingAlbum = await queryOne('SELECT * FROM albums WHERE normalizedTitle = ? AND artist = ?', [
          normalizedTitle,
          primaryArtist
        ]);
        
        if (!existingAlbum) {
          existingAlbum = await queryOne('SELECT * FROM albums WHERE normalizedTitle = ?', [normalizedTitle]);
        }
        
        if (!existingAlbum) {
          existingAlbum = await queryOne('SELECT * FROM albums WHERE title = ?', [albumTitle]);
        }
        
        if (existingAlbum) {
          // 更新信息如果需要
          const needsUpdate = existingAlbum.title !== albumTitle || 
                             existingAlbum.artists !== serializeArray(artistNames) ||
                             (year && existingAlbum.year !== year) ||
                             (coverImage && existingAlbum.coverImage !== coverImage) ||
                             existingAlbum.artist !== primaryArtist;
          
          if (needsUpdate) {
            await run('UPDATE albums SET title = ?, artist = ?, artists = ?, year = ?, coverImage = ?, updated_at = ? WHERE id = ?', [
              albumTitle,
              primaryArtist,
              serializeArray(artistNames),
              year || existingAlbum.year,
              coverImage || existingAlbum.coverImage,
              new Date().toISOString(),
              existingAlbum.id
            ]);
            
            existingAlbum.title = albumTitle;
            existingAlbum.artist = primaryArtist;
            existingAlbum.artists = serializeArray(artistNames);
            existingAlbum.year = year || existingAlbum.year;
            existingAlbum.coverImage = coverImage || existingAlbum.coverImage;
          }
          return existingAlbum;
        }
      }
      throw insertError;
    }
  } catch (error) {
    console.error('合并专辑信息失败:', error);
    throw error;
  }
}

// 高级专辑合并和去重函数
async function mergeAndDeduplicateAlbums() {
  try {
    console.log('开始合并和去重专辑...');
    
    // 查找所有重复的专辑（基于标准化标题）
    const duplicateAlbums = await query(`
      SELECT normalizedTitle, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(title) as titles
      FROM albums 
      GROUP BY normalizedTitle 
      HAVING COUNT(*) > 1
    `);
    
    console.log(`找到 ${duplicateAlbums.length} 组重复专辑`);
    
    for (const duplicate of duplicateAlbums) {
      const albumIds = duplicate.ids.split(',');
      const titles = duplicate.titles.split(',');
      
      // 选择第一个专辑作为主记录
      const primaryAlbumId = albumIds[0];
      const primaryAlbum = await queryOne('SELECT * FROM albums WHERE id = ?', [primaryAlbumId]);
      
      if (!primaryAlbum) continue;
      
      console.log(`处理重复专辑: ${primaryAlbum.title} (${albumIds.length} 个记录)`);
      
      // 合并其他重复记录的信息到主记录
      for (let i = 1; i < albumIds.length; i++) {
        const duplicateAlbum = await queryOne('SELECT * FROM albums WHERE id = ?', [albumIds[i]]);
        if (!duplicateAlbum) continue;
        
        // 合并信息（选择更完整的信息）
        const mergedTitle = primaryAlbum.title.length >= duplicateAlbum.title.length ? 
                           primaryAlbum.title : duplicateAlbum.title;
        const mergedArtist = primaryAlbum.artist || duplicateAlbum.artist;
        const mergedYear = primaryAlbum.year || duplicateAlbum.year;
        const mergedCoverImage = primaryAlbum.coverImage || duplicateAlbum.coverImage;
        
        // 合并艺术家列表
        const primaryArtists = deserializeArray(primaryAlbum.artists);
        const duplicateArtists = deserializeArray(duplicateAlbum.artists);
        const mergedArtists = [...new Set([...primaryArtists, ...duplicateArtists])];
        
        // 更新主记录
        await run('UPDATE albums SET title = ?, artist = ?, artists = ?, year = ?, coverImage = ?, updated_at = ? WHERE id = ?', [
          mergedTitle,
          mergedArtist,
          serializeArray(mergedArtists),
          mergedYear,
          mergedCoverImage,
          new Date().toISOString(),
          primaryAlbumId
        ]);
        
        // 更新音乐记录中的专辑ID引用
        await run('UPDATE music SET albumId = ? WHERE albumId = ?', [
          primaryAlbumId,
          albumIds[i]
        ]);
        
        // 删除重复记录
        await run('DELETE FROM albums WHERE id = ?', [albumIds[i]]);
        
        console.log(`已合并并删除重复专辑: ${duplicateAlbum.title}`);
      }
    }
    
    console.log('专辑合并和去重完成');
    return true;
  } catch (error) {
    console.error('专辑合并和去重失败:', error);
    throw error;
  }
}

// 初始化数据库表
function initializeTables() {
  return new Promise((resolve, reject) => {
    // 启用 WAL 模式以提高性能
    musicDB.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) {
        console.error('启用 WAL 模式失败:', err);
      }
    });

    // 创建音乐表
    const createMusicTable = `
      CREATE TABLE IF NOT EXISTS music (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT,
        artist TEXT,
        album TEXT,
        albumArtist TEXT,
        genre TEXT,
        year INTEGER,
        trackNumber INTEGER,
        totalTracks INTEGER,
        discNumber INTEGER,
        totalDiscs INTEGER,
        duration INTEGER,
        bitrate INTEGER,
        sampleRate INTEGER,
        channels INTEGER,
        path TEXT UNIQUE NOT NULL,
        filename TEXT,
        size INTEGER,
        favorite INTEGER DEFAULT 0,
        playCount INTEGER DEFAULT 0,
        lastPlayed TEXT,
        coverImage TEXT,
        lyrics TEXT,
        artists TEXT, -- JSON 数组字符串
        artistIds TEXT, -- JSON 数组字符串
        albumId TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `;

    // 创建配置表
    const createConfigTable = `
      CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL -- JSON 字符串
      )
    `;

    // 创建艺术家表
    const createArtistsTable = `
      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalizedName TEXT UNIQUE NOT NULL,
        trackCount INTEGER DEFAULT 0,
        albumCount INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `;

    // 创建专辑表
    const createAlbumsTable = `
      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        normalizedTitle TEXT NOT NULL,
        artist TEXT NOT NULL,
        artists TEXT, -- JSON 数组字符串
        trackCount INTEGER DEFAULT 0,
        year INTEGER,
        coverImage TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `;

    // 创建索引
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_music_type ON music(type)',
      'CREATE INDEX IF NOT EXISTS idx_music_path ON music(path)',
      'CREATE INDEX IF NOT EXISTS idx_music_title ON music(title)',
      'CREATE INDEX IF NOT EXISTS idx_music_artist ON music(artist)',
      'CREATE INDEX IF NOT EXISTS idx_music_album ON music(album)',
      'CREATE INDEX IF NOT EXISTS idx_music_genre ON music(genre)',
      'CREATE INDEX IF NOT EXISTS idx_music_favorite ON music(favorite)',
      'CREATE INDEX IF NOT EXISTS idx_music_albumId ON music(albumId)',
      'CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)',
      'CREATE INDEX IF NOT EXISTS idx_artists_normalizedName ON artists(normalizedName)',
      'CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title)',
      'CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist)',
      'CREATE INDEX IF NOT EXISTS idx_albums_normalizedTitle ON albums(normalizedTitle)',
      'CREATE INDEX IF NOT EXISTS idx_albums_artist_title ON albums(artist, normalizedTitle)'
    ];

    // 执行创建表的 SQL
    musicDB.serialize(() => {
      musicDB.run(createMusicTable, (err) => {
        if (err) {
          console.error('创建音乐表失败:', err);
          reject(err);
          return;
        }
      });

      musicDB.run(createConfigTable, (err) => {
        if (err) {
          console.error('创建配置表失败:', err);
          reject(err);
          return;
        }
      });

      musicDB.run(createArtistsTable, (err) => {
        if (err) {
          console.error('创建艺术家表失败:', err);
          reject(err);
          return;
        }
      });

      musicDB.run(createAlbumsTable, (err) => {
        if (err) {
          console.error('创建专辑表失败:', err);
          reject(err);
          return;
        }
      });

      // 创建索引
      createIndexes.forEach((indexSQL, i) => {
        musicDB.run(indexSQL, (err) => {
          if (err) {
            console.error(`创建索引失败 (${i}):`, err);
          }
        });
      });

      console.log('数据库表初始化完成');
      resolve();
    });
  });
}

// 初始化数据库
initializeTables().catch(console.error);

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

// SQLite 查询辅助函数
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    musicDB.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    musicDB.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    musicDB.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// JSON 序列化辅助函数
function serializeArray(arr) {
  return arr ? JSON.stringify(arr) : null;
}

function deserializeArray(str) {
  return str ? JSON.parse(str) : [];
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
    const config = await queryOne('SELECT data FROM config WHERE id = ?', ['app_config']);
    
    if (!config) {
      // 配置不存在，创建默认配置
      const newConfig = { ...defaultConfig };
      await run('INSERT INTO config (id, data) VALUES (?, ?)', [
        'app_config',
        JSON.stringify(newConfig)
      ]);
      return newConfig;
    }
    
    return JSON.parse(config.data);
  } catch (error) {
    console.error('获取配置失败:', error);
    return defaultConfig;
  }
}

// 保存配置
export async function saveConfig(config) {
  try {
    const existing = await queryOne('SELECT id FROM config WHERE id = ?', ['app_config']);
    
    if (existing) {
      // 更新现有配置
      await run('UPDATE config SET data = ? WHERE id = ?', [
        JSON.stringify(config),
        'app_config'
      ]);
    } else {
      // 插入新配置
      await run('INSERT INTO config (id, data) VALUES (?, ?)', [
        'app_config',
        JSON.stringify(config)
      ]);
    }
    
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    throw error;
  }
}

// 获取音乐统计信息
export async function getMusicStats() {
  try {
    const [tracksResult, albumsResult, artistsResult] = await Promise.all([
      queryOne('SELECT COUNT(*) as count FROM music WHERE type = ?', ['track']),
      queryOne('SELECT COUNT(*) as count FROM albums'),
      queryOne('SELECT COUNT(*) as count FROM artists')
    ]);
    const stats = {
      tracks: tracksResult?.count || 0,
      albums: albumsResult?.count || 0,
      artists: artistsResult?.count || 0,
    };
    return stats;
  } catch (error) {
    console.error('获取音乐统计失败:', error);
    return { tracks: 0, albums: 0, artists: 0 };
  }
}

// 根据路径查找音乐
export async function findTrackByPath(trackPath) {
  try {
    const track = await queryOne('SELECT * FROM music WHERE path = ?', [trackPath]);
    if (track) {
      // 反序列化数组字段
      track.artists = deserializeArray(track.artists);
      track.artistIds = deserializeArray(track.artistIds);
    }
    return track;
  } catch (error) {
    console.error('根据路径查找音乐失败:', error);
    return null;
  }
}

// 根据路径更新或插入音乐
export async function upsertTrackByPath(trackDoc) {
  trackDoc.id = generateMD5(trackDoc.path);
  try {
    const existing = await queryOne('SELECT id FROM music WHERE path = ?', [trackDoc.path]);
    
    // 格式化歌手名称
    const artistNames = formatArtistNames(trackDoc.artist);
    const albumTitle = trackDoc.album || '';
    
    // 处理歌手数据
    const artistIds = [];
    for (const artistName of artistNames) {
      const normalizedName = normalizeArtistName(artistName);
      const artist = await mergeArtistInfo(artistName, normalizedName);
      
      artistIds.push(artist.id);
      
      // 更新歌手统计（只在新增记录时增加计数）
      if (!existing) {
        await run('UPDATE artists SET trackCount = trackCount + 1, updated_at = ? WHERE id = ?', [
          new Date().toISOString(),
          artist.id
        ]);
      }
    }
    
    // 处理专辑数据
    let albumId = null;
    if (albumTitle && artistNames.length > 0) {
      const primaryArtist = artistNames[0]; // 使用第一个歌手作为专辑的主要歌手
      
      let album = await mergeAlbumInfo(albumTitle, primaryArtist, artistNames, trackDoc.year, trackDoc.coverImage);
      
      albumId = album.id;
      
      // 更新专辑统计（只在新增记录时增加计数）
      if (!existing) {
        await run('UPDATE albums SET trackCount = trackCount + 1, updated_at = ? WHERE id = ?', [
          new Date().toISOString(),
          album.id
        ]);
      }
    }
    
    // 更新或插入音乐记录
    const now = new Date().toISOString();
    
    if (existing) {
      console.log('更新现有记录', trackDoc.title);
      await run(`
        UPDATE music SET 
          title = ?, artist = ?, album = ?, albumArtist = ?, genre = ?, year = ?,
          trackNumber = ?, totalTracks = ?, discNumber = ?, totalDiscs = ?, duration = ?, bitrate = ?,
          sampleRate = ?, channels = ?, filename = ?, size = ?, favorite = ?, playCount = ?,
          lastPlayed = ?, coverImage = ?, lyrics = ?, artists = ?, artistIds = ?, albumId = ?, updated_at = ?
        WHERE path = ?
      `, [
        trackDoc.title, trackDoc.artist, trackDoc.album, trackDoc.albumArtist, trackDoc.genre, trackDoc.year,
        trackDoc.trackNumber, trackDoc.totalTracks, trackDoc.discNumber, trackDoc.totalDiscs, trackDoc.duration, trackDoc.bitrate,
        trackDoc.sampleRate, trackDoc.channels, trackDoc.filename, trackDoc.size, trackDoc.favorite, trackDoc.playCount,
        trackDoc.lastPlayed, trackDoc.coverImage, trackDoc.lyrics, serializeArray(artistNames), serializeArray(artistIds), albumId, now,
        trackDoc.path
      ]);
    } else {
      console.log('插入新记录', trackDoc.title);
      await run(`
        INSERT INTO music (
          id, type, title, artist, album, albumArtist, genre, year,
          trackNumber, totalTracks, discNumber, totalDiscs, duration, bitrate,
          sampleRate, channels, path, filename, size, favorite, playCount,
          lastPlayed, coverImage, lyrics, artists, artistIds, albumId, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        trackDoc.id, trackDoc.type, trackDoc.title, trackDoc.artist, trackDoc.album, trackDoc.albumArtist, trackDoc.genre, trackDoc.year,
        trackDoc.trackNumber, trackDoc.totalTracks, trackDoc.discNumber, trackDoc.totalDiscs, trackDoc.duration, trackDoc.bitrate,
        trackDoc.sampleRate, trackDoc.channels, trackDoc.path, trackDoc.filename, trackDoc.size, trackDoc.favorite, trackDoc.playCount,
        trackDoc.lastPlayed, trackDoc.coverImage, trackDoc.lyrics, serializeArray(artistNames), serializeArray(artistIds), albumId, now, now
      ]);
    }
    
    return true;
  } catch (error) {
    console.error('更新或插入音乐失败:', error);
    throw error;
  }
}

// 根据ID删除音乐
export async function removeTrackById(trackId) {
  try {
    const result = await run('DELETE FROM music WHERE id = ?', [trackId]);
    return result.changes > 0;
  } catch (error) {
    console.error('删除音乐失败:', error);
    throw error;
  }
}

// 根据库路径前缀删除音乐
export async function removeTracksByLibraryPathPrefix(libraryPath) {
  try {
    const normalizedPath = libraryPath.replace(/\\/g, '/');
    const result = await run('DELETE FROM music WHERE type = ? AND path LIKE ?', [
      'track',
      `${normalizedPath}%`
    ]);
    return result.changes;
  } catch (error) {
    console.error('根据库路径删除音乐失败:', error);
    throw error;
  }
}

// 删除所有音乐
export async function deleteAllTracks() {
  try {
    const result = await run('DELETE FROM music WHERE type = ?', ['track']);
    return result.changes;
  } catch (error) {
    console.error('删除所有音乐失败:', error);
    throw error;
  }
}

// 获取所有音乐（支持搜索、排序、分页）
export async function getAllTracks(options = {}) {
  try {
    const {
      search = '',
      sort = 'title',
      order = 'asc',
      page = 1,
      pageSize = 10,
      genre,
      artist,
      album,
      yearFrom,
      yearTo,
      decade,
      minBitrate,
      maxBitrate,
      favorite
    } = options;

    // 构建 WHERE 条件
    const whereConditions = ['type = ?'];
    const params = ['track'];

    if (search) {
      whereConditions.push('(title LIKE ? OR artist LIKE ? OR album LIKE ? OR filename LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (genre) {
      whereConditions.push('genre LIKE ?');
      params.push(`%${genre}%`);
    }

    if (artist) {
      whereConditions.push('artist LIKE ?');
      params.push(`%${artist}%`);
    }

    if (album) {
      whereConditions.push('album LIKE ?');
      params.push(`%${album}%`);
    }

    if (yearFrom) {
      whereConditions.push('year >= ?');
      params.push(parseInt(yearFrom));
    }

    if (yearTo) {
      whereConditions.push('year <= ?');
      params.push(parseInt(yearTo));
    }

    if (decade) {
      const decadeStart = parseInt(decade);
      const decadeEnd = decadeStart + 9;
      whereConditions.push('year >= ? AND year <= ?');
      params.push(decadeStart, decadeEnd);
    }

    if (minBitrate) {
      whereConditions.push('bitrate >= ?');
      params.push(parseInt(minBitrate));
    }

    if (maxBitrate) {
      whereConditions.push('bitrate <= ?');
      params.push(parseInt(maxBitrate));
    }

    if (favorite !== undefined) {
      const isFavorite = favorite === 'true' || favorite === '1' || favorite === true;
      whereConditions.push('favorite = ?');
      params.push(isFavorite ? 1 : 0);
    }

    // 构建 SQL 查询
    let sql = 'SELECT * FROM music WHERE ' + whereConditions.join(' AND ');

    // 添加排序
    const validSortFields = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed', 'favorite', 'lyrics', 'size'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await queryOne(countSql, params);
    const total = countResult ? countResult.count : 0;

    // 添加分页
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const tracks = await query(sql, params);
    
    return {
      data: tracks.map(track => ({
        ...track,
        artists: deserializeArray(track.artists),
        artistIds: deserializeArray(track.artistIds)
      })),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('获取音乐列表失败:', error);
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
      }
    };
  }
}

// 获取媒体库统计信息
export async function getMediaLibraryStats(libraryId) {
  try {
    const statsKey = `media_library_${libraryId}`;
    const stats = await queryOne('SELECT data FROM config WHERE id = ?', [statsKey]);
    return stats ? JSON.parse(stats.data) : null;
  } catch (error) {
    console.error('获取媒体库统计失败:', error);
    return null;
  }
}

// 删除媒体库统计信息
export async function removeMediaLibraryStats(libraryId) {
  try {
    const statsKey = `media_library_${libraryId}`;
    await run('DELETE FROM config WHERE id = ?', [statsKey]);
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
    const existing = await queryOne('SELECT id FROM config WHERE id = ?', [statsKey]);
    
    const stats = {
      trackCount: tracks.length,
      albumCount: new Set(tracks.map(t => t.album).filter(Boolean)).size,
      artistCount: new Set(tracks.map(t => t.artist).filter(Boolean)).size,
      lastScanned: new Date().toISOString()
    };
    if (existing) {
      await run('UPDATE config SET data = ? WHERE id = ?', [
        JSON.stringify(stats),
        statsKey
      ]);
    } else {
      await run('INSERT INTO config (id, data) VALUES (?, ?)', [
        statsKey,
        JSON.stringify(stats)
      ]);
    }
    return stats;
  } catch (error) {
    console.error('更新媒体库统计失败:', error);
    throw error;
  }
}

// 重建索引
export async function rebuildIndexes() {
  try {
    // SQLite 会自动维护索引，这里只需要重新分析表
    await run('ANALYZE');
    return true;
  } catch (error) {
    console.error('重建索引失败:', error);
    throw error;
  }
}

// 根据ID查找音乐
export async function findTrackById(trackId) {
  try {
    const track = await queryOne('SELECT * FROM music WHERE id = ?', [trackId]);
    if (track) {
      track.artists = deserializeArray(track.artists);
      track.artistIds = deserializeArray(track.artistIds);
    }
    return track;
  } catch (error) {
    console.error('根据ID查找音乐失败:', error);
    return null;
  }
}

// 更新音乐
export async function updateTrack(trackId, updates) {
  try {
    const track = await queryOne('SELECT id FROM music WHERE id = ?', [trackId]);
    if (track) {
      const updateFields = [];
      const updateValues = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'artists' || key === 'artistIds') {
          updateFields.push(`${key} = ?`);
          updateValues.push(serializeArray(value));
        } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }
      
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(trackId);
      
      await run(`UPDATE music SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
      return true;
    }
    return false;
  } catch (error) {
    console.error('更新音乐失败:', error);
    throw error;
  }
}


// 获取收藏的音乐（支持排序、分页）
export async function getFavoriteTracks(options = {}) {
  try {
    const {
      sort = 'title',
      order = 'asc',
      page = 1,
      pageSize = 10
    } = options;

    // 构建 SQL 查询
    let sql = 'SELECT * FROM music WHERE type = ? AND favorite = 1';

    // 添加排序
    const validSortFields = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await queryOne(countSql, ['track']);
    const total = countResult ? countResult.count : 0;

    // 添加分页
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';

    const tracks = await query(sql, ['track', pageSize, offset]);
    
    return {
      data: tracks.map(track => ({
        ...track,
        artists: deserializeArray(track.artists),
        artistIds: deserializeArray(track.artistIds)
      })),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('获取收藏音乐失败:', error);
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
      }
    };
  }
}

// 获取最近播放的音乐（支持分页）
export async function getRecentlyPlayedTracks(options = {}) {
  try {
    const {
      limit = 20,
      offset = 0
    } = options;

    const tracks = await query(`
      SELECT * FROM music 
      WHERE type = ? AND lastPlayed IS NOT NULL 
      ORDER BY lastPlayed DESC 
      LIMIT ? OFFSET ?
    `, ['track', limit, offset]);
    
    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as count FROM music 
      WHERE type = ? AND lastPlayed IS NOT NULL
    `, ['track']);
    const total = countResult ? countResult.count : 0;
    
    return {
      data: tracks.map(track => ({
        ...track,
        artists: deserializeArray(track.artists),
        artistIds: deserializeArray(track.artistIds)
      })),
      total
    };
  } catch (error) {
    console.error('获取最近播放音乐失败:', error);
    return {
      data: [],
      total: 0
    };
  }
}

// 获取专辑列表（支持搜索、排序、分页）
export async function getAlbums(options = {}) {
  try {
    const {
      query: searchQuery = '',
      sort = 'title',
      order = 'asc',
      page = 1,
      pageSize = 10
    } = options;

    // 构建 WHERE 条件
    const whereConditions = [];
    const params = [];

    if (searchQuery) {
      whereConditions.push('(title LIKE ? OR artist LIKE ?)');
      const searchTerm = `%${searchQuery}%`;
      params.push(searchTerm, searchTerm);
    }

    // 构建 SQL 查询
    let sql = 'SELECT * FROM albums';
    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }

    // 添加排序
    const validSortFields = ['title', 'artist', 'year', 'trackCount'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await queryOne(countSql, params);
    const total = countResult ? countResult.count : 0;

    // 添加分页
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const albums = await query(sql, params);
    
    return {
      data: albums.map(album => ({
        ...album,
        artists: deserializeArray(album.artists)
      })),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('获取专辑列表失败:', error);
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
      }
    };
  }
}

// 获取艺术家列表（支持搜索、排序、分页）
export async function getArtists(options = {}) {
  try {
    const {
      query: searchQuery = '',
      sort = 'name',
      order = 'asc',
      page = 1,
      pageSize = 10
    } = options;

    // 构建 WHERE 条件
    const whereConditions = [];
    const params = [];

    if (searchQuery) {
      whereConditions.push('name LIKE ?');
      params.push(`%${searchQuery}%`);
    }

    // 构建 SQL 查询
    let sql = 'SELECT * FROM artists';
    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }

    // 添加排序
    const validSortFields = ['name', 'trackCount', 'albumCount'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'name';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await queryOne(countSql, params);
    const total = countResult ? countResult.count : 0;

    // 添加分页
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const artists = await query(sql, params);
    
    return {
      data: artists,
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('获取艺术家列表失败:', error);
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
      }
    };
  }
}

// 根据歌手名称查找歌手
export async function findArtistByName(artistName) {
  try {
    const normalizedName = normalizeArtistName(artistName);
    return await queryOne('SELECT * FROM artists WHERE normalizedName = ?', [normalizedName]);
  } catch (error) {
    console.error('根据歌手名称查找失败:', error);
    return null;
  }
}

// 根据歌手ID查找歌手
export async function findArtistById(artistId) {
  try {
    return await queryOne('SELECT * FROM artists WHERE id = ?', [artistId]);
  } catch (error) {
    console.error('根据歌手ID查找失败:', error);
    return null;
  }
}

// 根据专辑标题和歌手查找专辑
export async function findAlbumByTitleAndArtist(albumTitle, artistName) {
  try {
    const normalizedTitle = normalizeAlbumTitle(albumTitle);
    const album = await queryOne('SELECT * FROM albums WHERE normalizedTitle = ? AND artist = ?', [
      normalizedTitle,
      artistName
    ]);
    if (album) {
      album.artists = deserializeArray(album.artists);
    }
    return album;
  } catch (error) {
    console.error('根据专辑标题和歌手查找失败:', error);
    return null;
  }
}

// 根据专辑ID查找专辑
export async function findAlbumById(albumId) {
  try {
    const album = await queryOne('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (album) {
      album.artists = deserializeArray(album.artists);
    }
    return album;
  } catch (error) {
    console.error('根据专辑ID查找失败:', error);
    return null;
  }
}

// 获取歌手的音乐列表
export async function getTracksByArtist(artistId, limit = 10) {
  try {
    const tracks = await query(`
      SELECT * FROM music 
      WHERE type = ? AND artistIds LIKE ? 
      LIMIT ?
    `, ['track', `%${artistId}%`, limit]);
    
    return tracks.map(track => {
      track.artists = deserializeArray(track.artists);
      track.artistIds = deserializeArray(track.artistIds);
      return track;
    });
  } catch (error) {
    console.error('获取歌手音乐列表失败:', error);
    return [];
  }
}

// 获取专辑的音乐列表
export async function getTracksByAlbum(albumId, limit = 10) {
  try {
    const tracks = await query('SELECT * FROM music WHERE type = ? AND albumId = ? LIMIT ?', [
      'track',
      albumId,
      limit
    ]);
    
    return tracks.map(track => {
      track.artists = deserializeArray(track.artists);
      track.artistIds = deserializeArray(track.artistIds);
      return track;
    });
  } catch (error) {
    console.error('获取专辑音乐列表失败:', error);
    return [];
  }
}

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
  getFavoriteTracks,
  getRecentlyPlayedTracks,
  getAlbums,
  getArtists,
  findArtistByName,
  findArtistById,
  getTracksByArtist,
  findAlbumByTitleAndArtist,
  findAlbumById,
  getTracksByAlbum,
  mergeAndDeduplicateAlbums
};