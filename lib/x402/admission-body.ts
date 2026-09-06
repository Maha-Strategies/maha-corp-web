import { auditInputHash, validateAuditPassage } from '../mps-audit-engine.ts'
import { parseMpsAuditJobRequest } from '../mps-audit-jobs.ts'
import { parseResearchIntakeInput, researchIntakeInputHash } from '../research-intake-evidence-pack.ts'
import type { AdmissionClaim } from './admission.ts'
import type { X402Offer } from './offers.ts'

export type AdmissionBodyDecision =
  | { ok: true }
  | { ok: false; status: 400 | 409 | 413 | 415; code: string; message: string }

/**
 * Validates the body-bound part of a durable-job admission before settlement.
 *
 * The admission headers have to be available before the route runs, but a
 * header supplied by the payer is only a declaration. For MPS, trusting that
 * declaration until after settlement caused the 2026-08-12 loss: the payer
 * hashed the JSON envelope while the route hashes the `text` field alone.
 * Reading a clone preserves the original request body for the route while
 * moving every deterministic rejection in front of the payment boundary.
 */
export async function validateAdmissionBody(
  request: Request,
  offer: X402Offer,
  claim: AdmissionClaim,
): Promise<AdmissionBodyDecision> {
  if (!['mps-autonomous-audit', 'research-intake-evidence-pack'].includes(offer.id)) return { ok: true }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return { ok: false, status: 415, code: 'unsupported_media_type', message: 'Content-Type must be application/json. No payment was taken.' }
  }

  let raw: string
  try {
    raw = await request.clone().text()
  } catch {
    return { ok: false, status: 400, code: 'request_body_unreadable', message: 'The request body could not be read. No payment was taken.' }
  }

  if (new TextEncoder().encode(raw).byteLength > offer.maxRequestBytes) {
    return { ok: false, status: 413, code: 'payload_too_large', message: 'Request body exceeds the 32 KB limit. No payment was taken.' }
  }

  try {
    const parsed = JSON.parse(raw)
    const body = offer.id === 'mps-autonomous-audit'
      ? parseMpsAuditJobRequest(parsed)
      : parseResearchIntakeInput(parsed)
    const actualHash = offer.id === 'mps-autonomous-audit'
      ? auditInputHash(validateAuditPassage(parseMpsAuditJobRequest(parsed).text))
      : researchIntakeInputHash(parseResearchIntakeInput(parsed))

    if (body.clientRequestId !== claim.idempotencyKey) {
      return { ok: false, status: 409, code: 'idempotency_key_mismatch', message: 'x-maha-idempotency-key must equal clientRequestId. No payment was taken.' }
    }
    if (actualHash !== claim.inputHash) {
      return {
        ok: false,
        status: 409,
        code: 'input_hash_mismatch',
        message: `x-maha-input-hash does not match the published ${offer.id} preimage. No payment was taken.`,
      }
    }
  } catch (error) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_request',
      message: `${error instanceof Error ? error.message : 'Invalid request body.'} No payment was taken.`,
    }
  }

  return { ok: true }
}
