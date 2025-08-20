import Router from 'koa-router';
import online from '../client/online.js';
import lyricsPluginManager from '../plugins/index.js';
import client from '../client/sqlite.js';

const router = new Router();

// 在线搜索音乐
router.get('/search/music', async (ctx) => {
  try {
    const { title, artist, useCache = 'true' } = ctx.query;
    
    if (!title && !artist) {
      ctx.status = 400;
      ctx.body = { error: '请提供歌曲标题或歌手名称' };
      return;
    }

    // 如果启用缓存，先尝试从数据库获取
    if (useCache === 'true') {
      const cachedResults = online.getOnlineMusicFromDatabase(title, artist);
      console.log(cachedResults)
      if (cachedResults && cachedResults.length > 0) {
        ctx.body = {
          success: true,
          data: cachedResults,
          count: cachedResults.length,
          source: 'cache'
        };
        return;
      }
    }

    // 从在线API搜索
    const results = await online.searchMusic(title || '', artist || '');
    ctx.body = {
      success: true,
      data: results,
      count: results.length,
      source: 'online'
    };
  } catch (error) {
    console.error('在线音乐搜索失败:', error);
    ctx.status = 500;
    ctx.body = { error: '搜索失败，请稍后重试' };
  }
});

// 从数据库获取缓存的在线音乐数据
const getCachedOnlineMusic = async (title, artist) => {
  let query = {};
  if (title) {
    query.title = { operator: 'LIKE', data: title };
  }
  if (artist) {
    query.artist = { operator: 'LIKE', data: artist };
  }
  const results = client.page('online_music', 1, 10, 'score DESC', query);
  // 处理artistAliases字段的反序列化
  return results.data.map(item => ({
    ...item,
    artistAliases: item.artistAliases ? JSON.parse(item.artistAliases) : null
  }));
};

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

export default router;