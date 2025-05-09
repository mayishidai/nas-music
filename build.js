import fs from 'fs'
import { build } from 'vite'
import react from '@vitejs/plugin-react-swc'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

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
const buildResources = async(path) => {
  const name = Buffer.from(path, 'utf-8').toString('base64')
  const jsxPath = '.runtime/' + name + '.jsx'
  const serverPath = '.runtime/server/' + name + '.js'
  const clientPath = '.runtime/client/' + name + '.js'
  if(!fs.existsSync(jsxPath)){
    !fs.existsSync('.runtime') && fs.mkdirSync('.runtime')
    fs.writeFileSync(jsxPath, module_template.replace('<!--app-component-path-->', path))
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
}


const pages = await import(`./pages.json`, { assert: { type: 'json' } }).then(m => m.default)

fs.existsSync('.runtime') && fs.rmdirSync('.runtime', { recursive: true })
const pageKeys = Object.keys(pages)
for (const key of pageKeys) {
  console.log('build page:', key)
  await buildResources(pages[key])
}