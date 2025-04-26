
import fs from 'fs'

const ENV = process.env.NODE_ENV.trim().toLowerCase()

const module_template = `
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import App from '#/<!--app-component-path-->'

if(typeof document != 'undefined'){
  createRoot(document.getElementById('root')).render(<App init_data={__PAGE_INIT_DATA__}/>)
}
export function render(props) {
  return renderToString(<App init_data={props}/>)
}
`

const html_template = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><!--app-title--></title>
    <script><!--app-init-data--></script>
  </head>
  <body>
    <div id="root"><!--app-html--></div>
    <script type="module" src="<!--app-client-runtime-->"></script>
  </body>
</html>
`

const getModulePath = (path) => {
  const base = '.runtime/' + Buffer.from(path, 'utf-8').toString('base64')
  const jsxPath = base + '.jsx'
  if(!fs.existsSync(jsxPath)){
    !fs.existsSync('.runtime') && fs.mkdirSync('.runtime')
    fs.writeFileSync(jsxPath, module_template.replace('<!--app-component-path-->', path))
  }
  return { jsxPath }
}

const renderViteBind = (ctx) => {
  return async(page, data) => {
    if(ENV == 'dev'){ data.DEV = true }
    const vite = ctx.app.vite
    ctx.set('Content-Type', 'text/html')
    const { jsxPath } = getModulePath(page)
    const template = await vite.transformIndexHtml(ctx.path, html_template)
    const { render } = await vite.ssrLoadModule(jsxPath)
    const html = await render(data)
    ctx.body = template.replace('<!--app-title-->', data.title || '')
                      .replace('<!--app-html-->', html)
                      .replace('<!--app-client-runtime-->', '/' + jsxPath)
                      .replace('<!--app-init-data-->', `const __PAGE_INIT_DATA__ = ${JSON.stringify(data || {})};`)
  }
}

export default async(ctx, next) => {
  ctx.renderVite = renderViteBind(ctx)
  await next()
}