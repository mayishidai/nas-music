import path from 'path';
import fs from 'fs';

// 如果文件夹不存在，递归创建文件夹
export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// 规范化文件路径（统一为绝对路径与正斜杠）
export function normalizeFsPath(inputPath) {
  const abs = path.resolve(inputPath);
  return abs.replace(/\\/g, '/');
}

// 从路径获取文件名
export function getBaseNameFromPath(filePath) {
  if (!filePath) return '';
  const norm = String(filePath).replace(/\\/g, '/');
  const last = norm.lastIndexOf('/');
  return last >= 0 ? norm.slice(last + 1) : norm;
}

// 获取文件扩展名
export function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

// 检查是否为支持的音乐文件格式
export function isSupportedMusicFormat(filePath) {
  const supportedFormats = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];
  const ext = getFileExtension(filePath);
  return supportedFormats.includes(ext);
}

// 递归获取目录下的所有音乐文件
export async function getMusicFilesRecursive(dirPath) {
  const { promises: fs } = await import('fs');
  const musicFiles = [];
  
  async function scanDirectory(currentPath) {
    try {
      const items = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (item.isFile() && isSupportedMusicFormat(fullPath)) {
          musicFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`无法扫描目录 ${currentPath}:`, error.message);
    }
  }
  
  await scanDirectory(dirPath);
  return musicFiles;
}

// 将歌词值统一转换为字符串，避免 [object Object]
export function coerceLyricsToString(value) {
  try {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      // 如果是对象，尝试提取文本内容
      if (value.text) {
        return String(value.text);
      }
      if (value.lyrics) {
        return String(value.lyrics);
      }
      // 如果是数组，取第一个元素
      if (Array.isArray(value)) {
        return value.length > 0 ? coerceLyricsToString(value[0]) : '';
      }
      // 其他情况，转换为字符串
      return JSON.stringify(value);
    }
    return String(value || '');
  } catch (error) {
    console.warn('歌词转换失败:', error);
    return String(value || '');
  }
}
