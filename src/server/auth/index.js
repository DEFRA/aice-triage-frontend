import { authController } from './controller.js'

const authRoutes = {
  plugin: {
    name: 'authRoutes',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/login',
          options: { auth: 'azure' },
          handler (request, h) {
            return h.redirect(request.query.next ?? '/')
          }
        },
        {
          method: ['GET', 'POST'],
          path: '/login/callback',
          options: {
            auth: { mode: 'try', strategy: 'azure' }
          },
          ...authController
        },
        {
          method: 'GET',
          path: '/logout',
          options: { auth: { mode: 'try', strategy: 'session' } },
          handler (request, h) {
            const sessionId = request.auth.credentials?.id
            if (sessionId) {
              request.yar.clear(sessionId)
            }
            request.cookieAuth.clear()
            return h.redirect('/login')
          }
        }
      ])
    }
  }
}

export { authRoutes }
