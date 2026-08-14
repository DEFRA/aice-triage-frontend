import { authController } from './controller.js'

const authRouter = {
  plugin: {
    name: 'authRoutes',
    register (server) {
      server.route([
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
            request.yar.reset()
            request.cookieAuth.clear()
            return h.redirect('/login')
          }
        },
        {
          method: 'GET',
          path: '/login',
          options: { auth: { mode: 'try', strategy: 'azure' } },
          handler: () => {} // Bell intercepts the request and issues the redirect
        }
      ])
    }
  }
}

export { authRouter }
