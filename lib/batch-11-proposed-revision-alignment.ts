import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { ALIGNMENT_BATCH_11_PACKETS, type Batch11Packet } from './frontier-alignment-batch-11.ts'
import { BATCH_11_DECISIONS, type Batch11Decision } from './frontier-alignment-batch-11-review.ts'
import {
  BATCH_11_REVISED_RECORDS,
  BATCH_11_REVISION_AUDITS,
  BATCH_11_SCOPED_DECISIONS,
  evaluateBatch11RevisionReadiness,
  type Batch11RevisionAudit,
  type Batch11ScopedDecision,
} from './batch-11-revision-canary.ts'
import type { EpistemicRecord, ExpertReviewScope } from './epistemic-schema.ts'

/**
 * Exact-revision source-alignment gate for the Batch 11 release rehearsal.
 *
 * A source-replacement release cannot be judged from the source binding it is
 * replacing. Conversely, a proposed audit cannot clear itself merely by saying
 * "alignment-clear". This evaluator recomputes the complete chain from the
 * immutable packet, append-only decision, revised record, audit and four scoped
 * review decisions. The active record remains in the chain as the prior binding
 * whose digest the proposal and decision must still match.
 */

export const BATCH_11_PROPOSED_ALIGNMENT_VERSION = 'maha-batch-11-proposed-alignment/1.0' as const

const REQUIRED_DIMENSIONS = [
  'source-identity',
  'version-relationship',
  'exact-locator',
  'rights-basis',
  'claim-scope',
  'quantitative-detail-permission',
  'prior-binding-preserved',
  'prohibited-inferences',
] as const

const REQUIRED_SCOPES: readonly ExpertReviewScope[] = [
  'source-fidelity',
  'domain-fidelity',
  'rights-and-locator',
  'boundary-adequacy',
]

export type ProposedAlignmentBlocker =
  | 'evidence-chain-ambiguous'
  | 'active-record-missing'
  | 'proposal-record-missing'
  | 'packet-missing'
  | 'packet-not-supported'
  | 'source-content-not-inspected'
  | 'source-identity-incomplete'
  | 'version-relationship-incomplete'
  | 'exact-locator-missing'
  | 'rights-basis-missing'
  | 'review-decision-missing'
  | 'review-decision-not-accepted'
  | 'review-decision-evidence-mismatch'
  | 'review-decision-authority-overreach'
  | 'packet-digest-mismatch'
  | 'prior-revision-mismatch'
  | 'proposed-source-binding-mismatch'
  | 'bounded-claim-mismatch'
  | 'audit-missing'
  | 'audit-target-mismatch'
  | 'audit-digest-mismatch'
  | 'audit-outcome-not-clear'
  | 'audit-checks-incomplete'
  | 'audit-findings-mismatch'
  | 'audit-assurance-overclaim'
  | 'scoped-review-incomplete'
  | 'scoped-review-stale'
  | 'scoped-review-digest-mismatch'
  | 'scoped-review-standing-mismatch'
  | 'revision-preflight-failed'

export interface ProposedRevisionAlignmentInput {
  recordId: string
  chainCounts: {
    activeRecords: number
    proposedRecords: number
    packets: number
    decisions: number
    audits: number
  }
  activeRecord: EpistemicRecord | null
  proposedRecord: EpistemicRecord | null
  packet: Batch11Packet | null
  decision: Batch11Decision | null
  audit: Batch11RevisionAudit | null
  scopedDecisions: readonly Batch11ScopedDecision[]
}

export interface ProposedRevisionAlignmentResult {
  schemaVersion: typeof BATCH_11_PROPOSED_ALIGNMENT_VERSION
  recordId: string
  proposedTargetSha256: string
  auditSha256: string
  alignmentVerdict: 'alignment-clear' | 'blocked'
  blockers: readonly ProposedAlignmentBlocker[]
  ready: boolean
}

