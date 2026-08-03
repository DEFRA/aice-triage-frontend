const homeCrumb = { text: 'Home', href: '/' }

const guidanceDocumentsBreadcrumbs = () => [
  homeCrumb,
  { text: 'Guidance documents', href: '/guidance-documents' }
]

const publishingChecksBreadcrumbs = () => [
  homeCrumb,
  { text: 'Publishing checks', href: '/publishing-checks' }
]

const contentReviewBreadcrumbs = () => [
  homeCrumb,
  { text: 'Content review', href: '/content-review' }
]

export { homeCrumb, guidanceDocumentsBreadcrumbs, publishingChecksBreadcrumbs, contentReviewBreadcrumbs }
