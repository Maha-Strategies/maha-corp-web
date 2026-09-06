/**
 * Scans Base for settlements into the Maha payee and writes the public ledger
 * snapshot the /developers/settlement page renders.
 *
 *   node --experimental-strip-types scripts/generate-x402-settlement-ledger.ts [--days 60]
 *
 * A snapshot rather than a live query. Scanning sixty days takes hundreds of
 * chunked RPC calls and roughly a minute; doing that inside a page request
 * would make the page slow, fragile against a public endpoint refusing a range,
 * and dependent on an RPC being reachable at the moment a reader arrives. The
 * snapshot carries its own observedAt so a stale one is visible as stale rather
 * than silently presented as current.
 *
 * Read-only. No credentials, no wallet, nothing it can spend.
 */
import { writeFileSync } from 'node:fs'

import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'

import { BASE_USDC, MAHA_PAYEE, OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { buildLedger, type OfferPrice } from '../lib/x402/settlement-ledger.ts'

const OUT = 'content/x402/settlement-ledger.json'
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const CHUNK = BigInt(9_000)
const BLOCKS_PER_DAY = BigInt(43_200)

const flag = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const days = Math.max(1, Math.min(90, Number(flag('--days', '60')) || 60))

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL?.trim() || undefined) })

async function logsFor(fromBlock: bigint, toBlock: bigint) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.getLogs({
        address: BASE_USDC as `0x${string}`, event: TRANSFER,
        args: { to: MAHA_PAYEE as `0x${string}` }, fromBlock, toBlock,
      })
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  // Throws rather than skipping: a silently dropped range reports fewer
  // settlements, and "fewer" is indistinguishable from "nobody paid".
  throw new Error(`Could not read blocks ${fromBlock}-${toBlock}: ${lastError instanceof Error ? lastError.message : 'unknown'}`)
}

const latest = await client.getBlockNumber()
const earliest = latest > BLOCKS_PER_DAY * BigInt(days) ? latest - BLOCKS_PER_DAY * BigInt(days) : BigInt(0)

const rows: { payer: string; amountBaseUnits: bigint; blockNumber: bigint; transactionHash: string; timestampUtc: string | null }[] = []
for (let from = earliest; from <= latest; from += CHUNK + BigInt(1)) {
  const to = from + CHUNK > latest ? latest : from + CHUNK
  for (const log of await logsFor(from, to)) {
    rows.push({
      payer: log.args.from as string,
      amountBaseUnits: log.args.value as bigint,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      timestampUtc: null,
    })
  }
}

/** Block timestamps, fetched only for rows that will be displayed. */
const priced = new Set(X402_OFFERS.map((o) => BigInt(o.amount)))
const blocks = [...new Set(rows.filter((r) => priced.has(r.amountBaseUnits)).map((r) => r.blockNumber))]
const timestamps = new Map<bigint, string>()
for (const blockNumber of blocks) {
  const block = await client.getBlock({ blockNumber })
  timestamps.set(blockNumber, new Date(Number(block.timestamp) * 1000).toISOString())
}
for (const row of rows) row.timestampUtc = timestamps.get(row.blockNumber) ?? null

const offers: OfferPrice[] = X402_OFFERS.map((o) => ({
  id: o.id,
  // serviceName is shared across offers from one service, so two products both
  // read as "Maha Context Compiler". The id distinguishes them.
  title: o.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  amountBaseUnits: BigInt(o.amount),
}))

const ledger = buildLedger({
  settlements: rows,
  operatorWallets: OPERATOR_WALLETS,
  offers,
  observedAt: new Date().toISOString(),
  fromBlock: earliest,
  toBlock: latest,
})

writeFileSync(OUT, `${JSON.stringify(ledger, null, 2)}\n`)

const s = ledger.summary
console.log(`${s.totalSettlements} settlements at a published price  (${s.externalSettlements} external, ${s.canarySettlements} canary)`)
console.log(`${s.externalWallets} external wallets, ${s.repeatExternalWallets} repeat, ${s.crossProductWallets} cross-product`)
console.log(`external value ${s.externalValueUsdc} USDC`)
for (const p of s.byProduct) console.log(`  ${p.title}: ${p.externalSettlements} external of ${p.settlements}`)
console.log(`-> ${OUT}`)
