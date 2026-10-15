import { priceFor, requirementsFor, x402Config, type X402Config } from './config.ts'
import { isMicroProduct } from './micro-contracts.ts'
import { isDemand6 } from './demand6/contracts.ts'
import { acquireSlot, releaseSlot, type SlotResult } from './concurrency.ts'
import { createFacilitator } from './facilitator.ts'
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  acceptPayment,
  buildPaymentRequired,
  encodeChallengeHeader,
  encodePaymentResponse,
  matchesPaymentContext,
  matchRequirement,
  parsePaymentHeader,
  readPaymentSignature,
  type PaymentFacilitator,
  type PaymentRequirement,
  type SettlementConfirmer,
} from './protocol.ts'
import { confirmSettlement } from './chain.ts'
import { createReplayGuard } from './replay-guard.ts'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { SLOT_RESOURCE_HEADER, SLOT_TOKEN_HEADER } from './slot.ts'
import { discoveryExtensionsFor, resourceInfoFor } from './discovery.ts'
import { createAdmissionGuard, readAdmissionClaim } from './admission.ts'
import { validateAdmissionBody } from './admission-body.ts'
import { readMicroBody } from './micro-body.ts'
import { readMicroPurchase } from './micro-purchase.ts'
import { buildMicroProduct, microDigest } from './micro-products.ts'
import { isScienceProduct } from './science/contracts.ts'
import { validatePreSettlementBody } from './pre-settlement-body.ts'
import { createMicroAdmissionGuard } from './micro-recovery.ts'
import { offerById } from './offers.ts'

// Decides what happens to a request that carries no API key: a challenge, a
// refusal, or admission as a paid caller. Sits between proxy.ts and the
// protocol so the proxy stays a thin router and this stays testable without a
// request pipeline.

export type X402Outcome =
  | { kind: 'not_applicable' }
  | { kind: 'challenge'; status: 402; header: string; body: unknown }
  | { kind: 'refused'; status: 400 | 402 | 409 | 413 | 415 | 429 | 502 | 503; code: string; message: string; retryAfterSeconds?: number }
  | {
      kind: 'paid'
      /** True when this settled earlier and was not charged again. */
      replayed?: boolean
      /** Server-computed commitment; never read from client headers. */
      microResponseDigest?: string
      header: string
      transaction: string
      payer: string
      amountPaid: string
      network?: string
      /** The capacity slot this request holds. Whoever observes the work finish
       *  must release it; see lib/x402/slot.ts. */
      slot: { resource: string; token: string }
    }

type Dependencies = {
  config?: X402Config | null
  facilitator?: PaymentFacilitator
  ledger?: Parameters<typeof createReplayGuard>[0] | null
  acquire?: typeof acquireSlot
  release?: typeof releaseSlot
  confirmOnChain?: SettlementConfirmer
  /** Test seam for the pre-settlement idempotency store. */
  admissionLedger?: Parameters<typeof createAdmissionGuard>[1]
}

/**
 * Reads the chain for this requirement, or nothing when no endpoint is set.
 *
 * Bound to the requirement we published rather than to anything the caller or
 * the facilitator supplied, so the transfer is checked against the asset and
 * recipient this server actually asked for.
 */
function confirmerFor(config: X402Config, requirement: PaymentRequirement): SettlementConfirmer | undefined {
  const network = (config.paymentNetworks ?? [config]).find(option => option.network === requirement.network && option.asset.toLowerCase() === requirement.asset.toLowerCase() && option.payTo.toLowerCase() === requirement.payTo.toLowerCase())
  if (!network?.chainRpcUrl) return undefined
  return async ({ transaction, payer }) => confirmSettlement({
    rpcUrl: network.chainRpcUrl!,
    caip2Network: requirement.network,
    transaction,
    asset: requirement.asset,
    payer,
    payTo: requirement.payTo,
    minAmount: requirement.amount,
  })
}

/**
 * `not_applicable` means the caller should carry on exactly as before —
 * x402 disabled, or a path with no published price. Every other outcome is
 * terminal for this request.
 */
