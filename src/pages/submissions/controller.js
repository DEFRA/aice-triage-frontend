import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import {
  listUnprocessedSubmissions,
  getSubmissionById,
  SubmissionsApiError
} from './api.js'

const govUkDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

function formatGovUkDate (isoDateString) {
  return govUkDateFormatter.format(new Date(isoDateString))
}

function mapQueueRows (submissions) {
  return [...submissions]
    .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
    .map((submission) => ({
      submissionId: submission.submissionId,
      receivedAtIso: submission.receivedAt,
      receivedAtDisplay: formatGovUkDate(submission.receivedAt),
      textPreviewSource: submission.text ?? ''
    }))
}

async function getSubmissionsQueue (_request, h) {
  try {
    const submissions = await listUnprocessedSubmissions()
    const rows = mapQueueRows(submissions)

    return h
      .view('submissions/queue.njk', {
        pageTitle: 'Submissions waiting',
        page: 'submissions',
        rows,
        serviceUnavailable: false
      })
      .code(statusCodes.HTTP_STATUS_OK)
  } catch (error) {
    if (error instanceof SubmissionsApiError) {
      return h
        .view('submissions/queue.njk', {
          pageTitle: 'Submissions waiting',
          page: 'submissions',
          rows: [],
          serviceUnavailable: true
        })
        .code(statusCodes.HTTP_STATUS_OK)
    }

    throw error
  }
}

async function getSubmissionDetail (request, h) {
  const { submissionId } = request.params

  try {
    const submission = await getSubmissionById(submissionId)

    return h
      .view('submissions/detail.njk', {
        pageTitle: `Submission ${submission.submissionId}`,
        page: 'submissions',
        serviceUnavailable: false,
        submission: {
          submissionId: submission.submissionId,
          receivedAtIso: submission.receivedAt,
          receivedAtDisplay: formatGovUkDate(submission.receivedAt),
          text: submission.text ?? ''
        }
      })
      .code(statusCodes.HTTP_STATUS_OK)
  } catch (error) {
    if (error instanceof SubmissionsApiError && error.kind === 'not-found') {
      throw Boom.notFound()
    }

    if (error instanceof SubmissionsApiError) {
      return h
        .view('submissions/detail.njk', {
          pageTitle: `Submission ${submissionId}`,
          page: 'submissions',
          serviceUnavailable: true,
          submission: null,
          submissionId
        })
        .code(statusCodes.HTTP_STATUS_OK)
    }

    throw error
  }
}

export { getSubmissionsQueue, getSubmissionDetail }
