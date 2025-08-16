import axios from 'axios';
import crypto from 'crypto';

// 咪咕音乐歌词搜索插件
class MiguLyricsPlugin {
  constructor() {
    this.baseUrl = 'https://m.music.migu.cn/';
    this.searchUrl = 'https://m.music.migu.cn/migu/remoting/scr_search_tag';
    this.lyricsUrl = 'https://music.migu.cn/v3/api/music/audioPlayer/getLyric';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0',
      'Referer': 'https://m.music.migu.cn/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };
  }

  // 获取插件信息
  getInfo() {
    return {
      name: '咪咕音乐',
      description: '咪咕音乐歌词搜索服务',
      version: '1.0.0',
      author: 'NAS Music Server'
    };
  }

  // 计算MD5
  calculateMd5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  // 获取歌词
  async fetchLyric(copyrightId) {
    try {
      const response = await axios.get(this.lyricsUrl, {
        params: { copyrightId },
        headers: this.headers,
        timeout: 10000
      });

      if (response.data && response.data.lyric) {
        return response.data.lyric;
      }
      return '';
    } catch (error) {
      console.error('咪咕音乐获取歌词失败:', error.message);
      return '';
    }
  }

  // 搜索歌词
  async searchLyrics(title, artist) {
    try {
      // 1. 搜索歌曲
      const searchKeyword = `${title} ${artist}`.trim();
      const searchResponse = await axios.get(this.searchUrl, {
        params: {
          rows: 10,
          type: 2,
          keyword: searchKeyword,
          pgc: 1
        },
        headers: this.headers,
        timeout: 10000
      });

      if (!searchResponse.data || !searchResponse.data.musics) {
        console.log('咪咕音乐搜索无结果');
        return null;
      }

      const songs = searchResponse.data.musics;
      if (songs.length === 0) {
        console.log('咪咕音乐搜索无结果');
        return null;
      }

      // 2. 选择最佳匹配的歌曲
      const bestMatch = this.findBestMatch(songs, title, artist);
      if (!bestMatch) {
        console.log('咪咕音乐未找到匹配的歌曲');
        return null;
      }

      // 3. 获取歌词
      const lyrics = await this.fetchLyric(bestMatch.copyrightId);
      if (!lyrics || lyrics.trim() === '') {
        console.log('咪咕音乐歌词为空');
        return null;
      }

      // 清理歌词格式（移除时间戳）
      const cleanLyrics = this.cleanLyrics(lyrics);

      return {
        title: bestMatch.songName,
        artist: bestMatch.singerName,
        album: bestMatch.albumName,
        lyrics: cleanLyrics.trim(),
        source: 'migu',
        score: this.calculateMatchScore(bestMatch, title, artist),
        cover: bestMatch.cover,
        id: this.calculateMd5(`title:${bestMatch.songName};artists:${bestMatch.singerName};album:${bestMatch.albumName}`)
      };

    } catch (error) {
      console.error('咪咕音乐歌词搜索失败:', error.message);
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
    if (song.songName && title) {
      const titleSimilarity = this.calculateSimilarity(song.songName.toLowerCase(), title.toLowerCase());
      score += titleSimilarity * 0.6;
    }

    // 艺术家匹配度
    if (song.singerName && artist) {
      const artistSimilarity = this.calculateSimilarity(song.singerName.toLowerCase(), artist.toLowerCase());
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

export default new MiguLyricsPlugin();
