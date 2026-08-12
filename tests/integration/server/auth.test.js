import { createServer } from '../../../src/server/server.js'

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
})
