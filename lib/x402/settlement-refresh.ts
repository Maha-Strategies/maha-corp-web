import { createPublicClient, http, parseAbiItem } from 'viem'
import { base, arbitrum, polygon } from 'viem/chains'
import { MAHA_PAYEE, OPERATOR_WALLETS } from './discovery-payment-recipe.ts'
import { settlementOffers } from './offers.ts'
import { modularLedgerPrices } from '../api-v1/production-release.ts'
import { OPERATOR_SETTLEMENT_RECEIPTS } from './operator-settlement-receipts.ts'
import { buildLedger, type SettlementLedger } from './settlement-ledger.ts'
import { RPC_LOG_MAX_BLOCKS, scanRpcLogs } from './rpc-log-scan.ts'
import { settlementRefreshFailure, settlementRpcQueue, settlementRpcUrl } from './settlement-rpc.ts'
import { usdcNetwork, type UsdcNetwork } from './networks.ts'

export type Transfer = { payer: string; amountBaseUnits: bigint; blockNumber: bigint; transactionHash: string; logIndex: number }
export type SettlementReader = {
  caip2Network?: UsdcNetwork
  finalizedBlock(): Promise<bigint>
  transfers(from: bigint, to: bigint): Promise<Transfer[]>
  timestamp(block: bigint): Promise<string>
}

export const RECHECK_BLOCKS = BigInt(128)
export const SCAN_CHUNK = RPC_LOG_MAX_BLOCKS
export const MAX_SCAN_BLOCKS = SCAN_CHUNK * BigInt(12)
// Bound cron work, not lifetime volume. At 350 ms pacing, 80 timestamps plus
// 48 Arbitrum ranges use about 45 seconds before network latency. Complete
// block prefixes allow bursts to advance; dense overlap stays offline-only.
export const MAX_TIMESTAMP_BLOCKS = 80
export type SettlementScanLimits = { maxTimestampBlocks?: number; maxTransfers?: number }
/** Offline repair is paced but is not constrained by a 60-second server function. */
export const BACKFILL_SCAN_LIMITS = { maxTimestampBlocks: 1024, maxTransfers: 10000 } as const

export function baseSettlementReader(options: { timeout?: number; retryCount?: number; minRpcIntervalMs?: number; minLogIntervalMs?: number } = {}): SettlementReader {
  return evmSettlementReader('eip155:8453', options)
}

export function evmSettlementReader(network: UsdcNetwork, options: { timeout?: number; retryCount?: number; minRpcIntervalMs?: number; minLogIntervalMs?: number } = {}): SettlementReader {
  const definition = usdcNetwork(network), chain = { 'eip155:8453': base, 'eip155:42161': arbitrum, 'eip155:137': polygon }[network]
  // Retain the offline CLI's old option, but apply it to all reads, not just logs.
  const queue = settlementRpcQueue(options.minRpcIntervalMs ?? options.minLogIntervalMs ?? 350)
  const read = <T>(request: () => Promise<T>) => queue(request).catch((error: unknown) => {
    throw new Error(`settlement_rpc_${settlementRefreshFailure(error)}`)
  })
  const client = createPublicClient({ chain, transport: http(settlementRpcUrl(process.env, network), {
    timeout: options.timeout ?? 12000, retryCount: options.retryCount ?? 0,
  }) })
  const event = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
  let checkedChain: Promise<void> | undefined
  return {
    caip2Network: network,
    async finalizedBlock() {
      checkedChain ??= read(() => client.getChainId()).then(chainId => {
        if (chainId !== definition.chainId) throw new Error('settlement_rpc_chain_mismatch')
      }).catch(error => { checkedChain = undefined; throw error })
      await checkedChain
      const block = await read(() => client.getBlock({ blockTag: 'finalized' }))
      if (block.number === null) throw new Error('finalized_block_unavailable')
      return block.number
    },
    async transfers(fromBlock, toBlock) {
      const transfers: Transfer[] = []
      for await (const log of scanRpcLogs({ fromBlock, toBlock,
        getLogs: (fromBlock, toBlock) => read(() => client.getLogs({ address: definition.asset as `0x${string}`, event,
          args: { to: MAHA_PAYEE as `0x${string}` }, fromBlock, toBlock, strict: true })),
      })) {
        if (log.removed || log.blockNumber === null || log.logIndex === null || log.transactionHash === null
          || !log.args.from || log.args.value === undefined) throw new Error('invalid_transfer_log')
        transfers.push({ payer: log.args.from, amountBaseUnits: log.args.value, blockNumber: log.blockNumber,
          transactionHash: log.transactionHash, logIndex: log.logIndex })
      }
      return transfers
    },
    async timestamp(blockNumber) {
      const block = await read(() => client.getBlock({ blockNumber }))
      return new Date(Number(block.timestamp) * 1000).toISOString()
    },
  }
}

