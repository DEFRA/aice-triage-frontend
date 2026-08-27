import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../src/server/server.js'
import * as submissionsApi from '../../../src/pages/submissions/api.js'
import { loginAsDevUser } from '../helpers/login.js'

vi.mock('../../../src/pages/submissions/api.js', () => ({
  listUnprocessedSubmissions: vi.fn(),
  listScoredSubmissions: vi.fn(),
  getSubmissionById: vi.fn(),
  scoreSubmission: vi.fn(),
  SubmissionsApiTimeoutError: class SubmissionsApiTimeoutError extends Error {}
}))

describe('#scored submissions page', () => {
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

  async function injectWithStubbedCredentials (url) {
    const cookie = await loginAsDevUser(server)

    return server.inject({
      method: 'GET',
      url,
      headers: { cookie }
    })
  }

  test('populated list renders identifier, scored date and classification, most recent first', async () => {
    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0100',
          scoredAt: '2026-07-30T09:00:00.000Z',
          status: 'scored',
          result: { kind: 'enquiry' }
        },
        {
          submissionId: 'SUB-2026-0184',
          scoredAt: '2026-07-31T10:00:00.000Z',
          status: 'scored',
          result: { kind: 'opportunity' }
        }
      ]
    })

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions/scored')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('SUB-2026-0184')
    expect(payload).toContain('SUB-2026-0100')
    expect(payload).toContain('31 July 2026')
    expect(payload).toContain('AI opportunity')
    expect(payload).toContain('enquiry')

    const firstRowIndex = payload.indexOf('SUB-2026-0184')
    const secondRowIndex = payload.indexOf('SUB-2026-0100')
    expect(firstRowIndex).toBeGreaterThan(-1)
    expect(secondRowIndex).toBeGreaterThan(firstRowIndex)
  })

  test('empty list shows empty-state message and no table', async () => {
    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: []
    })

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions/scored')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('No submissions have been scored yet')
    expect(payload).not.toContain('Submission identifier')
  })

  test('a row with no recognised classification kind falls back to "Unknown"', async () => {
    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0500',
          scoredAt: '2026-07-31T09:00:00.000Z',
          status: 'scored',
          result: null
        }
      ]
    })

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions/scored')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('SUB-2026-0500')
    expect(payload).toContain('Unknown')
  })

  test('each row links to the detail page', async () => {
    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          scoredAt: '2026-07-31T10:00:00.000Z',
          status: 'scored',
          result: { kind: 'opportunity' }
        }
      ]
    })

    const { payload } = await injectWithStubbedCredentials('/submissions/scored')

    expect(payload).toContain('href="/submissions/SUB-2026-0184"')
  })

  test('backend unavailable shows friendly message', async () => {
    submissionsApi.listScoredSubmissions.mockRejectedValue(
      new Error('backend-unavailable')
    )

    const { statusCode, payload } =
      await injectWithStubbedCredentials('/submissions/scored')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('the triage service is unavailable')
    expect(payload).not.toContain('ECONNREFUSED')
  })

  test('the list is bounded to the most recently scored submissions', async () => {
    const data = Array.from({ length: 60 }, (_, index) => ({
      submissionId: `SUB-2026-${1000 + index}`,
      scoredAt: new Date(2026, 6, 1, 0, index).toISOString(),
      status: 'scored',
      result: { kind: 'enquiry' }
    }))

    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data
    })

    const { payload } = await injectWithStubbedCredentials('/submissions/scored')

    const rowCount = (payload.match(/govuk-table__row/g) || []).length

    // 1 header row + up to 50 body rows
    expect(rowCount).toBeLessThanOrEqual(51)
    expect(payload).toContain('SUB-2026-1059')
    expect(payload).not.toContain('SUB-2026-1000')
  })

  test('the unprocessed queue links to the scored submissions page', async () => {
    submissionsApi.listUnprocessedSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: []
    })

    const { payload } = await injectWithStubbedCredentials('/submissions')

    expect(payload).toContain('href="/submissions/scored"')
  })

  test('no POST or scoring calls are made when viewing the scored list', async () => {
    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          scoredAt: '2026-07-31T10:00:00.000Z',
          status: 'scored',
          result: { kind: 'opportunity' }
        }
      ]
    })

    await injectWithStubbedCredentials('/submissions/scored')

    expect(submissionsApi.scoreSubmission).not.toHaveBeenCalled()
  })

  function buildOpportunityScoring () {
    const criterion = (rag, explanation) => ({
      rag,
      rubric_band_cited: `${rag} band`,
      evidence_quoted: 'the words from the submission',
      explanation,
      missing_evidence: false
    })

    return {
      criteria: {
        business_value: criterion('green', 'a real problem, quantified.'),
        user_impact: criterion('green', 'names who is affected.'),
        data_readiness: criterion('green', 'data is clean and available.'),
        process_stability: criterion('green', 'unchanged for two years.'),
        ai_fit: criterion('green', 'a well-served pattern.'),
        risk: criterion('green', 'low risk, no personal data.'),
        scalability: criterion('green', 'applies to other teams.'),
        cross_defra_value: criterion('green', 'applies across Defra.')
      },
      routing_recommendation: 'hands_on_session',
      pattern_cited: '',
      flags: {
        governance_required: false,
        low_confidence: false,
        access_request: false
      },
      rubric_version: '2026-07-29'
    }
  }

  test('from the scored list, a submission scored in an earlier session can be opened and offers its Jira hand-off link, with no re-scoring', async () => {
    submissionsApi.listScoredSubmissions.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: [
        {
          submissionId: 'SUB-2026-0184',
          scoredAt: '2026-07-31T10:00:00.000Z',
          status: 'scored',
          result: { kind: 'opportunity' }
        }
      ]
    })

    const { payload: listPayload } = await injectWithStubbedCredentials(
      '/submissions/scored'
    )

    expect(listPayload).toContain('href="/submissions/SUB-2026-0184"')

    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'We spend two days a week reading applications by hand',
        result: {
          id: 'SUB-2026-0184',
          kind: 'opportunity',
          reason: 'Describes an AI use case to triage.',
          scoring: buildOpportunityScoring()
        }
      }
    })

    const { statusCode, payload: detailPayload } =
      await injectWithStubbedCredentials('/submissions/SUB-2026-0184')

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(detailPayload).toContain('target="_blank"')
    expect(detailPayload).toContain('rel="noopener noreferrer"')
    expect(detailPayload).toContain('pid=10042')
    expect(detailPayload).toContain('issuetype=10005')
    expect(submissionsApi.scoreSubmission).not.toHaveBeenCalled()
  })
})
