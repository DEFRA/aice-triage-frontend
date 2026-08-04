import { statusCodes } from '../../constants/status-codes.js'
import { config } from '../../config/config.js'

function buildBackendHealthUrl() {
  const baseUrl = config.get('triageApiUrl')
  return new URL('/health', baseUrl).toString()
}

async function checkBackendHealth() {
  const url = buildBackendHealthUrl()

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000)
    })

    return {
      reachable: response.ok,
      message: response.ok
        ? 'Backend API is reachable'
        : `Backend API returned ${response.status}`
    }
  } catch {
    return {
      reachable: false,
      message: 'Backend API is unavailable'
    }
  }
}

async function getHomepage(request, h) {
  const backendHealth = await checkBackendHealth()

  return h
    .view('home/page.njk', {
      backendHealth
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

export { getHomepage }
