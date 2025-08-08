import Router from 'koa-router';
import fs from 'fs/promises';
import path from 'path';
import { musicDB, getConfig, saveConfig } from '../client/database.js';

const router = new Router();

// 获取媒体库路径列表
router.get('/paths', async (ctx) => {
  try {
    const config = await getConfig();
    const paths = [];
    
    for (let i = 0; i < config.musicLibraryPaths.length; i++) {
      const libraryPath = config.musicLibraryPaths[i];
      let status = 'unknown';
      let trackCount = 0;
      let size = 0;
      
      try {
        const stats = await fs.stat(libraryPath);
        if (stats.isDirectory()) {
          status = 'accessible';
          
          // 统计该路径下的音乐数量
          const result = await musicDB.find({
            selector: {
              type: 'track',
              path: { $regex: `^${libraryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
            },
            fields: ['_id', 'size']
          });
          
          trackCount = result.docs.length;
          size = result.docs.reduce((total, track) => total + (track.size || 0), 0);
        } else {
          status = 'not_directory';
        }
      } catch (error) {
        status = 'inaccessible';
      }
      
      paths.push({
        id: `path_${i}`,
        path: libraryPath,
        status,
        trackCount,
        size,
        addedAt: new Date().toISOString()
      });
    }
    
    ctx.body = {
      success: true,
      data: paths
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取媒体库路径失败: ' + error.message };
  }
});

// 添加媒体库路径
router.post('/paths', async (ctx) => {
  try {
    const { path: newPath } = ctx.request.body;
    
    if (!newPath) {
      ctx.status = 400;
      ctx.body = { error: '请提供路径' };
      return;
    }
    
    // 检查路径是否存在
    try {
      const stats = await fs.stat(newPath);
      if (!stats.isDirectory()) {
        ctx.status = 400;
        ctx.body = { error: '路径不是有效的目录' };
        return;
      }
    } catch (error) {
      ctx.status = 400;
      ctx.body = { error: '路径不存在或无法访问' };
      return;
    }
    
    const config = await getConfig();
    
    // 检查路径是否已存在
    if (config.musicLibraryPaths.includes(newPath)) {
      ctx.status = 400;
      ctx.body = { error: '路径已存在' };
      return;
    }
    
    config.musicLibraryPaths.push(newPath);
    await saveConfig(config);
    
    ctx.body = {
      success: true,
      message: '媒体库路径添加成功',
      data: { path: newPath }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '添加媒体库路径失败: ' + error.message };
  }
});

// 删除媒体库路径
router.delete('/paths/:id', async (ctx) => {
  try {
    const pathId = ctx.params.id;
    const pathIndex = parseInt(pathId.replace('path_', ''));
    
    const config = await getConfig();
    
    if (pathIndex < 0 || pathIndex >= config.musicLibraryPaths.length) {
      ctx.status = 404;
      ctx.body = { error: '路径不存在' };
      return;
    }
    
    const removedPath = config.musicLibraryPaths[pathIndex];
    config.musicLibraryPaths.splice(pathIndex, 1);
    await saveConfig(config);
    
    // 可选：删除该路径下的所有音乐记录
    const tracksToRemove = await musicDB.find({
      selector: {
        type: 'track',
        path: { $regex: `^${removedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
      }
    });
    
    for (const track of tracksToRemove.docs) {
      try {
        await musicDB.remove(track);
      } catch (error) {
        console.error('删除音乐记录失败:', error);
      }
    }
    
    ctx.body = {
      success: true,
      message: '媒体库路径删除成功',
      data: { 
        path: removedPath,
        removedTracks: tracksToRemove.docs.length
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '删除媒体库路径失败: ' + error.message };
  }
});

// 获取媒体库统计信息
router.get('/stats', async (ctx) => {
  try {
    const config = await getConfig();
    
    // 获取音乐统计
    const tracksResult = await musicDB.find({
      selector: { type: 'track' },
      fields: ['_id', 'size', 'duration']
    });
    
    const albumsResult = await musicDB.find({
      selector: { type: 'album' },
      fields: ['_id']
    });
    
    const artistsResult = await musicDB.find({
      selector: { type: 'artist' },
      fields: ['_id']
    });
    
    const totalSize = tracksResult.docs.reduce((sum, track) => sum + (track.size || 0), 0);
    const totalDuration = tracksResult.docs.reduce((sum, track) => sum + (track.duration || 0), 0);
    
    ctx.body = {
      success: true,
      data: {
        totalTracks: tracksResult.docs.length,
        totalAlbums: albumsResult.docs.length,
        totalArtists: artistsResult.docs.length,
        totalSize: totalSize,
        totalDuration: Math.round(totalDuration),
        libraryPaths: config.musicLibraryPaths.length,
        lastScan: config.lastScan || null
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取统计信息失败: ' + error.message };
  }
});

// 扫描进度状态
let scanProgress = {
  isScanning: false,
  progress: 0,
  status: '',
  results: null,
  startTime: null
};

// 开始扫描
router.post('/scan', async (ctx) => {
  try {
    const { fullScan = false } = ctx.request.body;
    
    if (scanProgress.isScanning) {
      ctx.status = 409;
      ctx.body = { error: '扫描正在进行中' };
      return;
    }
    
    scanProgress = {
      isScanning: true,
      progress: 0,
      status: '准备扫描...',
      results: null,
      startTime: new Date()
    };
    
    // 异步执行扫描
    performScan(fullScan).catch(error => {
      console.error('扫描失败:', error);
      scanProgress.isScanning = false;
      scanProgress.status = '扫描失败: ' + error.message;
    });
    
    ctx.body = {
      success: true,
      message: '扫描已开始'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '启动扫描失败: ' + error.message };
  }
});

// 获取扫描进度
router.get('/scan-progress', async (ctx) => {
  ctx.body = {
    success: true,
    data: {
      isScanning: scanProgress.isScanning,
      progress: scanProgress.progress,
      status: scanProgress.status,
      results: scanProgress.results,
      startTime: scanProgress.startTime
    }
  };
});

// 停止扫描
router.post('/scan/stop', async (ctx) => {
  scanProgress.isScanning = false;
  scanProgress.status = '扫描已停止';
  
  ctx.body = {
    success: true,
    message: '扫描已停止'
  };
});

// 执行扫描的函数（简化版本）
async function performScan(fullScan) {
  const config = await getConfig();
  let totalFound = 0;
  let errors = [];
  
  scanProgress.status = '开始扫描音乐库...';
  scanProgress.progress = 0;
  
  try {
    // 如果是完整扫描，先清除旧数据
    if (fullScan) {
      scanProgress.status = '清除旧数据...';
      const oldTracks = await musicDB.find({ selector: { type: 'track' } });
      
      for (const track of oldTracks.docs) {
        try {
          await musicDB.remove(track);
        } catch (error) {
          console.error('删除旧数据失败:', error);
        }
      }
    }
    
    scanProgress.progress = 50;
    scanProgress.status = '扫描完成';
    scanProgress.results = {
      totalFound,
      errors,
      duration: Date.now() - scanProgress.startTime.getTime()
    };
    
    // 更新配置中的最后扫描时间
    config.lastScan = new Date().toISOString();
    await saveConfig(config);
    
  } catch (error) {
    scanProgress.status = '扫描失败: ' + error.message;
    errors.push(error.message);
  } finally {
    scanProgress.isScanning = false;
    scanProgress.progress = 100;
  }
}

export default router;