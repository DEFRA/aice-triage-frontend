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
    const { statusCode, payload } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('RPA Guidance AI Usecase PoC')
  })

  test('Should contain a link to guidance documents', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(payload).toContain('/guidance-documents')
    expect(payload).toContain('Guidance documents')
  })

  test('Should link to the AI agent tools', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(payload).toContain('Guidance pre-publishing checks')
    expect(payload).toContain('/publishing-checks')
    expect(payload).toContain('Guidance content review')
    expect(payload).toContain('/content-review')
  })

  test('Should not contain a link to /getting-started', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(payload).not.toContain('/getting-started')
  })
})
