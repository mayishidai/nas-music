import axios from 'axios';
import { tradToSimple as toSimplified } from 'simptrad';
import { MusicBrainzApi } from 'musicbrainz-api';
import { getConfig, findTrackById, updateTrack, upsertTrackByPath, searchTracks } from './database.js';
import { normalizeSongTitle, normalizeArtistName, normalizeText, stripDecorations, splitArtistTitle, getBaseNameFromPath } from '../utils/textUtils.js';
import { calculateSimilarity, titleSimilarity, artistSimilarity, yearSimilaritySimple, durationSimilaritySimple, similarity } from '../utils/similarityUtils.js';
import { tryFixEncoding } from '../utils/encodingUtils.js';
import { deduplicateResults,mergeAndDedupe, buildResult } from '../utils/dataUtils.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 从 MusicBrainz 搜索歌曲信息
async function searchMusicBrainz(title, artist, userAgent) {
  try {
    let appName = 'NAS-Music-Server';
    let appVersion = '1.0.0';
    const m = userAgent?.match(/^([^\/]+)\/(.+)$/);
    if (m) { appName = m[1]; appVersion = m[2]; }
    
    const mb = new MusicBrainzApi({ appName, appVersion });
    
    // 构建搜索查询
    let query = `recording:"${title}"`;
    if (artist) {
      query += ` AND artist:"${artist}"`;
    }
    
    const result = await mb.search('recording', { query }, 0, 20);
    const recordings = result?.recordings || [];
    
    return recordings.map(recording => {
      const release = Array.isArray(recording.releases) ? recording.releases[0] : null;
      const artistName = recording['artist-credit']?.[0]?.name || '';
      
      return {
        title: recording.title || '',
        artist: artistName,
        album: release?.title || '',
        year: (release?.date || '').slice(0, 4) || null,
        duration: recording.length ? Math.round(recording.length / 1000) : null,
        source: 'musicbrainz',
        sourceId: recording.id,
        confidence: 0
      };
    });
  } catch (error) {
    console.warn('MusicBrainz 搜索失败:', error);
    return [];
  }
}

// 从 Last.fm 搜索歌曲信息
async function searchLastfm(title, artist, apiKey) {
  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.search',
        track: title,
        artist: artist || '',
        api_key: apiKey,
        format: 'json',
        limit: 20
      },
      timeout: 8000
    });
    
    const tracks = response.data?.results?.trackmatches?.track || [];
    
    return tracks.map(track => ({
      title: track.name || '',
      artist: track.artist || '',
      album: '',
      year: null,
      duration: null,
      coverImage: Array.isArray(track.image) ? (track.image[3]?.['#text'] || track.image[2]?.['#text'] || null) : null,
      source: 'lastfm',
      sourceId: track.mbid || null,
      confidence: 0
    }));
  } catch (error) {
    console.warn('Last.fm 搜索失败:', error);
    return [];
  }
}

// 计算匹配度分数
function calculateMatchScore(result, originalTitle, originalArtist, originalDuration, originalYear) {
  let score = 0;
  
  // 标题匹配度 (权重: 0.4)
  const titleSimilarity = calculateSimilarity(result.title, originalTitle);
  score += titleSimilarity * 0.4;
  
  // 歌手匹配度 (权重: 0.3)
  const artistSimilarity = calculateSimilarity(result.artist, originalArtist);
  score += artistSimilarity * 0.3;
  
  // 时长匹配度 (权重: 0.2)
  if (result.duration && originalDuration) {
    const durationDiff = Math.abs(result.duration - originalDuration);
    if (durationDiff <= 2) score += 0.2;
    else if (durationDiff <= 5) score += 0.15;
    else if (durationDiff <= 10) score += 0.1;
    else if (durationDiff <= 20) score += 0.05;
  }
  
  // 年份匹配度 (权重: 0.1)
  if (result.year && originalYear) {
    const yearDiff = Math.abs(result.year - originalYear);
    if (yearDiff <= 1) score += 0.1;
    else if (yearDiff <= 2) score += 0.07;
    else if (yearDiff <= 5) score += 0.03;
  }
  
  // 数据源权重调整
  if (result.source === 'musicbrainz') {
    score *= 1.1; // MusicBrainz 数据更权威
  }
  
  return Math.round(score * 100) / 100; // 保留两位小数
}



