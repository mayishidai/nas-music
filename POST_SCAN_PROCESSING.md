# 扫描后处理功能

## 概述

在扫描音乐库之后，系统会自动执行一系列后处理操作，包括：

1. **专辑封面自动获取**: 为没有封面的专辑从歌曲列表中获取封面图片
2. **歌手图片自动获取**: 为没有图片的歌手从歌曲列表中获取图片

## 功能详情

### 1. 专辑封面自动获取 (`updateAlbumsWithoutCover`)

- **功能**: 查找所有没有封面的专辑，从该专辑的歌曲中获取封面图片
- **逻辑**: 
  - 查找 `coverImage` 为 `null` 的专辑
  - 获取该专辑下有封面的歌曲
  - 使用第一首有封面的歌曲的封面作为专辑封面
- **API**: 自动在扫描完成后执行

### 2. 歌手图片自动获取 (`updateArtistsWithoutPhoto`)

- **功能**: 查找所有没有图片的歌手，从该歌手的歌曲中获取图片
- **逻辑**:
  - 查找 `photo` 为 `null` 的歌手
  - 优先获取该歌手有封面的歌曲的封面
  - 如果没有有封面的歌曲，则获取任何歌曲的封面
- **API**: 自动在扫描完成后执行

### 3. 完整扫描后处理 (`postScanProcessing`)

- **功能**: 执行完整的扫描后处理流程
- **步骤**:
  1. 合并和去重专辑 (`mergeAndDeduplicateAlbums`)
  2. 为没有封面的专辑获取封面 (`updateAlbumsWithoutCover`)
  3. 为没有图片的歌手获取图片 (`updateArtistsWithoutPhoto`)

## API 接口

### 自动执行
扫描音乐库完成后会自动执行后处理流程。

### 手动触发
```
POST /api/settings/post-scan-processing
```

**响应示例**:
```json
{
  "success": true,
  "message": "扫描后处理完成",
  "data": {
    "albumCoverUpdates": 5,
    "artistPhotoUpdates": 3
  }
}
```

## 数据库函数

### `updateAlbumsWithoutCover()`
- **返回**: 更新的专辑数量
- **功能**: 为没有封面的专辑自动获取封面

### `updateArtistsWithoutPhoto()`
- **返回**: 更新的歌手数量
- **功能**: 为没有图片的歌手自动获取图片

### `postScanProcessing()`
- **返回**: 包含更新统计的对象
- **功能**: 执行完整的扫描后处理流程

## 使用示例

### 在代码中使用
```javascript
import database from './src/client/database.js';

// 手动触发扫描后处理
const result = await database.postScanProcessing();
console.log('处理结果:', result);
// 输出: { albumCoverUpdates: 5, artistPhotoUpdates: 3 }

// 单独执行专辑封面更新
const albumCount = await database.updateAlbumsWithoutCover();
console.log('更新了', albumCount, '个专辑封面');

// 单独执行歌手图片更新
const artistCount = await database.updateArtistsWithoutPhoto();
console.log('更新了', artistCount, '个歌手图片');
```

### 通过API调用
```javascript
// 手动触发扫描后处理
const response = await fetch('/api/settings/post-scan-processing', {
  method: 'POST'
});
const result = await response.json();
console.log('处理结果:', result.data);
```

## 注意事项

1. **性能考虑**: 后处理操作在扫描完成后异步执行，不会阻塞扫描进度
2. **错误处理**: 单个专辑或歌手的处理失败不会影响其他项目的处理
3. **日志记录**: 所有操作都会记录详细的日志信息
4. **数据一致性**: 确保在更新封面/图片时同时更新 `updated_at` 时间戳

## 测试

可以使用以下命令测试功能：
```bash
node test-post-scan-processing.js
```

测试文件会验证所有后处理功能是否正常工作。
