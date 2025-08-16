import axios from 'axios';
import crypto from 'crypto';

// 酷狗音乐歌词搜索插件
class KugouLyricsPlugin {
  constructor() {
    this.baseUrl = 'https://www.kugou.com';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };
  }

  // 获取插件信息
  getInfo() {
    return {
      name: '酷狗音乐',
      description: '酷狗音乐歌词搜索服务',
      version: '1.0.0',
      author: 'NAS Music Server'
    };
  }

  // 生成随机字符串
  generateRandomString(length, charset = 'abcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  // 计算MD5
  calculateMd5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  // 获取封面图片
  async getCover(hash, albumId) {
    try {
      const dfid = this.generateRandomString(23, 'abcdefghijklmnopqrstuvwxyz0123456789');
      const mid = this.generateRandomString(23, 'abcdefghijklmnopqrstuvwxyz0123456789');
      const timestamp = Date.now();

      const response = await axios.get('https://wwwapi.kugou.com/yy/index.php', {
        params: {
          r: 'play/getdata',
          hash: hash,
          dfid: dfid,
          mid: mid,
          album_id: albumId,
          _: timestamp
        },
        headers: this.headers,
        timeout: 10000
      });

      if (response.data && response.data.data && response.data.data.img) {
        return response.data.data.img;
      }
      return '';
    } catch (error) {
      console.error('酷狗音乐获取封面失败:', error.message);
      return '';
    }
  }

  // 搜索歌词
  async searchLyrics(title, artist) {
    try {
      // 构建搜索关键词
      const searchTerms = [title, artist].filter(item => item && item.trim());
      if (searchTerms.length === 0) {
        console.log('酷狗音乐搜索关键词为空');
        return null;
      }

      const searchKeyword = searchTerms.join(' ');
      const limit = 3;
      const resultList = [];

      // 1. 搜索歌曲
      const searchResponse = await axios.get('http://mobilecdn.kugou.com/api/v3/search/song', {
        params: {
          format: 'json',
          keyword: searchKeyword,
          page: 1,
          pagesize: 10,
          showtype: 1
        },
        headers: this.headers,
        timeout: 10000
      });

      if (!searchResponse.data || !searchResponse.data.data || !searchResponse.data.data.info) {
        console.log('酷狗音乐搜索无结果');
        return null;
      }

      const songs = searchResponse.data.data.info;
      if (songs.length === 0) {
        console.log('酷狗音乐搜索无结果');
        return null;
      }

      // 2. 处理每个搜索结果
      for (const songItem of songs) {
        const songName = songItem.songname;
        const singerName = songItem.singername || '';
        const songHash = songItem.hash;
        const albumId = songItem.album_id;
        const albumName = songItem.album_name || '';

        // 计算匹配度
        const titleConformRatio = this.calculateSimilarity(title.toLowerCase(), songName.toLowerCase());
        const artistConformRatio = this.calculateSimilarity(artist.toLowerCase(), singerName.toLowerCase());
        const ratio = Math.pow(titleConformRatio * (artistConformRatio + 1) / 2, 0.5);

        // 只处理匹配度超过0.2的结果
        if (ratio >= 0.2) {
          try {
            // 3. 获取歌词候选列表
            const lyricsCandidatesResponse = await axios.get('https://krcs.kugou.com/search', {
              params: {
                ver: 1,
                man: 'yes',
                client: 'mobi',
                keyword: '',
                duration: '',
                hash: songHash,
                album_audio_id: ''
              },
              headers: this.headers,
              timeout: 10000
            });

            if (!lyricsCandidatesResponse.data || !lyricsCandidatesResponse.data.candidates || lyricsCandidatesResponse.data.candidates.length === 0) {
              continue;
            }

            const candidate = lyricsCandidatesResponse.data.candidates[0];
            const lyricsId = candidate.id;
            const lyricsKey = candidate.accesskey;

            // 4. 获取歌词内容
            const lyricsResponse = await axios.get('http://lyrics.kugou.com/download', {
              params: {
                ver: 1,
                client: 'pc',
                id: lyricsId,
                accesskey: lyricsKey,
                fmt: 'lrc',
                charset: 'utf8'
              },
              headers: this.headers,
              timeout: 10000
            });

            if (!lyricsResponse.data || !lyricsResponse.data.content) {
              continue;
            }

            // 解码Base64歌词内容
            const lyricsEncoded = lyricsResponse.data.content;
            const lyrics = Buffer.from(lyricsEncoded, 'base64').toString('utf-8');

            if (!lyrics || lyrics.trim() === '') {
              continue;
            }

            // 清理歌词格式
            const cleanLyrics = this.cleanLyrics(lyrics);

            // 5. 获取封面图片
            const cover = await this.getCover(songHash, albumId);

            // 构建结果数据
            const musicJsonData = {
              title: songName,
              album: albumName,
              artist: singerName,
              lyrics: cleanLyrics.trim(),
              cover: cover,
              id: this.calculateMd5(`title:${songName};artists:${singerName};album:${albumName}`)
            };

            resultList.push({
              data: musicJsonData,
              ratio: ratio
            });

            // 限制结果数量
            if (resultList.length >= limit) {
              break;
            }

          } catch (error) {
            console.error('酷狗音乐处理歌曲失败:', error.message);
            continue;
          }
        }
      }

      // 按匹配度排序并返回最佳结果
      if (resultList.length > 0) {
        resultList.sort((a, b) => b.ratio - a.ratio);
        const bestResult = resultList[0].data;
        return {
          ...bestResult,
          source: 'kugou',
          score: resultList[0].ratio
        };
      }

      console.log('酷狗音乐未找到匹配的歌词');
      return null;

    } catch (error) {
      console.error('酷狗音乐歌词搜索失败:', error.message);
      return null;
    }
  }

  // 清理歌词格式
  cleanLyrics(lyrics) {
    // 保留时间戳，只清理多余的空行和首尾空白
    return lyrics.replace(/\n\s*\n/g, '\n').trim();
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

export default new KugouLyricsPlugin();
