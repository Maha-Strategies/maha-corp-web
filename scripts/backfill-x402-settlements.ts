/** Explicit operator operation. Reads Base; writes only a completed Redis snapshot and private backup. */
import { writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { backfillSettlements } from '../lib/x402/settlement-backfill.ts'
import { settlementStore } from '../lib/x402/settlement-live-store.ts'
import { baseSettlementReader } from '../lib/x402/settlement-refresh.ts'

const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice('--backup='.length)
if (!backup || !isAbsolute(backup) || resolve(backup).startsWith(resolve('.') + '/')) {
  throw new Error('Provide an absolute --backup path outside the source checkout.')
}
if (process.env.VERCEL_ENV !== 'production' || process.env.MAHA_SETTLEMENT_BACKFILL_APPROVED !== 'yes') {
  throw new Error('Explicit production backfill acknowledgment required.')
}
const result = await backfillSettlements({
  store: settlementStore(), reader: baseSettlementReader({ timeout: 15000, minLogIntervalMs: 1500 }),
  backup: async previous => writeFile(backup, JSON.stringify(previous, null, 2) + '\n', { flag: 'wx', mode: 0o600 }),
  progress: (cursor, target) => console.log(JSON.stringify({ scannedToBlock: cursor, target })),
})
console.log(JSON.stringify({ status: 'published', observedAt: result.ledger.observedAt,
  scannedToBlock: result.ledger.scannedToBlock, summary: result.ledger.summary }))
