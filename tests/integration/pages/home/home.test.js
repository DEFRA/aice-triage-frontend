import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'

describe('#homepageController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should respond with 200 and render the home page', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  })

  test('Should show a sign in link when not authenticated', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(payload).toContain('Sign in')
    expect(payload).not.toContain('Sign out')
  })

  test('Should show a sign out link when authenticated', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/',
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

    expect(payload).toContain('Sign out')
    expect(payload).not.toContain('Sign in')
  })
})
