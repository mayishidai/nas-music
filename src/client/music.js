import path from 'path';
import fs from 'fs/promises';
import * as mm from 'music-metadata';
import chokidar from 'chokidar';
import { 
  getConfig, saveConfig,
  upsertTrackByPath, findTrackByPath, removeTrackById,
  removeTracksByLibraryPathPrefix, deleteAllTracks,
  rebuildIndexes,
  getMediaLibraryStats, removeMediaLibraryStats
} from './database.js';

// 文件监控器
let watcher = null;

// 扫描进度存储
const scanProgress = new Map();

// 规范化文件路径（统一为绝对路径与正斜杠）
function normalizeFsPath(inputPath) {
  const abs = path.resolve(inputPath);
  return abs.replace(/\\/g, '/');
}

// 确保目录存在
export async function ensureDirectories() {
  const config = await getConfig();
  for (const libraryPath of config.musicLibraryPaths || []) {
    try { await fs.access(libraryPath); } catch { await fs.mkdir(libraryPath, { recursive: true }); }
  }
}

// ==================== 媒体库管理 ====================

/** 列出媒体库（含统计） */
export async function getMediaLibraries() {
  const config = await getConfig();
  const libraries = [];
  for (const libraryPath of config.musicLibraryPaths || []) {
    const id = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const stats = (await getMediaLibraryStats(id)) || { trackCount: 0, albumCount: 0, artistCount: 0, lastScanned: null };
    libraries.push({ id, path: libraryPath, ...stats, createdAt: stats.createdAt || new Date().toISOString() });
  }
  return libraries;
}

/** 添加媒体库 */
export async function addMediaLibrary(libraryPath) {
  if (!libraryPath) throw new Error('路径不能为空');
  // 验证存在
  await fs.access(libraryPath);
  const config = await getConfig();
  config.musicLibraryPaths = config.musicLibraryPaths || [];
  if (config.musicLibraryPaths.includes(libraryPath)) throw new Error('媒体库路径已存在');
  config.musicLibraryPaths.push(libraryPath);
  await saveConfig(config);
  const id = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return { id, path: libraryPath, trackCount: 0, albumCount: 0, artistCount: 0, createdAt: new Date().toISOString() };
}

/** 修改媒体库路径 */
export async function updateMediaLibrary(id, newPath) {
  if (!newPath) throw new Error('新路径不能为空');
  await fs.access(newPath);
  const config = await getConfig();
  const index = (config.musicLibraryPaths || []).findIndex(p => Buffer.from(p).toString('base64').replace(/[^a-zA-Z0-9]/g, '') === id);
  if (index === -1) throw new Error('媒体库不存在');
  // 替换路径
  const oldPath = config.musicLibraryPaths[index];
  config.musicLibraryPaths[index] = newPath;
  await saveConfig(config);
  // 迁移旧路径数据由业务决定；此处简单策略：删除旧路径曲目（避免脏数据），需用户后续扫描新路径
  await removeTracksByLibraryPathPrefix(oldPath.replace(/\\/g, '/'));
  await removeMediaLibraryStats(id);
  return { id: Buffer.from(newPath).toString('base64').replace(/[^a-zA-Z0-9]/g, ''), path: newPath };
}

/** 删除媒体库 */
export async function deleteMediaLibrary(id) {
  const config = await getConfig();
  const idx = (config.musicLibraryPaths || []).findIndex(p => Buffer.from(p).toString('base64').replace(/[^a-zA-Z0-9]/g, '') === id);
  if (idx === -1) throw new Error('媒体库不存在');
  const libPath = config.musicLibraryPaths[idx];
  config.musicLibraryPaths.splice(idx, 1);
  await saveConfig(config);
  await removeTracksByLibraryPathPrefix(libPath.replace(/\\/g, '/'));
  await removeMediaLibraryStats(id);
  return true;
}

/** 获取指定媒体库扫描进度 */
export function getScanProgress(libraryId) {
  return scanProgress.get(libraryId);
}

// ==================== 扫描功能 ====================

