import Router from 'koa-router';
import online from '../client/online.js';
import { findTrackById, updateTrack } from '../client/database.js';
import lyricsPluginManager from '../plugins/index.js';

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

// 获取歌词信息
router.get('/lyrics', async (ctx) => {
  try {
    const { title, artist, plugin } = ctx.query;
    
    if (!title || !artist) {
      ctx.status = 400;
      ctx.body = { error: '请提供歌曲标题和歌手名称' };
      return;
    }

    // 使用歌词搜索插件
    const results = await lyricsPluginManager.searchLyrics(title, artist, plugin);
    
    if (results && results.length > 0) {
      // 按匹配度排序，返回最佳结果
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
      const bestResult = results[0];
      
      ctx.body = {
        success: true,
        data: {
          title: bestResult.title,
          artist: bestResult.artist,
          album: bestResult.album,
          lyrics: bestResult.lyrics,
          source: bestResult.source,
          score: bestResult.score,
          allResults: results // 包含所有搜索结果
        }
      };
    } else {
      ctx.body = {
        success: false,
        data: {
          title,
          artist,
          lyrics: '',
          source: 'none',
          message: '未找到匹配的歌词'
        }
      };
    }
  } catch (error) {
    console.error('获取歌词失败:', error);
    ctx.status = 500;
    ctx.body = { error: '获取歌词失败，请稍后重试' };
  }
});

// 获取可用歌词插件列表
router.get('/lyrics/plugins', async (ctx) => {
  try {
    const plugins = lyricsPluginManager.getAvailablePlugins();
    const pluginInfos = plugins.map(name => {
      const info = lyricsPluginManager.getPluginInfo(name);
      return {
        name,
        ...info
      };
    });
    
    ctx.body = {
      success: true,
      data: pluginInfos
    };
  } catch (error) {
    console.error('获取插件列表失败:', error);
    ctx.status = 500;
    ctx.body = { error: '获取插件列表失败' };
  }
});

// 测试指定插件的歌词搜索
router.get('/lyrics/test/:plugin', async (ctx) => {
  try {
    const { plugin } = ctx.params;
    const { title, artist } = ctx.query;
    
    if (!title || !artist) {
      ctx.status = 400;
      ctx.body = { error: '请提供歌曲标题和歌手名称' };
      return;
    }

    const results = await lyricsPluginManager.searchLyrics(title, artist, plugin);
    
    ctx.body = {
      success: true,
      data: {
        plugin,
        results: results || []
      }
    };
  } catch (error) {
    console.error('测试插件失败:', error);
    ctx.status = 500;
    ctx.body = { error: '测试插件失败' };
  }
});

export default router;