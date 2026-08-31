import publicationBatchOne from '../content/substantial-pages/publication-batch-1.json' with { type: 'json' }
import publicationBatchTwo from '../content/substantial-pages/publication-batch-2.json' with { type: 'json' }
import publicationBatchThree from '../content/substantial-pages/publication-batch-3.json' with { type: 'json' }
import publicationBatchFive from '../content/substantial-pages/publication-batch-5.json' with { type: 'json' }
import releaseSnapshot from '../content/substantial-pages/publication-batch-6-release-snapshot.json' with { type: 'json' }
import scaleReview from '../content/substantial-pages/release-scale-review.json' with { type: 'json' }

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
import { alignmentFor } from './frontier-source-alignment.ts'
import { pilotAlignmentFor } from './pilot-source-alignment.ts'
import { substantialPageContractDigest, type CompiledSubstantialPage } from './substantial-page-compiler.ts'
import { evaluateSubstantialPageGate, type SourceBoundExplanation } from './substantial-page.ts'
import {
  evaluateBatch2Quality,
  publishBatch2Record,
  type PublishedBatch2Page,
} from './substantial-page-publication-batch-2.ts'
import type { PublishedSubstantialPage } from './substantial-page-publication.ts'

export const SUBSTANTIAL_PUBLICATION_BATCH_6_VERSION = 'maha-substantial-publication/1.5' as const
export const SUBSTANTIAL_PUBLICATION_BATCH_6_DATE = '2026-08-31' as const

const REQUIRED_REVIEW_SCOPES = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'] as const
const cohortIds = new Set(releaseSnapshot.cohortReleases.map((release) => release.recordId))

export interface Batch6ReleaseEvidence {
  recordId: string
  releaseId: string
  targetSha256: string
  canonicalPath: string
  canonicalVersion: string
  releaseKind: string
  approvalScopes: readonly string[]
  approvals: readonly { scope: string; reviewerKind: string }[]
  assuranceTier: string
  releaseSha256: string
}

interface Batch6AlignmentEvidence {
  metadataVerified: true
  sourceContentInspected: true
  exactInspectedLocator: string
  subjectSupported: true
  artifactVersion: string
  inspectionDepth: string
}

interface Batch6ReviewEvidence {
  targetSha256: string
  contractDigest: string
  packetDigest: string | null
  sourceIds: readonly string[]
  claimIds: readonly string[]
  alignment: Batch6AlignmentEvidence
}

export interface PublishedBatch6Page extends Omit<PublishedBatch2Page, 'publicationVersion' | 'publicationDate' | 'publicationDigest'> {
  publicationVersion: typeof SUBSTANTIAL_PUBLICATION_BATCH_6_VERSION
  publicationDate: typeof SUBSTANTIAL_PUBLICATION_BATCH_6_DATE
  releaseEvidence: Batch6ReleaseEvidence
  reviewEvidence: Batch6ReviewEvidence
  publicationDigest: string
}

export interface Batch6Readiness {
  recordId: string
  releaseId: string
  inScaleCohort: boolean
  priorPackageExists: boolean
  blockers: readonly string[]
  readyForNewPackage: boolean
}

const priorPages = [
  ...(publicationBatchOne.pages as unknown as readonly PublishedSubstantialPage[]),
  ...(publicationBatchTwo.pages as unknown as readonly PublishedSubstantialPage[]),
  ...(publicationBatchThree.pages as unknown as readonly PublishedSubstantialPage[]),
  ...(publicationBatchFive.pages as unknown as readonly PublishedSubstantialPage[]),
]
const priorRecordIds = new Set(priorPages.map((page) => page.contract.recordId))
const recordById = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const reviewById = new Map(scaleReview.records.map((packet) => [packet.recordId, packet]))

export const SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS: readonly string[] = releaseSnapshot.activeRecordIds
export const SUBSTANTIAL_BATCH_6_ACTIVE_RELEASES: readonly Batch6ReleaseEvidence[] = releaseSnapshot.activeReleases
const activeRecordIdSet = new Set(SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS)
export const SUBSTANTIAL_BATCH_6_PRIOR_PACKAGE_RECORD_IDS: readonly string[] = [...priorRecordIds].sort()
export const SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS: readonly string[] = [...priorRecordIds]
  .filter((recordId) => activeRecordIdSet.has(recordId))
  .sort()

