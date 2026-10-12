import { createPublicClient, decodeEventLog, http, parseAbiItem, toEventSelector } from 'viem'
import { base, arbitrum } from 'viem/chains'
import { MAHA_PAYEE, OPERATOR_WALLETS } from './discovery-payment-recipe.ts'
import { usdcNetwork, type UsdcNetwork } from './networks.ts'
import { settlementRpcQueue, settlementRpcUrl } from './settlement-rpc.ts'

export const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
export const AUTHORIZATION_EVENT = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)')
const transferTopic = toEventSelector(TRANSFER_EVENT), authorizationTopic = toEventSelector(AUTHORIZATION_EVENT)
type Hex = `0x${string}`
export type ObservedTransfer = { payer: string; amountBaseUnits: bigint; blockNumber: bigint; transactionHash: string; logIndex?: number }
export type ReceiptEvidence = { transactionHash: string; blockNumber: bigint; status: string;
  logs: readonly { address: string; topics: readonly string[]; data: string; logIndex: number | null; removed?: boolean }[] }
export type TransferMechanism = { kind: 'eip3009_style' | 'plain_usdc_transfer' | 'unknown'; reason: string; nonce?: string }

/** Same-chain native-USDC event evidence only. It never attributes a route or claims delivery. */
export function classifyTransferMechanism(row: ObservedTransfer, receipt: ReceiptEvidence | null, network: UsdcNetwork): TransferMechanism {
  const unknown = (reason: string): TransferMechanism => ({ kind: 'unknown', reason })
  const asset = usdcNetwork(network).asset.toLowerCase()
  if (!receipt) return unknown('receipt_unavailable')
  if (receipt.transactionHash.toLowerCase() !== row.transactionHash.toLowerCase() || receipt.blockNumber !== row.blockNumber) return unknown('receipt_identity_mismatch')
  if (receipt.status !== 'success') return unknown('receipt_not_successful')
  if (!Array.isArray(receipt.logs) || receipt.logs.length > 5000) return unknown('invalid_receipt_logs')
  const transfers: { from: string; to: string; value: bigint; logIndex: number }[] = []
  const authorizations: { authorizer: string; nonce: string }[] = []
  const indices = new Set<number>()
  try {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== asset) continue
      if (log.removed || !Number.isSafeInteger(log.logIndex) || Number(log.logIndex) < 0 || indices.has(log.logIndex!)) return unknown('invalid_native_token_log')
      indices.add(log.logIndex!)
      const topic = log.topics[0]?.toLowerCase()
      if (topic === transferTopic.toLowerCase()) {
        const { args } = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: true })
        transfers.push({ from: args.from.toLowerCase(), to: args.to.toLowerCase(), value: args.value, logIndex: log.logIndex! })
      } else if (topic === authorizationTopic.toLowerCase()) {
        const { args } = decodeEventLog({ abi: [AUTHORIZATION_EVENT], data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: true })
        authorizations.push({ authorizer: args.authorizer.toLowerCase(), nonce: args.nonce })
      }
    }
  } catch { return unknown('malformed_native_token_event') }
  const payer = row.payer.toLowerCase()
  const matching = transfers.filter(log => log.from === payer && log.to === MAHA_PAYEE.toLowerCase() && log.value === row.amountBaseUnits
    && (row.logIndex === undefined || row.logIndex === log.logIndex))
  if (matching.length !== 1) return unknown('matching_transfer_missing_or_ambiguous')
  const uses = authorizations.filter(log => log.authorizer === payer)
  if (!uses.length) return { kind: 'plain_usdc_transfer', reason: 'no_matching_authorization_event' }
  // AuthorizationUsed carries no recipient or amount. Do not guess the pairing
  // when a batch contains several transfers/authorizations by this payer.
  if (uses.length !== 1 || transfers.filter(log => log.from === payer).length !== 1) return unknown('authorization_pairing_ambiguous')
  return { kind: 'eip3009_style', reason: 'native_usdc_transfer_and_authorization_used', nonce: uses[0].nonce }
}

