import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canonicalJson, civicDigest, civicIdSchema, digestSchema, immutableSnapshot, sourceUrlSchema } from './receipt.ts'

export const ledgerEntrySchema = z.object({
  sequence: z.number().int().positive(),
  previousHash: z.string().regex(/^[a-f0-9]{64}$/),
  timestampIso: z.string().datetime(),
  category: z.enum(['infrastructure', 'research', 'public-disbursement', 'micro-contribution']),
  amountUsdc: z.number().finite().min(0.000001),
  // A supplied transaction reference is not proof of on-chain confirmation.
  txHashOnChain: z.string().optional(),
  counterpartyLabel: z.string().max(80),
  purposeExplanation: z.string().max(500),
}).strict()

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

/** Step 2 wire format: preserve the specified JSON field order and hash bytes. */
export function hashLedgerEntry(entry: Omit<LedgerEntry, 'previousHash'>, previousHash: string): string {
  const payload = { ...entry, previousHash }
  ledgerEntrySchema.parse(payload)
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')
}

// Network/token identities checked against Base and Circle documentation on 2026-10-04.
export const CIVIC_BASE = Object.freeze({ chainId: 8453, network: 'eip155:8453',
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 })
export const GENESIS_DIGEST = '0'.repeat(64)
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(v => v.toLowerCase())
const transactionSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(v => v.toLowerCase())
const quantitySchema = z.string().regex(/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/)
const baseUnitsSchema = z.string().regex(/^[1-9][0-9]{0,77}$/).refine(v => BigInt(v) < BigInt(2) ** BigInt(256), 'Amount exceeds uint256.')
const sourceSchema = z.object({ citation: z.string().min(1).max(300), url: sourceUrlSchema, digest: digestSchema.optional() }).strict()
const eventBase = {
  id: civicIdSchema,
  occurredAt: z.string().datetime(),
  description: z.string().min(5).max(1000),
  evidence: z.array(sourceSchema).min(1).max(30),
  category: z.enum(['infrastructure', 'research', 'public-disbursement', 'micro-contribution']).optional(),
  counterpartyLabel: z.string().min(1).max(80).optional(),
  settlementChannel: z.enum(['human', 'machine-to-machine', 'unspecified']).optional(),
}
const transferSchema = z.object({
  network: z.literal('eip155:8453'), asset: z.literal(CIVIC_BASE.usdc),
  from: addressSchema, to: addressSchema, transactionHash: transactionSchema,
  logIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict()
export const civicEventSchema = z.discriminatedUnion('kind', [
  z.object({ ...eventBase, kind: z.literal('contribution'), amountBaseUnits: baseUnitsSchema, transfer: transferSchema }).strict(),
  z.object({ ...eventBase, kind: z.literal('expense'), amountBaseUnits: baseUnitsSchema, transfer: transferSchema }).strict(),
  z.object({ ...eventBase, kind: z.literal('decision'), rationale: z.string().min(5).max(2000), supersedes: civicIdSchema.optional() }).strict(),
])
export type CivicEvent = z.infer<typeof civicEventSchema>
export const ledgerReceiptSchema = z.object({
  version: z.literal('civic-ledger-1'), ledgerId: civicIdSchema,
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  previousDigest: digestSchema, event: civicEventSchema, digest: digestSchema,
}).strict()
export type LedgerReceipt = z.infer<typeof ledgerReceiptSchema>
export const checkpointSchema = z.object({
  ledgerId: civicIdSchema, sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), digest: digestSchema,
}).strict().refine(v => v.sequence > 0 || v.digest === GENESIS_DIGEST, 'Empty ledger must have the genesis digest.')
export type LedgerCheckpoint = z.infer<typeof checkpointSchema>

export function receiptPayload(receipt: LedgerReceipt) {
  const { digest: _digest, ...payload } = ledgerReceiptSchema.parse(receipt)
  void _digest
  return payload
}

export function createLedgerReceipt(event: CivicEvent, previous: LedgerCheckpoint): LedgerReceipt {
  const head = checkpointSchema.parse(previous)
  const payload = { version: 'civic-ledger-1' as const, ledgerId: head.ledgerId,
    sequence: head.sequence + 1, previousDigest: head.digest, event: civicEventSchema.parse(event) }
  return immutableSnapshot(ledgerReceiptSchema.parse({ ...payload, digest: civicDigest(payload) }))
}

/** A suffix must carry a trusted preceding checkpoint; expectedHead detects truncation. */
export function verifyLedger(receipts: readonly LedgerReceipt[], preceding: LedgerCheckpoint,
  expectedHead?: LedgerCheckpoint) {
  let head = checkpointSchema.parse(preceding)
  const eventIds = new Set<string>(), transfers = new Set<string>()
  for (const candidate of receipts) {
    const receipt = ledgerReceiptSchema.parse(candidate)
    if (receipt.ledgerId !== head.ledgerId || receipt.sequence !== head.sequence + 1 || receipt.previousDigest !== head.digest) throw new Error('Broken ledger chain or reordered receipt.')
    if (receipt.digest !== civicDigest(receiptPayload(receipt))) throw new Error('Ledger digest mismatch.')
    if (eventIds.has(receipt.event.id)) throw new Error('Duplicate civic event.')
    eventIds.add(receipt.event.id)
    if (receipt.event.kind !== 'decision') {
      const transfer = `${receipt.event.transfer.transactionHash}:${receipt.event.transfer.logIndex}`
      if (transfers.has(transfer)) throw new Error('Duplicate USDC transfer.')
      transfers.add(transfer)
    }
    head = { ledgerId: receipt.ledgerId, sequence: receipt.sequence, digest: receipt.digest }
  }
  if (expectedHead && canonicalJson(head) !== canonicalJson(checkpointSchema.parse(expectedHead))) throw new Error('Ledger does not reach the expected head (possible truncation).')
  return immutableSnapshot(head)
}

export function appendLedger(receipts: readonly LedgerReceipt[], event: CivicEvent, ledgerId = 'maha-civic') {
  const head = verifyLedger(receipts, { ledgerId, sequence: 0, digest: GENESIS_DIGEST })
  const result = [...receipts, createLedgerReceipt(event, head)]
  verifyLedger(result, { ledgerId, sequence: 0, digest: GENESIS_DIGEST })
  return immutableSnapshot(result)
}

export function formatUsdc(baseUnits: string): string {
  const amount = baseUnitsSchema.parse(baseUnits).padStart(7, '0')
  return `${amount.slice(0, -6)}.${amount.slice(-6)}`
}

/** Unsigned, zero-value self transaction committing a checkpoint. Never signs or sends. */
export function prepareLedgerAnchor(checkpoint: LedgerCheckpoint, publisher: string) {
  const payload = { version: 'civic-anchor-1', network: CIVIC_BASE.network,
    publisher: addressSchema.parse(publisher), checkpoint: checkpointSchema.parse(checkpoint) }
  if (payload.checkpoint.sequence === 0) throw new Error('Cannot anchor an empty ledger.')
  return immutableSnapshot({ chainId: CIVIC_BASE.chainId, from: payload.publisher, to: payload.publisher,
    value: '0x0', data: `0x${Buffer.from(`maha-civic-anchor-v1:${canonicalJson(payload)}`, 'utf8').toString('hex')}`,
    checkpoint: payload.checkpoint })
}

export type CivicRpcReader = (method: string, params: unknown[]) => Promise<unknown>
export function createBaseRpcReader(rpcUrl: string): CivicRpcReader {
  sourceUrlSchema.parse(rpcUrl)
  return async (method, params) => {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Base RPC unavailable.')
    const body = z.object({ result: z.unknown(), error: z.unknown().optional() }).parse(await response.json())
    if (body.error || !('result' in body)) throw new Error('Base RPC returned an error.')
    return body.result
  }
}

const logSchema = z.object({ address: addressSchema, topics: z.array(transactionSchema),
  data: z.string().regex(/^0x[0-9a-fA-F]*$/), logIndex: quantitySchema, removed: z.boolean().optional() })
const chainReceiptSchema = z.object({ transactionHash: transactionSchema, status: quantitySchema,
  blockNumber: quantitySchema, blockHash: transactionSchema, logs: z.array(logSchema) })
const blockSchema = z.object({ number: quantitySchema, hash: transactionSchema })
type ChainVerification = { status: 'confirmed-finalized'; transactionHash: string; blockNumber: string; blockHash: string }
  | { status: 'contradicted' | 'indeterminate'; reason: string }

async function finalizedReceipt(transactionHash: string, rpc: CivicRpcReader) {
  if (BigInt(quantitySchema.parse(await rpc('eth_chainId', []))) !== BigInt(CIVIC_BASE.chainId)) throw new Error('wrong-chain')
  const raw = await rpc('eth_getTransactionReceipt', [transactionHash])
  if (raw === null) return null
  const receipt = chainReceiptSchema.parse(raw)
  if (receipt.transactionHash !== transactionHash) throw new Error('wrong-transaction')
  if (BigInt(receipt.status) !== BigInt(1)) throw new Error('reverted-transaction')
  const finalized = blockSchema.parse(await rpc('eth_getBlockByNumber', ['finalized', false]))
  if (BigInt(receipt.blockNumber) > BigInt(finalized.number)) return null
  const canonical = blockSchema.parse(await rpc('eth_getBlockByNumber', [receipt.blockNumber, false]))
  if (canonical.number !== receipt.blockNumber || canonical.hash !== receipt.blockHash) throw new Error('noncanonical-block')
  return receipt
}
function unavailable(error: unknown): ChainVerification {
  const reason = error instanceof Error ? error.message : ''
  return ['wrong-chain', 'wrong-transaction', 'reverted-transaction', 'noncanonical-block'].includes(reason)
    ? { status: 'contradicted', reason } : { status: 'indeterminate', reason: 'RPC evidence unavailable or malformed.' }
}

export async function verifyLedgerAnchor(checkpoint: LedgerCheckpoint, publisher: string, hash: string,
  rpc: CivicRpcReader): Promise<ChainVerification> {
  const expected = prepareLedgerAnchor(checkpoint, publisher), transactionHash = transactionSchema.parse(hash)
  try {
    const receipt = await finalizedReceipt(transactionHash, rpc)
    if (!receipt) return { status: 'indeterminate', reason: 'Transaction not mined or not finalized.' }
    const tx = z.object({ hash: transactionSchema, from: addressSchema, to: addressSchema,
      input: z.string(), value: quantitySchema, blockHash: transactionSchema }).parse(await rpc('eth_getTransactionByHash', [transactionHash]))
    if (tx.hash !== transactionHash || tx.from !== expected.from || tx.to !== expected.to || tx.input.toLowerCase() !== expected.data
      || BigInt(tx.value) !== BigInt(0) || tx.blockHash !== receipt.blockHash) return { status: 'contradicted', reason: 'Anchor commitment or publisher mismatch.' }
    return { status: 'confirmed-finalized', transactionHash, blockNumber: BigInt(receipt.blockNumber).toString(), blockHash: receipt.blockHash }
  } catch (error) { return unavailable(error) }
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export async function verifyUsdcTransfer(event: CivicEvent, rpc: CivicRpcReader): Promise<ChainVerification> {
  const parsed = civicEventSchema.parse(event)
  if (parsed.kind === 'decision') throw new Error('Decisions have no USDC transfer.')
  try {
    const receipt = await finalizedReceipt(parsed.transfer.transactionHash, rpc)
    if (!receipt) return { status: 'indeterminate', reason: 'Transaction not mined or not finalized.' }
    const log = receipt.logs.find(l => BigInt(l.logIndex) === BigInt(parsed.transfer.logIndex))
    const topic = (address: string) => `0x${address.slice(2).padStart(64, '0')}`
    if (!log || log.removed || log.address !== CIVIC_BASE.usdc.toLowerCase() || log.topics.length !== 3
      || log.topics[0] !== TRANSFER_TOPIC || log.topics[1] !== topic(parsed.transfer.from)
      || log.topics[2] !== topic(parsed.transfer.to) || !/^0x[0-9a-fA-F]{64}$/.test(log.data)
      || BigInt(log.data) !== BigInt(parsed.amountBaseUnits)) return { status: 'contradicted', reason: 'No exact matching native Base USDC transfer at the declared log index.' }
    return { status: 'confirmed-finalized', transactionHash: receipt.transactionHash, blockNumber: BigInt(receipt.blockNumber).toString(), blockHash: receipt.blockHash }
  } catch (error) { return unavailable(error) }
}
