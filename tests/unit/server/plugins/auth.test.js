import crypto from 'node:crypto'

import Jwt from '@hapi/jwt'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockGetSigningKey } = vi.hoisted(() => ({
  mockGetSigningKey: vi.fn()
}))

vi.mock('jwks-rsa', () => ({
  default: vi.fn(() => ({
    getSigningKey: mockGetSigningKey
  }))
}))

function generateRsaKeyPair () {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

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

    test('the wrapped Bell profile hook stashes the id_token and populates credentials.profile', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      const options = getStrategyOptions(mockServer, 'entra')
      const credentials = {}
      const params = { id_token: 'raw-id-token-value' }
      const get = vi.fn().mockResolvedValue({
        id: 'user-1',
        displayName: 'Jane Smith',
        userPrincipalName: 'jane.smith@example.com'
      })

      await options.provider.profile(credentials, params, get)

      expect(credentials.idToken).toBe('raw-id-token-value')
      expect(credentials.profile).toMatchObject({
        id: 'user-1',
        displayName: 'Jane Smith',
        email: 'jane.smith@example.com'
      })
    })

    test('builds the full redirect_uri from the configured redirect host', async () => {
      const auth = await getAuthPlugin()
      const mockServer = buildMockServer()

      await auth.plugin.register(mockServer)

      const options = getStrategyOptions(mockServer, 'entra')

      expect(options.location()).toBe('http://localhost:3000/login/callback')
    })

    describe('verifyEntraToken (JWKS verification)', () => {
      afterEach(() => {
        mockGetSigningKey.mockReset()
      })

      test('verifies the token signature and payload against the JWKS client and returns the decoded payload', async () => {
        const { publicKey, privateKey } = generateRsaKeyPair()

        mockGetSigningKey.mockResolvedValue({
          getPublicKey: () => publicKey
        })

        const auth = await getAuthPlugin()
        const mockServer = buildMockServer()

        await auth.plugin.register(mockServer)

        const [, , verifyEntraToken] = mockServer.decorate.mock.calls.find(
          ([type, name]) => type === 'server' && name === 'verifyEntraToken'
        )

        const token = Jwt.token.generate(
          {
            sub: 'user-123',
            aud: 'test-client-id',
            iss: 'https://login.microsoftonline.com/test-tenant-id/v2.0'
          },
          { key: privateKey, algorithm: 'RS256' },
          { header: { kid: 'test-kid' } }
        )

        const payload = await verifyEntraToken(token)

        expect(mockGetSigningKey).toHaveBeenCalledWith('test-kid')
        expect(payload).toMatchObject({ sub: 'user-123' })
      })

      test('rejects a token whose signature does not match the JWKS public key', async () => {
        const { privateKey } = generateRsaKeyPair()
        const { publicKey: wrongPublicKey } = generateRsaKeyPair()

        mockGetSigningKey.mockResolvedValue({
          getPublicKey: () => wrongPublicKey
        })

        const auth = await getAuthPlugin()
        const mockServer = buildMockServer()

        await auth.plugin.register(mockServer)

        const [, , verifyEntraToken] = mockServer.decorate.mock.calls.find(
          ([type, name]) => type === 'server' && name === 'verifyEntraToken'
        )

        const token = Jwt.token.generate(
          {
            sub: 'user-123',
            aud: 'test-client-id',
            iss: 'https://login.microsoftonline.com/test-tenant-id/v2.0'
          },
          { key: privateKey, algorithm: 'RS256' },
          { header: { kid: 'test-kid' } }
        )

        await expect(verifyEntraToken(token)).rejects.toThrow()
      })
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
