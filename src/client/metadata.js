import { promises as fs } from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import NodeID3 from 'node-id3';
import { upsertTrackByPath, getConfig, saveConfig, removeTracksByLibraryPathPrefix, removeMediaLibraryStats, updateMediaLibraryStats, postScanProcessing } from './database.js';
import { normalizeSongTitle, normalizeArtistName, normalizeText, extractArtistTitleFromFilename } from '../utils/textUtils.js';
import { extractLyrics, extractCoverImage } from '../utils/musicUtil.js';

// 支持的音乐文件格式
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];

export const parseMetadata = async(filePath) => {
  try {
    return await parseFile(filePath);
  } catch (error) {
    console.log(`使用 music-metadata 解析失败，尝试使用 NodeID3: ${error.message}`);
  }
  // 使用 NodeID3 作为备选方案
  try {
    const tags = NodeID3.read(filePath);
    const metadata = {
      common: {
        title: tags.title || undefined,
        artist: tags.artist || undefined,
        albumartist: tags.performerInfo || tags.artist || undefined,
        album: tags.album || undefined,
        year: tags.year || undefined,
        genre: tags.genre ? [tags.genre] : undefined,
        comment: tags.comment ? [{ text: tags.comment.text }] : undefined,
        track: tags.trackNumber ? { no: parseInt(tags.trackNumber.split('/')[0]) || 0, of: parseInt(tags.trackNumber.split('/')[1]) || 0 } : undefined,
        disk: tags.partOfSet ? { no: parseInt(tags.partOfSet.split('/')[0]) || 0, of: parseInt(tags.partOfSet.split('/')[1]) || 0 } : undefined,
        picture: tags.image ? [{
          format: tags.image.mime,
          data: tags.image.imageBuffer,
          description: tags.image.description || ''
        }] : undefined,
        composer: tags.composer ? [tags.composer] : undefined,
        lyrics: tags.unsynchronisedLyrics ? tags.unsynchronisedLyrics.text : undefined
      },
      format: {
        // NodeID3 不提供这些信息，需要使用默认值或其他方式获取
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        numberOfChannels: 0,
        container: path.extname(filePath).substring(1).toLowerCase(),
        codec: 'mp3', // 假设是 mp3 文件
        lossless: false,
        tagTypes: ['ID3v2']
      }
    };
    return metadata;
  } catch (error) {
    console.error(`NodeID3 解析失败: ${error.message}`);
    // 返回最小化的元数据结构
    return {
      common: {},
      format: {
        container: path.extname(filePath).substring(1).toLowerCase(),
        tagTypes: []
      }
    };
  }
}

// 获取音乐文件元数据
export async function getMetadata(filePath) {
  // 检查文件是否存在
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error('不是有效的文件');
  }
  // 检查文件格式
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new Error('不支持的文件格式');
  }
  // 获取时间信息
  const createdTime = stats.birthtime;
  const modifiedTime = stats.mtime;
  // 提取基本信息
  const filename = path.basename(filePath);
  const { artist: filenameArtist, title: filenameTitle } = extractArtistTitleFromFilename(filename);
  try {
    // 解析音乐元数据
    const metadata = await parseMetadata(filePath);
    // 标准化文本
    const title = await normalizeSongTitle(metadata.common.title || filenameTitle || filename);
    const artist = await normalizeArtistName(metadata.common.artist || filenameArtist || 'Unknown');
    const album = await normalizeSongTitle(metadata.common.album || 'Unknown');
    const albumArtist = await normalizeText(metadata.common.albumartist || artist);
    const genre = await normalizeText(metadata.common.genre?.join(', ') || 'Unknown');
    
    // 提取封面
    let coverImage = extractCoverImage(metadata);
    // 提取歌词
    const lyrics = await normalizeText(extractLyrics(metadata));
    
    // 获取音频信息
    const format = metadata.format;
    const duration = format.duration || 0;
    const bitrate = format.bitrate || 0;
    const sampleRate = format.sampleRate || 0;
    const channels = format.numberOfChannels || 0;
    
    return {
      filename,
      filePath,
      title,
      artist,
      album,
      albumArtist,
      genre,
      duration,
      bitrate,
      sampleRate,
      channels,
      size: stats.size,
      year: metadata.common.year || null,
      createdTime: createdTime.toISOString(),
      modifiedTime: modifiedTime.toISOString(),
      coverImage,
      lyrics
    };
  } catch (error) {
    console.error('获取元数据失败:', filePath, error);
    const title = await normalizeSongTitle(filenameTitle || filename);
    const artist = await normalizeArtistName(filenameArtist || 'Unknown');
    return {
      filename,
      filePath,
      title,
      artist,
      size: stats.size,
      createdTime: createdTime.toISOString(),
      modifiedTime: modifiedTime.toISOString(),
    };
  }
}

