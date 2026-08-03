import * as registryController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/',
    handler: registryController.getHomepage
  }
]

const homeRouter = {
  plugin: {
    name: 'homeRouter',
    register (server) {
      server.route(routes)
    }
  }
}

export {
  homeRouter
}