// 主搜索函数
export async function searchSongInfo(metadata) {
  try {
    const {
      title: originalTitle,
      artist: originalArtist,
      album: originalAlbum,
      duration: originalDuration,
      year: originalYear
    } = metadata;
    
    // 格式化歌曲名称和歌手名称
    const normalizedTitle = await toSimplified(normalizeSongTitle(originalTitle));
    const normalizedArtist = await toSimplified(normalizeArtistName(originalArtist));
    
    if (!normalizedTitle) {
      throw new Error('无法获取有效的歌曲名称');
    }
    
    console.log(`搜索歌曲: "${normalizedTitle}" (歌手: "${normalizedArtist}")`);
    
    // 获取配置
    const config = await getConfig();
    const results = [];
    
    // 从 MusicBrainz 搜索
    try {
      if (config.enableMusicbrainz) {
        const mbResults = await searchMusicBrainz(normalizedTitle, normalizedArtist, config.musicbrainzUserAgent);
        results.push(...mbResults);
      }
    } catch (error) {
      console.warn('MusicBrainz 搜索失败:', error);
    }
    
    // 从 Last.fm 搜索
    try {
      if (config.enableLastfm && config.lastfmApiKey) {
        const lfResults = await searchLastfm(normalizedTitle, normalizedArtist, config.lastfmApiKey);
        results.push(...lfResults);
      }
    } catch (error) {
      console.warn('Last.fm 搜索失败:', error);
    }
    
    if (results.length === 0) {
      return {
        success: false,
        message: '未找到匹配的歌曲信息',
        data: []
      };
    }
    
    // 计算匹配度分数
    const scoredResults = results.map(result => ({
      ...result,
      confidence: calculateMatchScore(
        result,
        normalizedTitle,
        normalizedArtist,
        originalDuration,
        originalYear
      )
    }));
    
    // 去重
    const uniqueResults = deduplicateResults(scoredResults);
    
    // 按置信度排序并返回前10个
    const topResults = uniqueResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    
    return {
      success: true,
      data: topResults,
      searchInfo: {
        originalTitle,
        originalArtist,
        normalizedTitle,
        normalizedArtist,
        totalResults: results.length,
        uniqueResults: uniqueResults.length
      }
    };
    
  } catch (error) {
    console.error('搜索歌曲信息失败:', error);
    return {
      success: false,
      message: error.message || '搜索歌曲信息失败',
      data: []
    };
  }
}

// 批量搜索歌曲信息
export async function batchSearchSongInfo(metadataList) {
  try {
    const results = [];
    const errors = [];
    
    for (const metadata of metadataList) {
      try {
        const result = await searchSongInfo(metadata);
        results.push({
          originalMetadata: metadata,
          searchResult: result
        });
      } catch (error) {
        errors.push({
          originalMetadata: metadata,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      data: {
        results,
        errors,
        total: metadataList.length,
        success: results.length,
        failed: errors.length
      }
    };
  } catch (error) {
    console.error('批量搜索歌曲信息失败:', error);
    return {
      success: false,
      message: error.message || '批量搜索歌曲信息失败',
      data: []
    };
  }
}

// ========== 歌手信息搜索相关函数 ==========

// 在线检索歌手信息
export async function searchArtistInfo(artistName) {
  try {
    const normalizedName = await normalizeText(artistName);
    if (!normalizedName) return null;
    
    const results = [];
    
    // 1. 从 Last.fm 获取歌手信息
    try {
      const config = await getConfig();
      if (config.enableLastfm && config.lastfmApiKey) {
        const lastfmResult = await searchLastfmArtist(normalizedName, config.lastfmApiKey);
        if (lastfmResult) results.push(lastfmResult);
      }
    } catch (error) {
      console.warn('Last.fm 歌手搜索失败:', error);
    }
    
    // 2. 从 MusicBrainz 获取歌手信息
    try {
      const config = await getConfig();
      const mbResult = await searchMusicBrainzArtist(normalizedName, config.musicbrainzUserAgent);
      if (mbResult) results.push(mbResult);
    } catch (error) {
      console.warn('MusicBrainz 歌手搜索失败:', error);
    }
    
    // 合并结果并保存到数据库
    if (results.length > 0) {
      const mergedInfo = mergeArtistInfo(results);
      await saveArtistInfo(mergedInfo);
      return mergedInfo;
    }
    
    return null;
  } catch (error) {
    console.error('搜索歌手信息失败:', error);
    return null;
  }
}

// Last.fm 歌手搜索
async function searchLastfmArtist(artistName, apiKey) {
  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'artist.search',
        artist: artistName,
        api_key: apiKey,
        format: 'json',
        limit: 1
      },
      timeout: 8000
    });
    
    const artist = response.data?.results?.artistmatches?.artist?.[0];
    if (!artist) return null;
    
    // 获取详细信息
    const detailResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'artist.getinfo',
        artist: artist.name,
        api_key: apiKey,
        format: 'json'
      },
      timeout: 8000
    });
    
    const detail = detailResponse.data?.artist;
    if (!detail) return null;
    
    return {
      name: detail.name,
      pinyin: '', // Last.fm 不提供拼音
      bio: detail.bio?.summary || '',
      image: detail.image?.[detail.image.length - 1]?.['#text'] || null,
      source: 'lastfm',
      confidence: 0.8
    };
  } catch (error) {
    console.warn('Last.fm 歌手搜索失败:', error);
    return null;
  }
}

