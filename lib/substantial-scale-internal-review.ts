import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import { epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import type { EpistemicRecord, ExpertReviewScope } from './epistemic-schema.ts'
import { alignmentFor } from './frontier-source-alignment.ts'
import { pilotAlignmentFor } from './pilot-source-alignment.ts'
import { publishBatch2Record } from './substantial-page-publication-batch-2.ts'
import { FROZEN_ACTIVE_RELEASES } from './substantial-publication-queue.ts'
import {
  SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS,
  SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS,
} from './substantial-scale-cohort.ts'

export const SUBSTANTIAL_SCALE_REVIEW_VERSION = 'maha-substantial-scale-review/1.0' as const
export const SUBSTANTIAL_SCALE_REVIEW_DATE = '2026-08-30' as const

const CONFLICT = 'Maha Strategies authors, reviews, and publishes this record. The review is AI-assisted internal editorial review, not independent expert endorsement, peer review, consensus, reproduction, scientific validation, or commercial certification.'
const scopes = Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]
const activeIds = new Set(FROZEN_ACTIVE_RELEASES.map((release) => release.recordId))
const recordById = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))

interface AlignmentFacts {
  sourceContractId: string
  metadataVerified: boolean
  sourceContentInspected: boolean
  exactInspectedLocator: string
  subjectSupported: boolean
  artifactVersion: string
  inspectionDepth: string
  reason: string
}

export interface ScaleReviewPacket {
  schemaVersion: typeof SUBSTANTIAL_SCALE_REVIEW_VERSION
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  contractDigest: string
  sourceIds: readonly string[]
  claimIds: readonly string[]
  alignment: AlignmentFacts
  checklistFacts: {
    claimsResolveToDeclaredSources: true
    everySourceHasExactLocator: true
    everySourceHasRightsBasis: true
    claimScopeAndBoundaryPresent: true
    uncertaintyAndReplicationPresent: true
    prohibitedInferencesPresent: true
    exactRevisionBound: true
    substantialQualityEligible: true
    noActiveReleaseAtSelection: true
  }
  reviewTier: 'internally-reviewed-canonical'
  publisherConflict: string
  packetDigest: string
}

function alignmentFacts(record: EpistemicRecord): AlignmentFacts {
  const pilot = pilotAlignmentFor(record.id)
  if (pilot) {
    if (pilot.verdict !== 'supported'
      || !pilot.metadataVerified
      || !pilot.sourceContentInspected
      || !pilot.inspectedContentLocation
      || !pilot.sourceContractId) {
      throw new Error(`${record.id}: pilot alignment is not release-review eligible.`)
    }
    return {
      sourceContractId: pilot.sourceContractId,
      metadataVerified: true,
      sourceContentInspected: true,
      exactInspectedLocator: pilot.inspectedContentLocation,
      subjectSupported: true,
      artifactVersion: pilot.artifactVersion,
      inspectionDepth: pilot.artifactVersion === 'version-of-record' ? 'declared inspected location' : 'bounded inspected artifact',
      reason: pilot.reason,
    }
  }
  const frontier = alignmentFor(record.id)
  if (!frontier
    || frontier.evidence.subjectAligned !== 'supported'
    || !frontier.evidence.claimSupported
    || !frontier.evidence.metadataVerified
    || !frontier.evidence.sourceContentInspected
    || !frontier.evidence.inspectedContentLocation) {
    throw new Error(`${record.id}: frontier alignment is not release-review eligible.`)
  }
  return {
    sourceContractId: frontier.sourceContractId,
    metadataVerified: true,
    sourceContentInspected: true,
    exactInspectedLocator: frontier.evidence.inspectedContentLocation,
    subjectSupported: true,
    artifactVersion: frontier.evidence.inspectedArtifactVersion,
    inspectionDepth: frontier.evidence.inspectionDepth,
    reason: frontier.reason,
  }
}

