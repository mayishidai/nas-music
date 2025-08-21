import client from './sqlite.js'
import './initDatabase.js'

export const defaultConfig = {
  id: 'app_config',
  musicLibraryPaths: ['./music'],
  musicbrainzUserAgent: 'NAS-Music-Server/1.0.0',
  enableMusicbrainz: true,
  scanInterval: 3600000, // 1小时
  supportedFormats: ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'],
  coverSize: 300,
  language: 'zh-CN',
  scrapingEnabled: false, // 刮削功能开关
  scrapingUpdatedAt: null, // 刮削配置更新时间
};

// 获取配置
export const getConfig = () => {
  const config = client.queryOne('config', { id: 'app_config' });
  if (!config) {
    const newConfig = { ...defaultConfig };
    client.insert('config', {
      id: 'app_config',
      data: JSON.stringify(newConfig)
    });
    return newConfig;
  }
  return JSON.parse(config.data);
}

// 保存配置
export const saveConfig = (config) => {
  const existing = client.queryOne('config', { id: 'app_config' });
  if (existing) {
    client.update('config', { data: JSON.stringify(config) }, { id: 'app_config' });
  } else {
    client.insert('config', { id: 'app_config', data: JSON.stringify(config) });
  }
}

// 获取音乐统计信息
export const getMusicStats = () => {
  const tracksCount = client.count('music', { });
  const albumsCount = client.count('albums', {});
  const artistsCount = client.count('artists', {});
  const stats = {
    tracks: tracksCount || 0,
    albums: albumsCount || 0,
    artists: artistsCount || 0,
  };
  return stats;
}

// 根据路径查找音乐
export const findTrackByPath = (trackPath) => {
  const track = client.queryOne('music', { path: trackPath });
  if (track) {
    track.artists = client.util.deserialize(track.artists);
  }
  return track;
}

// 根据路径更新或插入音乐
export const upsertTrack = (trackDoc) => {
  trackDoc.id = client.util.md5(trackDoc.path);
  // 格式化歌手名称
  const artistNames = client.util.formatArtistNames(trackDoc.artist);
  const albumTitle = trackDoc.album || '';
  // 处理歌手数据
  for (const artistName of artistNames) {
    upsertArtistInfo(artistName, trackDoc.coverImage, '');
  }
  // 处理专辑数据
  if (albumTitle && artistNames.length > 0) {
    upsertAlbumInfo(albumTitle, artistNames, trackDoc.year, trackDoc.coverImage);
  }
  // 更新或插入音乐记录
  const now = new Date().toISOString();
  const musicData = {
    id: trackDoc.id,
    libraryId: trackDoc.libraryId,
    path: trackDoc.path,
    title: trackDoc.title,
    artist: trackDoc.artist,
    album: trackDoc.album,
    albumArtist: trackDoc.albumArtist,
    genre: trackDoc.genre,
    year: trackDoc.year,
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
    artists: client.util.serialize(artistNames),
    updated_at: now,
    created_at: now
  };
  return client.insertOrUpdate('music', musicData, { id: trackDoc.id });
}


