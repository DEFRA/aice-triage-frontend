import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../src/server/server.js'
import * as submissionsApi from '../../../src/pages/submissions/api.js'
import { loginAsDevUser } from '../helpers/login.js'

vi.mock('../../../src/pages/submissions/api.js', () => ({
  listUnprocessedSubmissions: vi.fn(),
  getSubmissionById: vi.fn(),
  scoreSubmission: vi.fn(),
  SubmissionsApiTimeoutError: class SubmissionsApiTimeoutError extends Error {}
}))

describe('#bulk triage submissions', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function postBulkTriage (submissionIds) {
    const cookie = await loginAsDevUser(server)

    return server.inject({
      method: 'POST',
      url: '/submissions/bulk-triage',
      headers: {
        cookie,
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: submissionIds
        .map((id) => `submissionIds=${encodeURIComponent(id)}`)
        .join('&')
    })
  }

  test('queue: renders a checkbox per row and a bulk triage action', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          receivedAt: '2026-07-31T09:52:46.854Z',
          status: 'unprocessed',
          submittedAt: null,
          text: 'Preview text'
        }
      ]
    })

    const cookie = await loginAsDevUser(server)
    const { payload } = await server.inject({
      method: 'GET',
      url: '/submissions',
      headers: { cookie }
    })

    expect(payload).toContain(
      '<form id="bulk-triage-form" method="post" action="/submissions/bulk-triage">'
    )
    expect(payload).toContain('name="submissionIds"')
    expect(payload).toContain('value="SUB-2026-0184"')
    expect(payload).toContain('form="bulk-triage-form"')
    expect(payload).toContain('Bulk triage submissions')
    expect(payload).toContain('data-prevent-double-click="true"')
  })

  test('queue: shows an error summary when redirected after selecting no submissions', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          receivedAt: '2026-07-31T09:52:46.854Z',
          status: 'unprocessed',
          submittedAt: null,
          text: 'Preview text'
        }
      ]
    })

    const cookie = await loginAsDevUser(server)
    const { statusCode, payload } = await server.inject({
      method: 'GET',
      url: '/submissions?error=select-a-submission',
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('There is a problem')
    expect(payload).toContain('Select at least one submission to triage')
  })

  test('queue: does not show an error summary without the selection error flag', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          receivedAt: '2026-07-31T09:52:46.854Z',
          status: 'unprocessed',
          submittedAt: null,
          text: 'Preview text'
        }
      ]
    })

    const cookie = await loginAsDevUser(server)
    const { payload } = await server.inject({
      method: 'GET',
      url: '/submissions',
      headers: { cookie }
    })

    expect(payload).not.toContain('There is a problem')
  })

  test('triages each selected submission sequentially and shows outcomes', async () => {
    submissionsApi.scoreSubmission.mockImplementation((submissionId) => {
      if (submissionId === 'SUB-2026-0001') {
        return Promise.resolve({
          ok: true,
          status: statusCodes.HTTP_STATUS_OK,
          data: { id: submissionId, kind: 'enquiry', reason: 'ok', scoring: null }
        })
      }

      if (submissionId === 'SUB-2026-0002') {
        return Promise.resolve({
          ok: false,
          status: statusCodes.HTTP_STATUS_CONFLICT,
          data: null
        })
      }

      return Promise.reject(new Error('backend-unavailable'))
    })

    const { statusCode, payload } = await postBulkTriage([
      'SUB-2026-0001',
      'SUB-2026-0002',
      'SUB-2026-0003'
    ])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(submissionsApi.scoreSubmission).toHaveBeenCalledTimes(3)
    expect(submissionsApi.scoreSubmission).toHaveBeenNthCalledWith(
      1,
      'SUB-2026-0001'
    )
    expect(submissionsApi.scoreSubmission).toHaveBeenNthCalledWith(
      2,
      'SUB-2026-0002'
    )
    expect(submissionsApi.scoreSubmission).toHaveBeenNthCalledWith(
      3,
      'SUB-2026-0003'
    )

    expect(payload).toContain('href="/submissions/SUB-2026-0001"')
    expect(payload).toContain('Scored')
    expect(payload).toContain('enquiry')
    expect(payload).toContain('href="/submissions/SUB-2026-0002"')
    expect(payload).toContain('Already in progress')
    expect(payload).toContain('href="/submissions/SUB-2026-0003"')
    expect(payload).toContain('Failed')
  })

  test('a failure or in-flight conflict does not stop remaining submissions from being triaged', async () => {
    submissionsApi.scoreSubmission.mockImplementation((submissionId) => {
      if (submissionId === 'SUB-2026-0002') {
        return Promise.reject(new Error('backend-unavailable'))
      }

      return Promise.resolve({
        ok: true,
        status: statusCodes.HTTP_STATUS_OK,
        data: { id: submissionId, kind: 'enquiry', reason: 'ok', scoring: null }
      })
    })

    await postBulkTriage(['SUB-2026-0001', 'SUB-2026-0002', 'SUB-2026-0003'])

    expect(submissionsApi.scoreSubmission).toHaveBeenCalledTimes(3)
  })

  test('a single selected submission is triaged and shown in the results', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: { id: 'SUB-2026-0184', kind: 'enquiry', reason: 'ok', scoring: null }
    })

    const { statusCode, payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('href="/submissions/SUB-2026-0184"')
    expect(payload).toContain('Scored')
    expect(payload).toContain('enquiry')
  })

  test('a scored submission includes a Jira create-issue link for that row', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        id: 'SUB-2026-0184',
        kind: 'enquiry',
        reason: 'Asks a question with no use case in it.',
        scoring: null
      }
    })

    const { statusCode, payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('Create Jira ticket')
    expect(payload).toContain('https://defra.atlassian.net/secure/CreateIssueDetails')
    expect(payload).toContain('pid=10042')
    expect(payload).toContain('issuetype=10005')
  })

  test('a non-scored outcome does not include a Jira create-issue link', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: false,
      status: statusCodes.HTTP_STATUS_CONFLICT,
      data: null
    })

    const { statusCode, payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).not.toContain('Create Jira ticket')
  })

  test('no submissions selected redirects back to the queue with a selection error, without calling the API', async () => {
    const { statusCode, headers } = await postBulkTriage([])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(headers.location).toBe('/submissions?error=select-a-submission')
    expect(submissionsApi.scoreSubmission).not.toHaveBeenCalled()
  })

  test('an unexpected non-ok, non-conflict result is shown as failed, not scored', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: false,
      status: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR,
      data: null
    })

    const { statusCode, payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('href="/submissions/SUB-2026-0184"')
    expect(payload).toContain('Failed')
    expect(payload).not.toContain('Scored')
    expect(payload).not.toContain('Already in progress')
  })

  test('a submission that times out is shown distinctly as timed-out, not a generic failure', async () => {
    submissionsApi.scoreSubmission.mockRejectedValue(
      new submissionsApi.SubmissionsApiTimeoutError()
    )

    const { statusCode, payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('href="/submissions/SUB-2026-0184"')
    expect(payload).toContain('Timed out')
  })

  test('a timed-out row includes a retry action that posts back to the score endpoint', async () => {
    submissionsApi.scoreSubmission.mockRejectedValue(
      new submissionsApi.SubmissionsApiTimeoutError()
    )

    const { payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(payload).toContain(
      '<form method="post" action="/submissions/SUB-2026-0184/score">'
    )
    expect(payload).toContain('Retry')
  })

  test('a scored row does not include a retry action', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: { id: 'SUB-2026-0184', kind: 'enquiry', reason: 'ok', scoring: null }
    })

    const { payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(payload).not.toContain('Retry')
  })

  test('bulk results: renders breadcrumbs back to home and the submissions queue', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: { id: 'SUB-2026-0184', kind: 'enquiry', reason: 'ok', scoring: null }
    })

    const { payload } = await postBulkTriage(['SUB-2026-0184'])

    expect(payload).toContain('govuk-breadcrumbs')
    expect(payload).toContain('href="/"')
    expect(payload).toContain('href="/submissions"')
    expect(payload).toContain('Bulk triage results')
  })
})
