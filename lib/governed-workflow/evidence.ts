import { governanceDigest } from '../governance/envelope.ts'
import type { EvidenceProvenance, EvidenceReference, Sha256 } from './types.ts'

/**
 * Evidence handling for the governed workflow state graph.
 *
 * The contract is narrow on purpose: this module accepts *references* and
 * proves things about their structure. It never accepts, stores, or returns
 * document content, and the retention guard below exists so that a future
 * caller who tries cannot succeed quietly.
 */

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/
const MAX_LABEL_KEYS = 12
const MAX_LABEL_LENGTH = 120

/** Labels are metadata about a document, never text from inside one. */
const MAX_EVIDENCE_BYTES = 512 * 1024 * 1024

export function isSha256(value: unknown): value is Sha256 {
  return typeof value === 'string' && SHA256_PATTERN.test(value)
}

/**
 * What this library actually established about a reference.
 *
 * Every "verified" field here is about *form*. The three `false` fields are
 * not placeholders awaiting implementation — they are the boundary. A digest
 * commits two parties to the same bytes; it says nothing about whether those
 * bytes are true, who authored them, or whether a provider ran anything.
 * Flipping any of them to `true` would require a verification step this
 * library does not perform.
 */
export function describeProvenance(input: { trustedPassThrough: string[] }): EvidenceProvenance {
  return {
    structureVerifiedLocally: true,
    digestFormatVerified: true,
    trustedPassThrough: [...input.trustedPassThrough].sort(),
    sourceAuthenticityVerified: false,
    factualTruthEstablished: false,
    providerExecutionVerified: false,
  }
}

export type EvidenceValidation = { valid: true } | { valid: false; reason: string }

/**
 * Structural validation, including the retention guard.
 *
 * The label checks are the interesting part. Free text is how source content
 * leaks into a durable audit trail — someone stores an excerpt "just for
 * context" and the metadata-only guarantee is gone. Bounding length and key
 * count makes an excerpt not fit.
 */
export function validateEvidenceReference(reference: EvidenceReference): EvidenceValidation {
  if (!reference.evidenceId || reference.evidenceId.length > 120) return { valid: false, reason: 'evidenceId is invalid.' }
  if (!isSha256(reference.contentSha256)) return { valid: false, reason: 'contentSha256 is not a sha256 digest.' }
  if (!Number.isInteger(reference.contentBytes) || reference.contentBytes < 0 || reference.contentBytes > MAX_EVIDENCE_BYTES) {
    return { valid: false, reason: 'contentBytes is invalid.' }
  }
  const labelKeys = Object.keys(reference.labels)
  if (labelKeys.length > MAX_LABEL_KEYS) return { valid: false, reason: 'Too many evidence labels.' }
  for (const key of labelKeys) {
    const value = reference.labels[key]
    if (typeof value !== 'string') return { valid: false, reason: `Label ${key} is not a string.` }
    if (value.length > MAX_LABEL_LENGTH) return { valid: false, reason: `Label ${key} exceeds the metadata length bound.` }
  }
  const provenance = reference.provenance
  if (provenance.sourceAuthenticityVerified !== false) return { valid: false, reason: 'sourceAuthenticityVerified must be false.' }
  if (provenance.factualTruthEstablished !== false) return { valid: false, reason: 'factualTruthEstablished must be false.' }
  if (provenance.providerExecutionVerified !== false) return { valid: false, reason: 'providerExecutionVerified must be false.' }
  return { valid: true }
}

/**
 * A single digest over the whole evidence set.
 *
 * Sorted by evidenceId so the same set in a different order yields the same
 * commitment, and so that adding, removing or swapping any member changes it.
 * This is what an approval binds to, which is how changed evidence invalidates
 * an approval that was granted against the old set.
 */
export function evidenceSetDigest(evidence: EvidenceReference[]): Sha256 {
  const members = evidence
    .map((entry) => ({ evidenceId: entry.evidenceId, contentSha256: entry.contentSha256 }))
    .sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0))
  return governanceDigest(members) as Sha256
}

/** Digest over the declared input. Scalars only — see the type. */
export function declaredInputDigest(input: Record<string, string | number | boolean>): Sha256 {
  return governanceDigest(input) as Sha256
}

/**
 * Whether the evidence set satisfies what the workflow template requires.
 *
 * Completeness is a declared requirement rather than "the caller sent at least
 * one thing". The distinction matters: an empty-handed agent and an agent that
 * checked and found nothing outstanding must not both read as a clear path to
 * an automated decision, and only a declared requirement can tell them apart.
 */
export function evidenceSetIsComplete(
  evidence: EvidenceReference[],
  requiredKinds: readonly EvidenceReference['kind'][],
): { complete: boolean; missingKinds: EvidenceReference['kind'][] } {
  const present = new Set(evidence.map((entry) => entry.kind))
  const missingKinds = requiredKinds.filter((kind) => !present.has(kind))
  return { complete: missingKinds.length === 0, missingKinds }
}

/** The sanitized projection safe to return from an API or render in a view. */
export function sanitizeEvidenceReference(reference: EvidenceReference) {
  return {
    evidenceId: reference.evidenceId,
    kind: reference.kind,
    contentSha256: reference.contentSha256,
    contentBytes: reference.contentBytes,
    provenance: reference.provenance,
    labels: reference.labels,
  }
}