export const upsertArtistInfo = (name, photo, detail='') => {
  const id = client.util.md5(name);
  const normalizedName = client.util.normalize(name);
  client.insertOrUpdate('artists', {
    id,
    name,
    normalizedName,
    trackCount: 1,
    albumCount: 1,
    photo: photo || null,
    detail: detail || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

// 合并专辑信息
export const upsertAlbumInfo = (albumTitle, artistNames, year, coverImage) => {
  const albumId = client.util.md5(albumTitle);
  const normalizedTitle = client.util.normalize(albumTitle);
  client.insertOrUpdate('albums', { 
    id: albumId,
    title: albumTitle,
    normalizedTitle,
    artist: artistNames.join(','),
    artists: client.util.serialize(artistNames),
    trackCount: 0,
    year,
    coverImage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString() 
  });
}

// 获取所有音乐（支持搜索、排序、分页）
export const getAllTracks = (options = {}) => {
  const { search = '', sort = 'title', order = 'asc', page = 1, pageSize = 10, filter = {} } = options;
  const conditions = filter;
  if (search) {
    conditions.search = { 
      operator: 'SQL', 
      condition: `title LIKE @search OR artist LIKE @search OR album LIKE @search OR filename LIKE @search`, 
      params: { search: `%${search}%` }
    };
  }
  const sortField = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'favorite', 'size'].includes(sort) ? sort : 'title';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  const result = client.page('music', page, pageSize, `${sortField} ${sortOrder}, lastPlayed DESC, playCount DESC, updated_at DESC`, conditions);
  result.data = result.data.map(track => ({
    ...track,
    artists: client.util.deserialize(track.artists)
  }));
  return result;
}

// 获取所有音乐（支持搜索、排序、分页）
export const getRandomTracks = (options = {}) => {
  const { search = '', page = 1, pageSize = 10, filter = {} } = options;
  const conditions = filter;
  if (search) {
    conditions.search = { 
      operator: 'SQL', 
      condition: `title LIKE @search OR artist LIKE @search OR album LIKE @search OR filename LIKE @search`, 
      params: { search: `%${search}%` }
    };
  }
  const result = client.randomPage('music', page, pageSize, conditions);
  result.data = result.data.map(track => ({
    ...track,
    artists: client.util.deserialize(track.artists)
  }));
  return result;
}

// 根据ID查找音乐
export const findTrackById = (trackId) => {
  const track = client.queryOne('music', { id: trackId });
  if (track) {
    track.artists = client.util.deserialize(track.artists);
  }
  return track;
}

// 更新音乐
export const updateTrack = (trackId, updates) => {
  const track = client.queryOne('music', { id: trackId });
  if (!track) { return false; }
  // 处理特殊字段（数组字段需要序列化）
  const processedUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'artists') {
      processedUpdates[key] = client.util.serialize(value);
    } else {
      processedUpdates[key] = value;
    }
  }
  return client.update('music', processedUpdates, { id: trackId });
}

// 获取收藏的音乐（支持排序、分页）
export const getFavoriteTracks = (options = {}) => {
  const { sort = 'title', order = 'asc', page = 1, pageSize = 10, search = '' } = options;
  const conditions = { favorite: 1 };
  if (search) {
    conditions.search = { 
      operator: 'SQL', 
      condition: `title LIKE @search OR artist LIKE @search OR album LIKE @search OR filename LIKE @search`, 
      params: { search: `%${search}%` }
    };
  }
  const sortField = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed'].includes(sort) ? sort : 'title';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  return client.page('music', page, pageSize, `${sortField} ${sortOrder}`, conditions);
}

// 获取最近播放的音乐（支持分页）
export const getRecentlyPlayedTracks = (options = {}) => {
  const { search, sort = 'title', order = 'asc', page = 1, pageSize = 10 } = options;
  const conditions = { lastPlayed: { operator: 'IS NOT', data: null } };
  if (search) {
    conditions.search = { operator: 'SQL', condition: `title LIKE @search OR artist LIKE @search`, params: { search: `%${search}%` }};
  }
  const sortField = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed'].includes(sort) ? sort : 'title';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  return client.page('music', page, pageSize, `${sortField} ${sortOrder}`, conditions);
}

// 获取专辑列表（支持搜索、排序、分页）
export const albumsPage = (options = {}) => {
  const { query, sort = 'title', order = 'asc', page = 1, pageSize = 10 } = options;
  const conditions = { trackCount: { operator: '>', data: 0 } };
  if (query) {
    conditions.query = { operator: 'SQL', condition: `title LIKE @query OR artist LIKE @query`, params: { query: `%${query}%` }};
  }
  const result = client.page('albums', page, pageSize, `trackCount DESC, year DESC, updated_at DESC, title ASC`, conditions);
  result.data = result.data.map(album => ({
    ...album,
    artists: client.util.deserialize(album.artists)
  }));
  return result
}

