import {
  buildJiraLink,
  buildJiraUrl,
  buildJiraDescription,
  buildJiraSummary,
  formatRoutingRecommendation
} from '../../../../src/pages/submissions/jira-link.js'

const detailUrl = 'https://aice-frontend.defra.gov.uk/submissions/SUB-2026-0184'

const jiraConfig = {
  baseUrl: 'https://defra.atlassian.net',
  projectId: '10042',
  issueTypeId: '10005'
}

function buildCriterion (overrides = {}) {
  return {
    rag: 'green',
    rubric_band_cited: 'Some band',
    evidence_quoted: 'some quote',
    explanation: 'Some explanation.',
    missing_evidence: false,
    ...overrides
  }
}

function buildOpportunityResult (overrides = {}) {
  return {
    id: 'SUB-2026-0184',
    kind: 'opportunity',
    reason: 'Describes an AI use case to triage.',
    scoring: {
      criteria: {
        business_value: buildCriterion({
          rag: 'amber',
          explanation: 'real problem stated, no quantified AI benefit.'
        }),
        user_impact: buildCriterion({
          rag: 'green',
          explanation: 'names the caseworkers affected and the time lost today.'
        }),
        data_readiness: buildCriterion({
          rag: 'amber',
          explanation: 'nothing said about data quality.',
          missing_evidence: true
        }),
        process_stability: buildCriterion({
          rag: 'green',
          explanation: 'the process has not changed in two years.'
        }),
        ai_fit: buildCriterion({
          rag: 'green',
          explanation: 'classification of free text, a well-served pattern.'
        }),
        risk: buildCriterion({
          rag: 'amber',
          explanation:
            'decisions affect applicants, so a human check is needed.'
        }),
        scalability: buildCriterion({
          rag: 'amber',
          explanation: 'one team today, no stated route to others.'
        }),
        cross_defra_value: buildCriterion({
          rag: 'green',
          explanation: 'applies to EA & Natural England too.'
        })
      },
      routing_recommendation: 'hands_on_session',
      pattern_cited: '',
      flags: {
        governance_required: false,
        low_confidence: false,
        access_request: false
      },
      rubric_version: '2026-07-29'
    },
    ...overrides
  }
}

