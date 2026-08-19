import Http from 'node:http'
import Https from 'node:https'

import Bell from '@hapi/bell'
import Jwt from '@hapi/jwt'
import Wreck from '@hapi/wreck'
import JwksRsa from 'jwks-rsa'

import { config } from '../../config/config.js'
import { createLogger } from '../../infra/logging/logger.js'

const logger = createLogger()

const entraConfig = {
  tenantId: config.get('auth.entra.tenantId'),
  clientId: config.get('auth.entra.clientId'),
  clientSecret: config.get('auth.entra.clientSecret'),
  authorityHost: config.get('auth.entra.authorityHost'),
  redirectHost: config.get('auth.entra.redirectHost'),
  scopes: ['User.Read', 'openid', 'profile', 'email']
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      server.auth.strategy('session', 'cookie', _getCookieOptions())
      server.auth.default('session')

      if (config.get('auth.provider') === 'entra') {
        logger.info('Using Microsoft Entra ID for authentication')

        _useProxyAwareWreckAgents()

        await server.register(Bell)

        const jwksClient = _getJwksClient()

        server.auth.strategy('entra', 'bell', _getBellOptions())
        server.decorate('server', 'verifyEntraToken', (token) => _verifyEntraToken(token, jwksClient))
      } else {
        logger.info('Using dev authentication strategy (no external identity provider)')
      }
    }
  }
}

/**
 * @private
 * Creates a Bell options object used to configure the 'entra' authentication
 * strategy via @package {@link https://hapi.dev/module/bell/ Bell}.
 *
 * This uses Microsoft Entra ID (formerly Azure AD) as the identity provider
 * which provides the main auth strategy for the application.
 *
 * Bell's built-in 'azure' provider only surfaces the OAuth access_token,
 * which is scoped for Microsoft Graph (aud = Graph, not this app) and isn't
 * something we can or should verify ourselves. We wrap its `profile` hook to
 * also stash the OIDC id_token - whose aud is this app's clientId - onto
 * credentials so it can be verified against Entra's JWKS in
 * `_verifyEntraToken`.
 *
 * @returns {object} Bell.BellOptions
 */
function _getBellOptions () {
  const provider = Bell.providers.azure({
    tenant: entraConfig.tenantId
  })

  return {
    provider: {
      ...provider,
      profile: async function (credentials, params, get) {
        credentials.idToken = params.id_token

        await provider.profile.call(this, credentials, params, get)
      }
    },
    clientId: entraConfig.clientId,
    clientSecret: entraConfig.clientSecret,
    location: (_request) => `${entraConfig.redirectHost}/login/callback`,
    password: config.get('session.cookie.password'),
    isSecure: config.get('session.cookie.secure'),
    scope: entraConfig.scopes,
    // Force Entra to always show the credential prompt on `/login`, rather
    // than silently re-authenticating via its own SSO session. Without
    // this, signing out of the app (which only clears our local session,
    // not the user's Entra session) lets a user click "Sign in" and be
    // signed straight back in with no prompt.
    providerParams: { prompt: 'login' }
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

/**
 * @private
 * Builds the OpenID discovery/JWKS URI for the configured Entra tenant.
 *
 * @returns {string}
 */
function _getJwksUri () {
  return `${entraConfig.authorityHost}/${entraConfig.tenantId}/discovery/v2.0/keys`
}

/**
 * @private
 * Creates a jwks-rsa client for the configured Entra tenant. The client
 * caches and rate-limits signing key lookups internally, so token
 * verification doesn't hit the discovery endpoint on every sign-in.
 *
 * @returns {JwksRsa.JwksClient}
 */
function _getJwksClient () {
  return JwksRsa({
    jwksUri: _getJwksUri(),
    cache: true,
    rateLimit: true
  })
}

/**
 * @private
 * Verifies a JWT issued by Entra ID against the tenant's published JWKS,
 * checking the signature, issuer, audience and expiry.
 *
 * This is the one place trust in an Entra-issued token is established -
 * everywhere else (e.g. `_validateSessionToken`) treats an already-stored
 * session token as trusted and only re-checks its expiry.
 *
 * @param {string} token
 * @param {JwksRsa.JwksClient} jwksClient
 * @returns {Promise<object>} the verified token payload
 */
async function _verifyEntraToken (token, jwksClient) {
  const artifacts = Jwt.token.decode(token)
  const { kid } = artifacts.decoded.header

  const signingKey = await jwksClient.getSigningKey(kid)
  const publicKey = signingKey.getPublicKey()

  Jwt.token.verifySignature(artifacts, publicKey)
  Jwt.token.verifyPayload(artifacts, {
    aud: entraConfig.clientId,
    iss: `${entraConfig.authorityHost}/${entraConfig.tenantId}/v2.0`
  })

  return artifacts.decoded.payload
}

/**
 * @private
 * Creates an options object used to configure the 'session' authentication
 * strategy via @package {@link https://hapi.dev/module/cookie/ cookie}.
 *
 * This is used to maintain user sessions once authenticated via the
 * 'entra' (or local dev) strategy without triggering a complete OIDC
 * authentication flow for each request.
 *
 * @returns {object} CookieAuthOptions
 */
function _getCookieOptions () {
  return {
    cookie: {
      name: 'auth-session',
      password: config.get('session.cookie.password'),
      path: '/',
      isSecure: config.get('session.cookie.secure'),
      ttl: config.get('session.cookie.ttl')
    },
    redirectTo: '/login',
    validate: _validateSessionToken
  }
}

/**
 * @private
 * Validates that the authentication token issued by the identity provider
 * and stored in the server-side auth-session cache is still valid.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} session
 * @returns {Promise<{isValid: boolean, credentials?: object}>}
 */
async function _validateSessionToken (request, session) {
  const userSession = await request.server.app.cache.get(`auth-session:${session.sessionId}`)

  if (!userSession) {
    return { isValid: false }
  }

  try {
    const decoded = Jwt.token.decode(userSession.token)

    Jwt.token.verifyTime(decoded)
  } catch (error) {
    logger.warn(
      { type: 'auth_token_expired', error },
      'Session token invalid or has expired'
    )

    return { isValid: false }
  }

  return { isValid: true, credentials: { ...userSession, sessionId: session.sessionId } }
}

export { auth }
