
import { jsx } from "react/jsx-runtime"
import { renderToString } from "react-dom/server"
import react from '@vitejs/plugin-react-swc'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { build } from 'vite'
import fs from 'fs'

const ENV = process.env.NODE_ENV?.trim().toLowerCase()

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

const html_develop_template = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><!--app-title--></title>
    <script><!--app-init-data--></script>
  </head>
  <body style="margin:0; padding:0;">
    <div id="root"><!--app-html--></div>
    <script type="module" src="<!--app-client-runtime-->"></script>
  </body>
</html>
`

const getModulePath = async(path) => {
  const name = Buffer.from(path, 'utf-8').toString('base64')
  const jsxPath = '.runtime/' + name + '.jsx'
  const serverPath = '.runtime/server/' + name + '.js'
  const clientPath = '.runtime/client/' + name + '.js'
  if(!fs.existsSync(jsxPath)){
    !fs.existsSync('.runtime') && fs.mkdirSync('.runtime')
    fs.writeFileSync(jsxPath, module_template.replace('<!--app-component-path-->', path))
  }
  if(ENV == 'dev'){
    return { jsxPath, serverPath, clientPath }
  }
  if(!fs.existsSync(serverPath)){
    !fs.existsSync('.runtime/server/') && fs.mkdirSync('.runtime/server/')
    await build({ 
      plugins: [react()], 
      build: { 
        ssr: true, 
        emptyOutDir: false,
        rollupOptions: { 
          input: path,
          output: {
            dir: '.runtime/server/',
            entryFileNames: name + '.js'
          }
        } 
      } 
    })
  }
  if(!fs.existsSync(clientPath)){
    !fs.existsSync('.runtime/client/') && fs.mkdirSync('.runtime/client/')
    await build({ 
      plugins: [react(),cssInjectedByJsPlugin()], 
      build: { 
        minify: true, 
        emptyOutDir: false,
        rollupOptions: { 
          input: jsxPath,
          output: {
            dir: '.runtime/client/',
            entryFileNames: name + '.js'
          }
        } 
      } 
    })
  }
  return { jsxPath, serverPath, clientPath }
}

const renderViteBind = (ctx) => {
  return async(page, data={}) => {
    if(ENV == 'dev'){ data.DEV = true }
    ctx.set('Content-Type', 'text/html')
    const { jsxPath, serverPath, clientPath } = await getModulePath(page)
    if(ENV == 'dev'){
      const vite = ctx.app.vite
      const template = await vite.transformIndexHtml(ctx.path, html_develop_template)
      const { render } = await vite.ssrLoadModule(jsxPath)
      const html = await render(data)
      ctx.body = template.replace('<!--app-title-->', data.title || '')
                        .replace('<!--app-html-->', html)
                        .replace('<!--app-client-runtime-->', '/' + jsxPath)
                        .replace('<!--app-init-data-->', `const __PAGE_INIT_DATA__ = ${JSON.stringify(data || {})};`)
    }else{
      const Page = await import('../../' + serverPath).then(m => m.default)
      const html = renderToString(jsx(Page, { init_data: data || {} }))
      ctx.body = html_develop_template.replace('<!--app-title-->', data.title || '')
                        .replace('<!--app-html-->', html)
                        .replace('<!--app-client-runtime-->', '/' + clientPath.substring(16))
                        .replace('<!--app-init-data-->', `const __PAGE_INIT_DATA__ = ${JSON.stringify(data || {})};`)
    }
  }
}

export default async(ctx, next) => {
  ctx.renderVite = renderViteBind(ctx)
  await next()
}