/** Recompute summaries; amounts are only an attribution hint, never proof of a route or delivery. */
export function ledgerFromRows(rows: Parameters<typeof buildLedger>[0]['settlements'], fromBlock: bigint, toBlock: bigint, observedAt: string, network: UsdcNetwork = 'eip155:8453') {
  return buildLedger({ settlements: rows, fromBlock, toBlock, observedAt,
    caip2Network: network,
    operatorWallets: [...OPERATOR_WALLETS, MAHA_PAYEE],
    operatorReceipts: network === 'eip155:8453' ? OPERATOR_SETTLEMENT_RECEIPTS : [],
    // Superseded amounts must travel with the offer. The hourly cron rebuilds
    // the public ledger from chain logs alone, so an offer that has been
    // repriced stops matching its own historical settlements unless the old
    // amounts come too -- which would silently drop them from the published
    // totals. scripts/generate-x402-settlement-ledger.ts already passes these;
    // this path did not, and the two disagreed the moment a price moved.
    offers: [...settlementOffers().map((offer) => ({
      id: offer.id,
      title: offer.id.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '),
      amountBaseUnits: BigInt(offer.amount),
      ...(offer.supersededAmounts?.length
        ? { supersededAmountsBaseUnits: offer.supersededAmounts.map((amount) => BigInt(amount)) }
        : {}),
    })), ...modularLedgerPrices()],
  })
}

/** Bounded incremental scan. A failed chunk never advances the cursor or publishes a partial scan. */
export async function refreshSettlementLedger(previous: SettlementLedger, reader: SettlementReader, now = new Date(), limits: SettlementScanLimits = {}) {
  const maxTimestampBlocks = limits.maxTimestampBlocks ?? MAX_TIMESTAMP_BLOCKS, maxTransfers = limits.maxTransfers ?? 1000
  if (!Number.isInteger(maxTimestampBlocks) || maxTimestampBlocks < 1 || maxTimestampBlocks > BACKFILL_SCAN_LIMITS.maxTimestampBlocks
    || !Number.isInteger(maxTransfers) || maxTransfers < 1 || maxTransfers > BACKFILL_SCAN_LIMITS.maxTransfers) throw new Error('invalid_settlement_scan_limits')
  const network = (previous.caip2Network ?? 'eip155:8453') as UsdcNetwork
  if (reader.caip2Network && reader.caip2Network !== network) throw new Error('settlement_reader_network_mismatch')
  const finalized = await reader.finalizedBlock()
  const cursor = BigInt(previous.scannedToBlock)
  if (finalized < cursor) throw new Error('finalized_head_behind_snapshot')
  const earliest = BigInt(previous.scannedFromBlock)
  const start = cursor - RECHECK_BLOCKS > earliest ? cursor - RECHECK_BLOCKS : earliest
  // Arbitrum block numbers advance faster; a Base-sized hourly scan would fall
  // farther behind on every run. Keep each range bounded and cursor atomic.
  const limit = network === 'eip155:42161' ? MAX_SCAN_BLOCKS * BigInt(4) : MAX_SCAN_BLOCKS
  let end = finalized < start + limit - BigInt(1) ? finalized : start + limit - BigInt(1)
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
        if (found.length > BACKFILL_SCAN_LIMITS.maxTransfers * 2) throw new Error('scan_requires_offline_backfill')
      }
    })
  }
  // Normal work budgets select a complete block prefix rather than repeatedly
  // rejecting the same high-volume window. All received logs validate first.
  const unique = new Map<string, Transfer>()
  for (const row of found) {
    const key = `${row.transactionHash.toLowerCase()}:${row.logIndex}`
    const existing = unique.get(key)
    if (existing && (existing.blockNumber !== row.blockNumber || existing.amountBaseUnits !== row.amountBaseUnits
      || existing.payer.toLowerCase() !== row.payer.toLowerCase())) throw new Error('conflicting_transfer_log')
    unique.set(key, row)
  }
  const sorted = [...unique.values()].sort((a, b) => a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex)
  const blocks: bigint[] = []
  let admitted = 0
  for (let i = 0; i < sorted.length;) {
    const block = sorted[i].blockNumber
    let next = i + 1
    while (next < sorted.length && sorted[next].blockNumber === block) next++
    if (blocks.length === maxTimestampBlocks || admitted + next - i > maxTransfers) {
      end = block - 1n
      // Never drop existing history or pretend a dense overlap is progress.
      // A genuinely larger offline scan can repair that case without weakening
      // the 128-block recheck or publishing an incomplete block.
      if (end < cursor || end === cursor && finalized > cursor) throw new Error('scan_requires_offline_backfill_overlap_budget')
      break
    }
    blocks.push(block); admitted += next - i; i = next
  }
  const completeRows = sorted.slice(0, admitted)
  const times = new Map<bigint, string>()
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
  const ledger = ledgerFromRows([...retained, ...completeRows.map((row) => ({ ...row, timestampUtc: times.get(row.blockNumber)! }))], earliest, end, now.toISOString(), network)
  return { ledger, caughtUp: end === finalized, finalizedBlock: finalized.toString() }
}
