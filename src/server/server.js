import path from 'node:path'

import { metrics } from '@defra/cdp-metrics'
import { secureContext } from '@defra/hapi-secure-context'

import Hapi from '@hapi/hapi'
import HapiCookie from '@hapi/cookie'
import HapiInert from '@hapi/inert'
import Scooter from '@hapi/scooter'
import HapiPino from 'hapi-pino'

import { config } from '../config/config.js'
import { catchAll } from './catch-all.js'
import { options as loggerOptions } from '../infra/logging/options.js'

import { auth } from './plugins/auth.js'
import { contentSecurityPolicy } from './plugins/content-security-policy.js'
import { requestTracing } from './plugins/request-tracing.js'
import { router } from './plugins/router.js'
import { serveStaticFiles } from './plugins/serve-static-files.js'
import { sessionCache } from './plugins/session-cache/session-cache.js'
import { getCacheEngine } from './plugins/session-cache/cache-engine.js'
import { viewPlugin } from './plugins/views.js'
import { pulse } from './plugins/pulse.js'

/**
 * Creates and configures a Hapi.Server instance
 *
 * @returns {Promise<Hapi.Server>} A promise representing a Hapi server instance
 */
async function createServer () {
  const server = Hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false,
          // Forms include a hidden `_csrf` field (template convention); strip
          // unvalidated keys so they don't fail strict object validation.
          stripUnknown: true
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: 'sameorigin'
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: {
      strictHeader: false
    }
  })

  await server.register({
    plugin: HapiPino,
    options: loggerOptions
  })

  const plugins = [
    requestTracing,
    metrics,
    secureContext,
    pulse,
    sessionCache,
    HapiCookie,
    Scooter,
    contentSecurityPolicy,
    HapiInert,
    serveStaticFiles,
    viewPlugin,
    auth,
    router
  ]

  server.app.cache = server.cache({
    cache: config.get('session.cache.name'),
    segment: 'auth-session',
    expiresIn: config.get('session.cache.ttl')
  })

  await server.register(plugins)

  server.ext('onPreResponse', catchAll)

  return server
}

/**
 * Helper function to start the Hapi server
 *
 * @param {Hapi.Server} server - The Hapi server instance to start
 *
 * @returns {Promise<void>} A promise that resolves when the server has started
 */
async function startServer (server) {
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your frontend on http://localhost:${config.get('port')}`
  )
}

export { createServer, startServer }
