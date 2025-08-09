import Router from 'koa-router';
import axios from 'axios';
import { getConfig, saveConfig } from '../client/database.js';
import { 
  getMediaLibraries, 
  addMediaLibrary, 
  deleteMediaLibrary, 
  scanMediaLibrary, 
  getScanProgress 
} from '../client/music.js';

const router = new Router();

// ==================== API配置接口 ====================

/**
 * 获取API配置
 * GET /api/settings/api-configs
 */
router.get('/api-configs', async (ctx) => {
  try {
    const config = await getConfig();
    const apiConfigs = {
      musicbrainz: { 
        apiKey: config.musicbrainzApiKey || '', 
        baseUrl: 'https://musicbrainz.org/ws/2/',
        userAgent: config.musicbrainzUserAgent || 'NAS-Music-Server/1.0.0'
      },
      lastfm: { 
        apiKey: config.lastfmApiKey || '', 
        baseUrl: 'https://ws.audioscrobbler.com/2.0/',
        enabled: config.enableLastfm || false
      },
      acoustid: { 
        apiKey: config.acoustidApiKey || '', 
        baseUrl: 'https://api.acoustid.org/v2/',
        enabled: config.enableAcoustid || false
      },
      tencent: { 
        apiKey: config.qqMusicApiKey || '', 
        baseUrl: 'https://c.y.qq.com/',
        enabled: config.enableQQMusic || false
      },
      netease: {
        apiKey: config.neteaseMusicApiKey || '',
        baseUrl: 'https://music.163.com/',
        enabled: config.enableNeteaseMusic || false
      }
    };
    
    ctx.body = {
      success: true,
      data: apiConfigs
    };
  } catch (error) {
    console.error('获取API配置失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '获取API配置失败'
    };
  }
});

/**
 * 更新API配置
 * PUT /api/settings/api-configs
 */
router.put('/api-configs', async (ctx) => {
  try {
    const { musicbrainz, lastfm, acoustid, tencent, netease } = ctx.request.body;
    const config = await getConfig();
    
    // 更新配置
    if (musicbrainz) {
      config.musicbrainzApiKey = musicbrainz.apiKey;
      config.musicbrainzUserAgent = musicbrainz.userAgent;
    }
    if (lastfm) {
      config.lastfmApiKey = lastfm.apiKey;
      config.enableLastfm = lastfm.enabled;
    }
    if (acoustid) {
      config.acoustidApiKey = acoustid.apiKey;
      config.enableAcoustid = acoustid.enabled;
    }
    if (tencent) {
      config.qqMusicApiKey = tencent.apiKey;
      config.enableQQMusic = tencent.enabled;
    }
    if (netease) {
      config.neteaseMusicApiKey = netease.apiKey;
      config.enableNeteaseMusic = netease.enabled;
    }
    
    await saveConfig(config);
    
    ctx.body = {
      success: true,
      message: 'API配置保存成功'
    };
  } catch (error) {
    console.error('保存API配置失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '保存API配置失败'
    };
  }
});

// ==================== 媒体库管理接口 ====================

/**
 * 获取媒体库列表
 * GET /api/settings/media-libraries
 */
router.get('/media-libraries', async (ctx) => {
  try {
    const libraries = await getMediaLibraries();
    ctx.body = {
      success: true,
      data: libraries
    };
  } catch (error) {
    console.error('获取媒体库列表失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '获取媒体库列表失败'
    };
  }
});

/**
 * 添加媒体库
 * POST /api/settings/media-libraries
 */
router.post('/media-libraries', async (ctx) => {
  try {
    const { path: libraryPath } = ctx.request.body;
    
    if (!libraryPath) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '媒体库路径不能为空'
      };
      return;
    }
    
    const newLibrary = await addMediaLibrary(libraryPath);
    
    ctx.body = {
      success: true,
      data: newLibrary,
      message: '媒体库添加成功'
    };
  } catch (error) {
    console.error('添加媒体库失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message || '添加媒体库失败'
    };
  }
});

/**
 * 删除媒体库
 * DELETE /api/settings/media-libraries/:id
 */
router.delete('/media-libraries/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    await deleteMediaLibrary(id);
    
    ctx.body = {
      success: true,
      message: '媒体库删除成功'
    };
  } catch (error) {
    console.error('删除媒体库失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message || '删除媒体库失败'
    };
  }
});

/**
 * 扫描媒体库
 * POST /api/settings/media-libraries/:id/scan
 */
