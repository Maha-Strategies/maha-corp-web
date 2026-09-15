import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { ledgerFromRows, refreshSettlementLedger, MAX_SCAN_BLOCKS, SCAN_CHUNK, type SettlementReader, type Transfer } from '../lib/x402/settlement-refresh.ts'
import { bundledLedger, readPublicSettlementLedger, refreshStoredSettlements, validLiveSnapshot, type LiveSnapshot, type SettlementStore } from '../lib/x402/settlement-live-store.ts'
import { buildLedger } from '../lib/x402/settlement-ledger.ts'
import { OPERATOR_SETTLEMENT_RECEIPTS } from '../lib/x402/operator-settlement-receipts.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { OPERATOR_WALLETS, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'

const now = new Date('2026-09-09T03:00:00Z')
const row = (block: bigint, index = 0): Transfer => ({ payer: `0x${'a'.repeat(40)}`, amountBaseUnits: BigInt(1000), blockNumber: block, transactionHash: `0x${'b'.repeat(64)}`, logIndex: index })
const reader = (head: bigint, rows: Transfer[] = []): SettlementReader => ({ finalizedBlock: async () => head,
  transfers: async (from, to) => rows.filter(r => r.blockNumber >= from && r.blockNumber <= to), timestamp: async () => now.toISOString() })
const empty = () => ledgerFromRows([], BigInt(1), BigInt(500), now.toISOString())

test('old catalogue snapshots validate and reproject without losing observed history', async () => {
  const block = BigInt(bundledLedger.scannedToBlock) + BigInt(1)
  const offer = payableOffers().at(-1)!
  const ledger = buildLedger({ settlements: [{ ...row(block), amountBaseUnits: BigInt(offer.amount) }],
    offers: [], operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE], observedAt: now.toISOString(), fromBlock: BigInt(1), toBlock: block })
  const saved: LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0', ledger, caughtUp: true, finalizedBlock: String(block) }
  assert.ok(validLiveSnapshot(saved))
  const publicView = await readPublicSettlementLedger({ read: async () => saved }, now)
  assert.equal(publicView.source, 'scheduled_snapshot')
  assert.equal(publicView.ledger.entries[0].product?.id, offer.id)
  assert.equal(publicView.ledger.observedAt, now.toISOString())
  assert.equal(publicView.ledger.scannedToBlock, String(block))
  assert.equal(saved.ledger.entries[0].product, null)
  const tampered = structuredClone(saved)
  tampered.ledger.entries[0].amountBaseUnits = '999'
  assert.equal(validLiveSnapshot(tampered), false)
})

test('scheduled scanner includes every available product and declared historical price', () => {
  const ledger = ledgerFromRows([], BigInt(1), BigInt(500), now.toISOString())
  assert.deepEqual(ledger.summary.byProduct.map(o => o.id).sort(), payableOffers().map(o => o.id).sort())
  for (const offer of payableOffers()) for (const amount of offer.supersededAmounts ?? []) {
    const result = ledgerFromRows([{ ...row(BigInt(100)), amountBaseUnits: BigInt(amount) }], BigInt(1), BigInt(500), now.toISOString())
    assert.equal(result.entries[0].product?.id, offer.id)
    assert.equal(result.summary.totalSettlements, 1)
  }
})

