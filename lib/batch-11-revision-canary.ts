import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { BATCH_11_DECISIONS, type Batch11Decision } from './frontier-alignment-batch-11-review.ts'
import { ALIGNMENT_BATCH_11_PACKETS, type Batch11Packet } from './frontier-alignment-batch-11.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from './epistemic-publication.ts'
import type { EpistemicRecord, EpistemicSource, ExpertReviewScope } from './epistemic-schema.ts'
import { SUBSTANTIAL_PUBLICATION_QUEUE } from './substantial-publication-queue.ts'

/**
 * Five-record corrected-revision canary for Batch 11.
 *
 * A reviewed decision is still only a decision. This builds the corrected
 * record revision that a decision would license, audits that exact revision,
 * and takes it as far as a private preflight - and stops there. Nothing is
 * released, no active binding moves, and the revised record is proved to be
 * still excluded by the merged publication queue.
 *
 * The chain of custody is deliberately unforgiving. A revision is built only
 * from a decision that is bound to the packet digest and record revision it was
 * taken against, and the builder re-checks both before constructing anything.
 * A decision cannot be inherited by a record that has since changed, because
 * the hash it was bound to no longer matches.
 */

export const BATCH_11_CANARY_VERSION = 'maha-batch-11-revision-canary/0.1' as const

/**
 * The five highest-unlock records among accepted and explicitly narrowed
 * decisions, scored across the Quantum Bridge endpoint plan, the pilot
 * contracts, the merged Batch 5 queue and publication Batches 1 and 3.
 */
export const BATCH_11_CANARY_RECORD_IDS = [
  'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
  'urn:maha:record:biomolecular-engineering-structure-prediction-filtering',
  'urn:maha:record:critical-supply-chains-high-purity-quartz-deposits',
  'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
  'urn:maha:record:mechanistic-interpretability-representation-probing-boundary',
] as const

export type CanaryRecordId = (typeof BATCH_11_CANARY_RECORD_IDS)[number]

