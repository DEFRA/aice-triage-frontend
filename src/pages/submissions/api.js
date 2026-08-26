import { config } from '../../config/config.js'
import { statusCodes } from '../../constants/status-codes.js'

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

class SubmissionsApiTimeoutError extends Error {
  constructor (method, path, timeoutMs) {
    super(
      `Submissions API ${method} ${path} timed out after ${timeoutMs}ms`
    )
    this.name = 'SubmissionsApiTimeoutError'
  }
}

function isTimeoutError (error) {
  return error.name === 'TimeoutError'
}

async function request (path, { method = 'GET', expected = [] } = {}) {
  const baseUrl = config.get('triageApiUrl')
  const url = new URL(path, baseUrl).toString()
  const timeoutMs = config.get('triageApiTimeoutMs')

  let response
  try {
    response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new SubmissionsApiTimeoutError(method, path, timeoutMs)
    }
    throw error
  }

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
  SubmissionsApiError,
  SubmissionsApiTimeoutError
}
