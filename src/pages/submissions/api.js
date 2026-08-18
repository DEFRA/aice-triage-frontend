import { config } from '../../config/config.js'
import { statusCodes } from '../../constants/status-codes.js'

const BACKEND_TIMEOUT_MS = 2000

class SubmissionsApiError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'SubmissionsApiError'
    this.statusCode = statusCode
  }

  static fromResponse (path, response) {
    const message =
      `Submissions API GET ${path} ` +
      `failed: ${response.status} ${response.statusText}`

    return new SubmissionsApiError(message, response.status)
  }
}

async function request (path, { expected = [] } = {}) {
  const baseUrl = config.get('triageApiUrl')

  if (!baseUrl) {
    throw new Error(
      'TRIAGE_API_URL is not configured, cannot call the submissions API'
    )
  }

  const url = new URL(path, baseUrl).toString()

  const response = await fetch(url, {
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
  })

  if (response.ok) {
    return { ok: true, status: response.status, data: await response.json() }
  }

  if (expected.includes(response.status)) {
    return { ok: false, status: response.status, data: null }
  }

  throw SubmissionsApiError.fromResponse(path, response)
}

async function listUnprocessedSubmissions () {
  return request('/submissions?status=unprocessed')
}

async function getSubmissionById (submissionId) {
  return request(`/submissions/${submissionId}`, {
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
  })
}

export { listUnprocessedSubmissions, getSubmissionById, SubmissionsApiError }
