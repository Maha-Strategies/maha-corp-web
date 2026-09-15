import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

import { buildLedger, formatUsdc, truncateAddress, type OfferPrice } from '../lib/x402/settlement-ledger.ts'
import { OPERATOR_SETTLEMENT_RECEIPTS, isOperatorSettlementReceipt, type OperatorSettlementReceipt } from '../lib/x402/operator-settlement-receipts.ts'

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
  assert.match(snapshot.schemaVersion, /^maha-x402-settlement-ledger\/1\.[01]$/)
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
//
// A receipt names the offer for one of our own test payments. It binds only to
// one Transfer log with an operator payer, a catalogue offer and the settled
// amount; anything else leaves the row unattributed and says why.

const receipt = (transactionHash: string, offerId: string, amountBaseUnits: string): OperatorSettlementReceipt => ({
  transactionHash, offerId, amountBaseUnits, source: 'test run 1, artifact test-1',
  publishedPrice: { commit: 'abc1234', path: 'lib/x402/test.ts' }, activity: 'maha-operator-canary',
})
type Rows = Parameters<typeof buildLedger>[0]['settlements']
const withReceipts = (settlements: Rows, operatorReceipts: readonly OperatorSettlementReceipt[], offers = OFFERS) =>
  buildLedger({ settlements, operatorWallets: ['0xcanary'], offers, operatorReceipts,
    observedAt: '2026-09-06T00:00:00.000Z', fromBlock: BigInt(1), toBlock: BigInt(9) })
const log = (payer: string, amount: bigint, hash: string, logIndex?: number) => ({ ...s(payer, amount, hash), ...(logIndex === undefined ? {} : { logIndex }) })
const EXTERNAL_FIGURES = ['externalSettlements', 'externalWallets', 'repeatExternalWallets', 'crossProductWallets', 'externalValueUsdc'] as const

test('a ledger built without receipts is the amount-only 1.0 ledger, byte for byte', () => {
  // Pinned from lib/x402/settlement-ledger.ts on main at 1b7db448. Saved 1.0
  // snapshots must keep validating, so this output cannot drift.
  const offers: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(2_000), supersededAmountsBaseUnits: [BigInt(1_000)] },
    { id: 'b', title: 'B', amountBaseUnits: BigInt(10_000) },
    { id: 'c', title: 'C', amountBaseUnits: BigInt(10_000) },
    { id: 'd', title: 'D', amountBaseUnits: BigInt(50_000) },
  ]
  const settlements = [
    { payer: '0xbuyer', amountBaseUnits: BigInt(1_000), blockNumber: BigInt(3), transactionHash: '0x01', timestampUtc: '2026-09-01T00:00:00.000Z', logIndex: 2 },
    { payer: '0xbuyer', amountBaseUnits: BigInt(2_000), blockNumber: BigInt(4), transactionHash: '0x02', timestampUtc: null },
    { payer: '0xcanary', amountBaseUnits: BigInt(10_000), blockNumber: BigInt(5), transactionHash: '0x03', timestampUtc: null, logIndex: 0 },
    { payer: '0xother', amountBaseUnits: BigInt(50_000), blockNumber: BigInt(6), transactionHash: '0x04', timestampUtc: null },
    { payer: '0xother', amountBaseUnits: BigInt(7), blockNumber: BigInt(7), transactionHash: '0x05', timestampUtc: null },
  ]
  const legacy = buildLedger({ settlements, offers, operatorWallets: ['0xCanary'], observedAt: '2026-09-15T00:00:00.000Z', fromBlock: BigInt(1), toBlock: BigInt(9) })
  assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'), 'ac68e96c7039b5bc66340876b4c9445974b98189cb6a79c2e70b5728e8528f81')
  assert.equal(legacy.schemaVersion, 'maha-x402-settlement-ledger/1.0')
  assert.equal('attribution' in legacy, false)
  assert.ok(legacy.entries.every((e) => !('attribution' in e)), 'legacy rows carry no attribution block')
  assert.ok(legacy.entries.some((e) => e.logIndex === undefined), 'rows without a log index still build')
})

