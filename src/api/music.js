import Router from 'koa-router';
import fs from 'fs/promises';
import path from 'path';
import { 
  getAllTracks, 
  findTrackById, 
  updateTrack, 
  getFavoriteTracks, 
  getAlbums, 
  getArtists, 
  findAlbumById, 
  findArtistById, 
  getTracksByAlbum, 
  getTracksByArtist, 
  getRecentlyPlayedTracks,
} from '../client/database.js';

const router = new Router();

 // 获取所有音乐
 router.get('/tracks', async (ctx) => {
   try {
     const { 
       page = 1, 
       pageSize = 10, 
       sort = 'title', 
       order = 'asc', 
       search = '',
       genre, artist, album, yearFrom, yearTo, decade, minBitrate, maxBitrate, favorite
     } = ctx.query;
     
     const result = await getAllTracks({
       page: parseInt(page),
       pageSize: parseInt(pageSize),
       sort,
       order,
       search,
       genre,
       artist,
       album,
       yearFrom,
       yearTo,
       decade,
       minBitrate,
       maxBitrate,
       favorite
     });
     
     ctx.body = {
       success: true,
       ...result
     };
   } catch (error) {
     console.error('获取音乐列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取音乐列表失败' };
   }
 });

// 获取单条音乐详情
router.get('/tracks/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    ctx.body = { success: true, data: track };
  } catch (error) {
    console.error('获取音乐详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取音乐详情失败' };
  }
});

// 收藏/取消收藏
router.put('/tracks/:id/favorite', async (ctx) => {
  try {
    const { id } = ctx.params;
    const { favorite } = ctx.request.body;
    
    const track = await findTrackById(id);
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    await updateTrack(id, { favorite: favorite ? 1 : 0 });
    
    ctx.body = { success: true, data: { favorite: favorite ? 1 : 0 } };
  } catch (error) {
    console.error('更新收藏状态失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '更新收藏状态失败' };
  }
});

 // 收藏列表
 router.get('/favorites', async (ctx) => {
   try {
     const { page = 1, pageSize = 10, sort = 'title', order = 'asc' } = ctx.query;
     
     const result = await getFavoriteTracks({
       page: parseInt(page),
       pageSize: parseInt(pageSize),
       sort,
       order
     });
     
     ctx.body = {
       success: true,
       ...result
     };
   } catch (error) {
     console.error('获取收藏列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取收藏列表失败' };
   }
 });

 // 获取专辑列表
 router.get('/albums', async (ctx) => {
   try {
     const { query, page = 1, pageSize = 10, sort = 'title', order = 'asc' } = ctx.query;
     
     const result = await getAlbums({
       query,
       page: parseInt(page),
       pageSize: parseInt(pageSize),
       sort,
       order
     });
     
     ctx.body = {
       success: true,
       ...result
     };
   } catch (error) {
     console.error('获取专辑列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取专辑列表失败' };
   }
 });

 // 获取艺术家列表
 router.get('/artists', async (ctx) => {
   try {
     const { query, page = 1, pageSize = 10, sort = 'name', order = 'asc' } = ctx.query;
     
     const result = await getArtists({
       query,
       page: parseInt(page),
       pageSize: parseInt(pageSize),
       sort,
       order
     });
     
     ctx.body = {
       success: true,
       ...result
     };
   } catch (error) {
     console.error('获取艺术家列表失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取艺术家列表失败' };
   }
 });

// 获取专辑详情
router.get('/albums/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const album = await findAlbumById(id);
    
    if (!album) {
      ctx.status = 404;
      ctx.body = { success: false, error: '专辑不存在' };
      return;
    }
    
    // 获取专辑下的音乐
    const tracks = await getTracksByAlbum(id);
    
    ctx.body = { 
      success: true, 
      data: { 
        ...album, 
        tracks 
      } 
    };
  } catch (error) {
    console.error('获取专辑详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取专辑详情失败' };
  }
});

// 获取艺术家详情
router.get('/artists/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const artist = await findArtistById(id);
    
    if (!artist) {
      ctx.status = 404;
      ctx.body = { success: false, error: '艺术家不存在' };
      return;
    }
    
    // 获取艺术家的音乐
    const tracks = await getTracksByArtist(id);
    
    ctx.body = { 
      success: true, 
      data: { 
        ...artist, 
        tracks 
      } 
    };
  } catch (error) {
    console.error('获取艺术家详情失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取艺术家详情失败' };
  }
});

