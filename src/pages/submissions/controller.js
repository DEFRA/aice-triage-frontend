import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import { config } from '../../config/config.js'
import {
  listUnprocessedSubmissions,
  getSubmissionById,
  scoreSubmission
} from './api.js'
import {
  buildJiraLink,
  formatRoutingRecommendation,
  getCriteriaRows,
  KIND_SUMMARY_LABELS
} from './jira-link.js'

const govUkDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

const RAG_TAG_CLASS = {
  red: 'govuk-tag--red',
  amber: 'govuk-tag--yellow',
  green: 'govuk-tag--green'
}

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

function buildJiraConfig () {
  const baseUrl = config.get('jira.baseUrl')
  const projectId = config.get('jira.projectId')
  const issueTypeId = config.get('jira.issueTypeId')

  if (!baseUrl || !projectId || !issueTypeId) {
    return null
  }

  return { baseUrl, projectId, issueTypeId }
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
  const scoringInFlight = request.query.scoring === 'in-flight'
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
  const isScored = submission.status === 'scored'
  const scoringResult = isScored ? submission.result : null
  const isOpportunity = scoringResult?.kind === 'opportunity'

  const criteriaRows = isOpportunity
    ? getCriteriaRows(scoringResult.scoring.criteria).map((row) => ({
      ...row,
      tagClass: RAG_TAG_CLASS[row.rag] ?? 'govuk-tag--grey'
    }))
    : null

  const routingRecommendationText = isOpportunity
    ? formatRoutingRecommendation(
      scoringResult.scoring.routing_recommendation,
      scoringResult.scoring.pattern_cited
    )
    : null

  let jiraLink = null
  if (isScored) {
    const jiraConfig = buildJiraConfig()

    if (jiraConfig) {
      const detailUrl = `${request.server.info.uri}/submissions/${submission.submissionId}`

      jiraLink = buildJiraLink(scoringResult, { ...jiraConfig, detailUrl })
    }
  }

  return h
    .view('submissions/detail.njk', {
      pageTitle: `Submission ${submission.submissionId}`,
      page: 'submissions',
      serviceUnavailable: false,
      scoringInFlight,
      submission: {
        submissionId: submission.submissionId,
        receivedAtIso: submission.receivedAt,
        receivedAtDisplay: formatGovUkDate(submission.receivedAt),
        text: submission.text ?? '',
        status: submission.status,
        scoredAtIso: submission.scoredAt ?? null,
        scoredAtDisplay: submission.scoredAt
          ? formatGovUkDate(submission.scoredAt)
          : null,
        result: scoringResult
      },
      criteriaRows,
      routingRecommendationText,
      jiraLink
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

async function postScoreSubmission (request, h) {
  const { submissionId } = request.params
  let result

  try {
    result = await scoreSubmission(submissionId)
  } catch {
    throw Boom.badGateway()
  }

  if (!result.ok && result.status === statusCodes.HTTP_STATUS_CONFLICT) {
    return h.redirect(`/submissions/${submissionId}?scoring=in-flight`)
  }

  return h.redirect(`/submissions/${submissionId}`)
}

function normalizeSubmissionIds (value) {
  if (!value) {
    return []
  }

  const values = Array.isArray(value) ? value : [value]

  return values.map((submissionId) => `${submissionId}`.trim()).filter(Boolean)
}

/**
 * Triages multiple submissions selected from the queue, one at a time,
 * against the existing single-submission scoring endpoint (AC2). A failure
 * or in-flight conflict for one submission does not stop the remaining
 * submissions from being triaged (AC4). The interim, sequential-looping
 * approach here is only suited to low volumes (2-3 submissions at a time);
 * see CAIT-259 (AC5) - if volumes increase significantly this should be
 * reassessed in favour of a backend bulk endpoint or async processing.
 */
async function postBulkTriageSubmissions (request, h) {
  const submissionIds = normalizeSubmissionIds(request.payload?.submissionIds)

  if (submissionIds.length === 0) {
    return h.redirect('/submissions')
  }

  const results = []

  for (const submissionId of submissionIds) {
    try {
      const result = await scoreSubmission(submissionId)

      if (!result.ok && result.status === statusCodes.HTTP_STATUS_CONFLICT) {
        results.push({ submissionId, outcome: 'in-flight' })
      } else {
        const kind = result.data?.kind
        results.push({
          submissionId,
          outcome: 'scored',
          kindLabel: KIND_SUMMARY_LABELS[kind] ?? null
        })
      }
    } catch {
      results.push({ submissionId, outcome: 'failed' })
    }
  }

  return h
    .view('submissions/bulk-results.njk', {
      pageTitle: 'Bulk triage results',
      page: 'submissions',
      results
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getSubmissionsQueue,
  getSubmissionDetail,
  postScoreSubmission,
  postBulkTriageSubmissions
}