test('a valid receipt attributes an operator payment and keeps what the amount alone indicated', () => {
  const offers: OfferPrice[] = [...OFFERS, { id: 'c', title: 'C', amountBaseUnits: BigInt(20_000) }]
  const rows = [s('0xcanary', BigInt(10_000), '0xCANARY'), s('0xbuyer', BigInt(10_000), '0xbuyer')]
  const plain = withReceipts(rows, [], offers)
  assert.equal(plain.schemaVersion, 'maha-x402-settlement-ledger/1.1')
  assert.deepEqual(plain.entries.find((e) => e.transactionHash === '0xCANARY')?.attribution, { method: 'amount-match', amountIndicates: 'b' })

  const fixed = withReceipts(rows, [receipt('0xcanary', 'c', '10000')], offers)
  const canary = fixed.entries.find((e) => e.transactionHash === '0xCANARY')!
  assert.equal(canary.product?.id, 'c', 'the hash match is case-insensitive')
  assert.equal(canary.payerRole, 'maha-canary-test', 'a receipt never changes who paid')
  assert.equal(canary.product?.settledAtSupersededPrice, true, 'C charges 20000 now, so 10000 is a price it has left')
  assert.deepEqual(canary.attribution, { method: 'operator-receipt', amountIndicates: 'b', receiptSource: 'test run 1, artifact test-1' })
  const b = fixed.summary.byProduct.find((p) => p.id === 'b')!
  const c = fixed.summary.byProduct.find((p) => p.id === 'c')!
  assert.deepEqual([b.settlements, b.externalSettlements], [1, 1], 'B keeps its external buyer and loses the canary')
  assert.deepEqual([c.settlements, c.externalSettlements], [1, 0], 'the receipt row is never external')
  assert.equal(fixed.summary.receiptAttributedSettlements, 1)
  assert.deepEqual(fixed.attribution?.issues, [])
  for (const key of EXTERNAL_FIGURES) assert.equal(fixed.summary[key], plain.summary[key], key)
})

test('a receipt resolves an amount two offers share, which amount matching refuses', () => {
  const colliding: OfferPrice[] = [
    { id: 'a', title: 'A', amountBaseUnits: BigInt(1_000) },
    { id: 'b', title: 'B', amountBaseUnits: BigInt(1_000) },
  ]
  const rows = [s('0xcanary', BigInt(1_000), '0x1'), s('0xbuyer', BigInt(1_000), '0x2')]
  const l = withReceipts(rows, [receipt('0x1', 'a', '1000')], colliding)
  const [ours, theirs] = ['0x1', '0x2'].map((hash) => l.entries.find((e) => e.transactionHash === hash)!)
  assert.equal(ours.product?.id, 'a')
  assert.deepEqual(ours.attribution, { method: 'operator-receipt', amountIndicates: null, amountAmbiguous: true, receiptSource: 'test run 1, artifact test-1' })
  assert.equal(theirs.product, null, 'the external payment at the shared price stays unattributed')
  assert.deepEqual(theirs.attribution, { method: 'unattributed', amountIndicates: null, amountAmbiguous: true })
  const a = l.summary.byProduct.find((p) => p.id === 'a')!
  assert.equal(a.attributionAmbiguous, true)
  assert.deepEqual([a.settlements, a.externalSettlements], [1, 0], 'only the exactly named receipt row counts')
  assert.equal(l.summary.byProduct.find((p) => p.id === 'b')!.settlements, 0)
})

test('a receipt at an amount nothing charges any more counts once, as operator activity', () => {
  const rows = [s('0xcanary', BigInt(5_000), '0x5')]
  assert.equal(withReceipts(rows, []).entries[0].product, null)
  assert.equal(withReceipts(rows, []).summary.totalSettlements, 0)
  const l = withReceipts(rows, [receipt('0x5', 'a', '5000')])
  assert.equal(l.entries[0].product?.id, 'a')
  assert.deepEqual([l.summary.totalSettlements, l.summary.canarySettlements, l.summary.externalSettlements], [1, 1, 0])
})

