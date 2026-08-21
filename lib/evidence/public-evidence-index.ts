/**
 * The Context-Control evidence package, as web paths.
 *
 * One list, so a link cannot be added to a page without appearing in the index
 * and vice versa, and so every href is a served route rather than a repository
 * path. A `content/...` link renders as a 404 for a buyer and as a broken
 * promise for the person who sent it.
 *
 * Each description states only what the document itself claims. Nothing here
 * characterises a result.
 */
export type PublicEvidenceItem = {
  id: string
  title: string
  href: string
  kind: 'pdf' | 'json' | 'page'
  description: string
}

export const PUBLIC_EVIDENCE: readonly PublicEvidenceItem[] = [
  {
    id: 'wso2-live-evaluation-evidence',
    title: 'WSO2 evaluation evidence artifact',
    href: '/benchmarks/wso2/live-evaluation-evidence.json',
    kind: 'json',
    description: 'Every call in the frozen three-path evaluation as its own row, with the aggregates re-derived from those rows.',
  },
  {
    id: 'context-control-evidence-assessment-sample',
    title: 'Sample Context-Control Evidence Assessment',
    href: '/assessments/context-control-evidence-assessment-sample.pdf',
    kind: 'pdf',
    description: 'The deliverable a customer receives, produced from a synthetic corpus. Not a customer result.',
  },
  {
    id: 'context-control-security-boundary',
    title: 'Security and data-boundary one-pager',
    href: '/security/context-control-security-boundary.pdf',
    kind: 'pdf',
    description: 'What the compiler and its WSO2 interceptor do with context data, with each statement traced to committed source.',
  },
  {
    id: 'mcrb1-dense-baseline',
    title: 'MCRB-1 dense retriever baseline',
    href: '/benchmarks/mcrb-1/dense/results.json',
    kind: 'json',
    description: 'An embedding-retrieval baseline on the frozen MCRB-1 cohort, published beside the v1 results it is compared with.',
  },
  {
    id: 'mcrb1-v1',
    title: 'MCRB-1 v1.0.0 results',
    href: '/benchmarks/mcrb-1/results.json',
    kind: 'json',
    description: 'The frozen v1 retention benchmark.',
  },
] as const

/** A repository path in an href is a 404 for a buyer; this is asserted in tests. */
export function nonWebPaths(): string[] {
  return PUBLIC_EVIDENCE
    .filter((item) => !item.href.startsWith('/') || /^\/(content|docs|lib|scripts|test)\//.test(item.href))
    .map((item) => `${item.id}: ${item.href}`)
}
