import Router from 'koa-router';
import axios from 'axios';
import { fetchCoverImageByReleaseId, fetchCoverImageByTrackInfo, fetchLyricsByTrackInfo } from '../client/onlineSearch.js';
import fs from 'fs/promises';
import { musicDB, getConfig, saveConfig, getMusicStats } from '../client/database.js';
import { searchOnlineTags } from '../client/onlineSearch.js';
import { fullScan, getRecommendations, initMusicModule } from '../client/music.js';

const router = new Router();

// API路由

// 初始化和扫描
router.post('/scan', async (ctx) => {
  try {
    const count = await fullScan();
    ctx.body = {
      success: true,
      message: `扫描完成，共找到 ${count} 首音乐`,
      count
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '扫描失败: ' + error.message };
  }
});

// 获取音乐库统计信息
router.get('/stats', async (ctx) => {
  try {
    const stats = await getMusicStats();
    const config = await getConfig();
    
    ctx.body = {
      success: true,
      data: {
        ...stats,
        lastScan: config.lastScan || null
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取统计信息失败: ' + error.message };
  }
});

// 获取所有音乐
router.get('/tracks', async (ctx) => {
  try {
    const { page = 1, limit = 50, sort = 'title', order = 'asc', search = '', genre, artist, album, yearFrom, yearTo, decade, minBitrate, maxBitrate, favorite } = ctx.query;
    
    let selector = { type: 'track' };
    
    // 搜索过滤 - NeDB 使用 $or 和 $regex
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      selector.$or = [
        { title: searchRegex },
        { artist: searchRegex },
        { album: searchRegex }
      ];
    }

    if (genre) selector.genre = new RegExp(genre, 'i');
    if (artist) selector.artist = new RegExp(artist, 'i');
    if (album) selector.album = new RegExp(album, 'i');

    // 年份范围/年代
    const yearFromNum = yearFrom ? parseInt(yearFrom, 10) : undefined;
    const yearToNum = yearTo ? parseInt(yearTo, 10) : undefined;
    if (yearFromNum || yearToNum) {
      selector.year = {};
      if (yearFromNum) selector.year.$gte = yearFromNum;
      if (yearToNum) selector.year.$lte = yearToNum;
    }
    if (decade) {
      const d = parseInt(decade, 10);
      if (!Number.isNaN(d)) {
        selector.year = { ...(selector.year || {}), $gte: d, $lte: d + 9 };
      }
    }

    // 音质范围
    const minB = minBitrate ? parseInt(minBitrate, 10) : undefined;
    const maxB = maxBitrate ? parseInt(maxBitrate, 10) : undefined;
    if (minB || maxB) {
      selector.bitrate = {};
      if (minB) selector.bitrate.$gte = minB;
      if (maxB) selector.bitrate.$lte = maxB;
    }

    // 收藏
    if (typeof favorite !== 'undefined') {
      const fav = String(favorite).toLowerCase();
      if (fav === 'true' || fav === '1') selector.favorite = true;
      if (fav === 'false' || fav === '0') selector.favorite = { $ne: true };
    }

    // 如果未传 sort 字段或为空，默认使用 _id（稳定且无需索引）
    const sortField = sort || '_id';

    // NeDB 查询
    const sortObj = {};
    sortObj[sortField] = order === 'desc' ? -1 : 1;
    
    const result = await new Promise((resolve, reject) => {
      musicDB.find(selector)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec((err, docs) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(docs);
        });
    });
    
    const totalResult = await new Promise((resolve, reject) => {
      musicDB.count(selector, (err, count) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(count);
      });
    });
    
    ctx.body = {
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResult,
        pages: Math.ceil(totalResult / limit)
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取音乐列表失败: ' + error.message };
    console.error('获取音乐列表失败:', error);
  }
});

// 获取单条音乐详情
router.get('/tracks/:id', async (ctx) => {
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => (err ? reject(err) : resolve(doc)));
    });
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }
    ctx.body = { success: true, data: track };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取音乐详情失败: ' + error.message };
  }
});

// 收藏/取消收藏
router.put('/tracks/:id/favorite', async (ctx) => {
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }
    
    const { favorite } = ctx.request.body || {};
    const updateResult = await new Promise((resolve, reject) => {
      musicDB.update({ _id: ctx.params.id }, { $set: { favorite: Boolean(favorite) } }, {}, (err, numReplaced) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(numReplaced);
      });
    });
    
    ctx.body = { success: true, result: updateResult, data: { id: track._id, favorite: Boolean(favorite) } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '更新收藏失败: ' + error.message };
    console.error('更新收藏失败:', error);
  }
});