// 获取艺术家列表（支持搜索、排序、分页）
export const artistsPage = (options = {}) => {
  const { query: searchQuery = '', page = 1, pageSize = 10 } = options;
  const conditions = { trackCount: { operator: '>', data: 0 } };
  if (searchQuery) {
    conditions.name = { operator: 'LIKE', data: searchQuery };
  }
  return client.page('artists', page, pageSize, `albumCount DESC, trackCount DESC, updated_at DESC, name ASC`, conditions);
}

// 更新艺术家信息
export const updateArtistInfo = (artistId, artistInfo) => client.update('artists', artistInfo, { id: artistId });

// 更新专辑信息
export const updateAlbumInfo = (albumId, albumInfo) => client.update('albums', albumInfo, { id: albumId });

// 更新专辑统计信息
export const updateAlbumStats = (album) => {
  const trackCount = client.count('music', { album: album });
  client.update('albums', { trackCount: trackCount || 0, updated_at: new Date().toISOString() }, { title:album });
};

// 更新艺术家统计信息
export const updateArtistStats = (artist) => {
  const trackCount = client.count('music', { artists: { operator: 'LIKE', data: artist } });
  const albumCount = client.count('albums', { artists: { operator: 'LIKE', data: artist } });
  client.update('artists', { trackCount: trackCount || 0, albumCount: albumCount || 0, updated_at: new Date().toISOString() }, { name:artist });
};

// 根据歌手ID/名称查找歌手
export const findArtist = (artist) => {
  return client.queryOne('artists', {
    query: {
      operator: 'SQL',
      condition: `id = @id OR name like @id OR normalizedName like @id`,
      params: { id: client.util.normalize(artist) }
    }
  });
}

// 根据专辑ID/标题查找专辑
export const findAlbum = (album) => {
  const data = client.queryOne('albums', { 
    query: {
      operator: 'SQL',
      condition: `id = @id OR title like @id OR normalizedTitle like @id`,
      params: { id: client.util.normalize(album) }
    }
  });
  if (data) {
    data.artists = client.util.deserialize(data.artists);
  }
  return data;
}

// 获取专辑的音乐列表
export const getTracksByAlbum = (album) => {
  const tracks = client.queryAll('music', { album: album });
  return tracks.map(track => {
    track.artists = client.util.deserialize(track.artists);
    return track;
  });
}

// 扫描音乐库后的完整处理流程
export const postScanProcessing = () => {
  // 1. 合并和去重专辑
  mergeAndDeduplicateAlbums();
  // 2. 为没有封面的专辑获取封面
  updateAlbumsWithoutCover();
  // 3. 为没有图片的歌手获取图片
  updateArtistsWithoutPhoto();
}


// 为没有封面的专辑自动获取封面
export const updateAlbumsWithoutCover = () => {
  client.transaction((transaction)=>{
    const albums = transaction.queryAll('albums', { });
    for (const album of albums) {
      const trackCount = transaction.count('music', { album: album.title });
      const tracks = transaction.queryOne('music', { album: album.title, coverImage: { operator: 'IS NOT', data: null } });
      transaction.update('albums', {
        coverImage: tracks ? tracks.coverImage : null,
        trackCount: trackCount || 0,
        updated_at: new Date().toISOString()
      }, { id: album.id });
    }
  })
}

// 为没有图片的歌手自动获取图片
export const updateArtistsWithoutPhoto = () => {
  client.transaction((transaction)=>{
    const artists = transaction.queryAll('artists', { });
    for (const artist of artists) {
      const trackCount = transaction.count('music', { artist: artist.name });
      const albumCount = transaction.count('albums', { artist: artist.name });
      const tracksWithCover = transaction.queryOne('music', { artist: artist.name, coverImage: { operator: 'IS NOT', data: null } });
      transaction.update('artists', {
        photo: tracksWithCover ? tracksWithCover.coverImage : null,
        trackCount: trackCount || 0,
        albumCount: albumCount || 0,
        updated_at: new Date().toISOString()
      }, { id: artist.id });
    }
  })
}

