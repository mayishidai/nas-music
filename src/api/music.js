import Router from 'koa-router';

const router = new Router();

// 获取所有音乐
router.get('/tracks', async (ctx) => {
});

// 获取单条音乐详情
router.get('/tracks/:id', async (ctx) => {
});

// 收藏/取消收藏
router.put('/tracks/:id/favorite', async (ctx) => {
});

// 收藏列表
router.get('/favorites', async (ctx) => {
});

// 获取专辑列表
router.get('/albums', async (ctx) => {
});

// 获取艺术家列表
router.get('/artists', async (ctx) => {
});

// 获取专辑详情
router.get('/albums/:id', async (ctx) => {
});

// 获取艺术家详情
router.get('/artists/:id', async (ctx) => {
});

// 获取推荐音乐
router.get('/recommendations/:trackId', async (ctx) => {
});

// 流式播放音乐
router.get('/stream/:id', async (ctx) => {
});

// 记录最近播放
router.post('/recently-played/:id', async (ctx) => {
});

// 获取最近播放（按记录顺序返回，支持分页和搜索）
router.get('/recently-played', async (ctx) => {
});

export default router;