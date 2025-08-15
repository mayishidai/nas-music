import client from './sqlite.js'
import './initDatabase.js'
import { merge } from '../utils/dataUtils.js'

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

// 生成MD5哈希
function generateMD5(str) {
  return client.util.md5(str);
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
    const config = client.queryOne('config', { id: 'app_config' });
    
    if (!config) {
      // 配置不存在，创建默认配置
      const newConfig = { ...defaultConfig };
      client.insert('config', {
        id: 'app_config',
        data: JSON.stringify(newConfig)
      });
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
    const existing = client.queryOne('config', { id: 'app_config' });
    
    if (existing) {
      // 更新现有配置
      client.update('config', { data: JSON.stringify(config) }, { id: 'app_config' });
    } else {
      // 插入新配置
      client.insert('config', {
        id: 'app_config',
        data: JSON.stringify(config)
      });
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
    const tracksCount = client.count('music', { type: 'track' });
    const albumsCount = client.count('albums', {});
    const artistsCount = client.count('artists', {});
    
    const stats = {
      tracks: tracksCount || 0,
      albums: albumsCount || 0,
      artists: artistsCount || 0,
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
    const track = client.queryOne('music', { path: trackPath });
    
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
    const existing = client.queryOne('music', { path: trackDoc.path });
    
    // 格式化歌手名称
    const artistNames = formatArtistNames(trackDoc.artist);
    const albumTitle = trackDoc.album || '';
    
    // 处理歌手数据
    const artistIds = [];
    for (const artistName of artistNames) {
      const normalizedName = normalizeArtistName(artistName);
      const artist = await mergeArtistInfo(artistName, normalizedName, trackDoc.artistInfo);
      artistIds.push(artist.id);
    }
    
    // 处理专辑数据
    let albumId = null;
    if (albumTitle && artistNames.length > 0) {
      const primaryArtist = artistNames[0]; // 使用第一个歌手作为专辑的主要歌手
      let album = await mergeAlbumInfo(albumTitle, primaryArtist, artistNames, trackDoc.year, trackDoc.coverImage);
      albumId = album.id;
    }
    
    // 更新或插入音乐记录
    const now = new Date().toISOString();
    const musicData = {
      title: trackDoc.title,
      artist: trackDoc.artist,
      album: trackDoc.album,
      albumArtist: trackDoc.albumArtist,
      genre: trackDoc.genre,
      year: trackDoc.year,
      trackNumber: trackDoc.trackNumber,
      totalTracks: trackDoc.totalTracks,
      discNumber: trackDoc.discNumber,
      totalDiscs: trackDoc.totalDiscs,
      duration: trackDoc.duration,
      bitrate: trackDoc.bitrate,
      sampleRate: trackDoc.sampleRate,
      channels: trackDoc.channels,
      filename: trackDoc.filename,
      size: trackDoc.size,
      favorite: trackDoc.favorite,
      playCount: trackDoc.playCount,
      lastPlayed: trackDoc.lastPlayed,
      coverImage: trackDoc.coverImage,
      lyrics: trackDoc.lyrics,
      artists: serializeArray(artistNames),
      artistIds: serializeArray(artistIds),
      albumId: albumId,
      updated_at: now
    };
    
    if (existing) {
      console.log('更新现有记录', trackDoc.title);
      client.update('music', musicData, { path: trackDoc.path });
    } else {
      console.log('插入新记录', trackDoc.title);
      client.insert('music', {
        ...musicData,
        id: trackDoc.id,
        type: trackDoc.type,
        path: trackDoc.path,
        created_at: now
      });
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
    return client.delete('music', { id: trackId });
  } catch (error) {
    console.error('删除音乐失败:', error);
    throw error;
  }
}

// 根据库路径前缀删除音乐
export async function removeTracksByLibraryPathPrefix(libraryPath) {
  try {
    const normalizedPath = libraryPath.replace(/\\/g, '/');
    return client.delete('music', {
      type: 'track',
      path: { operator: 'LIKE', value: `${normalizedPath}%` }
    });
  } catch (error) {
    console.error('根据库路径删除音乐失败:', error);
    throw error;
  }
}

// 删除所有音乐
export async function deleteAllTracks() {
  try {
    return client.delete('music', { type: 'track' });
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

    // 构建查询条件
    const conditions = { type: 'track' };

    if (search) {
      conditions.title = { operator: 'LIKE', data: search };
      conditions.artist = { operator: 'LIKE', data: search };
      conditions.album = { operator: 'LIKE', data: search };
      conditions.filename = { operator: 'LIKE', data: search };
    }

    if (genre) {
      conditions.genre = { operator: 'LIKE', data: genre };
    }

    if (artist) {
      conditions.artist = { operator: 'LIKE', data: artist };
    }

    if (album) {
      conditions.album = { operator: 'LIKE', data: album };
    }

    if (yearFrom) {
      conditions.year = { operator: '>=', data: parseInt(yearFrom) };
    }

    if (yearTo) {
      conditions.year = { operator: '<=', data: parseInt(yearTo) };
    }

    if (decade) {
      const decadeStart = parseInt(decade);
      const decadeEnd = decadeStart + 9;
      conditions.year = { operator: 'BETWEEN', data: [decadeStart, decadeEnd] };
    }

    if (minBitrate) {
      conditions.bitrate = { operator: '>=', data: parseInt(minBitrate) };
    }

    if (maxBitrate) {
      conditions.bitrate = { operator: '<=', data: parseInt(maxBitrate) };
    }

    if (favorite !== undefined) {
      const isFavorite = favorite === 'true' || favorite === '1' || favorite === true;
      conditions.favorite = isFavorite ? 1 : 0;
    }

    // 验证排序字段
    const validSortFields = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed', 'favorite', 'lyrics', 'size'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    const result = client.page('music', page, pageSize, `${sortField} ${sortOrder}`, conditions);
    
    return {
      data: result.data.map(track => ({
        ...track,
        artists: deserializeArray(track.artists),
        artistIds: deserializeArray(track.artistIds)
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.totalCount,
        pages: result.totalPage
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
    const stats = client.queryOne('config', { id: statsKey });
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
    client.delete('config', { id: statsKey });
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
    const existing = client.queryOne('config', { id: statsKey });
    
    const stats = {
      trackCount: tracks.length,
      albumCount: new Set(tracks.map(t => t.album).filter(Boolean)).size,
      artistCount: new Set(tracks.map(t => t.artist).filter(Boolean)).size,
      lastScanned: new Date().toISOString()
    };
    if (existing) {
      client.update('config', { data: JSON.stringify(stats) }, { id: statsKey });
    } else {
      client.insert('config', {
        id: statsKey,
        data: JSON.stringify(stats)
      });
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
    client.db.execute('ANALYZE');
    return true;
  } catch (error) {
    console.error('重建索引失败:', error);
    throw error;
  }
}

// 根据ID查找音乐
export async function findTrackById(trackId) {
  try {
    const track = client.queryOne('music', { id: trackId });
    
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
    const track = client.queryOne('music', { id: trackId });
    if (!track) {
      return false;
    }

    // 处理特殊字段（数组字段需要序列化）
    const processedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'artists' || key === 'artistIds') {
        processedUpdates[key] = serializeArray(value);
      } else {
        processedUpdates[key] = value;
      }
    }
    return client.update('music', processedUpdates, { id: trackId });
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

    // 验证排序字段
    const validSortFields = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    const result = client.page('music', page, pageSize, `${sortField} ${sortOrder}`, { 
      type: 'track', 
      favorite: 1 
    });
    
    return {
      data: result.data.map(track => ({
        ...track,
        artists: deserializeArray(track.artists),
        artistIds: deserializeArray(track.artistIds)
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.totalCount,
        pages: result.totalPage
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

    const tracks = client.queryAll('music', {
      conditions: { 
        type: 'track',
        lastPlayed: { operator: 'IS NOT', data: null }
      },
      orderBy: 'lastPlayed',
      order: 'DESC',
      limit,
      offset
    });
    
    // 获取总数
    const total = client.count('music', { 
      type: 'track',
      lastPlayed: { operator: 'IS NOT', data: null }
    });
    
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

    // 构建查询条件
    const conditions = {};

    if (searchQuery) {
      conditions.title = { operator: 'LIKE', data: searchQuery };
      conditions.artist = { operator: 'LIKE', data: searchQuery };
    }

    // 验证排序字段
    const validSortFields = ['title', 'artist', 'year', 'trackCount'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    const result = client.page('albums', page, pageSize, `${sortField} ${sortOrder}`, conditions);
    
    return {
      data: result.data.map(album => ({
        ...album,
        artists: deserializeArray(album.artists)
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.totalCount,
        pages: result.totalPage
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

    // 构建查询条件
    const conditions = {};

    if (searchQuery) {
      conditions.name = { operator: 'LIKE', data: searchQuery };
    }

    // 验证排序字段
    const validSortFields = ['name', 'trackCount', 'albumCount', 'country', 'genre'];
    const validOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'name';
    const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
    
    const result = client.page('artists', page, pageSize, `${sortField} ${sortOrder}`, conditions);
    
    // 处理社交媒体字段
    const processedArtists = result.data.map(artist => {
      if (artist.socialMedia) {
        try {
          artist.socialMedia = JSON.parse(artist.socialMedia);
        } catch (e) {
          artist.socialMedia = null;
        }
      }
      return artist;
    });
    
    return {
      data: processedArtists,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.totalCount,
        pages: result.totalPage
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

// 更新艺术家信息
export async function updateArtistInfo(artistId, artistInfo) {
  try {
    // 处理特殊字段（社交媒体需要序列化）
    const processedUpdates = {};
    for (const [key, value] of Object.entries(artistInfo)) {
      if (key === 'socialMedia') {
        processedUpdates[key] = JSON.stringify(value);
      } else {
        processedUpdates[key] = value;
      }
    }
    return client.update('artists', processedUpdates, { id: artistId });
  } catch (error) {
    console.error('更新艺术家信息失败:', error);
    return false;
  }
}

// 获取艺术家详细信息（包含社交媒体链接的解析）
export async function getArtistDetails(artistId) {
  try {
    const artist = client.queryOne('artists', { id: artistId });
    if (artist && artist.socialMedia) {
      try {
        artist.socialMedia = JSON.parse(artist.socialMedia);
      } catch (e) {
        artist.socialMedia = null;
      }
    }
    return artist;
  } catch (error) {
    console.error('获取艺术家详细信息失败:', error);
    return null;
  }
}

// 根据歌手名称查找歌手
export async function findArtistByName(artistName) {
  try {
    const normalizedName = normalizeArtistName(artistName);
    return client.queryOne('artists', { normalizedName });
  } catch (error) {
    console.error('根据歌手名称查找失败:', error);
    return null;
  }
}

// 根据歌手ID查找歌手
export async function findArtistById(artistId) {
  try {
    return client.queryOne('artists', { id: artistId });
  } catch (error) {
    console.error('根据歌手ID查找失败:', error);
    return null;
  }
}

// 根据专辑标题和歌手查找专辑
export async function findAlbumByTitleAndArtist(albumTitle, artistName) {
  try {
    const normalizedTitle = normalizeAlbumTitle(albumTitle);
    const album = client.queryOne('albums', { 
      normalizedTitle,
      artist: artistName
    });
    
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
    const album = client.queryOne('albums', { id: albumId });
    
    if (album) {
      album.artists = deserializeArray(album.artists);
    }
    return album;
  } catch (error) {
    console.error('根据专辑ID查找失败:', error);
    return null;
  }
}

// 获取专辑的音乐列表
export async function getTracksByAlbum(albumId) {
  try {
    const tracks = client.queryAll('music', { 
      type: 'track',
      albumId: albumId
    });
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

// 获取歌手的音乐列表
export async function getTracksByArtist(artistId, limit = 10) {
  try {
    const tracks = client.queryAll('music', {
      conditions: { 
        type: 'track',
        artistIds: { operator: 'LIKE', data: artistId }
      },
      limit
    });
    
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

// 为没有封面的专辑自动获取封面
export async function updateAlbumsWithoutCover() {
  try {
    console.log('开始为没有封面的专辑获取封面...');
    const albumsWithoutCover = client.queryAll('albums', { coverImage: { operator: 'IS', data: null } });
    console.log(`找到 ${albumsWithoutCover.length} 个没有封面的专辑`);
    let updatedCount = 0;
    for (const album of albumsWithoutCover) {
      try {
        // 获取该专辑的所有歌曲
        const tracks = client.queryOne('music', {
          type: 'track',
          albumId: album.id,
          coverImage: { operator: 'IS NOT', data: null }
        });
        
        if (tracks && tracks.coverImage) {
          // 更新专辑封面
          client.update('albums', { coverImage: tracks.coverImage, updated_at: new Date().toISOString() }, { id: album.id });
          console.log(`已为专辑 "${album.title}" 设置封面: ${tracks.coverImage}`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`为专辑 "${album.title}" 获取封面失败:`, error);
      }
    }
    console.log(`专辑封面更新完成，共更新了 ${updatedCount} 个专辑`);
    return updatedCount;
  } catch (error) {
    console.error('更新专辑封面失败:', error);
    throw error;
  }
}

// 为没有图片的歌手自动获取图片
export async function updateArtistsWithoutPhoto() {
  try {
    console.log('开始为没有图片的歌手获取图片...');
    // 查找所有没有图片的歌手
    const artistsWithoutPhoto = client.queryAll('artists', { photo: { operator: 'IS', data: null } });
    console.log(`找到 ${artistsWithoutPhoto.length} 个没有图片的歌手`);
    let updatedCount = 0;
    for (const artist of artistsWithoutPhoto) {
      try {
        // 获取该歌手的歌曲，优先选择有封面的歌曲
        const tracksWithCover = client.queryOne('music', {
          type: 'track',
          artistIds: { operator: 'LIKE', data: artist.id },
          coverImage: { operator: 'IS NOT', data: null }
        });
        if (tracksWithCover && tracksWithCover.coverImage) {
          // 更新歌手图片
          client.update('artists', {
            photo: tracksWithCover.coverImage,
            updated_at: new Date().toISOString()
          }, { id: artist.id });
          console.log(`已为歌手 "${artist.name}" 设置图片: ${tracksWithCover.coverImage}`);
          updatedCount++;
        } else {
          // 如果没有找到有封面的歌曲，尝试获取任何歌曲的封面
          const anyTracks = client.queryOne('music', {
            type: 'track',
            artistIds: { operator: 'LIKE', data: artist.id }
          });
          
          if (anyTracks && anyTracks.coverImage) {
            // 更新歌手图片
            client.update('artists', {
              photo: anyTracks.coverImage,
              updated_at: new Date().toISOString()
            }, { id: artist.id });
            
            console.log(`已为歌手 "${artist.name}" 设置图片: ${anyTracks.coverImage}`);
            updatedCount++;
          }
        }
      } catch (error) {
        console.error(`为歌手 "${artist.name}" 获取图片失败:`, error);
      }
    }
    console.log(`歌手图片更新完成，共更新了 ${updatedCount} 个歌手`);
    return updatedCount;
  } catch (error) {
    console.error('更新歌手图片失败:', error);
    throw error;
  }
}

// 扫描音乐库后的完整处理流程
export async function postScanProcessing() {
  try {
    console.log('开始扫描后处理...');
    
    // 1. 合并和去重专辑
    await mergeAndDeduplicateAlbums();
    
    // 2. 为没有封面的专辑获取封面
    const albumUpdateCount = await updateAlbumsWithoutCover();
    
    // 3. 为没有图片的歌手获取图片
    const artistUpdateCount = await updateArtistsWithoutPhoto();
    
    console.log(`扫描后处理完成:`);
    console.log(`- 专辑封面更新: ${albumUpdateCount} 个`);
    console.log(`- 歌手图片更新: ${artistUpdateCount} 个`);
    
    return {
      albumCoverUpdates: albumUpdateCount,
      artistPhotoUpdates: artistUpdateCount
    };
  } catch (error) {
    console.error('扫描后处理失败:', error);
    throw error;
  }
}


// 高级专辑合并和去重函数
async function mergeAndDeduplicateAlbums() {
  try {
    console.log('开始合并和去重专辑...');
    
    // 查找所有重复的专辑（基于标准化标题）
    const duplicateAlbums = client.db.queryAll(`
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
      const primaryAlbum = client.queryOne('albums', { id: primaryAlbumId });
      
      if (!primaryAlbum) continue;
      
      console.log(`处理重复专辑: ${primaryAlbum.title} (${albumIds.length} 个记录)`);
      
      // 合并其他重复记录的信息到主记录
      for (let i = 1; i < albumIds.length; i++) {
        const duplicateAlbum = client.queryOne('albums', { id: albumIds[i] });
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
        client.update('albums', {
          title: mergedTitle,
          artist: mergedArtist,
          artists: serializeArray(mergedArtists),
          year: mergedYear,
          coverImage: mergedCoverImage,
          updated_at: new Date().toISOString()
        }, { id: primaryAlbumId });
        
        // 更新音乐记录中的专辑ID引用
        client.update('music', { albumId: primaryAlbumId }, { albumId: albumIds[i] });
        
        // 删除重复记录
        client.delete('albums', { id: albumIds[i] });
        
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

// 合并歌手信息
async function mergeArtistInfo(artistName, normalizedName, artistInfo = {}) {
  try {
    artistInfo.normalizedName = normalizedName;
    // 首先尝试查找现有的歌手记录
    let artist = client.queryOne('artists', { normalizedName });
    if (!artist){
      artist = client.queryOne('artists', { name: artistName });
    }
    if (artist) {
      artist = merge(artist, artistInfo);
      artist.updated_at = new Date().toISOString();
      client.update('artists', artist, { id: artist.id });
      return artist;
    }
    // 如果没有找到，创建新记录
    const artistId = generateMD5(artistName);
    const socialMediaJson = artistInfo.socialMedia ? JSON.stringify(artistInfo.socialMedia) : null;
    const data = {
      id: artistId,
      name: artistName,
      normalizedName,
      trackCount: 0,
      albumCount: 0,
      photo: artistInfo.photo || null,
      bio: artistInfo.bio || null,
      country: artistInfo.country || null,
      genre: artistInfo.genre || null,
      website: artistInfo.website || null,
      socialMedia: socialMediaJson,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    client.insert('artists', data);
    return data;
  } catch (error) {
    console.error('合并歌手信息失败:', error);
    throw error;
  }
}

// 合并专辑信息
async function mergeAlbumInfo(albumTitle, primaryArtist, artistNames, year, coverImage) {
  try {
    const normalizedTitle = normalizeAlbumTitle(albumTitle);
    
    // 首先尝试查找现有的专辑记录 - 使用更宽松的匹配条件
    let album = client.queryOne('albums', { normalizedTitle, artist: primaryArtist });
    // 如果没有找到，尝试只按标准化标题查找
    if (!album) {
      album = client.queryOne('albums', { normalizedTitle });
    }
    if (album) {
      album = merge(album, {
        title: albumTitle,
        artist: primaryArtist,
        artists: serializeArray(artistNames),
        year: year || album.year,
        coverImage: coverImage || album.coverImage,
        updated_at: new Date().toISOString()
      }); 
      client.update('albums', album, { id: album.id });
      return album;
    }
    const albumId = generateMD5(albumTitle);
    const data = {
      id: albumId,
      title: albumTitle,
      normalizedTitle,
      artist: primaryArtist,
      artists: serializeArray(artistNames),
      trackCount: 0,
      year,
      coverImage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    client.insert('albums', data);
    return data;
  } catch (error) {
    console.error('合并专辑信息失败:', error);
    throw error;
  }
}

export default {
  // 配置相关
  getConfig, // 获取配置
  saveConfig, // 保存配置
  
  // 统计相关
  getMusicStats, // 获取音乐统计信息
  
  // 音乐相关
  findTrackByPath, // 根据路径查找音乐
  upsertTrackByPath, // 更新或插入音乐
  removeTrackById, // 根据ID删除音乐
  removeTracksByLibraryPathPrefix, // 根据路径前缀删除音乐
  deleteAllTracks, // 删除所有音乐
  getAllTracks, // 获取所有音乐
  findTrackById, // 根据ID查找音乐
  updateTrack, // 更新音乐
  getFavoriteTracks, // 获取收藏的音乐
  getRecentlyPlayedTracks, // 获取最近播放的音乐
  
  // 媒体库相关
  getMediaLibraryStats, // 获取媒体库统计信息
  removeMediaLibraryStats, // 删除媒体库统计信息
  updateMediaLibraryStats, // 更新媒体库统计信息
  
  // 索引相关
  rebuildIndexes, // 重建索引
  
  // 艺术家相关
  getArtists, // 获取艺术家列表
  findArtistByName, // 根据歌手名称查找歌手
  findArtistById, // 根据歌手ID查找歌手
  getTracksByArtist, // 获取歌手的音乐列表
  updateArtistInfo, // 更新艺术家信息
  getArtistDetails, // 获取艺术家详细信息
  updateArtistsWithoutPhoto, // 为没有图片的歌手获取图片
  
  // 专辑相关
  getAlbums, // 获取专辑列表
  findAlbumByTitleAndArtist, // 根据专辑标题和歌手查找专辑
  findAlbumById, // 根据专辑ID查找专辑
  getTracksByAlbum, // 获取专辑的音乐列表
  mergeAndDeduplicateAlbums, // 合并和去重专辑
  updateAlbumsWithoutCover, // 为没有封面的专辑获取封面
  
  // 扫描后处理
  postScanProcessing // 扫描音乐库后的完整处理流程
};