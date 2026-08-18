import { randomUUID as uuidv4 } from 'node:crypto'

import Boom from '@hapi/boom'
import Jwt from '@hapi/jwt'

import { config } from '../../config/config.js'
import { createLogger } from '../../infra/logging/logger.js'
import { buildErrorLog } from '../../infra/logging/utils/build-error-log.js'
import { mockUser } from './mock-user.js'

const logger = createLogger()

const AUTH_FAIL_MESSAGE = 'Authentication failed. Please try again.'

/**
 * GET /login — renders the sign-in page.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function getLogin (request, h) {
  if (request.auth.isAuthenticated) {
    return h.redirect('/')
  }

  return h.view('login/login.njk', {
    pageTitle: 'Sign in'
  })
}

/**
 * GET /login/callback (Redirect URI) — shared by both auth providers.
 *
 * For the 'entra' provider this is a genuine OIDC redirect URI: Bell
 * provides request.auth.isAuthenticated and request.auth.credentials, and
 * the id_token is verified against Entra's JWKS. For the 'local' provider
 * this route has no strategy attached at all (see `login/router.js`) - it
 * shadows the same URL and just writes a fixed mock session, with no OAuth
 * round-trip.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function handleLoginCallback (request, h) {
  const { profile, token, refreshToken } = config.get('auth.provider') === 'entra'
    ? await _getEntraSession(request)
    : _getDevSession()

  const sessionId = uuidv4()
  const storedSessionId = `auth-session:${sessionId}`

  await request.server.app.cache.set(storedSessionId, { profile, token, refreshToken })

  request.cookieAuth.set({ sessionId })

  return h.redirect('/')
}

/**
 * GET /logout — clears the authentication session and redirects to /login.
 *
 * Only the authentication session (cookie + cached credentials) is cleared
 * here. Application/user-entered data stored in `request.yar` is
 * intentionally left untouched, so an expired or ended auth session does
 * not destroy in-progress application state.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function logout (request, h) {
  if (request.auth.isAuthenticated) {
    const { sessionId } = request.auth.credentials

    await request.server.app.cache.drop(`auth-session:${sessionId}`)
    request.cookieAuth.clear()
  }

  return h.redirect('/login')
}

/**
 * @private
 * Validates the Bell-authenticated Entra callback and verifies its
 * id_token against Entra's JWKS.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<{ profile: object, token: string, refreshToken: string }>}
 */
async function _getEntraSession (request) {
  if (!request.auth.isAuthenticated) {
    logger.warn(buildErrorLog(request.auth.error, {
      type: 'entra_bell_authentication_failed'
    }))

    throw Boom.unauthorized(AUTH_FAIL_MESSAGE)
  }

  const { profile, token, idToken, refreshToken } = request.auth.credentials

  try {
    await request.server.verifyEntraToken(idToken)
  } catch (error) {
    logger.warn(buildErrorLog(error, {
      type: 'entra_token_verification_failed'
    }))

    throw Boom.unauthorized(AUTH_FAIL_MESSAGE)
  }

  return { profile, token, refreshToken }
}

/**
 * @private
 * Builds a mock user session for local development, standing in for a
 * completed Entra ID sign-in without performing any OAuth round-trip.
 *
 * The token must still be a well-formed JWT (with a future `exp`) because
 * `_validateSessionToken` in `server/plugins/auth.js` decodes and
 * time-checks whatever token is stored in the session on every subsequent
 * request, regardless of provider - it just isn't signature-verified for
 * local auth.
 *
 * @returns {{ token: string, profile: object }}
 */
function _getDevSession () {
  const token = Jwt.token.generate(
    { sub: 'dev-user-123' },
    { key: 'dev-auth-mock-key', algorithm: 'HS256' },
    { ttlSec: config.get('session.cookie.ttl') / 1000 }
  )

  return {
    token,
    profile: mockUser
  }
}

export {
  getLogin,
  handleLoginCallback,
  logout
}
