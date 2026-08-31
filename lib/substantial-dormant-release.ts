import publicationBatchTwo from '../content/substantial-pages/publication-batch-2.json' with { type: 'json' }

import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import { alignmentFor } from './frontier-source-alignment.ts'
import { BATCH_2_INTERNAL_REVIEW_PACKETS } from './substantial-internal-review-batch-2.ts'
import {
  remainderInternalReviewInputs,
  remainderReview,
} from './substantial-internal-review-remainder.ts'
import type { PublishedSubstantialPage } from './substantial-page-publication.ts'

export const DORMANT_SUBSTANTIAL_RELEASE_VERSION = 'maha-dormant-substantial-release/1.0' as const

/**
 * These pages were compiled in publication Batch 2 and passed the exact-revision
 * internal review remainder, but no release for any revision of these records is
 * present in the public all-status registry.  The cohort is frozen explicitly;
 * no query, score, or route response may add another record to this operation.
 */
export const DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS = [
  'urn:maha:record:agentic-systems-mcp-mcp-prompt-templates',
  'urn:maha:record:mechanistic-interpretability-attention-pattern-evidence',
  'urn:maha:record:mechanistic-interpretability-in-context-learning-circuits',
  'urn:maha:record:mechanistic-interpretability-sae-encoder-decoder',
] as const

export const DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS = DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS.slice(0, 1)
export const DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS = DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS.slice(1)

type BatchTwoPage = PublishedSubstantialPage & { quality: { eligible: boolean } }
const batchTwoPages = publicationBatchTwo.pages as unknown as readonly BatchTwoPage[]

export interface DormantSubstantialReleasePacket {
  recordId: (typeof DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS)[number]
  domainSlug: string
  targetSha256: string
  packetDigest: string
  contractDigest: string
  canonicalPath: string
  pagePublicationDigest: string
  reviewScopes: readonly string[]
  reviewerKind: 'internal-editorial'
  assuranceTier: 'internally-reviewed-canonical'
  releaseKind: 'initial'
  packetFingerprint: string
}

function buildPacket(recordId: (typeof DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS)[number]): DormantSubstantialReleasePacket {
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)
  const reviewPacket = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)
  const review = remainderReview(recordId)
  const page = batchTwoPages.find((entry) => entry.contract.recordId === recordId)
  const alignment = alignmentFor(recordId)

  if (!record || !reviewPacket || !review || !page || !alignment) {
    throw new Error(`${recordId}: dormant release evidence is incomplete.`)
  }
  if (review.disposition !== 'approved'
    || review.releaseKind !== 'initial'
    || review.sourceFidelityBasis !== 'inspected-source-location'
    || review.unsatisfied.length > 0
    || review.blockers.length > 0) {
    throw new Error(`${recordId}: exact-revision internal review is not an unqualified initial-release approval.`)
  }
  if (alignment.evidence.subjectAligned !== 'supported'
    || !alignment.evidence.claimSupported
    || !alignment.evidence.metadataVerified
    || !alignment.evidence.sourceContentInspected
    || !alignment.evidence.inspectedContentLocation) {
    throw new Error(`${recordId}: source alignment is not content-inspected and supported.`)
  }
  if (!page.quality.eligible
    || page.contract.recordRevisionSha256 !== reviewPacket.targetSha256
    || epistemicReviewTargetHash(record) !== reviewPacket.targetSha256
    || page.path !== epistemicRecordPath(record)) {
    throw new Error(`${recordId}: compiled page, review packet, and current record revision do not agree.`)
  }

  const reviewScopes = Object.keys(EXPERT_REVIEW_CRITERIA).sort()
  const packet = {
    recordId,
    domainSlug: record.domainSlug,
    targetSha256: reviewPacket.targetSha256,
    packetDigest: reviewPacket.packetDigest,
    contractDigest: page.contractDigest,
    canonicalPath: page.path,
    pagePublicationDigest: page.publicationDigest,
    reviewScopes,
    reviewerKind: 'internal-editorial' as const,
    assuranceTier: 'internally-reviewed-canonical' as const,
    releaseKind: 'initial' as const,
  }
  return { ...packet, packetFingerprint: sha256Canonical(packet) }
}

export const DORMANT_SUBSTANTIAL_RELEASE_PACKETS: readonly DormantSubstantialReleasePacket[] =
  DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS.map(buildPacket)

export function dormantSubstantialReviewInputs(
  recordIds: readonly string[] = DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS,
): readonly ExpertReviewInput[] {
  const allowed = new Set(DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS)
  for (const recordId of recordIds) {
    if (!allowed.has(recordId as (typeof DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS)[number])) {
      throw new Error(`${recordId}: outside the frozen dormant substantial-release cohort.`)
    }
  }
  const selected = new Set(recordIds)
  const inputs = remainderInternalReviewInputs().filter((input) => selected.has(input.recordId))
  if (inputs.length !== recordIds.length * 4) throw new Error('Dormant release review decision count drifted.')
  for (const recordId of recordIds) {
    const packet = DORMANT_SUBSTANTIAL_RELEASE_PACKETS.find((entry) => entry.recordId === recordId)!
    const decisions = inputs.filter((input) => input.recordId === recordId)
    if (new Set(decisions.map((decision) => decision.scope)).size !== 4
      || decisions.some((decision) => decision.targetSha256 !== packet.targetSha256
        || decision.reviewer.reviewerKind !== 'internal-editorial')) {
      throw new Error(`${recordId}: review inputs do not bind four internal scopes to the exact revision.`)
    }
  }
  return inputs
}

if (DORMANT_SUBSTANTIAL_RELEASE_PACKETS.length !== 4
  || new Set(DORMANT_SUBSTANTIAL_RELEASE_RECORD_IDS).size !== 4
  || DORMANT_SUBSTANTIAL_RELEASE_CANARY_IDS.length !== 1
  || DORMANT_SUBSTANTIAL_RELEASE_REMAINDER_IDS.length !== 3) {
  throw new Error('Dormant substantial-release cohort membership drifted.')
}
