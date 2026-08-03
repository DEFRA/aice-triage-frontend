import { homeRouter } from './home/router.js'

const pageRouter = {
  plugin: {
    name: 'pageRouter',
    async register (server) {
      await server.register([
        homeRouter
      ])
    }
  }
}

export {
  pageRouter
}
