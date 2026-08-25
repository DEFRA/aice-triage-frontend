import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../src/server/server.js'
import * as submissionsApi from '../../../src/pages/submissions/api.js'
import { loginAsDevUser } from '../helpers/login.js'

vi.mock('../../../src/pages/submissions/api.js', () => ({
  listUnprocessedSubmissions: vi.fn(),
  getSubmissionById: vi.fn(),
  scoreSubmission: vi.fn()
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

  async function injectWithStubbedCredentials (url) {
    const cookie = await loginAsDevUser(server)

    return server.inject({
      method: 'GET',
      url,
      headers: { cookie }
    })
  }

  async function postWithStubbedCredentials (url) {
    const cookie = await loginAsDevUser(server)

    return server.inject({
      method: 'POST',
      url,
      headers: { cookie }
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

  test('queue: each row renders a Triage form posting to the score endpoint', async () => {
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

    expect(payload).toContain(
      '<form method="post" action="/submissions/SUB-2026-0184/score">'
    )
    expect(payload).toContain('Triage')
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
  test('unscored submission shows the Score button, no result', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'unprocessed',
        text: 'We spend two days a week reading applications by hand'
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('Score this submission')
    expect(payload).not.toContain('This is an access request')
    expect(payload).not.toContain('This is an enquiry')
    expect(payload).not.toContain('AI opportunity')
  })

  test('pressing the button triggers scoring and redirects to the detail page', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        id: 'SUB-2026-0184',
        kind: 'opportunity',
        reason: 'Describes an AI use case to triage.',
        scoring: null
      }
    })

    const response = await postWithStubbedCredentials(
      '/submissions/SUB-2026-0184/score'
    )

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(response.headers.location).toBe('/submissions/SUB-2026-0184')
  })

  test('triage triggered from the queue redirects to, and renders, the report', async () => {
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

    const scoreResponse = await postWithStubbedCredentials(
      '/submissions/SUB-2026-0184/score'
    )

    expect(scoreResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(scoreResponse.headers.location).toBe('/submissions/SUB-2026-0184')

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
          kind: 'enquiry',
          reason: 'Asks a question with no use case in it.',
          scoring: null
        }
      }
    })

    const reportResponse = await injectWithStubbedCredentials(
      scoreResponse.headers.location
    )

    expect(reportResponse.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(reportResponse.payload).toContain('This is an enquiry')
    expect(reportResponse.payload).toContain(
      'Asks a question with no use case in it.'
    )
    expect(reportResponse.payload).not.toContain('Score this submission')
  })

  test('a 409 from the backend redirects with an in-flight flag, not an error', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: false,
      status: statusCodes.HTTP_STATUS_CONFLICT,
      data: null
    })

    const response = await postWithStubbedCredentials(
      '/submissions/SUB-2026-0184/score'
    )

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(response.headers.location).toBe(
      '/submissions/SUB-2026-0184?scoring=in-flight'
    )
  })

  test('triage triggered from the queue while already in-flight redirects to, and renders, the in-flight message', async () => {
    submissionsApi.scoreSubmission.mockResolvedValue({
      ok: false,
      status: statusCodes.HTTP_STATUS_CONFLICT,
      data: null
    })

    const scoreResponse = await postWithStubbedCredentials(
      '/submissions/SUB-2026-0184/score'
    )

    expect(scoreResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(scoreResponse.headers.location).toBe(
      '/submissions/SUB-2026-0184?scoring=in-flight'
    )

    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'unprocessed',
        text: 'We spend two days a week reading applications by hand'
      }
    })

    const reportResponse = await injectWithStubbedCredentials(
      scoreResponse.headers.location
    )

    expect(reportResponse.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(reportResponse.payload).toContain(
      'Scoring is already running, refresh shortly'
    )
    expect(reportResponse.payload).not.toContain('Score this submission')
  })

  test('the in-flight flag renders a "refresh shortly" message, no button', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'unprocessed',
        text: 'We spend two days a week reading applications by hand'
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184?scoring=in-flight'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('Scoring is already running, refresh shortly')
    expect(payload).not.toContain('Score this submission')
  })

  test('revisiting a scored submission shows the stored result, no button', async () => {
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
          kind: 'enquiry',
          reason: 'Asks a question with no use case in it.',
          scoring: null
        }
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).not.toContain('Score this submission')
  })

  function buildOpportunityScoring (overrides = {}) {
    const criterion = (rag, explanation, missingEvidence = false) => ({
      rag,
      rubric_band_cited: `${rag} band`,
      evidence_quoted: missingEvidence ? '' : 'the words from the submission',
      explanation,
      missing_evidence: missingEvidence
    })

    return {
      criteria: {
        business_value: criterion(
          'amber',
          'real problem stated, no quantified AI benefit.'
        ),
        user_impact: criterion(
          'green',
          'names the caseworkers affected and the time lost today.'
        ),
        data_readiness: criterion(
          'amber',
          'nothing said about data quality.',
          true
        ),
        process_stability: criterion(
          'green',
          'the process has not changed in two years.'
        ),
        ai_fit: criterion(
          'green',
          'classification of free text, a well-served pattern.'
        ),
        risk: criterion(
          'amber',
          'decisions affect applicants, so a human check is needed.'
        ),
        scalability: criterion(
          'amber',
          'one team today, no stated route to others.'
        ),
        cross_defra_value: criterion(
          'green',
          'applies to EA & Natural England too.'
        )
      },
      routing_recommendation: 'hands_on_session',
      pattern_cited: '',
      flags: {
        governance_required: false,
        low_confidence: false,
        access_request: false
      },
      rubric_version: '2026-07-29',
      ...overrides
    }
  }

  test('an opportunity shows all eight criteria, tags, explanations, missing evidence, audit fields and routing', async () => {
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

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    ;[
      'Business value',
      'User impact',
      'Data readiness',
      'Process stability',
      'AI fit',
      'Risk',
      'Scalability',
      'Cross-Defra value'
    ].forEach((label) => expect(payload).toContain(label))

    expect(payload).toContain('govuk-tag--yellow')
    expect(payload).toContain('real problem stated, no quantified AI benefit.')
    expect(payload).toContain('Missing evidence')
    expect(payload).toContain('the words from the submission')
    expect(payload).toContain('amber band')
    expect(payload).toContain('hands-on session')
    expect(payload).toContain('2026-07-29')
  })

  test('names the pattern when routing is recommended_pattern', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'irrelevant',
        result: {
          id: 'SUB-2026-0184',
          kind: 'opportunity',
          reason: 'Describes an AI use case to triage.',
          scoring: buildOpportunityScoring({
            routing_recommendation: 'recommended_pattern',
            pattern_cited: 'Document classification'
          })
        }
      }
    })

    const { payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(payload).toContain('Document classification')
  })

  test('an access_request shows its own classification and reason, no grid', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0200',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'irrelevant',
        result: {
          id: 'SUB-2026-0200',
          kind: 'access_request',
          reason: 'The real ask is tool licences for named people.',
          scoring: null
        }
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0200'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('This is an access request')
    expect(payload).toContain('The real ask is tool licences for named people.')
    expect(payload).not.toContain('govuk-table')
    expect(payload).not.toContain('This is an enquiry')
  })

  test('an enquiry shows its own classification and reason, no grid', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0201',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'irrelevant',
        result: {
          id: 'SUB-2026-0201',
          kind: 'enquiry',
          reason: 'Asks a question with no use case in it.',
          scoring: null
        }
      }
    })

    const { statusCode, payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0201'
    )

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('This is an enquiry')
    expect(payload).toContain('Asks a question with no use case in it.')
    expect(payload).not.toContain('govuk-table')
    expect(payload).not.toContain('This is an access request')
  })

  test('governance_required and low_confidence render visible notices when true', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'irrelevant',
        result: {
          id: 'SUB-2026-0184',
          kind: 'opportunity',
          reason: 'Describes an AI use case to triage.',
          scoring: buildOpportunityScoring({
            flags: {
              governance_required: true,
              low_confidence: true,
              access_request: false
            }
          })
        }
      }
    })

    const { payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(payload).toContain('Governance required')
    expect(payload).toContain('Low confidence')
  })

  test('flags produce no notice when false', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'irrelevant',
        result: {
          id: 'SUB-2026-0184',
          kind: 'opportunity',
          reason: 'Describes an AI use case to triage.',
          scoring: buildOpportunityScoring()
        }
      }
    })

    const { payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(payload).not.toContain('Governance required')
    expect(payload).not.toContain('Low confidence')
  })

  test('the Jira link is present, opens in a new tab, and every value is encoded', async () => {
    submissionsApi.getSubmissionById.mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        submissionId: 'SUB-2026-0184',
        receivedAt: '2026-07-31T09:52:46.854Z',
        status: 'scored',
        scoredAt: '2026-07-31T10:00:00.000Z',
        text: 'irrelevant',
        result: {
          id: 'SUB-2026-0184',
          kind: 'opportunity',
          reason: 'Describes an AI use case to triage.',
          scoring: buildOpportunityScoring()
        }
      }
    })

    const { payload } = await injectWithStubbedCredentials(
      '/submissions/SUB-2026-0184'
    )

    expect(payload).toContain('target="_blank"')
    expect(payload).toContain('rel="noopener noreferrer"')
    expect(payload).toContain('pid=10042')
    expect(payload).toContain('issuetype=10005')
    expect(payload).toContain('%26') // encoded & from "EA & Natural England"
  })
})
