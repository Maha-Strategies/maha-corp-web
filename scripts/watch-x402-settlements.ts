/**
 * Report who paid for the Context Compiler, and whether anyone came back.
 *
 *   node --experimental-strip-types scripts/watch-x402-settlements.ts [--days 30]
 *
 * Reads USDC Transfer logs into the payee on Base Mainnet. No credentials, no
 * database, no wallet: it holds nothing and can spend nothing, which is why it
 * can run anywhere on a schedule without a secret to leak.
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

import { createPublicClient, formatUnits, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'

import { BASE_USDC, MAHA_PAYEE, OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { buildSettlementWatch, describeWatch, type Settlement } from '../lib/x402/settlement-watch.ts'

/**
 * The prices a customer can legitimately pay, taken from the offer catalog so a
 * new offer is counted the day it is published rather than the day someone
 * remembers to widen a constant.
 */
const PUBLISHED_PRICES = [...new Set(X402_OFFERS.map((offer) => BigInt(offer.amount)))].sort((a, b) => (a < b ? -1 : 1))

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
/** Public RPCs reject wide ranges; this is the largest most accept. */
const CHUNK = BigInt(9_000)
/** Base produces a block roughly every two seconds. */
const BLOCKS_PER_DAY = BigInt(43_200)

function argument(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const days = Math.max(1, Math.min(90, Number(argument('--days', '30')) || 30))
const reported = argument('--reported', '').split(',').map((value) => value.trim()).filter(Boolean)

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL?.trim() || undefined),
})

/**
 * One chunk, with a bounded retry.
 *
 * A public endpoint refusing a single range should not lose the whole scan and
 * report zero settlements, because zero is indistinguishable from "nobody paid"
 * and that is the reading this tool exists to get right. A range that will not
 * load after three attempts throws rather than being skipped silently.
 */
async function logsFor(fromBlock: bigint, toBlock: bigint) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.getLogs({ address: BASE_USDC as `0x${string}`, event: TRANSFER, args: { to: MAHA_PAYEE as `0x${string}` }, fromBlock, toBlock })
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw new Error(`Could not read blocks ${fromBlock}-${toBlock}: ${lastError instanceof Error ? lastError.message : 'unknown'}`)
}

const latest = await client.getBlockNumber()
const earliest = latest > BLOCKS_PER_DAY * BigInt(days) ? latest - BLOCKS_PER_DAY * BigInt(days) : BigInt(0)

const settlements: Settlement[] = []
for (let from = earliest; from <= latest; from += CHUNK + BigInt(1)) {
  const to = from + CHUNK > latest ? latest : from + CHUNK
  for (const log of await logsFor(from, to)) {
    settlements.push({
      payer: log.args.from as string,
      amountBaseUnits: log.args.value as bigint,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    })
  }
}

const report = buildSettlementWatch({
  settlements,
  operatorWallets: [...OPERATOR_WALLETS],
  // Every published price, derived from the catalog rather than pinned. The
  // canary's buyer-policy ceiling is not the definition of a sale.
  expectedAmountsBaseUnits: PUBLISHED_PRICES,
  fromBlock: earliest,
  toBlock: latest,
  alreadyReportedPayers: reported,
})

const usd = (baseUnits: string) => `${formatUnits(BigInt(baseUnits), 6)} USDC`

console.log(`\nx402 settlement watch — last ${days} days (blocks ${earliest}–${latest})\n`)
console.log(`  external settlements : ${report.totals.externalSettlements}`)
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
      console.log(`    REPEAT BUYER — ${event.payer} settled ${event.settlements} times. This is the demand-validation gate.`)
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
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
}

// A notable event is news, not a failure. Exit 0 either way and let the caller
// decide what to do with it; a non-zero exit here would read as a broken watch.
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises')
  const repeat = report.notable.some((event) => event.kind === 'repeat_external_settlement')
  await appendFile(process.env.GITHUB_OUTPUT, `notable=${report.notable.length > 0}\nrepeat_buyer=${repeat}\nsummary=${describeWatch(report)}\n`)
}
