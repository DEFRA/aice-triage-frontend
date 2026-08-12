import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import { listUnprocessedSubmissions, getSubmissionById } from './api.js'

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
  let result

  try {
    result = await listUnprocessedSubmissions()
  } catch {
    return h
      .view('submissions/queue.njk', {
        pageTitle: 'Submissions waiting',
        page: 'submissions',
        rows: [],
        serviceUnavailable: true
      })
      .code(statusCodes.HTTP_STATUS_OK)
  }

  return h
    .view('submissions/queue.njk', {
      pageTitle: 'Submissions waiting',
      page: 'submissions',
      rows: mapQueueRows(result.data),
      serviceUnavailable: false
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

async function getSubmissionDetail (request, h) {
  const { submissionId } = request.params
  let result

  try {
    result = await getSubmissionById(submissionId)
  } catch {
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

  if (!result.ok) {
    throw Boom.notFound()
  }

  const submission = result.data

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
}

export { getSubmissionsQueue, getSubmissionDetail }
