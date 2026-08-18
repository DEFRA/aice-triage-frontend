import { createServer } from '../../../src/server/server.js'
import { loginAsDevUser } from '../helpers/login.js'

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

  test('allows the same route once logged in via the dev/local auth flow', async () => {
    const cookie = await loginAsDevUser(server)

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/__test-protected-route',
      headers: { cookie }
    })

    expect(statusCode).toBe(200)
  })
})
