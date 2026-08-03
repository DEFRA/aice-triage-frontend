import { statusCodes } from '../constants/status-codes.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'

const DEFAULT_BOOM_500_MESSAGE = 'An internal server error occurred'

const STATUS_CODE_MESSAGES = {
  [statusCodes.HTTP_STATUS_NOT_FOUND]: 'Page not found',
  [statusCodes.HTTP_STATUS_FORBIDDEN]: 'Forbidden',
  [statusCodes.HTTP_STATUS_UNAUTHORIZED]: 'Unauthorized',
  [statusCodes.HTTP_STATUS_BAD_REQUEST]: 'Bad Request'
}

function statusCodeMessage (boom) {
  const { payload } = boom.output
  const { error, message, statusCode } = payload

  // Check if a custom boom error message is provided, if so, return it
  if ((error !== message) && message !== DEFAULT_BOOM_500_MESSAGE) {
    return message
  }

  return STATUS_CODE_MESSAGES[statusCode] ?? 'Something went wrong'
}

function catchAll (request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const { payload } = response.output

  const errorMessage = statusCodeMessage(response)

  if (payload.statusCode >= statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR) {
    request.logger.error(buildErrorLog(response, { type: 'internal_server_error' }), 'Internal server error')
  }

  return h
    .view('common/error', {
      pageTitle: errorMessage,
      heading: payload.statusCode,
      message: errorMessage
    })
    .code(payload.statusCode)
}

export {
  catchAll
}
