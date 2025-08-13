
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