import { randomUUID as uuidv4 } from 'node:crypto'

function buildSession (profile, token) {
  return {
    isAuthenticated: true,
    id: profile.id,
    displayName: profile.displayName,
    email: profile.email,
    token
  }
}

const authController = {
  async handler (request, h) {
    if (!request.auth.isAuthenticated) {
      throw new Error('Authentication failed')
    }

    const { profile, token } = request.auth.credentials
    const sessionId = uuidv4()

    request.yar.set(sessionId, buildSession(profile, token))
    request.cookieAuth.set({ id: sessionId })

    const redirectTo = request.query.next ?? '/'

    return h.redirect(redirectTo)
  }
}

export { authController }