// MusicBrainz 歌手搜索
async function searchMusicBrainzArtist(artistName, userAgent) {
  try {
    let appName = 'NAS-Music-Server';
    let appVersion = '1.0.0';
    const m = userAgent?.match(/^([^\/]+)\/(.+)$/);
    if (m) { appName = m[1]; appVersion = m[2]; }
    
    const mb = new MusicBrainzApi({ appName, appVersion });
    const result = await mb.search('artist', { query: `artist:"${artistName}"` }, 0, 1);
    
    const artist = result?.artists?.[0];
    if (!artist) return null;
    
    return {
      name: artist.name,
      pinyin: '', // MusicBrainz 不提供拼音
      bio: artist.disambiguation || '',
      image: null, // MusicBrainz 不直接提供图片
      source: 'musicbrainz',
      confidence: 0.7
    };
  } catch (error) {
    console.warn('MusicBrainz 歌手搜索失败:', error);
    return null;
  }
}

// 合并歌手信息
function mergeArtistInfo(results) {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];
  
  // 按置信度排序
  results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  
  const best = results[0];
  const merged = { ...best };
  
  // 合并其他来源的信息
  for (let i = 1; i < results.length; i++) {
    const current = results[i];
    
    // 合并简介（取最长的）
    if (current.bio && current.bio.length > (merged.bio?.length || 0)) {
      merged.bio = current.bio;
    }
    
    // 合并图片（优先有图片的）
    if (current.image && !merged.image) {
      merged.image = current.image;
    }
    
    // 合并拼音（优先有拼音的）
    if (current.pinyin && !merged.pinyin) {
      merged.pinyin = current.pinyin;
    }
  }
  
  return merged;
}

// 保存歌手信息到数据库
async function saveArtistInfo(artistInfo) {
  try {
    const artistId = `artist_${artistInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // 构建歌手文档
    const artistDoc = {
      id: artistId,
      type: 'artist',
      title: artistInfo.name,
      artist: artistInfo.name,
      album: '',
      albumArtist: artistInfo.name,
      genre: '',
      year: null,
      trackNumber: null,
      totalTracks: null,
      discNumber: null,
      totalDiscs: null,
      duration: null,
      bitrate: null,
      sampleRate: null,
      channels: null,
      path: '',
      filename: artistInfo.name,
      size: 0,
      favorite: 0,
      playCount: 0,
      lastPlayed: null,
      coverImage: artistInfo.image,
      lyrics: artistInfo.bio
    };
    
    // 检查是否已存在
    const existing = await findTrackById(artistId);
    
    if (existing) {
      // 更新现有记录
      await updateTrack(artistId, {
        title: artistInfo.name,
        artist: artistInfo.name,
        albumArtist: artistInfo.name,
        coverImage: artistInfo.image,
        lyrics: artistInfo.bio
      });
    } else {
      // 插入新记录 - 为艺术家创建一个虚拟路径
      artistDoc.path = `artist://${artistInfo.name}`;
      await upsertTrackByPath(artistDoc);
    }
    
    console.log(`歌手信息已保存: ${artistInfo.name}`);
  } catch (error) {
    console.error('保存歌手信息失败:', error);
  }
}