router.post('/media-libraries/:id/scan', async (ctx) => {
  try {
    const { id } = ctx.params;
    
    // 异步开始扫描
    scanMediaLibrary(id);
    
    ctx.body = {
      success: true,
      message: '扫描已开始'
    };
  } catch (error) {
    console.error('开始扫描失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message || '开始扫描失败'
    };
  }
});

/**
 * 获取扫描进度
 * GET /api/settings/media-libraries/:id/scan-progress
 */
router.get('/media-libraries/:id/scan-progress', async (ctx) => {
  try {
    const { id } = ctx.params;
    const progress = getScanProgress(id);
    if (!progress) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: '扫描任务不存在'
      };
      return;
    }
    
    ctx.body = {
      success: true,
      data: progress
    };
  } catch (error) {
    console.error('获取扫描进度失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '获取扫描进度失败'
    };
  }
});

// ==================== 测试API配置接口 ====================

/**
 * 测试API配置
 * POST /api/settings/test-api/:service
 */
router.post('/test-api/:service', async (ctx) => {
  try {
    const { service } = ctx.params;
    const config = await getConfig();
    
    let apiKey = '';
    let baseUrl = '';
    let testUrl = '';
    let testParams = {};
    
    // 根据不同的API服务进行测试
    switch (service) {
      case 'musicbrainz':
        apiKey = config.musicbrainzApiKey;
        baseUrl = 'https://musicbrainz.org/ws/2/';
        testUrl = `${baseUrl}artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da`;
        testParams = {
          fmt: 'json'
        };
        break;
        
      case 'lastfm':
        apiKey = config.lastfmApiKey;
        baseUrl = 'https://ws.audioscrobbler.com/2.0/';
        testUrl = baseUrl;
        testParams = {
          method: 'artist.getinfo',
          artist: 'Cher',
          api_key: apiKey,
          format: 'json'
        };
        break;
        
      case 'acoustid':
        apiKey = config.acoustidApiKey;
        baseUrl = 'https://api.acoustid.org/v2/';
        testUrl = `${baseUrl}lookup`;
        testParams = {
          client: apiKey,
          meta: 'recordings+releases'
        };
        break;
        
      case 'tencent':
        apiKey = config.qqMusicApiKey;
        baseUrl = 'https://c.y.qq.com/';
        testUrl = `${baseUrl}search`;
        testParams = {
          key: apiKey,
          w: 'test'
        };
        break;
        
      case 'netease':
        apiKey = config.neteaseMusicApiKey;
        baseUrl = 'https://music.163.com/';
        testUrl = `${baseUrl}api/search`;
        testParams = {
          key: apiKey,
          s: 'test'
        };
        break;
        
      default:
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '不支持的API服务'
        };
        return;
    }
    
    if (!apiKey) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'API配置不存在或API Key为空'
      };
      return;
    }
    
    // 发送测试请求
    const response = await axios.get(testUrl, { params: testParams });
    
    ctx.body = {
      success: true,
      message: 'API配置测试成功',
      data: {
        status: response.status,
        statusText: response.statusText
      }
    };
    
  } catch (error) {
    console.error('API配置测试失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: 'API配置测试失败: ' + error.message
    };
  }
});

// ==================== 系统信息接口 ====================

/**
 * 获取系统信息
 * GET /api/settings/system-info
 */
router.get('/system-info', async (ctx) => {
  try {
    const os = require('os');
    const process = require('process');
    
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model
      },
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
    
    ctx.body = {
      success: true,
      data: systemInfo
    };
  } catch (error) {
    console.error('获取系统信息失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '获取系统信息失败'
    };
  }
});

// ==================== 音乐统计接口 ====================

/**
 * 获取音乐统计信息
 * GET /api/settings/music-stats
 */
router.get('/music-stats', async (ctx) => {
  try {
    const { musicDB } = await import('../client/database.js');
    
    const stats = await new Promise((resolve) => {
      Promise.all([
        new Promise((res) => musicDB.count({ type: 'track' }, (err, count) => res(err ? 0 : count))),
        new Promise((res) => musicDB.count({ type: 'album' }, (err, count) => res(err ? 0 : count))),
        new Promise((res) => musicDB.count({ type: 'artist' }, (err, count) => res(err ? 0 : count))),
        new Promise((res) => musicDB.count({ type: 'genre' }, (err, count) => res(err ? 0 : count)))
      ]).then(([tracks, albums, artists, genres]) => {
        resolve({
          tracks,
          albums,
          artists,
          genres
        });
      }).catch(() => {
        resolve({
          tracks: 0,
          albums: 0,
          artists: 0,
          genres: 0
        });
      });
    });
    
    ctx.body = {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('获取音乐统计失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '获取音乐统计失败'
    };
  }
});

export default router;