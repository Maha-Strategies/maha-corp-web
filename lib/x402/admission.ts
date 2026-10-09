import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'

// Pre-settlement idempotency for offers that create a job.
//
// The failure this closes: the proxy settles a payment and only then does the
// route deduplicate on (payer, clientRequestId). A payer whose first request
// timed out retries with a freshly signed authorization, pays a second time,
// and receives `idempotentReplay: true` -- a response asserting that no second
// charge happened, next to a ledger containing one. No amount of route-level
// checking fixes that, because the route runs after the money has moved.
//
// So the claim is taken between verification and settlement. Verification is
// what makes it possible: it yields the payer address, so the claim can be
// bound to a real identity rather than to something the caller asserts.

/** Headers a payer sends to make a request idempotent. */
export const IDEMPOTENCY_KEY_HEADER = 'x-maha-idempotency-key'
export const INPUT_HASH_HEADER = 'x-maha-input-hash'

export type AdmissionDecision =
  | { kind: 'proceed' }
  /** Settled before. Reuse the recorded transaction; do not settle again. */
  | { kind: 'already_paid'; transaction: string; paymentId?: string; network?: string }
  /** Another request holds the claim. Refused before anything settles. */
  | { kind: 'in_progress' }
  /** The key was reused with different input, resource or price. */
  | { kind: 'conflict' }
  | { kind: 'contradicted' }
  | { kind: 'unavailable' }

export type AdmissionGuard = {
  reserve(context: { payer: string }): Promise<AdmissionDecision>
  pending(context: { payer: string; paymentId: string; network: string }): Promise<boolean>
  reconcile(context: { payer: string; paymentId: string; network: string; state: 'unknown' | 'not_settled' | 'settled' | 'contradicted' | 'marker_failed'; transaction?: string }): Promise<boolean>
  settled(context: { payer: string; transaction: string }): Promise<boolean>
  released(context: { payer: string }): Promise<void>
}

export type AdmissionClaim = {
  offerId: string
  idempotencyKey: string
  inputHash: string
  resource: string
  amount: string
}

const SHA256 = /^sha256:[a-f0-9]{64}$/

/**
 * Reads the claim a payer declared, or explains why there is not one.
 *
 * Both values are required for an idempotent offer. The input hash is declared
 * rather than computed because the gateway never sees the body -- the proxy
 * forwards it untouched -- and a conflict has to be detectable *before*
 * settlement to be worth anything. The route then enforces the declaration
 * against the real body, so a caller cannot profit by declaring a hash it did
 * not send.
 */
export function readAdmissionClaim(
  headers: Headers,
  offer: { id: string; amount: string },
  resource: string,
): { ok: true; claim: AdmissionClaim } | { ok: false; reason: string } {
  const key = headers.get(IDEMPOTENCY_KEY_HEADER)?.trim() ?? ''
  const inputHash = headers.get(INPUT_HASH_HEADER)?.trim().toLowerCase() ?? ''

  if (!key) return { ok: false, reason: 'idempotency_key_required' }
  if (key.length < 8 || key.length > 120 || /[\r\n]/.test(key)) return { ok: false, reason: 'idempotency_key_malformed' }
  if (!SHA256.test(inputHash)) return { ok: false, reason: 'input_hash_required' }

  return { ok: true, claim: { offerId: offer.id, idempotencyKey: key, inputHash, resource, amount: offer.amount } }
}

type Ledger = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * Never fails open.
 *
 * An unreadable ledger returns `unavailable`, and the caller refuses before
 * settling. That costs a payer a retry; failing open would cost them a second
 * charge, and the whole point of this guard is that the second charge is the
 * thing we will not do.
 */
