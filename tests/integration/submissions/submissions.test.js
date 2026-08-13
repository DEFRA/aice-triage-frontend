import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../src/server/server.js'
import * as submissionsApi from '../../../src/pages/submissions/api.js'

vi.mock('../../../src/pages/submissions/api.js', () => ({
  listUnprocessedSubmissions: vi.fn(),
  getSubmissionById: vi.fn()
}))

describe('#submissions pages', () => {
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

  function injectWithStubbedCredentials (url) {
    return server.inject({
      method: 'GET',
      url
    })
  }
  test('queue: populated list renders identifier, received date and preview', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          receivedAt: '2026-07-31T09:52:46.854Z',
          status: 'unprocessed',
          submittedAt: '2026-07-31T09:00:00.000Z',
          text: 'We spend two days a week reading grant applications by hand'
        }
      ]
    })

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('SUB-2026-0184')
    expect(payload).toContain('31 July 2026')
    expect(payload).toContain(
      'We spend two days a week reading grant applications by hand'
    )
  })

  test('queue: empty list shows empty-state message and no table headers', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: []
    })

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('No submissions waiting')
    expect(payload).not.toContain('Submission identifier')
  })

  test('queue: submittedAt null does not break rendering (uses receivedAt)', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0999',
          receivedAt: '2026-07-22T12:00:00.000Z',
          status: 'unprocessed',
          submittedAt: null,
          text: 'Null submittedAt should not crash'
        }
      ]
    })

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('22 July 2026')
    expect(payload).toContain('SUB-2026-0999')
  })

  test('queue: each row links to detail page', async () => {
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

    const { payload } = await injectWithStubbedCredentials('/submissions')

    expect(payload).toContain('href="/submissions/SUB-2026-0184"')
  })

  test('detail: known id renders full raw text', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'unprocessed',
        submittedAt: null,
        text: 'Full body text line 1\nline 2'
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('SUB-2026-0184')
    expect(payload).toContain('31 July 2026')
    expect(payload).toContain('Full body text line 1')
    expect(payload).toContain('line 2')
  })

  test('detail: unknown id renders standard 404 page', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: false,
      status: statusCodes.HTTP_STATUS_NOT_FOUND,
      data: null
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-UNKNOWN'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    expect(payload).toContain('Page not found')
  })

  test('queue: backend unavailable shows friendly message', async () => {
    submissionsApi.listUnprocessedSubmissions.mockRejectedValue(
      new Error('backend-unavailable')
    )

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('the triage service is unavailable')
    expect(payload).not.toContain('ECONNREFUSED')
  })

  test('detail: backend unavailable shows friendly message', async () => {
    submissionsApi.getSubmissionById.mockRejectedValue(
      new Error('backend-unavailable')
    )

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('the triage service is unavailable')
    expect(payload).not.toContain('ECONNREFUSED')
  })

  test('unsafe html in text is escaped and inert', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-XSS',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'unprocessed',
        submittedAt: null,
        text: '<script>alert(1)</script><b>hello</b>'
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-XSS'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).not.toContain('<script>')
    expect(payload).not.toContain('<b>hello</b>')
    expect(payload).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;hello&lt;/b&gt;'
    )
  })
})
