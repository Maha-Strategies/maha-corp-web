import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

import type { MpsAuditResult } from '../mps-audit-engine.ts'
import { MPS_AUTONOMOUS_AUDIT_OFFER } from './offers.ts'

// The x402 MPS audit job: how a paid audit is identified, retrieved, and
// resumed without ever charging the same payer twice for the same job.
//
// Kept out of the route because the invariants here are the ones that cost
// money when they are wrong, and they are far easier to assert directly than
// through a request pipeline: a retrieval credential that is not high-entropy,
// a token comparison that leaks timing, an id that is treated as a capability,
// or a resume path that lets one payment fund unlimited model calls.

export const MPS_AUDIT_MODEL = 'claude-sonnet-4-6'

/** Matches the engine's own cap; the model never sees more than this. */
export const MAX_AUDIT_PASSAGE_CHARS = 6_000

/** Bounds what one payment can cost us in model calls. Also enforced in SQL. */
export const MAX_AUDIT_ATTEMPTS = 3

/**
 * How long a job may sit in `processing` before a resume may take it over.
 *
 * Longer than the route's own model timeout, so a request still in flight is
 * never treated as abandoned and run a second time concurrently.
 */
export const STALE_PROCESSING_MS = 90_000

export function createAuditJobId(): string {
  return `audit_${randomUUID().replaceAll('-', '')}`
}

/**
 * The retrieval credential.
 *
 * 32 bytes of CSPRNG output, base64url, so guessing one is not a strategy. The
 * audit id deliberately is not this credential: ids are returned in response
 * bodies, written to logs, and quoted in error payloads, so treating one as a
 * capability would make every result readable by anything that ever saw an id.
 * The caller gets the token exactly once, at creation; only its digest is
 * stored, so reading the database does not yield the ability to fetch results.
 */
export function createRetrievalToken(): string {
  return `mpsrt_${randomBytes(32).toString('base64url')}`
}

/**
 * The retrieval credential, derived rather than remembered.
 *
 * The previous design minted a random token, stored only its hash, and handed
 * the token back *after* a model call that can take a minute. A timeout,
 * crash, or restart between those two points destroyed the only copy of the
 * credential and stranded a job the payer had already bought. The secret
 * existed solely in the memory of a response that never arrived.
 *
 * Deriving it from a server secret and the audit id removes that window
 * entirely: the credential can be recomputed at any later time, on any
 * instance, and is re-issued on the free idempotent replay of the same logical
 * request. A payer who lost the response recovers by asking again -- which,
 * because the admission claim already settled, costs nothing.
 *
 * The secret is required rather than defaulted. A per-instance fallback would
 * make tokens unverifiable across instances and would fail exactly under the
 * conditions this exists to survive.
 */
export function deriveRetrievalToken(auditId: string, secret = process.env.X402_RETRIEVAL_TOKEN_SECRET): string | null {
  if (!secret || secret.length < 32) return null
  return `mpsrt_${createHmac('sha256', secret).update(`mps-audit:${auditId}`).digest('base64url')}`
}

export function retrievalTokenHash(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`
}

export function validRetrievalToken(value: string): boolean {
  return /^mpsrt_[A-Za-z0-9_-]{43}$/.test(value)
}

export function validAuditJobId(value: string): boolean {
  return /^audit_[a-f0-9]{32}$/.test(value)
}

/**
 * Constant-time comparison of the presented credential against the stored
 * digest.
 *
 * Comparing digests rather than raw tokens keeps both operands the same fixed
 * length, which is what makes timingSafeEqual usable here at all -- it throws
 * on length mismatch, and a caller controls the length of what it presents.
 */
export function retrievalTokenMatches(presented: string, storedHash: string): boolean {
  if (!validRetrievalToken(presented)) return false
  const candidate = Buffer.from(retrievalTokenHash(presented))
  const expected = Buffer.from(storedHash)
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

export type StoredAuditJob = {
  public_id: string
  client_request_id: string
  input_hash: string
  status: 'processing' | 'completed' | 'failed'
  result: MpsAuditResult | null
  failure_code: string | null
  attempt_count: number
  created_at: string
  payment_transaction: string
  payer: string
}

export const AUDIT_WARNINGS = [
  'Provenance statuses are model-assigned triage, not factual certification.',
  'This is not legal advice and not a substitute for human editorial review before publication.',
] as const

export const AUDIT_WARNING_CODES = [
  'automated_triage_not_certification',
  'not_legal_advice',
  'not_human_verification',
  'model_assigned_status',
] as const

export const AUDIT_RETENTION_BOUNDARIES = {
  sourceTextStored: false,
  claimVerificationPerformed: false,
  legalAdviceProvided: false,
  humanReviewPerformed: false,
} as const

/**
 * The public body for an audit job.
 *
 * `retrievalToken` is present only on the response that mints it. Every later
 * response omits it, because the caller already holds it and re-emitting a
 * bearer credential on each poll multiplies the places it can leak.
 */
export function auditJobResponse(
  job: Pick<StoredAuditJob, 'public_id' | 'client_request_id' | 'input_hash' | 'status' | 'result' | 'failure_code' | 'attempt_count'>,
  options: { retrievalToken?: string; idempotentReplay?: boolean } = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    version: '0.1',
    offerId: MPS_AUTONOMOUS_AUDIT_OFFER.id,
    auditId: job.public_id,
    ...(options.retrievalToken ? { retrievalToken: options.retrievalToken } : {}),
    clientRequestId: job.client_request_id,
    inputHash: job.input_hash,
    status: job.status,
    idempotentReplay: Boolean(options.idempotentReplay),
    warnings: [...AUDIT_WARNINGS],
    warningCodes: [...AUDIT_WARNING_CODES],
    retentionBoundaries: { ...AUDIT_RETENTION_BOUNDARIES },
    sourceTextStored: false,
  }

  if (job.status === 'completed' && job.result) body.audit = job.result

  if (job.status === 'failed') {
    // The payment is already recorded against this job, so the failure names
    // the recovery path rather than inviting a second purchase. This is the
    // difference between a settled payment and an untraceable 502.
    body.error = {
      code: job.failure_code ?? 'audit_failed',
      message: job.attempt_count < MAX_AUDIT_ATTEMPTS
        ? 'The audit did not complete. Resume it with your retrievalToken; this job is already paid for and will not be charged again.'
        : 'The audit did not complete and has exhausted its retry allowance. Contact support quoting the auditId.',
      resumable: job.attempt_count < MAX_AUDIT_ATTEMPTS,
      attemptsUsed: job.attempt_count,
      maxAttempts: MAX_AUDIT_ATTEMPTS,
    }
  }

  if (job.status === 'processing') {
    body.retryAfterSeconds = 5
    body.hint = 'Poll the retrieval URL with your retrievalToken. No further payment is required for this job.'
  }

  return body
}

/** Where a caller retrieves or resumes a job it has already paid for. */
export function auditRetrievalPath(auditId: string): string {
  return `${MPS_AUTONOMOUS_AUDIT_OFFER.path}/${auditId}`
}

export function isStaleProcessing(job: Pick<StoredAuditJob, 'status' | 'created_at'>, now = Date.now()): boolean {
  if (job.status !== 'processing') return false
  const started = Date.parse(job.created_at)
  return Number.isFinite(started) && now - started > STALE_PROCESSING_MS
}
