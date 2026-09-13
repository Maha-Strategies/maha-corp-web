import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { buildLedger, formatUsdc, truncateAddress, type OfferPrice } from '../lib/x402/settlement-ledger.ts'

const OFFERS: OfferPrice[] = [
  { id: 'a', title: 'A', amountBaseUnits: BigInt(1_000) },
  { id: 'b', title: 'B', amountBaseUnits: BigInt(10_000) },
]
const s = (payer: string, amount: bigint, hash: string, block = 1) =>
  ({ payer, amountBaseUnits: amount, blockNumber: BigInt(block), transactionHash: hash, timestampUtc: null })
const build = (settlements: Parameters<typeof buildLedger>[0]['settlements'], offers = OFFERS, operators = ['0xcanary']) =>
  buildLedger({ settlements, operatorWallets: operators, offers, observedAt: '2026-09-06T00:00:00.000Z', fromBlock: BigInt(1), toBlock: BigInt(9) })

test('addresses are truncated for display and kept whole for the link', () => {
  assert.equal(truncateAddress('0x7a3f0000000000000000000000000000000000b89c'), '0x7a3f…b89c')
  const l = build([s('0xAAAA111122223333444455556666777788889999', BigInt(1_000), '0xdeadbeef')])
  assert.equal(l.entries[0].payerDisplay, '0xaaaa…9999')
  // Nothing is concealed: the explorer link carries the full transaction.
  assert.match(l.entries[0].explorerUrl, /basescan\.org\/tx\/0xdeadbeef$/)
})

test('operator wallets are labelled and excluded from every external figure', () => {
  const l = build([s('0xcanary', BigInt(1_000), '0x1'), s('0xother', BigInt(1_000), '0x2')])
  assert.equal(l.summary.totalSettlements, 2)
  assert.equal(l.summary.externalSettlements, 1)
  assert.equal(l.summary.canarySettlements, 1)
  assert.equal(l.entries.find((e) => e.payer === '0xcanary')?.payerRole, 'maha-canary-test')
})

test('a repeat buyer and a cross-product buyer are counted separately', () => {
  // Two settlements at one price is a repeat. Two prices is also cross-product.
  const l = build([
    s('0xrepeat', BigInt(1_000), '0x1', 1), s('0xrepeat', BigInt(1_000), '0x2', 2),
    s('0xcross', BigInt(1_000), '0x3', 3), s('0xcross', BigInt(10_000), '0x4', 4),
  ])
  assert.equal(l.summary.repeatExternalWallets, 2)
  assert.equal(l.summary.crossProductWallets, 1, 'only the wallet paying two different prices is cross-product')
})

test('two offers at one price refuse to attribute rather than guessing', () => {
  // With seven products a price collision is realistic, and a Map would return
  // whichever offer was inserted last. Misattributed revenue is worse than
  // unattributed revenue.
  const colliding: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(1_000) },
    { id: 'b', title: 'B', amountBaseUnits: BigInt(1_000) },
  ]
  const l = build([s('0xpayer', BigInt(1_000), '0x1')], colliding)
  assert.equal(l.entries[0].product, null, 'an ambiguous amount names no product')
  // It is still a sale; only the attribution is unknown.
  assert.equal(l.summary.externalSettlements, 1)
  assert.equal(l.summary.byProduct.every((p) => p.attributionAmbiguous === true), true)
})

test('an amount matching no published price is not a settlement', () => {
  const l = build([s('0xpayer', BigInt(7), '0x1')])
  assert.equal(l.summary.totalSettlements, 0)
  assert.equal(l.summary.externalSettlements, 0)
})

test('every figure is derived, never written down', () => {
  const l = build([s('0xa', BigInt(1_000), '0x1'), s('0xb', BigInt(10_000), '0x2')])
  assert.equal(l.summary.externalValueUsdc, '0.011')
  assert.equal(l.summary.externalWallets, 2)
  assert.equal(formatUsdc(BigInt(47_000)), '0.047')
})