// 歌手信息匹配
export async function matchArtists(artistNames) {
  try {
    if (!artistNames) return [];
    
    // 分割歌手名称
    const separators = ['/', '、', ',', '，', '&', '&amp;', 'feat.', 'feat', 'ft.', 'ft'];
    let names = [artistNames];
    
    for (const separator of separators) {
      const newNames = [];
      for (const name of names) {
        newNames.push(...name.split(separator).map(n => n.trim()).filter(n => n));
      }
      names = newNames;
    }
    
    // 去重
    names = [...new Set(names)];
    
    const results = [];
    
    // 为每个歌手名称搜索匹配
    for (const name of names) {
      const normalizedName = await normalizeText(name);
      if (!normalizedName) continue;
      
      const matches = await searchArtistMatches(normalizedName);
      if (matches.length > 0) {
        results.push(matches);
      }
    }
    
    return results;
  } catch (error) {
    console.error('歌手匹配失败:', error);
    return [];
  }
}

// 搜索歌手匹配
async function searchArtistMatches(artistName) {
  try {
    // 从数据库中搜索
    const tracks = await searchTracks(artistName, 50);
    
    // 提取所有艺术家名称
    const artistSet = new Set();
    tracks.forEach(track => {
      if (track.artist && track.artist.trim()) {
        artistSet.add(track.artist.trim());
      }
    });
    
    const matches = Array.from(artistSet);
    
    // 计算相似度并排序
    const scoredMatches = matches.map(match => ({
      name: match,
      score: calculateSimilarity(artistName, match)
    }));
    
    scoredMatches.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // 返回相似度较高的匹配
    return scoredMatches
      .filter(match => match.score > 0.3)
      .map(match => match.name);
      
  } catch (error) {
    console.error('搜索歌手匹配失败:', error);
    return [];
  }
}



// ========== 在线获取接口 ==========

// 在线获取歌曲封面
export async function fetchOnlineSongCover(title, artist) {
  try {
    const config = await getConfig();
    const results = [];
    
    // 从 Last.fm 获取歌曲封面
    if (config.enableLastfm && config.lastfmApiKey) {
      try {
        const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
          params: {
            method: 'track.search',
            track: title,
            artist: artist || '',
            api_key: config.lastfmApiKey,
            format: 'json',
            limit: 1
          },
          timeout: 8000
        });
        
        const track = response.data?.results?.trackmatches?.track?.[0];
        if (track && Array.isArray(track.image)) {
          const coverUrl = track.image[3]?.['#text'] || track.image[2]?.['#text'] || null;
          if (coverUrl) {
            results.push({
              source: 'lastfm',
              url: coverUrl,
              confidence: 0.8
            });
          }
        }
      } catch (error) {
        console.warn('Last.fm 歌曲封面获取失败:', error);
      }
    }
    
    // 从 MusicBrainz 获取歌曲封面
    if (config.enableMusicbrainz) {
      try {
        let appName = 'NAS-Music-Server';
        let appVersion = '1.0.0';
        const m = config.musicbrainzUserAgent?.match(/^([^\/]+)\/(.+)$/);
        if (m) { appName = m[1]; appVersion = m[2]; }
        
        const mb = new MusicBrainzApi({ appName, appVersion });
        
        let query = `recording:"${title}"`;
        if (artist) {
          query += ` AND artist:"${artist}"`;
        }
        
        const result = await mb.search('recording', { query }, 0, 1);
        const recording = result?.recordings?.[0];
        
        if (recording && recording.releases && recording.releases.length > 0) {
          const release = recording.releases[0];
          const coverUrl = await fetchCoverArtArchive(release.id);
          if (coverUrl) {
            results.push({
              source: 'musicbrainz',
              url: coverUrl,
              confidence: 0.9
            });
          }
        }
      } catch (error) {
        console.warn('MusicBrainz 歌曲封面获取失败:', error);
      }
    }
    
    // 返回最佳结果
    if (results.length > 0) {
      results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      return {
        success: true,
        data: results[0]
      };
    }
    
    return {
      success: false,
      message: '未找到歌曲封面',
      data: null
    };
    
  } catch (error) {
    console.error('获取歌曲封面失败:', error);
    return {
      success: false,
      message: error.message || '获取歌曲封面失败',
      data: null
    };
  }
}

