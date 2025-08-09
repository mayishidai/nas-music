import Datastore from '@seald-io/nedb';

// 初始化数据库
export const musicDB = new Datastore({ filename: './db/music.db', autoload: true });
export const configDB = new Datastore({ filename: './db/config.db', autoload: true });

// 创建索引
musicDB.ensureIndex({ fieldName: 'type' });
musicDB.ensureIndex({ fieldName: 'title' });
musicDB.ensureIndex({ fieldName: 'artist' });
musicDB.ensureIndex({ fieldName: 'album' });
musicDB.ensureIndex({ fieldName: 'genre' });
musicDB.ensureIndex({ fieldName: 'year' });
musicDB.ensureIndex({ fieldName: 'favorite' });
musicDB.ensureIndex({ fieldName: 'bitrate' });
musicDB.ensureIndex({ fieldName: 'sampleRate' });
// 新增：按文件路径建立索引，便于去重与按库路径清理
musicDB.ensureIndex({ fieldName: 'path' });

// 复合索引 - NeDB 使用数组形式
musicDB.ensureIndex({ fieldName: ['type', 'title'] });
musicDB.ensureIndex({ fieldName: ['type', 'artist'] });
musicDB.ensureIndex({ fieldName: ['type', 'album'] });
musicDB.ensureIndex({ fieldName: ['type', 'favorite'] });
musicDB.ensureIndex({ fieldName: ['type', 'favorite', 'title'] });


const defaultConfig = {
  _id: 'app_config',
  musicLibraryPaths: ['./music'],
  lastfmApiKey: '',
  musicbrainzUserAgent: 'NAS-Music-Server/1.0.0',
  enableLastfm: true,
  enableMusicbrainz: true,
  enableQQMusic: false,
  enableNeteaseMusic: false,
  qqMusicApiKey: '',
  neteaseMusicApiKey: '',
  scanInterval: 3600000, // 1小时
  supportedFormats: ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'],
  coverSize: 300,
  language: 'zh-CN'
};

// 获取配置
export async function getConfig() {
  return new Promise((resolve, reject) => {
    configDB.findOne({ _id: 'app_config' }, (err, config) => {
      if (err) {
        reject(err);
        return;
      }
      if (!config) {
        // 配置不存在，创建默认配置
        configDB.insert(defaultConfig, (err, newConfig) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(newConfig);
        });
      } else {
        resolve(config);
      }
    });
  });
}

// 保存配置
export async function saveConfig(config) {
  return new Promise((resolve, reject) => {
    config._id = 'app_config';
    configDB.update({ _id: 'app_config' }, config, { upsert: true }, (err, numReplaced) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ numReplaced });
    });
  });
}

// 获取音乐数据库统计
export async function getMusicStats() {
  return new Promise((resolve) => {
    Promise.all([
      new Promise((res) => musicDB.count({ type: 'track' }, (err, count) => res(err ? 0 : count))),
      new Promise((res) => musicDB.count({ type: 'album' }, (err, count) => res(err ? 0 : count))),
      new Promise((res) => musicDB.count({ type: 'artist' }, (err, count) => res(err ? 0 : count))),
      new Promise((res) => musicDB.count({ type: 'genre' }, (err, count) => res(err ? 0 : count)))
    ]).then(([tracks, albums, artists, genres]) => {
      resolve({
        tracks,
        albums,
        artists,
        genres
      });
    }).catch(() => {
      resolve({
        tracks: 0,
        albums: 0,
        artists: 0,
        genres: 0
      });
    });
  });
}

