import { config } from '../../config/config.js'
import { statusCodes } from '../../constants/status-codes.js'

const BACKEND_TIMEOUT_MS = 2000
const BACKEND_UNAVAILABLE = 'backend-unavailable'
const NOT_FOUND = 'not-found'

class SubmissionsApiError extends Error {
  constructor (kind) {
    super(kind)
    this.name = 'SubmissionsApiError'
    this.kind = kind
  }
}

async function request (path, { expected = [] } = {}) {
  const baseUrl = config.get('triageApiUrl')
  const url = new URL(path, baseUrl).toString()

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
    })

    if (
      response.status === statusCodes.HTTP_STATUS_NOT_FOUND &&
      expected.includes(NOT_FOUND)
    ) {
      throw new SubmissionsApiError(NOT_FOUND)
    }

    if (!response.ok) {
      throw new SubmissionsApiError(BACKEND_UNAVAILABLE)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof SubmissionsApiError) {
      throw error
    }

    throw new SubmissionsApiError(BACKEND_UNAVAILABLE)
  }
}

async function listUnprocessedSubmissions () {
  return request('/submissions?status=unprocessed')
}

async function getSubmissionById (submissionId) {
  return request(`/submissions/${submissionId}`, { expected: [NOT_FOUND] })
}

export { listUnprocessedSubmissions, getSubmissionById, SubmissionsApiError }
