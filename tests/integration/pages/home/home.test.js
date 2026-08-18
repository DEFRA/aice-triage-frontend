import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../helpers/login.js'

describe('#homepageController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('Should respond with 200 and render the home page', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('When not logged in', () => {
    test('Should respond with 302 and redirect to /login', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/login')
    })
  })
})
