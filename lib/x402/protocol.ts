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

export type X402Network = `eip155:${number}` | `solana:${string}`

export type ResourceInfo = {
  url: string
  description?: string
  mimeType?: string
  serviceName?: string
  tags?: string[]
  iconUrl?: string
}

export type PaymentRequirement = {
  scheme: 'exact'
  network: X402Network
  /** Smallest indivisible unit of the asset, as a decimal string. USDC has six. */
  amount: string
  /** The receiving address. Belongs to the settlement provider, not to us. */
  payTo: string
  maxTimeoutSeconds: number
  /** Contract address of the accepted asset, e.g. USDC on the chosen network. */
  asset: string
  /**
   * Scheme-specific parameters. For `exact` on EVM this carries the token's
   * EIP-712 domain, `{ name, version }`, and it is not optional in practice:
   * the facilitator reconstructs the signing digest from it and answers
   * `invalid_exact_evm_missing_eip712_domain` without it. Verified against the
   * live facilitator -- omitting it refuses every payment.
   */
  extra?: Record<string, string>
}

export type PaymentRequiredBody = {
  x402Version: 2
  resource: ResourceInfo
  accepts: PaymentRequirement[]
  extensions?: Record<string, unknown>
  error: string
}

export type PaymentPayload = {
  x402Version: number
  resource?: ResourceInfo
  accepted: PaymentRequirement
  payload: Record<string, unknown>
  extensions?: Record<string, unknown>
}

/**
 * What a facilitator can actually tell us, which is less than it first appears.
 *
 * `verify` answers one question -- is this payload a valid authorization for
 * the requirements we sent -- and returns the payer. It does NOT return a
 * transaction hash or an amount, because nothing has been submitted to the
 * chain yet. Only `settle` produces a transaction.
 *
 * This matters more than it sounds. The amount is not checked locally against
 * the verify response, because there is no amount in it; the facilitator is
 * given `amount` in the requirements and answers `isValid: false`
 * when the signed payload does not satisfy them. Re-checking a field the
 * protocol never sends is how the first version of this file managed to refuse
 * every payment it was given.
 */
export type VerifyResult =
  | { ok: true; payer: string }
  | { ok: false; reason: string }

export type SettleResult =
  | { ok: true; payer: string; transaction: string }
  | { ok: false; reason: string }

/** Injectable so the protocol is testable without a facilitator or a network. */
export type PaymentFacilitator = {
  verify(payment: PaymentPayload, requirement: PaymentRequirement): Promise<VerifyResult>
  settle(payment: PaymentPayload, requirement: PaymentRequirement): Promise<SettleResult>
}

/**
 * A payment is a bearer instrument: whoever holds the payload can present it.
 * Without a record of what has already been spent, the same payload buys
 * unlimited calls. This mirrors the Stripe webhook event table, where the
 * identifier is claimed in the same transaction as the value it releases.
 *
 * Three outcomes, not two.
 *
 * `unavailable` is separated from `duplicate` deliberately. Both withhold the
 * resource, so collapsing them looks harmless -- but they mean opposite things
 * to whoever is reading the response. A first-ever payment answered "already
 * used" because a table is missing sends the operator hunting for a replay
 * that never happened, and the caller cannot tell a permanent refusal from one
 * worth retrying.
 */
export type ClaimOutcome = 'claimed' | 'duplicate' | 'unavailable'

export type ReplayGuard = {
  /**
   * Claims this payment if it has not been seen before.
   *
   * Keyed on `paymentId` -- a hash of the signed payload -- rather than on a
   * settlement transaction hash. The hash is the only identifier that exists
   * before settlement, which is where the claim has to happen; and it is the
   * right one regardless, because it identifies the authorization the payer
   * signed. Two presentations of one signed payload are the replay this
   * guards, and they share a paymentId whether or not either ever settles.
   */
  claim(payment: { paymentId: string; payer: string }): Promise<ClaimOutcome>
  /** Records the on-chain result once settlement returns. Never gates access. */
  recordSettlement(settlement: {
    paymentId: string
    transaction: string
    /** What reading the chain established, so an unconfirmed settlement is a
     *  row a reconciliation sweep can find rather than an assumption. */
    confirmation?: { status: string; blockNumber?: number; amount?: string; reason?: string }
  }): Promise<void>
}

