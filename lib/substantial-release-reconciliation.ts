import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, evaluatePublicationGate } from './epistemic-publication.ts'
import { alignmentBlockers } from './frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from './pilot-source-alignment.ts'
import { SUBSTANTIAL_BATCH_2_PAGES } from './substantial-page-publication-batch-2.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
export { mayRenderSubstantialMaterial } from './substantial-render-guard.ts'

export const RELEASE_RECONCILIATION_VERSION = 'maha-substantial-release-reconciliation/1.0' as const

/**
 * The five states a substantial page can be in are genuinely different things,
 * and batch two was described as a "30-page publication" because four of them
 * were collapsed into the word "published". Nothing in this module is allowed
 * to use that word: a caller must say which state it means.
 */
export const SUBSTANTIAL_COHORT_STATES = [
  'compiled',
  'eligible',
  'canonically-released',
  'publicly-reachable',
  'substantially-rendered',
] as const
export type SubstantialCohortState = (typeof SUBSTANTIAL_COHORT_STATES)[number]

export const RELEASE_RECONCILIATION_STATES = [
  'ready-for-initial-canonical-release',
  'released-and-revision-matched',
  'released-but-revision-drifted',
  'audit-or-contract-stale',
  'missing-release-decisions',
  'source-alignment-blocked',
  'release-ineligible',
  'withheld-pending-reaudit',
] as const
export type ReleaseReconciliationState = (typeof RELEASE_RECONCILIATION_STATES)[number]

/**
 * Observations of the live release registry and of production routes are
 * operational: they change without any code change, so they are injected
 * rather than read at module load. Everything computed from the record graph
 * stays deterministic and is asserted byte-identical.
 */
export interface CanonicalReleaseObservation {
  recordId: string
  releaseId: string
  status: 'active' | 'superseded' | 'withdrawn'
  targetSha256: string
  canonicalPath: string
  approvals: number
  gatePublicEligible: boolean
}

export interface RouteObservation {
  recordId: string
  httpStatus: number
  inSitemap: boolean
  inLlmsSubstantialSection: boolean
  substantiallyRendered: boolean
}

export interface ReleaseReconciliationEntry {
  recordId: string
  domainSlug: string
  canonicalUrl: string
  contractDigest: string
  auditedRecordRevision: string
  currentRecordRevision: string
  canonicalRegistryState: 'active' | 'superseded' | 'withdrawn' | 'none' | 'unobserved'
  activeReleaseId: string | null
  activeReleaseRevision: string | null
  productionRouteStatus: number | null
  inSitemap: boolean | null
  inLlmsSubstantialSection: boolean | null
  substantiallyRendered: boolean | null
  releaseEligible: boolean
  state: ReleaseReconciliationState
  blockers: readonly string[]
  proposedAction: string
}

const CANONICAL_PREFIX = 'https://www.mahastrategies.com'

function alignmentCodes(recordId: string): readonly string[] {
  return pilotAlignmentFor(recordId)
    ? (isPilotAlignmentClear(recordId) ? [] : ['alignment-not-clear'])
    : alignmentBlockers(recordId)
}

/**
 * A record is only a release candidate if it is real published material, not a
 * control, candidate or rehearsal fixture that happens to satisfy the schema.
 */
function isNonReleasableArtifact(record: EpistemicRecord): boolean {
  return record.publication.reviewState === 'withdrawn'
    || record.id.includes(':candidate:')
    || record.id.includes(':rehearsal:')
    || record.slug.startsWith('rehearsal-')
    || record.slug.startsWith('control-')
}

/**
 * Release readiness is deliberately NOT derived from `pageEligible`. A page can
 * be perfectly compiled and still be unreleasable, which is exactly the case
 * that batch two hit: eligible contracts over records with no scoped review
 * decisions at all.
 */
