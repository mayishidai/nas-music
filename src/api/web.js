import Router from 'koa-router'
import config from '#config/index.js'

const pages = await import(`../../pages.json`, { assert: { type: 'json' } }).then(m => m.default)

const router = new Router()

router.get('/401', async (ctx, next) => {
  await ctx.renderVite(pages.error_401, {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

router.get('/404', async (ctx, next) => {
  await ctx.renderVite(pages.error_404, {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

router.get('/', async (ctx, next) => {
  console.log('GET', pages.page1)
  await ctx.renderVite(pages.page1, {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

router.get('/page2', async (ctx, next) => {
  await ctx.renderVite(pages.page2, {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

router.post('/post_page', async (ctx, next) => {
  console.log('POST', ctx.request.body)
  await ctx.renderVite(pages.post_page, {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

export default router