/**
 * Reads the chain to check the facilitator told the truth.
 *
 * Injected so the protocol stays testable without a node, and optional so a
 * deployment with no RPC endpoint degrades to the previous behaviour rather
 * than refusing every payment.
 */
export type SettlementConfirmer = (settlement: { transaction: string; payer: string }) => Promise<{
  status: 'confirmed' | 'contradicted' | 'indeterminate'
  blockNumber?: number
  amount?: string
  reason?: string
}>

/**
 * A stable identifier for a signed payment authorization.
 *
 * Canonicalized with sorted keys so that two encodings of the same payload --
 * different key order, different whitespace -- cannot present as two distinct
 * payments and buy the resource twice.
 */
export async function paymentId(payment: PaymentPayload): Promise<string> {
  const canonical = stableStringify({ accepted: payment.accepted, payload: payment.payload })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

export const X402_VERSION = 2 as const

export const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED'
export const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE'
export const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE'
/** Pre-standard name. Read, never written. */
const LEGACY_SIGNATURE_HEADER = 'X-PAYMENT'

const NETWORK = /^(?:eip155:[1-9][0-9]*|solana:[A-Za-z0-9]+)$/
const AMOUNT = /^[0-9]{1,32}$/

export function buildPaymentRequired(
  requirements: PaymentRequirement[],
  resource: ResourceInfo,
  error = 'Payment required.',
  extensions?: Record<string, unknown>,
): PaymentRequiredBody {
  if (requirements.length === 0) throw new Error('At least one payment requirement is required.')
  for (const requirement of requirements) assertRequirement(requirement)
  assertResource(resource)
  return { x402Version: X402_VERSION, resource, accepts: requirements, ...(extensions ? { extensions } : {}), error }
}

function assertRequirement(requirement: PaymentRequirement): void {
  if (!NETWORK.test(requirement.network)) throw new Error(`Unsupported network: ${requirement.network}`)
  if (!AMOUNT.test(requirement.amount)) throw new Error('amount must be an integer string in the asset\'s smallest unit.')
  if (requirement.amount === '0') throw new Error('amount must be greater than zero.')
  if (!requirement.payTo.trim()) throw new Error('payTo is required.')
  if (!requirement.asset.trim()) throw new Error('asset is required.')
  if (requirement.maxTimeoutSeconds <= 0 || requirement.maxTimeoutSeconds > 300) throw new Error('maxTimeoutSeconds must be between 1 and 300.')
}

function assertResource(resource: ResourceInfo): void {
  let url: URL
  try { url = new URL(resource.url) } catch { throw new Error('resource.url must be an absolute URL.') }
  if (url.protocol !== 'https:') throw new Error('resource.url must be https.')
}

/**
 * Decodes the X-PAYMENT header. Rejects rather than throws, because a
 * malformed payload is an ordinary client error and must not become a 500.
 */
export function parsePaymentHeader(header: string | null): { ok: true; payment: PaymentPayload } | { ok: false; reason: string } {
  if (!header?.trim()) return { ok: false, reason: 'missing_payment_header' }
  // Bazaar v2 requires clients to echo the typed discovery extension. Keep the
  // application cap aligned with Vercel's 16 KB per-header ceiling while still
  // rejecting oversized input before base64 decoding or JSON parsing.
  if (header.length > 16_384) return { ok: false, reason: 'payment_header_too_large' }

  let decoded: string
  try { decoded = Buffer.from(header, 'base64').toString('utf8') } catch { return { ok: false, reason: 'payment_header_not_base64' } }

  let value: unknown
  try { value = JSON.parse(decoded) } catch { return { ok: false, reason: 'payment_header_not_json' } }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ok: false, reason: 'payment_header_not_an_object' }

  const payment = value as Record<string, unknown>
  if (payment.x402Version !== X402_VERSION) return { ok: false, reason: 'unsupported_x402_version' }
  if (typeof payment.accepted !== 'object' || payment.accepted === null) return { ok: false, reason: 'missing_accepted_requirement' }
  const accepted = payment.accepted as Record<string, unknown>
  if (accepted.scheme !== 'exact') return { ok: false, reason: 'unsupported_scheme' }
  if (typeof accepted.network !== 'string' || !NETWORK.test(accepted.network)) return { ok: false, reason: 'unsupported_network' }
  if (typeof accepted.amount !== 'string' || !AMOUNT.test(accepted.amount)) return { ok: false, reason: 'invalid_amount' }
  if (typeof accepted.asset !== 'string' || typeof accepted.payTo !== 'string' || typeof accepted.maxTimeoutSeconds !== 'number') {
    return { ok: false, reason: 'invalid_accepted_requirement' }
  }
  if (typeof payment.payload !== 'object' || payment.payload === null) return { ok: false, reason: 'missing_payload' }

  return {
    ok: true,
    payment: {
      x402Version: X402_VERSION,
      ...(typeof payment.resource === 'object' && payment.resource !== null ? { resource: payment.resource as ResourceInfo } : {}),
      accepted: accepted as PaymentRequirement,
      payload: payment.payload as Record<string, unknown>,
      ...(typeof payment.extensions === 'object' && payment.extensions !== null ? { extensions: payment.extensions as Record<string, unknown> } : {}),
    },
  }
}

