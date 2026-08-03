import { statusCodes } from '../constants/status-codes.js'

/**
 * Health check controller
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function healthCheck (_, h) {
  return h.response({ message: 'success' })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  healthCheck
}
