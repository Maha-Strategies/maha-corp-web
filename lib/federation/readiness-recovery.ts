import { createHash } from 'node:crypto'

export const REVIEW_AXES = ['source-identity', 'locator', 'claim-scope', 'rights', 'boundary'] as const

export const WORKED_EXAMPLE_READY = new Set([
  'urn:maha:concept:computation:cryptographic-commitments',
  'urn:maha:concept:computation:dimensional-analysis',
  'urn:maha:concept:computation:interpolation',
  'urn:maha:concept:computation:interval-bounds',
  'urn:maha:concept:computation:numerical-integration',
  'urn:maha:concept:computation:root-finding',
])

export const REPLACEMENTS = [
  {
    replaces: 'cand_451a78ac92d2875a61747627',
    conceptId: 'urn:maha:concept:evidence:runtime-witness-receipts',
    routeRole: 'artifact-role-inventory',
    path: '/clearing/evidence-workflows/runtime-witness-receipts/artifact-role-inventory',
    title: 'Runtime Witness Receipts — Artifact Role Inventory',
    source: {
      sourceId: 'src-maha-runtime-witness-contract',
      locator: 'lib/evidence-dossier/runtime-witness.ts — ComputationalWitnessReceipt',
      scope: 'The interface records consumed and produced artifacts separately, including each artifact’s path, digest, role, and size.',
      boundary: 'A receipt records an execution. It does not establish correctness, reproducibility, or fitness for purpose.',
    },
  },
  {
    replaces: 'cand_dcd48c0795ff5cb8ebfcc26b',
    conceptId: 'urn:maha:concept:evidence:privacy-boundary',
    routeRole: 'served-bundle-check',
    path: '/clearing/evidence-workflows/privacy-boundary/served-bundle-check',
    title: 'Privacy Boundary — Served Bundle Check',
    source: {
      sourceId: 'src-maha-served-bundle-boundary',
      locator: 'lib/batch-11-rehearsal-phases.ts — PRIVATE_CORPUS_MARKERS and assertNoPrivateCorpusInBundle',
      scope: 'The implementation scans rendered markup and streamed payloads for a fixed marker set and refuses a match.',
      boundary: 'Passing proves absence of the enumerated markers only; it is not a general privacy certification.',
    },
  },
  {
    replaces: 'cand_48485c2639eca0b2fb4d9852',
    conceptId: 'urn:maha:concept:evidence:correction-and-retraction',
    routeRole: 'withdrawal-propagation',
    path: '/agentic-publishing/correction-and-retraction/withdrawal-propagation',
    title: 'Correction and Retraction — Withdrawal Propagation',
    source: {
      sourceId: 'src-maha-release-withdrawal-state',
      locator: 'lib/epistemic-release.ts — epistemicReleaseStatus and activeEpistemicReleases',
      scope: 'The implementation distinguishes active, superseded, and withdrawn releases and excludes non-active releases from the active projection.',
      boundary: 'It establishes this system’s state transition, not scholarly retraction obligations or universal cache invalidation.',
    },
  },
  {
    replaces: 'cand_379d39a7b88f7c76518ba50c',
    conceptId: 'urn:maha:concept:evidence:internal-review',
    routeRole: 'exact-revision-binding',
    path: '/agentic-publishing/internal-review/exact-revision-binding',
    title: 'Internal Review — Exact Revision Binding',
    source: {
      sourceId: 'src-maha-exact-revision-review',
      locator: 'lib/exact-revision-review.ts — projectReviewState',
      scope: 'The implementation filters decisions by exact revision digest and reports stale decisions separately.',
      boundary: 'It records internal review state. It does not establish independent, expert, or peer review.',
    },
  },
] as const

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

export function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}

export function replacementId(replaces: string, conceptId: string, path: string): string {
  return `cand_${digest({ replaces, conceptId, path, version: 1 }).slice(7, 31)}`
}
