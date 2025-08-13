
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