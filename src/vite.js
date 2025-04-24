
import fs from 'fs'
import { createServer as createViteServer } from 'vite'
import koaConnect from 'koa-connect'
import pages from '#web/index.js'
import react_plugin from '@vitejs/plugin-react-swc'

const module_template = `
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import App from '#web/<!--app-component-path-->'

if(typeof document != 'undefined'){
  createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
}
export function render(url) {
  return renderToString(<StrictMode><App /></StrictMode>)
}
`

const html_template = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><!--app-title--></title>
  </head>
  <body>
    <div id="root"><!--app-html--></div>
    <script type="module" src="<!--app-client-runtime-->"></script>
  </body>
</html>
`

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom', plugins: [react_plugin()] })

const getModulePath = (path) => {
  const base = '.runtime/' + Buffer.from(path, 'utf-8').toString('base64')
  const jsxPath = base + '.jsx'
  const htmlPath = base + '.html'
  if(!fs.existsSync(jsxPath)){
    !fs.existsSync('.runtime') && fs.mkdirSync('.runtime')
    fs.writeFileSync(jsxPath, module_template.replace('<!--app-component-path-->', path))
  }
  return { jsxPath, htmlPath }
}

export default (app) => {
  app.use(koaConnect(vite.middlewares))
  app.use(async(ctx, next) => {
    if(ctx.status == 200){
      await next()
      return
    }
    const page = pages.find(page => page.path == ctx.path)
    if(page){
      ctx.set('Content-Type', 'text/html')
      const { jsxPath, htmlPath } = getModulePath(page.component)
      if(fs.existsSync(htmlPath)){
        ctx.body = fs.readFileSync(htmlPath, 'utf-8')
        return
      }
      const template = await vite.transformIndexHtml(page.path, html_template)
      const { render } = await vite.ssrLoadModule(jsxPath)
      const html = await render('./' + page.component, ctx.path)
      ctx.body = template.replace('<!--app-title-->', page.title).replace('<!--app-html-->', html).replace('<!--app-client-runtime-->', '/' + jsxPath)
      fs.writeFileSync(htmlPath, ctx.body)
    }else{
      await next()
    }
  })
}