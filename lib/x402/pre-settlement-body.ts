import { parseContextPackRequest } from '../context-compiler.ts'
import { parseContextEvaluationRequest } from '../context-pack-evaluator.ts'
import { parseDeepContextRequest } from '../deep-context-evaluation.ts'
import { parseBookEditionRequest, parseBookSectionRequest } from './book-request.ts'
import { parseContextBudgetLadderInput, parseEvidenceRetentionMatrixInput } from './context-product-family.ts'
import type { X402Offer } from './offers.ts'

export type PreSettlementBodyDecision =
  | { ok: true }
  | { ok: false; status: 400 | 413 | 415; code: 'unsupported_media_type' | 'request_body_unreadable' | 'payload_too_large' | 'invalid_request'; message: string }

/**
 * The request contract each proxy-priced route enforces, keyed by offer.
 *
 * These routes answer 415, 413 and 400 from their handlers, and a handler only
 * runs after proxy.ts has settled the payment. Without this check a caller who
 * signs for a malformed body pays for a rejection. Each entry names the parser
 * its route runs, so the gateway and the route cannot drift apart; the parity
 * test in test/x402-pre-settlement-body.test.ts runs both on the same inputs.
 *
 * Idempotent job offers (MPS audit, research intake) are absent: their body is
 * already bound to the admission claim in admission-body.ts. Self-managed
 * routes (microproducts, celestial calculations) are absent: they read and
 * validate the body themselves before they call the gateway.
 */
const CONTRACTS: Readonly<Record<string, (value: unknown) => unknown>> = {
  'context-compression': parseContextPackRequest,
  'deep-context-evaluation': parseDeepContextRequest,
  'context-budget-ladder': parseContextBudgetLadderInput,
  'evidence-retention-matrix': parseEvidenceRetentionMatrixInput,
  'governed-context-verification-pack': parseContextEvaluationRequest,
  'book-section-the-imagined-life': parseBookSectionRequest,
  'book-section-the-volcanic-engine': parseBookSectionRequest,
  'book-edition-the-imagined-life': parseBookEditionRequest,
  'book-edition-the-volcanic-engine': parseBookEditionRequest,
}

export function hasPreSettlementBodyContract(offerId: string): boolean {
  return Object.hasOwn(CONTRACTS, offerId)
}

const NO_PAYMENT = 'No payment was taken.'

/**
 * Reads a clone, so the route still receives the original body. The byte limit
 * is the offer's published maxRequestBytes: a paid caller never holds an API
 * key tier, so the standard limit is the one execution applies to it.
 */
export async function validatePreSettlementBody(request: Request, offer: X402Offer): Promise<PreSettlementBodyDecision> {
  const parse = CONTRACTS[offer.id]
  if (!parse) return { ok: true }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return { ok: false, status: 415, code: 'unsupported_media_type', message: `Content-Type must be application/json. ${NO_PAYMENT}` }
  }

  let raw: string
  try {
    raw = await request.clone().text()
  } catch {
    return { ok: false, status: 400, code: 'request_body_unreadable', message: `The request body could not be read. ${NO_PAYMENT}` }
  }

  if (new TextEncoder().encode(raw).byteLength > offer.maxRequestBytes) {
    return {
      ok: false,
      status: 413,
      code: 'payload_too_large',
      message: `Request body exceeds the published ${offer.maxRequestBytes.toLocaleString('en-US')} byte limit for ${offer.id}. ${NO_PAYMENT}`,
    }
  }

  try {
    parse(JSON.parse(raw))
  } catch (error) {
    // Parser messages name the field and the rule. They never echo the value.
    const reason = error instanceof SyntaxError ? 'Request body must be valid JSON.' : error instanceof Error ? error.message : 'Invalid request body.'
    return { ok: false, status: 400, code: 'invalid_request', message: `${reason} ${NO_PAYMENT}` }
  }
  return { ok: true }
}