function sentence(value: string): string {
  const trimmed = value.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function sourceIdentitySections(record: EpistemicRecord): SourceBoundExplanation[] {
  return record.sources.flatMap((source) => {
    const claimIds = record.claims
      .filter((claim) => claim.sourceIds.includes(source.id))
      .map((claim) => claim.id)
    if (claimIds.length === 0) return []
    const authors = source.authors.length ? source.authors.join(', ') : 'Authorship is not declared in this record'
    const identifiers = source.identifiers.length
      ? source.identifiers.map((identifier) => `${identifier.scheme}:${identifier.value}`).join(', ')
      : source.url
    const rights = source.rights?.basis ?? 'no reusable-rights basis declared'
    return [{
      heading: `Source identity, locator, and reuse boundary${record.sources.length > 1 ? ` — ${source.title}` : ''}`,
      paragraphs: [
        `The bound source is “${source.title}” by ${authors}, published by ${source.publisher} on ${source.publishedAt}; its declared stable identity is ${sentence(identifiers)}`,
        `The inspected-content locator is ${sentence(source.exactLocator)} Reuse is limited to ${sentence(rights)} ${sentence(source.rights?.note ?? source.boundary)} This metadata establishes source identity and inspection scope, not the truth of claims outside the cited locator.`,
      ],
      claimIds,
      sourceIds: [source.id],
    }]
  })
}

function inspectedAlignment(recordId: string): Batch6AlignmentEvidence | null {
  const pilot = pilotAlignmentFor(recordId)
  if (pilot) {
    if (pilot.verdict !== 'supported'
      || !pilot.metadataVerified
      || !pilot.sourceContentInspected
      || !pilot.inspectedContentLocation) return null
    return {
      metadataVerified: true,
      sourceContentInspected: true,
      exactInspectedLocator: pilot.inspectedContentLocation,
      subjectSupported: true,
      artifactVersion: pilot.artifactVersion,
      inspectionDepth: pilot.artifactVersion === 'version-of-record' ? 'declared inspected location' : 'bounded inspected artifact',
    }
  }
  const frontier = alignmentFor(recordId)
  if (!frontier
    || frontier.evidence.subjectAligned !== 'supported'
    || !frontier.evidence.claimSupported
    || !frontier.evidence.metadataVerified
    || !frontier.evidence.sourceContentInspected
    || !frontier.evidence.inspectedContentLocation) return null
  return {
    metadataVerified: true,
    sourceContentInspected: true,
    exactInspectedLocator: frontier.evidence.inspectedContentLocation,
    subjectSupported: true,
    artifactVersion: frontier.evidence.inspectedArtifactVersion,
    inspectionDepth: frontier.evidence.inspectionDepth,
  }
}

function readiness(release: Batch6ReleaseEvidence): Batch6Readiness {
  const blockers: string[] = []
  const record = recordById.get(release.recordId)
  const alignment = inspectedAlignment(release.recordId)
  const scopes = new Set(release.approvalScopes)
  const review = reviewById.get(release.recordId)
  const priorPackageExists = priorRecordIds.has(release.recordId)

  if (!record) blockers.push('record-missing')
  if (!alignment) blockers.push('source-not-content-inspected-or-alignment-blocked')
  if (!REQUIRED_REVIEW_SCOPES.every((scope) => scopes.has(scope))) blockers.push('exact-revision-review-incomplete')
  if (release.approvals.some((approval) => approval.reviewerKind !== 'internal-editorial')) blockers.push('review-tier-mismatch')
  if (release.assuranceTier !== 'internally-reviewed-canonical') blockers.push('assurance-tier-mismatch')
  if (record && epistemicReviewTargetHash(record) !== release.targetSha256) blockers.push('active-release-revision-stale')
  if (record && epistemicRecordPath(record) !== release.canonicalPath) blockers.push('active-release-path-mismatch')

  if (cohortIds.has(release.recordId)) {
    if (!review) blockers.push('scale-review-packet-missing')
    if (review && record && review.targetSha256 !== epistemicReviewTargetHash(record)) blockers.push('scale-review-target-stale')
    if (review && (!review.alignment.metadataVerified
      || !review.alignment.sourceContentInspected
      || !review.alignment.exactInspectedLocator
      || !review.alignment.subjectSupported)) blockers.push('scale-review-inspection-incomplete')
  }

  if (record && alignment && blockers.length === 0) {
    const compiled = publishBatch2Record(record)
    if (!compiled.quality.eligible) blockers.push(...compiled.quality.reasons)
    if (review && compiled.contractDigest !== review.contractDigest) blockers.push('scale-review-contract-stale')
  }

  const unique = [...new Set(blockers)].sort()
  return {
    recordId: release.recordId,
    releaseId: release.releaseId,
    inScaleCohort: cohortIds.has(release.recordId),
    priorPackageExists,
    blockers: unique,
    readyForNewPackage: !priorPackageExists && unique.length === 0,
  }
}

export const SUBSTANTIAL_BATCH_6_READINESS: readonly Batch6Readiness[] = SUBSTANTIAL_BATCH_6_ACTIVE_RELEASES.map(readiness)
export const SUBSTANTIAL_BATCH_6_SELECTED_RELEASES: readonly Batch6ReleaseEvidence[] = SUBSTANTIAL_BATCH_6_ACTIVE_RELEASES.filter((release) =>
  SUBSTANTIAL_BATCH_6_READINESS.find((entry) => entry.recordId === release.recordId)?.readyForNewPackage,
)
export const SUBSTANTIAL_BATCH_6_RECORD_IDS: readonly string[] = SUBSTANTIAL_BATCH_6_SELECTED_RELEASES.map((release) => release.recordId)
export const SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS: readonly string[] = [
  ...new Set([...SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS, ...SUBSTANTIAL_BATCH_6_RECORD_IDS]),
].sort()
const projectedRecordIdSet = new Set(SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS)
export const SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS: readonly string[] = SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS
  .filter((recordId) => !projectedRecordIdSet.has(recordId))
  .sort()

function compileReleasedPage(release: Batch6ReleaseEvidence): PublishedBatch6Page {
  const record = recordById.get(release.recordId)!
  const review = reviewById.get(release.recordId)
  const alignment = inspectedAlignment(release.recordId)!
  const compiled = publishBatch2Record(record)
  const identitySections = sourceIdentitySections(record)
  const contract = { ...compiled.contract, explanations: [...compiled.contract.explanations, ...identitySections] }
  const decision = evaluateSubstantialPageGate(record, contract, EPISTEMIC_RECORDS, [])
  const upgraded: CompiledSubstantialPage = {
    ...compiled,
    contract,
    decision,
    contractDigest: substantialPageContractDigest(contract),
  }
  const quality = evaluateBatch2Quality(record, upgraded)
  if (!decision.pageEligible || !quality.eligible) {
    throw new Error(`${record.id}: fresh publication gate failed: ${[...decision.reasons, ...quality.reasons].join(', ')}`)
  }
  const identityCharacters = identitySections
    .flatMap((section) => section.paragraphs)
    .reduce((total, paragraph) => total + paragraph.trim().length, 0)
  const withoutDigest = {
    ...upgraded,
    publicationVersion: SUBSTANTIAL_PUBLICATION_BATCH_6_VERSION,
    publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_6_DATE,
    path: release.canonicalPath,
    domainSlug: record.domainSlug,
    qualificationReason: `Active canonical release ${release.releaseId} and its four internal-review approvals bind exact revision ${release.targetSha256}; current alignment evidence is content-inspected, subject-supported, and located exactly.`,
    mathematicalBridges: compiled.mathematicalBridges,
    quality,
    depth: {
      ...compiled.depth,
      after: {
        ...compiled.depth.after,
        sections: contract.explanations.length,
        paragraphs: contract.explanations.reduce((total, section) => total + section.paragraphs.length, 0),
        informationCharacters: compiled.depth.after.informationCharacters + identityCharacters,
      },
      characterDelta: compiled.depth.characterDelta + identityCharacters,
    },
    releaseEvidence: release,
    reviewEvidence: {
      targetSha256: release.targetSha256,
      contractDigest: compiled.contractDigest,
      packetDigest: review?.packetDigest ?? null,
      sourceIds: record.sources.map((source) => source.id),
      claimIds: record.claims.map((claim) => claim.id),
      alignment,
    },
  }
  return { ...withoutDigest, publicationDigest: sha256Canonical(withoutDigest) }
}

export const SUBSTANTIAL_BATCH_6_PAGES: readonly PublishedBatch6Page[] = SUBSTANTIAL_BATCH_6_SELECTED_RELEASES.map(compileReleasedPage)

if (releaseSnapshot.counts.registryActive !== SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS.length
  || releaseSnapshot.counts.registryActive !== SUBSTANTIAL_BATCH_6_ACTIVE_RELEASES.length
  || releaseSnapshot.counts.cohortActive !== 64
  || releaseSnapshot.cohortReleases.length !== 64
  || new Set(SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS).size !== SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS.length
  || SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS.length + SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS.length !== SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS.length
  || new Set(SUBSTANTIAL_BATCH_6_RECORD_IDS).size !== SUBSTANTIAL_BATCH_6_RECORD_IDS.length
  || new Set(SUBSTANTIAL_BATCH_6_PAGES.map((page) => page.path)).size !== SUBSTANTIAL_BATCH_6_PAGES.length) {
  throw new Error('Batch 6 release or publication membership drifted.')
}

if (SUBSTANTIAL_BATCH_6_PAGES.some((page) => !page.quality.eligible
    || page.quality.evidenceCoverage.unsupportedExplanationParagraphs !== 0
    || page.contract.explanations.length < 5
    || page.depth.characterDelta <= 0)) {
  throw new Error('Batch 6 contains an ineligible, unsupported, or insubstantial page.')
}
