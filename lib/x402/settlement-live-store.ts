import { randomUUID } from 'node:crypto'
import { getRedis } from '../redis.ts'
import { scopedRedisKey } from '../redis-namespace.ts'
import seed from '../../content/x402/settlement-ledger.json' with { type: 'json' }
import type { SettlementLedger } from './settlement-ledger.ts'
import { baseSettlementReader, ledgerFromRows, refreshSettlementLedger, type SettlementReader } from './settlement-refresh.ts'

export type LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0'; ledger: SettlementLedger; caughtUp: boolean; finalizedBlock: string }
export const SNAPSHOT_KEY = 'x402:settlement-ledger:live:v1'
const LOCK_KEY = `${SNAPSHOT_KEY}:lock`
export const bundledLedger = seed as unknown as SettlementLedger
export interface SettlementStore {
  read(): Promise<LiveSnapshot | null>
  acquire(owner: string): Promise<boolean>
  publish(owner: string, value: LiveSnapshot): Promise<boolean>
  release(owner: string): Promise<void>
}

export function settlementStore(): SettlementStore {
  const redis = getRedis(), snapshot = scopedRedisKey(SNAPSHOT_KEY), lock = scopedRedisKey(LOCK_KEY)
  return {
    read: () => redis.get<LiveSnapshot>(snapshot),
    acquire: async (owner) => (await redis.set(lock, owner, { nx: true, ex: 55 })) === 'OK',
    publish: async (owner, value) => (await redis.eval(
      "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2]) redis.call('DEL', KEYS[1]) return 1",
      [lock, snapshot], [owner, JSON.stringify(value)],
    )) === 1,
    release: async (owner) => { await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", [lock], [owner]) },
  }
}

export function validLiveSnapshot(value: LiveSnapshot | null): value is LiveSnapshot {
  try {
  if (!(value && value.schemaVersion === 'maha-live-settlements/1.0' && typeof value.caughtUp === 'boolean'
    && /^\d+$/.test(value.finalizedBlock) && value.ledger?.schemaVersion === 'maha-x402-settlement-ledger/1.0'
    && Array.isArray(value.ledger.entries) && value.ledger.summary && /^\d+$/.test(value.ledger.scannedToBlock)
    && /^\d+$/.test(value.ledger.scannedFromBlock)
    && BigInt(value.ledger.scannedToBlock) >= BigInt(value.ledger.scannedFromBlock)
    && BigInt(value.finalizedBlock) >= BigInt(value.ledger.scannedToBlock)
    && Number.isFinite(Date.parse(value.ledger.observedAt)))) return false
  const seen = new Set<string>()
  const rows = value.ledger.entries.map(row => {
    const key = `${row.transactionHash}:${row.logIndex ?? 'legacy'}`
    if (!/^0x[\da-f]{64}$/i.test(row.transactionHash) || !/^0x[\da-f]{40}$/i.test(row.payer)
      || !/^\d+$/.test(row.amountBaseUnits) || !/^\d+$/.test(row.blockNumber)
      || BigInt(row.blockNumber) < BigInt(value.ledger.scannedFromBlock)
      || BigInt(row.blockNumber) > BigInt(value.ledger.scannedToBlock)
      || (row.timestampUtc !== null && !Number.isFinite(Date.parse(row.timestampUtc)))
      || (row.logIndex !== undefined && (!Number.isInteger(row.logIndex) || row.logIndex < 0))
      || seen.has(key)) throw new Error('invalid_saved_row')
    seen.add(key)
    return { ...row, amountBaseUnits: BigInt(row.amountBaseUnits), blockNumber: BigInt(row.blockNumber) }
  })
  const rebuilt = ledgerFromRows(rows, BigInt(value.ledger.scannedFromBlock), BigInt(value.ledger.scannedToBlock), value.ledger.observedAt)
  return rebuilt.contentDigest === value.ledger.contentDigest
    && JSON.stringify(rebuilt.summary) === JSON.stringify(value.ledger.summary)
    && JSON.stringify(rebuilt.entries) === JSON.stringify(value.ledger.entries)
  } catch { return false }
}

export async function readPublicSettlementLedger(store?: Pick<SettlementStore, 'read'>, now = new Date()) {
  try {
    const value = await (store ?? settlementStore()).read()
    if (validLiveSnapshot(value) && BigInt(value.ledger.scannedToBlock) >= BigInt(bundledLedger.scannedToBlock)) return {
      ledger: value.ledger, source: 'scheduled_snapshot' as const, caughtUp: value.caughtUp,
      stale: now.getTime() - Date.parse(value.ledger.observedAt) > 2 * 60 * 60 * 1000,
    }
  } catch { /* Preserve the bundled record without disguising its age. */ }
  return { ledger: bundledLedger, source: 'bundled_fallback' as const, caughtUp: false, stale: true }
}

export async function refreshStoredSettlements(store: SettlementStore, reader: SettlementReader = baseSettlementReader(), now = new Date()) {
  const owner = randomUUID()
  if (!await store.acquire(owner)) return { status: 'already_running' as const }
  try {
    const saved = await store.read()
    if (saved && !validLiveSnapshot(saved)) throw new Error('invalid_saved_snapshot')
    const previous = saved && BigInt(saved.ledger.scannedToBlock) >= BigInt(bundledLedger.scannedToBlock) ? saved.ledger : bundledLedger
    const result = await refreshSettlementLedger(previous, reader, now)
    const published = await store.publish(owner, { schemaVersion: 'maha-live-settlements/1.0', ...result })
    if (!published) throw new Error('refresh_lock_expired')
    return { status: 'updated' as const, observedAt: result.ledger.observedAt, caughtUp: result.caughtUp,
      scannedToBlock: result.ledger.scannedToBlock, summary: result.ledger.summary }
  } finally { await store.release(owner) }
}
