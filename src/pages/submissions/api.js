import { config } from '../../config/config.js'
import { statusCodes } from '../../constants/status-codes.js'

const BACKEND_TIMEOUT_MS = 2000

class SubmissionsApiError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'SubmissionsApiError'
    this.statusCode = statusCode
  }

  static fromResponse (method, path, response) {
    const message =
      `Submissions API ${method} ${path} ` +
      `failed: ${response.status} ${response.statusText}`

    return new SubmissionsApiError(message, response.status)
  }
}

async function request (path, { method = 'GET', expected = [] } = {}) {
  const baseUrl = config.get('triageApiUrl')
  const url = new URL(path, baseUrl).toString()

  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
  })

  if (response.ok) {
    return { ok: true, status: response.status, data: await response.json() }
  }

  if (expected.includes(response.status)) {
    return { ok: false, status: response.status, data: null }
  }

  throw SubmissionsApiError.fromResponse(method, path, response)
}

async function listUnprocessedSubmissions () {
  return request('/submissions?status=unprocessed')
}

async function getSubmissionById (submissionId) {
  return request(`/submissions/${submissionId}`, {
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
  })
}

async function scoreSubmission (submissionId) {
  return request(`/submissions/${submissionId}/score`, {
    method: 'POST',
    expected: [statusCodes.HTTP_STATUS_CONFLICT]
  })
}

export {
  listUnprocessedSubmissions,
  getSubmissionById,
  scoreSubmission,
  SubmissionsApiError
}
