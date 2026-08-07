import nock from 'nock'

import { config } from '../../../src/config/config.js'
import {
  listUnprocessedSubmissions,
  getSubmissionById,
  SubmissionsApiError
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

      expect(result).toEqual(submissions)
    })

    test('Should throw a backend-unavailable error when the backend responds with an error status', async () => {
      nock(baseUrl)
        .get('/submissions')
        .query({ status: 'unprocessed' })
        .reply(500)

      await expect(listUnprocessedSubmissions()).rejects.toMatchObject({
        name: 'SubmissionsApiError',
        kind: 'backend-unavailable'
      })
    })

    test('Should throw a backend-unavailable error when the request fails', async () => {
      nock(baseUrl)
        .get('/submissions')
        .query({ status: 'unprocessed' })
        .replyWithError('network down')

      await expect(listUnprocessedSubmissions()).rejects.toBeInstanceOf(
        SubmissionsApiError
      )
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

      expect(result).toEqual(submission)
    })

    test('Should throw a not-found error when the backend responds with 404', async () => {
      nock(baseUrl).get('/submissions/SUB-UNKNOWN').reply(404)

      await expect(getSubmissionById('SUB-UNKNOWN')).rejects.toMatchObject({
        name: 'SubmissionsApiError',
        kind: 'not-found'
      })
    })

    test('Should throw a backend-unavailable error when the backend responds with a server error', async () => {
      nock(baseUrl).get('/submissions/SUB-1').reply(500)

      await expect(getSubmissionById('SUB-1')).rejects.toMatchObject({
        name: 'SubmissionsApiError',
        kind: 'backend-unavailable'
      })
    })

    test('Should throw a backend-unavailable error when the request fails', async () => {
      nock(baseUrl).get('/submissions/SUB-1').replyWithError('network down')

      await expect(getSubmissionById('SUB-1')).rejects.toBeInstanceOf(
        SubmissionsApiError
      )
    })
  })
})
