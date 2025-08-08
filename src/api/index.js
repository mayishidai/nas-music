import web from './web.js'
import music from './music.js'
import settings from './settings.js'

export default [
  { module: web, prefix: '/' },
  { module: music, prefix: '/api/music' },
  { module: settings, prefix: '/api/settings' },
]
