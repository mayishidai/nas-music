
import fs from 'fs'
import pages from '#web/index.js'


const module_server_template = `
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from '#web/<!--app-component-path-->'

export function render(url) {
  return renderToString(<StrictMode><App /></StrictMode>)
}
`
const module_client_template = `
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '#web/<!--app-component-path-->'

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
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

const getModulePath = (path) => {
  const _path = '.runtime/' + Buffer.from(path, 'utf-8').toString('base64')
  const server = _path + '.server.jsx'
  const client = _path + '.client.jsx'
  if(!fs.existsSync(_path)){
    !fs.existsSync('.runtime') && fs.mkdirSync('.runtime')
    fs.writeFileSync(_path + '.server.jsx', module_server_template.replace('<!--app-component-path-->', path))
    fs.writeFileSync(_path + '.client.jsx', module_client_template.replace('<!--app-component-path-->', path))
  }
  return {server, client}
}

export default async(ctx, next) => {
  if(ctx.status == 200 || !ctx.app.vite){
    await next()
    return
  }
  const vite = ctx.app.vite
  const page = pages.find(page => page.path == ctx.path)
  if(page){
    const {server, client} = getModulePath(page.component)
    const template = await vite.transformIndexHtml(page.path, html_template)
    const { render } = await vite.ssrLoadModule(server)
    const html = await render('./' + page.component, ctx.path)
    ctx.set('Content-Type', 'text/html')
    ctx.body = template.replace('<!--app-title-->', page.title).replace('<!--app-html-->', html).replace('<!--app-client-runtime-->', '/' + client)
  }else{
    await next()
  }
}