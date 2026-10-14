import { createPublicClient, http, decodeEventLog, parseAbiItem } from 'viem'
import { base } from 'viem/chains'
import { networkRpc, usdcNetwork } from '../x402/networks.ts'
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const USED = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)')
type Hex = `0x${string}`
export type BaseProofInput = { transaction: string; payer: string; payee: string; amount: string; nonce: string }
export type BaseReceipt = { transactionHash: string; status: string; logs: readonly { address: string; topics: readonly string[]; data: string; logIndex: number | null; removed?: boolean }[] }
/** A Transfer alone is insufficient: match the signed EIP-3009 nonce as well. */
export function receiptMatchesAuthorization(receipt: BaseReceipt, expected: BaseProofInput): boolean {
  if (receipt.status !== 'success' || receipt.transactionHash.toLowerCase() !== expected.transaction.toLowerCase()
    || !Array.isArray(receipt.logs) || receipt.logs.length > 5000) return false
  const asset = usdcNetwork('eip155:8453').asset.toLowerCase()
  const logs = receipt.logs.filter(l => l.address.toLowerCase() === asset)
  let matches = 0
  try {
    for (let i = 0; i < logs.length; i++) {
      const l = logs[i]
      if (l.removed || !Number.isSafeInteger(l.logIndex) || l.logIndex! < 0 || i > 0 && l.logIndex! <= logs[i - 1].logIndex!) return false
      let args: { authorizer: string; nonce: string }
      try { args = decodeEventLog({ abi: [USED], topics: l.topics as [Hex, ...Hex[]], data: l.data as Hex, strict: true }).args }
      catch { continue }
      if (args.authorizer.toLowerCase() !== expected.payer || args.nonce.toLowerCase() !== expected.nonce.toLowerCase()) continue
      // Circle's EIP3009 implementation emits AuthorizationUsed immediately
      // before _transfer. Pair the NEXT native-token event, not any transfer
      // elsewhere in a batch (which could belong to a different nonce).
      const next = logs[i + 1]
      if (!next) return false
      const transfer = decodeEventLog({ abi: [TRANSFER], topics: next.topics as [Hex, ...Hex[]], data: next.data as Hex, strict: true }).args
      if (transfer.from.toLowerCase() !== expected.payer || transfer.to.toLowerCase() !== expected.payee.toLowerCase() || transfer.value !== BigInt(expected.amount)) return false
      matches++
    }
  } catch { return false }
  return matches === 1
}
export function baseProofReader(environment: Record<string, string | undefined> = process.env) {
  const client = createPublicClient({ chain: base, transport: http(networkRpc('eip155:8453', environment), { timeout: 5000, retryCount: 0 }) })
  return async (input: BaseProofInput) => {
    if (await client.getChainId() !== 8453) return false
    return receiptMatchesAuthorization(await client.getTransactionReceipt({ hash: input.transaction as Hex }), input)
  }
}
