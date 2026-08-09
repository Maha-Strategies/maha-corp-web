// Turning a canary failure into something that can be read three days later.
//
// The failure this exists to prevent is the one that actually happened: a run
// wrote `{"error":"facilitator_verify_failed"}` and nothing else, and that one
// string is compatible with an unreachable host, a rejected signature, an
// expired authorization, a revoked credential and a schema the facilitator
// dislikes. Those need opposite responses, and distinguishing them took a day
// of live probing that the evidence should have answered directly.
//
// Everything here is safe to upload as a build artifact. No signature, no
// private key, no credential, no authorization header, and the nonce appears
// only as a digest -- enough to tell two attempts apart or recognise a replay,
// never enough to reuse.

import { recoverTypedDataAddress } from 'viem'

import type { TransferAuthorization, TypedDataRequest } from './client.ts'

export type CanaryFailure = {
  /** Machine-readable code, from the seller's refusal where it gave one. */
  errorCode: string
  /** HTTP status of the refusal. Absent when the request never completed. */
  httpStatus?: number
  /** Which half of the payment failed, as far as the buyer can observe. */
  operation: 'discovery' | 'challenge' | 'signing' | 'verify' | 'settle' | 'delivery'
  /** The seller's or facilitator's own words, truncated. */
  providerReason?: string
  /** The signed window, so an expiry can be told apart from a rejection. */
  authorization?: { validAfter: string; validBefore: string; nonceHash: string }
  /** Whether money is known to have moved. Assume nothing when absent. */
  settled?: boolean
}

/** Truncated SHA-256 of the nonce. Identifies an attempt; cannot authorize one. */
export async function hashNonce(nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * Recover the signer locally and refuse to send if it is not the payer.
 *
 * A signature that recovers to the wrong address is refused by the facilitator
 * anyway, but only after a round trip that reports it as a generic failure.
 * Checking here converts a confusing remote rejection into a local assertion
 * naming both addresses, and costs one elliptic-curve operation.
 */
export async function assertRecoverableSignature(
  typedData: TypedDataRequest,
  signature: string,
  expectedSigner: string,
): Promise<void> {
  const recovered = await recoverTypedDataAddress({
    domain: { ...typedData.domain, verifyingContract: typedData.domain.verifyingContract as `0x${string}` },
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message as never,
    signature: signature as `0x${string}`,
  })
  if (recovered.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error(`Signature recovers to ${recovered}, not the expected payer ${expectedSigner}. Nothing was sent.`)
  }
}

async function authorizationEvidence(authorization: TransferAuthorization | undefined) {
  if (!authorization) return undefined
  return {
    validAfter: String(authorization.validAfter),
    validBefore: String(authorization.validBefore),
    nonceHash: await hashNonce(authorization.nonce),
  }
}

/**
 * Classify a thrown error into evidence.
 *
 * The operation is inferred from what the seller said rather than guessed: a
 * 409 means an authorization was already spent, so settlement happened; a 402
 * carrying a facilitator reason means verification refused it and nothing was
 * spent. `settled` is left undefined wherever that cannot be established,
 * because "unknown" and "no" lead to different next actions and conflating
 * them is how a double spend gets authorized.
 */
export async function failureEvidenceFor(error: unknown): Promise<CanaryFailure> {
  if (!isPaymentError(error)) {
    return { errorCode: 'canary_error', operation: 'discovery', providerReason: truncate(messageOf(error)) }
  }

  const authorization = await authorizationEvidence(error.authorization)
  const base = {
    errorCode: error.code,
    httpStatus: error.status,
    providerReason: truncate(error.providerReason ?? error.message),
    ...(authorization ? { authorization } : {}),
  }

  if (error.code === 'payment_already_used') return { ...base, operation: 'settle', settled: true }
  if (error.code === 'resource_at_capacity') return { ...base, operation: 'delivery', settled: true }
  if (error.code === 'signature_rejected') return { ...base, operation: 'signing', settled: false }
  if (error.code === 'ledger_unavailable') return { ...base, operation: 'settle', settled: false }
  if (error.code === 'payment_rejected') return { ...base, operation: 'verify', settled: false }
  return { ...base, operation: 'challenge', settled: false }
}

function isPaymentError(error: unknown): error is import('./client.ts').X402PaymentError {
  return error instanceof Error && error.name === 'X402PaymentError'
}

const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
const truncate = (value: string | undefined) => value?.trim() ? value.trim().slice(0, 400) : undefined