// 流式播放音乐
router.get('/stream/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    // 检查文件是否存在
    try {
      await fs.access(track.path);
    } catch (error) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐文件不存在' };
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
      
      const stream = fs.createReadStream(track.path, { start, end });
      ctx.body = stream;
    } else {
      ctx.set({
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });
      
      const stream = fs.createReadStream(track.path);
      ctx.body = stream;
    }
  } catch (error) {
    console.error('流式播放失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '流式播放失败' };
  }
});

// 记录最近播放
router.post('/recently-played/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    // 更新播放次数和最后播放时间
    await updateTrack(id, {
      playCount: (track.playCount || 0) + 1,
      lastPlayed: new Date().toISOString()
    });
    
    ctx.body = { success: true };
  } catch (error) {
    console.error('记录最近播放失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '记录最近播放失败' };
  }
});

 // 获取最近播放（按记录顺序返回，支持分页）
 router.get('/recently-played', async (ctx) => {
   try {
     const { limit = 20, offset = 0 } = ctx.query;
     const result = await getRecentlyPlayedTracks({
       limit: parseInt(limit),
       offset: parseInt(offset)
     });
     
     ctx.body = {
       success: true,
       ...result
     };
   } catch (error) {
     console.error('获取最近播放失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '获取最近播放失败' };
   }
 });

// 获取音乐统计信息
router.get('/stats', async (ctx) => {
  try {
    const { getMusicStats } = await import('../client/database.js');
    const stats = await getMusicStats();
    
    ctx.body = { success: true, data: stats };
  } catch (error) {
    console.error('获取统计信息失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取统计信息失败' };
  }
});

// 批量更新音乐信息
router.put('/tracks/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const updates = ctx.request.body;
    
    const track = await findTrackById(id);
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    // 过滤允许更新的字段
    const allowedFields = [
      'title', 'artist', 'album', 'genre', 'year', 'trackNumber', 
      'totalTracks', 'discNumber', 'totalDiscs', 'favorite', 'lyrics'
    ];
    
    const filteredUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    await updateTrack(id, filteredUpdates);
    
    ctx.body = { success: true, data: filteredUpdates };
  } catch (error) {
    console.error('更新音乐信息失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '更新音乐信息失败' };
  }
});

// 获取音乐封面
router.get('/tracks/:id/cover', async (ctx) => {
  try {
    const { id } = ctx.params;
    const track = await findTrackById(id);
    
    if (!track) {
      ctx.status = 404;
      ctx.body = { success: false, error: '音乐不存在' };
      return;
    }
    
    if (!track.coverImage) {
      ctx.status = 404;
      ctx.body = { success: false, error: '封面不存在' };
      return;
    }
    
    // 如果是 Base64 数据，直接返回
    if (track.coverImage.startsWith('data:image/')) {
      ctx.set('Content-Type', 'image/jpeg');
      ctx.body = Buffer.from(track.coverImage.split(',')[1], 'base64');
    } else {
      // 如果是文件路径，读取文件
      try {
        const coverBuffer = await fs.readFile(track.coverImage);
        ctx.set('Content-Type', 'image/jpeg');
        ctx.body = coverBuffer;
      } catch (error) {
        ctx.status = 404;
        ctx.body = { success: false, error: '封面文件不存在' };
      }
    }
  } catch (error) {
    console.error('获取封面失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, error: '获取封面失败' };
  }
});

 // 搜索音乐（支持多字段搜索）
 router.get('/search', async (ctx) => {
   try {
     const { q, type = 'tracks', page = 1, pageSize = 10 } = ctx.query;
     
     if (!q) {
       ctx.status = 400;
       ctx.body = { success: false, error: '搜索关键词不能为空' };
       return;
     }
     
     let results = [];
     
     switch (type) {
       case 'tracks':
         results = await getAllTracks({
           search: q,
           page: parseInt(page),
           pageSize: parseInt(pageSize)
         });
         break;
       case 'albums':
         results = await getAlbums({
           query: q,
           page: parseInt(page),
           pageSize: parseInt(pageSize)
         });
         break;
       case 'artists':
         results = await getArtists({
           query: q,
           page: parseInt(page),
           pageSize: parseInt(pageSize)
         });
         break;
       default:
         ctx.status = 400;
         ctx.body = { success: false, error: '不支持的搜索类型' };
         return;
     }
     
     ctx.body = {
       success: true,
       ...results,
       type
     };
   } catch (error) {
     console.error('搜索失败:', error);
     ctx.status = 500;
     ctx.body = { success: false, error: '搜索失败' };
   }
 });

export default router;