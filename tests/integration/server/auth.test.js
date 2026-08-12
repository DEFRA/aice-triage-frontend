import Jwt from '@hapi/jwt'

import { createServer } from '../../../src/server/server.js'

function registerSessionCookieRoute (server) {
  server.route({
    method: 'GET',
    path: '/__test-set-session-cookie',
    options: { auth: false },
    handler: (request, h) =>
      h.response('ok').state('auth-session', JSON.parse(request.query.state))
  })
}

async function getSessionCookieHeader (server, sessionState) {
  const { headers } = await server.inject({
    method: 'GET',
    url: `/__test-set-session-cookie?state=${encodeURIComponent(JSON.stringify(sessionState))}`
  })

  return headers['set-cookie'][0].split(';')[0]
}

describe('auth routes', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('GET /login redirects (kicks off the azure/bell strategy)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/login'
    })

    expect(statusCode).toBe(302)
  })

  test('GET /logout clears the session and redirects to /login', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/logout',
      auth: {
        strategy: 'session',
        credentials: {
          isAuthenticated: true,
          id: 'test-id',
          displayName: 'Jane Smith',
          email: 'jane.smith@defra.gov.uk'
        }
      }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/login')
  })

  test('a subsequent unauthenticated request is rejected after logout', async () => {
    server.route({
      method: 'GET',
      path: '/__test-protected-route',
      handler: () => 'ok'
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/__test-protected-route'
    })

    expect(statusCode).not.toBe(200)
  })

  test('GET /login/callback redirects to / and stores the session on successful authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/login/callback',
      auth: {
        strategy: 'azure',
        credentials: {
          profile: {
            id: 'entra-id-123',
            displayName: 'Jane Smith',
            email: 'jane.smith@defra.gov.uk'
          },
          token: 'provider-token'
        }
      }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/')
  })

  test('GET /login/callback fails when the provider reports access was denied', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/login/callback?error=access_denied'
    })

    expect(statusCode).toBe(500)
  })

  describe('session cookie validation', () => {
    beforeAll(() => {
      registerSessionCookieRoute(server)

      server.route({
        method: 'GET',
        path: '/__test-protected-route-2',
        handler: () => 'ok'
      })
    })

    test('rejects a request when there is no cached session for the cookie', async () => {
      const cookie = await getSessionCookieHeader(server, {
        id: 'unknown-session-id'
      })

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/__test-protected-route-2',
        headers: { cookie }
      })

      expect(statusCode).not.toBe(200)
    })

    test('rejects a request when the cached token is invalid', async () => {
      const sessionId = 'invalid-token-session'

      await server.app.cache.set(sessionId, {
        isAuthenticated: true,
        id: sessionId,
        displayName: 'Jane Smith',
        email: 'jane.smith@defra.gov.uk',
        token: 'not-a-valid-jwt'
      })

      const cookie = await getSessionCookieHeader(server, { id: sessionId })

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/__test-protected-route-2',
        headers: { cookie }
      })

      expect(statusCode).not.toBe(200)
    })

    test('allows a request when the cached token is valid', async () => {
      const sessionId = 'valid-token-session'
      const token = Jwt.token.generate(
        { sub: sessionId },
        'a-test-secret-that-is-long-enough'
      )

      await server.app.cache.set(sessionId, {
        isAuthenticated: true,
        id: sessionId,
        displayName: 'Jane Smith',
        email: 'jane.smith@defra.gov.uk',
        token
      })

      const cookie = await getSessionCookieHeader(server, { id: sessionId })

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/__test-protected-route-2',
        headers: { cookie }
      })

      expect(statusCode).toBe(200)
    })
  })
})
