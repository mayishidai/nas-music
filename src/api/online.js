import Router from 'koa-router';
import online from '../client/online.js';
import { findTrackById, updateTrack } from '../client/database.js';

const router = new Router();

// 在线搜索音乐
router.get('/search/music', async (ctx) => {
  try {
    const { title, artist } = ctx.query;
    
    if (!title && !artist) {
      ctx.status = 400;
      ctx.body = { error: '请提供歌曲标题或歌手名称' };
      return;
    }
    const results = await online.searchMusic(title || '', artist || '');
    ctx.body = {
      success: true,
      data: results,
      count: results.length
    };
  } catch (error) {
    console.error('在线音乐搜索失败:', error);
    ctx.status = 500;
    ctx.body = { error: '搜索失败，请稍后重试' };
  }
});

// 在线搜索专辑
router.get('/search/album', async (ctx) => {
  try {
    const { album, artist } = ctx.query;
    
    if (!album && !artist) {
      ctx.status = 400;
      ctx.body = { error: '请提供专辑名称或歌手名称' };
      return;
    }

    const results = await online.searchAlbum(album || '', artist || '');
    
    ctx.body = {
      success: true,
      data: results,
      count: results.length
    };
  } catch (error) {
    console.error('在线专辑搜索失败:', error);
    ctx.status = 500;
    ctx.body = { error: '搜索失败，请稍后重试' };
  }
});

// 在线搜索歌手
router.get('/search/artist', async (ctx) => {
  try {
    const { name } = ctx.query;
    
    if (!name) {
      ctx.status = 400;
      ctx.body = { error: '请提供歌手名称' };
      return;
    }

    const results = await online.searchArtist(name);
    
    ctx.body = {
      success: true,
      data: results,
      count: results.length
    };
  } catch (error) {
    console.error('在线歌手搜索失败:', error);
    ctx.status = 500;
    ctx.body = { error: '搜索失败，请稍后重试' };
  }
});

// 获取歌词信息
router.get('/lyrics', async (ctx) => {
  try {
    const { title, artist } = ctx.query;
    
    if (!title || !artist) {
      ctx.status = 400;
      ctx.body = { error: '请提供歌曲标题和歌手名称' };
      return;
    }

    // 这里可以集成歌词搜索服务，如 Musixmatch 或 Genius
    // 目前返回空字符串，后续可以扩展
    ctx.body = {
      success: true,
      data: {
        title,
        artist,
        lyrics: '',
        source: 'online'
      }
    };
  } catch (error) {
    console.error('获取歌词失败:', error);
    ctx.status = 500;
    ctx.body = { error: '获取歌词失败，请稍后重试' };
  }
});

export default router;