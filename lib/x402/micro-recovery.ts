import { z } from 'zod'
import { createAdmissionGuard, type AdmissionClaim, type AdmissionGuard } from './admission.ts'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'

type Ledger = NonNullable<Parameters<typeof createAdmissionGuard>[1]>
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const recordSchema = z.object({ state: z.enum(['paid', 'pending', 'unknown', 'contradicted', 'not_settled', 'expired']),
  response_digest: hash.nullable(), transaction: z.string().min(1).max(200).nullable(),
  network: z.string().min(1).max(100).nullable(), amount: z.union([z.string().regex(/^[0-9]+$/), z.number().int().positive()]),
}).strict()
export type MicroRecoveryRecord = z.infer<typeof recordSchema>
export type MicroRecoveryLookup = { offerId: string; payer: string; purchaseId: string; inputHash: string; secretHash: string }
export type MicroRecoveryReader = (lookup: MicroRecoveryLookup) => Promise<MicroRecoveryRecord | null>

/** Same durable payment journal as paid admission; no second settlement path. */
export function createMicroAdmissionGuard(claim: AdmissionClaim, binding: { secretHash: string; responseDigest: string }, ledger?: Ledger | null): AdmissionGuard | null {
  const client = ledger !== undefined ? ledger : createAgentInquiryLedger() as Ledger | null
  const base = createAdmissionGuard(claim, client)
  if (!client || !base) return null
  const canonical = <T extends { payer: string }>(context: T): T => ({ ...context, payer: context.payer.toLowerCase() })
  return {
    pending: context => base.pending(canonical(context)),
    reconcile: context => base.reconcile(canonical(context)),
    settled: context => base.settled(canonical(context)),
    released: context => base.released(canonical(context)),
    async reserve({ payer: providedPayer }) {
    const payer = providedPayer.toLowerCase()
    try {
      const result = await client.rpc('reserve_x402_micro_purchase', {
        p_offer_id: claim.offerId, p_payer: payer, p_idempotency_key: claim.idempotencyKey,
        p_input_hash: claim.inputHash, p_resource: claim.resource, p_amount: claim.amount,
        p_secret_hash: binding.secretHash, p_response_digest: binding.responseDigest,
      })
      if (result.error) return { kind: 'unavailable' }
      const row = (Array.isArray(result.data) ? result.data[0] : result.data) as { decision?: string } | null
      if (row?.decision === 'proceed') return { kind: 'proceed' }
      if (row?.decision === 'conflict') return { kind: 'conflict' }
      if (!['already_paid', 'in_progress'].includes(row?.decision ?? '')) return { kind: 'unavailable' }
      // Consult the existing pending/unknown/settled journal, including torn markers.
      return await base.reserve({ payer })
    } catch { return { kind: 'unavailable' } }
  } }
}

export function createMicroRecoveryReader(ledger?: Ledger | null): MicroRecoveryReader {
  return async lookup => {
    // Free discovery must not depend on valid private database configuration.
    const client = ledger !== undefined ? ledger : createAgentInquiryLedger() as Ledger | null
    if (!client) throw new Error('micro_recovery_unavailable')
    const result = await client.rpc('read_x402_micro_purchase', {
      p_offer_id: lookup.offerId, p_payer: lookup.payer.toLowerCase(), p_idempotency_key: lookup.purchaseId,
      p_input_hash: lookup.inputHash, p_secret_hash: lookup.secretHash,
    })
    if (result.error) throw new Error('micro_recovery_unavailable')
    const row = Array.isArray(result.data) ? result.data[0] : result.data
    if (row === undefined || row === null) return null
    return recordSchema.parse(row)
  }
}
