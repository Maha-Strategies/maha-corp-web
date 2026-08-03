// x402 revives HTTP 402 as a payment challenge: an unauthenticated request is
// answered with the terms of payment, the caller retries carrying a signed
// stablecoin payment, and the server verifies it with a facilitator before
// serving the resource. It is what makes account-free pay-per-use possible --
// an agent transacts without registering, holding a key, or a human present.
//
// This module is the protocol layer only. It builds challenges, parses and
// validates payloads, and enforces the checks that must happen before a
// facilitator is trusted. It settles nothing by itself and holds no key.
//
// Header names follow the settled specification: PAYMENT-REQUIRED carries the
// base64-encoded challenge from server to client, PAYMENT-SIGNATURE carries the
// signed payment back, and PAYMENT-RESPONSE optionally confirms settlement
// alongside the resource. The X-PAYMENT form seen in earlier material is
// accepted inbound as a defensive measure but never emitted.
//
// This does not collide with the existing 402. That one answers an
// authenticated request whose key has no credits, and points at Stripe. This
// one answers a request carrying no key at all. The discriminator is the
// presence of an API key, so the two never contend for the same request.

export type X402Network = 'base' | 'base-sepolia' | 'solana' | 'arbitrum'

export type PaymentRequirement = {
  scheme: 'exact'
  network: X402Network
  /** Smallest indivisible unit of the asset, as a decimal string. USDC has six. */
  maxAmountRequired: string
  /** The exact URL being paid for. Binding it prevents a payment for a cheap
   *  resource being replayed against an expensive one. */
  resource: string
  description: string
  mimeType: string
  /** The receiving address. Belongs to the settlement provider, not to us. */
  payTo: string
  maxTimeoutSeconds: number
  /** Contract address of the accepted asset, e.g. USDC on the chosen network. */
  asset: string
}

export type PaymentRequiredBody = {
  x402Version: 1
  accepts: PaymentRequirement[]
  error: string
}

export type PaymentPayload = {
  x402Version: number
  scheme: string
  network: string
  payload: Record<string, unknown>
}

export type VerificationResult =
  | { ok: true; payer: string; transaction: string; amountPaid: string }
  | { ok: false; reason: string }

/** Injectable so the protocol is testable without a facilitator or a network. */
export type PaymentFacilitator = {
  verify(payment: PaymentPayload, requirement: PaymentRequirement): Promise<VerificationResult>
  settle(payment: PaymentPayload, requirement: PaymentRequirement): Promise<VerificationResult>
}

/**
 * A payment is a bearer instrument: whoever holds the payload can present it.
 * Without a record of what has already been spent, the same payload buys
 * unlimited calls. This mirrors the Stripe webhook event table, where the
 * identifier is claimed in the same transaction as the value it releases.
 */
export type ReplayGuard = {
  /** True when this payment has not been seen before and is now claimed. */
  claim(transaction: string): Promise<boolean>
}

export const X402_VERSION = 1 as const

export const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED'
export const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE'
export const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE'
/** Pre-standard name. Read, never written. */
const LEGACY_SIGNATURE_HEADER = 'X-PAYMENT'

const NETWORKS = new Set<string>(['base', 'base-sepolia', 'solana', 'arbitrum'])
const AMOUNT = /^[0-9]{1,32}$/

export function buildPaymentRequired(requirements: PaymentRequirement[], error = 'Payment required.'): PaymentRequiredBody {
  if (requirements.length === 0) throw new Error('At least one payment requirement is required.')
  for (const requirement of requirements) assertRequirement(requirement)
  return { x402Version: X402_VERSION, accepts: requirements, error }
}

function assertRequirement(requirement: PaymentRequirement): void {
  if (!NETWORKS.has(requirement.network)) throw new Error(`Unsupported network: ${requirement.network}`)
  if (!AMOUNT.test(requirement.maxAmountRequired)) throw new Error('maxAmountRequired must be an integer string in the asset\'s smallest unit.')
  if (requirement.maxAmountRequired === '0') throw new Error('maxAmountRequired must be greater than zero.')
  if (!requirement.payTo.trim()) throw new Error('payTo is required.')
  if (!requirement.asset.trim()) throw new Error('asset is required.')
  let resource: URL
  try { resource = new URL(requirement.resource) } catch { throw new Error('resource must be an absolute URL.') }
  if (resource.protocol !== 'https:') throw new Error('resource must be https.')
  if (requirement.maxTimeoutSeconds <= 0 || requirement.maxTimeoutSeconds > 300) throw new Error('maxTimeoutSeconds must be between 1 and 300.')
}

