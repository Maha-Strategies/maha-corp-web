import { HTTPFacilitatorClient } from '@x402/core/server'

import type { PaymentFacilitator, PaymentPayload, PaymentRequirement, VerificationResult } from './protocol.ts'

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
}

/** Not a wallet address; the settlement provider's receiving address. */
export type SettlementConfig = {
  payTo: string
  network: string
  asset: string
}

function failure(reason: string): VerificationResult {
  return { ok: false, reason }
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

  const client = new HTTPFacilitatorClient({
    url: config.url,
    ...(config.authHeaders ? { createAuthHeaders: async () => config.authHeaders! } : {}),
  } as ConstructorParameters<typeof HTTPFacilitatorClient>[0])

  const call = async (
    operation: 'verify' | 'settle',
    payment: PaymentPayload,
    requirement: PaymentRequirement,
  ): Promise<VerificationResult> => {
    try {
      const response = await (client as unknown as Record<string, (a: unknown, b: unknown) => Promise<unknown>>)[operation](payment, requirement)
      return readResponse(operation, response)
    } catch (error) {
      // A facilitator that is unreachable or erroring must never read as a
      // successful payment.
      console.error(`x402 facilitator ${operation} failed:`, error instanceof Error ? error.name : 'unknown_error')
      return failure(`facilitator_${operation}_failed`)
    }
  }

  return {
    verify: (payment, requirement) => call('verify', payment, requirement),
    settle: (payment, requirement) => call('settle', payment, requirement),
  }
}

/**
 * Field names vary across facilitator implementations and protocol versions,
 * so each is read defensively. A response that does not clearly state success
 * is treated as a failure rather than assumed to be one shape or the other.
 */
export function readResponse(operation: 'verify' | 'settle', response: unknown): VerificationResult {
  if (typeof response !== 'object' || response === null) return failure(`facilitator_${operation}_malformed`)
  const body = response as Record<string, unknown>

  const succeeded = body.isValid === true || body.success === true || body.valid === true
  if (!succeeded) {
    const reason = body.invalidReason ?? body.errorReason ?? body.error ?? `facilitator_${operation}_rejected`
    return failure(typeof reason === 'string' ? reason : `facilitator_${operation}_rejected`)
  }

  const payer = firstString(body.payer, body.from, body.payerAddress)
  const transaction = firstString(body.transaction, body.txHash, body.transactionHash, body.nonce)
  const amountPaid = firstString(body.amountPaid, body.amount, body.value)

  // Without a transaction identifier there is nothing to record against, and
  // replay protection would silently do nothing.
  if (!transaction) return failure(`facilitator_${operation}_missing_transaction`)
  if (!payer) return failure(`facilitator_${operation}_missing_payer`)
  if (!amountPaid || !/^[0-9]+$/.test(amountPaid)) return failure(`facilitator_${operation}_missing_amount`)

  return { ok: true, payer, transaction, amountPaid }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}
