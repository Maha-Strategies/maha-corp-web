import { priceFor, requirementFor, x402Config, type X402Config } from './config.ts'
import { acquireSlot } from './concurrency.ts'
import { createFacilitator } from './facilitator.ts'
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  acceptPayment,
  buildPaymentRequired,
  encodeChallengeHeader,
  encodePaymentResponse,
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

// Decides what happens to a request that carries no API key: a challenge, a
// refusal, or admission as a paid caller. Sits between proxy.ts and the
// protocol so the proxy stays a thin router and this stays testable without a
// request pipeline.

export type X402Outcome =
  | { kind: 'not_applicable' }
  | { kind: 'challenge'; status: 402; header: string; body: unknown }
  | { kind: 'refused'; status: 402 | 409 | 429 | 502 | 503; code: string; message: string; retryAfterSeconds?: number }
  | {
      kind: 'paid'
      header: string
      transaction: string
      payer: string
      amountPaid: string
      /** The capacity slot this request holds. Whoever observes the work finish
       *  must release it; see lib/x402/slot.ts. */
      slot: { resource: string; token: string }
    }

type Dependencies = {
  config?: X402Config | null
  facilitator?: PaymentFacilitator
  ledger?: Parameters<typeof createReplayGuard>[0] | null
  acquire?: typeof acquireSlot
  confirmOnChain?: SettlementConfirmer
}

/**
 * Reads the chain for this requirement, or nothing when no endpoint is set.
 *
 * Bound to the requirement we published rather than to anything the caller or
 * the facilitator supplied, so the transfer is checked against the asset and
 * recipient this server actually asked for.
 */
function confirmerFor(config: X402Config, requirement: PaymentRequirement): SettlementConfirmer | undefined {
  if (!config.chainRpcUrl) return undefined
  return async ({ transaction, payer }) => confirmSettlement({
    rpcUrl: config.chainRpcUrl!,
    caip2Network: config.caip2Network,
    transaction,
    asset: config.asset,
    payer,
    payTo: config.payTo,
    minAmount: requirement.maxAmountRequired,
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
  const resource = priceFor(url.pathname, config)
  if (!resource) return { kind: 'not_applicable' }

  // The requirement binds to the exact URL without query string, so a
  // challenge cannot be answered against a different resource.
  const resourceUrl = `${url.origin}${url.pathname}`
  const requirement = requirementFor(resource, resourceUrl, config)

  const signature = readPaymentSignature(request.headers)
  if (!signature) return challenge(requirement, 'Payment is required for this resource.')

  const parsed = parsePaymentHeader(signature)
  if (!parsed.ok) return challenge(requirement, parsed.reason)

  const ledger = dependencies.ledger !== undefined ? dependencies.ledger : createAgentInquiryLedger()
  if (!ledger) {
    // Without the ledger there is no replay protection, and a proof would buy
    // unlimited calls.
    return { kind: 'refused', status: 503, code: 'x402_ledger_unavailable', message: 'Machine payment is temporarily unavailable.' }
  }

  const facilitator = dependencies.facilitator ?? createFacilitator({
    url: config.facilitatorUrl,
    authHeaders: config.facilitatorAuthHeaders,
  })

  const accepted = await acceptPayment({
    payment: parsed.payment,
    requirements: [requirement],
    facilitator,
    replayGuard: createReplayGuard(ledger, { network: config.caip2Network, asset: config.asset }, requirement),
    confirmOnChain: dependencies.confirmOnChain ?? confirmerFor(config, requirement),
  })

  if (!accepted.ok) {
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

    // FIX: Catch any string that hints the payment was already used/settled/replayed
    if (accepted.status === 409 || /used|replay|settled|conflict|duplicate|already/i.test(accepted.reason)) {
      return { kind: 'refused', status: 409, code: 'payment_already_used', message: 'This payment has already been used.' }
    }
    
    if (accepted.status === 503) {
      // Nothing settled, so the caller's authorization is still spendable.
      return { kind: 'refused', status: 503, code: 'x402_ledger_unavailable', message: 'Payment could not be recorded and was not settled. Retry with the same payment.' }
    }
    
    return challenge(requirement, accepted.reason)
  }

  // Capacity is checked only after payment is settled and recorded. Checking
  // first would let an unpaid caller probe how loaded a resource is.
  const acquire = dependencies.acquire ?? acquireSlot
  const slot = await acquire(resource.pathPrefix, resource.concurrencyCap, config.slotTtlSeconds)
  if (!slot.admitted) {
    return {
      kind: 'refused',
      status: 429,
      code: 'resource_at_capacity',
      message: 'This resource is at capacity. The payment was accepted and is not consumed again on retry.',
      retryAfterSeconds: Math.min(config.slotTtlSeconds, 60),
    }
  }

  return {
    kind: 'paid',
    header: encodePaymentResponse({ transaction: accepted.transaction, network: config.caip2Network, payer: accepted.payer }),
    transaction: accepted.transaction,
    payer: accepted.payer,
    amountPaid: accepted.amountPaid,
    slot: { resource: resource.pathPrefix, token: slot.token ?? '' },
  }
}

function challenge(requirement: PaymentRequirement, error: string): X402Outcome {
  const body = buildPaymentRequired([requirement], error)
  return { kind: 'challenge', status: 402, header: encodeChallengeHeader(body), body }
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
    [SLOT_RESOURCE_HEADER]: outcome.slot.resource,
    [SLOT_TOKEN_HEADER]: outcome.slot.token,
  }
}