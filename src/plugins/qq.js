import axios from 'axios';

// QQ音乐歌词搜索插件
class QQLyricsPlugin {
  constructor() {
    this.baseUrl = 'https://c.y.qq.com';
    this.searchUrl = 'https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp';
    this.lyricsUrl = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://y.qq.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };
  }

  // 获取插件信息
  getInfo() {
    return {
      name: 'QQ音乐',
      description: 'QQ音乐歌词搜索服务',
      version: '1.0.0',
      author: 'NAS Music Server'
    };
  }

  // 搜索歌词
  async searchLyrics(title, artist) {
    try {
      // 1. 搜索歌曲
      const searchKeyword = `${title} ${artist}`.trim();
      const searchResponse = await axios.get(this.searchUrl, {
        params: {
          _: Date.now(),
          g_tk: 5381,
          uin: 0,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          platform: 'h5',
          needNewCode: 1,
          w: searchKeyword,
          zhidaqu: 1,
          catZhida: 1,
          t: 0,
          flag: 1,
          ie: 'utf-8',
          sem: 1,
          aggr: 0,
          perpage: 10,
          n: 10,
          p: 1,
          remoteplace: 'txt.mqq.all'
        },
        headers: this.headers,
        timeout: 10000
      });

      if (!searchResponse.data || !searchResponse.data.data || !searchResponse.data.data.song) {
        console.log('QQ音乐搜索无结果');
        return null;
      }

      const songs = searchResponse.data.data.song.list;
      if (!songs || songs.length === 0) {
        console.log('QQ音乐搜索无结果');
        return null;
      }

      // 2. 选择最佳匹配的歌曲
      const bestMatch = this.findBestMatch(songs, title, artist);
      if (!bestMatch) {
        console.log('QQ音乐未找到匹配的歌曲');
        return null;
      }

      // 3. 获取歌词
      const lyricsResponse = await axios.get(this.lyricsUrl, {
        params: {
          _: Date.now(),
          g_tk: 5381,
          uin: 0,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          platform: 'yqq.json',
          needNewCode: 0,
          songmid: bestMatch.songmid,
          hostUin: 0,
          loginUin: 0,
          songtype: 0,
          callback: 'callback'
        },
        headers: this.headers,
        timeout: 10000
      });

      // QQ音乐的歌词接口返回的是JSONP格式，需要解析
      let lyricsData;
      try {
        const responseText = lyricsResponse.data;
        const jsonMatch = responseText.match(/callback\((.*)\)/);
        if (jsonMatch) {
          lyricsData = JSON.parse(jsonMatch[1]);
        } else {
          console.log('QQ音乐歌词数据格式错误');
          return null;
        }
      } catch (parseError) {
        console.log('QQ音乐歌词数据解析失败');
        return null;
      }

      if (!lyricsData || !lyricsData.lyric) {
        console.log('QQ音乐获取歌词失败');
        return null;
      }

      let lyrics = lyricsData.lyric;
      if (!lyrics || lyrics.trim() === '') {
        console.log('QQ音乐歌词为空');
        return null;
      }

      // 清理歌词格式（移除时间戳）
      lyrics = this.cleanLyrics(lyrics);

      return {
        title: bestMatch.songname,
        artist: bestMatch.singer.map(s => s.name).join(', '),
        album: bestMatch.albumname || '',
        lyrics: lyrics.trim(),
        source: 'qq',
        score: this.calculateMatchScore(bestMatch, title, artist)
      };

    } catch (error) {
      console.error('QQ音乐歌词搜索失败:', error.message);
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
    if (song.songname && title) {
      const titleSimilarity = this.calculateSimilarity(song.songname.toLowerCase(), title.toLowerCase());
      score += titleSimilarity * 0.6;
    }

    // 艺术家匹配度
    if (song.singer && artist) {
      const artistNames = song.singer.map(s => s.name).join(' ').toLowerCase();
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

export default new QQLyricsPlugin();
