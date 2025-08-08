import Router from 'koa-router';
import axios from 'axios';
import { getConfig, saveConfig, musicDB, configDB } from '../client/database.js';
import fs from 'fs/promises';
import path from 'path';

const router = new Router();

// 扫描进度存储
const scanProgress = new Map();

/**
 * 获取所有音乐文件
 */
async function getAllMusicFiles(dirPath) {
  const musicExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
  const musicFiles = [];
  
  async function scanDirectory(currentPath) {
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (musicExtensions.includes(ext)) {
            musicFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${currentPath}`, error);
    }
  }
  
  await scanDirectory(dirPath);
  return musicFiles;
}

/**
 * 处理音乐文件
 */
async function processMusicFile(filePath) {
  try {
    // 这里可以集成 music-metadata 库来提取音乐文件信息
    // 示例返回基本文件信息
    const fileName = path.basename(filePath, path.extname(filePath));
    const stat = await fs.stat(filePath);
    
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: fileName,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      path: filePath,
      duration: 0,
      size: stat.size,
      addedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`处理音乐文件失败: ${filePath}`, error);
    return null;
  }
}

/**
 * 异步扫描媒体库
 */
async function scanMediaLibraryAsync(library) {
  const { id, path: libraryPath } = library;
  
  try {
    console.log(`开始扫描媒体库: ${libraryPath}`);
    
    // 获取所有音乐文件
    const musicFiles = await getAllMusicFiles(libraryPath);
    const totalFiles = musicFiles.length;
    
    // 更新进度
    scanProgress.set(id, {
      status: 'scanning',
      progress: 0,
      currentFile: '',
      totalFiles,
      processedFiles: 0
    });
    
    let processedFiles = 0;
    const processedTracks = [];
    
    // 逐个处理文件
    for (const filePath of musicFiles) {
      try {
        // 更新当前处理的文件
        scanProgress.set(id, {
          status: 'scanning',
          progress: Math.round((processedFiles / totalFiles) * 100),
          currentFile: path.basename(filePath),
          totalFiles,
          processedFiles
        });
        
        // 处理音乐文件
        const trackInfo = await processMusicFile(filePath);
        if (trackInfo) {
          processedTracks.push(trackInfo);
        }
        
        processedFiles++;
        
        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
      }
    }
    
    // 更新媒体库统计信息
    await updateMediaLibraryStats(id, processedTracks);
    
    // 完成扫描
    scanProgress.set(id, {
      status: 'completed',
      progress: 100,
      currentFile: '',
      totalFiles,
      processedFiles,
      result: {
        tracks: processedTracks.length,
        albums: new Set(processedTracks.map(t => t.album)).size,
        artists: new Set(processedTracks.map(t => t.artist)).size
      }
    });
    
    console.log(`媒体库扫描完成: ${libraryPath}, 处理了 ${processedTracks.length} 个文件`);
    
  } catch (error) {
    console.error(`扫描媒体库失败: ${libraryPath}`, error);
    
    // 扫描失败
    scanProgress.set(id, {
      status: 'failed',
      progress: 0,
      currentFile: '',
      totalFiles: 0,
      processedFiles: 0,
      error: error.message
    });
  }
}

/**
 * 更新媒体库统计信息
 */
async function updateMediaLibraryStats(libraryId, processedTracks) {
  return new Promise((resolve, reject) => {
    const stats = {
      trackCount: processedTracks.length,
      albumCount: new Set(processedTracks.map(t => t.album)).size,
      artistCount: new Set(processedTracks.map(t => t.artist)).size,
      lastScanned: new Date().toISOString()
    };
    
    configDB.update(
      { _id: 'media_library_' + libraryId },
      { $set: stats },
      { upsert: true },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats);
        }
      }
    );
  });
}

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
    const config = await getConfig();
    const libraries = [];
    
    // 从配置中获取媒体库路径
    for (const libraryPath of config.musicLibraryPaths || []) {
      const libraryId = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      
      // 获取媒体库统计信息
      const stats = await new Promise((resolve) => {
        configDB.findOne({ _id: 'media_library_' + libraryId }, (err, doc) => {
          resolve(doc || {
            trackCount: 0,
            albumCount: 0,
            artistCount: 0,
            lastScanned: null
          });
        });
      });
      
      libraries.push({
        id: libraryId,
        path: libraryPath,
        trackCount: stats.trackCount || 0,
        albumCount: stats.albumCount || 0,
        artistCount: stats.artistCount || 0,
        createdAt: stats.createdAt || new Date().toISOString(),
        lastScanned: stats.lastScanned
      });
    }
    
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
    
    // 验证路径是否存在
    try {
      await fs.access(libraryPath);
    } catch {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '媒体库路径不存在或无法访问'
      };
      return;
    }
    
    const config = await getConfig();
    
    // 检查是否已存在
    if (config.musicLibraryPaths && config.musicLibraryPaths.includes(libraryPath)) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '媒体库路径已存在'
      };
      return;
    }
    
    // 添加新媒体库
    if (!config.musicLibraryPaths) {
      config.musicLibraryPaths = [];
    }
    config.musicLibraryPaths.push(libraryPath);
    
    await saveConfig(config);
    
    const libraryId = Buffer.from(libraryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    
    ctx.body = {
      success: true,
      data: {
        id: libraryId,
        path: libraryPath,
        trackCount: 0,
        albumCount: 0,
        artistCount: 0,
        createdAt: new Date().toISOString()
      },
      message: '媒体库添加成功'
    };
  } catch (error) {
    console.error('添加媒体库失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '添加媒体库失败'
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
    const config = await getConfig();
    
    // 找到对应的路径
    const libraryPath = config.musicLibraryPaths?.find(path => {
      const pathId = Buffer.from(path).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      return pathId === id;
    });
    
    if (!libraryPath) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: '媒体库不存在'
      };
      return;
    }
    
    // 从配置中移除
    config.musicLibraryPaths = config.musicLibraryPaths.filter(path => path !== libraryPath);
    await saveConfig(config);
    
    // 删除统计信息
    configDB.remove({ _id: 'media_library_' + id }, {});
    
    ctx.body = {
      success: true,
      message: '媒体库删除成功'
    };
  } catch (error) {
    console.error('删除媒体库失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '删除媒体库失败'
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
    const config = await getConfig();
    
    // 找到对应的路径
    const libraryPath = config.musicLibraryPaths?.find(path => {
      const pathId = Buffer.from(path).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      return pathId === id;
    });
    
    if (!libraryPath) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: '媒体库不存在'
      };
      return;
    }
    
    const library = { id, path: libraryPath };
    
    // 初始化扫描进度
    scanProgress.set(id, {
      status: 'scanning',
      progress: 0,
      currentFile: '',
      totalFiles: 0,
      processedFiles: 0
    });
    
    // 异步开始扫描
    scanMediaLibraryAsync(library);
    
    ctx.body = {
      success: true,
      message: '扫描已开始'
    };
  } catch (error) {
    console.error('开始扫描失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '开始扫描失败'
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
    const progress = scanProgress.get(id);
    
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