export function settlementReceiptReader(network: UsdcNetwork) {
  const definition = usdcNetwork(network)
  const client = createPublicClient({ chain: network === 'eip155:8453' ? base : arbitrum,
    transport: http(settlementRpcUrl(process.env, network), { timeout: 12000, retryCount: 0 }) })
  const read = settlementRpcQueue(350)
  let chainCheck: Promise<void> | undefined
  return async (hash: string): Promise<ReceiptEvidence | null> => {
    chainCheck ??= read(() => client.getChainId())
      .catch(() => { throw new Error('receipt_rpc_chain_check_unavailable') })
      .then(id => { if (id !== definition.chainId) throw new Error('receipt_rpc_wrong_chain') })
    await chainCheck // Wrong-chain/configuration errors must not be disguised as ordinary transfers.
    try { return await read(() => client.getTransactionReceipt({ hash: hash as Hex })) }
    catch { return null } // unavailable remains unknown; no raw credential-bearing RPC error escapes.
  }
}

const ASSISTED_TEST = { network: 'eip155:8453', hash: '0xa65221eb50ada8a92cee0759a6a340644cb8ffcbb36e1b0fc369adbeaaba0601',
  payer: '0x5b953a66eb0826c13ca2af80e0c36557cc6a1a96', amount: BigInt(20000000) }

export async function inspectTransferEvidence(rows: readonly ObservedTransfer[], network: UsdcNetwork,
  readReceipt: ((hash: string) => Promise<ReceiptEvidence | null>) | null, receiptLimit = 200) {
  if (!Number.isSafeInteger(receiptLimit) || receiptLimit < 1 || receiptLimit > 1000) throw new Error('invalid_receipt_limit')
  usdcNetwork(network)
  const operators = new Set([...OPERATOR_WALLETS, MAHA_PAYEE].map(value => value.toLowerCase()))
  const receipts = new Map<string, ReceiptEvidence | null>(), identities = new Set<string>()
  const entries: { transactionHash: string; logIndex?: number; payer: string; amountBaseUnits: string;
    role: 'operator' | 'assisted_test' | 'external'; mechanism: TransferMechanism }[] = []
  for (const row of rows) {
    if (!/^0x[\da-f]{64}$/i.test(row.transactionHash) || !/^0x[\da-f]{40}$/i.test(row.payer)
      || row.amountBaseUnits < BigInt(0) || row.blockNumber < BigInt(0)) throw new Error('invalid_observed_transfer')
    const hash = row.transactionHash.toLowerCase(), key = `${hash}:${row.logIndex ?? 'legacy'}`
    if (identities.has(key)) throw new Error('duplicate_observed_transfer')
    identities.add(key)
    if (readReceipt && !receipts.has(hash) && receipts.size < receiptLimit) receipts.set(hash, await readReceipt(hash))
    const mechanism = receipts.has(hash) ? classifyTransferMechanism(row, receipts.get(hash)!, network)
      : { kind: 'unknown' as const, reason: readReceipt ? 'receipt_budget_exhausted' : 'not_inspected' }
    const role = operators.has(row.payer.toLowerCase()) ? 'operator' as const
      : network === ASSISTED_TEST.network && hash === ASSISTED_TEST.hash && row.payer.toLowerCase() === ASSISTED_TEST.payer && row.amountBaseUnits === ASSISTED_TEST.amount
        ? 'assisted_test' as const : 'external' as const
    entries.push({ transactionHash: hash, logIndex: row.logIndex, payer: row.payer.toLowerCase(), amountBaseUnits: row.amountBaseUnits.toString(), role, mechanism })
  }
  const summarize = (selected: typeof entries) => ({ transfers: selected.length, wallets: new Set(selected.map(row => row.payer)).size,
    valueBaseUnits: selected.reduce((sum, row) => sum + BigInt(row.amountBaseUnits), BigInt(0)).toString(),
    mechanisms: Object.fromEntries(['eip3009_style', 'plain_usdc_transfer', 'unknown'].map(kind => [kind, selected.filter(row => row.mechanism.kind === kind).length])) })
  return { schemaVersion: 'maha-transfer-mechanisms/1.0', network, receiptRequests: receipts.size,
    classificationComplete: entries.every(row => row.mechanism.kind !== 'unknown'),
    all: summarize(entries), external: summarize(entries.filter(row => row.role === 'external')),
    operator: summarize(entries.filter(row => row.role === 'operator')), assistedTests: summarize(entries.filter(row => row.role === 'assisted_test')),
    entries, customerRevenueEstablished: false, buyerDeliveryEstablished: false,
    limitations: ['EIP-3009-style event evidence is not x402 route attribution or proof of buyer delivery.',
      'Plain transfers may be funding or other payment schemes, not necessarily sales.', 'Unknown receipts remain unknown; no replacements are signed.',
      'Known operator wallets and the assisted CABEZON test are excluded from external mechanism statistics.'] }
}