// 在线获取专辑封面
export async function fetchOnlineAlbumCover(album, artist) {
  try {
    const config = await getConfig();
    const results = [];
    
    // 从 Last.fm 获取专辑封面
    if (config.enableLastfm && config.lastfmApiKey) {
      try {
        const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
          params: {
            method: 'album.search',
            album: album,
            artist: artist || '',
            api_key: config.lastfmApiKey,
            format: 'json',
            limit: 1
          },
          timeout: 8000
        });
        
        const albumResult = response.data?.results?.albummatches?.album?.[0];
        if (albumResult && Array.isArray(albumResult.image)) {
          const coverUrl = albumResult.image[3]?.['#text'] || albumResult.image[2]?.['#text'] || null;
          if (coverUrl) {
            results.push({
              source: 'lastfm',
              url: coverUrl,
              confidence: 0.8
            });
          }
        }
      } catch (error) {
        console.warn('Last.fm 专辑封面获取失败:', error);
      }
    }
    
    // 从 MusicBrainz 获取专辑封面
    if (config.enableMusicbrainz) {
      try {
        let appName = 'NAS-Music-Server';
        let appVersion = '1.0.0';
        const m = config.musicbrainzUserAgent?.match(/^([^\/]+)\/(.+)$/);
        if (m) { appName = m[1]; appVersion = m[2]; }
        
        const mb = new MusicBrainzApi({ appName, appVersion });
        
        let query = `release:"${album}"`;
        if (artist) {
          query += ` AND artist:"${artist}"`;
        }
        
        const result = await mb.search('release', { query }, 0, 1);
        const release = result?.releases?.[0];
        
        if (release) {
          const coverUrl = await fetchCoverArtArchive(release.id);
          if (coverUrl) {
            results.push({
              source: 'musicbrainz',
              url: coverUrl,
              confidence: 0.9
            });
          }
        }
      } catch (error) {
        console.warn('MusicBrainz 专辑封面获取失败:', error);
      }
    }
    
    // 返回最佳结果
    if (results.length > 0) {
      results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      return {
        success: true,
        data: results[0]
      };
    }
    
    return {
      success: false,
      message: '未找到专辑封面',
      data: null
    };
    
  } catch (error) {
    console.error('获取专辑封面失败:', error);
    return {
      success: false,
      message: error.message || '获取专辑封面失败',
      data: null
    };
  }
}

// 在线获取专辑信息
export async function fetchOnlineAlbumInfo(album, artist) {
  try {
    const config = await getConfig();
    const results = [];
    
    // 从 Last.fm 获取专辑信息
    if (config.enableLastfm && config.lastfmApiKey) {
      try {
        const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
          params: {
            method: 'album.getinfo',
            album: album,
            artist: artist || '',
            api_key: config.lastfmApiKey,
            format: 'json'
          },
          timeout: 8000
        });
        
        const albumInfo = response.data?.album;
        if (albumInfo) {
          results.push({
            title: albumInfo.name,
            artist: albumInfo.artist,
            year: albumInfo.wiki?.published ? new Date(albumInfo.wiki.published).getFullYear() : null,
            genre: albumInfo.tags?.tag?.[0]?.name || '',
            description: albumInfo.wiki?.summary || '',
            coverImage: albumInfo.image?.[albumInfo.image.length - 1]?.['#text'] || null,
            tracks: albumInfo.tracks?.track?.map(track => ({
              title: track.name,
              duration: track.duration,
              artist: track.artist?.name || albumInfo.artist
            })) || [],
            source: 'lastfm',
            confidence: 0.8
          });
        }
      } catch (error) {
        console.warn('Last.fm 专辑信息获取失败:', error);
      }
    }
    
    // 从 MusicBrainz 获取专辑信息
    if (config.enableMusicbrainz) {
      try {
        let appName = 'NAS-Music-Server';
        let appVersion = '1.0.0';
        const m = config.musicbrainzUserAgent?.match(/^([^\/]+)\/(.+)$/);
        if (m) { appName = m[1]; appVersion = m[2]; }
        
        const mb = new MusicBrainzApi({ appName, appVersion });
        
        let query = `release:"${album}"`;
        if (artist) {
          query += ` AND artist:"${artist}"`;
        }
        
        const result = await mb.search('release', { query }, 0, 1);
        const release = result?.releases?.[0];
        
        if (release) {
          // 获取详细信息
          const detailResult = await mb.getRelease(release.id, ['recordings', 'artists']);
          
          results.push({
            title: detailResult.title,
            artist: detailResult['artist-credit']?.[0]?.name || '',
            year: detailResult.date ? new Date(detailResult.date).getFullYear() : null,
            genre: '',
            description: detailResult.disambiguation || '',
            coverImage: null, // 需要单独获取封面
            tracks: detailResult.media?.[0]?.tracks?.map(track => ({
              title: track.title,
              duration: track.length ? Math.round(track.length / 1000) : null,
              artist: track['artist-credit']?.[0]?.name || detailResult['artist-credit']?.[0]?.name || ''
            })) || [],
            source: 'musicbrainz',
            confidence: 0.9
          });
        }
      } catch (error) {
        console.warn('MusicBrainz 专辑信息获取失败:', error);
      }
    }
    
    // 返回最佳结果
    if (results.length > 0) {
      results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      return {
        success: true,
        data: results[0]
      };
    }
    
    return {
      success: false,
      message: '未找到专辑信息',
      data: null
    };
    
  } catch (error) {
    console.error('获取专辑信息失败:', error);
    return {
      success: false,
      message: error.message || '获取专辑信息失败',
      data: null
    };
  }
}