/**
 * The checks that must pass before a facilitator is consulted, so a mismatched
 * payment is refused locally rather than settled and refunded.
 */
export function matchRequirement(payment: PaymentPayload, requirements: PaymentRequirement[]): PaymentRequirement | null {
  return requirements.find((requirement) =>
    requirement.scheme === payment.accepted.scheme &&
    requirement.network === payment.accepted.network &&
    requirement.asset.toLowerCase() === payment.accepted.asset.toLowerCase() &&
    requirement.amount === payment.accepted.amount &&
    requirement.payTo.toLowerCase() === payment.accepted.payTo.toLowerCase() &&
    requirement.maxTimeoutSeconds === payment.accepted.maxTimeoutSeconds) ?? null
}

/**
 * v2 moved the resource and extensions beside `accepted`. Verify those
 * server-declared terms before forwarding the payload so a client cannot
 * rewrite the URL or the Bazaar schema that the facilitator catalogs.
 *
 * The resource is always compared in full. Exact resource binding is what
 * stops a challenge issued for one endpoint being answered against another,
 * and nothing below relaxes it.
 *
 * The declaration may be bound either by full echo or by digest, and the
 * second form is a necessity rather than a convenience. A payer echoes the
 * declaration back inside PAYMENT-SIGNATURE, and that header has a hard 16 KB
 * ceiling at the platform edge. A full echo costs ~15.9 KB for the entry
 * compression offer and ~26.6 KB for deep evaluation -- so a richly documented
 * offer is not merely close to the limit, it is unpayable, and the failure
 * arrives as `payment_header_too_large` on a payload the payer assembled
 * correctly from our own challenge.
 *
 * Binding on the digest is not a weaker check. The digest is taken over the
 * canonicalised declaration -- resource, accepts, and every extension -- so a
 * payer presenting a digest equal to ours has demonstrated exactly what a full
 * echo demonstrates: that it read the declaration this server published and
 * not a substitute. What it removes is the need to carry 26 KB of JSON schema
 * through a 16 KB header to prove it.
 */
export function matchesPaymentContext(
  payment: PaymentPayload,
  resource: ResourceInfo,
  extensions?: Record<string, unknown>,
): boolean {
  if (stableStringify(payment.resource) !== stableStringify(resource)) return false
  if (!extensions) return true

  // The full echo. Still the common case, and still accepted unchanged.
  if (stableStringify(payment.extensions) === stableStringify(extensions)) return true

  return matchesDeclarationDigest(payment.extensions, extensions)
}

const DIGEST_EXTENSION = 'declaration-integrity'

/**
 * Accepts a payer that echoed only the integrity extension.
 *
 * Deliberately strict about what "only" means: the presented map must contain
 * the integrity entry and nothing else. Allowing a partial echo with arbitrary
 * extra keys would let a client silently drop the extensions it dislikes -- a
 * price annotation, a capability boundary -- while still presenting a valid
 * digest, and the server would have no way to notice which ones went missing.
 */
