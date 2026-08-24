import { randomUUID } from 'node:crypto'

import {
  buildEpistemicCandidateAudit,
  EPISTEMIC_AUDIT_COMPILER_VERSION,
  type EpistemicCandidateAudit,
} from './epistemic-audit.ts'
import { EXPERT_REVIEW_CRITERIA } from './epistemic-review.ts'
import { EXPERT_REVIEW_SCOPES, type EpistemicRecord } from './epistemic-schema.ts'
import { epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_REVIEW_PACKET_VERSION = 'maha-epistemic-review-packet/1.0' as const
export const EPISTEMIC_FACTORY_VERSION = 'maha-epistemic-factory-run/1.0' as const
export const EPISTEMIC_FACTORY_COMPILER_VERSION = 'maha-noncanonical-publishing-factory/1.0' as const

export interface EpistemicFactoryTarget {
  recordId: string
  sourcePublicPath: string
  candidateSha256: string
  reviewTargetSha256: string
  candidateSnapshot: EpistemicRecord
  lineage?: {
    origin: 'ingestion' | 'reingestion'
    baseTargetSha256: string | null
    snapshot: unknown
  }
}

export interface EpistemicSourceClaimPacketRow {
  claimId: string
  statement: string
  claimKind: EpistemicRecord['claims'][number]['claimKind']
  evidenceMaturity: EpistemicRecord['claims'][number]['evidenceMaturity']
  sourceIds: string[]
  sources: Array<{
    sourceId: string
    title: string
    url: string
    exactLocator: string
    establishes: string
    boundary: string
    rightsBasis: string
  }>
}

export interface EpistemicReviewPacket {
  schemaVersion: typeof EPISTEMIC_REVIEW_PACKET_VERSION
  compilerVersion: typeof EPISTEMIC_FACTORY_COMPILER_VERSION
  packetId: string
  factoryRunId: string
  recordId: string
  domainSlug: string
  title: string
  sourcePublicPath: string
  candidateSha256: string
  reviewTargetSha256: string
  canonicalStatus: 'noncanonical-draft'
  indexControl: {
    crawlable: false
    sitemapEligible: false
    robotsDirective: 'noindex, nofollow, noarchive'
  }
  sourceClaimMatrix: EpistemicSourceClaimPacketRow[]
  reviewScopes: Array<{
    scope: (typeof EXPERT_REVIEW_SCOPES)[number]
    criteria: typeof EXPERT_REVIEW_CRITERIA[(typeof EXPERT_REVIEW_SCOPES)[number]]
    status: 'unreviewed'
  }>
  automatedAudit: EpistemicCandidateAudit
  lineage: EpistemicFactoryTarget['lineage'] | null
  candidateSnapshot: EpistemicRecord
  preparedAt: string
  packetBoundary: string
  packetSha256: string
}

export interface EpistemicFactoryRun {
  schemaVersion: typeof EPISTEMIC_FACTORY_VERSION
  compilerVersion: typeof EPISTEMIC_FACTORY_COMPILER_VERSION
  auditCompilerVersion: typeof EPISTEMIC_AUDIT_COMPILER_VERSION
  runId: string
  operation: 'compile-noncanonical-candidates'
  targetCount: number
  packetSha256s: string[]
  targetSha256s: string[]
  counts: {
    automatedChecksPassed: number
    reviewRequired: number
    blocked: number
    canonical: 0
    sitemapEligible: 0
  }
  compiledAt: string
  canonicalReleaseAttempted: false
  runBoundary: string
  runSha256: string
}

export interface EpistemicFactoryRequest {
  operation: 'preview' | 'compile'
  recordIds: string[]
  idempotencyKey: string
}

export const EPISTEMIC_REVIEW_PACKET_BOUNDARY = 'A packet organizes one exact candidate hash for review. Its automated findings are leads, not decisions; every expert criterion remains unreviewed until a qualified person submits a separate exact-hash decision.'
export const EPISTEMIC_FACTORY_BOUNDARY = 'The factory may compile, audit, hash, persist, and package draft candidates. It cannot invite or impersonate reviewers, satisfy review scopes, authorize a canonical release, add candidate URLs to the sitemap, or make unreviewed output crawlable.'

const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/

export function epistemicFactoryPersistenceKey(
  clientIdempotencyKey: string,
  targetSha256s: readonly string[],
): string {
  if (!clientIdempotencyKey.trim()) throw new Error('A client idempotency key is required.')
  if (!targetSha256s.length || targetSha256s.some((digest) => !/^sha256:[a-f0-9]{64}$/.test(digest))) {
    throw new Error('At least one valid target digest is required for factory persistence.')
  }
  return `${clientIdempotencyKey.trim()}:${sha256Canonical([...targetSha256s].sort())}`
}

function sourceClaimMatrix(record: EpistemicRecord): EpistemicSourceClaimPacketRow[] {
  const sources = new Map(record.sources.map((source) => [source.id, source]))
  return record.claims.map((claim) => ({
    claimId: claim.id,
    statement: claim.statement,
    claimKind: claim.claimKind,
    evidenceMaturity: claim.evidenceMaturity,
    sourceIds: [...claim.sourceIds],
    sources: claim.sourceIds.flatMap((sourceId) => {
      const source = sources.get(sourceId)
      return source ? [{
        sourceId,
        title: source.title,
        url: source.url,
        exactLocator: source.exactLocator,
        establishes: source.establishes,
        boundary: source.boundary,
        rightsBasis: source.rights.basis,
      }] : []
    }),
  }))
}

function assertTarget(target: EpistemicFactoryTarget): void {
  if (target.recordId !== target.candidateSnapshot.id) throw new Error(`${target.recordId} does not match its candidate snapshot.`)
  if (target.candidateSha256 !== sha256Canonical(target.candidateSnapshot)) throw new Error(`${target.recordId} candidate digest does not match its snapshot.`)
  if (target.reviewTargetSha256 !== epistemicReviewTargetHash(target.candidateSnapshot)) throw new Error(`${target.recordId} review-target digest does not match its snapshot.`)
  if (target.candidateSnapshot.publication.reviewState !== 'draft' || target.candidateSnapshot.publication.requestedPublicPromotion) {
    throw new Error(`${target.recordId} is not a non-promoted draft.`)
  }
}

function buildPacket(target: EpistemicFactoryTarget, runId: string, preparedAt: Date): EpistemicReviewPacket {
  assertTarget(target)
  const automatedAudit = buildEpistemicCandidateAudit(target.candidateSnapshot, preparedAt)
  const unsigned = {
    schemaVersion: EPISTEMIC_REVIEW_PACKET_VERSION,
    compilerVersion: EPISTEMIC_FACTORY_COMPILER_VERSION,
    packetId: `epipacket_${randomUUID().replaceAll('-', '')}`,
    factoryRunId: runId,
    recordId: target.recordId,
    domainSlug: target.candidateSnapshot.domainSlug,
    title: target.candidateSnapshot.title,
    sourcePublicPath: target.sourcePublicPath,
    candidateSha256: target.candidateSha256,
    reviewTargetSha256: target.reviewTargetSha256,
    canonicalStatus: 'noncanonical-draft' as const,
    indexControl: {
      crawlable: false as const,
      sitemapEligible: false as const,
      robotsDirective: 'noindex, nofollow, noarchive' as const,
    },
    sourceClaimMatrix: sourceClaimMatrix(target.candidateSnapshot),
    reviewScopes: EXPERT_REVIEW_SCOPES.map((scope) => ({ scope, criteria: EXPERT_REVIEW_CRITERIA[scope], status: 'unreviewed' as const })),
    automatedAudit,
    lineage: target.lineage ?? null,
    candidateSnapshot: target.candidateSnapshot,
    preparedAt: preparedAt.toISOString(),
    packetBoundary: EPISTEMIC_REVIEW_PACKET_BOUNDARY,
  }
  return { ...unsigned, packetSha256: sha256Canonical(unsigned) }
}

export function buildEpistemicFactoryRun(targets: readonly EpistemicFactoryTarget[], compiledAt = new Date()): { run: EpistemicFactoryRun; packets: EpistemicReviewPacket[] } {
  if (!Number.isFinite(compiledAt.getTime())) throw new Error('compiledAt must be valid.')
  if (!targets.length || targets.length > 500) throw new Error('The factory requires 1-500 frozen targets.')
  const recordIds = new Set<string>()
  for (const target of targets) {
    if (recordIds.has(target.recordId)) throw new Error(`Duplicate factory target: ${target.recordId}`)
    recordIds.add(target.recordId)
    assertTarget(target)
  }
  const runId = `epifactory_${randomUUID().replaceAll('-', '')}`
  const packets = [...targets]
    .sort((left, right) => left.recordId.localeCompare(right.recordId))
    .map((target) => buildPacket(target, runId, compiledAt))
  const counts = {
    automatedChecksPassed: packets.filter((packet) => packet.automatedAudit.status === 'automated-checks-passed').length,
    reviewRequired: packets.filter((packet) => packet.automatedAudit.status === 'review-required').length,
    blocked: packets.filter((packet) => packet.automatedAudit.status === 'blocked').length,
    canonical: 0 as const,
    sitemapEligible: 0 as const,
  }
  const unsigned = {
    schemaVersion: EPISTEMIC_FACTORY_VERSION,
    compilerVersion: EPISTEMIC_FACTORY_COMPILER_VERSION,
    auditCompilerVersion: EPISTEMIC_AUDIT_COMPILER_VERSION,
    runId,
    operation: 'compile-noncanonical-candidates' as const,
    targetCount: packets.length,
    packetSha256s: packets.map((packet) => packet.packetSha256),
    targetSha256s: packets.map((packet) => packet.reviewTargetSha256),
    counts,
    compiledAt: compiledAt.toISOString(),
    canonicalReleaseAttempted: false as const,
    runBoundary: EPISTEMIC_FACTORY_BOUNDARY,
  }
  return { run: { ...unsigned, runSha256: sha256Canonical(unsigned) }, packets }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Factory request must be an object.')
  return value as Record<string, unknown>
}

export function parseEpistemicFactoryRequest(value: unknown): EpistemicFactoryRequest {
  const candidate = object(value)
  if (candidate.operation !== 'preview' && candidate.operation !== 'compile') throw new Error('operation must be preview or compile.')
  const recordIds = candidate.recordIds === undefined ? [] : candidate.recordIds
  if (!Array.isArray(recordIds) || recordIds.length > 500) throw new Error('recordIds must contain at most 500 entries.')
  const parsedIds = recordIds.map((recordId, index) => {
    if (typeof recordId !== 'string' || !RECORD_ID.test(recordId)) throw new Error(`recordIds[${index}] is invalid.`)
    return recordId
  })
  if (new Set(parsedIds).size !== parsedIds.length) throw new Error('recordIds cannot contain duplicates.')
  if (typeof candidate.idempotencyKey !== 'string' || candidate.idempotencyKey.trim().length < 8 || candidate.idempotencyKey.trim().length > 160) {
    throw new Error('idempotencyKey must contain 8-160 characters.')
  }
  return { operation: candidate.operation, recordIds: parsedIds, idempotencyKey: candidate.idempotencyKey.trim() }
}
