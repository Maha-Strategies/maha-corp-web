import { randomUUID } from 'node:crypto'
import { getRedis } from '../redis.ts'
import { scopedRedisKey } from '../redis-namespace.ts'
import seed from '../../content/x402/settlement-ledger.json' with { type: 'json' }
import { buildLedger, type SettlementLedger } from './settlement-ledger.ts'
import { OPERATOR_WALLETS, MAHA_PAYEE } from './discovery-payment-recipe.ts'
import { baseSettlementReader, evmSettlementReader, ledgerFromRows, refreshSettlementLedger, type SettlementReader } from './settlement-refresh.ts'
import { isOperatorSettlementReceipt, type OperatorSettlementReceipt } from './operator-settlement-receipts.ts'
import { settlementNetworks, type UsdcNetwork } from './networks.ts'
import { combineSettlementLedgers } from './settlement-multichain.ts'
import { settlementRefreshFailure } from './settlement-rpc.ts'

export type LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0'; ledger: SettlementLedger; caughtUp: boolean; finalizedBlock: string }
export const SNAPSHOT_KEY = 'x402:settlement-ledger:live:v1'
export const bundledLedger = seed as unknown as SettlementLedger
export interface SettlementStore {
  read(): Promise<LiveSnapshot | null>
  acquire(owner: string): Promise<boolean>
  publish(owner: string, value: LiveSnapshot): Promise<boolean>
  release(owner: string): Promise<void>
}