/**
 * Decodes the X-PAYMENT header. Rejects rather than throws, because a
 * malformed payload is an ordinary client error and must not become a 500.
 */
export function parsePaymentHeader(header: string | null): { ok: true; payment: PaymentPayload } | { ok: false; reason: string } {
  if (!header?.trim()) return { ok: false, reason: 'missing_payment_header' }
  // A header large enough to be a denial-of-service vector is refused before
  // it is decoded.
  if (header.length > 8_192) return { ok: false, reason: 'payment_header_too_large' }

  let decoded: string
  try { decoded = Buffer.from(header, 'base64').toString('utf8') } catch { return { ok: false, reason: 'payment_header_not_base64' } }

  let value: unknown
  try { value = JSON.parse(decoded) } catch { return { ok: false, reason: 'payment_header_not_json' } }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ok: false, reason: 'payment_header_not_an_object' }

  const payment = value as Record<string, unknown>
  if (payment.x402Version !== X402_VERSION) return { ok: false, reason: 'unsupported_x402_version' }
  if (typeof payment.scheme !== 'string' || payment.scheme !== 'exact') return { ok: false, reason: 'unsupported_scheme' }
  if (typeof payment.network !== 'string' || !NETWORKS.has(payment.network)) return { ok: false, reason: 'unsupported_network' }
  if (typeof payment.payload !== 'object' || payment.payload === null) return { ok: false, reason: 'missing_payload' }

  return { ok: true, payment: { x402Version: X402_VERSION, scheme: 'exact', network: payment.network, payload: payment.payload as Record<string, unknown> } }
}

/**
 * The checks that must pass before a facilitator is consulted, so a mismatched
 * payment is refused locally rather than settled and refunded.
 */
export function matchRequirement(payment: PaymentPayload, requirements: PaymentRequirement[]): PaymentRequirement | null {
  return requirements.find((requirement) =>
    requirement.scheme === payment.scheme && requirement.network === payment.network) ?? null
}

export type AcceptPaymentResult =
  | { ok: true; payer: string; transaction: string; amountPaid: string }
  | { ok: false; status: 402 | 409; reason: string }

/**
 * Verify, guard against replay, then settle -- in that order.
 *
 * The claim happens between verification and settlement deliberately. Claiming
 * after settlement would leave a window where a concurrent duplicate settles
 * twice; claiming before verification would let an invalid payload burn a
 * transaction identifier and lock out the legitimate retry.
 */
export async function acceptPayment(input: {
  payment: PaymentPayload
  requirements: PaymentRequirement[]
  facilitator: PaymentFacilitator
  replayGuard: ReplayGuard
}): Promise<AcceptPaymentResult> {
  const requirement = matchRequirement(input.payment, input.requirements)
  if (!requirement) return { ok: false, status: 402, reason: 'no_matching_requirement' }

  const verified = await input.facilitator.verify(input.payment, requirement)
  if (!verified.ok) return { ok: false, status: 402, reason: verified.reason }

  if (BigInt(verified.amountPaid) < BigInt(requirement.maxAmountRequired)) {
    return { ok: false, status: 402, reason: 'insufficient_amount' }
  }

  const claimed = await input.replayGuard.claim(verified.transaction)
  if (!claimed) return { ok: false, status: 409, reason: 'payment_already_used' }

  const settled = await input.facilitator.settle(input.payment, requirement)
  if (!settled.ok) return { ok: false, status: 402, reason: settled.reason }

  return { ok: true, payer: settled.payer, transaction: settled.transaction, amountPaid: settled.amountPaid }
}


/** The base64 challenge for the PAYMENT-REQUIRED header. */
export function encodeChallengeHeader(body: PaymentRequiredBody): string {
  return Buffer.from(JSON.stringify(body), 'utf8').toString('base64')
}

/**
 * Reads the signed payment from a request.
 *
 * Prefers the standard header and falls back to the pre-standard name, so an
 * agent built against earlier material still transacts rather than failing in
 * a way neither side can see.
 */
export function readPaymentSignature(headers: Headers): string | null {
  return headers.get(PAYMENT_SIGNATURE_HEADER) ?? headers.get(LEGACY_SIGNATURE_HEADER)
}

/** Settlement confirmation for the PAYMENT-RESPONSE header on a 200. */
export function encodePaymentResponse(result: { transaction: string; network: string; payer: string }): string {
  return Buffer.from(JSON.stringify({ success: true, ...result }), 'utf8').toString('base64')
}