test('page shows transactions, not the available-product catalogue', () => {
  const page = readFileSync('app/developers/settlement/page.tsx', 'utf8')
  assert.doesNotMatch(page, /s\.byProduct|By product/)
  assert.match(page, /record\.entries\.filter/)
  assert.match(page, /Service \(how attributed\)/)
  assert.match(page, /attributionNote\(entry, titles\)/)
  assert.match(page, /<SettlementAutoRefresh/)
})
test('deployment wires hourly authenticated production-only refresh and request-time page reads', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  assert.equal(config.crons.filter((c: { path: string }) => c.path === '/api/cron/x402-settlements').length, 1)
  assert.equal(config.crons.find((c: { path: string }) => c.path === '/api/cron/x402-settlements').schedule, '17 * * * *')
  const route = readFileSync('app/api/cron/x402-settlements/route.ts', 'utf8')
  assert.ok(route.indexOf('if (!authorizeObservatoryCron(request))') < route.indexOf('await refreshStoredSettlements'))
  assert.match(route, /VERCEL_ENV !== 'production'/)
  const page = readFileSync('app/developers/settlement/page.tsx', 'utf8')
  assert.match(page, /await connection\(\)/)
  assert.match(page, /await readPublicSettlementLedger\(\)/)
  assert.match(page, /<SettlementAutoRefresh/)
})
function memory(saved: LiveSnapshot | null = null) {
  let value = saved, held = false, publishes = 0
  const store: SettlementStore = { read: async () => value, acquire: async () => { if (held) return false; held = true; return true },
    publish: async (_, next) => { publishes++; value = next; return true }, release: async () => { held = false } }
  return { store, value: () => value, publishes: () => publishes }
}
test('incremental overlap replaces old rows, deduplicates logs, retains history and distinguishes log indexes', async () => {
  const previous = ledgerFromRows([{ ...row(BigInt(10)), timestampUtc: now.toISOString() }, { ...row(BigInt(490), 8), timestampUtc: now.toISOString() }], BigInt(1), BigInt(500), now.toISOString())
  const result = await refreshSettlementLedger(previous, reader(BigInt(600), [row(BigInt(550), 1), row(BigInt(550), 1), row(BigInt(550), 2)]), now)
  assert.equal(result.ledger.entries.length, 3)
  assert.equal(result.ledger.summary.externalSettlements, 3)
  assert.ok(!result.ledger.entries.some(r => r.logIndex === 8))
  assert.equal(result.caughtUp, true)
})
test('bounded catchup advances only through completely scanned ranges', async () => {
  const result = await refreshSettlementLedger(empty(), reader(BigInt(999999)), now)
  assert.equal(result.ledger.scannedToBlock, String(BigInt(500) - BigInt(128) + MAX_SCAN_BLOCKS - BigInt(1)))
  assert.equal(result.caughtUp, false)
})
test('every public-RPC log request stays within the Base 2,000-block limit', async () => {
  assert.equal(SCAN_CHUNK, BigInt(2000))
  const ranges: Array<[bigint, bigint]> = []
  const bounded: SettlementReader = {
    finalizedBlock: async () => BigInt(6500),
    transfers: async (from, to) => { ranges.push([from, to]); return [] },
    timestamp: async () => now.toISOString(),
  }
  await refreshSettlementLedger(empty(), bounded, now)
  assert.ok(ranges.length > 1)
  for (const [from, to] of ranges) assert.ok(to - from + BigInt(1) <= BigInt(2000))
})
test('failed RPC, invalid logs and timestamps reject instead of advancing', async () => {
  await assert.rejects(refreshSettlementLedger(empty(), { ...reader(BigInt(600)), transfers: async () => { throw Error('rpc') } }), /rpc/)
  await assert.rejects(refreshSettlementLedger(empty(), reader(BigInt(499))), /behind/)
  await assert.rejects(refreshSettlementLedger(empty(), { ...reader(BigInt(600)), transfers: async () => [row(BigInt(700))] }), /invalid_transfer/)
  await assert.rejects(refreshSettlementLedger(empty(), { ...reader(BigInt(600), [row(BigInt(550))]), timestamp: async () => 'bad' }), /invalid_block_time/)
  await assert.rejects(refreshSettlementLedger(empty(), reader(BigInt(600), [row(BigInt(550)), { ...row(BigInt(550)), amountBaseUnits: BigInt(5) }])), /conflicting/)
})
test('publishes once only after complete success; failure retains the saved snapshot', async () => {
  const m = memory()
  const head = BigInt(bundledLedger.scannedToBlock) + BigInt(10)
  const result = await refreshStoredSettlements(m.store, reader(head), now)
  assert.equal(result.status, 'updated')
  assert.equal(m.publishes(), 1)
  assert.ok(validLiveSnapshot(m.value()))
  const saved = m.value()
  await assert.rejects(refreshStoredSettlements(m.store, { ...reader(head), transfers: async () => { throw Error('offline') } }, now), /offline/)
  assert.equal(m.value(), saved)
  assert.equal(m.publishes(), 1)
})
test('lock prevents duplicate workers and expired owners cannot publish', async () => {
  const m = memory()
  assert.deepEqual(await refreshStoredSettlements({ ...m.store, acquire: async () => false }, reader(BigInt(0))), { status: 'already_running' })
  await assert.rejects(refreshStoredSettlements({ ...m.store, publish: async () => false }, reader(BigInt(bundledLedger.scannedToBlock)), now), /lock_expired/)
  assert.equal(m.publishes(), 0)
})
test('public view marks freshness and falls back on failure or invalid data', async () => {
  const m = memory()
  await refreshStoredSettlements(m.store, reader(BigInt(bundledLedger.scannedToBlock) + BigInt(10)), now)
  assert.equal((await readPublicSettlementLedger(m.store, now)).stale, false)
  assert.equal((await readPublicSettlementLedger(m.store, new Date(now.getTime() + 7200001))).stale, true)
  assert.equal((await readPublicSettlementLedger({ read: async () => { throw Error('offline') } })).source, 'bundled_fallback')
  const invalid = structuredClone(m.value()!)
  invalid.ledger.summary.externalSettlements++
  assert.equal(validLiveSnapshot(invalid), false)
  assert.equal((await readPublicSettlementLedger({ read: async () => invalid })).source, 'bundled_fallback')
})
test('a newer bundled cursor can seed an older valid persisted snapshot', async () => {
  const m = memory({ schemaVersion: 'maha-live-settlements/1.0', ledger: empty(), caughtUp: true, finalizedBlock: '500' })
  assert.ok(validLiveSnapshot(m.value()))
  assert.equal((await readPublicSettlementLedger(m.store)).source, 'bundled_fallback')
  await refreshStoredSettlements(m.store, reader(BigInt(bundledLedger.scannedToBlock) + BigInt(1)), now)
  assert.ok(BigInt(m.value()!.ledger.scannedToBlock) > BigInt(bundledLedger.scannedToBlock))
})

