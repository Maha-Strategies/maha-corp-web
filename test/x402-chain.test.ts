import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { acceptPayment } from '../lib/x402/protocol.ts'
import type { PaymentFacilitator, PaymentRequirement, ReplayGuard } from '../lib/x402/protocol.ts'

// Confirmation is the only step that checks whether the facilitator told the
// truth. What it must get right is not "did it say yes" but the three-way
// distinction: the chain agrees, the chain disagrees, or nothing could be
// established. Collapsing the last two either refuses honest payers whenever a
// public node has a bad minute, or serves a settlement that never happened.

const ASSET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const PAYER = '0x1111111111111111111111111111111111111111'
const PAY_TO = '0x86C2372038774e160b61903D5EDC14bE9233752F'
const TX = `0x${'ab'.repeat(32)}`

const ORIGINAL_FETCH = globalThis.fetch
let responses: Array<unknown | 'network_error'>

function pad(address: string) {
  return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}`
}

function transferLog(overrides: { address?: string; from?: string; to?: string; value?: bigint } = {}) {
  return {
    address: overrides.address ?? ASSET,
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      pad(overrides.from ?? PAYER),
      pad(overrides.to ?? PAY_TO),
    ],
    data: `0x${(overrides.value ?? BigInt(10_000)).toString(16)}`,
  }
}

const receipt = (logs: unknown[], status = '0x1') => ({ status, blockNumber: '0x1e240', logs })

beforeEach(() => {
  responses = []
  globalThis.fetch = (async (_url: string, init: { body?: string }) => {
    const { method } = JSON.parse(init.body ?? '{}') as { method: string }
    // Every call answers eth_chainId with Base Sepolia unless a test overrides.
    if (method === 'eth_chainId') {
      const override = responses.length > 0 && typeof responses[0] === 'object' && responses[0] !== null && 'chainId' in (responses[0] as object)
      return json({ result: override ? (responses.shift() as { chainId: string }).chainId : '0x14a34' })
    }
    const next = responses.shift()
    if (next === 'network_error') throw new Error('connect ECONNREFUSED')
    return json({ result: next ?? null })
  }) as unknown as typeof fetch
})

afterEach(() => { globalThis.fetch = ORIGINAL_FETCH })

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

const confirm = (extra: Partial<Parameters<typeof confirmSettlement>[0]> = {}) => confirmSettlement({
  rpcUrl: 'https://node.test', caip2Network: 'eip155:84532', transaction: TX,
  asset: ASSET, payer: PAYER, payTo: PAY_TO, minAmount: '10000',
  attempts: 2, retryDelayMs: 1, requestTimeoutMs: 50, ...extra,
})

test('a matching Transfer to the published address confirms the settlement', async () => {
  responses = [receipt([transferLog()])]
  const result = await confirm()
  assert.equal(result.status, 'confirmed')
  if (result.status !== 'confirmed') return
  assert.equal(result.amount, '10000')
  assert.equal(result.blockNumber, 123_456)
})

test('an overpayment confirms; only a shortfall contradicts', async () => {
  responses = [receipt([transferLog({ value: BigInt(20_000) })])]
  assert.equal((await confirm()).status, 'confirmed')

  responses = [receipt([transferLog({ value: BigInt(9_999) })])]
  const short = await confirm()
  assert.equal(short.status, 'contradicted')
  if (short.status === 'contradicted') assert.match(short.reason, /underpaid/)
})

test('a reverted transaction is a contradiction, not an absence', async () => {
  responses = [receipt([transferLog()], '0x0')]
  const result = await confirm()
  assert.equal(result.status, 'contradicted')
  if (result.status === 'contradicted') assert.equal(result.reason, 'transaction_reverted')
})

test('a transaction that moved nothing to us is a contradiction', async () => {
  // A succeeded transaction with no Transfer to the published address is the
  // case this exists to catch: the facilitator named a real transaction that
  // did not pay us.
  responses = [receipt([])]
  const result = await confirm()
  assert.equal(result.status, 'contradicted')
  if (result.status === 'contradicted') assert.equal(result.reason, 'no_matching_transfer')
})

test('the transfer must be the right token, payer and recipient', async () => {
  for (const wrong of [
    transferLog({ address: '0x9999999999999999999999999999999999999999' }),
    transferLog({ to: '0x9999999999999999999999999999999999999999' }),
    transferLog({ from: '0x9999999999999999999999999999999999999999' }),
  ]) {
    responses = [receipt([wrong])]
    const result = await confirm()
    // Right amount, wrong everything else, is not this payment.
    assert.equal(result.status, 'contradicted', JSON.stringify(wrong))
  }
})

test('addresses compare without regard to checksum casing', async () => {
  responses = [receipt([transferLog()])]
  assert.equal((await confirm({ payTo: PAY_TO.toLowerCase(), asset: ASSET.toUpperCase() })).status, 'confirmed')
})

test('an unreachable node is indeterminate, never a contradiction', async () => {
  // The payer's money has already moved by this point. Refusing here would
  // take payment and withhold the resource, which is worse than serving a
  // settlement recorded as unconfirmed.
  responses = ['network_error', 'network_error']
  const result = await confirm()
  assert.equal(result.status, 'indeterminate')
})

test('a transaction not yet mined is retried, then reported indeterminate', async () => {
  responses = [null, null]
  const result = await confirm()
  assert.equal(result.status, 'indeterminate')
  if (result.status === 'indeterminate') assert.equal(result.reason, 'not_yet_mined')
})

test('a receipt that arrives on a later attempt still confirms', async () => {
  responses = [null, receipt([transferLog()])]
  assert.equal((await confirm({ attempts: 3 })).status, 'confirmed')
})

test('a node on the wrong chain contradicts rather than confirming', async () => {
  // A misconfigured RPC URL would otherwise confirm transactions from an
  // entirely different network.
  responses = [{ chainId: '0x1' }, receipt([transferLog()])]
  const result = await confirm()
  assert.equal(result.status, 'contradicted')
  if (result.status === 'contradicted') assert.match(result.reason, /wrong_chain/)
})

test('a malformed transaction hash is never sent to a node', async () => {
  const result = await confirm({ transaction: 'not-a-hash' })
  assert.equal(result.status, 'indeterminate')
  if (result.status === 'indeterminate') assert.equal(result.reason, 'transaction_not_a_hash')
})

test('each supported network has a default endpoint, and overrides win', () => {
  assert.equal(rpcUrlFor('eip155:84532'), 'https://sepolia.base.org')
  assert.equal(rpcUrlFor('eip155:8453'), 'https://mainnet.base.org')
  assert.equal(rpcUrlFor('eip155:84532', 'https://private.node'), 'https://private.node')
  assert.equal(rpcUrlFor('solana:whatever'), null)
})

// ---------------------------------------------------------------------------
// How confirmation changes what is served
// ---------------------------------------------------------------------------

const REQUIREMENT: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:84532', amount: '10000',
  payTo: PAY_TO, maxTimeoutSeconds: 60, asset: ASSET,
}

const facilitator: PaymentFacilitator = {
  verify: async () => ({ ok: true, payer: PAYER }),
  settle: async () => ({ ok: true, payer: PAYER, transaction: TX }),
}

function guard(recorded: Array<Record<string, unknown>>): ReplayGuard {
  return {
    claim: async () => 'claimed',
    recordSettlement: async (settlement) => { recorded.push(settlement as unknown as Record<string, unknown>) },
  }
}

const payment = { x402Version: 2, accepted: REQUIREMENT, payload: { signature: '0xsig' } }

test('a contradicted settlement withholds the resource', async () => {
  const recorded: Array<Record<string, unknown>> = []
  const result = await acceptPayment({
    payment, requirements: [REQUIREMENT], facilitator, replayGuard: guard(recorded),
    confirmOnChain: async () => ({ status: 'contradicted', reason: 'no_matching_transfer' }),
  })
  assert.equal(result.ok, false)
  // 502, not 402: the caller cannot fix an upstream disagreement, and
  // re-challenging would invite a second payment for the same resource.
  if (!result.ok) assert.equal(result.status, 502)
  // Recorded before it was refused, so the discrepancy is not lost.
  assert.equal((recorded[0].confirmation as { status: string }).status, 'contradicted')
})

test('an unconfirmable settlement is served, and recorded as unconfirmed', async () => {
  const recorded: Array<Record<string, unknown>> = []
  const result = await acceptPayment({
    payment, requirements: [REQUIREMENT], facilitator, replayGuard: guard(recorded),
    confirmOnChain: async () => ({ status: 'indeterminate', reason: 'rpc_timeouterror' }),
  })
  // The payer's funds moved. Withholding here would take payment and give
  // nothing because a public node was slow.
  assert.equal(result.ok, true)
  assert.equal((recorded[0].confirmation as { status: string }).status, 'indeterminate')
  assert.equal((recorded[0].confirmation as { reason: string }).reason, 'rpc_timeouterror')
})

test('a confirmed settlement records the block and amount the chain reported', async () => {
  const recorded: Array<Record<string, unknown>> = []
  const result = await acceptPayment({
    payment, requirements: [REQUIREMENT], facilitator, replayGuard: guard(recorded),
    confirmOnChain: async () => ({ status: 'confirmed', blockNumber: 42, amount: '10000' }),
  })
  assert.equal(result.ok, true)
  assert.deepEqual(recorded[0].confirmation, { status: 'confirmed', blockNumber: 42, amount: '10000' })
})

test('with no endpoint configured nothing is confirmed, and nothing is claimed to be', async () => {
  const recorded: Array<Record<string, unknown>> = []
  const result = await acceptPayment({ payment, requirements: [REQUIREMENT], facilitator, replayGuard: guard(recorded) })
  assert.equal(result.ok, true)
  // Absent, not 'confirmed'. The ledger must never imply a check that did not run.
  assert.equal(recorded[0].confirmation, undefined)
})
