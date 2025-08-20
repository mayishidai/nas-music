# 音乐服务器

一个基于 Node.js 的音乐服务器，支持本地音乐管理和在线音乐搜索。

## 功能特性

### 本地音乐管理
- 支持多种音频格式 (MP3, WAV, FLAC, M4A, OGG, AAC, WMA)
- 自动扫描媒体库
- 音乐标签编辑
- 收藏功能
- 播放历史记录

### 在线音乐搜索
- 基于 MusicBrainz API 的在线音乐搜索
- 自动缓存搜索结果到本地数据库
- 支持按歌曲名和艺术家名搜索
- 搜索结果包含专辑封面、发行日期等信息

### 在线音乐缓存功能

#### 功能概述
系统会自动将在线搜索的音乐结果缓存到 `online_music` 表中，提高搜索响应速度并减少对外部API的请求。

#### 缓存机制
- **主键生成**: 使用 `musicId + albumId` 的 MD5 哈希值作为主键
- **自动更新**: 如果搜索结果已存在，会自动更新现有记录
- **智能缓存**: 优先返回缓存数据，缓存未命中时才请求在线API

#### 数据库表结构
```sql
CREATE TABLE online_music (
  id TEXT PRIMARY KEY,           -- musicId + albumId 的 MD5 哈希
  musicId TEXT NOT NULL,         -- MusicBrainz 音乐 ID
  score INTEGER NOT NULL,        -- 搜索匹配度
  title TEXT NOT NULL,           -- 歌曲标题
  artist TEXT NOT NULL,          -- 艺术家
  artistAliases TEXT,            -- 艺术家别名 (JSON 数组)
  album TEXT NOT NULL,           -- 专辑名称
  albumArtist TEXT NOT NULL,     -- 专辑艺术家
  date TEXT NOT NULL,            -- 发行日期
  coverImage TEXT,               -- 专辑封面 URL
  lyrics TEXT,                   -- 歌词内容
  created_at TEXT,               -- 创建时间
  updated_at TEXT                -- 更新时间
)
```

#### API 端点

##### 在线音乐搜索
```
GET /api/online/search/music?title={title}&artist={artist}&useCache={true|false}
```
- `useCache`: 是否使用缓存 (默认 true)
- 返回数据包含 `source` 字段，标识数据来源 ('cache' 或 'online')

##### 获取缓存的在线音乐数据
```
GET /api/online/music/cached?title={title}&artist={artist}&page={page}&pageSize={pageSize}
```

##### 清除缓存数据
```
DELETE /api/online/music/cached?id={id}  # 删除指定记录
DELETE /api/online/music/cached          # 删除所有记录
```

#### 管理界面
在设置页面的"缓存音乐"标签页中可以：
- 查看所有缓存的在线音乐数据
- 删除单条缓存记录
- 清除所有缓存数据
- 分页浏览缓存数据

#### 前端显示
在音乐详情页面的在线搜索结果中会显示数据来源：
- 📦 缓存数据: 表示结果来自本地缓存
- 🌐 在线数据: 表示结果来自在线API

## 安装和运行

1. 安装依赖
```bash
npm install
```

2. 启动服务器
```bash
npm start
```

3. 访问应用
打开浏览器访问 `http://localhost:3000`

## 配置

### 媒体库配置
在设置页面添加媒体库路径，系统会自动扫描并导入音乐文件。

### API 配置
- MusicBrainz API: 用于在线音乐搜索
- 歌词插件: 支持多个歌词搜索源

## 技术栈

- **后端**: Node.js, Koa, SQLite
- **前端**: React, React Router
- **数据库**: SQLite
- **在线API**: MusicBrainz, Cover Art Archive

## 许可证

MIT License