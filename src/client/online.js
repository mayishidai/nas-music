import { MusicBrainzApi, CoverArtArchiveApi } from 'musicbrainz-api';
import { getConfig } from './database.js';
import { tradToSimple } from 'simptrad';
import { mergeAndUnique } from '../utils/dataUtils.js';
import { normalizeSongTitle, normalizeArtistName } from '../utils/textUtils.js';
import client from './sqlite.js';
import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const config = getConfig();
const mbApi = new MusicBrainzApi({ appName: config.appName, appVersion: config.appVersion, appContactInfo: config.appContactInfo });
const coverArtApi = new CoverArtArchiveApi({ appName: config.appName, appVersion: config.appVersion, appContactInfo: config.appContactInfo });

// 生成MD5哈希
const generateMD5 = (str) => {
  return crypto.createHash('md5').update(str).digest('hex');
};

// 将搜索结果入库到online_music表
const saveOnlineMusicToDatabase = (title, artist, searchResults) => {
  try {
    for (const result of searchResults) {
      const id = generateMD5(result.musicId + result.albumId);
      const onlineMusicData = {
        id,
        query: `${title} ${artist}`,
        musicId: result.musicId,
        score: result.score,
        title: result.title,
        artist: result.artist,
        artistAliases: result.artistAliases ? JSON.stringify(result.artistAliases) : null,
        albumId: result.albumId,
        album: result.album,
        albumArtist: result.albumArtist,
        date: result.date,
        cover: result.cover,
        lyrics: result.lyrics || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      client.insertOrUpdate('online_music', onlineMusicData);
    }
    console.log(`成功保存 ${searchResults.length} 条在线音乐数据到数据库`);
  } catch (error) {
    console.error('保存在线音乐数据到数据库失败:', error);
  }
};

const getOnlineMusicFromDatabase = (title, artist) => {
  title = normalizeSongTitle(title) || ''
  artist = normalizeArtistName(artist) || ''
  return client.queryAll('online_music', { query: { operator: 'LIKE', data: `${title} ${artist}` } }).map(item => ({
    ...item,
    artistAliases: item.artistAliases ? JSON.parse(item.artistAliases) : null
  }))
}

// 根据歌曲名称和歌手名称，搜索音乐
const searchMusic = async (title, artist) => {
  title = normalizeSongTitle(title)
  artist = normalizeArtistName(artist)
  // 清理搜索关键词
  const cleanTitle = title?.trim().replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  const cleanArtist = artist?.trim().replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  
  // 构建优化的查询语句
  let query = `(title:"${title}" AND artist:"${artist}")`;
  if (cleanTitle && cleanArtist) {
      // 1. 根据歌曲名称和歌手精确匹配
      query = `OR (title:"${cleanTitle}" AND artist:"${cleanArtist}")`;
      
      // 2. 根据精确的歌曲名称和模糊的歌手匹配
      query += ` OR (title:"${cleanTitle}" AND artist:"${cleanArtist}"~)`;
      
      // 3. 根据模糊的歌曲名称和模糊的歌手匹配
      query += ` OR (title:"${cleanTitle}"~ AND artist:"${cleanArtist}"~)`;
      
      // 4. 处理歌手名称中的英文前缀，提取中文部分进行匹配
      const chineseArtist = cleanArtist.replace(/^[a-zA-Z]+/, '').trim();
      if (chineseArtist && chineseArtist !== cleanArtist) {
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtist}")`;
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtist}"~)`;
          query += ` OR (title:"${cleanTitle}"~ AND artist:"${chineseArtist}"~)`;
      }
      
      // 5. 处理歌手名称中的英文后缀，提取中文部分进行匹配
      const chineseArtistSuffix = cleanArtist.replace(/[a-zA-Z]+$/, '').trim();
      if (chineseArtistSuffix && chineseArtistSuffix !== cleanArtist && chineseArtistSuffix !== chineseArtist) {
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtistSuffix}")`;
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtistSuffix}"~)`;
          query += ` OR (title:"${cleanTitle}"~ AND artist:"${chineseArtistSuffix}"~)`;
      }
  } else if (cleanTitle) {
      query = `title:"${cleanTitle}" OR title:"${cleanTitle}"~`;
  } else if (cleanArtist) {
      query = `artist:"${cleanArtist}" OR artist:"${cleanArtist}"~`;
      
      // 处理歌手名称中的英文前缀和后缀
      const chineseArtist = cleanArtist.replace(/^[a-zA-Z]+/, '').trim();
      if (chineseArtist && chineseArtist !== cleanArtist) {
          query += ` OR artist:"${chineseArtist}" OR artist:"${chineseArtist}"~`;
      }
      
      const chineseArtistSuffix = cleanArtist.replace(/[a-zA-Z]+$/, '').trim();
      if (chineseArtistSuffix && chineseArtistSuffix !== cleanArtist && chineseArtistSuffix !== chineseArtist) {
          query += ` OR artist:"${chineseArtistSuffix}" OR artist:"${chineseArtistSuffix}"~`;
      }
  }
  const recordings = await mbApi.search('recording', { query, limit: 20 }).then(res => res.recordings);
  const data = recordings.map(recording=>{
      const artist_credit = recording['artist-credit'].find(a => a);
      const data = {
        id: recording.id,
        score: recording.score,
        title: tradToSimple(recording.title),
        artist: tradToSimple(artist_credit.artist.name),
        artistAliases: artist_credit.artist.aliases?.map(alias => alias.name),
        date: recording.date,
        albums: recording['releases']?.map(release => {
          return {
            albumId: release.id,
            title: tradToSimple(release.title),
            artist: tradToSimple(release['artist-credit']?.find(a => a).artist.name),
            date: release.date,
            cover: `http://coverartarchive.org/release/${release.id}/front`,
          }
        })
      }
      data.albums = mergeAndUnique(data.albums, ['title'])
      return data
  })
  const result = []
  for (const item of data) {
    for (const album of item.albums) {
      result.push({
        musicId: item.id,
        score: item.score,
        title: item.title,
        artist: item.artist,
        artistAliases: item.artistAliases,
        albumId: album.albumId,
        album: album.title,
        albumArtist: album.artist,
        date: album.date,
        cover: album.cover
      })
    }
  }
  const finalResults = result.sort((a, b) => b.score - a.score);
  saveOnlineMusicToDatabase(title, artist, finalResults);
  return finalResults;
}

const getAlbumCover = async (albumId) => {
  return await coverArtApi.getReleaseCover(albumId, 'front').then(res => res.url)
}

export default {
  searchMusic,
  getAlbumCover,
  getOnlineMusicFromDatabase,
};
