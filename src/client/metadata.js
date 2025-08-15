import { promises as fs } from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { upsertTrackByPath, getConfig, saveConfig, removeTracksByLibraryPathPrefix, removeMediaLibraryStats, updateMediaLibraryStats, postScanProcessing } from './database.js';
import { normalizeText, extractArtistTitleFromFilename } from '../utils/textUtils.js';
import { extractLyrics, extractCoverImage } from '../utils/musicUtil.js';

// 支持的音乐文件格式
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];

// 获取音乐文件元数据
export async function getMetadata(filePath) {
  try {
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
    
    // 解析音乐元数据
    const metadata = await parseFile(filePath);
    
    // 提取基本信息
    const filename = path.basename(filePath);
    const { artist: filenameArtist, title: filenameTitle } = extractArtistTitleFromFilename(filename);
    
    // 标准化文本
    const title = await normalizeText(metadata.common.title || filenameTitle || filename);
    const artist = await normalizeText(metadata.common.artist || filenameArtist || 'Unknown');
    const album = await normalizeText(metadata.common.album || 'Unknown');
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
    
    // 获取时间信息
    const createdTime = stats.birthtime;
    const modifiedTime = stats.mtime;
    
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
      trackNumber: metadata.common.track?.no || null,
      totalTracks: metadata.common.track?.of || null,
      discNumber: metadata.common.disk?.no || null,
      totalDiscs: metadata.common.disk?.of || null,
      createdTime: createdTime.toISOString(),
      modifiedTime: modifiedTime.toISOString(),
      coverImage,
      lyrics
    };
  } catch (error) {
    console.error('获取元数据失败:', filePath, error);
    throw error;
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
    console.log(`开始扫描媒体库: ${libraryPath}`);
    // 初始化扫描进度
    scanProgress.set(libraryId, { 
      status: 'scanning', 
      progress: 0, 
      currentFile: '', 
      totalFiles: 0, 
      processedFiles: 0 
    });
    
    // 获取所有音乐文件
    const musicFiles = await getAllMusicFiles(libraryPath);
    const totalFiles = musicFiles.length;
    
    scanProgress.set(libraryId, { 
      status: 'scanning', 
      progress: 0, 
      currentFile: '', 
      totalFiles, 
      processedFiles: 0 
    });
    
    // 删除旧记录
    await removeTracksByLibraryPathPrefix(libraryPath.replace(/\\/g, '/'));
    
    let processedFiles = 0;
    const processedTracks = [];
    
    for (const filePath of musicFiles) {
      try {
        scanProgress.set(libraryId, { 
          status: 'scanning', 
          progress: Math.round((processedFiles / totalFiles) * 100), 
          currentFile: path.basename(filePath), 
          totalFiles, 
          processedFiles 
        });
        
        const metadata = await getMetadata(filePath);
        const trackDoc = {
          ...metadata,
          type: 'track',
          path: filePath,
          favorite: false,
          playCount: 0
        };
        
        await upsertTrackByPath(trackDoc);
        processedTracks.push(trackDoc);
        processedFiles++;
        
        // 添加小延迟避免阻塞
        await new Promise(r => setTimeout(r, 10));
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
      }
    }
    // 更新媒体库统计
    await updateMediaLibraryStats(libraryId, processedTracks);
    
    // 开始扫描后处理
    console.log('开始扫描后处理...');
    try {
      const postProcessResult = await postScanProcessing();
      console.log('扫描后处理完成:', postProcessResult);
    } catch (error) {
      console.error('扫描后处理失败:', error);
    }
    
    scanProgress.set(libraryId, { 
      status: 'completed', 
      progress: 100, 
      currentFile: '', 
      totalFiles, 
      processedFiles, 
      result: { 
        tracks: processedTracks.length,
        postProcess: true
      } 
    });
    
    console.log(`媒体库扫描完成: ${libraryPath}, 处理了 ${processedTracks.length} 个文件`);
  } catch (error) {
    console.error(`扫描媒体库失败`, error);
    scanProgress.set(libraryId, { 
      status: 'failed', 
      progress: 0, 
      currentFile: '', 
      totalFiles: 0, 
      processedFiles: 0, 
      error: error.message 
    });
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
