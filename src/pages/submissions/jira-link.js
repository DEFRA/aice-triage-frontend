const CRITERIA_ORDER = [
  ['business_value', 'Business value'],
  ['user_impact', 'User impact'],
  ['data_readiness', 'Data readiness'],
  ['process_stability', 'Process stability'],
  ['ai_fit', 'AI fit'],
  ['risk', 'Risk'],
  ['scalability', 'Scalability'],
  ['cross_defra_value', 'Cross-Defra value']
]

const KIND_SUMMARY_LABELS = {
  opportunity: 'AI opportunity',
  access_request: 'access request',
  enquiry: 'enquiry'
}

const MAX_DESCRIPTION_LENGTH = 1500
const TRUNCATION_NOTICE =
  '\n\n[Description truncated — this page is the full record.]'

const ROUTING_LABELS = {
  hands_on_session: 'hands-on session'
}

function formatRoutingRecommendation (routingRecommendation, patternCited) {
  if (routingRecommendation === 'recommended_pattern') {
    return `recommended pattern — ${patternCited}`
  }
  return (
    ROUTING_LABELS[routingRecommendation] ??
    routingRecommendation.replaceAll('_', ' ')
  )
}

function buildCriteriaLines (criteria) {
  return CRITERIA_ORDER.map(([key, label]) => {
    const criterion = criteria[key]
    const missingEvidenceSuffix = criterion.missing_evidence
      ? ' (missing evidence)'
      : ''

    return (
      `*${label}* — ${criterion.rag.toUpperCase()}` +
      `${missingEvidenceSuffix}: ${criterion.explanation}`
    )
  }).join('\n')
}

function buildFooter (detailUrl) {
  return `Scored by the AICE triage service. Full record:\n${detailUrl}`
}

function truncateDescription (body, footer) {
  const full = `${body}\n\n${footer}`

  if (full.length <= MAX_DESCRIPTION_LENGTH) {
    return { description: full, truncated: false }
  }

  const budget =
    MAX_DESCRIPTION_LENGTH - TRUNCATION_NOTICE.length - footer.length - 2
  const truncatedBody = body.slice(0, Math.max(budget, 0))

  return {
    description: `${truncatedBody}${TRUNCATION_NOTICE}\n\n${footer}`,
    truncated: true
  }
}

function buildJiraDescription (result, detailUrl) {
  const footer = buildFooter(detailUrl)

  if (result.kind !== 'opportunity') {
    const summaryBody = `${KIND_SUMMARY_LABELS[result.kind]}\n\n${result.reason}`

    return truncateDescription(summaryBody, footer)
  }

  const { scoring } = result
  const criteriaLines = buildCriteriaLines(scoring.criteria)
  const routingText = formatRoutingRecommendation(
    scoring.routing_recommendation,
    scoring.pattern_cited
  )
  const body =
    `${criteriaLines}\n\n` +
    `*Routing recommendation:* ${routingText}.\n` +
    `Scored against rubric version ${scoring.rubric_version}.`

  return truncateDescription(body, footer)
}

function buildJiraSummary (result) {
  return `${result.id} — ${KIND_SUMMARY_LABELS[result.kind]}`
}

function buildJiraUrl ({
  baseUrl,
  projectId,
  issueTypeId,
  summary,
  description
}) {
  const query = [
    `pid=${encodeURIComponent(projectId)}`,
    `issuetype=${encodeURIComponent(issueTypeId)}`,
    `summary=${encodeURIComponent(summary)}`,
    `description=${encodeURIComponent(description)}`
  ].join('&')

  return `${baseUrl}/secure/CreateIssueDetails!init.jspa?${query}`
}

function buildJiraLink (result, { baseUrl, projectId, issueTypeId, detailUrl }) {
  const summary = buildJiraSummary(result)
  const { description, truncated } = buildJiraDescription(result, detailUrl)
  const url = buildJiraUrl({
    baseUrl,
    projectId,
    issueTypeId,
    summary,
    description
  })

  return { url, summary, description, truncated }
}

function getCriteriaRows (criteria) {
  return CRITERIA_ORDER.map(([key, label]) => ({
    key,
    label,
    ...criteria[key]
  }))
}

export {
  buildJiraLink,
  buildJiraUrl,
  buildJiraDescription,
  buildJiraSummary,
  formatRoutingRecommendation,
  getCriteriaRows,
  KIND_SUMMARY_LABELS
}
