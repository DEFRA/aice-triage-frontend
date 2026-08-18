import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn()
}))

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    warn: mockLoggerWarn
  })
}))

const credentials = {
  profile: {
    displayName: 'Test User',
    id: 'user-123'
  },
  token: 'abc123def456',
  idToken: 'xyz789uvw012',
  refreshToken: 'refresh-token-abc'
}

async function getController () {
  return import('../../../../src/pages/login/controller.js')
}

function buildRequest (overrides = {}) {
  return {
    cookieAuth: {
      set: vi.fn(),
      clear: vi.fn()
    },
    auth: {
      isAuthenticated: false,
      credentials: {}
    },
    server: {
      verifyEntraToken: vi.fn(),
      app: {
        cache: {
          set: vi.fn(),
          drop: vi.fn()
        }
      }
    },
    ...overrides
  }
}

function buildAuthenticatedRequest (overrides = {}) {
  return buildRequest({
    auth: {
      isAuthenticated: true,
      credentials
    },
    ...overrides
  })
}

function buildResponseToolkit () {
  return {
    view: vi.fn((template, context) => ({ template, context })),
    redirect: vi.fn((location) => ({ redirectedTo: location }))
  }
}

describe('#loginController', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('#getLogin', () => {
    test('redirects to / when already authenticated', async () => {
      const { getLogin } = await getController()
      const request = buildAuthenticatedRequest()
      const h = buildResponseToolkit()

      const result = await getLogin(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/')
      expect(result).toEqual({ redirectedTo: '/' })
    })

    test('renders the login page when not authenticated', async () => {
      const { getLogin } = await getController()
      const request = buildRequest()
      const h = buildResponseToolkit()

      await getLogin(request, h)

      expect(h.view).toHaveBeenCalledWith('login/login.njk', {
        pageTitle: 'Sign in'
      })
    })
  })

  describe('#handleLoginCallback with the entra provider', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test('throws when authentication has failed', async () => {
      const { handleLoginCallback } = await getController()
      const request = buildRequest()
      const h = buildResponseToolkit()

      await expect(handleLoginCallback(request, h)).rejects.toThrow(
        /^Authentication failed. Please try again.$/
      )

      expect(request.server.app.cache.set).not.toHaveBeenCalled()
      expect(request.cookieAuth.set).not.toHaveBeenCalled()
    })

    test('logs a warning and hides token verification errors', async () => {
      const { handleLoginCallback } = await getController()
      const request = buildAuthenticatedRequest()
      const h = buildResponseToolkit()

      request.server.verifyEntraToken.mockRejectedValue(
        new Error('signature mismatch: verification failed')
      )

      await expect(handleLoginCallback(request, h)).rejects.toThrow(
        /^Authentication failed. Please try again.$/
      )

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            type: 'entra_token_verification_failed',
            outcome: 'failure'
          })
        })
      )
      expect(request.server.app.cache.set).not.toHaveBeenCalled()
    })

    test('stores the session and redirects home on success', async () => {
      const { handleLoginCallback } = await getController()
      const request = buildAuthenticatedRequest()
      const h = buildResponseToolkit()

      request.server.verifyEntraToken.mockResolvedValue({})

      const result = await handleLoginCallback(request, h)

      expect(request.server.verifyEntraToken).toHaveBeenCalledWith(
        credentials.idToken
      )
      expect(request.server.app.cache.set).toHaveBeenCalledOnce()

      const [cacheKey, storedSession] = request.server.app.cache.set.mock.calls[0]

      expect(cacheKey).toMatch(/^auth-session:/)
      expect(storedSession).toEqual({
        profile: credentials.profile,
        token: credentials.token,
        refreshToken: credentials.refreshToken
      })

      const sessionId = cacheKey.replace(/^auth-session:/, '')
      expect(request.cookieAuth.set).toHaveBeenCalledWith({ sessionId })
      expect(result).toEqual({ redirectedTo: '/' })
    })
  })

  describe('#handleLoginCallback with the local provider', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'local')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test('mints a dev session without contacting Entra and redirects home', async () => {
      const { handleLoginCallback } = await getController()
      const request = buildRequest()
      const h = buildResponseToolkit()

      const result = await handleLoginCallback(request, h)

      expect(request.server.app.cache.set).toHaveBeenCalledOnce()

      const [cacheKey, storedSession] = request.server.app.cache.set.mock.calls[0]

      expect(cacheKey).toMatch(/^auth-session:/)
      expect(storedSession.profile.displayName).toBe('Dev User')
      expect(typeof storedSession.token).toBe('string')
      expect(result).toEqual({ redirectedTo: '/' })
    })
  })

  describe('#logout', () => {
    test('drops the cached session and clears the cookie when authenticated', async () => {
      const { logout } = await getController()
      const request = buildAuthenticatedRequest({
        auth: { isAuthenticated: true, credentials: { sessionId: 'session-1' } }
      })
      const h = buildResponseToolkit()

      const result = await logout(request, h)

      expect(request.server.app.cache.drop).toHaveBeenCalledWith(
        'auth-session:session-1'
      )
      expect(request.cookieAuth.clear).toHaveBeenCalledOnce()
      expect(result).toEqual({ redirectedTo: '/login' })
    })

    test('redirects to /login without clearing anything when not authenticated', async () => {
      const { logout } = await getController()
      const request = buildRequest()
      const h = buildResponseToolkit()

      const result = await logout(request, h)

      expect(request.server.app.cache.drop).not.toHaveBeenCalled()
      expect(request.cookieAuth.clear).not.toHaveBeenCalled()
      expect(result).toEqual({ redirectedTo: '/login' })
    })
  })
})
