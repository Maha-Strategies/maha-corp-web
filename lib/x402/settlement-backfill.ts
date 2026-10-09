import { randomUUID } from 'node:crypto'
import { bundledLedger, validLiveSnapshot, type LiveSnapshot, type SettlementStore } from './settlement-live-store.ts'
import { refreshSettlementLedger, type SettlementReader } from './settlement-refresh.ts'

/** Scan outside the short publication lock; publish only a complete, unchanged-base repair. */
export async function backfillSettlements(options: {
  store: SettlementStore
  reader: SettlementReader
  backup: (previous: LiveSnapshot | null) => Promise<void>
  maxPasses?: number
  progress?: (cursor: string, target: string) => void
}) {
  const previous = await options.store.read()
  if (previous && !validLiveSnapshot(previous)) throw new Error('invalid_saved_snapshot')
  const initial = JSON.stringify(previous)
  let ledger = previous && BigInt(previous.ledger.scannedToBlock) >= BigInt(bundledLedger.scannedToBlock)
    ? previous.ledger : bundledLedger
  const head = await options.reader.finalizedBlock()
  const reader = { ...options.reader, finalizedBlock: async () => head }
  const maxPasses = options.maxPasses ?? 100
  if (!Number.isInteger(maxPasses) || maxPasses < 1 || maxPasses > 1000) throw new Error('invalid_backfill_limit')
  let complete: LiveSnapshot | undefined
  for (let pass = 0; pass < maxPasses; pass++) {
    const result = await refreshSettlementLedger(ledger, reader)
    ledger = result.ledger
    options.progress?.(ledger.scannedToBlock, head.toString())
    if (result.caughtUp) {
      complete = { schemaVersion: 'maha-live-settlements/1.0', ...result }
      break
    }
  }
  if (!complete) throw new Error('backfill_limit_exceeded_no_publication')
  if (!validLiveSnapshot(complete)) throw new Error('invalid_backfill_snapshot')
  await options.backup(previous)
  const owner = randomUUID()
  if (!await options.store.acquire(owner)) throw new Error('refresh_already_running')
  try {
    if (JSON.stringify(await options.store.read()) !== initial) throw new Error('snapshot_changed_retry_backfill')
    if (!await options.store.publish(owner, complete)) throw new Error('refresh_lock_expired')
  } finally { await options.store.release(owner) }
  return complete
}
