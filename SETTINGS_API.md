# 设置API接口文档

## 概述

设置API提供了媒体库管理和API配置的完整功能，支持音乐文件的扫描、元数据获取和外部API集成。媒体库管理和索引管理功能已合并到 `client/music.js` 中。

## 基础信息

- **基础路径**: `/api/settings`
- **数据格式**: JSON
- **认证方式**: 无（可根据需要添加）

## API配置接口

### 获取API配置

获取所有API服务的配置信息。

```http
GET /api/settings/api-configs
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "musicbrainz": {
      "apiKey": "your-api-key",
      "baseUrl": "https://musicbrainz.org/ws/2/",
      "userAgent": "NAS-Music-Server/1.0.0"
    },
    "lastfm": {
      "apiKey": "your-api-key",
      "baseUrl": "https://ws.audioscrobbler.com/2.0/",
      "enabled": true
    },
    "acoustid": {
      "apiKey": "your-api-key",
      "baseUrl": "https://api.acoustid.org/v2/",
      "enabled": false
    },
    "tencent": {
      "apiKey": "your-api-key",
      "baseUrl": "https://c.y.qq.com/",
      "enabled": false
    },
    "netease": {
      "apiKey": "your-api-key",
      "baseUrl": "https://music.163.com/",
      "enabled": false
    }
  }
}
```

### 更新API配置

更新API服务的配置信息。

```http
PUT /api/settings/api-configs
Content-Type: application/json
```

**请求体**:
```json
{
  "musicbrainz": {
    "apiKey": "new-api-key",
    "userAgent": "Custom-Agent/1.0.0"
  },
  "lastfm": {
    "apiKey": "new-api-key",
    "enabled": true
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "API配置保存成功"
}
```

### 测试API配置

测试指定API服务的配置是否有效。

```http
POST /api/settings/test-api/:service
```

**路径参数**:
- `service`: API服务名称 (`musicbrainz`, `lastfm`, `acoustid`, `tencent`, `netease`)

**响应示例**:
```json
{
  "success": true,
  "message": "API配置测试成功",
  "data": {
    "status": 200,
    "statusText": "OK"
  }
}
```

## 媒体库管理接口

### 获取媒体库列表

获取所有已配置的媒体库信息。

```http
GET /api/settings/media-libraries
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "L211c2lj",
      "path": "/music",
      "trackCount": 1250,
      "albumCount": 89,
      "artistCount": 156,
      "createdAt": "2023-12-21T10:30:45.123Z",
      "lastScanned": "2023-12-21T15:20:30.456Z"
    }
  ]
}
```

### 添加媒体库

添加新的媒体库路径。

```http
POST /api/settings/media-libraries
Content-Type: application/json
```

**请求体**:
```json
{
  "path": "/new/music/path"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "L25ldy9tdXNpYy9wYXRo",
    "path": "/new/music/path",
    "trackCount": 0,
    "albumCount": 0,
    "artistCount": 0,
    "createdAt": "2023-12-21T10:30:45.123Z"
  },
  "message": "媒体库添加成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "媒体库路径不存在或无法访问"
}
```

### 删除媒体库

删除指定的媒体库。

```http
DELETE /api/settings/media-libraries/:id
```

**路径参数**:
- `id`: 媒体库ID

**响应示例**:
```json
{
  "success": true,
  "message": "媒体库删除成功"
}
```

### 扫描媒体库

开始扫描指定媒体库中的音乐文件。

```http
POST /api/settings/media-libraries/:id/scan
```

**路径参数**:
- `id`: 媒体库ID

**响应示例**:
```json
{
  "success": true,
  "message": "扫描已开始"
}
```

### 获取扫描进度

获取指定媒体库的扫描进度。

```http
GET /api/settings/media-libraries/:id/scan-progress
```