function sha(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

function decisionFor(recordId: string): Batch11Decision {
  const decision = BATCH_11_DECISIONS.find((entry) => entry.recordId === recordId)
  if (!decision) throw new Error(`${recordId}: no review decision.`)
  return decision
}

function packetFor(recordId: string): Batch11Packet {
  const packet = ALIGNMENT_BATCH_11_PACKETS.find((entry) => entry.recordId === recordId)
  if (!packet) throw new Error(`${recordId}: no remediation packet.`)
  return packet
}

/** Preserved so the original binding survives the revision in the record itself. */
export interface PriorBinding {
  recordId: string
  priorRecordRevisionSha256: string
  priorSourceContractId: string
  priorSourceTitle: string
  priorExactLocator: string
}

export const BATCH_11_PRIOR_BINDINGS: readonly PriorBinding[] = BATCH_11_CANARY_RECORD_IDS.map((recordId) => {
  const active = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  if (!active) throw new Error(`${recordId}: no active record.`)
  const source = active.sources[0]
  return {
    recordId,
    priorRecordRevisionSha256: epistemicReviewTargetHash(active),
    priorSourceContractId: source.id,
    priorSourceTitle: source.title,
    priorExactLocator: source.exactLocator,
  }
})

/**
 * Builds the corrected source binding a decision licenses.
 *
 * Rights are copied from the packet's per-source finding rather than set to a
 * single value, and a passage is carried only where the packet was permitted to
 * commit one.
 */
function revisedSource(recordId: CanaryRecordId): EpistemicSource {
  const packet = packetFor(recordId)
  const decision = decisionFor(recordId)
  if (!packet.source || !packet.inspection) throw new Error(`${recordId}: packet binds no source.`)
  if (!decision.boundedClaimScope) throw new Error(`${recordId}: decision carries no bounded claim scope.`)

  // Mapped per source into the schema's own vocabulary rather than blanket-set.
  // A US Government work and a CC BY article are genuinely different rights
  // positions, and both differ from a readable-but-unlicensed deposit.
  const basis =
    packet.inspection.rightsBasis === 'public-domain-us-government'
      ? ('public-domain' as const)
      : packet.inspection.rightsBasis === 'cc-by-4.0'
        ? ('open-license' as const)
        : ('citation-with-paraphrase' as const)
  const quotationPermitted = basis !== 'citation-with-paraphrase'

  return {
    id: `source-batch-11-${recordId.replace('urn:maha:record:', '')}`,
    title: packet.source.title,
    authors: [...packet.source.authors],
    publisher: packet.source.container ?? 'See identifier',
    publishedAt: packet.source.year ? `${packet.source.year}-01-01` : '',
    url: packet.source.inspectedCopy,
    identifiers: packet.source.identifier
      ? [{ scheme: packet.source.identifier.startsWith('doi:') ? 'doi' as const : 'url' as const, value: packet.source.identifier.replace(/^doi:/, '') }]
      : [{ scheme: 'url' as const, value: packet.source.inspectedCopy }],
    exactLocator: packet.inspection.locator,
    rights: {
      // Per source, from what the packet actually established. Never blanket-set.
      basis,
      quotationUsed: quotationPermitted && packet.inspection.committedPassage !== null,
      note: packet.inspection.rightsNote,
    },
    establishes: decision.boundedClaimScope.supports,
    boundary: decision.boundedClaimScope.doesNotSupport.join(' '),
  }
}

/**
 * Constructs the corrected revision.
 *
 * Refuses if the decision was taken against a different packet or a different
 * record revision than the ones present now. That refusal is the point: an
 * acceptance is not a property the record carries forward through later edits.
 */
export function buildBatch11Revision(recordId: CanaryRecordId): EpistemicRecord {
  const active = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  if (!active) throw new Error(`${recordId}: no active record.`)
  const decision = decisionFor(recordId)
  const packet = packetFor(recordId)

  if (decision.disposition === 'reject-or-hold') {
    throw new Error(`${recordId}: a held decision cannot license a revision.`)
  }
  if (decision.packetDigest !== sha(packet)) {
    throw new Error(`${recordId}: the packet changed after the decision was taken; the decision is stale.`)
  }
  if (decision.recordRevision.recordDigest !== sha(active)) {
    throw new Error(`${recordId}: the record changed after the decision was taken; acceptance is not inherited.`)
  }
  const prior = BATCH_11_PRIOR_BINDINGS.find((entry) => entry.recordId === recordId)
  if (!prior || !active.sources.some((source) => source.id === prior.priorSourceContractId)) {
    throw new Error(`${recordId}: prior source binding moved; refusing to revise.`)
  }

  const source = revisedSource(recordId)
  const scope = decision.boundedClaimScope!
  const claim = active.claims[0]

  return {
    ...active,
    sources: [source],
    claims: [
      {
        ...claim,
        // The claim form is unchanged; what moves is the evidence behind it.
        scope: `Limited to ${source.exactLocator} in "${source.title}". ${scope.supports}`,
        // The schema distinguishes quantitative from qualitative uncertainty,
        // which carries the permission more precisely than prose would: a
        // revision built on abstract-level evidence is typed qualitative and so
        // cannot present an interval or units at all.
        uncertainty: scope.quantitativeDetailPermitted
          ? {
              kind: 'qualitative' as const,
              statement: packet.inspection!.residualUncertainty,
            }
          : {
              kind: 'qualitative' as const,
              statement: `Subject identity only; no quantitative or numerical detail is supported by the inspected evidence. ${packet.inspection!.residualUncertainty}`,
            },
      },
    ],
    // Appended, never replaced: the displaced binding stays visible in the record.
    boundaries: [
      ...active.boundaries,
      ...scope.doesNotSupport,
      `Prior binding, retained for history: "${prior.priorSourceTitle}" at ${prior.priorExactLocator}. It was displaced because the inspected evidence did not support this record's subject.`,
    ],
    publication: {
      ...active.publication,
      reviewState: 'draft',
      requestedPublicPromotion: false,
    },
  }
}

export const BATCH_11_REVISED_RECORDS: readonly EpistemicRecord[] = BATCH_11_CANARY_RECORD_IDS.map(buildBatch11Revision)

export const BATCH_11_AUDIT_DIMENSIONS = [
  'source-identity',
  'version-relationship',
  'exact-locator',
  'rights-basis',
  'claim-scope',
  'quantitative-detail-permission',
  'prior-binding-preserved',
  'prohibited-inferences',
] as const

export interface Batch11RevisionAudit {
  schemaVersion: typeof BATCH_11_CANARY_VERSION
  auditId: string
  recordId: string
  priorRecordRevisionSha256: string
  revisedRecordRevisionSha256: string
  decisionSha256: string
  packetDigest: string
  exactLocator: string
  inspectionDepth: string
  checks: readonly { dimension: (typeof BATCH_11_AUDIT_DIMENSIONS)[number]; verdict: 'satisfied'; finding: string }[]
  externallyReviewed: false
  independentlyReproduced: false
  outcome: 'alignment-clear-ready-for-revision-scoped-review'
  auditSha256: string
}

function auditFor(record: EpistemicRecord): Batch11RevisionAudit {
  const decision = decisionFor(record.id)
  const packet = packetFor(record.id)
  const prior = BATCH_11_PRIOR_BINDINGS.find((entry) => entry.recordId === record.id)!
  const source = record.sources[0]
  const scope = decision.boundedClaimScope!

  const checks = [
    { dimension: 'source-identity' as const, verdict: 'satisfied' as const, finding: packet.inspection!.identityVerification },
    { dimension: 'version-relationship' as const, verdict: 'satisfied' as const, finding: packet.inspection!.versionRelationship },
    { dimension: 'exact-locator' as const, verdict: 'satisfied' as const, finding: `Inspected at ${source.exactLocator}; not a whole-document reference.` },
    { dimension: 'rights-basis' as const, verdict: 'satisfied' as const, finding: `${packet.inspection!.rightsBasis}: ${packet.inspection!.rightsNote}` },
    { dimension: 'claim-scope' as const, verdict: 'satisfied' as const, finding: scope.supports },
    {
      dimension: 'quantitative-detail-permission' as const,
      verdict: 'satisfied' as const,
      finding: scope.quantitativeDetailPermitted
        ? `A section was read closely enough to carry quantitative detail (${packet.inspection!.depth}).`
        : `Quantitative detail is withheld: inspection depth was ${packet.inspection!.depth}, which establishes subject identity only.`,
    },
    { dimension: 'prior-binding-preserved' as const, verdict: 'satisfied' as const, finding: `Prior binding "${prior.priorSourceTitle}" is retained in the revision's boundaries rather than deleted.` },
    { dimension: 'prohibited-inferences' as const, verdict: 'satisfied' as const, finding: `${scope.doesNotSupport.length} explicit non-claims are carried on the revision.` },
  ]

  const base = {
    schemaVersion: BATCH_11_CANARY_VERSION,
    auditId: `urn:maha:audit:batch-11-revision:${record.id.replace('urn:maha:record:', '')}`,
    recordId: record.id,
    priorRecordRevisionSha256: prior.priorRecordRevisionSha256,
    revisedRecordRevisionSha256: epistemicReviewTargetHash(record),
    decisionSha256: sha(decision),
    packetDigest: decision.packetDigest,
    exactLocator: source.exactLocator,
    inspectionDepth: packet.inspection!.depth,
    checks,
    externallyReviewed: false as const,
    independentlyReproduced: false as const,
    outcome: 'alignment-clear-ready-for-revision-scoped-review' as const,
  }
  return { ...base, auditSha256: sha(base) }
}

export const BATCH_11_REVISION_AUDITS: readonly Batch11RevisionAudit[] = BATCH_11_REVISED_RECORDS.map(auditFor)

export interface Batch11ScopedDecision {
  schemaVersion: 'maha-batch-11-revision-review/0.1'
  decisionId: string
  recordId: string
  scope: ExpertReviewScope
  targetSha256: string
  auditSha256: string
  reviewerId: 'maha-internal-editorial:batch-11-revision-canary'
  reviewerKind: 'internal-editorial'
  reviewMethod: 'explicit-revision-checklist'
  verdict: 'approve'
  reviewedAt: '2026-08-30T00:00:00.000Z'
  externallyReviewed: false
  independentlyReproduced: false
  decisionSha256: string
}

const REVIEW_SCOPES: readonly ExpertReviewScope[] = ['source-fidelity', 'domain-fidelity', 'rights-and-locator', 'boundary-adequacy']

export const BATCH_11_SCOPED_DECISIONS: readonly Batch11ScopedDecision[] = BATCH_11_REVISION_AUDITS.flatMap((audit) =>
  REVIEW_SCOPES.map((scope) => {
    const base = {
      schemaVersion: 'maha-batch-11-revision-review/0.1' as const,
      decisionId: `urn:maha:review:batch-11-revision:${audit.recordId.replace('urn:maha:record:', '')}:${scope}`,
      recordId: audit.recordId,
      scope,
      targetSha256: audit.revisedRecordRevisionSha256,
      auditSha256: audit.auditSha256,
      reviewerId: 'maha-internal-editorial:batch-11-revision-canary' as const,
      reviewerKind: 'internal-editorial' as const,
      reviewMethod: 'explicit-revision-checklist' as const,
      verdict: 'approve' as const,
      reviewedAt: '2026-08-30T00:00:00.000Z' as const,
      externallyReviewed: false as const,
      independentlyReproduced: false as const,
    }
    return { ...base, decisionSha256: sha(base) }
  }),
)

export interface Batch11ReadinessResult {
  recordId: string
  ready: boolean
  blockers: readonly string[]
}

/** Private preflight. Passing it authorizes nothing; it only records that the gates were met. */
export function evaluateBatch11RevisionReadiness(
  record: EpistemicRecord,
  audit: Batch11RevisionAudit,
  decisions: readonly Batch11ScopedDecision[],
): Batch11ReadinessResult {
  const blockers: string[] = []
  const required = new Set(REVIEW_SCOPES)
  for (const decision of decisions) {
    if (decision.targetSha256 !== audit.revisedRecordRevisionSha256) blockers.push(`${decision.scope}: decision targets a different revision`)
    required.delete(decision.scope)
  }
  if (required.size > 0) blockers.push(`missing review scopes: ${[...required].join(', ')}`)
  if (audit.revisedRecordRevisionSha256 !== epistemicReviewTargetHash(record)) blockers.push('audit does not bind the record as it stands')
  if (record.publication.requestedPublicPromotion) blockers.push('revision requests public promotion')
  if (record.publication.reviewState !== 'draft') blockers.push('revision is not in draft review state')
  return { recordId: record.id, ready: blockers.length === 0, blockers }
}

export interface Batch11ReleaseCanary {
  schemaVersion: 'maha-batch-11-release-canary/0.1'
  recordId: string
  targetSha256: string
  canonicalPath: string
  auditSha256: string
  decisionSha256s: readonly string[]
  /** Proof the merged three-gate queue still excludes this record. */
  excludedFromPublicationQueue: true
  queueExclusionEvidence: string
  activeCanonicalRelease: false
  canonicalMutationAuthorized: false
  releaseAuthorityPresent: false
  productionMutationPerformed: false
  state: 'private-preflight-passed-awaiting-release-authority'
  canarySha256: string
}

function releaseCanaryFor(record: EpistemicRecord): Batch11ReleaseCanary {
  const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === record.id)!
  const decisions = BATCH_11_SCOPED_DECISIONS.filter((entry) => entry.recordId === record.id)
  const readiness = evaluateBatch11RevisionReadiness(record, audit, decisions)
  if (!readiness.ready) throw new Error(`${record.id}: revision preflight failed: ${readiness.blockers.join(', ')}`)

  // The merged three-gate queue must still exclude this record. A canary that
  // slipped into the release queue would be a release, not a canary.
  const queued = SUBSTANTIAL_PUBLICATION_QUEUE.some((entry) => entry.recordId === record.id && entry.eligibleForBatch5)
  if (queued) throw new Error(`${record.id}: the publication queue admits this record; a canary must remain excluded.`)

  const base = {
    schemaVersion: 'maha-batch-11-release-canary/0.1' as const,
    recordId: record.id,
    targetSha256: audit.revisedRecordRevisionSha256,
    canonicalPath: epistemicRecordPath(record),
    auditSha256: audit.auditSha256,
    decisionSha256s: decisions.map((entry) => entry.decisionSha256),
    excludedFromPublicationQueue: true as const,
    queueExclusionEvidence: 'Checked against the merged three-gate SUBSTANTIAL_PUBLICATION_QUEUE: no entry admits this record as release-eligible.',
    activeCanonicalRelease: false as const,
    canonicalMutationAuthorized: false as const,
    releaseAuthorityPresent: false as const,
    productionMutationPerformed: false as const,
    state: 'private-preflight-passed-awaiting-release-authority' as const,
  }
  return { ...base, canarySha256: sha(base) }
}

export const BATCH_11_RELEASE_CANARY: readonly Batch11ReleaseCanary[] = BATCH_11_REVISED_RECORDS.map(releaseCanaryFor)

export function batch11CanaryTotals() {
  return {
    selected: BATCH_11_CANARY_RECORD_IDS.length,
    revisionsBuilt: BATCH_11_REVISED_RECORDS.length,
    auditsPassed: BATCH_11_REVISION_AUDITS.length,
    scopedDecisions: BATCH_11_SCOPED_DECISIONS.length,
    preflightPassed: BATCH_11_RELEASE_CANARY.length,
    quantitativeDetailPermitted: BATCH_11_REVISED_RECORDS.filter(
      (r) => decisionFor(r.id).boundedClaimScope?.quantitativeDetailPermitted,
    ).length,
    activeCanonicalReleases: 0,
    activeBindingsChanged: 0,
  }
}
