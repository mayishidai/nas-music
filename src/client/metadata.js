import { promises as fs } from 'fs';
import path from 'path';
import { upsertTrack, getConfig, saveConfig, removeTracksByLibraryId, updateState } from './database.js';
import { getMetadata, SUPPORTED_FORMATS } from '../utils/musicUtil.js';

// ==================== 媒体库管理函数 ====================

// 获取媒体库列表
export async function getMediaLibraries() {
  try {
    const config = await getConfig();
    const libraries = [];
    
    for (const libraryPath of config.musicLibraryPaths || []) {
      const id = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      libraries.push({ 
        id, 
        path: libraryPath, 
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
    await fs.access(libraryPath);
    const config = await getConfig();
    config.musicLibraryPaths = config.musicLibraryPaths || [];
    if (config.musicLibraryPaths.includes(libraryPath)) { throw new Error('媒体库路径已存在'); }
    config.musicLibraryPaths.push(libraryPath);
    await saveConfig(config);
    const id = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    scanMediaLibrary(id);
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
    config.musicLibraryPaths.splice(idx, 1);
    saveConfig(config);
    removeTracksByLibraryId(id);
    updateState();
    return true;
  } catch (error) {
    console.error('删除媒体库失败:', error);
    throw error;
  }
}

// 扫描进度存储
const scanProgress = new Map();
// 扫描指定媒体库
export async function scanMediaLibrary(libraryId) {
  try {
    const config = await getConfig();
    const libraryPath = (config.musicLibraryPaths || []).find(p => 
      Buffer.from(p).toString('base64').replace(/[^a-zA-Z0-9]/g, '') === libraryId
    );
    if (!libraryPath) throw new Error('媒体库不存在');
    const initialProgress = { status: 'scanning', progress: 0, currentFile: '', totalFiles: 0, processedFiles: 0 };
    scanProgress.set(libraryId, initialProgress);
    // 获取所有音乐文件
    let musicFiles = await getAllMusicFiles(libraryPath);
    const totalFiles = musicFiles.length;
    const progressUpdate = { status: 'scanning', progress: 0, currentFile: '', totalFiles, processedFiles: 0 };
    scanProgress.set(libraryId, progressUpdate);
    await removeTracksByLibraryId(libraryId);
    let processedFiles = 0;
    let metadata = null;
    let trackDoc = null;
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
        metadata = await getMetadata(filePath);
        trackDoc = {
          ...metadata,
          libraryId,
          path: filePath,
          favorite: false,
          playCount: 0
        };
        await upsertTrack(trackDoc);
        processedFiles++;
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
      } finally {
        metadata = null;
        trackDoc = null;
      }
      // 每处理100个文件强制垃圾回收一次
      if (processedFiles % 100 === 0 && global.gc) {
        global.gc();
      }
    }
    updateState();
    const completedProgress = { 
      status: 'completed', 
      progress: 100, 
      currentFile: '', 
      totalFiles, 
      processedFiles, 
      result: { 
        tracks: processedFiles,
        postProcess: true
      } 
    };
    scanProgress.set(libraryId, completedProgress);
    musicFiles = null;
    if (global.gc) {
      global.gc();
    }
    console.log(`媒体库扫描完成: ${libraryPath}, 处理了 ${processedFiles} 个文件`);
  } catch (error) {
    console.error(`扫描媒体库失败`, error);
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

export default {
  getMediaLibraries,
  addMediaLibrary,
  deleteMediaLibrary,
  scanMediaLibrary,
  getScanProgress
};