export function createAdmissionGuard(claim: AdmissionClaim, ledger?: Ledger | null): AdmissionGuard | null {
  const client = ledger !== undefined ? ledger : createAgentInquiryLedger() as unknown as Ledger | null
  if (!client) return null

  const recordRecovery: AdmissionGuard['reconcile'] = async (context) => {
    try {
      const { error } = await client.rpc('record_x402_admission_recovery', {
        p_offer_id: claim.offerId, p_payer: context.payer, p_idempotency_key: claim.idempotencyKey,
        p_input_hash: claim.inputHash, p_resource: claim.resource, p_amount: claim.amount,
        p_payment_id: context.paymentId, p_network: context.network, p_state: context.state,
        p_transaction: context.transaction ?? null,
      })
      if (!error) return true
    } catch { /* Keep the original reservation fail-closed. */ }
    console.error('x402 recovery journal write failed; operator reconciliation required', { offerId: claim.offerId, paymentId: context.paymentId, state: context.state })
    return false
  }

  return {
    async reserve({ payer }) {
      try {
        const { data, error } = await client.rpc('reserve_x402_admission', {
          p_offer_id: claim.offerId,
          p_payer: payer,
          p_idempotency_key: claim.idempotencyKey,
          p_input_hash: claim.inputHash,
          p_resource: claim.resource,
          p_amount: claim.amount,
        })
        if (error) return { kind: 'unavailable' }

        const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : data as Record<string, unknown> | null
        const decision = typeof row?.decision === 'string' ? row.decision : ''
        const transaction = typeof row?.payment_transaction === 'string' ? row.payment_transaction : ''

        if (decision === 'already_paid' || decision === 'in_progress') {
          const recovery = await client.rpc('read_x402_admission_recovery', {
            p_offer_id: claim.offerId, p_payer: payer, p_idempotency_key: claim.idempotencyKey,
            p_input_hash: claim.inputHash, p_resource: claim.resource, p_amount: claim.amount,
          })
          if (recovery.error) return { kind: 'unavailable' }
          const entry = (Array.isArray(recovery.data) ? recovery.data[0] : recovery.data) as Record<string, unknown> | null
          if (entry?.state === 'contradicted') return { kind: 'contradicted' }
          if ((entry?.state === 'settled' || entry?.state === 'marker_failed') && typeof entry.transaction === 'string' && entry.transaction) {
            return { kind: 'already_paid', transaction: entry.transaction,
              ...(typeof entry.payment_id === 'string' && typeof entry.network === 'string' ? { paymentId: entry.payment_id, network: entry.network } : {}) }
          }
        }
        if (decision === 'proceed') return { kind: 'proceed' }
        if (decision === 'already_paid' && transaction) return { kind: 'already_paid', transaction }
        // A settled row with no recorded transaction is a torn write. Treating
        // it as already paid would serve a job with no payment attached;
        // treating it as proceed would charge twice. Neither is acceptable, so
        // it is escalated as in-progress and a human can look.
        if (decision === 'already_paid') return { kind: 'in_progress' }
        if (decision === 'in_progress') return { kind: 'in_progress' }
        if (decision === 'conflict') return { kind: 'conflict' }
        return { kind: 'unavailable' }
      } catch {
        return { kind: 'unavailable' }
      }
    },

    async pending(context) {
      // Same journal RPC, but pending is written BEFORE the signed settlement.
      try {
        const { error } = await client.rpc('record_x402_admission_recovery', {
          p_offer_id: claim.offerId, p_payer: context.payer, p_idempotency_key: claim.idempotencyKey,
          p_input_hash: claim.inputHash, p_resource: claim.resource, p_amount: claim.amount,
          p_payment_id: context.paymentId, p_network: context.network, p_state: 'pending', p_transaction: null,
        })
        return !error
      } catch { return false }
    },
    reconcile: recordRecovery,

    async settled({ payer, transaction }) {
      try {
        const { error } = await client.rpc('settle_x402_admission', {
          p_offer_id: claim.offerId,
          p_payer: payer,
          p_idempotency_key: claim.idempotencyKey,
          p_transaction: transaction,
        })
        if (!error) return true
      } catch {
        // The payment is real whether or not this row records it. Losing the
        // marker means every later retry remains in-progress for operator
        // reconciliation. That is deliberately fail-closed: automatically
        // retaking an uncertain claim could charge the payer twice. Throwing here
        // would fail a request the payer has already paid for.
      }
      console.error('x402 admission marker failed; recover from journal', { offerId: claim.offerId, transaction })
      return false
    },

    async released({ payer }) {
      try {
        await client.rpc('release_x402_admission', {
          p_offer_id: claim.offerId,
          p_payer: payer,
          p_idempotency_key: claim.idempotencyKey,
        })
      } catch {
        // A claim left reserved remains fail-closed for operator reconciliation.
      }
    },
  }
}
