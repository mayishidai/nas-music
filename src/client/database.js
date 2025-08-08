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