**路径参数**:
- `id`: 媒体库ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "scanning",
    "progress": 45,
    "currentFile": "song.mp3",
    "totalFiles": 1000,
    "processedFiles": 450
  }
}
```

**扫描状态说明**:
- `scanning`: 扫描中
- `completed`: 扫描完成
- `failed`: 扫描失败

## 系统信息接口

### 获取系统信息

获取服务器系统信息。

```http
GET /api/settings/system-info
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "platform": "win32",
    "arch": "x64",
    "nodeVersion": "v18.17.0",
    "memory": {
      "total": 17179869184,
      "free": 8589934592,
      "used": 8589934592
    },
    "cpu": {
      "cores": 8,
      "model": "Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz"
    },
    "uptime": 86400,
    "loadAverage": [1.5, 1.2, 0.8]
  }
}
```

## 音乐统计接口

### 获取音乐统计信息

获取音乐数据库的统计信息。

```http
GET /api/settings/music-stats
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tracks": 1250,
    "albums": 89,
    "artists": 156,
    "genres": 25
  }
}
```

## 错误处理

所有接口都遵循统一的错误响应格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

**常见HTTP状态码**:
- `200`: 请求成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误

## 数据存储

### 配置文件位置

- **API配置**: 存储在 `config.db` 数据库中
- **媒体库配置**: 存储在 `config.db` 数据库中
- **音乐数据**: 存储在 `music.db` 数据库中

### 数据格式

**API配置** (存储在 `config.db`):
```json
{
  "_id": "app_config",
  "musicbrainzApiKey": "",
  "musicbrainzUserAgent": "NAS-Music-Server/1.0.0",
  "lastfmApiKey": "",
  "enableLastfm": true,
  "acoustidApiKey": "",
  "enableAcoustid": false,
  "qqMusicApiKey": "",
  "enableQQMusic": false,
  "neteaseMusicApiKey": "",
  "enableNeteaseMusic": false,
  "musicLibraryPaths": ["/music", "/another/music/path"]
}
```

**媒体库统计** (存储在 `config.db`):
```json
{
  "_id": "media_library_L211c2lj",
  "trackCount": 1250,
  "albumCount": 89,
  "artistCount": 156,
  "lastScanned": "2023-12-21T15:20:30.456Z"
}
```

## 支持的音乐格式

扫描功能支持以下音乐文件格式：
- `.mp3` - MPEG Audio Layer III
- `.flac` - Free Lossless Audio Codec
- `.wav` - Waveform Audio File Format
- `.m4a` - MPEG-4 Audio
- `.aac` - Advanced Audio Coding
- `.ogg` - Ogg Vorbis
- `.wma` - Windows Media Audio

## 功能特性

### 媒体库管理
1. **添加媒体库**: 支持添加多个媒体库路径
2. **删除媒体库**: 删除媒体库时会同时删除相关的音乐数据
3. **扫描媒体库**: 异步扫描，支持实时进度查询
4. **统计信息**: 自动统计每个媒体库的音轨、专辑、艺术家数量

### 索引管理
1. **自动索引**: 扫描完成后自动构建专辑、艺术家、流派索引
2. **增量更新**: 文件变化时自动更新索引
3. **数据一致性**: 删除媒体库时自动清理相关索引数据

### API集成
1. **多API支持**: 支持 MusicBrainz、Last.fm、AcoustID、腾讯云音乐、网易云音乐
2. **配置管理**: 统一的API配置管理
3. **连接测试**: 支持测试API配置的有效性

## 安全考虑

1. **路径验证**: 所有媒体库路径都会进行存在性验证
2. **文件权限**: 检查文件系统访问权限
3. **API密钥保护**: API密钥在传输和存储时应该加密
4. **错误信息**: 避免在错误响应中暴露敏感信息

## 性能优化

1. **异步扫描**: 媒体库扫描采用异步处理，不阻塞主线程
2. **进度缓存**: 扫描进度存储在内存中，支持实时查询
3. **文件处理**: 支持大文件目录的递归扫描
4. **错误恢复**: 单个文件处理失败不影响整体扫描
5. **索引优化**: 使用数据库索引提升查询性能

## 扩展功能

### 未来可添加的接口

1. **批量操作**: 批量添加和删除媒体库
2. **扫描历史**: 显示扫描历史记录
3. **配置导入导出**: 支持配置的备份和恢复
4. **定时扫描**: 设置自动扫描计划
5. **扫描规则**: 自定义扫描规则和过滤条件
6. **元数据更新**: 从外部API更新音乐元数据

### 集成建议

1. **music-metadata**: 已集成专业的音乐元数据提取库
2. **ffmpeg**: 集成音频处理功能
3. **数据库**: 使用 NeDB 轻量级数据库
4. **缓存系统**: 添加Redis缓存提升性能
5. **任务队列**: 使用队列系统处理大量扫描任务

## 技术架构

### 文件结构
```
src/
├── client/
│   ├── database.js      # 数据库管理
│   └── music.js         # 音乐管理（媒体库+索引）
└── api/
    └── settings.js      # 设置API接口
```

### 核心模块
- **database.js**: 数据库初始化和配置管理
- **music.js**: 媒体库管理、扫描、索引构建
- **settings.js**: API接口层，调用music.js的功能

### 数据流
1. 前端调用设置API
2. API层调用music.js的功能
3. music.js操作数据库
4. 返回结果给前端
