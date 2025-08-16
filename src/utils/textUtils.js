import { tradToSimple as toSimplified } from 'simptrad';
import path from 'path';
import { isGarbled, tryFixEncoding } from './encodingUtils.js';

// 繁体转简体并处理乱码
export function normalizeText(text) {
  if (!text) return '';
  
  try {
    // 先转换为简体
    let normalized = toSimplified(String(text));
    // 检测并修复乱码
    if (isGarbled(normalized)) {
      normalized = tryFixEncoding(normalized);
    }
    return normalized.trim();
  } catch (error) {
    console.warn('文本标准化失败:', error);
    return String(text || '').trim();
  }
}

// 基础文本标准化
export function normalizeTextBasic(input) {
  return String(input || '')
    // 去除控制字符
    .replace(/[\u0000-\u001F]/g, ' ')
    // 全角转半角
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

// 歌曲名称格式化函数
export function normalizeSongTitle(title) {
  if (!title) return '';
  
  let normalized = String(title)
    // 去除常见的歌手名前缀
    .replace(/^[^-_–—~～\s]*[-_–—~～\s]+/, '')
    // 去除括号内容（包括中文括号）
    .replace(/[\(（].*?[\)）]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    // 去除常见后缀
    .replace(/\s*(官方版|纯音乐|伴奏|现场版|无损|高品质|原声|原曲|铃声|remix|live|ost|original|official|lyrics?)\s*$/gi, '')
    // 去除音轨号前缀
    .replace(/^\s*\d{1,2}\s*[-_.]\s*/, '')
    // 去除文件扩展名
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    // 去除多余空格
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

// 歌手名称格式化函数
export function normalizeArtistName(artist) {
  if (!artist) return '';
  
  let normalized = String(artist)
    // 去除常见后缀
    .replace(/\s*(feat\.|feat|ft\.|ft|&|,|，|、)\s*.*$/i, '')
    // 去除括号内容
    .replace(/[\(（].*?[\)）]/g, '')
    .replace(/\[.*?\]/g, '')
    // 去除多余空格
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

// 去除装饰性内容
export function stripDecorations(name) {
  if (!name) return '';
  let n = name;
  // 去扩展名
  n = n.replace(/\.[a-z0-9]{2,5}$/i, '');
  // 去括号与方括号、花括号内容
  n = n.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\{[^}]*\}/g, ' ');
  // 去常见标注词
  n = n.replace(/\b(320kbps|128kbps|flac|ape|mp3|wav|aac|ogg|m4a|wma|mv|live|hq|dj|remix|ost|original|official|lyrics?)\b/gi, ' ');
  // 去前导音轨号
  n = n.replace(/^\s*\d{1,2}\s*[-_.]\s*/, ' ');
  // 中文附加词
  n = n.replace(/(官方版|纯音乐|伴奏|现场版|无损|高品质|原声|原曲|铃声)/g, ' ');
  // 分隔符
  n = n.replace(/[\-_]+/g, ' ');
  return normalizeTextBasic(n);
}

// 分割歌手和标题
export function splitArtistTitle(cleanName) {
  const parts = cleanName.split(' - ').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    return { left: parts[0], right: parts[1] };
  }
  return { left: '', right: cleanName };
}

// 从文件名提取歌手和歌曲名
export function extractArtistTitleFromFilename(filename) {
  if (!filename) return { artist: '', title: '' };
  
  // 移除扩展名
  const nameWithoutExt = path.parse(filename).name;
  
  // 常见的分隔符模式
  const patterns = [
    /^(.+?)\s*[-_]\s*(.+)$/,  // 歌手 - 歌曲名
    /^(.+?)\s*–\s*(.+)$/,    // 歌手 – 歌曲名 (长破折号)
    /^(.+?)\s*—\s*(.+)$/,    // 歌手 — 歌曲名 (长破折号)
    /^(.+?)\s*～\s*(.+)$/,   // 歌手 ～ 歌曲名
    /^(.+?)\s*～\s*(.+)$/,   // 歌手 ~ 歌曲名
  ];
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return {
        artist: match[1].trim(),
        title: match[2].trim()
      };
    }
  }
  
  // 如果没有匹配到分隔符，返回整个文件名作为标题
  return { artist: '', title: nameWithoutExt };
}