// 收藏列表
router.get('/favorites', async (ctx) => {
  try {
    const { page = 1, limit = 50, sort = 'title', order = 'asc', search = '' } = ctx.query;
    const selector = {
      type: 'track',
      favorite: true
    };
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      selector.$or = [
        { title: searchRegex },
        { artist: searchRegex },
        { album: searchRegex }
      ];
    }
    const sortObj = {};
    sortObj[sort || '_id'] = order === 'desc' ? -1 : 1;
    
    const result = await new Promise((resolve, reject) => {
      musicDB.find(selector)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec((err, docs) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(docs);
        });
    });
    
    const totalResult = await new Promise((resolve, reject) => {
      musicDB.count(selector, (err, count) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(count);
      });
    });
    
    ctx.body = {
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResult,
        pages: Math.ceil(totalResult / limit)
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取收藏失败: ' + error.message };
    console.error('获取收藏失败:', error);
  }
});

// 获取专辑列表
router.get('/albums', async (ctx) => {
  try {
    const { page = 1, limit = 20, search = '' } = ctx.query;
    
    let selector = { type: 'album' };
    
    if (search) {
      selector = {
        type: 'album',
        $or: [
          { name: new RegExp(search, 'i') },
          { artist: new RegExp(search, 'i') }
        ]
      };
    }
    
    const result = await new Promise((resolve, reject) => {
      musicDB.find(selector)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec((err, docs) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(docs);
        });
    });
    
    const totalResult = await new Promise((resolve, reject) => {
      musicDB.count(selector, (err, count) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(count);
      });
    });
    
    ctx.body = {
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResult,
        pages: Math.ceil(totalResult / limit)
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取专辑列表失败: ' + error.message };
    console.error('获取专辑列表失败:', error);
  }
});

// 获取艺术家列表
router.get('/artists', async (ctx) => {
  try {
    const { page = 1, limit = 20, search = '' } = ctx.query;
    
    let selector = { type: 'artist' };
    
    if (search) {
      selector = {
        type: 'artist',
        name: new RegExp(search, 'i')
      };
    }
    
    const result = await new Promise((resolve, reject) => {
      musicDB.find(selector)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec((err, docs) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(docs);
        });
    });
    
    const totalResult = await new Promise((resolve, reject) => {
      musicDB.count(selector, (err, count) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(count);
      });
    });
    
    ctx.body = {
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResult,
        pages: Math.ceil(totalResult / limit)
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取艺术家列表失败: ' + error.message };
    console.error('获取艺术家列表失败:', error);
  }
});

// 获取流派列表
router.get('/genres', async (ctx) => {
  try {
    const result = await new Promise((resolve, reject) => {
      musicDB.find({ type: 'genre' })
        .sort({ name: 1 })
        .exec((err, docs) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(docs);
        });
    });
    
    ctx.body = {
      success: true,
      data: result
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取流派列表失败: ' + error.message };
    console.error('获取流派列表失败:', error);
  }
});

// 获取专辑详情
router.get('/albums/:id', async (ctx) => {
  try {
    const album = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    
    if (!album || album.type !== 'album') {
      ctx.status = 404;
      ctx.body = { error: '专辑不存在' };
      return;
    }
    
    // 获取专辑中的所有音乐
    const trackPromises = album.tracks.map(async (trackId) => {
      try {
        return await new Promise((resolve, reject) => {
          musicDB.findOne({ _id: trackId }, (err, doc) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(doc);
          });
        });
      } catch (error) {
        return null;
      }
    });
    
    const tracks = (await Promise.all(trackPromises)).filter(Boolean);
    
    ctx.body = {
      success: true,
      data: {
        ...album,
        tracks
      }
    };
  } catch (error) {
    ctx.status = 404;
    ctx.body = { error: '专辑不存在' };
    console.error('获取专辑详情失败:', error);
  }
});