test('the ledger states that settlement is not delivery', () => {
  // The boundary the evidence actually supports. Chain data shows a transfer at
  // a published price; it cannot show that a deliverable arrived.
  const l = build([s('0xa', BigInt(1_000), '0x1')])
  assert.ok(l.boundaries.some((b) => /Settlement is not delivery/.test(b)))
  assert.ok(l.boundaries.some((b) => /Operator-controlled wallets are labelled and excluded/.test(b)))
})

test('new products appear without a code change', () => {
  // A third product is live and four more are planned. The offer list drives
  // everything, so a new price is counted the day it is published.
  const three = [...OFFERS, { id: 'c', title: 'C', amountBaseUnits: BigInt(100_000) }]
  const l = build([s('0xa', BigInt(100_000), '0x1')], three)
  assert.equal(l.summary.byProduct.length, 3)
  assert.equal(l.entries[0].product?.id, 'c')
})

test('the committed snapshot matches the contract', () => {
  const snapshot = JSON.parse(readFileSync('content/x402/settlement-ledger.json', 'utf8')) as ReturnType<typeof buildLedger>
  assert.equal(snapshot.schemaVersion, 'maha-x402-settlement-ledger/1.0')
  assert.ok(snapshot.observedAt, 'a snapshot without observedAt cannot be judged stale')
  assert.equal(snapshot.summary.externalSettlements + snapshot.summary.canarySettlements, snapshot.summary.totalSettlements)
  for (const e of snapshot.entries) {
    assert.match(e.payerDisplay, /^0x[0-9a-f]{4}…[0-9a-f]{4}$/, 'displayed addresses must be truncated')
    assert.match(e.transactionHash, /^0x[0-9a-f]{64}$/)
  }
})

/* -- historical prices ------------------------------------------------------
 *
 * A product's price can change, and the chain keeps every settlement made at
 * the old one. Attributing by the current amount alone silently discards that
 * history. These cover the case the approved context-compiler step-up creates:
 * $0.001 to $0.002 once the facilitator's free settlement tier ends.
 */

test('a settlement at a superseded price still belongs to its product', () => {
  const steppedUp: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(2_000), supersededAmountsBaseUnits: [BigInt(1_000)] },
    { id: 'b', title: 'B', amountBaseUnits: BigInt(10_000) },
  ]
  const l = build([s('0xpayer', BigInt(1_000), '0xold'), s('0xpayer', BigInt(2_000), '0xnew', 2)], steppedUp)

  assert.equal(l.summary.totalSettlements, 2, 'the old price is still a settlement')
  assert.equal(l.summary.externalSettlements, 2)
  const a = l.summary.byProduct.find((p) => p.id === 'a')!
  assert.equal(a.settlements, 2, 'both sides of the price change belong to A')
  assert.equal(a.externalSettlements, 2)

  // The row settled at the old price says so, rather than showing a current
  // price beside an amount that no longer equals it.
  const old = l.entries.find((e) => e.transactionHash === '0xold')!
  const now = l.entries.find((e) => e.transactionHash === '0xnew')!
  assert.equal(old.product?.id, 'a')
  assert.equal(old.product?.settledAtSupersededPrice, true)
  assert.equal(now.product?.settledAtSupersededPrice, undefined)
  assert.equal(a.priceUsdc, formatUsdc(BigInt(2_000)), 'the product lists its current price')
  assert.deepEqual(a.supersededPricesUsdc, [formatUsdc(BigInt(1_000))])
})

test('the same wallet buying across a price change is one buyer, not two products', () => {
  const steppedUp: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(2_000), supersededAmountsBaseUnits: [BigInt(1_000)] },
  ]
  const l = build([s('0xrepeat', BigInt(1_000), '0x1'), s('0xrepeat', BigInt(2_000), '0x2', 2)], steppedUp)

  assert.equal(l.summary.externalWallets, 1)
  assert.equal(l.summary.repeatExternalWallets, 1, 'buying before and after a rise is a repeat purchase')
  // crossProductWallets counts distinct prices paid, so a price change must not
  // make one product look like two.
  assert.equal(l.summary.byProduct.find((p) => p.id === 'a')!.settlements, 2)
})