// 在线获取歌曲歌词
export async function fetchOnlineSongLyrics(title, artist) {
  try {
    const config = await getConfig();
    const results = [];
    
    // 从 Last.fm 获取歌词
    if (config.enableLastfm && config.lastfmApiKey) {
      try {
        // 首先搜索歌曲
        const searchResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
          params: {
            method: 'track.search',
            track: title,
            artist: artist || '',
            api_key: config.lastfmApiKey,
            format: 'json',
            limit: 1
          },
          timeout: 8000
        });
        
        const track = searchResponse.data?.results?.trackmatches?.track?.[0];
        if (track) {
          // 获取歌词（Last.fm 不直接提供歌词，但可以获取歌词链接）
          const lyricsResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
            params: {
              method: 'track.getinfo',
              track: track.name,
              artist: track.artist,
              api_key: config.lastfmApiKey,
              format: 'json'
            },
            timeout: 8000
          });
          
          const trackInfo = lyricsResponse.data?.track;
          if (trackInfo?.wiki?.content) {
            results.push({
              lyrics: trackInfo.wiki.content,
              source: 'lastfm',
              confidence: 0.6
            });
          }
        }
      } catch (error) {
        console.warn('Last.fm 歌词获取失败:', error);
      }
    }
    
    // 从 MusicBrainz 获取歌词（MusicBrainz 不直接提供歌词）
    // 这里可以集成其他歌词服务，如 Musixmatch API
    
    // 返回最佳结果
    if (results.length > 0) {
      results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      return {
        success: true,
        data: results[0]
      };
    }
    
    return {
      success: false,
      message: '未找到歌词',
      data: null
    };
    
  } catch (error) {
    console.error('获取歌词失败:', error);
    return {
      success: false,
      message: error.message || '获取歌词失败',
      data: null
    };
  }
}

// 辅助函数：从 Cover Art Archive 获取封面
async function fetchCoverArtArchive(releaseId) {
  try {
    const response = await axios.get(`https://coverartarchive.org/release/${releaseId}`, {
      timeout: 8000
    });
    
    const images = response.data?.images;
    if (images && images.length > 0) {
      // 优先选择 front 封面
      const frontImage = images.find(img => img.front === true);
      if (frontImage) {
        return frontImage.image;
      }
      
      // 如果没有 front，选择第一张图片
      return images[0].image;
    }
    
    return null;
  } catch (error) {
    console.warn('Cover Art Archive 获取失败:', error);
    return null;
  }
}

// ========== 从 onlineSearch.js 迁移的函数 ==========