test('mismatched, unknown, external and duplicated receipts leave the row unattributed and say why', () => {
  const rows = [
    log('0xcanary', BigInt(1_000), '0x1'), log('0xbuyer', BigInt(1_000), '0x2'),
    log('0xcanary', BigInt(10_000), '0x3'), log('0xcanary', BigInt(10_000), '0x4'),
  ]
  const l = withReceipts(rows, [
    receipt('0x1', 'a', '1001'), // amount disagrees with the chain
    receipt('0x2', 'a', '1000'), // someone else's payment
    receipt('0x3', 'missing', '10000'), // no such offer
    receipt('0x4', 'b', '10000'), receipt('0X4', 'a', '10000'), // two receipts, one transaction
  ])
  const byHash = (hash: string) => l.entries.find((e) => e.transactionHash === hash)!
  assert.deepEqual(l.attribution?.issues, [
    { transactionHash: '0x1', issue: 'receipt_amount_mismatch' },
    { transactionHash: '0x2', issue: 'receipt_for_external_payer' },
    { transactionHash: '0x3', issue: 'receipt_unknown_offer' },
    { transactionHash: '0x4', issue: 'receipt_duplicated' },
  ])
  for (const hash of ['0x1', '0x2', '0x3', '0x4']) {
    const e = byHash(hash)
    assert.equal(e.product, null, `${hash}: conflicting evidence is not resolved by either candidate`)
    assert.equal(e.attribution?.method, 'unattributed')
    assert.ok(e.attribution?.issue, `${hash}: the reason is recorded`)
  }
  assert.equal(byHash('0x1').attribution?.amountIndicates, 'a', 'what the amount alone says is still shown')
  assert.equal(byHash('0x2').payerRole, 'external-machine-agent', 'a receipt cannot relabel an external payer')
  assert.equal(l.summary.receiptAttributedSettlements, 0)
  // Priced transfers remain settlements; only their attribution is withheld.
  assert.equal(l.summary.totalSettlements, 4)
  assert.equal(l.summary.byProduct.reduce((n, p) => n + p.settlements, 0), 0)
})

test('a transaction with two Transfer logs cannot be bound by one receipt, and nothing is counted twice', () => {
  const rows = [log('0xcanary', BigInt(1_000), '0xmulti', 0), log('0xcanary', BigInt(1_000), '0xmulti', 1)]
  const l = withReceipts(rows, [receipt('0xmulti', 'a', '1000')])
  assert.equal(l.entries.length, 2)
  assert.ok(l.entries.every((e) => e.product === null && e.attribution?.issue === 'receipt_multiple_transfer_logs'))
  assert.deepEqual(l.attribution?.issues.map((i) => i.issue), ['receipt_multiple_transfer_logs', 'receipt_multiple_transfer_logs'])
  assert.equal(l.summary.canarySettlements, 2)
  assert.equal(l.summary.byProduct.find((p) => p.id === 'a')!.settlements, 0)
})

test('every attributed row is counted under exactly one product, receipts included', () => {
  const offers: OfferPrice[] = [...OFFERS, { id: 'c', title: 'C', amountBaseUnits: BigInt(20_000) }]
  const rows = [s('0xcanary', BigInt(10_000), '0x1'), s('0xbuyer', BigInt(10_000), '0x2'), s('0xbuyer', BigInt(1_000), '0x3'), s('0xcanary', BigInt(20_000), '0x4')]
  const l = withReceipts(rows, [receipt('0x1', 'c', '10000')], offers)
  const attributed = l.entries.filter((e) => e.product !== null)
  assert.equal(l.summary.byProduct.reduce((n, p) => n + p.settlements, 0), attributed.length)
  for (const e of attributed) assert.equal(l.summary.byProduct.filter((p) => p.id === e.product!.id).length, 1)
  assert.equal(l.summary.byProduct.find((p) => p.id === 'c')!.settlements, 2, 'the receipt row and the priced row, once each')
})

test('receipts that match no scanned row are listed, not silently dropped', () => {
  const l = withReceipts([s('0xcanary', BigInt(1_000), '0x1')], [receipt('0xFFFF', 'a', '1000')])
  assert.deepEqual(l.attribution?.unobservedReceipts, ['0xffff'])
  assert.equal(l.entries[0].attribution?.method, 'amount-match')
})

// --- The committed receipts -------------------------------------------------

const bundled = JSON.parse(readFileSync('content/x402/settlement-ledger.json', 'utf8')) as ReturnType<typeof buildLedger>
const bundledRows = bundled.entries.map((e) => ({ ...e, amountBaseUnits: BigInt(e.amountBaseUnits), blockNumber: BigInt(e.blockNumber) }))

