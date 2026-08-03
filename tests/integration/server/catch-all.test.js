import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../src/server/server.js'

describe('#catchAll integration', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected Not Found page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/non-existent-path'
    })

    expect(result).toEqual(
      expect.stringContaining('Page not found | AICE Triage Automation')
    )
    expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
  })
})