function matchesDeclarationDigest(
  presented: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
): boolean {
  if (!presented || typeof presented !== 'object') return false

  const presentedKeys = Object.keys(presented)
  if (presentedKeys.length !== 1 || presentedKeys[0] !== DIGEST_EXTENSION) return false

  const ours = expected[DIGEST_EXTENSION] as { declarationDigest?: unknown } | undefined
  const theirs = presented[DIGEST_EXTENSION] as { declarationDigest?: unknown } | undefined
  if (typeof ours?.declarationDigest !== 'string' || typeof theirs?.declarationDigest !== 'string') return false

  // Both sides are a fixed-length public value from the challenge, so a plain
  // comparison leaks nothing an attacker did not already receive.
  return ours.declarationDigest === theirs.declarationDigest
}

export type AcceptPaymentResult =
  | { ok: true; payer: string; transaction: string; amountPaid: string }
  // 502 is the chain contradicting the facilitator: an upstream told us
  // something the ledger of record does not support.
  | { ok: false; status: 402 | 409 | 502 | 503; reason: string }

/**
 * Verify, guard against replay, then settle -- in that order.
 *
 * The claim happens between verification and settlement deliberately. Claiming
 * after settlement would leave a window where a concurrent duplicate settles
 * twice; claiming before verification would let an invalid payload burn an
 * identifier that the legitimate retry needs.
 *
 * The amount reported back is `amount`, not something the
 * facilitator returned. It is the amount the payer signed for and the amount
 * the facilitator validated the payload against, and no step in this protocol
 * reports a settled figure independently of it.
 */
export async function acceptPayment(input: {
  payment: PaymentPayload
  requirements: PaymentRequirement[]
  facilitator: PaymentFacilitator
  replayGuard: ReplayGuard
  confirmOnChain?: SettlementConfirmer
}): Promise<AcceptPaymentResult> {
  const requirement = matchRequirement(input.payment, input.requirements)
  if (!requirement) return { ok: false, status: 402, reason: 'no_matching_requirement' }

  const verified = await input.facilitator.verify(input.payment, requirement)
  if (!verified.ok) return { ok: false, status: 402, reason: verified.reason }

  const id = await paymentId(input.payment)
  const claimed = await input.replayGuard.claim({ paymentId: id, payer: verified.payer })
  // Nothing has settled yet, so a refusal here costs the payer nothing -- they
  // still hold their signed authorization and can present it again.
  if (claimed === 'unavailable') return { ok: false, status: 503, reason: 'x402_ledger_unavailable' }
  if (claimed === 'duplicate') return { ok: false, status: 409, reason: 'payment_already_used' }

  const settled = await input.facilitator.settle(input.payment, requirement)
  if (!settled.ok) return { ok: false, status: 402, reason: settled.reason }

  // Independent confirmation, where a node is configured. Until this point
  // "settled" means the facilitator said so; this is the only step that checks.
  const confirmation = input.confirmOnChain
    ? await input.confirmOnChain({ transaction: settled.transaction, payer: settled.payer })
    : undefined

  // Recorded either way, including when the chain could not be read, so an
  // unconfirmed payment is a row someone can find rather than an assumption.
  await input.replayGuard.recordSettlement({ paymentId: id, transaction: settled.transaction, confirmation })

  // Only an active contradiction withholds. The payer's money has already
  // moved by now, so refusing because a node was unreachable would take
  // payment and give nothing -- the one outcome worse than serving
  // unconfirmed. A chain that positively disagrees is different in kind: it
  // means the settlement we were told about did not happen as described.
  if (confirmation?.status === 'contradicted') {
    // Not a 402. Re-challenging would invite a second payment for a resource
    // whose first payment the facilitator claims already settled, and the
    // caller can do nothing to fix an upstream disagreement.
    return { ok: false, status: 502, reason: `settlement_contradicted:${confirmation.reason ?? 'unknown'}` }
  }

  return { ok: true, payer: settled.payer, transaction: settled.transaction, amountPaid: requirement.amount }
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
