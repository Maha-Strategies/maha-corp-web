import type { PaymentRequirement, ReplayGuard } from './protocol.ts'

// The database side of replay protection. The facilitator prevents the same
// payment settling twice on-chain; this prevents the same settled payment
// being presented twice to this API. Both are needed, and only the second is
// ours.

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
 * is missing, the role lacks execute -- the payment is treated as already used
 * and the resource is withheld. The alternative is serving paid resources with
 * no record of payment, which is worse than refusing a legitimate caller who
 * can retry. A payer who is wrongly refused still holds their settled payment;
 * a resource served without a record cannot be recovered.
 */
export function createReplayGuard(ledger: Ledger, context: SettlementContext, requirement: PaymentRequirement): ReplayGuard {
  return {
    async claim(payment): Promise<boolean> {
      const { data, error } = await ledger.rpc('claim_x402_payment', {
        p_transaction_id: payment.transaction,
        p_network: context.network,
        // The requirement's resource, never anything the caller supplied.
        p_resource: requirement.resource,
        p_payer: payment.payer,
        p_amount_paid: payment.amountPaid,
        p_asset: context.asset,
      })
      if (error) {
        console.error('x402 replay claim failed:', error.code ?? 'unknown_error')
        return false
      }
      return data === 'claimed'
    },
  }
}
