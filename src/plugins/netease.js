import axios from 'axios';

// 网易云音乐歌词搜索插件
class NeteaseLyricsPlugin {
  constructor() {
    this.baseUrl = 'https://music.163.com';
    this.searchUrl = 'https://music.163.com/api/search/get/web';
    this.lyricsUrl = 'https://music.163.com/api/song/lyric';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://music.163.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  // 获取插件信息
  getInfo() {
    return {
      name: '网易云音乐',
      description: '网易云音乐歌词搜索服务',
      version: '1.0.0',
      author: 'NAS Music Server'
    };
  }

  // 搜索歌词
  async searchLyrics(title, artist) {
    try {
      // 1. 搜索歌曲
      const searchKeyword = `${title} ${artist}`.trim();
      const searchData = new URLSearchParams({
        s: searchKeyword,
        type: 1,
        offset: 0,
        total: true,
        limit: 10
      });

      const searchResponse = await axios.post(this.searchUrl, searchData, {
        headers: this.headers,
        timeout: 10000
      });

      if (!searchResponse.data || !searchResponse.data.result || !searchResponse.data.result.songs) {
        console.log('网易云音乐搜索无结果');
        return null;
      }

      const songs = searchResponse.data.result.songs;
      if (songs.length === 0) {
        console.log('网易云音乐搜索无结果');
        return null;
      }

      // 2. 选择最佳匹配的歌曲
      const bestMatch = this.findBestMatch(songs, title, artist);
      if (!bestMatch) {
        console.log('网易云音乐未找到匹配的歌曲');
        return null;
      }

      // 3. 获取歌词
      const lyricsResponse = await axios.get(this.lyricsUrl, {
        params: {
          id: bestMatch.id,
          lv: -1,
          tv: -1
        },
        headers: this.headers,
        timeout: 10000
      });

      if (!lyricsResponse.data || !lyricsResponse.data.lrc) {
        console.log('网易云音乐获取歌词失败');
        return null;
      }

      const lyricsData = lyricsResponse.data;
      let lyrics = '';

      // 优先使用翻译歌词，然后是原歌词
      if (lyricsData.tlyric && lyricsData.tlyric.lyric) {
        lyrics = lyricsData.tlyric.lyric;
      } else if (lyricsData.lrc && lyricsData.lrc.lyric) {
        lyrics = lyricsData.lrc.lyric;
      }

      if (!lyrics || lyrics.trim() === '') {
        console.log('网易云音乐歌词为空');
        return null;
      }

      // 清理歌词格式（移除时间戳）
      lyrics = this.cleanLyrics(lyrics);

      return {
        title: bestMatch.name,
        artist: bestMatch.artists ? bestMatch.artists.map(a => a.name).join(', ') : '',
        album: bestMatch.album ? bestMatch.album.name : '',
        lyrics: lyrics.trim(),
        source: 'netease',
        score: this.calculateMatchScore(bestMatch, title, artist)
      };

    } catch (error) {
      console.error('网易云音乐歌词搜索失败:', error.message);
      return null;
    }
  }

  // 清理歌词格式
  cleanLyrics(lyrics) {
    // 保留时间戳，只清理多余的空行和首尾空白
    return lyrics.replace(/\n\s*\n/g, '\n').trim();
  }

  // 查找最佳匹配的歌曲
  findBestMatch(songs, title, artist) {
    let bestMatch = null;
    let bestScore = 0;

    for (const song of songs) {
      const score = this.calculateMatchScore(song, title, artist);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = song;
      }
    }

    // 只返回匹配度超过0.3的结果
    return bestScore > 0.3 ? bestMatch : null;
  }

  // 计算匹配度分数
  calculateMatchScore(song, title, artist) {
    let score = 0;
    
    // 标题匹配度
    if (song.name && title) {
      const titleSimilarity = this.calculateSimilarity(song.name.toLowerCase(), title.toLowerCase());
      score += titleSimilarity * 0.6;
    }

    // 艺术家匹配度
    if (song.artists && artist) {
      const artistNames = song.artists.map(a => a.name).join(' ').toLowerCase();
      const artistSimilarity = this.calculateSimilarity(artistNames, artist.toLowerCase());
      score += artistSimilarity * 0.4;
    }

    return score;
  }

  // 计算字符串相似度
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // 简单的编辑距离计算
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.editDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  // 编辑距离算法
  editDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }
}

export default new NeteaseLyricsPlugin();
