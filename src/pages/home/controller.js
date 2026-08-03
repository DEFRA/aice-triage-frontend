import { statusCodes } from '../../constants/status-codes.js'

/**
 * Get homepage controller
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 *
 * @returns {import('@hapi/hapi').ResponseObject} The response object for the homepage
 */
async function getHomepage (request, h) {
  return h.view('home/page.njk')
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHomepage
}
