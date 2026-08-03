import * as controller from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/health',
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

export {
  router
}
