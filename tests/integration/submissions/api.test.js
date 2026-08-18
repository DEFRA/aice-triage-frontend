import nock from 'nock'

import { config } from '../../../src/config/config.js'
import {
  listUnprocessedSubmissions,
  getSubmissionById
} from '../../../src/pages/submissions/api.js'

const baseUrl = config.get('triageApiUrl')

describe('#submissions api', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('#listUnprocessedSubmissions', () => {
    test('Should return submissions when the backend responds successfully', async () => {
      const submissions = [
        { submissionId: 'SUB-1', receivedAt: '2026-07-31T09:00:00.000Z' }
      ]

      nock(baseUrl)
        .get('/submissions')
        .query({ status: 'unprocessed' })
        .reply(200, submissions)

      const result = await listUnprocessedSubmissions()

      expect(result).toEqual({ ok: true, status: 200, data: submissions })
    })

    test('Should throw when the backend responds with an error status', async () => {
      nock(baseUrl)
        .get('/submissions')
        .query({ status: 'unprocessed' })
        .reply(500)

      await expect(listUnprocessedSubmissions()).rejects.toMatchObject({
        statusCode: 500
      })
    })

    test('Should throw when the request fails', async () => {
      nock(baseUrl)
        .get('/submissions')
        .query({ status: 'unprocessed' })
        .replyWithError('network down')

      await expect(listUnprocessedSubmissions()).rejects.toThrow()
    })
  })

  describe('#getSubmissionById', () => {
    test('Should return a submission when the backend responds successfully', async () => {
      const submission = {
        submissionId: 'SUB-1',
        receivedAt: '2026-07-31T09:00:00.000Z'
      }

      nock(baseUrl).get('/submissions/SUB-1').reply(200, submission)

      const result = await getSubmissionById('SUB-1')

      expect(result).toEqual({ ok: true, status: 200, data: submission })
    })

    test('Should return ok:false when the backend responds with 404', async () => {
      nock(baseUrl).get('/submissions/SUB-UNKNOWN').reply(404)

      const result = await getSubmissionById('SUB-UNKNOWN')

      expect(result).toEqual({ ok: false, status: 404, data: null })
    })

    test('Should throw when the backend responds with a server error', async () => {
      nock(baseUrl).get('/submissions/SUB-1').reply(500)

      await expect(getSubmissionById('SUB-1')).rejects.toMatchObject({
        statusCode: 500
      })
    })

    test('Should throw when the request fails', async () => {
      nock(baseUrl).get('/submissions/SUB-1').replyWithError('network down')

      await expect(getSubmissionById('SUB-1')).rejects.toThrow()
    })
  })

  test('Should throw a clear error when TRIAGE_API_URL is not configured', async () => {
    const configSpy = vi
      .spyOn(config, 'get')
      .mockImplementation((key) => (key === 'triageApiUrl' ? null : undefined))

    await expect(listUnprocessedSubmissions()).rejects.toThrow(
      'TRIAGE_API_URL is not configured'
    )

    configSpy.mockRestore()
  })
})
