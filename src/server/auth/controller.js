function buildSession (profile, token) {
  return {
    isAuthenticated: true,
    ...profile,
    token
  }
}

const authController = {
  async handler (request, h) {
    if (!request.auth.isAuthenticated) {
      throw new Error('Authentication failed')
    }

    const { profile, token } = request.auth.credentials

    await request.yar.set('userAuth', buildSession(profile, token))
    request.cookieAuth.set({ id: request.yar.id })

    return h.redirect('/')
  }
}

export { authController }