test('the eight committed receipts bind to eight operator test payments and change no external figure', async () => {
  const { ledgerFromRows } = await import('../lib/x402/settlement-refresh.ts')
  const { OPERATOR_WALLETS, MAHA_PAYEE } = await import('../lib/x402/discovery-payment-recipe.ts')
  const { payableOffers } = await import('../lib/x402/offers.ts')
  assert.equal(OPERATOR_SETTLEMENT_RECEIPTS.length, 8)
  const fixed = ledgerFromRows(bundledRows, BigInt(bundled.scannedFromBlock), BigInt(bundled.scannedToBlock), bundled.observedAt)
  const plain = buildLedger({ settlements: bundledRows, operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
    offers: payableOffers().map((o) => ({ id: o.id, title: o.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), amountBaseUnits: BigInt(o.amount),
      ...(o.supersededAmounts?.length ? { supersededAmountsBaseUnits: o.supersededAmounts.map(BigInt) } : {}) })),
    observedAt: bundled.observedAt, fromBlock: BigInt(bundled.scannedFromBlock), toBlock: BigInt(bundled.scannedToBlock) })

  assert.deepEqual(fixed.attribution?.issues, [], 'every committed receipt binds')
  assert.deepEqual(fixed.attribution?.unobservedReceipts, [], 'every committed receipt names a scanned transaction')
  assert.equal(fixed.summary.receiptAttributedSettlements, 8)
  for (const r of OPERATOR_SETTLEMENT_RECEIPTS) {
    const e = fixed.entries.find((row) => row.transactionHash.toLowerCase() === r.transactionHash)!
    assert.equal(e.payerRole, 'maha-canary-test', `${r.offerId}: operator wallet`)
    assert.equal(e.product?.id, r.offerId)
    assert.equal(e.attribution?.method, 'operator-receipt')
  }
  // Test activity: no external, wallet, repeat, cross-product or value figure moves.
  for (const key of EXTERNAL_FIGURES) assert.equal(fixed.summary[key], plain.summary[key], key)
  for (const p of plain.summary.byProduct) {
    assert.equal(fixed.summary.byProduct.find((q) => q.id === p.id)!.externalSettlements, p.externalSettlements, `${p.id}: external count`)
  }
  // The corrections are the ones the receipts name: two rows leave Deep
  // Context Evaluation, one each leaves the matrix and the MPS audit.
  const moved = (id: string) => plain.summary.byProduct.find((p) => p.id === id)!.settlements - fixed.summary.byProduct.find((p) => p.id === id)!.settlements
  assert.deepEqual([moved('deep-context-evaluation'), moved('evidence-retention-matrix'), moved('mps-autonomous-audit')], [2, 1, 1])
  assert.equal(fixed.summary.canarySettlements - plain.summary.canarySettlements, 4, 'the four 5000 payments were previously uncounted')
})

test('each committed receipt is well formed and its published price is in the named catalogue commit', () => {
  assert.equal(new Set(OPERATOR_SETTLEMENT_RECEIPTS.map((r) => r.transactionHash.toLowerCase())).size, 8)
  for (const r of OPERATOR_SETTLEMENT_RECEIPTS) {
    assert.ok(isOperatorSettlementReceipt(r), r.transactionHash)
    assert.match(r.source, /^GitHub Actions run \d+, artifact [a-z0-9-]+$/)
    // CI checks out full history. A missing commit is a failure, not a skip.
    const file = execFileSync('git', ['show', `${r.publishedPrice.commit}:${r.publishedPrice.path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    assert.match(file, new RegExp(`'${r.offerId}': \\{[^}]*amount: '${r.amountBaseUnits}'`), `${r.offerId} published ${r.amountBaseUnits} at ${r.publishedPrice.commit}`)
  }
})

test('both ledger builders apply the committed receipts', () => {
  // The hourly cron and the manual generator must attribute identically, or
  // the public page changes depending on which one ran last.
  for (const file of ['lib/x402/settlement-refresh.ts', 'scripts/generate-x402-settlement-ledger.ts']) {
    assert.match(readFileSync(file, 'utf8'), /operatorReceipts: OPERATOR_SETTLEMENT_RECEIPTS/, file)
  }
})