// --- Receipt-aware snapshots ------------------------------------------------

const canaryReceipt = OPERATOR_SETTLEMENT_RECEIPTS.find((r) => r.offerId === 'audit-export-normalizer')!
const bundledRows = () => bundledLedger.entries.map((e) => ({ ...e, amountBaseUnits: BigInt(e.amountBaseUnits), blockNumber: BigInt(e.blockNumber) }))
const catalogue = () => payableOffers().map((o) => ({ id: o.id, title: o.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), amountBaseUnits: BigInt(o.amount),
  ...(o.supersededAmounts?.length ? { supersededAmountsBaseUnits: o.supersededAmounts.map(BigInt) } : {}) }))
const snapshotOf = (ledger: ReturnType<typeof buildLedger>): LiveSnapshot => ({ schemaVersion: 'maha-live-settlements/1.0', ledger, caughtUp: true, finalizedBlock: ledger.scannedToBlock })
const legacySnapshot = () => snapshotOf(buildLedger({ settlements: bundledRows(), offers: catalogue(), operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
  observedAt: now.toISOString(), fromBlock: BigInt(bundledLedger.scannedFromBlock), toBlock: BigInt(bundledLedger.scannedToBlock) }))

test('a 1.0 snapshot saved before receipts still validates, and the public view applies the committed receipts', async () => {
  const saved = legacySnapshot()
  assert.equal(saved.ledger.schemaVersion, 'maha-x402-settlement-ledger/1.0')
  assert.ok(validLiveSnapshot(saved), 'rejecting it would stop the hourly refresh at invalid_saved_snapshot')
  const row = (ledger: ReturnType<typeof buildLedger>) => ledger.entries.find((e) => e.transactionHash.toLowerCase() === canaryReceipt.transactionHash)!
  assert.equal(row(saved.ledger).product?.id, 'deep-context-evaluation', 'the saved record keeps its amount-only attribution')
  const view = await readPublicSettlementLedger({ read: async () => saved }, now)
  assert.equal(view.source, 'scheduled_snapshot')
  assert.equal(row(view.ledger).product?.id, 'audit-export-normalizer')
  assert.deepEqual(row(view.ledger).attribution, { method: 'operator-receipt', amountIndicates: 'deep-context-evaluation', receiptSource: canaryReceipt.source })
})