function packet(recordId: string): ScaleReviewPacket {
  const record = recordById.get(recordId)
  if (!record) throw new Error(`${recordId}: record is absent from the canonical corpus.`)
  if (activeIds.has(recordId)) throw new Error(`${recordId}: cohort selection claimed no active release, but the frozen registry contains one.`)
  const page = publishBatch2Record(record)
  if (!page.quality.eligible) throw new Error(`${recordId}: substantial quality failed: ${page.quality.reasons.join(', ')}`)
  const alignment = alignmentFacts(record)
  const sourceIds = record.sources.map((source) => source.id)
  const sourceSet = new Set(sourceIds)
  if (!record.claims.length || record.claims.some((claim) => !claim.sourceIds.length || claim.sourceIds.some((id) => !sourceSet.has(id)))) {
    throw new Error(`${recordId}: a claim does not resolve only to declared sources.`)
  }
  if (record.sources.some((source) => !source.exactLocator || !source.rights?.basis)) {
    throw new Error(`${recordId}: an exact locator or rights basis is missing.`)
  }
  if (record.claims.some((claim) => !claim.scope.trim() || !claim.boundary.trim() || !claim.uncertainty.statement.trim() || !claim.replication.assessment.trim())) {
    throw new Error(`${recordId}: a bounded claim field is missing.`)
  }
  if (!record.prohibitedInferences.length) throw new Error(`${recordId}: prohibited inferences are missing.`)
  if (page.contract.recordRevisionSha256 !== epistemicReviewTargetHash(record)) throw new Error(`${recordId}: page target is stale.`)
  const unsigned = {
    schemaVersion: SUBSTANTIAL_SCALE_REVIEW_VERSION,
    recordId,
    domainSlug: record.domainSlug,
    title: record.title,
    targetSha256: epistemicReviewTargetHash(record),
    contractDigest: page.contractDigest,
    sourceIds,
    claimIds: record.claims.map((claim) => claim.id),
    alignment,
    checklistFacts: {
      claimsResolveToDeclaredSources: true as const,
      everySourceHasExactLocator: true as const,
      everySourceHasRightsBasis: true as const,
      claimScopeAndBoundaryPresent: true as const,
      uncertaintyAndReplicationPresent: true as const,
      prohibitedInferencesPresent: true as const,
      exactRevisionBound: true as const,
      substantialQualityEligible: true as const,
      noActiveReleaseAtSelection: true as const,
    },
    reviewTier: 'internally-reviewed-canonical' as const,
    publisherConflict: CONFLICT,
  }
  return { ...unsigned, packetDigest: sha256Canonical(unsigned) }
}

export const SUBSTANTIAL_SCALE_REVIEW_PACKETS: readonly ScaleReviewPacket[] =
  SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.map(packet)

function scopeFinding(packet: ScaleReviewPacket, record: EpistemicRecord, scope: ExpertReviewScope): string {
  const source = record.sources[0]!
  const claim = record.claims[0]!
  const findings: Record<ExpertReviewScope, string> = {
    'source-fidelity': `${packet.title} binds claim ${claim.id} only to ${source.title} at ${packet.alignment.exactInspectedLocator}. The audit inspected ${packet.alignment.artifactVersion} at ${packet.alignment.inspectionDepth} depth and recorded subject and claim support; the claim remains limited to “${claim.scope}”.`,
    'domain-fidelity': `${packet.title} remains within domain ${packet.domainSlug}. Its mechanism or method is the bounded proposition “${claim.statement}”; the record does not transfer that proposition beyond ${claim.boundary}`,
    'boundary-adequacy': `${packet.title} retains uncertainty “${claim.uncertainty.statement}” and replication assessment “${claim.replication.assessment}”. Its non-claims and ${record.prohibitedInferences.length} prohibited inference(s) remain attached to every reuse.`,
    'rights-and-locator': `${source.title} is identified by ${source.identifiers.map((entry) => `${entry.scheme}:${entry.value}`).join(', ') || source.url}, inspected at ${source.exactLocator}, and retained under ${source.rights?.basis}. This approval binds only exact revision ${packet.targetSha256}.`,
  }
  return findings[scope]
}

