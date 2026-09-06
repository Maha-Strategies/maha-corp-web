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
