import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { ledgerFromRows, refreshSettlementLedger, MAX_SCAN_BLOCKS, type SettlementReader, type Transfer } from '../lib/x402/settlement-refresh.ts'
import { bundledLedger, readPublicSettlementLedger, refreshStoredSettlements, validLiveSnapshot, type LiveSnapshot, type SettlementStore } from '../lib/x402/settlement-live-store.ts'

const now = new Date('2026-09-09T03:00:00Z')
const row = (block: bigint, index = 0): Transfer => ({ payer: `0x${'a'.repeat(40)}`, amountBaseUnits: BigInt(1000), blockNumber: block, transactionHash: `0x${'b'.repeat(64)}`, logIndex: index })
const reader = (head: bigint, rows: Transfer[] = []): SettlementReader => ({ finalizedBlock: async () => head,
  transfers: async (from, to) => rows.filter(r => r.blockNumber >= from && r.blockNumber <= to), timestamp: async () => now.toISOString() })
const empty = () => ledgerFromRows([], BigInt(1), BigInt(500), now.toISOString())
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
