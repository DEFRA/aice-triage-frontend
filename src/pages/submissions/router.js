import * as submissionsController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/submissions',
    handler: submissionsController.getSubmissionsQueue
  },
  {
    method: 'GET',
    path: '/submissions/{submissionId}',
    handler: submissionsController.getSubmissionDetail
  }
]

const submissionsRouter = {
  plugin: {
    name: 'submissionsRouter',
    register (server) {
      server.route(routes)
    }
  }
}

export { submissionsRouter }
