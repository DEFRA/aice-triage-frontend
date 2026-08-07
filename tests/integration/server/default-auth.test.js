import { createServer } from '../../../src/server/server.js'

describe('default auth protection', () => {
  let server

  beforeAll(async () => {
    server = await createServer()

    server.route({
      method: 'GET',
      path: '/__test-protected-route',
      handler: () => 'ok'
    })

    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('rejects an unauthenticated request to a route with no auth options', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/__test-protected-route'
    })

    expect(statusCode).not.toBe(200)
  })

  test('allows the same route when valid session credentials are injected', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/__test-protected-route',
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

    expect(statusCode).toBe(200)
  })
})
