import path from 'path';
import { promises as fs } from 'fs';
import { parseFile } from 'music-metadata';
import NodeID3 from 'node-id3';
import { normalizeSongTitle, normalizeArtistName, normalizeText, extractArtistTitleFromFilename } from '../utils/textUtils.js';

// 支持的音乐文件格式
export const SUPPORTED_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];
const ARTIST_SEPARATORS = ['/', '、', ',', '，', '&', '&amp;', 'feat.', 'feat', 'ft.', 'ft', 'featuring', 'vs', 'VS'];
export const formatArtistNames = (artistString) => {
  if (!artistString || typeof artistString !== 'string') { return []; }
  let names = [artistString];
  for (const separator of ARTIST_SEPARATORS) {
    const newNames = [];
    for (const name of names) {
      newNames.push(...name.split(separator).map(n => n.trim()).filter(n => n));
    }
    names = newNames;
  }
  return [...new Set(names)].filter(name => name.length > 0);
}

// 提取歌词内容
export function extractLyrics(metadata) {
  try {
    // 尝试从 common.lyrics 获取
    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
      const lyrics = metadata.common.lyrics[0];
      if (typeof lyrics === 'string') return lyrics;
      if (lyrics.text) return lyrics.text;
      if (lyrics.data) return lyrics.data;
    }
    // 尝试从 native tags 获取
    const nativeTags = metadata.native;
    for (const format in nativeTags) {
      const tags = nativeTags[format];
      if (tags.lyrics) {
        if (Array.isArray(tags.lyrics)) {
          return tags.lyrics[0];
        }
        return tags.lyrics;
      }
      if (tags.LYRICS) {
        if (Array.isArray(tags.LYRICS)) {
          return tags.LYRICS[0];
        }
        return tags.LYRICS;
      }
    }
    return '';
  } catch (error) {
    console.warn('提取歌词失败:', error);
    return '';
  }
}

export function extractCoverImage(metadata) {
  try {
    if(!metadata || !metadata.common || !metadata.common.picture) { return null; }
    const picture = metadata.common.picture.length > 0 ? metadata.common.picture[0] : null;
    if (picture &&  picture.data) {
      const buf = Buffer.isBuffer(picture.data) ? picture.data : Buffer.from(picture.data);
      const mime = picture.format && String(picture.format).startsWith('image/') ? picture.format : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
  } catch (error) {
    return null
  }
}


// 获取音乐文件元数据
export async function getMetadata(filePath) {
  // 检查文件是否存在
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) { throw new Error('不是有效的文件'); }
  // 检查文件格式
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) { throw new Error('不支持的文件格式'); }
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
    const title = normalizeSongTitle(metadata.common.title || filenameTitle || filename);
    const artist = normalizeArtistName(metadata.common.artist || filenameArtist || 'Unknown');
    return {
      filename,
      path: filePath,
      title,
      artist,
      album: normalizeText(metadata.common.album || 'Unknown'),
      albumArtist: normalizeText(metadata.common.albumartist || artist),
      genre: normalizeText(metadata.common.genre?.join(', ') || 'Unknown'),
      duration: metadata.format.duration || 0,
      bitrate: metadata.format.bitrate || 0,
      sampleRate: metadata.format.sampleRate || 0,
      channels: metadata.format.numberOfChannels || 0,
      size: stats.size,
      year: metadata.common.year || null,
      createdTime: createdTime.toISOString(),
      modifiedTime: modifiedTime.toISOString(),
      coverImage: extractCoverImage(metadata),
      lyrics: normalizeText(extractLyrics(metadata))
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

export const parseMetadata = async(filePath) => {
  try {
    return await parseFile(filePath);
  } catch (error) {
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
  }
}

// 读取音乐文件标签
export function readMusicTags(filePath) {
  return NodeID3.read(filePath)
}

// 写入音乐文件标签
export function writeMusicTags(filePath, metadata) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mp3') {
      const existingTags = readMusicTags(filePath);
      const tags = { ...existingTags };
      if (metadata.title) tags.title = metadata.title;
      if (metadata.artist) tags.artist = metadata.artist;
      if (metadata.album) tags.album = metadata.album;
      if (metadata.year) tags.year = metadata.year.toString();
      if (metadata.lyrics) {
        tags.unsynchronisedLyrics = {
          language: 'eng',
          text: metadata.lyrics
        };
      }
      if (metadata.coverImage && metadata.coverImage.startsWith('data:image/')) {
        try {
          const base64Data = metadata.coverImage.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const format = metadata.coverImage.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
          tags.image = {
            imageBuffer,
            type: {
              id: 3,
              name: 'front cover'
            },
            mime: `image/${format}`
          };
        } catch (error) {
          console.error('处理封面图片失败:', error);
        }
      }
      
      const success = NodeID3.write(tags, filePath);
      if (success) {
        console.log(`已更新MP3标签: ${filePath}`);
        return true;
      } else {
        throw new Error('写入MP3标签失败');
      }
    } else if (ext === '.flac') {
      // 处理FLAC文件
      const existingTags = readMusicTags(filePath);
      const tags = { ...existingTags };
      
      // 更新基本标签
      if (metadata.title) tags.TITLE = metadata.title;
      if (metadata.artist) tags.ARTIST = metadata.artist;
      if (metadata.album) tags.ALBUM = metadata.album;
      if (metadata.year) tags.DATE = metadata.year.toString();
      if (metadata.lyrics) tags.LYRICS = metadata.lyrics;
      
      // 如果有封面图片，添加封面
      if (metadata.coverImage && metadata.coverImage.startsWith('data:image/')) {
        try {
          const base64Data = metadata.coverImage.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const format = metadata.coverImage.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
          
          tags.PICTURE = [{
            imageBuffer,
            type: {
              id: 3,
              name: 'front cover'
            },
            mime: `image/${format}`
          }];
        } catch (error) {
          console.error('处理封面图片失败:', error);
        }
      }
      
      const success = NodeID3.write(tags, filePath);
      if (success) {
        console.log(`已更新FLAC标签: ${filePath}`);
        return true;
      } else {
        throw new Error('写入FLAC标签失败');
      }
    } else if (ext === '.m4a' || ext === '.aac') {
      // 处理M4A/AAC文件
      const existingTags = readMusicTags(filePath);
      const tags = { ...existingTags };
      
      // 更新基本标签
      if (metadata.title) tags.title = metadata.title;
      if (metadata.artist) tags.artist = metadata.artist;
      if (metadata.album) tags.album = metadata.album;
      if (metadata.year) tags.year = metadata.year.toString();
      if (metadata.lyrics) tags.lyrics = metadata.lyrics;
      
      // 如果有封面图片，添加封面
      if (metadata.coverImage && metadata.coverImage.startsWith('data:image/')) {
        try {
          const base64Data = metadata.coverImage.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const format = metadata.coverImage.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
          
          tags.image = {
            imageBuffer,
            type: {
              id: 3,
              name: 'front cover'
            },
            mime: `image/${format}`
          };
        } catch (error) {
          console.error('处理封面图片失败:', error);
        }
      }
      
      const success = NodeID3.write(tags, filePath);
      if (success) {
        console.log(`已更新M4A/AAC标签: ${filePath}`);
        return true;
      } else {
        throw new Error('写入M4A/AAC标签失败');
      }
    } else {
      // 其他格式暂时跳过
      console.log(`跳过标签写入，不支持的文件格式: ${ext}`);
      return false;
    }
  } catch (error) {
    console.error('写入音乐标签失败:', error);
    return false;
  }
}