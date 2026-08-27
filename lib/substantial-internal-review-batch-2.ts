import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { EXPERT_REVIEW_CRITERIA } from './epistemic-review.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import type { ExpertReviewScope } from './epistemic-schema.ts'
import { SUBSTANTIAL_BATCH_2_PAGES } from './substantial-page-publication-batch-2.ts'

export const INTERNAL_REVIEW_BATCH_2_VERSION = 'maha-internal-review-batch-2/1.0' as const
export const INTERNAL_REVIEW_BATCH_2_DATE = '2026-08-27' as const

const ALREADY_SUBSTANTIALLY_RENDERED = new Set([
  'urn:maha:record:advanced-materials-graphene-monolayers',
  'urn:maha:record:agentic-systems-mcp-mcp-tool-result-contracts',
  'urn:maha:record:transmon-qubit',
])

export const BATCH_2_DRIFTED_RECORD_IDS = [
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics',
  'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries',
] as const

export const BATCH_2_INTERNAL_REVIEW_RECORD_IDS = SUBSTANTIAL_BATCH_2_PAGES
  .map((page) => page.contract.recordId)
  .filter((recordId) => !ALREADY_SUBSTANTIALLY_RENDERED.has(recordId))
  .sort()

export const BATCH_2_INTERNAL_REVIEW_CANARY_IDS = [
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics',
  'urn:maha:record:agentic-systems-mcp-context-window-position-effects',
  'urn:maha:record:biomolecular-engineering-cell-free-transcription-translation',
  'urn:maha:record:fusion-plasma-systems-disruption-mitigation',
  'urn:maha:record:mechanistic-interpretability-causal-scrubbing',
] as const

export interface PendingReviewCriterion {
  criterionId: string
  question: string
  status: 'pending-record-specific-review'
}

export interface InternalReviewPacket {
  schemaVersion: typeof INTERNAL_REVIEW_BATCH_2_VERSION
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  contractDigest: string
  proposedTier: 'internally-reviewed-canonical'
  publisherConflict: string
  sources: readonly {
    sourceId: string
    title: string
    url: string
    exactLocator: string
    rightsBasis: string
    establishes: string
    boundary: string
  }[]
  claims: readonly {
    claimId: string
    statement: string
    sourceIds: readonly string[]
    scope: string
    boundary: string
    uncertainty: string
    replication: string
  }[]
  boundaries: readonly string[]
  prohibitedInferences: readonly string[]
  driftReAudit: null | {
    classification: 'source-binding-change'
    priorBinding: string
    currentBinding: string
    requiredDisposition: 're-audit-current-revision-before-superseding-release'
  }
  checklist: Readonly<Record<ExpertReviewScope, readonly PendingReviewCriterion[]>>
  decisionStatus: 'pending'
  packetDigest: string
}

const CONFLICT = 'Maha Strategies authors and publishes the record and performs this internal review. The reviewer is not independent of the publisher; no external expert endorsement, peer review, consensus, or independent reproduction is claimed.'

const DRIFT_HISTORY: Readonly<Record<string, { priorBinding: string; currentBinding: string }>> = {
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics': {
    priorBinding: 'Production previously bound the hBN record to the positional graphene source “Electric Field Effect in Atomically Thin Carbon Films.”',
    currentBinding: 'The audited revision binds Dean et al., “Boron nitride substrates for high-quality graphene electronics,” at its abstract.',
  },
  'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries': {
    priorBinding: 'Production previously bound the spike-sorting record to the Neuropixels instrumentation paper.',
    currentBinding: 'The audited revision binds Hill, Mehta, and Kleinfeld, “Quality Metrics to Accompany Spike Sorting of Extracellular Signals,” at its quality-metrics and summary-matrices sections.',
  },
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function packet(recordId: string): InternalReviewPacket {
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)
  const page = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === recordId)
  if (!record || !page) throw new Error(`${recordId}: review packet cannot resolve its record and page contract.`)
  if (!page.quality.eligible) throw new Error(`${recordId}: review packet cannot be generated for an ineligible substantial page.`)
  if (page.contract.recordRevisionSha256 !== epistemicReviewTargetHash(record)) throw new Error(`${recordId}: review packet target is stale.`)
  const unsigned = {
    schemaVersion: INTERNAL_REVIEW_BATCH_2_VERSION,
    recordId: record.id,
    domainSlug: record.domainSlug,
    title: record.title,
    targetSha256: epistemicReviewTargetHash(record),
    contractDigest: page.contractDigest,
    proposedTier: 'internally-reviewed-canonical' as const,
    publisherConflict: CONFLICT,
    sources: record.sources.map((source) => {
      if (!source.exactLocator || !source.rights?.basis) throw new Error(`${record.id}: ${source.id} lacks an exact locator or rights basis.`)
      return {
        sourceId: source.id,
        title: source.title,
        url: source.url,
        exactLocator: source.exactLocator,
        rightsBasis: source.rights.basis,
        establishes: source.establishes,
        boundary: source.boundary,
      }
    }),
    claims: record.claims.map((claim) => ({
      claimId: claim.id,
      statement: claim.statement,
      sourceIds: claim.sourceIds,
      scope: claim.scope,
      boundary: claim.boundary,
      uncertainty: claim.uncertainty.statement,
      replication: claim.replication.assessment,
    })),
    boundaries: record.boundaries,
    prohibitedInferences: record.prohibitedInferences,
    driftReAudit: DRIFT_HISTORY[record.id]
      ? { classification: 'source-binding-change' as const, ...DRIFT_HISTORY[record.id], requiredDisposition: 're-audit-current-revision-before-superseding-release' as const }
      : null,
    checklist: (Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]).reduce<Record<ExpertReviewScope, readonly PendingReviewCriterion[]>>((checklist, scope) => {
      checklist[scope] = EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({ criterionId: criterion.id, question: criterion.question, status: 'pending-record-specific-review' as const }))
      return checklist
    }, {} as Record<ExpertReviewScope, readonly PendingReviewCriterion[]>),
    decisionStatus: 'pending' as const,
  }
  return { ...unsigned, packetDigest: digest(unsigned) }
}

export const BATCH_2_INTERNAL_REVIEW_PACKETS = BATCH_2_INTERNAL_REVIEW_RECORD_IDS.map(packet)

export const BATCH_2_INTERNAL_REVIEW_MANIFEST = {
  schemaVersion: INTERNAL_REVIEW_BATCH_2_VERSION,
  packetDate: INTERNAL_REVIEW_BATCH_2_DATE,
  proposedTier: 'internally-reviewed-canonical',
  boundary: `${CONFLICT} Packet generation does not create a review decision; every criterion remains pending until a record-specific review is recorded. External expert review remains an optional append-only upgrade.`,
  records: BATCH_2_INTERNAL_REVIEW_PACKETS,
  counts: {
    records: BATCH_2_INTERNAL_REVIEW_PACKETS.length,
    criteriaPending: BATCH_2_INTERNAL_REVIEW_PACKETS.reduce((total, entry) => total + Object.values(entry.checklist).reduce((sum, criteria) => sum + criteria.length, 0), 0),
    driftReAudits: BATCH_2_INTERNAL_REVIEW_PACKETS.filter((entry) => entry.driftReAudit).length,
    canary: BATCH_2_INTERNAL_REVIEW_CANARY_IDS.length,
  },
  manifestDigest: digest(BATCH_2_INTERNAL_REVIEW_PACKETS),
} as const
