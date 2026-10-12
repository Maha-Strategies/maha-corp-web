/** Explicit operator operation. Reads Base; writes only a completed Redis snapshot and private backup. */
import { writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { backfillSettlements } from '../lib/x402/settlement-backfill.ts'
import { settlementStore } from '../lib/x402/settlement-live-store.ts'
import { evmSettlementReader } from '../lib/x402/settlement-refresh.ts'
import { usdcNetwork, type UsdcNetwork } from '../lib/x402/networks.ts'

const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice('--backup='.length)
const network = (process.argv.find(arg => arg.startsWith('--network='))?.slice('--network='.length) ?? 'eip155:8453') as UsdcNetwork
usdcNetwork(network)
if (!backup || !isAbsolute(backup) || resolve(backup).startsWith(resolve('.') + '/')) {
  throw new Error('Provide an absolute --backup path outside the source checkout.')
}
if (process.env.VERCEL_ENV !== 'production' || process.env.MAHA_SETTLEMENT_BACKFILL_APPROVED !== 'yes') {
  throw new Error('Explicit production backfill acknowledgment required.')
}
const result = await backfillSettlements({
  store: settlementStore(network), reader: evmSettlementReader(network, { timeout: 15000, minRpcIntervalMs: 500 }),
  backup: async previous => writeFile(backup, JSON.stringify(previous, null, 2) + '\n', { flag: 'wx', mode: 0o600 }),
  progress: (cursor, target) => console.log(JSON.stringify({ scannedToBlock: cursor, target })),
})
console.log(JSON.stringify({ status: 'published', network, observedAt: result.ledger.observedAt,
  scannedToBlock: result.ledger.scannedToBlock, summary: result.ledger.summary }))