// 在线搜索标签
export async function searchOnlineTags(params) {
  const cfg = await getConfig();
  const { query, title, artist, album, filename, duration, trackPath } = params || {};
  
  // 输入先做简体化
  const sQuery = await toSimplified(query || '');
  const sTitle = await toSimplified(title || '');
  const sArtist = await toSimplified(artist || '');
  const sAlbum = await toSimplified(album || '');
  const sFilename = await toSimplified(filename || '');
  const sTrackPath = await toSimplified(trackPath || '');
  
  // 推断最可能的标题/歌手（基于路径/文件名/已有标签）
  const inferred = inferBestQuery({ filename: sFilename, trackPath: sTrackPath, title: sTitle, artist: sArtist, album: sAlbum });
  const origin = {
    title: sTitle || inferred.queryTitle || sQuery || '',
    artist: sArtist || inferred.queryArtist || '',
    album: sAlbum || '',
    duration: duration || null,
    year: null
  };
  
  // 使用推断出的标题进行检索
  const baseParams = {
    query: sQuery || `${inferred.queryTitle || ''}`.trim(),
    title: inferred.queryTitle || sTitle || '',
    artist: inferred.queryArtist || ''
  };
  
  const [mb, lf] = await Promise.all([
    searchMusicBrainz(baseParams, cfg),
    searchLastfm(baseParams, cfg)
  ]);
  
  // 输出字段也做简体化
  const simplifyResult = async (r) => ({
    ...r,
    title: await toSimplified(r.title),
    artist: await toSimplified(r.artist),
    album: await toSimplified(r.album)
  });
  
  const mergedRaw = mergeAndDedupe([ ...mb, ...lf ]);
  const merged = await Promise.all(mergedRaw.map(simplifyResult));
  
  // 基于原信息重算匹配得分并排序
  const rescored = merged
    .map((r) => ({ ...r, score: computeMatchScore(r, origin) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  
  return rescored.slice(0, 20);
}

// 推断最佳查询
function inferBestQuery({ filename, trackPath, title, artist, album }) {
  const baseName = stripDecorations(getBaseNameFromPath(filename || trackPath || ''));
  const tagsTitle = stripDecorations(title || '');
  const tagsArtist = stripDecorations(artist || '');
  const { left, right } = splitArtistTitle(baseName);
  const candidates = [];
  
  if (right) candidates.push({ t: right, a: left });
  if (baseName) candidates.push({ t: baseName, a: '' });
  if (tagsTitle) candidates.push({ t: tagsTitle, a: tagsArtist });
  
  const scored = candidates
    .map((c) => ({
      ...c,
      score: titleSimilarity(c.t, tagsTitle || baseName) * 0.6 + artistSimilarity(c.a, tagsArtist) * 0.4
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  
  const best = scored[0] || { t: tagsTitle || baseName, a: tagsArtist };
  const confident = (best.score || 0) >= 0.5;
  
  return {
    queryTitle: best.t || tagsTitle || baseName,
    queryArtist: confident ? (best.a || tagsArtist) : '',
    confidence: best.score || 0
  };
}

// 计算匹配分数
function computeMatchScore(result, origin) {
  const titleScore = titleSimilarity(tryFixEncoding(result.title), origin.title) * 0.5;
  const artistScore = artistSimilarity(tryFixEncoding(result.artist), origin.artist) * 0.3;
  const albumScore = artistSimilarity(tryFixEncoding(result.album), origin.album) * 0.05;
  const yearScore = yearSimilaritySimple(result.year, origin.year) * 0.05;
  const durationScore = durationSimilaritySimple(result.duration, origin.duration) * 0.1;
  return Number((titleScore + artistScore + albumScore + yearScore + durationScore).toFixed(4));
}

// 从 MusicBrainz 搜索（用于 searchOnlineTags）
async function searchMusicBrainz(params, cfg) {
  try {
    const ua = cfg.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0';
    let appName = 'NAS-Music-Server';
    let appVersion = '1.0.0';
    const m = ua.match(/^([^\/]+)\/(.+)$/);
    if (m) { appName = m[1]; appVersion = m[2]; }
    
    const mb = new MusicBrainzApi({ appName, appVersion });
    const res = await mb.search('recording', { query: `recording:"${params.title}"` }, 0, 10);
    const recs = res?.recordings || [];
    const results = [];
    
    for (const r of recs) {
      const title = r.title || '';
      const artist = r['artist-credit']?.[0]?.name || '';
      const release = Array.isArray(r.releases) ? r.releases[0] : null;
      const album = release?.title || '';
      const year = (release?.date || '').slice(0, 4) || null;
      const duration = r.length ? Math.round(r.length / 1000) : null;
      const score = similarity(params.title || params.query, title) * 0.6 + similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, year, duration, source: 'musicbrainz', sourceId: r.id, score }));
    }
    return results;
  } catch (e) {
    return [];
  }
}

// 从 Last.fm 搜索（用于 searchOnlineTags）
async function searchLastfm(params, cfg) {
  if (!cfg.enableLastfm || !cfg.lastfmApiKey) return [];
  try {
    const apikey = cfg.lastfmApiKey;
    const res = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.search',
        track: params.title || params.query || '',
        artist: params.artist || '',
        api_key: apikey,
        format: 'json',
        limit: 10
      },
      timeout: 8000
    });
    const tracks = res.data?.results?.trackmatches?.track || [];
    const results = [];
    
    for (const t of tracks) {
      const title = t.name;
      const artist = t.artist;
      const album = '';
      const coverImage = Array.isArray(t.image) ? (t.image[3]?.['#text'] || t.image[2]?.['#text'] || null) : null;
      const score = similarity(params.title || params.query, title) * 0.6 + similarity(params.artist || '', artist) * 0.4;
      results.push(buildResult({ title, artist, album, coverImage, source: 'lastfm', sourceId: t.mbid || null, score }));
    }
    return results;
  } catch {
    return [];
  }
}