// 解析 metadata 并返回标准化曲目文档（不含 _id）
async function buildTrackDocFromFile(normalizedPath) {
  const stats = await fs.stat(normalizedPath);
  const metadata = await mm.parseFile(normalizedPath);
  const { common, format } = metadata;
  const picture = common.picture && common.picture.length > 0 ? common.picture[0] : null;

  let coverImageBase64 = null;
  if (picture && picture.data) {
    try {
      const buf = Buffer.isBuffer(picture.data) ? picture.data : Buffer.from(picture.data);
      const mime = picture.format && String(picture.format).startsWith('image/') ? picture.format : 'image/jpeg';
      coverImageBase64 = `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      coverImageBase64 = null;
    }
  }

  return {
    type: 'track',
    path: normalizedPath,
    filename: path.basename(normalizedPath),
    title: common.title || path.parse(normalizedPath).name,
    artist: common.artist || '未知艺术家',
    albumArtist: common.albumartist || common.artist || '未知艺术家',
    album: common.album || '未知专辑',
    year: common.year || null,
    genre: common.genre ? common.genre.join(', ') : '未知流派',
    track: common.track?.no || null,
    disc: common.disk?.no || 1,
    duration: format.duration || 0,
    bitrate: format.bitrate || 0,
    sampleRate: format.sampleRate || 0,
    size: stats.size,
    coverImage: coverImageBase64 || null,
    favorite: false,
    addedAt: new Date().toISOString(),
    modifiedAt: stats.mtime.toISOString()
  };
}

/**
 * 扫描音乐文件（去重：按规范化 path upsert）
 */
export async function scanMusicFile(filePath) {
  try {
    const normalized = normalizeFsPath(filePath);
    const trackDoc = await buildTrackDocFromFile(normalized);
    const saved = await upsertTrackByPath(trackDoc);
    return saved;
  } catch (error) {
    console.error(`扫描文件失败 ${filePath}:`, error.message);
    return null;
  }
}

/** 递归扫描目录，返回处理的曲目数组 */
export async function scanDirectory(dirPath) {
  const config = await getConfig();
  const audioExtensions = config.supportedFormats || ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];
  const tracks = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subTracks = await scanDirectory(fullPath);
        tracks.push(...subTracks);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (audioExtensions.includes(ext)) {
          const track = await scanMusicFile(fullPath);
          if (track) tracks.push(track);
        }
      }
    }
  } catch (error) {
    console.error(`扫描目录失败 ${dirPath}:`, error.message);
  }
  return tracks;
}

/** 扫描指定媒体库（删除库旧记录 -> 扫描 -> 重建索引） */
export async function scanMediaLibrary(libraryId) {
  try {
    const config = await getConfig();
    const libraryPath = (config.musicLibraryPaths || []).find(p => Buffer.from(p).toString('base64').replace(/[^a-zA-Z0-9]/g, '') === libraryId);
    if (!libraryPath) throw new Error('媒体库不存在');

    console.log(`开始扫描媒体库: ${libraryPath}`);

    // 初始化扫描进度
    scanProgress.set(libraryId, { status: 'scanning', progress: 0, currentFile: '', totalFiles: 0, processedFiles: 0 });

    // 枚举文件
    const musicFiles = await getAllMusicFiles(libraryPath);
    const totalFiles = musicFiles.length;
    scanProgress.set(libraryId, { status: 'scanning', progress: 0, currentFile: '', totalFiles, processedFiles: 0 });

    // 删除库旧记录
    await removeTracksByLibraryPathPrefix(libraryPath.replace(/\\/g, '/'));

    let processedFiles = 0;
    const processedTracks = [];

    for (const filePath of musicFiles) {
      try {
        scanProgress.set(libraryId, { status: 'scanning', progress: Math.round((processedFiles / totalFiles) * 100), currentFile: path.basename(filePath), totalFiles, processedFiles });
        const trackInfo = await scanMusicFile(filePath);
        if (trackInfo) processedTracks.push(trackInfo);
        processedFiles++;
        await new Promise(r => setTimeout(r, 30));
      } catch (e) {
        console.error(`处理文件失败: ${filePath}`, e);
      }
    }
    await rebuildIndexes();
    scanProgress.set(libraryId, { status: 'completed', progress: 100, currentFile: '', totalFiles, processedFiles, result: { tracks: processedTracks.length } });
    console.log(`媒体库扫描完成: ${libraryPath}, 处理了 ${processedTracks.length} 个文件`);
  } catch (error) {
    console.error(`扫描媒体库失败`, error);
    scanProgress.set(libraryId, { status: 'failed', progress: 0, currentFile: '', totalFiles: 0, processedFiles: 0, error: error.message });
    throw error;
  }
}

/** 获取所有音乐文件（递归展开） */
async function getAllMusicFiles(dirPath) {
  const config = await getConfig();
  const musicExtensions = config.supportedFormats || ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.wma'];
  const musicFiles = [];
  async function walk(currentPath) {
    try {
      const items = await fs.readdir(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) await walk(fullPath);
        else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (musicExtensions.includes(ext)) musicFiles.push(normalizeFsPath(fullPath));
        }
      }
    } catch (e) {
      console.error(`扫描目录失败: ${currentPath}`, e);
    }
  }
  await walk(dirPath);
  return musicFiles;
}

// ==================== 全量扫描功能 ====================
export async function fullScan() {
  console.log('开始全量扫描...');
  await ensureDirectories();
  const config = await getConfig();

  // 清除所有曲目
  await deleteAllTracks();

  let totalTracks = 0;
  for (const libraryPath of config.musicLibraryPaths || []) {
    const tracks = await scanDirectory(libraryPath);
    totalTracks += tracks.length;
  }

  config.lastScan = new Date().toISOString();
  await saveConfig(config);
  await rebuildIndexes();
  console.log(`全量扫描完成，共 ${totalTracks} 首`);
  return totalTracks;
}

// ==================== 文件监控功能 ====================
export async function startFileWatcher() {
  if (watcher) watcher.close();
  const config = await getConfig();
  const audioExtensions = config.supportedFormats || ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];

  watcher = chokidar.watch(config.musicLibraryPaths || [], { ignored: /(^|[\/\\])\../, persistent: true, ignoreInitial: true });
  watcher
    .on('add', async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!audioExtensions.includes(ext)) return;
      console.log(`检测到新文件: ${filePath}`);
      const track = await scanMusicFile(filePath);
      if (track) await rebuildIndexes();
    })
    .on('unlink', async (filePath) => {
      console.log(`文件被删除: ${filePath}`);
      const norm = normalizeFsPath(filePath);
      const existing = await findTrackByPath(norm);
      if (existing) {
        await removeTrackById(existing._id);
        await rebuildIndexes();
      }
    })
    .on('change', async (filePath) => {
      console.log(`文件被修改: ${filePath}`);
      const track = await scanMusicFile(filePath);
      if (track) await rebuildIndexes();
    });

  console.log('文件监控已启动');
}

// ==================== 推荐算法（保持不变） ====================
export async function getRecommendations(trackId, limit = 10) {
  // 为简洁，此处保留现有实现，可按需迁移到 database.js
  const { musicDB } = await import('./database.js');
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: trackId }, (err, doc) => (err ? reject(err) : resolve(doc)));
    });
    if (!track || track.type !== 'track') return [];

    const allTracks = await new Promise((resolve, reject) => {
      musicDB.find({ type: 'track' }, (err, docs) => (err ? reject(err) : resolve(docs)));
    });

    const scores = new Map();
    allTracks.forEach(t => {
      if (t._id === trackId) return;
      let score = 0;
      if (t.album === track.album && t.albumArtist === track.albumArtist) score += 50;
      if (t.artist === track.artist) score += 30;
      if (t.genre === track.genre) score += 20;
      if (t.year && track.year && Math.abs(t.year - track.year) <= 2) score += 10;
      if (Math.abs(t.duration - track.duration) <= 30) score += 5;
      if (score > 0) scores.set(t._id, score);
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => allTracks.find(t => t._id === id));
  } catch (error) {
    console.error('获取推荐失败:', error);
    return [];
  }
}

// ==================== 初始化 ====================
export async function initMusicModule() {
  try {
    await startFileWatcher();
    console.log('音乐模块初始化完成');
    return true;
  } catch (error) {
    console.error('音乐模块初始化失败:', error);
    return false;
  }
}