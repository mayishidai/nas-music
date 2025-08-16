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
  const tracksCount = client.count('music', { type: 'track' });
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
export const upsertTrackByPath = (trackDoc) => {
  trackDoc.id = client.util.md5(trackDoc.path);
  const existing = client.queryOne('music', { path: trackDoc.path });
  // 格式化歌手名称
  const artistNames = client.util.formatArtistNames(trackDoc.artist);
  const albumTitle = trackDoc.album || '';
  // 处理歌手数据
  for (const artistName of artistNames) {
    const normalizedName = client.util.normalize(artistName);
    mergeArtistInfo(artistName, normalizedName, trackDoc.artistInfo);
  }
  // 处理专辑数据
  if (albumTitle && artistNames.length > 0) {
    const primaryArtist = artistNames[0]; // 使用第一个歌手作为专辑的主要歌手
    mergeAlbumInfo(albumTitle, primaryArtist, artistNames, trackDoc.year, trackDoc.coverImage);
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
}

// 获取所有音乐（支持搜索、排序、分页）
export const getAllTracks = (options = {}) => {
  const { search = '', sort = 'title', order = 'asc', page = 1, pageSize = 10, filter = {} } = options;
  const conditions = { type: 'track', ...filter };
  if (search) {
    conditions.search = { 
      operator: 'SQL', 
      condition: `title LIKE @search OR artist LIKE @search OR album LIKE @search OR filename LIKE @search`, 
      params: { search: `%${search}%` }
    };
  }
  const sortField = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'favorite', 'size'].includes(sort) ? sort : 'title';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  const result = client.page('music', page, pageSize, `${sortField} ${sortOrder}`, conditions);
  result.data = result.data.map(track => ({
    ...track,
    artists: client.util.deserialize(track.artists)
  }));
  return result;
}

