import { router as healthRouter } from '../../health-probe/router.js'
import { pageRouter } from '../../pages/pages.js'
import { authRouter } from '../auth/router.js'

const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([healthRouter, authRouter, pageRouter])
    }
  }
}

export { router }
