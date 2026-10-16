import test from 'node:test'
import assert from 'node:assert/strict'
import { ledgerFromRows, refreshSettlementLedger, MAX_TIMESTAMP_BLOCKS, type SettlementReader, type Transfer } from '../lib/x402/settlement-refresh.ts'
import { backfillSettlements } from '../lib/x402/settlement-backfill.ts'
import { bundledLedger, validLiveSnapshot, refreshSettlementNetworks, refreshStoredSettlements, type LiveSnapshot, type SettlementStore } from '../lib/x402/settlement-live-store.ts'
import { OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'
import { readFileSync } from 'node:fs'

const now = new Date('2026-10-16T05:00:00Z')
const start = BigInt(bundledLedger.scannedToBlock) + 1000n
const transfer = (block: bigint, i: number): Transfer => ({ payer: OPERATOR_WALLETS[0], amountBaseUnits: 10001n,
  blockNumber: block, transactionHash: '0x' + (i + 1).toString(16).padStart(64, '0'), logIndex: 0 })
function fixture(rows: Transfer[], head: bigint) {
  let stamps = 0
  const reader: SettlementReader = { caip2Network: 'eip155:8453', finalizedBlock: async () => head,
    transfers: async (from, to) => rows.filter(r => r.blockNumber >= from && r.blockNumber <= to),
    timestamp: async () => { stamps++; return now.toISOString() } }
  return { reader, stamps: () => stamps }
}
test('a 1000-call operator burst advances through complete bounded prefixes without losing or reclassifying transfers', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => transfer(start + 10n + BigInt(i * 5), i))
  const { reader } = fixture(rows, start + 5100n)
  let previous = ledgerFromRows([], 1n, start, now.toISOString()), passes = 0
  for (; passes < 40; passes++) {
    const before = BigInt(previous.scannedToBlock), next = await refreshSettlementLedger(previous, reader, now)
    assert.ok(BigInt(next.ledger.scannedToBlock) > before)
    assert.ok(next.ledger.entries.every(e => BigInt(e.blockNumber) <= BigInt(next.ledger.scannedToBlock)))
    previous = next.ledger
    assert.equal(previous.summary.externalSettlements, 0)
    if (next.caughtUp) break
  }
  assert.ok(passes < 40, 'a bounded refresh must not repeat the same rejected window forever')
  assert.equal(previous.entries.length, 1000)
  assert.equal(new Set(previous.entries.map(e => e.transactionHash)).size, 1000)
  assert.equal(previous.summary.canarySettlements, 1000)
})
test('one block is indivisible when a transfer budget is reached', async () => {
  const rows = [...Array.from({ length: 5 }, (_, i) => transfer(start + 10n, i)),
    ...Array.from({ length: 6 }, (_, i) => transfer(start + 20n, i + 5))]
  const f = fixture(rows, start + 100n)
  const next = await refreshSettlementLedger(ledgerFromRows([], 1n, start, now.toISOString()), f.reader, now, { maxTransfers: 10 })
  assert.equal(next.ledger.scannedToBlock, String(start + 19n))
  assert.equal(next.ledger.entries.length, 5)
  assert.equal(next.caughtUp, false)
  assert.equal(f.stamps(), 1)
})
test('exact timestamp budget is allowed and a boundary block is never partially published', async () => {
  const rows = Array.from({ length: MAX_TIMESTAMP_BLOCKS + 1 }, (_, i) => transfer(start + 10n + BigInt(i * 4), i))
  rows.push({ ...rows.at(-1)!, transactionHash: '0x' + 'f'.repeat(64), logIndex: 1 })
  const f = fixture(rows, start + 500n)
  const next = await refreshSettlementLedger(ledgerFromRows([], 1n, start, now.toISOString()), f.reader, now)
  assert.equal(next.ledger.entries.length, MAX_TIMESTAMP_BLOCKS)
  assert.equal(next.ledger.scannedToBlock, String(rows.at(-1)!.blockNumber - 1n))
  assert.equal(f.stamps(), MAX_TIMESTAMP_BLOCKS)
})
test('a dense recheck that cannot move forward fails closed instead of rolling the cursor backward', async () => {
  const cursor = start + 200n, rows = Array.from({ length: 150 }, (_, i) => transfer(start + 73n + BigInt(i), i))
  const f = fixture(rows, cursor + 30n)
  const old = ledgerFromRows(rows.filter(r => r.blockNumber <= cursor).map(r => ({ ...r, timestampUtc: now.toISOString() })), 1n, cursor, now.toISOString())
  await assert.rejects(refreshSettlementLedger(old, f.reader, now), /scan_requires_offline_backfill/)
  assert.equal(old.scannedToBlock, String(cursor)); assert.equal(f.stamps(), 0)
})
test('offline backfill has a genuinely larger bounded timestamp budget and preserves atomic publication', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => transfer(start + 1n + BigInt(i), i))
  const f = fixture(rows, start + 1100n)
  let saved: LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0', ledger: ledgerFromRows([], 1n, start, now.toISOString()), caughtUp: false, finalizedBlock: String(start) }
  let writes = 0, backups = 0
  const store: SettlementStore = { read: async () => saved, acquire: async () => true, release: async () => {},
    publish: async (_owner, next) => { saved = next; writes++; return true } }
  const next = await backfillSettlements({ store, reader: f.reader, backup: async () => { assert.equal(writes, 0); backups++ } })
  assert.ok(validLiveSnapshot(next)); assert.equal(next.ledger.entries.length, 1000)
  assert.equal(next.caughtUp, true); assert.equal(writes, 1); assert.equal(backups, 1)
})
test('invalid scan budgets are rejected before an RPC request', async () => {
  let calls = 0
  const f = fixture([], start + 10n); f.reader.finalizedBlock = async () => { calls++; return start + 10n }
  for (const limits of [{ maxTransfers: 0 }, { maxTransfers: 10001 }, { maxTimestampBlocks: 0 }, { maxTimestampBlocks: 1025 }, { maxTimestampBlocks: 1.5 }]) {
    await assert.rejects(refreshSettlementLedger(ledgerFromRows([], 1n, start, now.toISOString()), f.reader, now, limits), /invalid_settlement_scan_limits/)
  }
  assert.equal(calls, 0)
})

