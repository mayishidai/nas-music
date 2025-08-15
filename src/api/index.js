import web from './web.js'
import music from './music.js'
import settings from './settings.js'
import online from './online.js'

export default [
  { module: web, prefix: '/' },
  { module: music, prefix: '/api/music' },
  { module: settings, prefix: '/api/settings' },
  { module: online, prefix: '/api/online' },
]
