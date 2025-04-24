import Koa from 'koa'
import koa_etag from 'koa-etag'
import koa_static from 'koa-static'
import koa_compress from 'koa-compress'
import koa_json from 'koa-json'
import koa_body from 'koa-body'
import koa_session from 'koa-session'

import routers from './src/api/index.js'
import middlewares from './src/middlewares/index.js'
import vite from './src/vite.js'

const app = new Koa()
app.use(koa_etag())
app.use(koa_compress({ threshold: 2048 }))
app.use(koa_json())
app.use(koa_body.koaBody({
  multipart: true,
  jsonStrict: false,
  formidable: {
    uploadDir: process.cwd() + '/upload',
    keepExtensions: true,
    multipart: true,
    onFileBegin: (name, file) => {
      const ext = path.extname(file.originalFilename)
      const filename = path.basename(file.originalFilename, ext)
      file.date = DateUtil.date(new Date(), 'YYYY-MM-DD') 
      const filepath = `${process.cwd()}/upload/${file.date}`
      if(!fs.existsSync(filepath)){ fs.mkdirsSync(filepath) }
      file.newFilename = `${filename}.${Date.now()}${ext}`
      file.filepath = `${filepath}/${file.newFilename}`
    }
  }
}))
app.use(koa_static('./web/public'), { maxAge : 7 * 24 * 60 * 60 * 1000 })
app.use(koa_session({key: 'SESSIONID', overwrite: true, rolling: true, renew: true, maxAge: 60 * 60 * 1000}, app))

middlewares.forEach(middleware => middleware && app.use(middleware))
vite(app)

routers.forEach(config => {
  const module = config.module
  config.prefix && module.prefix(config.prefix)
  app.use(module.routes(), module.allowedMethods())
})

process.on("uncaughtException", function (err) {
  console.error(err, "Uncaught exception")
})

process.on("unhandledRejection", (reason, promise) => {
  console.error({ promise, reason }, "Unhandled Rejection at: Promise")
})

app.listen(process.env.PORT || 3000, () => {
  console.log('Server start at: http://localhost:' + (process.env.PORT || 3000))
})