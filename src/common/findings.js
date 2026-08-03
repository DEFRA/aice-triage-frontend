const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

const SEVERITY_TAGS = {
  critical: { text: 'Critical', classes: 'govuk-tag--red' },
  high: { text: 'High', classes: 'govuk-tag--orange' },
  medium: { text: 'Medium', classes: 'govuk-tag--yellow' },
  low: { text: 'Low', classes: 'govuk-tag--blue' },
  info: { text: 'Info', classes: 'govuk-tag--grey' }
}

const IMPORTANT_SEVERITIES = new Set(['critical', 'high'])

function _rank (severity) {
  return SEVERITY_RANK[severity] ?? SEVERITY_ORDER.length
}

function severityTag (severity) {
  return SEVERITY_TAGS[severity] ?? SEVERITY_TAGS.info
}

const MAX_TITLE_LENGTH = 80
// Only cut on a word boundary if it leaves a reasonable amount of text;
// otherwise a very early space would truncate the title too aggressively.
const MIN_WORD_BOUNDARY = 40

/**
 * Shorten a finding title for use as a task-list link, cutting on a word
 * boundary. The full text remains on the finding's detail page.
 *
 * @param {string} text
 * @param {number} [max=MAX_TITLE_LENGTH]
 * @returns {string}
 */
function truncateTitle (text, max = MAX_TITLE_LENGTH) {
  if (!text || text.length <= max) { return text }
  const slice = text.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > MIN_WORD_BOUNDARY ? slice.slice(0, lastSpace) : slice
  return `${cut.trimEnd()}…`
}

/**
 * Build govukSummaryList rows (one per present severity, worst-first) for an
 * "Issue overview" summary card: severity label with a colour-coded count.
 *
 * @param {{ severity: string }[]} findings
 * @returns {object[]}
 */
function severitySummaryRows (findings) {
  return severityCounts(findings).map(({ severity, count }) => {
    const tag = severityTag(severity)
    return {
      key: { text: tag.text },
      value: { html: `<strong class="govuk-tag ${tag.classes}">${count}</strong>` }
    }
  })
}

/**
 * Count findings per severity, in worst-first order, omitting zero counts.
 *
 * @param {{ severity: string }[]} findings
 * @returns {{ severity: string, count: number }[]}
 */
function severityCounts (findings) {
  const counts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1
    return acc
  }, {})
  return SEVERITY_ORDER
    .filter(severity => counts[severity] > 0)
    .map(severity => ({ severity, count: counts[severity] }))
}

function _taskItem (finding, hrefFor) {
  return {
    title: { text: truncateTitle(finding.title) },
    hint: { text: truncateTitle(finding.location, 64) },
    href: hrefFor(finding.id),
    status: { tag: severityTag(finding.severity) }
  }
}

/**
 * Split normalised findings into two severity groups, each worst-first, as
 * govukTaskList items linking to a per-finding detail page.
 *
 * Sorting is stable, so findings of equal severity keep their original
 * (flattened) order — which is the order their stable `id` was assigned in.
 *
 * @param {{ id: number, title: string, location: string, severity: string }[]} findings
 * @param {(id: number) => string} hrefFor - Builds the detail href for a finding id.
 * @returns {{ important: object[], suggestions: object[] }}
 */
function buildSeverityGroups (findings, hrefFor) {
  const sorted = [...findings].sort((a, b) => _rank(a.severity) - _rank(b.severity))
  const toItems = (list) => list.map((f) => _taskItem(f, hrefFor))

  return {
    important: toItems(sorted.filter((f) => IMPORTANT_SEVERITIES.has(f.severity))),
    suggestions: toItems(sorted.filter((f) => !IMPORTANT_SEVERITIES.has(f.severity)))
  }
}

export { severityTag, severityCounts, severitySummaryRows, buildSeverityGroups }