// 扫描单个媒体库
export async function scanMedia(libraryPath) {
  try {
    console.log(`开始扫描媒体库: ${libraryPath}`);
    const processedTracks = [];
    const processedCount = { success: 0, failed: 0 };
    // 递归扫描目录
    async function scanDirectory(dirPath) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            // 递归扫描子目录
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            // 检查是否为支持的音乐文件
            const ext = path.extname(entry.name).toLowerCase();
            if (SUPPORTED_FORMATS.includes(ext)) {
              try {
                // 获取元数据
                const metadata = await getMetadata(fullPath);
                // 保存到数据库
                const trackDoc = {
                  ...metadata,
                  type: 'track',
                  path: fullPath,
                  favorite: false,
                  playCount: 0
                };
                
                await upsertTrackByPath(trackDoc);
                processedTracks.push(trackDoc);
                processedCount.success++;
                
                console.log(`✓ 处理成功: ${entry.name}`);
              } catch (error) {
                console.error(`✗ 处理失败: ${entry.name}`, error.message);
                processedCount.failed++;
              }
            }
          }
        }
      } catch (error) {
        console.error(`扫描目录失败: ${dirPath}`, error);
      }
    }
    // 开始扫描
    await scanDirectory(libraryPath);
    console.log(`扫描完成: ${processedCount.success} 个成功, ${processedCount.failed} 个失败`);
    return { processedTracks, processedCount };
  } catch (error) {
    console.error('扫描媒体库失败:', error);
    throw error;
  }
}

// 扫描所有配置的媒体库
export async function scanAll() {
  try {
    const config = await getConfig();
    const libraryPaths = config.musicLibraryPaths || ['./music'];
    console.log('开始扫描所有媒体库...');
    const allResults = [];
    for (const libraryPath of libraryPaths) {
      try {
        const result = await scanMedia(libraryPath);
        allResults.push({
          libraryPath,
          ...result
        });
      } catch (error) {
        console.error(`扫描媒体库失败: ${libraryPath}`, error);
        allResults.push({
          libraryPath,
          processedTracks: [],
          processedCount: { success: 0, failed: 0 },
          error: error.message
        });
      }
    }
    console.log('所有媒体库扫描完成');
    return allResults;
  } catch (error) {
    console.error('扫描所有媒体库失败:', error);
    throw error;
  }
}


// ==================== 媒体库管理函数 ====================

// 扫描进度存储
const scanProgress = new Map();

// 从配置文件加载扫描进度
async function loadScanProgress() {
  try {
    const config = await getConfig();
    const savedProgress = config.scanProgress || {};
    
    for (const [libraryId, progress] of Object.entries(savedProgress)) {
      // 只恢复正在进行的扫描
      if (progress.status === 'scanning') {
        scanProgress.set(libraryId, progress);
      }
    }
  } catch (error) {
    console.error('加载扫描进度失败:', error);
  }
}

// 保存扫描进度到配置文件
async function saveScanProgress(libraryId, progress) {
  try {
    const config = await getConfig();
    config.scanProgress = config.scanProgress || {};
    config.scanProgress[libraryId] = progress;
    await saveConfig(config);
  } catch (error) {
    console.error('保存扫描进度失败:', error);
  }
}

// 清除扫描进度
async function clearScanProgress(libraryId) {
  try {
    const config = await getConfig();
    if (config.scanProgress && config.scanProgress[libraryId]) {
      delete config.scanProgress[libraryId];
      await saveConfig(config);
    }
    scanProgress.delete(libraryId);
  } catch (error) {
    console.error('清除扫描进度失败:', error);
  }
}

// 初始化时加载扫描进度
loadScanProgress();

// 获取媒体库列表
export async function getMediaLibraries() {
  try {
    const config = await getConfig();
    const libraries = [];
    
    for (const libraryPath of config.musicLibraryPaths || []) {
      const id = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      const stats = await getMediaLibraryStats(id) || { 
        trackCount: 0, 
        albumCount: 0, 
        artistCount: 0, 
        lastScanned: null 
      };
      libraries.push({ 
        id, 
        path: libraryPath, 
        ...stats, 
        createdAt: stats.createdAt || new Date().toISOString() 
      });
    }
    return libraries;
  } catch (error) {
    console.error('获取媒体库列表失败:', error);
    return [];
  }
}

// 添加媒体库
export async function addMediaLibrary(libraryPath) {
  try {
    if (!libraryPath) throw new Error('路径不能为空');
    
    // 验证路径是否存在
    await fs.access(libraryPath);
    
    const config = await getConfig();
    config.musicLibraryPaths = config.musicLibraryPaths || [];
    
    if (config.musicLibraryPaths.includes(libraryPath)) {
      throw new Error('媒体库路径已存在');
    }
    
    config.musicLibraryPaths.push(libraryPath);
    await saveConfig(config);
    
    const id = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return { 
      id, 
      path: libraryPath, 
      trackCount: 0, 
      albumCount: 0, 
      artistCount: 0, 
      createdAt: new Date().toISOString() 
    };
  } catch (error) {
    console.error('添加媒体库失败:', error);
    throw error;
  }
}