test('a superseded amount another product still publishes is ambiguous, not misattributed', () => {
  // The old price must stay reserved. If a second offer adopts it, a historical
  // settlement could belong to either, and guessing would misattribute revenue.
  const reused: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(2_000), supersededAmountsBaseUnits: [BigInt(1_000)] },
    { id: 'b', title: 'B', amountBaseUnits: BigInt(1_000) },
  ]
  const l = build([s('0xpayer', BigInt(1_000), '0x1')], reused)
  assert.equal(l.entries[0].product, null, 'a reused historical amount names no product')
  assert.equal(l.summary.totalSettlements, 1, 'it is still a sale')
  const [a, b] = ['a', 'b'].map((id) => l.summary.byProduct.find((p) => p.id === id)!)
  // B publishes the contested amount now, so its counts are untrustworthy.
  assert.equal(b.attributionAmbiguous, true)
  // A only held it historically. Its current-price sales are still exact, so it
  // is not blanket-ambiguous -- but the contested slice of its history is
  // reported rather than passed over in silence.
  assert.equal(a.attributionAmbiguous, undefined)
  assert.equal(a.supersededPriceAmbiguous, true)
  assert.equal(a.settlements, 0, 'the contested historical settlement is not counted for A')
})

test('an offer whose current and superseded amounts coincide is not self-ambiguous', () => {
  // Declaring the amount an offer already charges is redundant rather than a
  // collision; deduplicating per offer keeps it attributable.
  const redundant: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(1_000), supersededAmountsBaseUnits: [BigInt(1_000)] },
  ]
  const l = build([s('0xpayer', BigInt(1_000), '0x1')], redundant)
  assert.equal(l.entries[0].product?.id, 'a')
  assert.equal(l.summary.byProduct[0].attributionAmbiguous, undefined)
})

test('the real catalog reaches the ledger with its price history intact', async () => {
  const { payableOffers } = await import('../lib/x402/offers.ts')
  for (const offer of payableOffers()) {
    for (const superseded of offer.supersededAmounts ?? []) {
      assert.notEqual(superseded, offer.amount, `${offer.id} lists its current amount as superseded`)
      const claimants = payableOffers().filter((other) =>
        other.amount === superseded || (other.supersededAmounts ?? []).includes(superseded))
      assert.equal(claimants.length, 1,
        `${superseded} is claimed by ${claimants.map((o) => o.id).join(', ')}; a superseded amount stays reserved`)
    }
  }
})

// --- Operator receipts ------------------------------------------------------

const withReceipts = (settlements: Parameters<typeof buildLedger>[0]['settlements'],
  operatorReceipts: Parameters<typeof buildLedger>[0]['operatorReceipts'], offers = OFFERS) =>
  buildLedger({ settlements, operatorWallets: ['0xcanary'], offers, operatorReceipts,
    observedAt: '2026-09-06T00:00:00.000Z', fromBlock: BigInt(1), toBlock: BigInt(9) })

test('a receipt moves an operator payment off the product that shares its amount', () => {
  // The canary paid 10000 for C while B also charged 10000. By amount alone it
  // lands on B; the receipt says C, and B stops being credited with it.
  const offers: OfferPrice[] = [...OFFERS, { id: 'c', title: 'C', amountBaseUnits: BigInt(20_000) }]
  const rows = [s('0xcanary', BigInt(10_000), '0xCANARY'), s('0xbuyer', BigInt(10_000), '0xbuyer')]
  const plain = withReceipts(rows, [], offers)
  assert.equal(plain.entries.find((e) => e.transactionHash === '0xCANARY')?.product?.id, 'b')

  const fixed = withReceipts(rows, [{ transactionHash: '0xcanary', offerId: 'c', amountBaseUnits: '10000', source: 'test' }], offers)
  const canary = fixed.entries.find((e) => e.transactionHash === '0xCANARY')!
  assert.equal(canary.product?.id, 'c', 'the hash match is case-insensitive')
  assert.equal(canary.product?.attributedBy, 'operator-receipt')
  assert.equal(canary.product?.settledAtSupersededPrice, true, 'C charges 20000 now, so 10000 is a price it has left')
  const b = fixed.summary.byProduct.find((p) => p.id === 'b')!
  const c = fixed.summary.byProduct.find((p) => p.id === 'c')!
  assert.deepEqual([b.settlements, b.externalSettlements], [1, 1], 'B keeps its external buyer and loses the canary')
  assert.deepEqual([c.settlements, c.externalSettlements], [1, 0])
})

