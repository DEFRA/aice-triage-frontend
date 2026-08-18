import { afterEach, describe, expect, test, vi } from 'vitest'

import { config } from '../../../src/config/config.js'

describe('auth config', () => {
  test('clientSecret does not appear in masked config output', () => {
    process.env.ENTRA_CLIENT_SECRET = 'super-secret-test-value'
    config.load({})
    config.validate({ allowed: 'strict' })

    expect(config.toString()).not.toContain('super-secret-test-value')
  })

  describe('in production', () => {
    beforeEach(() => {
      // Satisfies the other production-only required fields (auth.provider
      // already defaults to 'entra' and the ENTRA_* fields are set globally
      // in vitest.setup.js) so only auth.provider's format restriction is
      // under test here.
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.stubEnv('REDIS_USERNAME', 'test-redis-user')
      vi.stubEnv('REDIS_PASSWORD', 'test-redis-password')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    test('restricts auth.provider to entra only', async () => {
      const { config: productionConfig } = await import('../../../src/config/config.js')

      productionConfig.set('auth.provider', 'local')

      expect(() => productionConfig.validate({ allowed: 'strict' })).toThrow()
    })

    test('allows auth.provider to be entra', async () => {
      const { config: productionConfig } = await import('../../../src/config/config.js')

      expect(() => productionConfig.validate({ allowed: 'strict' })).not.toThrow()
    })
  })
})