// 从 Cover Art Archive 获取封面
export async function fetchCoverImageByReleaseId(releaseId) {
  if (!releaseId) return null;
  // 优先从 Cover Art Archive JSON 获取直链
  try {
    const caa = await axios.get(`https://coverartarchive.org/release/${releaseId}`);
    const images = Array.isArray(caa.data?.images) ? caa.data.images : [];
    if (images.length > 0) {
      const front = images.find((img) => img?.front) || images[0];
      if (front?.image) return front.image;
    }
  } catch {}
  // 回落：尝试通过 release -> release-group 再取封面
  try {
    const mb = await axios.get(`https://musicbrainz.org/ws/2/release/${releaseId}`, { params: { fmt: 'json' } });
    const rgid = mb.data?.["release-group"]?.id;
    if (rgid) {
      const caaRg = await axios.get(`https://coverartarchive.org/release-group/${rgid}`);
      const images = Array.isArray(caaRg.data?.images) ? caaRg.data.images : [];
      if (images.length > 0) {
        const front = images.find((img) => img?.front) || images[0];
        if (front?.image) return front.image;
      }
    }
  } catch {}
  // 最后回退到标准 front 路径（可能部分可用）
  return `https://coverartarchive.org/release/${releaseId}/front`;
}

// 根据歌曲信息获取封面
export async function fetchCoverImageByTrackInfo({ title, artist }) {
  try {
    // 构建搜索查询
    let searchQuery = '';
    if (title && artist) {
      searchQuery = `${title} ${artist}`;
    } else if (title) {
      searchQuery = title;
    } else if (artist) {
      searchQuery = artist;
    } else {
      return null;
    }
    
    // 搜索匹配的曲目
    const tracks = await searchTracks(searchQuery, 10);
    
    // 查找有封面的曲目
    for (const track of tracks) {
      if (track.coverImage) {
        return track.coverImage;
      }
    }
    
    return null;
  } catch (error) {
    console.error('获取封面失败:', error);
    return null;
  }
}

// 根据歌曲信息获取歌词
export async function fetchLyricsByTrackInfo({ title, artist }) {
  try {
    // 构建搜索查询
    let searchQuery = '';
    if (title && artist) {
      searchQuery = `${title} ${artist}`;
    } else if (title) {
      searchQuery = title;
    } else if (artist) {
      searchQuery = artist;
    } else {
      return '';
    }
    
    // 搜索匹配的曲目
    const tracks = await searchTracks(searchQuery, 10);
    
    // 查找有歌词的曲目
    for (const track of tracks) {
      if (track.lyrics && track.lyrics.trim()) {
        return await toSimplified(track.lyrics.trim());
      }
    }
    
    return '';
  } catch (error) {
    console.error('获取歌词失败:', error);
    return '';
  }
}



export default {
  searchSongInfo,
  batchSearchSongInfo,
  searchArtistInfo,
  matchArtists,
  fetchOnlineSongCover,
  fetchOnlineAlbumCover,
  fetchOnlineAlbumInfo,
  fetchOnlineSongLyrics,
  searchOnlineTags,
  fetchCoverImageByReleaseId,
  fetchCoverImageByTrackInfo,
  fetchLyricsByTrackInfo
};