// 获取艺术家详情
router.get('/artists/:id', async (ctx) => {
  try {
    const artist = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    
    if (!artist || artist.type !== 'artist') {
      ctx.status = 404;
      ctx.body = { error: '艺术家不存在' };
      return;
    }
    
    // 获取艺术家的所有音乐
    const trackPromises = artist.tracks.map(async (trackId) => {
      try {
        return await new Promise((resolve, reject) => {
          musicDB.findOne({ _id: trackId }, (err, doc) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(doc);
          });
        });
      } catch (error) {
        return null;
      }
    });
    
    const tracks = (await Promise.all(trackPromises)).filter(Boolean);
    
    // 获取艺术家的所有专辑
    const albumPromises = artist.albums.map(async (albumKey) => {
      try {
        const albumId = `album_${albumKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
        return await new Promise((resolve, reject) => {
          musicDB.findOne({ _id: albumId }, (err, doc) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(doc);
          });
        });
      } catch (error) {
        return null;
      }
    });
    
    const albums = (await Promise.all(albumPromises)).filter(Boolean);
    
    ctx.body = {
      success: true,
      data: {
        ...artist,
        tracks,
        albums
      }
    };
  } catch (error) {
    ctx.status = 404;
    ctx.body = { error: '艺术家不存在' };
    console.error('获取艺术家详情失败:', error);
  }
});

// 获取推荐音乐
router.get('/recommendations/:trackId', async (ctx) => {
  try {
    const { limit = 10 } = ctx.query;
    const recommendations = await getRecommendations(ctx.params.trackId, parseInt(limit));
    
    ctx.body = {
      success: true,
      data: recommendations
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取推荐失败: ' + error.message };
    console.error('获取推荐失败:', error);
  }
});

// 流式播放音乐
router.get('/stream/:id', async (ctx) => {
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }

    const stat = await fs.stat(track.path);
    const fileSize = stat.size;
    const range = ctx.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      ctx.status = 206;
      ctx.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg'
      });
      
      const stream = (await import('fs')).createReadStream(track.path, { start, end });
      ctx.body = stream;
    } else {
      ctx.set({
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg'
      });
      ctx.body = (await import('fs')).createReadStream(track.path);
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '播放失败' };
    console.error('播放失败:', error);
  }
});

// 获取歌词
router.get('/lyrics/:id', async (ctx) => {
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }

    // 尝试从音乐文件中提取歌词
    let lyrics = '';
    
    try {
      // 这里可以集成歌词提取库，比如 music-metadata 的 lyrics 功能
      // 或者从外部歌词文件读取
      const lyricsPath = track.path.replace(/\.[^/.]+$/, '.lrc');
      
      if (await fs.access(lyricsPath).then(() => true).catch(() => false)) {
        lyrics = await fs.readFile(lyricsPath, 'utf8');
      } else {
        // 如果没有找到 .lrc 文件，尝试从音乐文件元数据中提取
        // 这里暂时返回空，可以后续集成歌词提取功能
        lyrics = '';
      }
    } catch (error) {
      console.log('歌词提取失败:', error.message);
      lyrics = '';
    }

    ctx.body = {
      success: true,
      data: lyrics
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取歌词失败: ' + error.message };
    console.error('获取歌词失败:', error);
  }
});

// 根据标题/歌手获取本地或外部封面
router.get('/cover-by-info', async (ctx) => {
  try {
    const { title = '', artist = '', releaseId = '' } = ctx.query;
    let cover = null;
    if (title || artist) {
      cover = await fetchCoverImageByTrackInfo({ title, artist });
    }
    if (!cover && releaseId) {
      cover = await fetchCoverImageByReleaseId(releaseId);
    }
    ctx.body = { success: true, data: cover || null };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, error: '获取封面失败' };
  }
});

// 根据标题/歌手获取歌词（简体）
router.get('/lyrics-by-info', async (ctx) => {
  try {
    const { title = '', artist = '' } = ctx.query;
    const lyrics = await fetchLyricsByTrackInfo({ title, artist });
    ctx.body = { success: true, data: lyrics || '' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, error: '获取歌词失败' };
  }
});

// 记录最近播放
router.post('/recently-played/:id', async (ctx) => {
  try {
    const trackId = ctx.params.id;
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: trackId }, (err, doc) => (err ? reject(err) : resolve(doc)));
    });
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }

    const config = await getConfig();
    const list = Array.isArray(config.recentlyPlayed) ? config.recentlyPlayed : [];
    const now = new Date().toISOString();
    const without = list.filter((e) => e && e.id !== trackId); // 去重：移除旧记录
    without.unshift({ id: trackId, at: now });
    const limited = without.slice(0, 100);
    await saveConfig({ ...config, recentlyPlayed: limited });
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '记录最近播放失败: ' + error.message };
  }
});

// 获取最近播放（按记录顺序返回，支持分页和搜索）
router.get('/recently-played', async (ctx) => {
  try {
    const { page = 1, limit = 20, search = '' } = ctx.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    const config = await getConfig();
    const list = Array.isArray(config.recentlyPlayed) ? config.recentlyPlayed : [];
    const ids = list.map((e) => e.id);
    const uniqueIds = Array.from(new Set(ids));
    const allDocs = await new Promise((resolve, reject) => {
      musicDB.find({ type: 'track', _id: { $in: uniqueIds } }, (err, docs) => (err ? reject(err) : resolve(docs || [])));
    });
    // 建立id->doc映射
    const map = new Map(allDocs.map((d) => [d._id, d]));
    // 搜索过滤
    const searchRegex = search ? new RegExp(search, 'i') : null;
    const filteredOrdered = uniqueIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .filter((d) =>
        !searchRegex || searchRegex.test(d.title || '') || searchRegex.test(d.artist || '') || searchRegex.test(d.album || '')
      );
    const total = filteredOrdered.length;
    const start = (p - 1) * l;
    const pageDocs = filteredOrdered.slice(start, start + l);
    ctx.body = {
      success: true,
      data: pageDocs,
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取最近播放失败: ' + error.message };
  }
});

// 更新音乐Tag
router.put('/tracks/:id/tags', async (ctx) => {
  try {
    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(doc);
      });
    });
    
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }

    const { title, artist, album, albumArtist, year, genre, track: trackNumber } = ctx.request.body;
    
    // 构建更新对象
    const updateObj = {};
    if (title !== undefined) updateObj.title = title;
    if (artist !== undefined) updateObj.artist = artist;
    if (album !== undefined) updateObj.album = album;
    if (albumArtist !== undefined) updateObj.albumArtist = albumArtist;
    if (year !== undefined) updateObj.year = year;
    if (genre !== undefined) updateObj.genre = genre;
    if (trackNumber !== undefined) updateObj.track = trackNumber;
    
    // 保存到数据库
    await new Promise((resolve, reject) => {
      musicDB.update({ _id: ctx.params.id }, { $set: updateObj }, {}, (err, numReplaced) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(numReplaced);
      });
    });
    
    ctx.body = {
      success: true,
      message: 'Tag更新成功',
      data: { ...track, ...updateObj }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '更新Tag失败: ' + error.message };
    console.error('更新Tag失败:', error);
  }
});

// 更新音乐封面（接收 base64 data URL）
router.put('/tracks/:id/cover', async (ctx) => {
  try {
    const { coverImage } = ctx.request.body || {};
    if (!coverImage || typeof coverImage !== 'string' || !coverImage.startsWith('data:image')) {
      ctx.status = 400;
      ctx.body = { error: '请提供有效的图片数据（base64 data URL）' };
      return;
    }

    const track = await new Promise((resolve, reject) => {
      musicDB.findOne({ _id: ctx.params.id }, (err, doc) => (err ? reject(err) : resolve(doc)));
    });
    if (!track || track.type !== 'track') {
      ctx.status = 404;
      ctx.body = { error: '音乐不存在' };
      return;
    }

    await new Promise((resolve, reject) => {
      musicDB.update({ _id: ctx.params.id }, { $set: { coverImage } }, {}, (err, numReplaced) => (err ? reject(err) : resolve(numReplaced)));
    });

    ctx.body = { success: true, message: '封面更新成功' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '更新封面失败: ' + error.message };
  }
});

// 在线搜索Tag信息（聚合 MusicBrainz / Last.fm / AcoustID / QQ音乐 / 网易云音乐）
router.get('/search-tags', async (ctx) => {
  const { query, title, artist, album, filename, trackId } = ctx.query;
  if (!query && !title && !filename && !artist) {
    ctx.status = 400;
    ctx.body = { error: '请至少提供 query/title/filename/artist 之一' };
    return;
  }
  try {
    let trackPath = undefined;
    let fallbackTitle = title;
    let fallbackArtist = artist;
    let fallbackAlbum = album;
    if (trackId) {
      try {
        const t = await new Promise((resolve, reject) => {
          musicDB.findOne({ _id: trackId }, (err, doc) => (err ? reject(err) : resolve(doc)));
        });
        if (t) {
          trackPath = t.path;
          fallbackTitle = fallbackTitle || t.title;
          fallbackArtist = fallbackArtist || t.artist;
          fallbackAlbum = fallbackAlbum || t.album;
        }
      } catch {}
    }

    const results = await searchOnlineTags({
      query,
      title: fallbackTitle,
      artist: fallbackArtist,
      album: fallbackAlbum,
      filename,
      trackPath
    });
    ctx.body = { success: true, data: results };
  } catch (error) {
    console.error('搜索Tag失败:', error);
    ctx.body = { success: false, error: '搜索失败', data: [] };
  }
});

// 添加配置管理API
router.get('/config', async (ctx) => {
  try {
    const config = await getConfig();
    // 不返回敏感信息
    const safeConfig = { ...config };
    delete safeConfig._id;
    delete safeConfig._rev;
    
    ctx.body = {
      success: true,
      data: safeConfig
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取配置失败: ' + error.message };
  }
});

router.put('/config', async (ctx) => {
  try {
    const newConfig = ctx.request.body;
    await saveConfig(newConfig);
    
    ctx.body = {
      success: true,
      message: '配置保存成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '保存配置失败: ' + error.message };
  }
});

// 初始化
initMusicModule().then(() => {
  console.log('NAS音乐服务器已启动');
});

export default router;