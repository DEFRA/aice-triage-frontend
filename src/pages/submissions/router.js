import * as submissionsController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/submissions',
    handler: submissionsController.getSubmissionsQueue
  },
  {
    method: 'GET',
    path: '/submissions/scored',
    handler: submissionsController.getScoredSubmissions
  },
  {
    method: 'GET',
    path: '/submissions/{submissionId}',
    handler: submissionsController.getSubmissionDetail
  },
  {
    method: 'POST',
    path: '/submissions/{submissionId}/score',
    handler: submissionsController.postScoreSubmission
  },
  {
    method: 'POST',
    path: '/submissions/bulk-triage',
    handler: submissionsController.postBulkTriageSubmissions
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