function sha(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

function withoutDigest<T extends Record<string, unknown>>(value: T, key: keyof T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([entry]) => entry !== key))
}

function substantive(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length >= 12
}

function expectedAuditFindings(
  activeRecord: EpistemicRecord,
  proposedRecord: EpistemicRecord,
  packet: Batch11Packet,
  decision: Batch11Decision,
): ReadonlyMap<(typeof REQUIRED_DIMENSIONS)[number], string> | null {
  const inspection = packet.inspection
  const scope = decision.boundedClaimScope
  const source = proposedRecord.sources[0]
  const priorSource = activeRecord.sources[0]
  if (!inspection || !scope || !source || !priorSource) return null

  return new Map([
    ['source-identity', inspection.identityVerification],
    ['version-relationship', inspection.versionRelationship],
    ['exact-locator', `Inspected at ${source.exactLocator}; not a whole-document reference.`],
    ['rights-basis', `${inspection.rightsBasis}: ${inspection.rightsNote}`],
    ['claim-scope', scope.supports],
    [
      'quantitative-detail-permission',
      scope.quantitativeDetailPermitted
        ? `A section was read closely enough to carry quantitative detail (${inspection.depth}).`
        : `Quantitative detail is withheld: inspection depth was ${inspection.depth}, which establishes subject identity only.`,
    ],
    [
      'prior-binding-preserved',
      `Prior binding "${priorSource.title}" is retained in the revision's boundaries rather than deleted.`,
    ],
    [
      'prohibited-inferences',
      `${scope.doesNotSupport.length} explicit non-claims are carried on the revision.`,
    ],
  ])
}

export function proposedRevisionAlignmentInput(recordId: string): ProposedRevisionAlignmentInput {
  const activeRecords = FRONTIER_DOMAIN_GRAPH_RECORDS.filter((entry) => entry.id === recordId)
  const proposedRecords = BATCH_11_REVISED_RECORDS.filter((entry) => entry.id === recordId)
  const packets = ALIGNMENT_BATCH_11_PACKETS.filter((entry) => entry.recordId === recordId)
  const decisions = BATCH_11_DECISIONS.filter((entry) => entry.recordId === recordId)
  const audits = BATCH_11_REVISION_AUDITS.filter((entry) => entry.recordId === recordId)
  return {
    recordId,
    chainCounts: {
      activeRecords: activeRecords.length,
      proposedRecords: proposedRecords.length,
      packets: packets.length,
      decisions: decisions.length,
      audits: audits.length,
    },
    activeRecord: activeRecords[0] ?? null,
    proposedRecord: proposedRecords[0] ?? null,
    packet: packets[0] ?? null,
    decision: decisions[0] ?? null,
    audit: audits[0] ?? null,
    scopedDecisions: BATCH_11_SCOPED_DECISIONS.filter((entry) => entry.recordId === recordId),
  }
}

