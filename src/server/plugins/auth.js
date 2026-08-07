import Bell from '@hapi/bell'
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
    location: config.get('auth.redirectUri'),
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

async function _validateSessionToken (request, session) {
  const userSession = await request.server.app.cache.get(session.id)

  if (!userSession) {
    return { isValid: false }
  }

  try {
    const decoded = Jwt.token.decode(userSession.token)

    Jwt.token.verifyTime(decoded)
  } catch (error) {
    request.server.logger.info('Session JWT token is invalid or has expired')

    return { isValid: false }
  }

  return { isValid: true, credentials: { ...userSession, sessionId: session.id } }
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
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
