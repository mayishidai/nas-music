import axios from 'axios';
import { tradToSimple } from 'simptrad';
import { mergeAndUnique } from '../utils/dataUtils.js';
import { normalizeSongTitle, normalizeArtistName } from '../utils/textUtils.js';
import client from './sqlite.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const getAPI = async (url) => {
  const baseURL = 'https://musicbrainz.org/ws/2'
  try {
    const res = await axios.get(`${baseURL}${url}`, { headers: { 'Content-Type': 'application/json' } }).then(res=>res.data)
    return res
  } catch (error) {
    throw new Error(`URL [${baseURL}${url}]` + ": " + (error?.response?.data?.error || error?.message || '获取API数据失败'))
  }
}

// 将搜索结果入库到online_music表
const saveOnlineMusicToDatabase = (datas) => {
  try {
    for (const result of datas) {
      const id = client.util.md5(result.musicId + result.albumId);
      const onlineMusicData = {
        id,
        musicId: result.musicId,
        title: result.title,
        artist: result.artist,
        artists: result.artists ? JSON.stringify(result.artists) : null,
        albumId: result.albumId,
        album_title: result.album_title,
        album_artist: result.album_artist,
        album_artists: result.album_artists ? JSON.stringify(result.album_artists) : null,
        date: result.date,
        cover: result.cover,
        lyrics: result.lyrics || null
      };
      client.insertOrUpdate('online_music', onlineMusicData);
    }
  } catch (error) {
    console.error('保存在线音乐数据到数据库失败:', error);
  }
};

const queryMusicFromDatabase = (title, artist) => {
  title = normalizeSongTitle(title) || ''
  artist = normalizeArtistName(artist) || ''
  const query = {
    query: {
      operator: 'SQL',
      condition: `title LIKE @title AND artist LIKE @artist`,
      params: {
        query: `${title} ${artist}`,
        title: title,
        artist: artist
      }
    }
  }
  return client.queryAll('online_music', query).map(item => ({
    ...item,
    artists: item.artists ? JSON.parse(item.artists) : null,
    album_artists: item.album_artists ? JSON.parse(item.album_artists) : null
  })).sort((a, b) => b.score - a.score)
}

