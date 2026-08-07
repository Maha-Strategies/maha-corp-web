import { HTTPFacilitatorClient } from '@x402/core/server'

import type { PaymentFacilitator, PaymentPayload, PaymentRequirement, SettleResult, VerifyResult } from './protocol.ts'
import { createCdpFacilitatorAuthHeaders, type CdpApiCredentials } from './cdp-auth.ts'

// Adapts the official facilitator client to this codebase's interface.
//
// Package choice was not obvious and is worth recording. The `x402` package
// bundles the buyer surface -- paywall, wallet connectors -- and brings
// MetaMask, WalletConnect, Reown AppKit and wagmi with it: twenty-four
// advisories, two of them high, in the production tree of a payment API.
// `@coinbase/x402` is lighter but depends on @coinbase/cdp-sdk, which pins
// axios at an exact version inside a high-severity advisory range with no
// published fix.
//
// `@x402/core` is the seller-side package. It carries the facilitator client,
// the schemas, and one dependency, with no advisories. A seller using a
// facilitator verifies signatures and never touches chain infrastructure, so
// none of the wallet surface was ever needed here.

export type FacilitatorConfig = {
  /** Facilitator base URL. CDP's hosted facilitator, or a self-hosted one. */
  url: string
  /** Sent on every facilitator request when the facilitator requires auth. */
  authHeaders?: Record<string, string>
  /** CDP credentials used to mint a fresh request-bound JWT for each call. */
  cdpCredentials?: CdpApiCredentials
}

/** Not a wallet address; the settlement provider's receiving address. */
export type SettlementConfig = {
  payTo: string
  network: string
  asset: string
}

function failure(reason: string): { ok: false; reason: string } {
  return { ok: false, reason }
}

/**
 * `HTTPFacilitatorClient` throws typed errors for ordinary verifier and
 * settlement rejections. Preserve their machine-readable reason instead of
 * collapsing every non-2xx response into a transport failure.
 *
 * This is structural rather than `instanceof`: Next.js can bundle two copies
 * of a package across route chunks, while the public error fields remain the
 * stable contract.
 */
export function facilitatorRejectionReason(operation: 'verify' | 'settle', error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const candidate = error as Error & {
    invalidReason?: unknown
    invalidMessage?: unknown
    errorReason?: unknown
    errorMessage?: unknown
  }
  const reason = operation === 'verify' ? candidate.invalidReason : candidate.errorReason
  if (typeof reason !== 'string' || !reason.trim()) return null
  const message = operation === 'verify' ? candidate.invalidMessage : candidate.errorMessage
  return typeof message === 'string' && message.trim()
    ? `${reason.trim()}: ${message.trim()}`
    : reason.trim()
}

/**
 * Everything knowable about a thrown facilitator call.
 *
 * The SDK collapses transport failures, non-2xx responses and schema
 * mismatches into errors whose `name` is a bare `Error`, and the caller sees
 * the same 402 for all of them. That is not enough to act on: a DNS failure, a
 * runtime that blocks the egress, and a facilitator returning HTML instead of
 * JSON all look identical from the log line.
 *
 * So two things happen here. The error is unwrapped down its `cause` chain,
 * which is where `fetch` puts the real reason. Then, because the SDK has
 * already discarded the response, the same endpoint is called again with a
 * plain fetch purely to record what it actually answers -- status,
 * content-type, and the first of the body. That second call verifies nothing
 * and settles nothing; it exists to turn "Error" into a fact.
 *
 * Bodies and stacks are logged only when X402_FACILITATOR_DIAGNOSTICS is
 * 'true'. A facilitator's error text is not a field we control, and this runs
 * on a path that has a payer's address in scope.
 */
async function reportFailure(
  operation: 'verify' | 'settle',
  error: unknown,
  config: FacilitatorConfig,
  payment: PaymentPayload,
  requirement: PaymentRequirement,
): Promise<void> {
  const verbose = process.env.X402_FACILITATOR_DIAGNOSTICS?.trim() === 'true'

  const chain: string[] = []
  let current: unknown = error
  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    const code = (current as { code?: unknown }).code
    chain.push(`${current.name}${code ? `[${code}]` : ''}: ${current.message.slice(0, 300)}`)
    current = current.cause
  }
  if (chain.length === 0) chain.push(`non-error thrown: ${String(error).slice(0, 200)}`)

  const endpoint = `${config.url.replace(/\/$/, '')}/${operation}`
  console.error(`x402 facilitator ${operation} failed`, JSON.stringify({
    endpoint,
    scheme: requirement.scheme,
    network: requirement.network,
    // Whether we sent the EIP-712 domain at all. Its absence is answered with
    // invalid_exact_evm_missing_eip712_domain and refuses every payment.
    sentExtra: Object.keys(requirement.extra ?? {}),
    x402Version: payment.x402Version,
    errorChain: chain,
    ...(verbose && error instanceof Error ? { stack: error.stack?.split('\n').slice(0, 8) } : {}),
  }))

  // What does that endpoint actually answer? The SDK threw the response away.
  try {
    const diagnosticHeaders = config.cdpCredentials
      ? (await createCdpFacilitatorAuthHeaders(config.url, config.cdpCredentials))[operation]
      : config.authHeaders
    const probe = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(diagnosticHeaders ?? {}) },
      body: JSON.stringify({ x402Version: payment.x402Version, paymentPayload: payment, paymentRequirements: requirement }),
      cache: 'no-store',
    })
    const body = await probe.text()
    console.error('x402 facilitator probe', JSON.stringify({
      endpoint,
      status: probe.status,
      contentType: probe.headers.get('content-type'),
      bodyBytes: body.length,
      ...(verbose ? { body: body.slice(0, 1_000) } : { bodyPreview: body.slice(0, 200) }),
    }))
  } catch (probeError) {
    // The probe failing the same way is itself the answer: the runtime cannot
    // reach the host, and nothing about the payload is responsible.
    const detail = probeError instanceof Error
      ? `${probeError.name}: ${probeError.message.slice(0, 300)}${probeError.cause instanceof Error ? ` <- ${probeError.cause.name}: ${probeError.cause.message.slice(0, 200)}` : ''}`
      : String(probeError).slice(0, 200)
    console.error('x402 facilitator probe could not reach the host', JSON.stringify({ endpoint, detail }))
  }
}

