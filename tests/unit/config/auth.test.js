import { config } from '../../../src/config/config.js'

describe('auth config', () => {
  test('clientSecret does not appear in masked config output', () => {
    process.env.ENTRA_CLIENT_SECRET = 'super-secret-test-value'
    config.load({})
    config.validate({ allowed: 'strict' })

    expect(config.toString()).not.toContain('super-secret-test-value')
  })
})
