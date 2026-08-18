import Jwt from '@hapi/jwt'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

function buildMockServer () {
  return {
    auth: {
      strategy: vi.fn(),
      default: vi.fn()
    },
    register: vi.fn().mockResolvedValue(),
    decorate: vi.fn()
  }
}

function getStrategyOptions (mockServer, strategyName) {
  const call = mockServer.auth.strategy.mock.calls.find(
    ([name]) => name === strategyName
  )

  return call?.[2]
}

async function getAuthPlugin () {
  const { auth } = await import('../../../../src/server/plugins/auth.js')

  return auth
}

describe('#auth plugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  describe('when AUTH_PROVIDER is local (dev auth)', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'local')
      vi.resetModules()
    })

    test('registers only the session strategy and sets it as default', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'session',
        'cookie',
        expect.any(Object)
      )
      expect(mockServer.auth.default).toHaveBeenCalledWith('session')
      expect(mockServer.register).not.toHaveBeenCalled()
      expect(mockServer.decorate).not.toHaveBeenCalled()
    })
  })

  describe('when AUTH_PROVIDER is entra', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.resetModules()
    })

    test('registers the session and entra (bell) strategies and decorates the server', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'session',
        'cookie',
        expect.any(Object)
      )
      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'entra',
        'bell',
        expect.any(Object)
      )
      expect(mockServer.auth.default).toHaveBeenCalledWith('session')
      expect(mockServer.register).toHaveBeenCalledOnce()
      expect(mockServer.decorate).toHaveBeenCalledWith(
        'server',
        'verifyEntraToken',
        expect.any(Function)
      )
    })
  })

  describe('session cookie options', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    test('redirects unauthenticated requests to /login', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      const options = getStrategyOptions(mockServer, 'session')

      expect(options.redirectTo).toBe('/login')
    })

    test('rejects when there is no cached session for the cookie', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      const options = getStrategyOptions(mockServer, 'session')
      const request = {
        server: { app: { cache: { get: vi.fn().mockResolvedValue(null) } } }
      }

      const result = await options.validate(request, { sessionId: 'unknown' })

      expect(result).toEqual({ isValid: false })
    })

    test('rejects when the cached token has expired', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      const options = getStrategyOptions(mockServer, 'session')
      const token = Jwt.token.generate(
        { sub: 'session-1' },
        'a-test-secret-that-is-long-enough'
      )

      vi.spyOn(Jwt.token, 'verifyTime').mockImplementation(() => {
        throw new Error('token has expired')
      })

      const request = {
        server: {
          app: {
            cache: {
              get: vi.fn().mockResolvedValue({
                profile: { displayName: 'Jane Smith' },
                token
              })
            }
          }
        }
      }

      const result = await options.validate(request, { sessionId: 'session-1' })

      expect(result).toEqual({ isValid: false })
    })

    test('accepts a request when the cached token is valid', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      const options = getStrategyOptions(mockServer, 'session')
      const token = Jwt.token.generate(
        { sub: 'session-1' },
        'a-test-secret-that-is-long-enough'
      )
      const storedSession = { profile: { displayName: 'Jane Smith' }, token }

      const request = {
        server: {
          app: { cache: { get: vi.fn().mockResolvedValue(storedSession) } }
        }
      }

      const result = await options.validate(request, { sessionId: 'session-1' })

      expect(result).toEqual({
        isValid: true,
        credentials: { ...storedSession, sessionId: 'session-1' }
      })
    })
  })
})
