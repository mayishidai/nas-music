import sqlite from './sqlite.js';

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
  photo TEXT, -- 艺术家头像URL
  detail TEXT, -- 艺术家简介/详情
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

const createOnlineMusicTable = `
CREATE TABLE IF NOT EXISTS online_music (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  musicId TEXT NOT NULL,
  score INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artistAliases TEXT, -- JSON 数组字符串
  albumId TEXT NOT NULL,
  album TEXT NOT NULL,
  albumArtist TEXT NOT NULL,
  date TEXT,
  cover TEXT,
  lyrics TEXT,
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
'CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)',
'CREATE INDEX IF NOT EXISTS idx_artists_normalizedName ON artists(normalizedName)',
'CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title)',
'CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist)',
'CREATE INDEX IF NOT EXISTS idx_albums_normalizedTitle ON albums(normalizedTitle)',
'CREATE INDEX IF NOT EXISTS idx_albums_artist_title ON albums(artist, normalizedTitle)',
'CREATE INDEX IF NOT EXISTS idx_online_music_musicId ON online_music(musicId)',
'CREATE INDEX IF NOT EXISTS idx_online_music_albumId ON online_music(albumId)',
'CREATE INDEX IF NOT EXISTS idx_online_music_score ON online_music(score)',
'CREATE INDEX IF NOT EXISTS idx_online_music_title ON online_music(title)',
'CREATE INDEX IF NOT EXISTS idx_online_music_artist ON online_music(artist)',
'CREATE INDEX IF NOT EXISTS idx_online_music_album ON online_music(album)',
'CREATE INDEX IF NOT EXISTS idx_online_music_query ON online_music(query)',
];

// 初始化表
sqlite.db.transaction((client)=>{
  client.db.execute(createMusicTable);
  client.db.execute(createConfigTable);
  client.db.execute(createArtistsTable);
  client.db.execute(createAlbumsTable);
  client.db.execute(createOnlineMusicTable);
  createIndexes.forEach((indexSQL, i) => {
    client.db.execute(indexSQL);
  });
  console.log('数据库表初始化完成');
});