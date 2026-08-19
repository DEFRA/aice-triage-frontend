import * as controller from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/health',
    options: { auth: false },
    handler: controller.healthCheck
  }
]

const router = {
  plugin: {
    name: 'healthRouter',
    async register (server) {
      server.route(routes)
    }
  }
}

export { router }