// 获取所有音乐（支持搜索、排序、分页）
export const getRandomTracks = (options = {}) => {
  const { search = '', sort = 'title', order = 'asc', page = 1, pageSize = 10, filter = {} } = options;
  const conditions = { type: 'track', ...filter };
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

// 获取媒体库统计信息
export const getMediaLibraryStats = (libraryId) => {
  const stats = client.queryOne('config', { id: `media_library_${libraryId}` });
  return stats ? JSON.parse(stats.data) : null;
}

// 更新媒体库统计信息
export const updateMediaLibraryStats = (libraryId, tracks) => {
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
  const conditions = { type: 'track', favorite: 1 };
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
  const conditions = {
    type: 'track',
    lastPlayed: { operator: 'IS NOT', data: null }
  };
  if (search) {
    conditions.search = { operator: 'SQL', condition: `title LIKE @search OR artist LIKE @search`, params: { search: `%${search}%` }};
  }
  const sortField = ['title', 'artist', 'album', 'genre', 'year', 'duration', 'bitrate', 'playCount', 'lastPlayed'].includes(sort) ? sort : 'title';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  return client.page('music', page, pageSize, `${sortField} ${sortOrder}`, conditions);
}

// 获取专辑列表（支持搜索、排序、分页）
export const getAlbums = (options = {}) => {
  const { query, sort = 'title', order = 'asc', page = 1, pageSize = 10 } = options;
  const conditions = { trackCount: { operator: '>', data: 0 } };
  if (query) {
    conditions.query = { operator: 'SQL', condition: `title LIKE @query OR artist LIKE @query`, params: { query: `%${query}%` }};
  }
  const sortField = ['title', 'artist', 'year', 'trackCount'].includes(sort) ? sort : 'title';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  const result = client.page('albums', page, pageSize, `${sortField} ${sortOrder}`, conditions);
  result.data = result.data.map(album => ({
    ...album,
    artists: client.util.deserialize(album.artists)
  }));
  return result
}

// 获取艺术家列表（支持搜索、排序、分页）
export const getArtists = (options = {}) => {
  const { query: searchQuery = '', sort = 'name', order = 'asc', page = 1, pageSize = 10 } = options;
  const conditions = { trackCount: { operator: '>', data: 0 } };
  if (searchQuery) {
    conditions.name = { operator: 'LIKE', data: searchQuery };
  }
  const sortField = ['name', 'trackCount', 'albumCount'].includes(sort) ? sort : 'name';
  const sortOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';
  return client.page('artists', page, pageSize, `${sortField} ${sortOrder}`, conditions);
}

// 更新艺术家信息
export const updateArtistInfo = (artistId, artistInfo) => client.update('artists', artistInfo, { id: artistId });

// 更新专辑信息
export const updateAlbumInfo = (albumId, albumInfo) => client.update('albums', albumInfo, { id: albumId });

// 更新专辑统计信息
export const updateAlbumStats = (album) => {
  const trackCount = client.count('music', { type: 'track', album: album });
  client.update('albums', { trackCount: trackCount || 0, updated_at: new Date().toISOString() }, { title:album });
};

// 更新艺术家统计信息
export const updateArtistStats = (artist) => {
  const trackCount = client.count('music', { artists: { operator: 'LIKE', data: artist } });
  const albumCount = client.count('albums', { artists: { operator: 'LIKE', data: artist } });
  client.update('artists', { trackCount: trackCount || 0, albumCount: albumCount || 0, updated_at: new Date().toISOString() }, { name:artist });
};

// 根据音乐信息更新或创建专辑
export const upsertAlbumFromTrack = (trackData) => {
  if (!trackData.album || !trackData.artist) { return null; }
  const albumId = client.util.md5(trackData.album);
  const normalizedTitle = client.util.normalize(trackData.album);
  
  let album = client.queryOne('albums', {
    query: { 
      operator: 'SQL', 
      condition: `id = @albumId OR title = @title OR normalizedTitle = @normalizedTitle`, 
      params: { 
        albumId: albumId,
        title: trackData.album,
        normalizedTitle: normalizedTitle,
      }
    }
  });
  if (album) {
    // 更新现有专辑
    const updateData = {
      title: trackData.album,
      artist: trackData.artist,
      artists: client.util.serialize(trackData.artists),
      year: trackData.year || album.year,
      coverImage: album.coverImage || trackData.coverImage,
      updated_at: new Date().toISOString()
    };
    client.update('albums', updateData, { id: album.id });
    updateAlbumStats(trackData.album);
    return album.id;
  } else {
    // 创建新专辑
    const albumData = {
      id: albumId,
      title: trackData.album,
      normalizedTitle,
      artist: trackData.artist,
      artists: client.util.serialize(trackData.artists),
      trackCount: 0,
      year: trackData.year,
      coverImage: trackData.coverImage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    client.insert('albums', albumData);
    updateAlbumStats(trackData.album);
    return albumId;
  }
};

// 根据音乐信息更新或创建艺术家
export const upsertArtistFromTrack = (trackData) => {
  if (!trackData.artist) { return null; }
  const artistId = client.util.md5(trackData.artist);
  const normalizedName = client.util.normalize(trackData.artist);
  
  let artist = client.queryOne('artists', {
    query: {
      operator: 'SQL',
      condition: `id = @id OR normalizedName = @normalizedName OR name = @name`,
      params: {
        id: artistId,
        normalizedName: normalizedName,
        name: trackData.artist
      }
    }
  });
  
  if (artist) {
    const updateData = {
      name: trackData.artist,
      normalizedName: normalizedName,
      photo: artist.photo ||trackData.coverImage, // 使用音乐封面作为艺术家照片
      updated_at: new Date().toISOString()
    };
    client.update('artists', updateData, { id: artist.id });
    updateArtistStats(trackData.artist);
    return artist.id;
  } else {
         // 创建新艺术家
     const artistData = {
       id: artistId,
       name: trackData.artist,
       normalizedName,
       trackCount: 0,
       albumCount: 0,
       photo: trackData.coverImage || null, // 使用音乐封面作为艺术家照片
       detail: null,
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
     };
    client.insert('artists', artistData);
    updateArtistStats(trackData.artist);
    return artistId;
  }
};
// 获取艺术家详细信息
export const getArtistDetails = (artistId) => client.queryOne('artists', { id: artistId });
// 根据歌手名称查找歌手
export const findArtistByName = (artistName) => client.queryOne('artists', { normalizedName: client.util.normalize(artistName) });
// 根据歌手ID查找歌手
export const findArtistById = (artistId) => client.queryOne('artists', { id: artistId });
// 根据专辑标题和歌手查找专辑
export const findAlbumByTitleAndArtist = (albumTitle, artistName) => {
  const normalizedTitle = client.util.normalize(albumTitle);
  const album = client.queryOne('albums', { normalizedTitle, artist: artistName });
  if (album) {
    album.artists = client.util.deserialize(album.artists);
  }
  return album;
}

// 根据专辑ID查找专辑
export const findAlbumById = (albumId) => {
  const album = client.queryOne('albums', { id: albumId });
  if (album) {
    album.artists = client.util.deserialize(album.artists);
  }
  return album;
}

// 获取专辑的音乐列表
export const getTracksByAlbum = (album) => {
  const tracks = client.queryAll('music', { type: 'track', album: album });
  return tracks.map(track => {
    track.artists = client.util.deserialize(track.artists);
    return track;
  });
}

// 扫描音乐库后的完整处理流程
export const postScanProcessing = () => {
  try {
    console.log('开始扫描后处理...');
    // 1. 合并和去重专辑
    mergeAndDeduplicateAlbums();
    // 2. 为没有封面的专辑获取封面
    updateAlbumsWithoutCover();
    // 3. 为没有图片的歌手获取图片
    updateArtistsWithoutPhoto();
  } catch (error) {
    console.error('扫描后处理失败:', error);
    throw error;
  }
}


// 为没有封面的专辑自动获取封面
export const updateAlbumsWithoutCover = () => {
  client.transaction((transaction)=>{
    const albums = transaction.queryAll('albums', { });
    for (const album of albums) {
      const trackCount = transaction.count('music', { type: 'track', album: album.title });
      const tracks = transaction.queryOne('music', {
        type: 'track',
        album: album.title,
        coverImage: { operator: 'IS NOT', data: null }
      });
      transaction.update('albums', {
        coverImage: tracks ? tracks.coverImage : null,
        trackCount: trackCount || 0,
        updated_at: new Date().toISOString()
      }, { id: album.id });
      console.log(`已处理专辑 "${album.title}" 歌曲数: ${trackCount}`);
    }
  })
}

// 为没有图片的歌手自动获取图片
export const updateArtistsWithoutPhoto = () => {
  client.transaction((transaction)=>{
    const artists = transaction.queryAll('artists', { });
    for (const artist of artists) {
      const trackCount = transaction.count('music', { type: 'track', artist: artist.name });
      const albumCount = transaction.count('albums', { artist: artist.name });
      const tracksWithCover = transaction.queryOne('music', {
        type: 'track',
        artist: artist.name,
        coverImage: { operator: 'IS NOT', data: null }
      });
      transaction.update('artists', {
        photo: tracksWithCover ? tracksWithCover.coverImage : null,
        trackCount: trackCount || 0,
        albumCount: albumCount || 0,
        updated_at: new Date().toISOString()
      }, { id: artist.id });
      console.log(`已处理歌手 "${artist.name}" 歌曲数: ${trackCount}, 专辑数: ${albumCount}`);
    }
  })
}

// 高级专辑合并和去重函数
export const mergeAndDeduplicateAlbums = () => {
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
      
      // 更新音乐记录中的专辑名称引用
      client.update('music', { album: primaryAlbum.title }, { album: duplicateAlbum.title });
      
      // 删除重复记录
      client.delete('albums', { id: albumIds[i] });
      
      console.log(`已合并并删除重复专辑: ${duplicateAlbum.title}`);
    }
  }
}

