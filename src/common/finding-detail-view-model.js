import { severityTag } from './findings.js'

/**
 * Assemble the common view-model shape for a single finding's detail page:
 * the finding tagged with its severity, feedback state, and navigation
 * fields shared by every "finding detail + feedback" page. Callers resolve
 * the finding (or 404) and build the domain-specific fields (urls,
 * breadcrumbs, agent) themselves and pass them in explicitly.
 *
 * The page heading is a stable "Finding N of M" label — finding titles are
 * model-written prose, so they render as the lede paragraph rather than as
 * a heading.
 *
 * @param {object} params
 * @param {{ title: string, severity: string }} params.finding
 * @param {string} params.page
 * @param {string} params.agent
 * @param {string} params.jobId
 * @param {number} params.index
 * @param {number} params.total - total findings in the review/check
 * @param {string} params.caption - context shown above the h1 (document title)
 * @param {object|null} params.feedback
 * @param {string|null} params.errorMessage
 * @param {boolean} params.alreadySubmittedNotice
 * @param {string} params.actionUrl
 * @param {string} params.backHref
 * @param {object[]} params.breadcrumbs
 * @returns {object}
 */
function buildFindingDetailViewModel ({
  finding,
  page,
  agent,
  jobId,
  index,
  total,
  caption,
  feedback,
  errorMessage,
  alreadySubmittedNotice,
  actionUrl,
  backHref,
  breadcrumbs
}) {
  const heading = `Finding ${index + 1} of ${total}`

  return {
    pageTitle: heading,
    page,
    caption,
    finding: {
      ...finding,
      severityTag: severityTag(finding.severity),
      heading
    },
    jobId,
    findingIndex: index,
    agent,
    feedback,
    feedbackSubmitted: feedback !== null,
    errorMessage,
    alreadySubmittedNotice,
    actionUrl,
    backHref,
    breadcrumbs
  }
}

export { buildFindingDetailViewModel }