/** Pure so mutation tests can prove that every link fails closed. */
export function evaluateProposedRevisionAlignment(
  input: ProposedRevisionAlignmentInput,
): ProposedRevisionAlignmentResult {
  const blockers: ProposedAlignmentBlocker[] = []
  const add = (blocker: ProposedAlignmentBlocker) => blockers.push(blocker)
  const { activeRecord, proposedRecord, packet, decision, audit, scopedDecisions } = input

  if (Object.values(input.chainCounts).some((count) => count !== 1)) add('evidence-chain-ambiguous')

  if (!activeRecord) add('active-record-missing')
  if (!proposedRecord) add('proposal-record-missing')
  if (!packet) add('packet-missing')
  if (!decision) add('review-decision-missing')
  if (!audit) add('audit-missing')

  if (packet) {
    if (
      packet.recordId !== input.recordId
      || packet.verdict !== 'supported'
      || packet.disposition !== 'blocked-pending-source-override-review'
      || packet.source === null
      || packet.inspection === null
      || packet.failClosed !== null
    ) add('packet-not-supported')

    if (!packet.inspection || packet.inspection.depth === 'none-or-identity-only') {
      add('source-content-not-inspected')
    } else {
      if (!substantive(packet.inspection.identityVerification)) add('source-identity-incomplete')
      if (!substantive(packet.inspection.versionRelationship)) add('version-relationship-incomplete')
      if (
        !substantive(packet.inspection.locator)
        || /whole document|entire document|not located|unknown|n\/a/i.test(packet.inspection.locator)
      ) add('exact-locator-missing')
      if (
        packet.inspection.rightsBasis === 'none-no-source-bound'
        || !substantive(packet.inspection.rightsNote)
      ) add('rights-basis-missing')
    }
    if (
      !packet.source
      || !substantive(packet.source.title)
      || !substantive(packet.source.inspectedCopy)
      || !/^https:\/\//.test(packet.source.inspectedCopy)
      || !packet.source.identifier
    ) add('source-identity-incomplete')
  }

  if (decision) {
    if (decision.recordId !== input.recordId || decision.disposition !== 'accept-source-replacement') {
      add('review-decision-not-accepted')
    }
    if (
      !decision.boundedClaimScope
      || !substantive(decision.boundedClaimScope.recordClaimForm)
      || !substantive(decision.boundedClaimScope.supports)
      || decision.boundedClaimScope.doesNotSupport.length === 0
    ) add('bounded-claim-mismatch')
    if (
      decision.activeBindingChanged !== false
      || decision.canonicalReleaseAuthorized !== false
      || decision.supersedes !== null
    ) add('review-decision-authority-overreach')
  }

  if (packet?.source && packet.inspection && decision) {
    const expectedSourceIdentity = `${packet.source.title} | ${packet.source.identifier ?? 'no identifier'} | ${packet.source.inspectedCopy}`
    if (
      decision.sourceIdentity !== expectedSourceIdentity
      || decision.versionRelationship !== packet.inspection.versionRelationship
      || decision.inspectedContentLocator !== packet.inspection.locator
      || decision.rightsBasis !== packet.inspection.rightsBasis
    ) add('review-decision-evidence-mismatch')
  }

  if (packet && decision && decision.packetDigest !== sha(packet)) add('packet-digest-mismatch')

  if (activeRecord && decision) {
    if (
      decision.recordRevision.recordDigest !== sha(activeRecord)
      || decision.recordRevision.canonicalVersion !== activeRecord.publication.canonicalVersion
    ) add('prior-revision-mismatch')
  }

  if (activeRecord && proposedRecord && packet?.source && packet.inspection && decision?.boundedClaimScope) {
    const source = proposedRecord.sources[0]
    const expectedIdentifier = packet.source.identifier?.replace(/^doi:/, '')
    const identifierMatches = expectedIdentifier
      ? source?.identifiers.some((entry) => entry.value === expectedIdentifier)
      : false
    const sourceMatches = proposedRecord.id === input.recordId
      && proposedRecord.sources.length === 1
      && source?.title === packet.source.title
      && source.url === packet.source.inspectedCopy
      && source.exactLocator === packet.inspection.locator
      && identifierMatches
      && proposedRecord.claims.length > 0
      && proposedRecord.claims.every((claim) =>
        claim.sourceIds.length === 1 && claim.sourceIds[0] === source.id,
      )
    if (!sourceMatches) add('proposed-source-binding-mismatch')

    const scope = decision.boundedClaimScope
    const claimBounded = proposedRecord.claims.every((claim) =>
      claim.scope.includes(packet.inspection!.locator) && claim.scope.includes(scope.supports),
    )
    const exclusionsCarried = scope.doesNotSupport.every((boundary) => proposedRecord.boundaries.includes(boundary))
    if (!claimBounded || !exclusionsCarried) add('bounded-claim-mismatch')
  }

  if (activeRecord && proposedRecord && packet && decision && audit) {
    const proposedTarget = epistemicReviewTargetHash(proposedRecord)
    if (
      audit.recordId !== input.recordId
      || audit.priorRecordRevisionSha256 !== epistemicReviewTargetHash(activeRecord)
      || audit.revisedRecordRevisionSha256 !== proposedTarget
      || audit.packetDigest !== sha(packet)
      || audit.decisionSha256 !== sha(decision)
      || audit.exactLocator !== proposedRecord.sources[0]?.exactLocator
      || audit.inspectionDepth !== packet.inspection?.depth
    ) add('audit-target-mismatch')

    if (audit.auditSha256 !== sha(withoutDigest(audit as unknown as Record<string, unknown>, 'auditSha256'))) {
      add('audit-digest-mismatch')
    }
    if (audit.outcome !== 'alignment-clear-ready-for-revision-scoped-review') add('audit-outcome-not-clear')
    if (audit.externallyReviewed !== false || audit.independentlyReproduced !== false) {
      add('audit-assurance-overclaim')
    }

    const dimensions = audit.checks.map((check) => check.dimension)
    const completeChecks = audit.checks.length === REQUIRED_DIMENSIONS.length
      && new Set(dimensions).size === REQUIRED_DIMENSIONS.length
      && REQUIRED_DIMENSIONS.every((dimension) => dimensions.includes(dimension))
      && audit.checks.every((check) => check.verdict === 'satisfied' && substantive(check.finding))
    if (!completeChecks) add('audit-checks-incomplete')

    const expectedFindings = expectedAuditFindings(activeRecord, proposedRecord, packet, decision)
    if (
      !expectedFindings
      || audit.checks.some((check) => check.finding !== expectedFindings.get(check.dimension))
    ) add('audit-findings-mismatch')
  }

  if (audit) {
    const scopes = scopedDecisions.map((entry) => entry.scope)
    const completeScopes = scopedDecisions.length === REQUIRED_SCOPES.length
      && new Set(scopes).size === REQUIRED_SCOPES.length
      && REQUIRED_SCOPES.every((scope) => scopes.includes(scope))
    if (!completeScopes) add('scoped-review-incomplete')

    for (const scoped of scopedDecisions) {
      if (
        scoped.recordId !== input.recordId
        || scoped.targetSha256 !== audit.revisedRecordRevisionSha256
        || scoped.auditSha256 !== audit.auditSha256
        || scoped.verdict !== 'approve'
        || scoped.reviewerId !== 'maha-internal-editorial:batch-11-revision-canary'
        || scoped.reviewerKind !== 'internal-editorial'
        || scoped.reviewMethod !== 'explicit-revision-checklist'
      ) add('scoped-review-stale')
      if (scoped.externallyReviewed !== false || scoped.independentlyReproduced !== false) {
        add('scoped-review-standing-mismatch')
      }
      if (
        scoped.decisionSha256
        !== sha(withoutDigest(scoped as unknown as Record<string, unknown>, 'decisionSha256'))
      ) add('scoped-review-digest-mismatch')
    }
  }

  if (proposedRecord && audit) {
    const preflight = evaluateBatch11RevisionReadiness(proposedRecord, audit, scopedDecisions)
    if (!preflight.ready) add('revision-preflight-failed')
  }

  const unique = [...new Set(blockers)]
  return {
    schemaVersion: BATCH_11_PROPOSED_ALIGNMENT_VERSION,
    recordId: input.recordId,
    proposedTargetSha256: audit?.revisedRecordRevisionSha256 ?? '',
    auditSha256: audit?.auditSha256 ?? '',
    alignmentVerdict: unique.length === 0 ? 'alignment-clear' : 'blocked',
    blockers: unique,
    ready: unique.length === 0,
  }
}

export function proposedRevisionAlignmentFor(recordId: string): ProposedRevisionAlignmentResult {
  return evaluateProposedRevisionAlignment(proposedRevisionAlignmentInput(recordId))
}