// 根据歌曲名称和歌手名称，搜索音乐
const queryMusic = async (title, artist) => {
  title = normalizeSongTitle(title) || ''
  artist = normalizeArtistName(artist) || ''
  const cleanTitle = title?.trim().replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  const cleanArtist = artist?.trim().replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  let query = `(title:"${title}" AND artist:"${artist}")`;
  if (cleanTitle && cleanArtist) {
      query = `OR (title:"${cleanTitle}" AND artist:"${cleanArtist}")`;
      query += ` OR (title:"${cleanTitle}" AND artist:"${cleanArtist}"~)`;
      query += ` OR (title:"${cleanTitle}"~ AND artist:"${cleanArtist}"~)`;
      const chineseArtist = cleanArtist.replace(/^[a-zA-Z]+/, '').trim();
      if (chineseArtist && chineseArtist !== cleanArtist) {
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtist}")`;
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtist}"~)`;
          query += ` OR (title:"${cleanTitle}"~ AND artist:"${chineseArtist}"~)`;
      }
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
      const chineseArtist = cleanArtist.replace(/^[a-zA-Z]+/, '').trim();
      if (chineseArtist && chineseArtist !== cleanArtist) {
          query += ` OR artist:"${chineseArtist}" OR artist:"${chineseArtist}"~`;
      }
      const chineseArtistSuffix = cleanArtist.replace(/[a-zA-Z]+$/, '').trim();
      if (chineseArtistSuffix && chineseArtistSuffix !== cleanArtist && chineseArtistSuffix !== chineseArtist) {
          query += ` OR artist:"${chineseArtistSuffix}" OR artist:"${chineseArtistSuffix}"~`;
      }
  }
  const recordings = await getAPI(`/recording?query=${query}&limit=20&fmt=json`).then(res => res.recordings)
  const data = recordings.map(recording=>{
      const artists = recording['artist-credit'].map(a => tradToSimple(a.name))
      const data = {
        id: recording.id,
        score: recording.score,
        title: tradToSimple(recording.title),
        artist: artists.join(','),
        artists: artists,
        date: recording.date,
        albums: recording['releases']?.map(release => {
          const artists = release['artist-credit']?.map(a => tradToSimple(a.name)) || []
          return {
            albumId: release.id,
            title: tradToSimple(release.title),
            artist: artists.join(','),
            artists: artists,
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
        artists: item.artists,
        albumId: album.albumId,
        album_title: album.title,
        album_artist: album.artist,
        album_artists: album.artists,
        date: album.date,
        cover: album.cover
      })
    }
  }
  const finalResults = result.sort((a, b) => b.score - a.score);
  saveOnlineMusicToDatabase(finalResults);
  return finalResults;
}

const queryAlbum = async (title, artist) => {
  title = normalizeSongTitle(title) || ''
  artist = normalizeArtistName(artist) || ''
  const cleanTitle = title?.trim().replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  const cleanArtist = artist?.trim().replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  let query = `(title:"${title}" AND artist:"${artist}")`;
  if (cleanTitle && cleanArtist) {
      query = `OR (title:"${cleanTitle}" AND artist:"${cleanArtist}")`;
      query += ` OR (title:"${cleanTitle}" AND artist:"${cleanArtist}"~)`;
      query += ` OR (title:"${cleanTitle}"~ AND artist:"${cleanArtist}"~)`;
      const chineseArtist = cleanArtist.replace(/^[a-zA-Z]+/, '').trim();
      if (chineseArtist && chineseArtist !== cleanArtist) {
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtist}")`;
          query += ` OR (title:"${cleanTitle}" AND artist:"${chineseArtist}"~)`;
          query += ` OR (title:"${cleanTitle}"~ AND artist:"${chineseArtist}"~)`;
      }
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
      const chineseArtist = cleanArtist.replace(/^[a-zA-Z]+/, '').trim();
      if (chineseArtist && chineseArtist !== cleanArtist) {
          query += ` OR artist:"${chineseArtist}" OR artist:"${chineseArtist}"~`;
      }
      const chineseArtistSuffix = cleanArtist.replace(/[a-zA-Z]+$/, '').trim();
      if (chineseArtistSuffix && chineseArtistSuffix !== cleanArtist && chineseArtistSuffix !== chineseArtist) {
          query += ` OR artist:"${chineseArtistSuffix}" OR artist:"${chineseArtistSuffix}"~`;
      }
  }
  const albums = await getAPI(`/release?query=${query}&limit=20&fmt=json`).then(res => res.releases)
  const result = albums.map(album =>{
    const artists = album['artist-credit']?.map(a => tradToSimple(a.name))
    return {
      id: album.id,
      score: album.score,
      title: tradToSimple(album.title),
      artists: artists,
      artist: artists.join(','),
      track_count: album['track-count'],
      date: album.date,
      cover: `http://coverartarchive.org/release/${album.id}/front`,
    }
  })
  return result.sort((a, b) => b.score - a.score)
}

// 获取音乐信息
const getMusic = (musicId) => getAPI(`/recording/${musicId}?fmt=json&inc=artists+releases`)
// 获取专辑信息
const getAlbum = async (albumId) => {
  const album = await getAPI(`/release/${albumId}?inc=artists+recordings+media`)
  if(!album) return null
  const medias = album.media?.map(m=>m.tracks).flat()
  const artists = album['artist-credit']?.map(a => tradToSimple(a.name))
  const result = {
    id: album.id,
    title: tradToSimple(album.title),
    date: album.date,
    cover: `http://coverartarchive.org/release/${album.id}/front`,
    artists: artists,
    artist: artists.join(','),
    media: medias.map(m => {
      const artists = m['artist-credit']?.map(a => tradToSimple(a.name))
      return {
        id: m.id,
        title: tradToSimple(m.title),
        artists: artists,
        artist: artists.join(','),
      }
    })
  }
  const finalResult = []
  for (const track of result.media) {
    finalResult.push({
      id: client.util.md5(track.id + result.id),
      musicId: track.id,
      title: tradToSimple(track.title),
      artists: track.artists || [],
      artist: track.artists?.join(','),
      albumId: result.id,
      album_title: result.title,
      album_artist: result.artists?.join(','),
      album_artists: result.artists || [],
      date: result.date,
      cover: result.cover,
    })
  }
  saveOnlineMusicToDatabase(finalResult);
  return result
}

// 获取歌手信息
const getArtist = (artistId) => getAPI(`/artist/${artistId}?inc=releases`)

export default {
  queryMusic,
  queryAlbum,
  getMusic,
  getAlbum,
  getArtist,
  queryMusicFromDatabase,
};