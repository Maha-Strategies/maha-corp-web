import type { ClaimOutcome, PaymentRequirement, ReplayGuard } from './protocol.ts'

// The database side of replay protection. The facilitator prevents the same
// payment settling twice on-chain; this prevents the same settled payment
// being presented twice to this API. Both are needed, and only the second is
// ours.
//
// The claim is keyed on a hash of the signed payload, not on a settlement
// transaction hash. That is forced by the protocol -- `verify` returns no
// transaction, and the claim has to happen before `settle` or two concurrent
// duplicates both settle -- and it is the better key anyway: it identifies the
// authorization the payer signed, which is the thing being replayed.
//
// Settlement is recorded afterwards, in a second append-only table. It cannot
// be written back onto the claim row, because UPDATE is revoked on these
// ledgers by design, and that constraint is worth more than the convenience of
// keeping one row.

type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }

/** The parts known before the facilitator answers. */
export type SettlementContext = {
  network: string
  asset: string
}

/**
 * A guard that fails closed.
 *
 * If the claim cannot be recorded -- the database is unreachable, the migration
 * is missing, the role lacks execute -- the resource is withheld. The
 * alternative is serving paid resources with no record of payment, which is
 * worse than refusing a legitimate caller who can retry: a payer who is wrongly
 * refused still holds their signed authorization, and nothing has settled, but
 * a resource served without a record cannot be recovered.
 *
 * It is reported as `unavailable` rather than `duplicate` so the refusal says
 * what actually happened.
 */
export function createReplayGuard(ledger: Ledger, context: SettlementContext, requirement: PaymentRequirement): ReplayGuard {
  return {
    async claim(payment): Promise<ClaimOutcome> {
      const { data, error } = await ledger.rpc('claim_x402_payment', {
        p_payment_id: payment.paymentId,
        p_network: context.network,
        // The requirement's resource and price, never anything the caller
        // supplied. The facilitator has already validated the signed payload
        // against these exact requirements, so they are the authoritative
        // record of what was bought and for how much.
        p_resource: requirement.resource,
        p_payer: payment.payer,
        p_amount_paid: requirement.maxAmountRequired,
        p_asset: context.asset,
      })
      if (error) {
        // Unreachable database, missing migration, role without execute. All
        // withhold the resource, but none of them are a replay -- and calling
        // them one sends an operator looking for a duplicate that never
        // existed. The commonest cause in practice is this migration not
        // having been applied to the environment being tested.
        console.error('x402 replay claim failed:', error.code ?? 'unknown_error')
        return 'unavailable'
      }
      return data === 'claimed' ? 'claimed' : 'duplicate'
    },

    /**
     * Provenance only. Access was already decided by the claim, so a failure
     * here is logged and swallowed: withholding a resource the caller has
     * demonstrably paid for, because a second write failed, is the worse
     * outcome. The gap surfaces as a claim with no settlement row, which is
     * exactly what a reconciliation sweep should look for.
     */
    async recordSettlement(settlement): Promise<void> {
      const { error } = await ledger.rpc('record_x402_settlement', {
        p_payment_id: settlement.paymentId,
        p_transaction_id: settlement.transaction,
        p_network: context.network,
      })
      if (error) console.error('x402 settlement record failed:', error.code ?? 'unknown_error')
    },
  }
}