export function releasePreflightBlockers(record: EpistemicRecord, auditedRevision: string): readonly string[] {
  const blockers: string[] = []
  const page = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === record.id)

  if (!page) blockers.push('substantial-contract-missing')
  else if (!page.quality.eligible) blockers.push('substantial-quality-gate-failed')

  for (const code of alignmentCodes(record.id)) blockers.push(`alignment:${code}`)

  const currentRevision = epistemicReviewTargetHash(record)
  if (currentRevision !== auditedRevision) blockers.push('record-revision-superseded-audited-revision')

  const uninspected = record.sources.filter((source) => !source.exactLocator || !source.rights?.basis)
  if (uninspected.length > 0) blockers.push('source-locator-or-rights-basis-missing')

  if (isNonReleasableArtifact(record)) blockers.push('non-releasable-artifact')

  for (const reason of evaluatePublicationGate(record).reasons) blockers.push(`publication-gate:${reason}`)

  return [...new Set(blockers)].sort()
}

function decideState(
  blockers: readonly string[],
  release: CanonicalReleaseObservation | undefined,
  auditedRevision: string,
): ReleaseReconciliationState {
  if (release && release.status === 'active') {
    return release.targetSha256 === auditedRevision ? 'released-and-revision-matched' : 'released-but-revision-drifted'
  }
  if (blockers.some((code) => code.startsWith('alignment:'))) return 'source-alignment-blocked'
  if (blockers.includes('record-revision-superseded-audited-revision') || blockers.includes('substantial-contract-missing')) {
    return 'audit-or-contract-stale'
  }
  if (blockers.includes('non-releasable-artifact') || blockers.includes('substantial-quality-gate-failed')) return 'release-ineligible'
  if (blockers.some((code) => code.startsWith('publication-gate:expert-review-missing') || code === 'publication-gate:approval-review-missing')) {
    return 'missing-release-decisions'
  }
  if (blockers.length > 0) return 'release-ineligible'
  return 'ready-for-initial-canonical-release'
}

function proposedActionFor(state: ReleaseReconciliationState): string {
  switch (state) {
    case 'released-and-revision-matched': return 'No action. The active release matches the audited revision and the page renders its substantial material.'
    case 'released-but-revision-drifted': return 'Re-audit the current revision, then supersede the release only if the new revision passes every gate. Never edit the old contract to match.'
    case 'ready-for-initial-canonical-release': return 'Eligible for an authorised initial canonical release through the existing release workflow.'
    case 'missing-release-decisions': return 'Obtain scoped expert review decisions for every required scope on this exact revision. No release is possible until they exist.'
    case 'source-alignment-blocked': return 'Resolve the source-alignment blocker with audited evidence work. Do not release.'
    case 'audit-or-contract-stale': return 'Recompile the substantial contract against the current record revision and re-audit before considering release.'
    case 'release-ineligible': return 'Withhold. The record does not satisfy the substantial or release preconditions.'
    case 'withheld-pending-reaudit': return 'Withhold pending completion of the re-audit of the current revision.'
  }
}

export function reconcileBatch2Releases(
  releases: readonly CanonicalReleaseObservation[] = [],
  routes: readonly RouteObservation[] = [],
): readonly ReleaseReconciliationEntry[] {
  const recordsById = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
  const releaseByRecord = new Map<string, CanonicalReleaseObservation>()
  for (const entry of releases) {
    const existing = releaseByRecord.get(entry.recordId)
    // An active release always wins over a superseded or withdrawn one.
    if (!existing || (entry.status === 'active' && existing.status !== 'active')) releaseByRecord.set(entry.recordId, entry)
  }
  const routeByRecord = new Map(routes.map((entry) => [entry.recordId, entry]))
  const observed = releases.length > 0

  return SUBSTANTIAL_BATCH_2_PAGES.map((page) => {
    const recordId = page.contract.recordId
    const record = recordsById.get(recordId)
    if (!record) throw new Error(`Batch two names a record that is not canonical: ${recordId}`)
    const auditedRevision = page.contract.recordRevisionSha256
    const blockers = releasePreflightBlockers(record, auditedRevision)
    const release = releaseByRecord.get(recordId)
    const route = routeByRecord.get(recordId)
    const state = decideState(blockers, release, auditedRevision)

    return {
      recordId,
      domainSlug: record.domainSlug,
      canonicalUrl: `${CANONICAL_PREFIX}${epistemicRecordPath(record)}`,
      contractDigest: page.contractDigest,
      auditedRecordRevision: auditedRevision,
      currentRecordRevision: epistemicReviewTargetHash(record),
      canonicalRegistryState: observed ? (release?.status ?? 'none') : 'unobserved',
      activeReleaseId: release?.status === 'active' ? release.releaseId : null,
      activeReleaseRevision: release?.status === 'active' ? release.targetSha256 : null,
      productionRouteStatus: route?.httpStatus ?? null,
      inSitemap: route?.inSitemap ?? null,
      inLlmsSubstantialSection: route?.inLlmsSubstantialSection ?? null,
      substantiallyRendered: route?.substantiallyRendered ?? null,
      releaseEligible: blockers.length === 0,
      state,
      blockers,
      proposedAction: proposedActionFor(state),
    }
  })
}

