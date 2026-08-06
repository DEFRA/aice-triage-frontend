import { config } from '../../config/config.js'

const BACKEND_TIMEOUT_MS = 2000

class SubmissionsApiError extends Error {
  constructor (kind) {
    super(kind)
    this.name = 'SubmissionsApiError'
    this.kind = kind
  }
}

async function listUnprocessedSubmissions () {
  const baseUrl = config.get('triageApiUrl')
  const url = new URL('/submissions?status=unprocessed', baseUrl).toString()

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new SubmissionsApiError('backend-unavailable')
    }

    return await response.json()
  } catch (error) {
    if (error instanceof SubmissionsApiError) {
      throw error
    }

    throw new SubmissionsApiError('backend-unavailable')
  }
}

async function getSubmissionById (submissionId) {
  const baseUrl = config.get('triageApiUrl')
  const url = new URL(`/submissions/${submissionId}`, baseUrl).toString()

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
    })

    if (response.status === 404) {
      throw new SubmissionsApiError('not-found')
    }

    if (!response.ok) {
      throw new SubmissionsApiError('backend-unavailable')
    }

    return await response.json()
  } catch (error) {
    if (error instanceof SubmissionsApiError) {
      throw error
    }

    throw new SubmissionsApiError('backend-unavailable')
  }
}

export { listUnprocessedSubmissions, getSubmissionById, SubmissionsApiError }