test('a receipt attributes an operator payment at an amount nothing charges any more', () => {
  const rows = [s('0xcanary', BigInt(5_000), '0x5')]
  assert.equal(withReceipts(rows, []).entries[0].product, null)
  const l = withReceipts(rows, [{ transactionHash: '0x5', offerId: 'a', amountBaseUnits: '5000', source: 'test' }])
  assert.equal(l.entries[0].product?.id, 'a')
  // It is a real operator settlement for a named product, so it counts.
  assert.equal(l.summary.canarySettlements, 1)
  assert.equal(l.summary.totalSettlements, 1)
})

test('receipts never touch external figures, and cannot be applied to an external payer', () => {
  const rows = [s('0xcanary', BigInt(1_000), '0x1'), s('0xbuyer', BigInt(1_000), '0x2'), s('0xbuyer', BigInt(10_000), '0x3')]
  const receipt = { transactionHash: '0x1', offerId: 'b', amountBaseUnits: '1000', source: 'test' }
  const plain = withReceipts(rows, []).summary
  const fixed = withReceipts(rows, [receipt]).summary
  for (const key of ['externalSettlements', 'externalWallets', 'repeatExternalWallets', 'crossProductWallets', 'externalValueUsdc'] as const) {
    assert.equal(fixed[key], plain[key], key)
  }
  // We hold no receipt for what someone else bought. Naming one is a data error.
  assert.throws(() => withReceipts(rows, [{ ...receipt, transactionHash: '0x2' }]), /operator_receipt_for_external_payer/)
})

test('a receipt that disagrees with the chain or the catalogue fails the build', () => {
  const rows = [s('0xcanary', BigInt(1_000), '0x1')]
  const receipt = { transactionHash: '0x1', offerId: 'a', amountBaseUnits: '1000', source: 'test' }
  assert.throws(() => withReceipts(rows, [{ ...receipt, amountBaseUnits: '1001' }]), /operator_receipt_amount_mismatch/)
  assert.throws(() => withReceipts(rows, [{ ...receipt, offerId: 'missing' }]), /operator_receipt_unknown_offer/)
  assert.throws(() => withReceipts(rows, [receipt, { ...receipt, transactionHash: '0X1' }]), /operator_receipt_duplicated/)
})

test('the committed receipts name real offers and the evidence they came from', async () => {
  const { OPERATOR_SETTLEMENT_RECEIPTS } = await import('../lib/x402/operator-settlement-receipts.ts')
  const { X402_OFFERS } = await import('../lib/x402/offers.ts')
  const ids = new Set(X402_OFFERS.map((o) => o.id))
  assert.equal(OPERATOR_SETTLEMENT_RECEIPTS.length, 8)
  assert.equal(new Set(OPERATOR_SETTLEMENT_RECEIPTS.map((r) => r.transactionHash.toLowerCase())).size, 8)
  for (const r of OPERATOR_SETTLEMENT_RECEIPTS) {
    assert.match(r.transactionHash, /^0x[0-9a-f]{64}$/)
    assert.ok(ids.has(r.offerId), `${r.offerId} is in the catalogue`)
    assert.match(r.amountBaseUnits, /^[1-9]\d*$/)
    assert.match(r.source, /GitHub Actions run \d+, artifact [a-z0-9-]+/)
  }
})

test('both ledger builders apply the receipts', () => {
  // The hourly cron and the manual generator must attribute identically, or
  // the public page changes depending on which one ran last.
  for (const file of ['lib/x402/settlement-refresh.ts', 'scripts/generate-x402-settlement-ledger.ts']) {
    assert.match(readFileSync(file, 'utf8'), /operatorReceipts: OPERATOR_SETTLEMENT_RECEIPTS/, file)
  }
})
