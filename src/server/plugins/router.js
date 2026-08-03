import { router as healthRouter } from '../../health-probe/router.js'
import { pageRouter } from '../../pages/pages.js'

const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([
        healthRouter,
        pageRouter
      ])
    }
  }
}

export {
  router
}
