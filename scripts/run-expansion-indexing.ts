import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { EXPANSION_INDEXING_IDS, EXPANSION_MAX_SERVICE_BASE_UNITS } from '../lib/x402/expansion-registry.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { verifyMicroProduct } from '../lib/x402/micro-products.ts'
import { createPaidFetch, decodeChallenge, type PaymentChallenge } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { readProductIndex } from '../lib/x402/product-index.ts'

export const CONFIRMATION = 'PUBLISHER_FUNDED_EXPANSION_56_ONCE_MAX_2_7355_USDC'
const ORIGIN = 'https://www.mahastrategies.com'
export const TARGETS = EXPANSION_INDEXING_IDS.map(id => {
  const offer = X402_OFFERS.find(o => o.id === id)!
  if (!offer?.availability.payableInProduction || offer.method !== 'POST') throw new Error('expansion-offer-unavailable')
  return { id, path: offer.path, amount: offer.amount, input: offer.discovery.input }
})
export function assertExpansionPlan() {
  if (TARGETS.length !== 56 || new Set(TARGETS.map(t => t.path)).size !== 56 || TARGETS.reduce((n, t) => n + BigInt(t.amount), BigInt(0)) !== BigInt(EXPANSION_MAX_SERVICE_BASE_UNITS)) throw new Error('authorized-expansion-plan-changed')
}
export function assertExpansionChallenge(challenge: PaymentChallenge, target: typeof TARGETS[number]) {
  const r = challenge.accepts[0]
  if (challenge.x402Version !== 2 || challenge.accepts.length !== 1 || challenge.resource.url !== ORIGIN + target.path
    || r?.scheme !== 'exact' || r.network !== BASE_NETWORK || r.amount !== target.amount
    || r.asset.toLowerCase() !== BASE_USDC.toLowerCase() || r.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || r.extra?.name !== 'USD Coin' || r.extra?.version !== '2') throw new Error('payment-boundary-changed')
}
type Step = { offerId: string; resource: string; amountBaseUnits: string; state: string; transaction?: string; blockNumber?: number; responseSha256?: string; payloadVerified?: boolean; bazaarIndexed?: boolean }
export async function run() {
  assertExpansionPlan()
  const args = process.argv.slice(2)
  if (args.some(a => !['--pay', '--index-only'].includes(a)) || (args.includes('--pay') && args.includes('--index-only'))) throw new Error('invalid-mode')
  const output = process.env.EXPANSION_CANARY_OUTPUT_PATH
  const observe = async () => {
    const index = await readProductIndex()
    const indexed = TARGETS.filter(t => index.resources.includes(ORIGIN + t.path)).map(t => t.id)
    return { checkedAt: index.checkedAt, available: index.available, complete: index.complete, indexed, missing: TARGETS.filter(t => !indexed.includes(t.id)).map(t => t.id) }
  }
  if (args.includes('--index-only')) { console.log(JSON.stringify(await observe())); return }
  // All unpaid challenges must pass before accessing the private signing key.
  for (const target of TARGETS) {
    const response = await fetch(ORIGIN + target.path, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(target.input) })
    if (response.status !== 402) throw new Error(`unpaid-preflight-failed:${target.id}:${response.status}`)
    const challenge = decodeChallenge(response.headers.get('payment-required'))
    assertExpansionChallenge(challenge, target)
    const body = await response.json() as PaymentChallenge
    assertExpansionChallenge(body, target)
    if (JSON.stringify(body.accepts) !== JSON.stringify(challenge.accepts)) throw new Error('header-body-challenge-mismatch')
  }
  if (!args.includes('--pay')) { console.log(JSON.stringify({ state: 'read-only-preflight-passed', products: 56, maximumAuthorizedBaseUnits: EXPANSION_MAX_SERVICE_BASE_UNITS, index: await observe() })); return }
  if (process.env.EXPANSION_CANARY_CONFIRMATION !== CONFIRMATION || process.env.GITHUB_RUN_ATTEMPT !== '1' || !output) throw new Error('explicit-authorization-first-attempt-and-evidence-required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[a-f0-9]{64}$/i.test(key)) throw new Error('dedicated-key-unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected-buyer')
  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)
  if (!rpcUrl) throw new Error('managed-base-rpc-required')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl, { retryCount: 0, timeout: 15_000 }) })
  if (await client.getChainId() !== base.id) throw new Error('rpc-chain-mismatch')
  const balance = await client.readContract({ address: BASE_USDC as Address, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
  if (balance < BigInt(EXPANSION_MAX_SERVICE_BASE_UNITS)) throw new Error('insufficient-balance-for-authorized-plan')
  const evidence = { version: 'maha-expansion-indexing/1', classification: 'publisher-funded-indexing-canary', customerDemand: false, organicDemand: false, maximumAuthorizedBaseUnits: EXPANSION_MAX_SERVICE_BASE_UNITS, signedBaseUnits: '0', confirmedBaseUnits: '0', buyer: account.address, payee: MAHA_PAYEE, startedAt: new Date().toISOString(), state: 'running', steps: [] as Step[], index: await observe() }
  const save = () => writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600, flag: 'w' })
  await save()
  try {
    for (const target of TARGETS) {
      const step: Step = { offerId: target.id, resource: ORIGIN + target.path, amountBaseUnits: target.amount, state: 'not-attempted' }
      evidence.steps.push(step); await save()
      let signatures = 0, challenges = 0
      const paidFetch = createPaidFetch({ address: account.address, chainId: base.id,
        onPaymentRequired(r, context) { if (++challenges !== 1) throw new Error('second-challenge-refused'); assertExpansionChallenge(context.challenge, target) },
        async signTypedData(request) {
          if (++signatures !== 1) throw new Error('second-signature-refused')
          const next = BigInt(evidence.signedBaseUnits) + BigInt(target.amount)
          if (next > BigInt(EXPANSION_MAX_SERVICE_BASE_UNITS)) throw new Error('spend-cap-exceeded')
          evidence.signedBaseUnits = String(next); step.state = 'signed-outcome-unknown'; await save()
          return account.signTypedData({ domain: { ...request.domain, verifyingContract: request.domain.verifyingContract as `0x${string}` }, types: request.types, primaryType: request.primaryType,
            message: { ...request.message, from: request.message.from as `0x${string}`, to: request.message.to as `0x${string}`, nonce: request.message.nonce as `0x${string}` } })
        },
      })
      // One authorization per target. Never retry a paid request or pay for index lag.
      const response = await paidFetch(step.resource, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000), headers: { 'content-type': 'application/json', 'x-maha-discovery-source': 'publisher-funded-indexing-canary', 'user-agent': 'maha-canary/expansion-56' }, body: JSON.stringify(target.input) })
      if (signatures !== 1 || challenges !== 1) throw new Error('unexpected-payment-flow')
      if (response.x402?.receipt) { verifyPaymentReceipt(response.x402.receipt, account.address); step.transaction = response.x402.receipt.transaction; step.state = 'receipt-reported-delivery-unverified'; await save() }
      if (response.status !== 200 || !step.transaction) throw new Error('paid-delivery-not-confirmed')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 65536) throw new Error('delivery-byte-limit')
      step.responseSha256 = createHash('sha256').update(bytes).digest('hex')
      step.payloadVerified = await verifyMicroProduct(target.id, target.input, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      if (!step.payloadVerified) throw new Error('result-verification-failed')
      const chain = await confirmSettlement({ rpcUrl, caip2Network: BASE_NETWORK, transaction: step.transaction, asset: BASE_USDC, payer: account.address, payTo: MAHA_PAYEE, minAmount: target.amount, attempts: 8, retryDelayMs: 2500, requestTimeoutMs: 5000 })
      if (chain.status !== 'confirmed' || chain.amount !== target.amount) throw new Error('exact-settlement-unconfirmed')
      step.blockNumber = chain.blockNumber; step.state = 'settled-and-delivered-index-unobserved'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(target.amount)); await save()
      console.log(JSON.stringify({ offerId: target.id, state: step.state, confirmedBaseUnits: evidence.confirmedBaseUnits }))
    }
    for (let observation = 0; observation < 6; observation++) {
      evidence.index = await observe()
      for (const step of evidence.steps) { step.bazaarIndexed = evidence.index.indexed.includes(step.offerId as typeof EXPANSION_INDEXING_IDS[number]); if (step.bazaarIndexed) step.state = 'settled-delivered-and-indexed' }
      await save()
      if (evidence.index.complete && !evidence.index.missing.length) break
      await new Promise(r => setTimeout(r, 15_000))
    }
    evidence.state = evidence.steps.every(s => s.bazaarIndexed) ? 'complete' : 'settled-and-delivered-index-pending'
    await save(); console.log(JSON.stringify({ state: evidence.state, confirmedBaseUnits: evidence.confirmedBaseUnits, indexed: evidence.index.indexed.length, missing: evidence.index.missing }))
  } catch {
    evidence.state = 'stopped-do-not-repay-before-reconciliation'; await save()
    throw new Error('indexing-stopped-inspect-sanitized-evidence-before-any-new-payment')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(e => { console.error(e instanceof Error && /^unpaid-preflight-failed:/.test(e.message) ? e.message : 'expansion-indexing-failed-inspect-evidence'); process.exitCode = 1 })