test('refreshing from a saved 1.0 snapshot publishes a valid receipt-aware 1.1 snapshot', async () => {
  const m = memory(legacySnapshot())
  await refreshStoredSettlements(m.store, reader(BigInt(bundledLedger.scannedToBlock) + BigInt(10)), now)
  const next = m.value()!
  assert.equal(next.ledger.schemaVersion, 'maha-x402-settlement-ledger/1.1')
  assert.ok(validLiveSnapshot(next))
  assert.equal(next.ledger.summary.receiptAttributedSettlements, 8)
  assert.deepEqual(next.ledger.attribution?.issues, [])
})

test('a tampered attribution, receipt or policy invalidates a 1.1 snapshot and the page falls back', async () => {
  const m = memory()
  await refreshStoredSettlements(m.store, reader(BigInt(bundledLedger.scannedToBlock) + BigInt(10)), now)
  const good = m.value()!
  const index = good.ledger.entries.findIndex((e) => e.attribution?.method === 'operator-receipt')
  const mutations: Array<[string, (v: LiveSnapshot) => void]> = [
    ['row product', (v) => { v.ledger.entries[index].product!.id = 'deep-context-evaluation' }],
    ['row provenance', (v) => { v.ledger.entries[index].attribution!.method = 'amount-match' }],
    ['recorded receipt offer', (v) => { v.ledger.attribution!.receipts[0].offerId = 'mps-autonomous-audit' }],
    ['malformed receipt', (v) => { (v.ledger.attribution!.receipts[0] as unknown as Record<string, unknown>).activity = 'customer' }],
    ['dropped attribution block', (v) => { delete v.ledger.attribution }],
    ['1.0 label on a 1.1 body', (v) => { v.ledger.schemaVersion = 'maha-x402-settlement-ledger/1.0' }],
  ]
  for (const [label, mutate] of mutations) {
    const bad = structuredClone(good)
    mutate(bad)
    assert.equal(validLiveSnapshot(bad), false, label)
    assert.equal((await readPublicSettlementLedger({ read: async () => bad }, now)).source, 'bundled_fallback', label)
  }
})

test('receipts recorded in a saved snapshot never reach the public page; the committed receipts do', async () => {
  // A snapshot rebuilt consistently around a forged receipt is internally
  // valid, so validation alone cannot catch it. The read path reprojects rows
  // with the committed receipts, so the forgery changes nothing visible.
  const forged = snapshotOf(buildLedger({ settlements: bundledRows(), offers: catalogue(), operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
    observedAt: now.toISOString(), fromBlock: BigInt(bundledLedger.scannedFromBlock), toBlock: BigInt(bundledLedger.scannedToBlock),
    operatorReceipts: [{ ...canaryReceipt, offerId: 'mps-autonomous-audit', amountBaseUnits: '10000' }] }))
  assert.ok(validLiveSnapshot(forged))
  const view = await readPublicSettlementLedger({ read: async () => forged }, now)
  const row = view.ledger.entries.find((e) => e.transactionHash.toLowerCase() === canaryReceipt.transactionHash)!
  assert.equal(row.product?.id, 'audit-export-normalizer')
  assert.deepEqual(view.ledger.attribution?.receipts.map((r) => r.offerId).sort(), OPERATOR_SETTLEMENT_RECEIPTS.map((r) => r.offerId).sort())
})
