import Router from 'koa-router'
import config from '#config/index.js'

const router = new Router()

router.get('/', async (ctx, next) => {
  await ctx.renderVite('web/pages/page1/index.jsx', {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

router.get('/page2', async (ctx, next) => {
  await ctx.renderVite('web/pages/page2/index.jsx', {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

router.post('/post_page', async (ctx, next) => {
  console.log('POST', ctx.request.body)
  await ctx.renderVite('web/pages/post_page/index.jsx', {
    data: config.data1,
    uuid: Math.random().toString(36).slice(2)
  })
})

export default router