/**
 * Counts each cohort state separately. Collapsing these into one number is the
 * defect this module exists to prevent, so there is deliberately no single
 * "published" total to read.
 */
export function cohortCounts(entries: readonly ReleaseReconciliationEntry[]): Record<SubstantialCohortState, number> {
  return {
    compiled: entries.length,
    eligible: entries.filter((entry) => SUBSTANTIAL_BATCH_2_PAGES.find((page) => page.contract.recordId === entry.recordId)?.quality.eligible).length,
    'canonically-released': entries.filter((entry) => entry.activeReleaseId !== null).length,
    'publicly-reachable': entries.filter((entry) => entry.productionRouteStatus === 200).length,
    'substantially-rendered': entries.filter((entry) => entry.substantiallyRendered === true).length,
  }
}

/**
 * A deployment readiness report fails when a selected URL would 404. Sitemap or
 * llms.txt membership is explicitly not accepted as evidence of reachability —
 * both are generated from the same projection that produced the claim.
 */
export function deploymentReadiness(entries: readonly ReleaseReconciliationEntry[]): {
  ready: boolean
  unreachable: readonly string[]
  renderedButUnreleased: readonly string[]
} {
  const observedRoutes = entries.filter((entry) => entry.productionRouteStatus !== null)
  const unreachable = observedRoutes.filter((entry) => entry.productionRouteStatus !== 200).map((entry) => entry.recordId)
  const renderedButUnreleased = entries
    .filter((entry) => entry.substantiallyRendered === true && entry.state === 'released-but-revision-drifted')
    .map((entry) => entry.recordId)
  return {
    ready: observedRoutes.length > 0 && unreachable.length === 0 && renderedButUnreleased.length === 0,
    unreachable,
    renderedButUnreleased,
  }
}

export function reconciliationDigest(entries: readonly ReleaseReconciliationEntry[]): string {
  const deterministic = entries.map((entry) => ({
    recordId: entry.recordId,
    contractDigest: entry.contractDigest,
    auditedRecordRevision: entry.auditedRecordRevision,
    currentRecordRevision: entry.currentRecordRevision,
    releaseEligible: entry.releaseEligible,
    blockers: entry.blockers,
  }))
  return `sha256:${createHash('sha256').update(JSON.stringify(deterministic)).digest('hex')}`
}

export const RELEASE_RECONCILIATION_BOUNDARY =
  'Release readiness is never inferred from a compiled or eligible substantial page. A canonical release additionally requires scoped review decisions on the exact record revision and a separately authenticated human release authority. This module observes and reports; it never creates a decision, never mutates a release and never repairs an evidence mapping.'


export interface CohortReleaseStrategy {
  recordId: string
  strategy: 'already-released' | 'authorised-release-cohort'
  releaseCohortId?: string
}

/**
 * A future batch may only select a record it can actually publish. Selecting on
 * substantial eligibility alone is what produced a "30-page publication" with
 * five canonical routes, so every selected record must declare how it will
 * become reachable.
 */
export function validateCohortReleaseStrategy(
  selected: readonly string[],
  strategies: readonly CohortReleaseStrategy[],
): { valid: boolean; missing: readonly string[]; invalid: readonly string[] } {
  const byRecord = new Map(strategies.map((entry) => [entry.recordId, entry]))
  const missing = selected.filter((recordId) => !byRecord.has(recordId))
  const invalid = selected.flatMap((recordId) => {
    const entry = byRecord.get(recordId)
    if (!entry) return []
    if (entry.strategy === 'authorised-release-cohort' && !entry.releaseCohortId) return [recordId]
    return []
  })
  return { valid: missing.length === 0 && invalid.length === 0, missing, invalid }
}
