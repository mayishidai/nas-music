import user from './user.js'
import web from './web.js'

export default [
  { prefix: '/api/user', module: user },
  { prefix: '/', module: web }
]