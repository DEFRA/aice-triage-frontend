import { createServer } from '../../../../src/server/server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toBeDefined()
  })

  test('Should include nonces in CSP header when enabled', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy'] || ''

    expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/)
    expect(csp).toMatch(/style-src[^;]*'nonce-[^']+'/)
  })
})
