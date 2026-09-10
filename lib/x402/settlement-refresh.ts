import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'
import { BASE_USDC, MAHA_PAYEE, OPERATOR_WALLETS } from './discovery-payment-recipe.ts'
import { payableOffers } from './offers.ts'
import { buildLedger, type SettlementLedger } from './settlement-ledger.ts'

export type Transfer = { payer: string; amountBaseUnits: bigint; blockNumber: bigint; transactionHash: string; logIndex: number }
export type SettlementReader = {
  finalizedBlock(): Promise<bigint>
  transfers(from: bigint, to: bigint): Promise<Transfer[]>
  timestamp(block: bigint): Promise<string>
}

export const RECHECK_BLOCKS = BigInt(128)
export const SCAN_CHUNK = BigInt(9000)
export const MAX_SCAN_BLOCKS = SCAN_CHUNK * BigInt(12)

export function baseSettlementReader(options: { timeout?: number; retryCount?: number } = {}): SettlementReader {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org', {
    timeout: options.timeout ?? 12000, retryCount: options.retryCount ?? 0,
  }) })
  const event = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
  return {
    async finalizedBlock() {
      const block = await client.getBlock({ blockTag: 'finalized' })
      if (block.number === null) throw new Error('finalized_block_unavailable')
      return block.number
    },
    async transfers(fromBlock, toBlock) {
      const logs = await client.getLogs({ address: BASE_USDC as `0x${string}`, event,
        args: { to: MAHA_PAYEE as `0x${string}` }, fromBlock, toBlock, strict: true })
      return logs.map((log) => {
        if (log.removed || log.blockNumber === null || log.logIndex === null || log.transactionHash === null
          || !log.args.from || log.args.value === undefined) throw new Error('invalid_transfer_log')
        return { payer: log.args.from, amountBaseUnits: log.args.value, blockNumber: log.blockNumber,
          transactionHash: log.transactionHash, logIndex: log.logIndex }
      })
    },
    async timestamp(blockNumber) {
      const block = await client.getBlock({ blockNumber })
      return new Date(Number(block.timestamp) * 1000).toISOString()
    },
  }
}

/** Recompute summaries; amounts are only an attribution hint, never proof of a route or delivery. */
export function ledgerFromRows(rows: Parameters<typeof buildLedger>[0]['settlements'], fromBlock: bigint, toBlock: bigint, observedAt: string) {
  return buildLedger({ settlements: rows, fromBlock, toBlock, observedAt,
    operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
    // Superseded amounts must travel with the offer. The hourly cron rebuilds
    // the public ledger from chain logs alone, so an offer that has been
    // repriced stops matching its own historical settlements unless the old
    // amounts come too -- which would silently drop them from the published
    // totals. scripts/generate-x402-settlement-ledger.ts already passes these;
    // this path did not, and the two disagreed the moment a price moved.
    offers: payableOffers().map((offer) => ({
      id: offer.id,
      title: offer.id.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '),
      amountBaseUnits: BigInt(offer.amount),
      ...(offer.supersededAmounts?.length
        ? { supersededAmountsBaseUnits: offer.supersededAmounts.map((amount) => BigInt(amount)) }
        : {}),
    })),
  })
}

/** Bounded incremental scan. A failed chunk never advances the cursor or publishes a partial scan. */
export async function refreshSettlementLedger(previous: SettlementLedger, reader: SettlementReader, now = new Date()) {
  const finalized = await reader.finalizedBlock()
  const cursor = BigInt(previous.scannedToBlock)
  if (finalized < cursor) throw new Error('finalized_head_behind_snapshot')
  const earliest = BigInt(previous.scannedFromBlock)
  const start = cursor - RECHECK_BLOCKS > earliest ? cursor - RECHECK_BLOCKS : earliest
  const end = finalized < start + MAX_SCAN_BLOCKS - BigInt(1) ? finalized : start + MAX_SCAN_BLOCKS - BigInt(1)
  const ranges: Array<[bigint, bigint]> = []
  for (let from = start; from <= end; from += SCAN_CHUNK) ranges.push([from, from + SCAN_CHUNK - BigInt(1) < end ? from + SCAN_CHUNK - BigInt(1) : end])
  const found: Transfer[] = []
  for (let i = 0; i < ranges.length; i += 3) {
    const chunks = await Promise.all(ranges.slice(i, i + 3).map(([from, to]) => reader.transfers(from, to)))
    chunks.forEach((chunk, offset) => {
      const [from, to] = ranges[i + offset]!
      for (const row of chunk) {
        if (row.blockNumber < from || row.blockNumber > to || row.amountBaseUnits < BigInt(0)
          || !/^0x[a-fA-F0-9]{64}$/.test(row.transactionHash) || !/^0x[a-fA-F0-9]{40}$/.test(row.payer)
          || !Number.isInteger(row.logIndex) || row.logIndex < 0) throw new Error('invalid_transfer_range_or_identity')
        found.push(row)
      }
    })
  }
  // Do not silently truncate a high-volume response and call it complete.
  if (found.length > 1000) throw new Error('scan_requires_offline_backfill')
  const unique = new Map<string, Transfer>()
  for (const row of found) {
    const key = `${row.transactionHash.toLowerCase()}:${row.logIndex}`
    const existing = unique.get(key)
    if (existing && (existing.blockNumber !== row.blockNumber || existing.amountBaseUnits !== row.amountBaseUnits
      || existing.payer.toLowerCase() !== row.payer.toLowerCase())) throw new Error('conflicting_transfer_log')
    unique.set(key, row)
  }
  const times = new Map<bigint, string>()
  const blocks = [...new Set([...unique.values()].map((row) => row.blockNumber))]
  if (blocks.length > 40) throw new Error('scan_requires_offline_backfill')
  for (let i = 0; i < blocks.length; i += 4) {
    await Promise.all(blocks.slice(i, i + 4).map(async (block) => {
      const timestamp = await reader.timestamp(block)
      if (!Number.isFinite(Date.parse(timestamp))) throw new Error('invalid_block_time')
      times.set(block, timestamp)
    }))
  }
  // Replace the overlap, so duplicates and shallow reorganizations do not accumulate.
  const retained = previous.entries.filter((row) => BigInt(row.blockNumber) < start).map((row) => ({
    payer: row.payer, amountBaseUnits: BigInt(row.amountBaseUnits), blockNumber: BigInt(row.blockNumber),
    transactionHash: row.transactionHash, timestampUtc: row.timestampUtc, logIndex: row.logIndex,
  }))
  const ledger = ledgerFromRows([...retained, ...[...unique.values()].map((row) => ({ ...row, timestampUtc: times.get(row.blockNumber)! }))], earliest, end, now.toISOString())
  return { ledger, caughtUp: end === finalized, finalizedBlock: finalized.toString() }
}