test('offline repair crosses a dense overlap that cannot progress in a cron budget', async () => {
  const cursor = start + 200n, rows = Array.from({ length: 250 }, (_, i) => transfer(start + 73n + BigInt(i), i))
  const f = fixture(rows, start + 400n)
  let saved: LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0', ledger: ledgerFromRows(rows.filter(r => r.blockNumber <= cursor).map(r => ({ ...r, timestampUtc: now.toISOString() })), 1n, cursor, now.toISOString()), caughtUp: false, finalizedBlock: String(cursor) }
  let writes = 0
  const store: SettlementStore = { read: async () => saved, acquire: async () => true, release: async () => {},
    publish: async (_owner, next) => { saved = next; writes++; return true } }
  const next = await backfillSettlements({ store, reader: f.reader, backup: async () => {} })
  assert.ok(validLiveSnapshot(next)); assert.equal(next.ledger.entries.length, 250)
  assert.equal(next.caughtUp, true); assert.equal(writes, 1)
})
test('an RPC or timestamp failure during a bounded-prefix refresh never publishes or changes saved history', async () => {
  const rows = Array.from({ length: 100 }, (_, i) => transfer(start + 10n + BigInt(i * 4), i))
  const old: LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0', ledger: ledgerFromRows([], 1n, start, now.toISOString()), caughtUp: false, finalizedBlock: String(start) }
  const before = JSON.stringify(old)
  let writes = 0, releases = 0
  const store: SettlementStore = { read: async () => old, acquire: async () => true, release: async () => { releases++ },
    publish: async () => { writes++; return true } }
  for (const failure of ['transfers', 'timestamp'] as const) {
    const f = fixture(rows, start + 500n)
    f.reader[failure] = async () => { throw new Error('test_rpc_failure') }
    await assert.rejects(refreshStoredSettlements(store, f.reader, now), /test_rpc_failure/)
    assert.equal(writes, 0); assert.equal(JSON.stringify(old), before)
  }
  assert.equal(releases, 2)
})
test('conflicting logs beyond the admitted prefix cannot hide behind the work budget', async () => {
  const rows = Array.from({ length: 90 }, (_, i) => transfer(start + 10n + BigInt(i * 4), i))
  rows.push({ ...rows.at(-1)!, amountBaseUnits: 42n })
  const f = fixture(rows, start + 500n)
  await assert.rejects(refreshSettlementLedger(ledgerFromRows([], 1n, start, now.toISOString()), f.reader, now), /conflicting_transfer_log/)
  assert.equal(f.stamps(), 0)
})
test('a failed Base chain does not stop other chains, and diagnostics redact RPC credentials', async () => {
  const errors: unknown[][] = [], original = console.error
  console.error = (...args) => { errors.push(args) }
  try {
    const result = await refreshSettlementNetworks(['eip155:8453', 'eip155:42161', 'eip155:137'], async network => {
      if (network === 'eip155:8453') throw new Error('429 rate limit https://rpc.invalid/private-secret-key')
      return { status: 'already_running' as const }
    })
    assert.equal(result.status, 'degraded')
    assert.deepEqual(result.networks.map(n => n.status), ['failed', 'already_running', 'already_running'])
    assert.match(JSON.stringify(errors), /rate_limited/)
    assert.doesNotMatch(JSON.stringify(errors) + JSON.stringify(result), /private-secret-key|rpc.invalid/)
  } finally { console.error = original }
})
test('the product page distinguishes recent bounded progress from a fully caught-up snapshot', () => {
  const page = readFileSync('app/developers/x402-products/page.tsx', 'utf8')
  assert.match(page, /!snapshot.caughtUp \? 'catching up/)
})
