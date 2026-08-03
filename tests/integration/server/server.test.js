import { constants as statusCodes } from 'node:http2'

import { vi } from 'vitest'

import hapi from '@hapi/hapi'

describe('#startServer', () => {
  let createServerSpy
  let hapiServerSpy
  let serverImport

  beforeAll(async () => {
    vi.stubEnv('PORT', '3097')

    serverImport = await import('../../../src/server/server.js')

    createServerSpy = vi.spyOn(serverImport, 'createServer')
    hapiServerSpy = vi.spyOn(hapi, 'server')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  describe('When server starts', () => {
    let server

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should start up server as expected', async () => {
      server = await serverImport.createServer()
      await serverImport.startServer(server)

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(serverImport.createServer()).rejects.toThrow('Server failed to start')
    })
  })
})