export async function resolveX402(request: Request, dependencies: Dependencies = {}): Promise<X402Outcome> {
  let config: X402Config | null
  try {
    config = dependencies.config !== undefined ? dependencies.config : x402Config()
  } catch (error) {
    // Present but invalid configuration must not quietly disable payments, and
    // must not serve resources for free either.
    console.error('x402 configuration is invalid:', error instanceof Error ? error.message : 'unknown_error')
    return { kind: 'refused', status: 503, code: 'x402_misconfigured', message: 'Machine payment is temporarily unavailable.' }
  }
  if (!config) return { kind: 'not_applicable' }

  const url = new URL(request.url)
  // Method-aware and exact. A GET beside a priced POST is not the priced
  // resource, and a sub-path of one is not the parent.
  const resource = priceFor(request.method, url.pathname, config)
  if (!resource) return { kind: 'not_applicable' }

  // The requirement binds to the exact URL without query string, so a
  // challenge cannot be answered against a different resource.
  const resourceUrl = `${url.origin}${url.pathname}`
  const requirements = requirementsFor(resource, resourceUrl, config)
  const resourceInfo = resourceInfoFor(resource, resourceUrl)
  // The requirement is passed through so the declaration digest covers the
  // accepts array this challenge actually carries. Awaited once per request,
  // served from a per-offer cache after the first.
  let extensions: Record<string, unknown> | undefined
  try { extensions = await discoveryExtensionsFor(resource, resourceUrl, requirements) }
  catch { return { kind: 'refused', status: 503, code: 'payment_challenge_unavailable', message: 'Payment terms cannot be advertised safely. No new payment was requested.' } }

  const signature = readPaymentSignature(request.headers)
  if (!signature) return challenge(requirements, resourceInfo, extensions, 'Payment is required for this resource.')

  const parsed = parsePaymentHeader(signature)
  if (!parsed.ok) return challenge(requirements, resourceInfo, extensions, parsed.reason)
  if (!matchesPaymentContext(parsed.payment, resourceInfo, extensions)) {
    return challenge(requirements, resourceInfo, extensions, 'payment_context_mismatch')
  }
  const requirement = matchRequirement(parsed.payment, requirements)
  if (!requirement) return challenge(requirements, resourceInfo, extensions, 'no_matching_requirement')

  const ledger = dependencies.ledger !== undefined ? dependencies.ledger : createAgentInquiryLedger()
  if (!ledger) {
    // Without the ledger there is no replay protection, and a proof would buy
    // unlimited calls.
    return { kind: 'refused', status: 503, code: 'x402_ledger_unavailable', message: 'Machine payment is temporarily unavailable.' }
  }

  const facilitator = dependencies.facilitator ?? createFacilitator({
    url: config.facilitatorUrl,
    authHeaders: config.facilitatorAuthHeaders,
    cdpCredentials: config.cdpCredentials,
  })

  // Offers that create a job claim idempotency before settlement. Without this
  // a payer whose request timed out retries with a newly signed authorization
  // and pays twice, and the route -- which only ever runs after the money has
  // moved -- reports `idempotentReplay: true` beside a second charge.
  const offer = offerById(resource.offerId)
  let microResponseDigest: string | undefined
  let admissionGuard: Parameters<typeof acceptPayment>[0]['admissionGuard']
  if (offer?.requiresIdempotency) {
    const claim = readAdmissionClaim(request.headers, offer, resourceUrl)
    if (!claim.ok) {
      return {
        kind: 'refused',
        status: 400,
        code: claim.reason,
        message: `${offer.id} requires an ${'x-maha-idempotency-key'} header equal to clientRequestId and an ${'x-maha-input-hash'} header computed from the preimage published in its discovery contract. Both are checked against the body before settlement so a retry cannot be charged twice.`,
      }
    }
    // A declared input hash is not evidence that the body reproduces it. Read
    // a clone and check every deterministic route rejection now, while no
    // money has moved; the original body remains untouched for the handler.
    const bodyDecision = await validateAdmissionBody(request, offer, claim.claim)
    if (!bodyDecision.ok) return { kind: 'refused', ...bodyDecision }

    let guard: ReturnType<typeof createAdmissionGuard>
    if (isScienceProduct(offer.id)) {
      try {
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') ||
            (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity')) {
          return { kind: 'refused', status: 415, code: 'unsupported_media_type', message: 'Only uncompressed JSON is accepted. No payment attempted.' }
        }
        const input = await readMicroBody(request.clone())
        const binding = readMicroPurchase(request.headers, offer.id, input)
        const prepared = await buildMicroProduct(offer.id, input)
        microResponseDigest = microDigest(prepared)
        guard = createMicroAdmissionGuard(claim.claim, { secretHash: binding.secretHash, responseDigest: microResponseDigest }, dependencies.admissionLedger)
      } catch (error) {
        return { kind: 'refused', status: error instanceof Error && error.message === 'payload_too_large' ? 413 : 400,
          code: 'invalid_micro_purchase', message: 'Purchase identity, input binding or bounded input is invalid. No payment attempted.' }
      }
    } else guard = createAdmissionGuard(claim.claim, dependencies.admissionLedger)
    if (!guard) {
      return { kind: 'refused', status: 503, code: 'x402_ledger_unavailable', message: 'Idempotency cannot be guaranteed right now, so no payment was taken. Retry shortly.' }
    }
    admissionGuard = guard
  } else if (offer) {
    const bodyDecision = await validatePreSettlementBody(request, offer)
    if (!bodyDecision.ok) return { kind: 'refused', ...bodyDecision }
  }

  // The bounded, synchronous calculation offers reserve capacity before any
  // settlement. They do not persist input-bound jobs for paid retry recovery.
  // Keep the existing job-backed/legacy offer path unchanged.
  const acquire = dependencies.acquire ?? acquireSlot
  const release = dependencies.release ?? releaseSlot
  const reserveFirst = isMicroProduct(resource.offerId) || isDemand6(resource.offerId) || resource.offerId.startsWith('book-epub-') || ['cabezon-buyer-brief-pack', 'celestial-position-snapshot', 'celestial-chart-evidence', 'celestial-vimshottari-timing'].includes(resource.offerId)
  let reserved: SlotResult | undefined
  if (reserveFirst) {
    reserved = await acquire(resource.offerId, resource.concurrencyCap, config.slotTtlSeconds)
    if (!reserved.admitted) return {
      kind: 'refused', status: 429, code: 'resource_at_capacity',
      message: 'Capacity is unavailable. No payment was settled; retry with the same authorization.',
      retryAfterSeconds: Math.min(config.slotTtlSeconds, 60),
    }
  }
  let accepted: Awaited<ReturnType<typeof acceptPayment>>
  try { accepted = await acceptPayment({
    payment: parsed.payment,
    requirements,
    facilitator,
    replayGuard: createReplayGuard(ledger, { network: requirement.network, asset: requirement.asset, resource: resourceUrl }, requirement),
    confirmOnChain: dependencies.confirmOnChain ?? confirmerFor(config, requirement),
    confirmRecoveryOnChain: network => {
      const original = requirements.find(term => term.network === network)
      return original ? dependencies.confirmOnChain ?? confirmerFor(config, original) : undefined
    },
    ...(admissionGuard ? { admissionGuard } : {}),
  }) } catch (error) {
    if (reserved) await release(resource.offerId, reserved.token ?? '')
    throw error
  }

  if (!accepted.ok) {
    if (reserved) await release(resource.offerId, reserved.token ?? '')
    if (accepted.reason === 'settlement_outcome_unknown') {
      return { kind: 'refused', status: 503, code: 'settlement_outcome_unknown',
        message: 'Payment may have settled. Do not sign or submit another payment; reconciliation is required.' }
    }
    // Checked before the reason-string match below, which is a broad pattern
    // that must not be given the chance to read a chain contradiction as a
    // replay. The two call for opposite responses.
    if (accepted.status === 502) {
      console.error('x402 settlement contradicted by chain:', accepted.reason)
      return {
        kind: 'refused',
        status: 502,
        code: 'settlement_contradicted',
        message: 'The settlement reported by the payment facilitator could not be corroborated on chain. The resource was withheld and the discrepancy has been recorded.',
      }
    }

    if (isMicroProduct(resource.offerId) && accepted.status === 409) return {
      kind: 'refused', status: 409, code: accepted.reason,
      message: 'Recover this purchase using its saved identity before authorizing another payment.',
    }
    // FIX: Catch any string that hints the payment was already used/settled/replayed
    if (accepted.status === 409 || /used|replay|settled|conflict|duplicate|already/i.test(accepted.reason)) {
      return { kind: 'refused', status: 409, code: 'payment_already_used', message: 'This payment has already been used.' }
    }
    
    if (isMicroProduct(resource.offerId) && accepted.status === 503) return { kind: 'refused', status: 503, code: 'purchase_recovery_required', message: 'Purchase accounting is unavailable. Recover the saved purchase before authorizing another payment.' }
    if (accepted.status === 503) {
      // Nothing settled, so the caller's authorization is still spendable.
      return { kind: 'refused', status: 503, code: 'x402_ledger_unavailable', message: 'Payment could not be recorded and was not settled. Retry with the same payment.' }
    }
    
    return challenge(requirements, resourceInfo, extensions, accepted.reason)
  }

  // Legacy offers acquire after settlement; calculations reuse their reservation.
  // Keyed by offer id rather than by path, so two offers sharing a path prefix
  // hold separate capacity pools and neither can starve the other.
  const slot = reserved ?? await acquire(resource.offerId, resource.concurrencyCap, config.slotTtlSeconds)
  if (!slot.admitted) {
    return {
      kind: 'refused',
      status: 429,
      code: 'resource_at_capacity',
      message: 'This resource is at capacity. The payment was accepted and is not consumed again on retry.',
      retryAfterSeconds: Math.min(config.slotTtlSeconds, 60),
    }
  }

  const deliveredPayer = isMicroProduct(resource.offerId) ? accepted.payer.toLowerCase() : accepted.payer
  return {
    kind: 'paid',
    ...(microResponseDigest ? { microResponseDigest } : {}),
    ...(accepted.replayed ? { replayed: true } : {}),
    network: accepted.network ?? requirement.network,
    header: encodePaymentResponse({ transaction: accepted.transaction, network: accepted.network ?? requirement.network, payer: deliveredPayer }),
    transaction: accepted.transaction,
    payer: deliveredPayer,
    amountPaid: accepted.amountPaid,
    slot: { resource: resource.offerId, token: slot.token ?? '' },
  }
}

