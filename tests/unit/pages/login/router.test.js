import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

async function getLoginRouter () {
  const { loginRouter } = await import('../../../../src/pages/login/router.js')

  return loginRouter
}

function getCallbackRoute (mockServer) {
  const [routes] = mockServer.route.mock.calls[0]

  return routes.find((route) => route.path === '/login/callback')
}

describe('#loginRouter', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('when AUTH_PROVIDER is local', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'local')
      vi.resetModules()
    })

    test('disables auth on the /login/callback route', async () => {
      const loginRouter = await getLoginRouter()
      const mockServer = { route: vi.fn() }

      loginRouter.plugin.register(mockServer)

      expect(getCallbackRoute(mockServer).options.auth).toBe(false)
    })
  })

  describe('when AUTH_PROVIDER is entra', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.resetModules()
    })

    test('requires the entra bell strategy, in try mode, on the /login/callback route', async () => {
      const loginRouter = await getLoginRouter()
      const mockServer = { route: vi.fn() }

      loginRouter.plugin.register(mockServer)

      expect(getCallbackRoute(mockServer).options.auth).toEqual({
        mode: 'try',
        strategy: 'entra'
      })
    })
  })
})