/**
 * The facilitator answers one question: is this payment real and settled. It
 * does not know the price, the resource, or whether the payment has already
 * been spent against this API. Those checks live in `acceptPayment` and the
 * replay guard, and must not be delegated here.
 */
export function createFacilitator(config: FacilitatorConfig): PaymentFacilitator {
  if (!config.url?.trim()) throw new Error('Facilitator url is required.')
  const url = new URL(config.url)
  if (url.protocol !== 'https:') throw new Error('Facilitator url must be https.')

  const createAuthHeaders = config.cdpCredentials
    ? () => createCdpFacilitatorAuthHeaders(config.url, config.cdpCredentials!)
    : config.authHeaders
      ? async () => ({
          verify: config.authHeaders!,
          settle: config.authHeaders!,
          supported: config.authHeaders!,
        })
      : undefined

  const client = new HTTPFacilitatorClient({
    url: config.url,
    ...(createAuthHeaders ? { createAuthHeaders } : {}),
  })

  type CallResult =
    | { kind: 'response'; response: unknown }
    | { kind: 'rejection'; reason: string }
    | { kind: 'transport-failure' }

  const call = async (operation: 'verify' | 'settle', payment: PaymentPayload, requirement: PaymentRequirement): Promise<CallResult> => {
    try {
      const response = await (client as unknown as Record<string, (a: unknown, b: unknown) => Promise<unknown>>)[operation](payment, requirement)
      return { kind: 'response', response }
    } catch (error) {
      const rejection = facilitatorRejectionReason(operation, error)
      if (rejection) {
        console.warn(`x402 facilitator ${operation} rejected payment`, JSON.stringify({
          scheme: requirement.scheme,
          network: requirement.network,
          x402Version: payment.x402Version,
          reason: rejection,
        }))
        return { kind: 'rejection', reason: rejection }
      }
      // A facilitator that is unreachable or erroring must never read as a
      // successful payment.
      await reportFailure(operation, error, config, payment, requirement)
      return { kind: 'transport-failure' }
    }
  }

  return {
    async verify(payment, requirement): Promise<VerifyResult> {
      const result = await call('verify', payment, requirement)
      if (result.kind === 'rejection') return failure(result.reason)
      if (result.kind === 'transport-failure') return failure('facilitator_verify_failed')
      return readResponse('verify', result.response)
    },
    async settle(payment, requirement): Promise<SettleResult> {
      const result = await call('settle', payment, requirement)
      if (result.kind === 'rejection') return failure(result.reason)
      if (result.kind === 'transport-failure') return failure('facilitator_settle_failed')
      return readResponse('settle', result.response)
    },
  }
}

/**
 * The two operations return genuinely different shapes, and conflating them was
 * a real bug: `verify` yields `{ isValid, payer }` and nothing else, because no
 * chain transaction exists yet. Demanding a transaction hash from it refuses
 * every payment, including valid ones. Only `settle` carries a transaction.
 *
 * Field names still vary across implementations and protocol versions, so each
 * is read defensively, and a response that does not clearly state success is
 * treated as a failure rather than assumed to be one shape or the other.
 */
export function readResponse(operation: 'verify', response: unknown): VerifyResult
export function readResponse(operation: 'settle', response: unknown): SettleResult
export function readResponse(operation: 'verify' | 'settle', response: unknown): VerifyResult | SettleResult {
  if (typeof response !== 'object' || response === null) return failure(`facilitator_${operation}_malformed`)
  const body = response as Record<string, unknown>

  const succeeded = body.isValid === true || body.success === true || body.valid === true
  if (!succeeded) {
    const reason = body.invalidReason ?? body.errorReason ?? body.error ?? `facilitator_${operation}_rejected`
    return failure(typeof reason === 'string' ? reason : `facilitator_${operation}_rejected`)
  }

  const payer = firstString(body.payer, body.from, body.payerAddress)
  if (!payer) return failure(`facilitator_${operation}_missing_payer`)
  if (operation === 'verify') return { ok: true, payer }

  const transaction = firstString(body.transaction, body.txHash, body.transactionHash)
  // Settlement with no transaction identifier leaves nothing to reconcile
  // against the chain, so it is not treated as a settlement.
  if (!transaction) return failure('facilitator_settle_missing_transaction')

  return { ok: true, payer, transaction }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}