// 合并歌手信息
export const mergeArtistInfo = (artistName, normalizedName, artistInfo = {}) => {
  const artistId = client.util.md5(artistName);
  artistInfo.normalizedName = normalizedName;
  let artist = client.queryOne('artists', {
    query: {
      operator: 'SQL',
      condition: `id = @id OR normalizedName = @normalizedName OR name = @name`,
      params: {
        id: client.util.md5(artistName),
        normalizedName: normalizedName,
        name: artistName
      }
    }
  });
  if (artist) {
    artist = client.util.merge(artist, artistInfo);
    artist.updated_at = new Date().toISOString();
    client.update('artists', artist, { id: artist.id });
    return artist;
  }
  // 如果没有找到，创建新记录
  const data = {
    id: artistId,
    name: artistName,
    normalizedName,
    trackCount: 0,
    albumCount: 0,
    photo: artistInfo.photo || null,
    detail: artistInfo.detail || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  client.insert('artists', data);
  return data;
}

// 合并专辑信息
export const mergeAlbumInfo = (albumTitle, primaryArtist, artistNames, year, coverImage) => {
  const albumId = client.util.md5(albumTitle);
  const normalizedTitle = client.util.normalize(albumTitle);
  let album = client.queryOne('albums', {
    query: { 
      operator: 'SQL', 
      condition: `id = @albumId OR title = @title OR normalizedTitle = @normalizedTitle `, 
      params: { 
        albumId: albumId,
        title: albumTitle,
        normalizedTitle: normalizedTitle,
      }
    }
  });
  if (album) {
    album = client.util.merge(album, {
      title: albumTitle,
      artist: primaryArtist,
      artists: client.util.serialize(artistNames),
      year: year || album.year,
      coverImage: coverImage || album.coverImage,
      updated_at: new Date().toISOString()
    }); 
    client.update('albums', album, { id: album.id });
    return album;
  }
  
  const data = {
    id: albumId,
    title: albumTitle,
    normalizedTitle,
    artist: primaryArtist,
    artists: client.util.serialize(artistNames),
    trackCount: 0,
    year,
    coverImage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  client.insert('albums', data);
  return data;
}

// 根据ID删除音乐
export const removeTrackById = (trackId) => client.delete('music', { id: trackId });
// 根据库路径前缀删除音乐
export const removeTracksByLibraryPathPrefix = (libraryPath) => client.delete('music', { type: 'track', path: libraryPath.replace(/\\/g, '/') })
// 删除所有音乐
export const deleteAllTracks = () => client.delete('music', { type: 'track' });
// 删除媒体库统计信息
export const removeMediaLibraryStats = (libraryId) => client.delete('config', { id: `media_library_${libraryId}` });

// 重建索引
export const rebuildIndexes = () => client.db.execute('ANALYZE');


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
  updateArtistInfo, // 更新艺术家信息
  updateArtistStats, // 更新艺术家统计信息
  upsertArtistFromTrack, // 根据音乐信息更新或创建艺术家
  getArtistDetails, // 获取艺术家详细信息
  updateArtistsWithoutPhoto, // 为没有图片的歌手获取图片
  // 专辑相关
  getAlbums, // 获取专辑列表
  findAlbumByTitleAndArtist, // 根据专辑标题和歌手查找专辑
  findAlbumById, // 根据专辑ID查找专辑
  getTracksByAlbum, // 获取专辑的音乐列表
  updateAlbumInfo, // 更新专辑信息
  updateAlbumStats, // 更新专辑统计信息
  upsertAlbumFromTrack, // 根据音乐信息更新或创建专辑
  mergeAndDeduplicateAlbums, // 合并和去重专辑
  updateAlbumsWithoutCover, // 为没有封面的专辑获取封面
  mergeAlbumInfo, // 合并专辑信息
  // 扫描后处理
  postScanProcessing // 扫描音乐库后的完整处理流程
};