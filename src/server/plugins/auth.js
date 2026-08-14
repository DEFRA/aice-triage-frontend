import Http from 'node:http'
import Https from 'node:https'

import Bell from '@hapi/bell'
import Wreck from '@hapi/wreck'
import HapiCookie from '@hapi/cookie'
import Jwt from '@hapi/jwt'

import { config } from '../../config/config.js'

function _getBellOptions () {
  return {
    provider: 'azure',
    config: {
      tenant: config.get('auth.tenantId')
    },
    clientId: config.get('auth.clientId'),
    clientSecret: config.get('auth.clientSecret'),
    password: config.get('session.cookie.password'),
    isSecure: config.get('session.cookie.secure'),
    location: (request) => `${config.get('auth.redirectHost')}/login/callback`,
    scope: ['openid', 'profile', 'User.Read']
  }
}

function _getCookieOptions () {
  return {
    cookie: {
      name: 'auth-session',
      path: '/',
      password: config.get('session.cookie.password'),
      isSecure: config.get('session.cookie.secure'),
      ttl: config.get('session.cookie.ttl')
    },
    redirectTo: '/login/callback',
    validate: _validateSessionToken
  }
}

/**
 * @private
 * Points Wreck - the HTTP client @hapi/bell uses internally for the OAuth
 * code/token exchange and profile lookup - at Node's global http/https
 * agents, instead of the dedicated agents it creates for itself at import
 * time.
 *
 * Outbound access in production goes through an egress proxy, which we rely
 * on Node's native `--use-env-proxy`/NODE_USE_ENV_PROXY support for: it makes
 * `http.globalAgent`/`https.globalAgent` route through the proxy configured
 * via HTTP_PROXY/HTTPS_PROXY/NO_PROXY.
 */
function _useProxyAwareWreckAgents () {
  Wreck.agents.http = Http.globalAgent
  Wreck.agents.https = Https.globalAgent
}

async function _validateSessionToken (request, session) {
  const userSession = request.yar.get('userAuth')

  if (!userSession) {
    return { isValid: false }
  }

  try {
    const decoded = Jwt.token.decode(userSession.token)

    Jwt.token.verifyTime(decoded)
  } catch (error) {
    request.server.logger.info(
      `Session JWT token is invalid or has expired: ${error.message}`
    )

    return { isValid: false }
  }

  return {
    isValid: true,
    credentials: { ...userSession, sessionId: session.id }
  }
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      _useProxyAwareWreckAgents()

      await server.register([Bell, HapiCookie])

      server.auth.strategy('session', 'cookie', _getCookieOptions())
      server.auth.strategy('azure', 'bell', _getBellOptions())

      if (config.get('auth.enabled')) {
        server.auth.default('session')
      }
    }
  }
}

export { auth }
