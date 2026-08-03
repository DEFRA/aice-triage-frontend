import { statusCodes } from '../../constants/status-codes.js'

import { config } from '../../config/config.js'

const serveStaticFiles = {
  plugin: {
    name: 'serveStaticFiles',
    register (server) {
      server.route([
        {
          options: {
            auth: false,
            cache: {
              expiresIn: config.get('staticCacheTimeout'),
              privacy: 'private'
            }
          },
          method: 'GET',
          path: '/favicon.ico',
          handler (_request, h) {
            return h.response().code(statusCodes.HTTP_STATUS_NO_CONTENT).type('image/x-icon')
          }
        },
        {
          options: {
            auth: false,
            cache: {
              expiresIn: config.get('staticCacheTimeout'),
              privacy: 'private'
            }
          },
          method: 'GET',
          path: `${config.get('assetPath')}/{param*}`,
          handler: {
            directory: {
              path: '.',
              redirectToSlash: true
            }
          }
        }
      ])
    }
  }
}

export {
  serveStaticFiles
}
