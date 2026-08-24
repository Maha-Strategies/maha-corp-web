import { randomUUID } from 'node:crypto'

import {
  EVIDENCE_MATURITIES,
  SOURCE_CHRONOLOGY_STATUSES,
  type EpistemicRecord,
  type EvidenceMaturity,
  type PublicationDecision,
  type SourceChronology,
} from './epistemic-schema.ts'
import {
  epistemicReviewTargetHash,
  evaluatePublicationGate,
  sha256Canonical,
} from './epistemic-publication.ts'
import type { SourceCompletionEvent } from './epistemic-work-queue.ts'

export const EPISTEMIC_REINGESTION_VERSION = 'maha-epistemic-reingestion/1.0' as const
export const EPISTEMIC_REINGESTION_COMPILER_VERSION = 'maha-controlled-reingestion-compiler/1.0' as const

export type ControlledCorrectionKind = 'source-exact-locator' | 'source-publication-date' | 'claim-evidence-maturity'

export interface ControlledCorrectionDescriptor {
  blockerCode: string
  kind: ControlledCorrectionKind
  entityType: 'source' | 'claim'
  entityId: string
  fieldPath: string
  fieldLabel: string
  inputKind: 'text' | 'date' | 'select'
  options: string[]
  currentValue: string
}

export interface ControlledCorrectionInput {
  blockerCode: string
  evidenceEventId: string
  proposedValue: string
}

export interface ControlledReingestionRequest {
  operation: 'preview' | 'compile'
  recordId: string
  baseTargetSha256: string
  corrections: ControlledCorrectionInput[]
  note: string
  idempotencyKey: string
}

export interface AppliedControlledCorrection extends ControlledCorrectionDescriptor {
  evidenceEventId: string
  evidenceEventSha256: string
  evidenceSourceUrl: string
  previousValue: string
  proposedValue: string
}

export interface ControlledDiffEntry {
  path: string
  before: string
  after: string
}

export interface ControlledReingestionCompilation {
  schemaVersion: typeof EPISTEMIC_REINGESTION_VERSION
  compilerVersion: typeof EPISTEMIC_REINGESTION_COMPILER_VERSION
  compilationId: string
  recordId: string
  domainSlug: string
  sourcePublicPath: string
  baseCandidateSha256: string
  baseTargetSha256: string
  outputCandidateSha256: string
  outputReviewTargetSha256: string
  correctionEventIds: string[]
  corrections: AppliedControlledCorrection[]
  diff: ControlledDiffEntry[]
  resolvedBlockerCodes: string[]
  remainingSourceBlockerCodes: string[]
  gateDecision: PublicationDecision
  outputRecord: EpistemicRecord
  note: string
  compiledAt: string
  compilationSha256: string
}

export interface FrozenReingestionTarget {
  recordId: string
  sourcePublicPath: string
  candidateSha256: string
  reviewTargetSha256: string
  gateDecision: { publicEligible: boolean; reasons: string[] }
  candidateSnapshot: EpistemicRecord
}

