import path from 'path';
import NodeID3 from 'node-id3';

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
  if(!metadata || !metadata.common || !metadata.common.picture) { return null; }
  const picture = metadata.common.picture.length > 0 ? metadata.common.picture[0] : null;
  if (picture &&  picture.data) {
    try {
      const buf = Buffer.isBuffer(picture.data) ? picture.data : Buffer.from(picture.data);
      const mime = picture.format && String(picture.format).startsWith('image/') ? picture.format : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
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
      // 处理MP3文件
      const existingTags = readMusicTags(filePath);
      const tags = { ...existingTags };
      
      // 更新基本标签
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