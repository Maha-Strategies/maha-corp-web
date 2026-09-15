/**
 * First-party receipts for settlements this operator paid for itself.
 *
 * The public ledger identifies a product by settled amount, because a USDC
 * Transfer log carries payer, amount and recipient and nothing else. That is
 * the right default and the only option for external payers. It fails for
 * operator payments made while two offers shared a price: on 2026-09-09 the
 * celestial offers launched at 10000, 50000 and 100000, and the micro canary
 * paid 10000 for audit-export-normalizer, so amount matching credited those
 * payments to deep-context-evaluation, evidence-retention-matrix and
 * mps-autonomous-audit instead, and left the four 5000 payments unattributed.
 *
 * For our own payments we hold something better than the amount: the canary's
 * evidence file, which records the offer it bought and the transaction hash it
 * produced. Each receipt below is copied from that file, names the run it came
 * from, and names the catalogue commit where the offer published that price.
 *
 * The ledger applies a receipt only when it binds cleanly: exactly one receipt
 * for the transaction, exactly one observed Transfer log in it, an operator
 * payer, a catalogue offer, and the settled amount. Anything else leaves the
 * row unattributed and records why (lib/x402/settlement-ledger.ts). A receipt
 * never changes who paid: these remain operator test payments, excluded from
 * every external, repeat and demand figure.
 *
 * External payers are never attributed this way. We have no receipt for what
 * someone else bought, and inventing one would be the most flattering mistake
 * this ledger could make.
 */
export type OperatorSettlementReceipt = {
  transactionHash: string
  offerId: string
  amountBaseUnits: string
  /** The run and artifact whose evidence file recorded this purchase. */
  source: string
  /** Where the offer published this amount when the payment was made. */
  publishedPrice: { commit: string; path: string }
  /** Always operator test activity; never a customer, demand or repeat use. */
  activity: 'maha-operator-canary'
}

const CELESTIAL = 'GitHub Actions run 34312284707, artifact celestial-indexing-canary-34312284707'
const MICRO_FIVE = 'GitHub Actions run 34325055311, artifact micro-five-indexing-canary-34325055311'
const CELESTIAL_PRICES = { commit: 'c4573475', path: 'lib/x402/celestial-products.ts' }
const MICRO_PRICES = { commit: 'e7c10f0e', path: 'lib/x402/micro-contracts.ts' }
const MICRO_NEXT_PRICES = { commit: 'e7c10f0e', path: 'lib/x402/micro-next-contracts.ts' }
const receipt = (transactionHash: string, offerId: string, amountBaseUnits: string, source: string, publishedPrice: OperatorSettlementReceipt['publishedPrice']): OperatorSettlementReceipt =>
  ({ transactionHash, offerId, amountBaseUnits, source, publishedPrice, activity: 'maha-operator-canary' })

export const OPERATOR_SETTLEMENT_RECEIPTS: readonly OperatorSettlementReceipt[] = Object.freeze([
  receipt('0x037a133a7ce6e0ccd9fe8059b27c344a4cd3a5efac56a5c5a26e7baba23a107c', 'celestial-position-snapshot', '10000', CELESTIAL, CELESTIAL_PRICES),
  receipt('0x998ccc152d35ba944c36265a9310fb27e92456e2db9ecfa6c4545a6f0a385332', 'celestial-chart-evidence', '50000', CELESTIAL, CELESTIAL_PRICES),
  receipt('0x2e460512119a3876ce14b8a9bcd0c942946beef47bdcef8f8600287a41e38ff6', 'celestial-vimshottari-timing', '100000', CELESTIAL, CELESTIAL_PRICES),
  receipt('0x0532c0942c8956969389d0033dfed95a43f091f92d799ffa017b5239ab087182', 'citation-binding-check', '5000', MICRO_FIVE, MICRO_PRICES),
  receipt('0xcdffb2621f19a9fe99daf507ca27b7a67f707457e2dd2cc20010f40216b29f32', 'revision-lineage-check', '5000', MICRO_FIVE, MICRO_PRICES),
  receipt('0x2bc914612596e5f16ddac127809ffa2579ade68edb7214d7dfd6a6a65da20fc2', 'audit-export-normalizer', '10000', MICRO_FIVE, MICRO_PRICES),
  receipt('0x66ccb22e8470fd42b042133ff0a0ea46c5c299afc899aa8c238d37eca7483256', 'unit-uncertainty-conversion', '5000', MICRO_FIVE, MICRO_NEXT_PRICES),
  receipt('0xe8d7e743f73d57748ec5bf5bd8e330f43f508f86e1bd4db0fc0f3f0b972dc78e', 'divine-name-disambiguation', '5000', MICRO_FIVE, MICRO_NEXT_PRICES),
])

/** Shape check for receipts read back from a saved snapshot, which is untrusted input. */
export function isOperatorSettlementReceipt(value: unknown): value is OperatorSettlementReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as Record<string, unknown>
  const price = r.publishedPrice as Record<string, unknown> | undefined
  return Object.keys(r).length === 6
    && typeof r.transactionHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(r.transactionHash)
    && typeof r.offerId === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(r.offerId)
    && typeof r.amountBaseUnits === 'string' && /^[1-9]\d*$/.test(r.amountBaseUnits)
    && typeof r.source === 'string' && r.source.length > 0 && r.source.length <= 200
    && !!price && typeof price === 'object' && Object.keys(price).length === 2
    && typeof price.commit === 'string' && /^[0-9a-f]{7,40}$/.test(price.commit)
    && typeof price.path === 'string' && /^[A-Za-z0-9_./-]{1,200}$/.test(price.path)
    && r.activity === 'maha-operator-canary'
}
