
const getDate = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() / 60
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}::${offset}`
}

export default async(ctx, next) => {
  ctx.start_time = Date.now()
  try {
    await next()
  } catch(e){
    ctx.error = e
    ctx.status = 500
    console.error(e)
  } finally {
    console.log(`[${getDate()}] ==> ${ctx.method} ${ctx.url} - ${ctx.status} - ${Date.now() - ctx.start_time}ms`)
  }
}