export function settlementStore(network: UsdcNetwork = 'eip155:8453'): SettlementStore {
  const key = network === 'eip155:8453' ? SNAPSHOT_KEY : `${SNAPSHOT_KEY}:${network}`
  const redis = getRedis(), snapshot = scopedRedisKey(key), lock = scopedRedisKey(`${key}:lock`)
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

/**
 * A saved snapshot is untrusted until rebuilding it from its own rows, its own
 * scan-time catalogue and its own recorded receipts reproduces it exactly.
 *
 * Both ledger versions validate. A 1.0 snapshot, saved before receipts
 * existed, rebuilds by amount alone; rejecting it would stop the hourly refresh
 * at invalid_saved_snapshot. A 1.1 snapshot rebuilds with the receipts it
 * records. Neither version's recorded receipts reach the public page: the read
 * path reprojects the rows with the committed receipts (currentCatalogueLedger).
 */
export function validLiveSnapshot(value: LiveSnapshot | null, expectedNetwork: UsdcNetwork = 'eip155:8453'): value is LiveSnapshot {
  try {
  const version = value?.ledger?.schemaVersion
  if ((value?.ledger?.caip2Network ?? 'eip155:8453') !== expectedNetwork) return false
  if (!(value && value.schemaVersion === 'maha-live-settlements/1.0' && typeof value.caughtUp === 'boolean'
    && /^\d+$/.test(value.finalizedBlock) && (version === 'maha-x402-settlement-ledger/1.0' || version === 'maha-x402-settlement-ledger/1.1')
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
  // Validate against the catalogue recorded at scan time. A newly published
  // offer must not turn intact saved chain history into an invalid snapshot.
  const units = (price: string) => {
    if (!/^\d+(?:\.\d{1,6})?$/.test(price)) throw new Error('invalid_saved_price')
    const [whole, fraction = ''] = price.split('.')
    return BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, '0'))
  }
  const offers = value.ledger.summary.byProduct.map(offer => ({
    id: offer.id, title: offer.title, amountBaseUnits: units(offer.priceUsdc),
    ...(offer.supersededPricesUsdc ? { supersededAmountsBaseUnits: offer.supersededPricesUsdc.map(units) } : {}),
  }))
  if (new Set(offers.map(offer => offer.id)).size !== offers.length) return false
  let operatorReceipts: OperatorSettlementReceipt[] | undefined
  if (version === 'maha-x402-settlement-ledger/1.1') {
    const receipts = value.ledger.attribution?.receipts
    if (!Array.isArray(receipts) || !receipts.every(isOperatorSettlementReceipt)) return false
    operatorReceipts = receipts
  } else if (value.ledger.attribution !== undefined) return false
  const rebuilt = buildLedger({ settlements: rows, offers, operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
    caip2Network: expectedNetwork,
    fromBlock: BigInt(value.ledger.scannedFromBlock), toBlock: BigInt(value.ledger.scannedToBlock), observedAt: value.ledger.observedAt,
    ...(version === 'maha-x402-settlement-ledger/1.1' ? { operatorReceipts } : {}) })
  return rebuilt.schemaVersion === version
    && rebuilt.network === value.ledger.network && rebuilt.protocol === value.ledger.protocol
    && rebuilt.contentDigest === value.ledger.contentDigest
    && JSON.stringify(rebuilt.summary) === JSON.stringify(value.ledger.summary)
    && JSON.stringify(rebuilt.entries) === JSON.stringify(value.ledger.entries)
    && JSON.stringify(rebuilt.attribution) === JSON.stringify(value.ledger.attribution)
  } catch { return false }
}

/** Current catalogue labels, same observed transfers and scan date; no RPC or saved-state write. */
export function currentCatalogueLedger(ledger: SettlementLedger) {
  return ledgerFromRows(ledger.entries.map(row => ({ ...row, amountBaseUnits: BigInt(row.amountBaseUnits), blockNumber: BigInt(row.blockNumber) })),
    BigInt(ledger.scannedFromBlock), BigInt(ledger.scannedToBlock), ledger.observedAt, (ledger.caip2Network ?? 'eip155:8453') as UsdcNetwork)
}

export async function readPublicSettlementLedger(store?: Pick<SettlementStore, 'read'>, now = new Date()) {
  // Preserve the legacy injected-store seam; production aggregates enabled chains.
  if (!store && settlementNetworks().length > 1) {
    const networks = await Promise.all(settlementNetworks().map(network => readNetworkLedger(network, undefined, now)))
    return { ledger: combineSettlementLedgers(networks.map(view => view.ledger)), networks,
      source: networks.every(view => view.source === 'scheduled_snapshot') ? 'scheduled_snapshot' as const : 'bundled_fallback' as const,
      caughtUp: networks.every(view => view.caughtUp), stale: networks.some(view => view.stale) }
  }
  return readNetworkLedger('eip155:8453', store, now)
}

export function networkSeed(network: UsdcNetwork): SettlementLedger {
  if (network === 'eip155:8453') return bundledLedger
  const from = process.env.X402_ARBITRUM_FROM_BLOCK?.trim()
  if (!from || !/^[1-9]\d*$/.test(from)) throw new Error('arbitrum_start_block_required')
  return ledgerFromRows([], BigInt(from), BigInt(from), '1970-01-01T00:00:00.000Z', network)
}

export async function readNetworkLedger(network: UsdcNetwork, store?: Pick<SettlementStore, 'read'>, now = new Date()) {
  const seed = networkSeed(network)
  try {
    const value = await (store ?? settlementStore(network)).read()
    if (validLiveSnapshot(value, network) && BigInt(value.ledger.scannedToBlock) >= BigInt(seed.scannedToBlock)) return {
      ledger: currentCatalogueLedger(value.ledger), source: 'scheduled_snapshot' as const, caughtUp: value.caughtUp,
      stale: now.getTime() - Date.parse(value.ledger.observedAt) > 2 * 60 * 60 * 1000,
    }
  } catch { /* Preserve the bundled record without disguising its age. */ }
  return { ledger: currentCatalogueLedger(seed), source: 'bundled_fallback' as const, caughtUp: false, stale: true }
}

export async function refreshStoredSettlements(store: SettlementStore, reader: SettlementReader = baseSettlementReader(), now = new Date(), seed = networkSeed(reader.caip2Network ?? 'eip155:8453')) {
  const owner = randomUUID()
  if (!await store.acquire(owner)) return { status: 'already_running' as const }
  try {
    const saved = await store.read()
    if (saved && !validLiveSnapshot(saved, reader.caip2Network ?? 'eip155:8453')) throw new Error('invalid_saved_snapshot')
    const previous = saved && BigInt(saved.ledger.scannedToBlock) >= BigInt(seed.scannedToBlock) ? saved.ledger : seed
    const result = await refreshSettlementLedger(previous, reader, now)
    const published = await store.publish(owner, { schemaVersion: 'maha-live-settlements/1.0', ...result })
    if (!published) throw new Error('refresh_lock_expired')
    return { status: 'updated' as const, observedAt: result.ledger.observedAt, caughtUp: result.caughtUp,
      scannedToBlock: result.ledger.scannedToBlock, summary: result.ledger.summary }
  } finally { await store.release(owner) }
}

/** A failing chain never prevents the other chain from publishing its successful scan. */
export async function refreshAllStoredSettlements() {
  const results = await Promise.all(settlementNetworks().map(async network => {
    try { return { network, ...await refreshStoredSettlements(settlementStore(network), evmSettlementReader(network)) } }
    catch (error) { return { network, status: 'failed' as const, reason: settlementRefreshFailure(error), previousSnapshotRetained: true } }
  }))
  return { status: results.some(result => result.status === 'failed') ? 'degraded' : 'updated', networks: results }
}