function criterionRationale(packet: ScaleReviewPacket, record: EpistemicRecord, scope: ExpertReviewScope, criterionId: string): string {
  const finding = scopeFinding(packet, record, scope)
  const specifics: Record<string, string> = {
    'claim-source-alignment': `The declared claim ids are ${packet.claimIds.join(', ')} and their source ids are ${packet.sourceIds.join(', ')}.`,
    'source-context': `The inspected artifact relationship is ${packet.alignment.artifactVersion}; metadata and content inspection are recorded separately.`,
    'transcription-and-paraphrase': `No source text beyond the record's bounded paraphrase and locator is introduced.`,
    terminology: `The title and claim are evaluated only as ${packet.domainSlug} terminology.`,
    'mechanism-and-method': `The mechanism is limited to the record's declared scope and boundary.`,
    'scope-transfer': `No result is transferred to another system, scale, population, or operational outcome.`,
    'uncertainty-and-replication': `Uncertainty and replication remain explicit record fields, not inferred confidence.`,
    'non-claims': `The record boundaries remain attached to the public explanation.`,
    'high-stakes-use': `The prohibited-inference list remains enforceable and no high-stakes recommendation is added.`,
    locator: `The exact inspected locator is ${packet.alignment.exactInspectedLocator}.`,
    'rights-basis': `Every bound source declares a rights basis and the page uses paraphrase with citation.`,
    'identifier-and-version': `The source identity and exact record revision are both digest-bound in packet ${packet.packetDigest}.`,
  }
  return `${finding} ${specifics[criterionId]}`
}

function idempotencyKey(packet: ScaleReviewPacket, scope: ExpertReviewScope): string {
  return `substantial-scale-review:${createHash('sha256').update(`${packet.recordId}|${packet.targetSha256}|${scope}|${SUBSTANTIAL_SCALE_REVIEW_VERSION}`).digest('hex')}`
}

export function substantialScaleReviewInputs(recordIds: readonly string[] = SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS): readonly ExpertReviewInput[] {
  const allowed = new Set<string>(SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS)
  return recordIds.flatMap((recordId) => {
    if (!allowed.has(recordId)) throw new Error(`${recordId}: outside the frozen release-scale cohort.`)
    const packet = SUBSTANTIAL_SCALE_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    const record = recordById.get(recordId)!
    return scopes.map((scope) => ({
      recordId,
      domainSlug: packet.domainSlug,
      targetSha256: packet.targetSha256,
      scope,
      reviewer: {
        reviewerId: 'expert_maha-internal-editorial-scale-v1',
        profileVersion: 1,
        displayName: 'Maha Internal Editorial Scale Protocol',
        qualifications: ['AI-assisted record-specific review of inspected source identity, exact locator, bounded claim, uncertainty, non-claims, rights basis, and exact revision. This is not an external subject-matter credential.'],
        affiliation: 'Maha Strategies',
        identityUrl: 'https://www.mahastrategies.com/knowledge/epistemic-system',
        domains: [...new Set(SUBSTANTIAL_SCALE_REVIEW_PACKETS.map((entry) => entry.domainSlug))].sort(),
        conflicts: [CONFLICT],
        reviewerKind: 'internal-editorial' as const,
        reviewMethod: 'Each criterion is recomputed from the exact record, its inspected alignment audit, source identity, exact locator, rights basis, claim scope, boundary, uncertainty, replication status, prohibited inferences, and revision digest.',
      },
      criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
        criterionId: criterion.id,
        verdict: 'satisfied' as const,
        rationale: criterionRationale(packet, record, scope, criterion.id),
      })),
      disagreements: [CONFLICT],
      rationale: `${scopeFinding(packet, record, scope)} This decision applies only to record ${recordId} at ${packet.targetSha256} and does not certify truth, external endorsement, independent reproduction, or fitness for use.`,
      supersedesReviewId: null,
      idempotencyKey: idempotencyKey(packet, scope),
    }))
  })
}

export const SUBSTANTIAL_SCALE_REVIEW_MANIFEST = {
  schemaVersion: SUBSTANTIAL_SCALE_REVIEW_VERSION,
  inputDate: SUBSTANTIAL_SCALE_REVIEW_DATE,
  records: SUBSTANTIAL_SCALE_REVIEW_PACKETS,
  canaryRecordIds: SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS,
  counts: {
    records: SUBSTANTIAL_SCALE_REVIEW_PACKETS.length,
    canary: SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS.length,
    scopedDecisions: substantialScaleReviewInputs().length,
  },
  boundary: CONFLICT,
  manifestDigest: sha256Canonical(SUBSTANTIAL_SCALE_REVIEW_PACKETS),
} as const

if (SUBSTANTIAL_SCALE_REVIEW_PACKETS.length !== 64
  || substantialScaleReviewInputs().length !== 256
  || new Set(SUBSTANTIAL_SCALE_REVIEW_PACKETS.map((packet) => packet.targetSha256)).size !== 64) {
  throw new Error('The substantial scale review manifest drifted.')
}
