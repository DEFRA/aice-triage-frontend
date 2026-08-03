import { STATUS_CODES } from 'node:http'
import { constants as statusCodes } from 'node:http2'

import { vi } from 'vitest'

import { catchAll } from '../../../src/server/catch-all.js'

const mockErrorLogger = vi.fn()
const mockStack = 'Mock error stack'
const errorPage = 'common/error'
const mockRequest = (statusCode, customMessage) => ({
  response: {
    isBoom: true,
    stack: mockStack,
    output: {
      payload: {
        statusCode,
        error: STATUS_CODES[statusCode],
        message: customMessage ?? STATUS_CODES[statusCode]
      }
    }
  },
  logger: { error: mockErrorLogger }
})
const mockToolkitView = vi.fn()
const mockToolkitCode = vi.fn()
const mockToolkit = {
  view: mockToolkitView.mockReturnThis(),
  code: mockToolkitCode.mockReturnThis()
}

describe('#catchAll', () => {
  test('Should provide expected "Not Found" page', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_NOT_FOUND), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Page not found',
      heading: statusCodes.HTTP_STATUS_NOT_FOUND,
      message: 'Page not found'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_NOT_FOUND)
  })

  test('Should provide expected "Forbidden" page', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_FORBIDDEN), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Forbidden',
      heading: statusCodes.HTTP_STATUS_FORBIDDEN,
      message: 'Forbidden'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_FORBIDDEN)
  })

  test('Should provide expected "Unauthorized" page', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_UNAUTHORIZED), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Unauthorized',
      heading: statusCodes.HTTP_STATUS_UNAUTHORIZED,
      message: 'Unauthorized'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_UNAUTHORIZED)
  })

  test('Should provide expected "Bad Request" page', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_BAD_REQUEST), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Bad Request',
      heading: statusCodes.HTTP_STATUS_BAD_REQUEST,
      message: 'Bad Request'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
  })

  test('Should provide expected default page', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_TEAPOT), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.HTTP_STATUS_TEAPOT,
      message: 'Something went wrong'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_TEAPOT)
  })

  test('Should use boom message when explicitly overridden', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_NOT_FOUND, 'No analysis found for this document'), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'No analysis found for this document',
      heading: statusCodes.HTTP_STATUS_NOT_FOUND,
      message: 'No analysis found for this document'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_NOT_FOUND)
  })

  test('Should provide expected "Something went wrong" page and log error for internalServerError', () => {
    catchAll(mockRequest(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR), mockToolkit)

    expect(mockErrorLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ stack_trace: mockStack })
      }),
      'Internal server error'
    )
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR,
      message: 'Something went wrong'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(
      statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })
})
