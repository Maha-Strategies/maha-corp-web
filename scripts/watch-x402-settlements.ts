/**
 * Report who paid for the Context Compiler, and whether anyone came back.
 *
 *   node --experimental-strip-types scripts/watch-x402-settlements.ts [--days 30]
 *
 * Reads USDC Transfer logs into the payee on Base Mainnet using a read-only
 * RPC endpoint. No database or signing key; it cannot spend. Keep a managed
 * endpoint's access key in BASE_RPC_URL, never in output artifacts.
 *
 * Stateless by design. Rather than remembering which payers it has seen, it
 * rescans a window and recomputes the whole picture, so a lost state file
 * cannot make it forget a customer. Deduplicating the *notification* is the
 * caller's job -- the workflow does it by updating one issue rather than
 * opening many.
 *
 * `--reported <addresses>` marks payers already announced, so a first-settlement
 * alert fires once rather than on every scheduled run.
 */

import { formatUnits } from 'viem'

import { MAHA_PAYEE, OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { buildSettlementWatch, describeWatch, type Settlement } from '../lib/x402/settlement-watch.ts'
import { evmSettlementReader } from '../lib/x402/settlement-refresh.ts'
import { usdcNetwork, type UsdcNetwork } from '../lib/x402/networks.ts'

/**
 * The prices a customer can legitimately pay, taken from the offer catalog so a
 * new offer is counted the day it is published rather than the day someone
 * remembers to widen a constant.
 */
const PUBLISHED_PRICES = [...new Set(payableOffers().flatMap((offer) => [offer.amount, ...(offer.supersededAmounts ?? [])]).map(BigInt))].sort((a, b) => (a < b ? -1 : 1))

function argument(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const days = Math.max(1, Math.min(90, Number(argument('--days', '2')) || 2))
const reported = argument('--reported', '').split(',').map((value) => value.trim()).filter(Boolean)

const network = argument('--network', 'eip155:8453') as UsdcNetwork
const definition = usdcNetwork(network)
const reader = evmSettlementReader(network)
const latest = await reader.finalizedBlock()
// Locate the time boundary, not a Base-specific block-rate guess on Arbitrum.
const threshold = Date.parse(await reader.timestamp(latest)) - days * 86400000
let low = BigInt(0), high = latest
while (low < high) {
  const mid = (low + high) / BigInt(2)
  if (Date.parse(await reader.timestamp(mid)) < threshold) low = mid + BigInt(1)
  else high = mid
}
const earliest = low

const settlements: Settlement[] = await reader.transfers(earliest, latest)

const report = buildSettlementWatch({
  settlements,
  operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
  // Every published price, derived from the catalog rather than pinned. The
  // canary's buyer-policy ceiling is not the definition of a sale.
  expectedAmountsBaseUnits: PUBLISHED_PRICES,
  fromBlock: earliest,
  toBlock: latest,
  alreadyReportedPayers: reported,
})

const usd = (baseUnits: string) => `${formatUnits(BigInt(baseUnits), 6)} USDC`

console.log(`\nx402 settlement watch — last ${days} days (blocks ${earliest}–${latest})\n`)
console.log(`  external matching transfers : ${report.totals.externalSettlements}`)
console.log(`  external payers      : ${report.totals.externalPayers}`)
console.log(`  repeat payers        : ${report.totals.repeatExternalPayers}`)
console.log(`  canary settlements   : ${report.totals.canarySettlements}  (excluded from every figure above)`)

if (report.externalPayers.length > 0) {
  console.log('\n  external:')
  for (const payer of report.externalPayers) {
    console.log(`    ${payer.payer}  ${payer.settlements}x  ${usd(payer.totalBaseUnits)}${payer.repeat ? '  [REPEAT]' : ''}`)
  }
}

if (report.notable.length > 0) {
  console.log('\n  notable:')
  for (const event of report.notable) {
    if (event.kind === 'repeat_external_settlement') {
      console.log(`    REPEAT TRANSFER — ${event.payer} sent ${event.settlements} price-matching transfers. Purchase, delivery and independent demand are unverified.`)
    } else if (event.kind === 'first_external_settlement') {
      console.log(`    NEW EXTERNAL PAYER — ${event.payer} (${event.transactionHash})`)
    } else {
      console.log(`    UNEXPECTED AMOUNT — ${event.payer} sent ${usd(event.amountBaseUnits)} (${event.transactionHash}); not counted as a sale`)
    }
  }
}

console.log(`\n  ${describeWatch(report)}`)
console.log(`\n  ${report.interpretation}\n`)

if (process.env.X402_WATCH_OUTPUT_PATH?.trim()) {
  const { writeFile, mkdir } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  const path = process.env.X402_WATCH_OUTPUT_PATH.trim()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify({ ...report, network, networkName: definition.name }, null, 2)}\n`)
}

// A notable event is news, not a failure. Exit 0 either way and let the caller
// decide what to do with it; a non-zero exit here would read as a broken watch.
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises')
  const repeat = report.notable.some((event) => event.kind === 'repeat_external_settlement')
  await appendFile(process.env.GITHUB_OUTPUT, `notable=${report.notable.length > 0}\nrepeat_buyer=${repeat}\nsummary=${describeWatch(report)}\n`)
}
