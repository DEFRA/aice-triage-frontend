import { homeRouter } from './home/router.js'
import { submissionsRouter } from './submissions/router.js'

const pageRouter = {
  plugin: {
    name: 'pageRouter',
    async register (server) {
      await server.register([homeRouter, submissionsRouter])
    }
  }
}

export { pageRouter }
