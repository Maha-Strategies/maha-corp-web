import { randomUUID } from 'node:crypto'

import {
  EPISTEMIC_ADAPTER_VERSION,
  LEGACY_ADAPTER_IDS,
  getLegacyEpistemicAdapter,
  type LegacyAdapterCandidate,
  type LegacyAdapterId,
} from './epistemic-adapters.ts'
import { sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_INGESTION_VERSION = 'maha-epistemic-ingestion/1.0' as const

export interface EpistemicIngestionRecord {
  schemaVersion: typeof EPISTEMIC_INGESTION_VERSION
  ingestionRecordId: string
  batchId: string
  adapterId: LegacyAdapterId
  sourceRecordId: string
  sourceRecordSha256: string
  sourcePublicPath: string
  candidateRecordId: string
  candidateSha256: string
  reviewTargetSha256: string
  gateDecision: LegacyAdapterCandidate['gateDecision']
  candidateSnapshot: LegacyAdapterCandidate['record']
}

export interface EpistemicIngestionBatch {
  schemaVersion: typeof EPISTEMIC_INGESTION_VERSION
  batchId: string
  adapterId: LegacyAdapterId
  adapterVersion: typeof EPISTEMIC_ADAPTER_VERSION
  sourceDatasetVersion: string
  sourceDatasetSha256: string
  recordCount: number
  ingestedAt: string
  batchSha256: string
  records: EpistemicIngestionRecord[]
}

export interface EpistemicIngestionRequest {
  adapterId: LegacyAdapterId
  idempotencyKey: string
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object.')
  return value as Record<string, unknown>
}

function bounded(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${label} must contain ${minimum}-${maximum} characters.`)
  return normalized
}

export function parseEpistemicIngestionRequest(value: unknown): EpistemicIngestionRequest {
  const candidate = object(value)
  const adapterId = bounded(candidate.adapterId, 'adapterId', 2, 80) as LegacyAdapterId
  if (!LEGACY_ADAPTER_IDS.includes(adapterId)) throw new Error('adapterId is unsupported.')
  return {
    adapterId,
    idempotencyKey: bounded(candidate.idempotencyKey, 'idempotencyKey', 8, 160),
  }
}

export function buildEpistemicIngestionBatch(input: EpistemicIngestionRequest, ingestedAt = new Date()): EpistemicIngestionBatch {
  if (!Number.isFinite(ingestedAt.getTime())) throw new Error('ingestedAt must be valid.')
  const adapter = getLegacyEpistemicAdapter(input.adapterId)
  if (!adapter) throw new Error('adapterId is unsupported.')
  const batchId = `epibatch_${randomUUID().replaceAll('-', '')}`
  const records = adapter.adapt().map((candidate): EpistemicIngestionRecord => ({
    schemaVersion: EPISTEMIC_INGESTION_VERSION,
    ingestionRecordId: `epirecord_${sha256Canonical({ batchId, sourceRecordId: candidate.sourceRecordId }).slice('sha256:'.length, 'sha256:'.length + 32)}`,
    batchId,
    adapterId: input.adapterId,
    sourceRecordId: candidate.sourceRecordId,
    sourceRecordSha256: candidate.sourceRecordSha256,
    sourcePublicPath: candidate.sourcePublicPath,
    candidateRecordId: candidate.record.id,
    candidateSha256: candidate.candidateSha256,
    reviewTargetSha256: candidate.reviewTargetSha256,
    gateDecision: candidate.gateDecision,
    candidateSnapshot: candidate.record,
  }))
  const unsigned = {
    schemaVersion: EPISTEMIC_INGESTION_VERSION,
    batchId,
    adapterId: input.adapterId,
    adapterVersion: adapter.adapterVersion,
    sourceDatasetVersion: adapter.sourceDatasetVersion,
    sourceDatasetSha256: adapter.sourceDatasetSha256,
    recordCount: records.length,
    ingestedAt: ingestedAt.toISOString(),
    recordSha256s: records.map((record) => record.candidateSha256),
  }
  return { ...unsigned, batchSha256: sha256Canonical(unsigned), records }
}

export function ingestionBatchSnapshot(batch: EpistemicIngestionBatch) {
  return {
    schemaVersion: batch.schemaVersion,
    batchId: batch.batchId,
    adapterId: batch.adapterId,
    adapterVersion: batch.adapterVersion,
    sourceDatasetVersion: batch.sourceDatasetVersion,
    sourceDatasetSha256: batch.sourceDatasetSha256,
    recordCount: batch.recordCount,
    ingestedAt: batch.ingestedAt,
    batchSha256: batch.batchSha256,
    records: batch.records.map((record) => ({
      ingestionRecordId: record.ingestionRecordId,
      sourceRecordId: record.sourceRecordId,
      sourcePublicPath: record.sourcePublicPath,
      candidateRecordId: record.candidateRecordId,
      candidateSha256: record.candidateSha256,
      reviewTargetSha256: record.reviewTargetSha256,
      publicEligible: record.gateDecision.publicEligible,
    })),
  }
}

export const EPISTEMIC_INGESTION_BOUNDARY = 'Ingestion preserves and evaluates a candidate; it does not publish it. Re-running an adapter creates an auditable batch, while idempotency prevents one requested run from being recorded twice.'