// 删除媒体库
export async function deleteMediaLibrary(id) {
  try {
    const config = await getConfig();
    const idx = (config.musicLibraryPaths || []).findIndex(p => 
      Buffer.from(p).toString('base64').replace(/[^a-zA-Z0-9]/g, '') === id
    );
    if (idx === -1) throw new Error('媒体库不存在');
    const libPath = config.musicLibraryPaths[idx];
    config.musicLibraryPaths.splice(idx, 1);
    await saveConfig(config);
    // 删除相关数据
    await removeTracksByLibraryPathPrefix(libPath.replace(/\\/g, '/'));
    await removeMediaLibraryStats(id);
    return true;
  } catch (error) {
    console.error('删除媒体库失败:', error);
    throw error;
  }
}

// 扫描指定媒体库
export async function scanMediaLibrary(libraryId) {
  try {
    const config = await getConfig();
    const libraryPath = (config.musicLibraryPaths || []).find(p => 
      Buffer.from(p).toString('base64').replace(/[^a-zA-Z0-9]/g, '') === libraryId
    );
    if (!libraryPath) throw new Error('媒体库不存在');
    const initialProgress = { 
      status: 'scanning', 
      progress: 0, 
      currentFile: '', 
      totalFiles: 0, 
      processedFiles: 0 
    };
    scanProgress.set(libraryId, initialProgress);
    await saveScanProgress(libraryId, initialProgress);
    // 获取所有音乐文件
    const musicFiles = await getAllMusicFiles(libraryPath);
    const totalFiles = musicFiles.length;
    const progressUpdate = { status: 'scanning', progress: 0, currentFile: '', totalFiles, processedFiles: 0 };
    scanProgress.set(libraryId, progressUpdate);
    await saveScanProgress(libraryId, progressUpdate);
    await removeTracksByLibraryPathPrefix(libraryPath.replace(/\\/g, '/'));
    let processedFiles = 0;
    const processedTracks = [];
    for (const filePath of musicFiles) {
      try {
        const fileProgress = { 
          status: 'scanning', 
          progress: Math.round((processedFiles / totalFiles) * 100), 
          currentFile: path.basename(filePath), 
          totalFiles, 
          processedFiles 
        };
        scanProgress.set(libraryId, fileProgress);
        await saveScanProgress(libraryId, fileProgress);
        const metadata = await getMetadata(filePath);
        const trackDoc = {
          ...metadata,
          type: 'track',
          path: filePath,
          favorite: false,
          playCount: 0
        };
        upsertTrackByPath(trackDoc);
        processedTracks.push(trackDoc);
        processedFiles++;
        await new Promise(r => setTimeout(r, 10));
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
      }
    }
    // 更新媒体库统计
    await updateMediaLibraryStats(libraryId, processedTracks);
    postScanProcessing();
    const completedProgress = { 
      status: 'completed', 
      progress: 100, 
      currentFile: '', 
      totalFiles, 
      processedFiles, 
      result: { 
        tracks: processedTracks.length,
        postProcess: true
      } 
    };
    scanProgress.set(libraryId, completedProgress);
    await saveScanProgress(libraryId, completedProgress);
    setTimeout(() => { clearScanProgress(libraryId); }, 5000);
    console.log(`媒体库扫描完成: ${libraryPath}, 处理了 ${processedTracks.length} 个文件`);
  } catch (error) {
    console.error(`扫描媒体库失败`, error);
    const failedProgress = { 
      status: 'failed', 
      progress: 0, 
      currentFile: '', 
      totalFiles: 0, 
      processedFiles: 0, 
      error: error.message 
    };
    scanProgress.set(libraryId, failedProgress);
    await saveScanProgress(libraryId, failedProgress);
    
    // 延迟清除进度信息，让前端有时间获取失败状态
    setTimeout(() => {
      clearScanProgress(libraryId);
    }, 10000);
    throw error;
  }
}

// 获取扫描进度
export function getScanProgress(libraryId) {
  return scanProgress.get(libraryId);
}

// 获取所有音乐文件
async function getAllMusicFiles(dirPath) {
  const musicFiles = [];
  async function walk(currentPath) {
    try {
      const items = await fs.readdir(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await walk(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (SUPPORTED_FORMATS.includes(ext)) {
            musicFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${currentPath}`, error);
    }
  }
  await walk(dirPath);
  console.log(`扫描到 ${musicFiles.length} 个音乐文件`);
  return musicFiles;
}

// 获取媒体库统计信息
async function getMediaLibraryStats(libraryId) {
  try {
    const config = await getConfig();
    const statsKey = `media_library_${libraryId}`;
    return config[statsKey] || null;
  } catch (error) {
    console.error('获取媒体库统计失败:', error);
    return null;
  }
}

export default {
  getMetadata,
  scanMedia,
  scanAll,
  getMediaLibraries,
  addMediaLibrary,
  deleteMediaLibrary,
  scanMediaLibrary,
  getScanProgress
};