describe('#jira-link', () => {
  describe('#buildJiraSummary', () => {
    test('Should build a one-liner from the id and classification for an opportunity', () => {
      const result = buildOpportunityResult()

      expect(buildJiraSummary(result)).toBe('SUB-2026-0184 — AI opportunity')
    })

    test('Should build a one-liner from the id and classification for an access_request', () => {
      const result = {
        id: 'SUB-2026-0200',
        kind: 'access_request',
        reason: 'Wants a licence, not a use case.'
      }

      expect(buildJiraSummary(result)).toBe('SUB-2026-0200 — access request')
    })

    test('Should build a one-liner from the id and classification for an enquiry', () => {
      const result = {
        id: 'SUB-2026-0201',
        kind: 'enquiry',
        reason: 'Asks a question with no use case in it.'
      }

      expect(buildJiraSummary(result)).toBe('SUB-2026-0201 — enquiry')
    })
  })

  describe('#buildJiraDescription', () => {
    test('Should render the worked example exactly for a scored opportunity', () => {
      const result = buildOpportunityResult()

      const { description, truncated } = buildJiraDescription(result, detailUrl)

      expect(description).toBe(
        '*Business value* — AMBER: real problem stated, no quantified AI benefit.\n' +
          '*User impact* — GREEN: names the caseworkers affected and the time lost today.\n' +
          '*Data readiness* — AMBER (missing evidence): nothing said about data quality.\n' +
          '*Process stability* — GREEN: the process has not changed in two years.\n' +
          '*AI fit* — GREEN: classification of free text, a well-served pattern.\n' +
          '*Risk* — AMBER: decisions affect applicants, so a human check is needed.\n' +
          '*Scalability* — AMBER: one team today, no stated route to others.\n' +
          '*Cross-Defra value* — GREEN: applies to EA & Natural England too.\n\n' +
          '*Routing recommendation:* hands-on session.\n' +
          'Scored against rubric version 2026-07-29.\n\n' +
          'Scored by the AICE triage service. Full record:\n' +
          detailUrl
      )
      expect(truncated).toBe(false)
    })

    test('Should name the pattern when routing is recommended_pattern', () => {
      const base = buildOpportunityResult()
      const result = buildOpportunityResult({
        scoring: {
          ...base.scoring,
          routing_recommendation: 'recommended_pattern',
          pattern_cited: 'Document classification'
        }
      })

      const { description } = buildJiraDescription(result, detailUrl)

      expect(description).toContain(
        '*Routing recommendation:* recommended pattern — Document classification.'
      )
    })

    test('Should render only the classification and reason for an access_request, with no grid', () => {
      const result = {
        id: 'SUB-2026-0200',
        kind: 'access_request',
        reason: 'The real ask is tool licences for named people.'
      }

      const { description } = buildJiraDescription(result, detailUrl)

      expect(description).toBe(
        'access request\n\n' +
          'The real ask is tool licences for named people.\n\n' +
          'Scored by the AICE triage service. Full record:\n' +
          detailUrl
      )
      expect(description).not.toContain('*Business value*')
      expect(description).not.toContain('Routing recommendation')
    })

    test('Should render only the classification and reason for an enquiry, with no grid', () => {
      const result = {
        id: 'SUB-2026-0201',
        kind: 'enquiry',
        reason: 'Asks for a position with no use case in it.'
      }

      const { description } = buildJiraDescription(result, detailUrl)

      expect(description).toBe(
        'enquiry\n\n' +
          'Asks for a position with no use case in it.\n\n' +
          'Scored by the AICE triage service. Full record:\n' +
          detailUrl
      )
      expect(description).not.toContain('*Business value*')
      expect(description).not.toContain('Routing recommendation')
    })

    test('Should truncate a very long description, note the truncation, and still point back at the detail page', () => {
      const base = buildOpportunityResult()
      const result = buildOpportunityResult({
        scoring: {
          ...base.scoring,
          criteria: Object.fromEntries(
            Object.entries(base.scoring.criteria).map(([key, criterion]) => [
              key,
              { ...criterion, explanation: 'x'.repeat(400) }
            ])
          )
        }
      })

      const { description, truncated } = buildJiraDescription(result, detailUrl)

      expect(truncated).toBe(true)
      expect(description.length).toBeLessThanOrEqual(1500)
      expect(description).toContain(
        '[Description truncated — this page is the full record.]'
      )
      expect(description.endsWith(detailUrl)).toBe(true)
    })
  })

  describe('#formatRoutingRecommendation', () => {
    test('Should name the pattern for recommended_pattern', () => {
      expect(
        formatRoutingRecommendation('recommended_pattern', 'Some pattern')
      ).toBe('recommended pattern — Some pattern')
    })

    test('Should map a known routing key to its label', () => {
      expect(formatRoutingRecommendation('hands_on_session')).toBe(
        'hands-on session'
      )
    })
  })

  describe('#buildJiraUrl', () => {
    test('Should URL-encode every value while leaving query separators raw', () => {
      const summary = 'SUB-2026-0184 — AI opportunity'
      const description =
        '*Cross-Defra value* — GREEN: applies to EA & Natural England too.\n' +
        'A rationale with a + sign and a "quoted" word.'

      const url = buildJiraUrl({ ...jiraConfig, summary, description })

      expect(
        url.startsWith(
          'https://defra.atlassian.net/secure/CreateIssueDetails!init.jspa?'
        )
      ).toBe(true)
      expect(url).toContain('pid=10042&issuetype=10005&summary=')

      // Only the 3 query separators should be raw '&' characters.
      expect(url.split('&').length - 1).toBe(3)

      expect(url).toContain('%E2%80%94') // em dash
      expect(url).toContain('%20') // spaces
      expect(url).toContain('%26') // the ampersand inside the value
      expect(url).toContain('%2B') // the + sign inside the value
      expect(url).toContain('%0A') // line breaks
      expect(url).toContain('%3A') // colons
    })

    test('Should round-trip: parsing the URL back yields the original summary and description', () => {
      const summary = 'SUB-2026-0184 — AI opportunity'
      const description =
        '*Business value* — AMBER: real problem stated, no quantified AI benefit.'

      const url = buildJiraUrl({ ...jiraConfig, summary, description })
      const parsed = new URL(url)

      expect(parsed.searchParams.get('pid')).toBe('10042')
      expect(parsed.searchParams.get('issuetype')).toBe('10005')
      expect(parsed.searchParams.get('summary')).toBe(summary)
      expect(parsed.searchParams.get('description')).toBe(description)
    })

    test('A submission identifier containing & must not corrupt the URL', () => {
      const summary = 'SUB & 2026-0184 — AI opportunity'

      const url = buildJiraUrl({
        ...jiraConfig,
        summary,
        description: 'irrelevant'
      })
      const parsed = new URL(url)

      expect(parsed.searchParams.get('summary')).toBe(summary)
      expect(url.split('&').length - 1).toBe(3)
    })
  })

  describe('#buildJiraLink', () => {
    test('Should assemble the full worked-example link', () => {
      const result = buildOpportunityResult()

      const { url, summary, description, truncated } = buildJiraLink(result, {
        ...jiraConfig,
        detailUrl
      })

      expect(summary).toBe('SUB-2026-0184 — AI opportunity')
      expect(truncated).toBe(false)

      const parsed = new URL(url)
      expect(parsed.searchParams.get('pid')).toBe('10042')
      expect(parsed.searchParams.get('issuetype')).toBe('10005')
      expect(parsed.searchParams.get('summary')).toBe(summary)
      expect(parsed.searchParams.get('description')).toBe(description)
    })
  })
})
