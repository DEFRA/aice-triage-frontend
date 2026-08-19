import { config } from '../../config/config.js'
import * as controller from './controller.js'

const callbackAuth = config.get('auth.provider') === 'entra'
  ? { mode: 'try', strategy: 'entra' }
  : false

const routes = [
  {
    method: 'GET',
    path: '/login',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: controller.getLogin
  },
  {
    method: 'GET',
    path: '/login/callback',
    options: {
      auth: callbackAuth
    },
    handler: controller.handleLoginCallback
  },
  {
    method: 'GET',
    path: '/logout',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session'
      }
    },
    handler: controller.logout
  }
]

const loginRouter = {
  plugin: {
    name: 'loginRouter',
    register (server) {
      server.route(routes)
    }
  }
}

export {
  loginRouter
}
