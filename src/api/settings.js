import Router from 'koa-router';
import { getConfig, saveConfig, getMusicStats, updateState } from '../client/database.js';
import { getMediaLibraries, addMediaLibrary, deleteMediaLibrary, scanMediaLibrary, getScanProgress } from '../client/metadata.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const router = new Router();

/**
 * 获取API配置
 * GET /api/settings/api-configs
 */
router.get('/configs', async (ctx) => {
  const config = await getConfig();
  ctx.body = {
    success: true,
    data: config
  };
});

/**
 * 获取媒体库列表
 * GET /api/settings/media-libraries
 */
router.get('/media-libraries', async (ctx) => {
  const libraries = await getMediaLibraries();
  ctx.body = {
    success: true,
    data: libraries
  };
});

/**
 * 添加媒体库
 * POST /api/settings/media-libraries
 */
router.post('/media-libraries', async (ctx) => {
  const { path: libraryPath } = ctx.request.body;
  if (!libraryPath) {
    ctx.status = 400;
    ctx.body = { success: false, error: '媒体库路径不能为空' };
    return;
  }
  const newLibrary = await addMediaLibrary(libraryPath);
  scanMediaLibrary(newLibrary.id);
  ctx.body = { success: true, data: newLibrary, message: '媒体库添加成功'  };
});

/**
 * 删除媒体库
 * DELETE /api/settings/media-libraries/:id
 */
router.delete('/media-libraries/:id', async (ctx) => {
  const { id } = ctx.params;
  await deleteMediaLibrary(id);
  ctx.body = {
    success: true,
    message: '媒体库删除成功'
  };
});

/**
 * 扫描媒体库
 * POST /api/settings/media-libraries/:id/scan
 */
router.post('/media-libraries/:id/scan', async (ctx) => {
  const { id } = ctx.params;
  scanMediaLibrary(id);
  ctx.body = { success: true, message: '扫描已开始' };
});

/**
 * 媒体库状态更新
 * POST /api/settings/media-libraries/:id/update-state
 */
router.post('/media-libraries/:id/sync', async (ctx) => {
  const { id } = ctx.params;
  updateState(id);
  ctx.body = { success: true, message: '同步完成' };
});

/**
 * 获取扫描进度
 * GET /api/settings/media-libraries/:id/scan-progress
 */
router.get('/media-libraries/:id/scan-progress', async (ctx) => {
  const { id } = ctx.params;
  const progress = getScanProgress(id);
  ctx.body = { success: true, data: progress };
});

/**
 * 获取音乐统计信息
 * GET /api/settings/music-stats
 */
router.get('/music-stats', async (ctx) => {
  const stats = await getMusicStats();
  ctx.body = { success: true, data: stats };
});


/**
 * 保存刮削功能配置
 * PUT /api/settings/scraping
 */
router.put('/scraping', async (ctx) => {
  const { enabled } = ctx.request.body;
  if (typeof enabled !== 'boolean') {
    ctx.status = 400;
    ctx.body = { success: false, error: 'enabled参数必须是布尔值' };
    return;
  }
  const config = await getConfig();
  config.scrapingEnabled = enabled;
  await saveConfig(config);
  ctx.body = {
    success: true,
    data: { enabled },
    message: enabled ? '刮削功能已开启' : '刮削功能已关闭'
  };
});

/**
 * 立即刮削
 * POST /api/settings/start-scraping
 */
router.post('/scraping/start', async (ctx) => {
  updateState();
  // TODO: 这里应该实现具体的刮削逻辑
  // 目前仅返回成功响应，不做具体功能实现
  console.log('立即刮削API被调用，但未实现具体功能');
  
  ctx.body = {
    success: true,
    message: '立即刮削已开始',
    data: {
      startedAt: new Date().toISOString(),
      status: 'started'
    }
  };
});

export default router;