// Independent confirmation that the settlement the facilitator reported is
// actually on chain.
//
// Until this existed, "verified" meant the facilitator said so over HTTPS. That
// is a trust relationship, not a verification: a compromised or buggy
// facilitator could report a transaction that was never submitted, and nothing
// downstream would notice. This reads the receipt from a node and checks that
// the token contract emitted a Transfer of at least the required amount, from
// the payer the facilitator named, to the address we published in the
// challenge.
//
// Raw JSON-RPC over fetch, with no library. Two reasons: the production tree of
// a payment API should not grow a wallet SDK for four eth_ calls, and this runs
// inside the Next proxy, where an over-bundled dependency has already produced
// one opaque runtime failure.

/** keccak256("Transfer(address,address,uint256)") -- the ERC-20 log topic. */
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export const DEFAULT_RPC_URLS: Record<string, string> = {
  'eip155:8453': 'https://mainnet.base.org',
  'eip155:84532': 'https://sepolia.base.org',
}

export type ChainConfirmation =
  /** The chain agrees with the facilitator. */
  | { status: 'confirmed'; blockNumber: number; amount: string; transaction: string }
  /** The chain disagrees. This is the case that must never be served. */
  | { status: 'contradicted'; reason: string }
  /** Nothing could be established either way -- node unreachable, or not yet
   *  mined. Distinct from `contradicted` because it says nothing about the
   *  payment, and treating the two alike would refuse honest payers whenever a
   *  public RPC endpoint had a bad minute. */
  | { status: 'indeterminate'; reason: string }

export type ConfirmSettlementInput = {
  rpcUrl: string
  /** CAIP-2, checked against the node so a misconfigured URL cannot silently
   *  confirm a transaction on a different chain. */
  caip2Network: string
  transaction: string
  /** Token contract that must have emitted the Transfer. */
  asset: string
  payer: string
  payTo: string
  /** Smallest unit, as a decimal string. */
  minAmount: string
  attempts?: number
  retryDelayMs?: number
  requestTimeoutMs?: number
}

type RpcResult = { ok: true; result: unknown } | { ok: false; reason: string }

async function rpc(url: string, method: string, params: unknown[], timeoutMs: number): Promise<RpcResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false, reason: `rpc_http_${response.status}` }
    const body = await response.json() as { result?: unknown; error?: { message?: string } }
    if (body.error) return { ok: false, reason: `rpc_error:${String(body.error.message).slice(0, 80)}` }
    return { ok: true, result: body.result }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? `rpc_${error.name.toLowerCase()}` : 'rpc_failed' }
  }
}

/** Topics carry addresses left-padded to 32 bytes. */
function topicAddress(topic: string | undefined): string | null {
  if (typeof topic !== 'string' || topic.length !== 66) return null
  return `0x${topic.slice(26)}`.toLowerCase()
}

const sameAddress = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()

type Receipt = {
  status?: string
  blockNumber?: string
  logs?: Array<{ address?: string; topics?: string[]; data?: string }>
}

/**
 * Confirms a settlement, or says honestly that it could not.
 *
 * Deliberately not fail-closed. By the time this runs the payer's money has
 * already moved, so refusing on an unreachable node would take payment and
 * withhold the resource -- the one outcome worse than serving unconfirmed. The
 * indeterminate result is recorded instead, so reconciliation can find the gap
 * later. Only an active contradiction withholds.
 */
export async function confirmSettlement(input: ConfirmSettlementInput): Promise<ChainConfirmation> {
  const attempts = input.attempts ?? 3
  const retryDelayMs = input.retryDelayMs ?? 500
  const timeoutMs = input.requestTimeoutMs ?? 2_000

  if (!/^0x[0-9a-fA-F]{64}$/.test(input.transaction)) {
    return { status: 'indeterminate', reason: 'transaction_not_a_hash' }
  }

  // A node for the wrong chain would happily return receipts that mean nothing
  // here, so the chain is established before anything is read from it.
  const expectedChainId = Number(input.caip2Network.split(':')[1])
  const chain = await rpc(input.rpcUrl, 'eth_chainId', [], timeoutMs)
  if (!chain.ok) return { status: 'indeterminate', reason: chain.reason }
  if (Number.isFinite(expectedChainId) && Number(chain.result) !== expectedChainId) {
    return { status: 'contradicted', reason: `rpc_wrong_chain:${Number(chain.result)}` }
  }

  let lastReason = 'receipt_not_found'
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))

    const response = await rpc(input.rpcUrl, 'eth_getTransactionReceipt', [input.transaction], timeoutMs)
    if (!response.ok) { lastReason = response.reason; continue }
    // A null receipt is the ordinary answer for a transaction that is broadcast
    // but not yet in a block, which is why this retries rather than concluding.
    if (response.result === null || response.result === undefined) { lastReason = 'not_yet_mined'; continue }

    const receipt = response.result as Receipt
    if (receipt.status !== undefined && BigInt(receipt.status) !== BigInt(1)) {
      return { status: 'contradicted', reason: 'transaction_reverted' }
    }

    const transfer = findTransfer(receipt, input)
    if (!transfer) {
      // The transaction exists and succeeded but moved nothing to us. Reporting
      // this as merely unconfirmed would hide the only case that matters.
      return { status: 'contradicted', reason: 'no_matching_transfer' }
    }
    if (transfer < BigInt(input.minAmount)) {
      return { status: 'contradicted', reason: `underpaid:${transfer}` }
    }

    return {
      status: 'confirmed',
      blockNumber: Number(BigInt(receipt.blockNumber ?? '0x0')),
      amount: transfer.toString(),
      transaction: input.transaction,
    }
  }

  return { status: 'indeterminate', reason: lastReason }
}

/**
 * The Transfer this payment should have produced.
 *
 * Every field is checked against what we published rather than what we were
 * told: the token contract, the recipient we put in the challenge, and the
 * payer the facilitator named. A transaction that moved the right amount of a
 * different token, or the right token to a different address, is not this
 * payment.
 */
function findTransfer(receipt: Receipt, input: ConfirmSettlementInput): bigint | null {
  for (const log of receipt.logs ?? []) {
    if (!log.address || !sameAddress(log.address, input.asset)) continue
    if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue

    const from = topicAddress(log.topics?.[1])
    const to = topicAddress(log.topics?.[2])
    if (!from || !to) continue
    if (!sameAddress(to, input.payTo)) continue
    if (!sameAddress(from, input.payer)) continue

    try { return BigInt(log.data ?? '0x0') } catch { return null }
  }
  return null
}

export function rpcUrlFor(caip2Network: string, override?: string): string | null {
  return override?.trim() || DEFAULT_RPC_URLS[caip2Network] || null
}
