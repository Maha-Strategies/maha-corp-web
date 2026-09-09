/** Read-only Base scan; regenerate the deployment fallback. No wallet or paid API calls. */
import { writeFileSync } from 'node:fs'
import { bundledLedger } from '../lib/x402/settlement-live-store.ts'
import { baseSettlementReader, refreshSettlementLedger } from '../lib/x402/settlement-refresh.ts'

let ledger = bundledLedger
let complete = false
for (let attempt = 0; attempt < 10; attempt++) {
  const result = await refreshSettlementLedger(ledger, baseSettlementReader({ timeout: 30000, retryCount: 2 }))
  ledger = result.ledger
  if (result.caughtUp) { complete = true; break }
}
if (!complete) throw new Error('Backlog exceeds bounded offline refresh; no file written.')
writeFileSync(new URL('../content/x402/settlement-ledger.json', import.meta.url), JSON.stringify(ledger, null, 2) + '\n')
console.log(JSON.stringify({ observedAt: ledger.observedAt, scannedToBlock: ledger.scannedToBlock, summary: ledger.summary }))