// 初始化数据库
export async function initDatabase() {
  try {
    // 确保配置存在
    await getConfig();
    console.log('PouchDB数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// ========== 数据库操作工具函数 ==========

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 按路径查找单曲
export async function findTrackByPath(normalizedPath) {
  return new Promise((resolve) => {
    musicDB.findOne({ type: 'track', path: normalizedPath }, (err, doc) => resolve(err ? null : doc));
  });
}

// 按路径插入或更新单曲（去重）
export async function upsertTrackByPath(trackDoc) {
  const existing = await findTrackByPath(trackDoc.path);
  if (existing) {
    await new Promise((resolve, reject) => {
      musicDB.update({ _id: existing._id }, { $set: { ...trackDoc } }, {}, (err) => (err ? reject(err) : resolve()));
    });
    return { ...existing, ...trackDoc, _id: existing._id };
  }
  return new Promise((resolve, reject) => {
    musicDB.insert({ _id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, ...trackDoc }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

// 删除指定ID的曲目
export async function removeTrackById(id) {
  return new Promise((resolve, reject) => {
    musicDB.remove({ _id: id }, (err, numRemoved) => (err ? reject(err) : resolve(numRemoved)));
  });
}

// 根据媒体库规范化路径前缀删除曲目
export async function removeTracksByLibraryPathPrefix(normalizedLibraryPath) {
  const prefix = '^' + escapeRegExp(normalizedLibraryPath);
  const tracks = await new Promise((resolve) => {
    musicDB.find({ type: 'track', path: { $regex: prefix } }, (err, docs) => resolve(err ? [] : docs));
  });
  for (const t of tracks) {
    await removeTrackById(t._id);
  }
  return tracks.length;
}

// 删除所有曲目
export async function deleteAllTracks() {
  const tracks = await new Promise((resolve) => {
    musicDB.find({ type: 'track' }, (err, docs) => resolve(err ? [] : docs));
  });
  for (const t of tracks) {
    await removeTrackById(t._id);
  }
  return tracks.length;
}

// 读取所有曲目
export async function getAllTracks() {
  return new Promise((resolve) => {
    musicDB.find({ type: 'track' }, (err, docs) => resolve(err ? [] : docs));
  });
}

// 读取媒体库统计
export async function getMediaLibraryStats(libraryId) {
  return new Promise((resolve) => {
    configDB.findOne({ _id: 'media_library_' + libraryId }, (err, doc) => resolve(err ? null : (doc || null)));
  });
}

// 删除媒体库统计
export async function removeMediaLibraryStats(libraryId) {
  return new Promise((resolve, reject) => {
    configDB.remove({ _id: 'media_library_' + libraryId }, {}, (err, numRemoved) => (err ? reject(err) : resolve(numRemoved)));
  });
}

// 更新媒体库统计
export async function updateMediaLibraryStats(libraryId, processedTracks) {
  return new Promise((resolve, reject) => {
    const stats = {
      trackCount: processedTracks.length,
      albumCount: new Set(processedTracks.map(t => t.album)).size,
      artistCount: new Set(processedTracks.map(t => t.artist)).size,
      lastScanned: new Date().toISOString()
    };
    configDB.update(
      { _id: 'media_library_' + libraryId },
      { $set: stats },
      { upsert: true },
      (err) => (err ? reject(err) : resolve(stats))
    );
  });
}

// 重建专辑/艺术家/流派索引
export async function rebuildIndexes() {
  try {
    const tracks = await getAllTracks();

    const albumsMap = new Map();
    const artistsMap = new Map();
    const genresMap = new Map();

    tracks.forEach(track => {
      // 专辑
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

      // 艺术家
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

      // 流派
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
          const g = genresMap.get(genre);
          g.tracks.push(track._id);
          g.trackCount++;
        });
      }
    });

    // 艺术家专辑数
    artistsMap.forEach(artist => {
      artist.albumCount = artist.albums.size;
      artist.albums = Array.from(artist.albums);
    });

    // 删除旧索引
    const [oldAlbums, oldArtists, oldGenres] = await Promise.all([
      new Promise((resolve) => musicDB.find({ type: 'album' }, (err, docs) => resolve(err ? [] : docs))),
      new Promise((resolve) => musicDB.find({ type: 'artist' }, (err, docs) => resolve(err ? [] : docs))),
      new Promise((resolve) => musicDB.find({ type: 'genre' }, (err, docs) => resolve(err ? [] : docs)))
    ]);

    const allOldDocs = [...oldAlbums, ...oldArtists, ...oldGenres];
    for (const doc of allOldDocs) {
      await new Promise((resolve, reject) => {
        musicDB.remove({ _id: doc._id }, (err) => (err ? reject(err) : resolve()));
      });
    }

    // 写入新索引
    const allIndexes = [
      ...Array.from(albumsMap.values()),
      ...Array.from(artistsMap.values()),
      ...Array.from(genresMap.values())
    ];

    for (const index of allIndexes) {
      await new Promise((resolve, reject) => {
        musicDB.findOne({ _id: index._id }, (err, existingDoc) => {
          if (err) return reject(err);
          if (existingDoc) {
            musicDB.update({ _id: index._id }, index, {}, (err2) => (err2 ? reject(err2) : resolve()));
          } else {
            musicDB.insert(index, (err3) => (err3 ? reject(err3) : resolve()));
          }
        });
      });
    }

    console.log(`索引重建完成: ${albumsMap.size}个专辑, ${artistsMap.size}个艺术家, ${genresMap.size}个流派`);
    return true;
  } catch (error) {
    console.error('重建索引失败:', error);
    return false;
  }
}