function challenge(
  requirements: PaymentRequirement[],
  resource: Parameters<typeof buildPaymentRequired>[1],
  extensions: Record<string, unknown> | undefined,
  error: string,
): X402Outcome {
  const body = buildPaymentRequired(requirements, resource, error, extensions)
  try { return { kind: 'challenge', status: 402, header: encodeChallengeHeader(body), body } }
  catch { return { kind: 'refused', status: 503, code: 'payment_challenge_unavailable', message: 'Payment terms cannot be advertised safely. No new payment was requested.' } }
}

export const X402_HEADERS = {
  required: PAYMENT_REQUIRED_HEADER,
  response: PAYMENT_RESPONSE_HEADER,
} as const

/**
 * What a paid request must carry downstream.
 *
 * Extracted from proxy.ts so it can be asserted: a header spelled one way here
 * and another way in the handler that reads it fails silently, and the symptom
 * -- a payer getting a 401 -- looks nothing like the cause. proxy.ts itself is
 * not importable under the test runner, so this is the seam.
 */
export function paidRequestHeaders(outcome: Extract<X402Outcome, { kind: 'paid' }>): Record<string, string> {
  return {
    'x-maha-access-mode': 'x402',
    'x-maha-payment-transaction': outcome.transaction,
    'x-maha-payment-payer': outcome.payer,
    'x-maha-payment-amount': outcome.amountPaid,
    ...(outcome.network ? { 'x-maha-payment-network': outcome.network } : {}),
    // Tells the route this settled earlier and was not charged again, so it
    // returns the original job instead of starting a second one.
    'x-maha-payment-replayed': outcome.replayed ? 'true' : 'false',
    [SLOT_RESOURCE_HEADER]: outcome.slot.resource,
    [SLOT_TOKEN_HEADER]: outcome.slot.token,
  }
}
