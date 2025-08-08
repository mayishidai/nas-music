import Router from 'koa-router'

const router = new Router()

router.get('/', async (ctx, next) => {
  await ctx.renderVite('web/index.jsx')
})

export default router