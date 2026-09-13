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
 * mps-autonomous-audit instead.
 *
 * For our own payments we hold something better than the amount: the canary's
 * evidence file, which records the offer it bought and the transaction hash it
 * produced. Each receipt below is copied from that file and names where it came
 * from. The ledger applies a receipt only to an operator-wallet payment whose
 * settled amount equals the receipt's, and fails the build otherwise, so a
 * wrong entry here cannot silently move revenue.
 *
 * External payers are never attributed this way. We have no receipt for what
 * someone else bought, and inventing one would be the most flattering mistake
 * this ledger could make.
 */
export type OperatorSettlementReceipt = {
  transactionHash: string
  offerId: string
  amountBaseUnits: string
  source: string
}

const CELESTIAL = 'GitHub Actions run 34312284707, artifact celestial-indexing-canary-34312284707'
const MICRO_FIVE = 'GitHub Actions run 34325055311, artifact micro-five-indexing-canary-34325055311'

export const OPERATOR_SETTLEMENT_RECEIPTS: readonly OperatorSettlementReceipt[] = [
  { transactionHash: '0x037a133a7ce6e0ccd9fe8059b27c344a4cd3a5efac56a5c5a26e7baba23a107c', offerId: 'celestial-position-snapshot', amountBaseUnits: '10000', source: CELESTIAL },
  { transactionHash: '0x998ccc152d35ba944c36265a9310fb27e92456e2db9ecfa6c4545a6f0a385332', offerId: 'celestial-chart-evidence', amountBaseUnits: '50000', source: CELESTIAL },
  { transactionHash: '0x2e460512119a3876ce14b8a9bcd0c942946beef47bdcef8f8600287a41e38ff6', offerId: 'celestial-vimshottari-timing', amountBaseUnits: '100000', source: CELESTIAL },
  { transactionHash: '0x0532c0942c8956969389d0033dfed95a43f091f92d799ffa017b5239ab087182', offerId: 'citation-binding-check', amountBaseUnits: '5000', source: MICRO_FIVE },
  { transactionHash: '0xcdffb2621f19a9fe99daf507ca27b7a67f707457e2dd2cc20010f40216b29f32', offerId: 'revision-lineage-check', amountBaseUnits: '5000', source: MICRO_FIVE },
  { transactionHash: '0x2bc914612596e5f16ddac127809ffa2579ade68edb7214d7dfd6a6a65da20fc2', offerId: 'audit-export-normalizer', amountBaseUnits: '10000', source: MICRO_FIVE },
  { transactionHash: '0x66ccb22e8470fd42b042133ff0a0ea46c5c299afc899aa8c238d37eca7483256', offerId: 'unit-uncertainty-conversion', amountBaseUnits: '5000', source: MICRO_FIVE },
  { transactionHash: '0xe8d7e743f73d57748ec5bf5bd8e330f43f508f86e1bd4db0fc0f3f0b972dc78e', offerId: 'divine-name-disambiguation', amountBaseUnits: '5000', source: MICRO_FIVE },
]
