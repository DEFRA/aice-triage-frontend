import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../helpers/login.js'

describe('#loginController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When not logged in', () => {
    test('Should respond with 200 and render the login page', async () => {
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Sign in')
    })

    test('Should redirect an unauthenticated request for a protected page to /login', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/login')
    })
  })

  describe('When logged in as a dev user', () => {
    test('Should respond with 302 and redirect to the submissions queue when visiting /login', async () => {
      const cookie = await loginAsDevUser(server)

      const { headers, statusCode } = await server.inject({
        method: 'GET',
        url: '/login',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/submissions')
    })
  })

  describe('#handleLoginCallback', () => {
    test('Should establish a dev-session and redirect to /submissions when hitting the callback under the local provider', async () => {
      const callback = await server.inject({
        method: 'GET',
        url: '/login/callback'
      })

      expect(callback.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(callback.headers.location).toBe('/submissions')

      const cookie = (callback.headers['set-cookie'] ?? [])
        .map((c) => c.split(';')[0])
        .join('; ')
      expect(cookie).not.toBe('')

      // Confirms the dev-session profile was actually stored against the
      // session (not just that a cookie was set) - it flows through to the
      // shared layout's header on the next request.
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Dev User')
      expect(payload).toContain('Sign out')
    })
  })

  describe('#logout', () => {
    test('Should end the session and redirect to /login when authenticated', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/logout',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/login')

      // Confirms the cached session was actually dropped, not just the
      // cookie cleared client-side - reusing the original cookie should now
      // be treated as unauthenticated.
      const reuse = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

      expect(reuse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(reuse.headers.location).toBe('/login')
    })

    test('Should redirect to /login without requiring a session when not authenticated', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/logout'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/login')
    })
  })
})
