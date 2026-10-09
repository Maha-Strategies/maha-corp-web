import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backfillSettlements } from '../lib/x402/settlement-backfill.ts'
import { bundledLedger, type LiveSnapshot, type SettlementStore } from '../lib/x402/settlement-live-store.ts'
import { ledgerFromRows, MAX_SCAN_BLOCKS, type SettlementReader } from '../lib/x402/settlement-refresh.ts'

const cursor = BigInt(bundledLedger.scannedToBlock) + BigInt(1000)
const initial = (): LiveSnapshot => ({ schemaVersion: 'maha-live-settlements/1.0',
  ledger: ledgerFromRows([], BigInt(1), cursor, new Date().toISOString()), caughtUp: true, finalizedBlock: cursor.toString() })
function harness() {
  let saved = initial(), writes = 0, released = false
  const store: SettlementStore = { read: async () => saved, acquire: async () => true,
    publish: async (_owner, next) => { saved = next; writes++; return true }, release: async () => { released = true } }
  const reader: SettlementReader = { finalizedBlock: async () => cursor + MAX_SCAN_BLOCKS,
    transfers: async () => [], timestamp: async () => new Date().toISOString() }
  return { store, reader, replace: () => { saved = { ...saved, caughtUp: false } }, state: () => ({ saved, writes, released }) }
}
test('offline backfill backs up old state and publishes once, only after reaching a pinned head', async () => {
  const h = harness(); let heads = 0, backedUp = false
  h.reader.finalizedBlock = async () => { heads++; return cursor + MAX_SCAN_BLOCKS }
  const result = await backfillSettlements({ ...h, backup: async previous => {
    assert.equal(previous?.ledger.scannedToBlock, cursor.toString()); assert.equal(h.state().writes, 0); backedUp = true
  } })
  assert.equal(heads, 1); assert.equal(backedUp, true); assert.equal(result.caughtUp, true)
  assert.equal(h.state().writes, 1); assert.equal(h.state().released, true)
})
test('failed range cannot publish a partial backfill', async () => {
  const h = harness(); h.reader.transfers = async () => { throw new Error('RPC unavailable') }
  await assert.rejects(backfillSettlements({ ...h, backup: async () => {} }), /RPC unavailable/)
  assert.equal(h.state().writes, 0)
})
test('backfill refuses concurrent snapshot change instead of overwriting it', async () => {
  const h = harness()
  await assert.rejects(backfillSettlements({ ...h, backup: async () => { h.replace() } }), /snapshot_changed/)
  assert.equal(h.state().writes, 0); assert.equal(h.state().released, true)
})
test('failed backup prevents publication', async () => {
  const h = harness()
  await assert.rejects(backfillSettlements({ ...h, backup: async () => { throw new Error('backup unavailable') } }), /backup unavailable/)
  assert.equal(h.state().writes, 0)
})
test('bounded incomplete backfill leaves the old snapshot untouched', async () => {
  const h = harness()
  await assert.rejects(backfillSettlements({ ...h, backup: async () => {}, maxPasses: 1 }), /backfill_limit_exceeded/)
  assert.equal(h.state().writes, 0)
})