// 高级专辑合并和去重函数
export const mergeAndDeduplicateAlbums = () => {
  // 查找所有重复的专辑（基于标准化标题）
  const duplicateAlbums = client.db.queryAll(`
    SELECT normalizedTitle, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(title) as titles
    FROM albums 
    GROUP BY normalizedTitle 
    HAVING COUNT(*) > 1
  `);
  for (const duplicate of duplicateAlbums) {
    const albumIds = duplicate.ids.split(',');
    const titles = duplicate.titles.split(',');
    
    // 选择第一个专辑作为主记录
    const primaryAlbumId = albumIds[0];
    const primaryAlbum = client.queryOne('albums', { id: primaryAlbumId });
    if (!primaryAlbum) continue;
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
      const primaryArtists = client.util.deserialize(primaryAlbum.artists);
      const duplicateArtists = client.util.deserialize(duplicateAlbum.artists);
      const mergedArtists = [...new Set([...primaryArtists, ...duplicateArtists])];
      
      // 更新主记录
      client.update('albums', {
        title: mergedTitle,
        artist: mergedArtist,
        artists: client.util.serialize(mergedArtists),
        year: mergedYear,
        coverImage: mergedCoverImage,
        updated_at: new Date().toISOString()
      }, { id: primaryAlbumId });
      client.update('music', { album: primaryAlbum.title }, { album: duplicateAlbum.title });
      client.delete('albums', { id: albumIds[i] });
      console.log(`已合并并删除重复专辑: ${duplicateAlbum.title}`);
    }
  }
}

// 根据ID删除音乐
export const removeTrackById = (trackId) => client.delete('music', { id: trackId });
// 根据库ID删除音乐
export const removeTracksByLibraryId = (libraryId) => client.delete('music', { libraryId })
// 删除所有音乐
export const deleteAllTracks = () => client.delete('music', {});


export default {
  // 配置相关
  getConfig, // 获取配置
  saveConfig, // 保存配置
  // 统计相关
  getMusicStats, // 获取音乐统计信息
  // 音乐相关
  findTrackByPath, // 根据路径查找音乐
  upsertTrack, // 更新或插入音乐
  removeTrackById, // 根据ID删除音乐
  deleteAllTracks, // 删除所有音乐
  removeTracksByLibraryId, // 根据库ID删除音乐
  getAllTracks, // 获取所有音乐
  findTrackById, // 根据ID查找音乐
  updateTrack, // 更新音乐
  getFavoriteTracks, // 获取收藏的音乐
  getRecentlyPlayedTracks, // 获取最近播放的音乐
  // 艺术家相关
  artistsPage, // 获取艺术家列表
  findArtist, // 根据歌手ID查找歌手
  updateArtistInfo, // 更新艺术家信息
  updateArtistStats, // 更新艺术家统计信息
  updateArtistsWithoutPhoto, // 为没有图片的歌手获取图片
  // 专辑相关
  albumsPage, // 获取专辑列表
  findAlbum, // 根据专辑ID查找专辑
  getTracksByAlbum, // 获取专辑的音乐列表
  updateAlbumInfo, // 更新专辑信息
  updateAlbumStats, // 更新专辑统计信息
  upsertAlbumInfo, // 更新或插入专辑
  upsertArtistInfo, // 更新或插入艺术家
  //=================
  mergeAndDeduplicateAlbums, // 合并和去重专辑
  updateAlbumsWithoutCover, // 为没有封面的专辑获取封面
  // 扫描后处理
  postScanProcessing // 扫描音乐库后的完整处理流程
};