const SHA256 = /^sha256:[a-f0-9]{64}$/
const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/
const EVENT_ID = /^epiwork_[a-f0-9]{32}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${label} must contain ${minimum}-${maximum} characters.`)
  return normalized
}

function parseCorrections(value: unknown): ControlledCorrectionInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('corrections must contain 1-100 entries.')
  const corrections = value.map((entry, index) => {
    const candidate = object(entry, `corrections[${index}]`)
    const evidenceEventId = line(candidate.evidenceEventId, `corrections[${index}].evidenceEventId`, 40, 40)
    if (!EVENT_ID.test(evidenceEventId)) throw new Error(`corrections[${index}].evidenceEventId is invalid.`)
    return {
      blockerCode: line(candidate.blockerCode, `corrections[${index}].blockerCode`, 3, 240),
      evidenceEventId,
      proposedValue: line(candidate.proposedValue, `corrections[${index}].proposedValue`, 1, 4000),
    }
  })
  const blockerCodes = corrections.map((correction) => correction.blockerCode)
  if (new Set(blockerCodes).size !== blockerCodes.length) throw new Error('Each blocker may be corrected only once per compilation.')
  return corrections
}

export function parseControlledReingestionRequest(value: unknown): ControlledReingestionRequest {
  const candidate = object(value, 'controlled re-ingestion request')
  const operation = line(candidate.operation, 'operation', 7, 7) as 'preview' | 'compile'
  if (!['preview', 'compile'].includes(operation)) throw new Error('operation must be preview or compile.')
  const recordId = line(candidate.recordId, 'recordId', 10, 180)
  const baseTargetSha256 = line(candidate.baseTargetSha256, 'baseTargetSha256', 71, 71)
  if (!RECORD_ID.test(recordId)) throw new Error('recordId must be a Maha record URN.')
  if (!SHA256.test(baseTargetSha256)) throw new Error('baseTargetSha256 must be a SHA-256 digest.')
  return {
    operation,
    recordId,
    baseTargetSha256,
    corrections: parseCorrections(candidate.corrections),
    note: line(candidate.note, 'note', 20, 4000),
    idempotencyKey: line(candidate.idempotencyKey, 'idempotencyKey', 8, 160),
  }
}

export function controlledCorrectionDescriptor(
  record: EpistemicRecord,
  blockerCode: string,
): ControlledCorrectionDescriptor | null {
  const locatorPrefix = 'source-locator-missing:'
  if (blockerCode.startsWith(locatorPrefix)) {
    const entityId = blockerCode.slice(locatorPrefix.length)
    const source = record.sources.find((candidate) => candidate.id === entityId)
    if (!source) return null
    return {
      blockerCode,
      kind: 'source-exact-locator',
      entityType: 'source',
      entityId,
      fieldPath: `sources[id=${entityId}].exactLocator`,
      fieldLabel: 'Exact source locator',
      inputKind: 'text',
      options: [],
      currentValue: source.exactLocator,
    }
  }

  const publicationPrefix = 'source-publication-date-missing:'
  if (blockerCode.startsWith(publicationPrefix)) {
    const entityId = blockerCode.slice(publicationPrefix.length)
    const source = record.sources.find((candidate) => candidate.id === entityId)
    if (!source) return null
    return {
      blockerCode,
      kind: 'source-publication-date',
      entityType: 'source',
      entityId,
      fieldPath: `sources[id=${entityId}].publishedAt|sourceChronology`,
      fieldLabel: 'Publication date or explicit source chronology',
      inputKind: 'text',
      options: [],
      currentValue: source.publishedAt,
    }
  }

  const maturityPrefix = 'claim-evidence-not-assessed:'
  if (blockerCode.startsWith(maturityPrefix)) {
    const entityId = blockerCode.slice(maturityPrefix.length)
    const claim = record.claims.find((candidate) => candidate.id === entityId)
    if (!claim) return null
    return {
      blockerCode,
      kind: 'claim-evidence-maturity',
      entityType: 'claim',
      entityId,
      fieldPath: `claims[id=${entityId}].evidenceMaturity`,
      fieldLabel: 'Evidence maturity',
      inputKind: 'select',
      options: EVIDENCE_MATURITIES.filter((value) => value !== 'not-assessed'),
      currentValue: claim.evidenceMaturity,
    }
  }

  return null
}

function validIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseSourceChronology(value: string): SourceChronology | null {
  let candidate: unknown
  try {
    candidate = JSON.parse(value)
  } catch {
    return null
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const chronology = candidate as Record<string, unknown>
  if (typeof chronology.status !== 'string' || !SOURCE_CHRONOLOGY_STATUSES.includes(chronology.status as SourceChronology['status'])) return null
  if (typeof chronology.accessedAt !== 'string' || !validIsoDate(chronology.accessedAt)) return null
  if (chronology.sourceVersion !== undefined && (typeof chronology.sourceVersion !== 'string' || chronology.sourceVersion.trim().length < 1 || chronology.sourceVersion.length > 160)) return null
  const allowed = new Set(['status', 'accessedAt', 'sourceVersion'])
  if (Object.keys(chronology).some((key) => !allowed.has(key))) return null
  return {
    status: chronology.status as SourceChronology['status'],
    accessedAt: chronology.accessedAt,
    ...(typeof chronology.sourceVersion === 'string' ? { sourceVersion: chronology.sourceVersion.trim() } : {}),
  }
}

function applyCorrection(record: EpistemicRecord, descriptor: ControlledCorrectionDescriptor, value: string): void {
  if (descriptor.kind === 'source-exact-locator') {
    if (value.length < 3 || value.length > 500) throw new Error(`${descriptor.blockerCode} requires a 3-500 character locator.`)
    const source = record.sources.find((candidate) => candidate.id === descriptor.entityId)
    if (!source) throw new Error(`The source for ${descriptor.blockerCode} is no longer present.`)
    source.exactLocator = value
    return
  }
  if (descriptor.kind === 'source-publication-date') {
    const source = record.sources.find((candidate) => candidate.id === descriptor.entityId)
    if (!source) throw new Error(`The source for ${descriptor.blockerCode} is no longer present.`)
    if (validIsoDate(value)) {
      source.publishedAt = value
      delete source.sourceChronology
      return
    }
    const chronology = parseSourceChronology(value)
    if (!chronology) throw new Error(`${descriptor.blockerCode} requires a real YYYY-MM-DD publication date or valid undated/living-document chronology JSON.`)
    source.publishedAt = ''
    source.sourceChronology = chronology
    return
  }
  if (!EVIDENCE_MATURITIES.includes(value as EvidenceMaturity) || value === 'not-assessed') {
    throw new Error(`${descriptor.blockerCode} requires a published evidence-maturity value other than not-assessed.`)
  }
  const claim = record.claims.find((candidate) => candidate.id === descriptor.entityId)
  if (!claim) throw new Error(`The claim for ${descriptor.blockerCode} is no longer present.`)
  claim.evidenceMaturity = value as EvidenceMaturity
}

function isSourceCompletionBlocker(reason: string): boolean {
  return !reason.startsWith('expert-review-')
    && reason !== 'approval-review-missing'
    && !['public-promotion-not-requested', 'review-state-not-canonical', 'publication-date-missing', 'canonical-version-missing'].includes(reason)
}

export function buildControlledReingestionCompilation(
  input: ControlledReingestionRequest,
  target: FrozenReingestionTarget,
  events: readonly SourceCompletionEvent[],
  compiledAt = new Date(),
): ControlledReingestionCompilation {
  if (!Number.isFinite(compiledAt.getTime())) throw new Error('compiledAt must be valid.')
  if (target.recordId !== input.recordId || target.reviewTargetSha256 !== input.baseTargetSha256) {
    throw new Error('The request does not match the selected frozen target.')
  }
  if (target.candidateSnapshot.id !== input.recordId) throw new Error('The frozen target snapshot has a different record ID.')
  if (epistemicReviewTargetHash(target.candidateSnapshot) !== target.reviewTargetSha256) {
    throw new Error('The frozen target snapshot does not match its review digest.')
  }

  const currentDecision = evaluatePublicationGate(target.candidateSnapshot)
  const persistedReasons = [...target.gateDecision.reasons].sort().join('|')
  if ([...currentDecision.reasons].sort().join('|') !== persistedReasons) {
    throw new Error('The persisted gate decision does not match the frozen target snapshot.')
  }

  const relevantEvents = events
    .filter((event) => event.recordId === input.recordId && event.targetSha256 === input.baseTargetSha256)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
  if (relevantEvents.at(-1)?.nextState !== 'ready-for-reingestion') {
    throw new Error('The frozen target is not ready for controlled re-ingestion.')
  }

  const outputRecord = structuredClone(target.candidateSnapshot)
  const applied: AppliedControlledCorrection[] = []
  const currentReasons = new Set(currentDecision.reasons)

  for (const correction of input.corrections) {
    if (!currentReasons.has(correction.blockerCode)) throw new Error(`${correction.blockerCode} is not a blocker on this frozen target.`)
    const descriptor = controlledCorrectionDescriptor(target.candidateSnapshot, correction.blockerCode)
    if (!descriptor) throw new Error(`${correction.blockerCode} is not supported by the controlled compiler.`)
    const evidenceEvent = relevantEvents.find((event) => event.eventId === correction.evidenceEventId)
    if (!evidenceEvent || evidenceEvent.action !== 'submit-evidence') {
      throw new Error(`${correction.blockerCode} must bind a submit-evidence event on this frozen target.`)
    }
    const evidence = evidenceEvent.evidence.find((entry) => entry.blockerCode === correction.blockerCode)
    if (!evidence) throw new Error(`${correction.blockerCode} is not covered by evidence event ${evidenceEvent.eventId}.`)
    if (descriptor.kind === 'source-exact-locator' && evidence.exactLocator && evidence.exactLocator !== correction.proposedValue) {
      throw new Error(`${correction.blockerCode} must use the exact locator recorded in its evidence event.`)
    }
    if (evidence.proposedValue && evidence.proposedValue !== correction.proposedValue) {
      throw new Error(`${correction.blockerCode} must use the proposed value recorded in its evidence event.`)
    }
    applyCorrection(outputRecord, descriptor, correction.proposedValue)
    applied.push({
      ...descriptor,
      evidenceEventId: evidenceEvent.eventId,
      evidenceEventSha256: evidenceEvent.eventSha256,
      evidenceSourceUrl: evidence.sourceUrl,
      previousValue: descriptor.currentValue,
      proposedValue: correction.proposedValue,
    })
  }

  const compiledAtIso = compiledAt.toISOString()
  outputRecord.publication = {
    requestedPublicPromotion: false,
    reviewState: 'draft',
    canonicalVersion: target.candidateSnapshot.publication.canonicalVersion,
    lastReviewedAt: compiledAtIso,
    requiredReviewScopes: target.candidateSnapshot.publication.requiredReviewScopes,
    reviewEvents: [],
  }
  const outputDecision = evaluatePublicationGate(outputRecord)
  const resolvedBlockerCodes = applied
    .map((correction) => correction.blockerCode)
    .filter((blocker) => !outputDecision.reasons.includes(blocker))
    .sort()
  if (resolvedBlockerCodes.length !== applied.length) throw new Error('At least one proposed correction did not resolve its bound blocker.')

  const outputReviewTargetSha256 = epistemicReviewTargetHash(outputRecord)
  if (outputReviewTargetSha256 === input.baseTargetSha256) throw new Error('Controlled re-ingestion must create a materially different review target.')

  const corrections = [...applied].sort((left, right) => left.fieldPath.localeCompare(right.fieldPath))
  const diff = corrections.map((correction) => ({
    path: correction.fieldPath,
    before: correction.previousValue,
    after: correction.proposedValue,
  }))
  const unsigned = {
    schemaVersion: EPISTEMIC_REINGESTION_VERSION,
    compilerVersion: EPISTEMIC_REINGESTION_COMPILER_VERSION,
    compilationId: `epicomp_${randomUUID().replaceAll('-', '')}`,
    recordId: input.recordId,
    domainSlug: outputRecord.domainSlug,
    sourcePublicPath: target.sourcePublicPath,
    baseCandidateSha256: target.candidateSha256,
    baseTargetSha256: input.baseTargetSha256,
    outputCandidateSha256: sha256Canonical(outputRecord),
    outputReviewTargetSha256,
    correctionEventIds: [...new Set(corrections.map((correction) => correction.evidenceEventId))].sort(),
    corrections,
    diff,
    resolvedBlockerCodes,
    remainingSourceBlockerCodes: outputDecision.reasons.filter(isSourceCompletionBlocker).sort(),
    gateDecision: outputDecision,
    outputRecord,
    note: input.note,
    compiledAt: compiledAtIso,
  }
  return { ...unsigned, compilationSha256: sha256Canonical(unsigned) }
}

export const CONTROLLED_REINGESTION_BOUNDARY = 'Controlled re-ingestion can apply only reason-coded, evidence-bound field corrections to a frozen target. It always creates a new immutable candidate, clears prior review events, resets publication controls to draft, and cannot publish or promote a page.'
