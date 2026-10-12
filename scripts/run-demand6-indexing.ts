import { createHmac, createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { DEMAND6_OFFERS } from '../lib/x402/demand6/offers.ts'
import { DEMAND6_PRODUCTS, demandResultSchema, type Demand6Id } from '../lib/x402/demand6/contracts.ts'
import { demandDigest, buildDemandProduct } from '../lib/x402/demand6/products.ts'
import { demandPurchaseHeaders, demandPurchaseNonce, demandPurchaseTypedData } from '../lib/x402/demand6/purchase.ts'
import { decodeChallenge, decodeReceipt, encodePaymentSignature, type PaymentChallenge } from '../lib/x402/client.ts'
import { USDC_NETWORKS } from '../lib/x402/networks.ts'
import { CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { readProductIndex } from '../lib/x402/product-index.ts'

const ORIGIN = 'https://www.mahastrategies.com', NETWORK = 'eip155:8453', SCOPE = 'maha-demand6-approved-20261012'
export const CONFIRMATION = 'PUBLISHER_FUNDED_DEMAND6_ONCE_MAX_0_4629_USDC'
export const CAP = BigInt(462900)
export const TARGETS = DEMAND6_OFFERS.map(offer => ({ id: offer.id as Demand6Id, path: offer.path, amount: offer.amount, input: offer.discovery.input }))
const OPERATOR = { 'user-agent': 'maha-canary/demand6-indexing', 'x-maha-discovery-source': 'operator-canary', 'x-maha-task-attribution': 'operator-canary' }
export function assertDemandPlan() {
  if (TARGETS.length !== 6 || new Set(TARGETS.map(target => target.path)).size !== 6 || TARGETS.reduce((sum, target) => sum + BigInt(target.amount), BigInt(0)) !== CAP) throw Error('approved_demand_plan_changed')
  for (const target of TARGETS) if (target.amount !== DEMAND6_PRODUCTS[target.id].amount) throw Error('approved_demand_price_changed')
}
export function assertDemandChallenge(challenge: PaymentChallenge, target: typeof TARGETS[number]) {
  if (challenge.x402Version !== 2 || challenge.resource.url !== ORIGIN + target.path || challenge.accepts.length !== 2) throw Error('challenge_boundary_changed')
  for (const network of ['eip155:8453', 'eip155:42161'] as const) {
    const terms = challenge.accepts.filter(row => row.network === network), expected = USDC_NETWORKS[network], term = terms[0]
    if (terms.length !== 1 || term.scheme !== 'exact' || term.amount !== target.amount || term.asset.toLowerCase() !== expected.asset.toLowerCase()
      || term.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase() || term.extra?.name !== expected.domain.name || term.extra.version !== expected.domain.version
      || term.maxTimeoutSeconds !== 60) throw Error('challenge_terms_changed')
  }
}
function capsuleKey(key: string) { return createHmac('sha256', key).update(SCOPE + ':private-recovery-capsules').digest() }
export function sealRecovery(key: string, packet: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', capsuleKey(key), iv)
  cipher.setAAD(Buffer.from(SCOPE))
  const bytes = Buffer.concat([cipher.update(JSON.stringify(packet)), cipher.final()])
  return { version: SCOPE, iv: iv.toString('hex'), ciphertext: bytes.toString('base64'), tag: cipher.getAuthTag().toString('hex') }
}
export function openRecovery(key: string, packet: ReturnType<typeof sealRecovery>) {
  if (packet.version !== SCOPE) throw Error('recovery_scope_changed')
  const decipher = createDecipheriv('aes-256-gcm', capsuleKey(key), Buffer.from(packet.iv, 'hex'))
  decipher.setAAD(Buffer.from(SCOPE)); decipher.setAuthTag(Buffer.from(packet.tag, 'hex'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(packet.ciphertext, 'base64')), decipher.final()]).toString())
}
export async function verifyDemandDelivery(id: Demand6Id, input: unknown, value: unknown) {
  const product = demandResultSchema(id).parse(value)
  if (product.inputHash !== demandDigest(input) || product.resultHash !== demandDigest(product.result)
    || product.receiptDigest !== demandDigest({ version: product.version, productId: id, inputHash: product.inputHash, resultHash: product.resultHash })) throw Error('result_binding_invalid')
  if (['csv-import-preflight', 'product-catalogue-preflight'].includes(id) && demandDigest(product) !== demandDigest(await buildDemandProduct(id, input))) throw Error('deterministic_result_mismatch')
}
type Step = { offerId: string; resource: string; amountBaseUnits: string; state: string; transaction?: string; blockNumber?: number; responseSha256?: string; payloadVerified?: boolean; bazaarIndexed?: boolean }
export async function run() {
  assertDemandPlan()
  const args = process.argv.slice(2)
  if (args.some(arg => !['--pay', '--index-only'].includes(arg)) || args.length > 1) throw Error('unsupported_mode')
  const observe = async () => { const snapshot = await readProductIndex(); const indexed = TARGETS.filter(target => snapshot.resources.includes(ORIGIN + target.path)).map(target => target.id)
    return { checkedAt: snapshot.checkedAt, complete: snapshot.complete, available: snapshot.available, indexed, missing: TARGETS.filter(target => !indexed.includes(target.id)).map(target => target.id) } }
  if (args.includes('--index-only')) { console.log(JSON.stringify(await observe())); return }
  const challenges: PaymentChallenge[] = []
  // Every unpaid contract/quote is checked before the protected signer is read.
  for (const target of TARGETS) {
    const response = await fetch(ORIGIN + target.path, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { ...OPERATOR, 'content-type': 'application/json' }, body: JSON.stringify(target.input) })
    if (response.status !== 402) throw Error('unpaid_preflight_failed:' + target.id + ':' + response.status)
    const header = decodeChallenge(response.headers.get('PAYMENT-REQUIRED')), body = await response.json() as PaymentChallenge
    assertDemandChallenge(header, target); assertDemandChallenge(body, target)
    if (demandDigest(header) !== demandDigest(body)) throw Error('challenge_header_body_disagreement')
    challenges.push(header)
  }
  if (!args.includes('--pay')) { console.log(JSON.stringify({ state: 'preflight_passed', products: 6, maximumBaseUnits: String(CAP), index: await observe() })); return }
  const output = process.env.DEMAND6_CANARY_OUTPUT_PATH
  if (!output || process.env.DEMAND6_CANARY_CONFIRMATION !== CONFIRMATION || process.env.GITHUB_RUN_ATTEMPT !== '1') throw Error('explicit_first_attempt_authorization_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[\da-f]{64}$/i.test(key)) throw Error('protected_signer_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw Error('unexpected_operator_wallet')
  const rpcUrl = rpcUrlFor(NETWORK, process.env.BASE_RPC_URL)!, asset = USDC_NETWORKS[NETWORK].asset
  const client = createPublicClient({ chain: base, transport: http(rpcUrl, { retryCount: 0, timeout: 15000 }) })
  if (await client.getChainId() !== base.id) throw Error('wrong_rpc_chain')
  const abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function authorizationState(address,bytes32) view returns (bool)'])
  if (await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] }) < CAP) throw Error('insufficient_approved_batch_funding')
  const evidence = { version: SCOPE, classification: 'publisher-funded-indexing-canary', customerRevenue: false, organicDemand: false,
    maximumAuthorizedBaseUnits: String(CAP), newAuthorizedBaseUnits: '0', confirmedBaseUnits: '0', buyer: account.address, payee: MAHA_PAYEE,
    network: NETWORK, startedAt: new Date().toISOString(), state: 'running', steps: [] as Step[], index: await observe() }
  const capsules: ReturnType<typeof sealRecovery>[] = []
  const save = async () => { await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 }); await writeFile(output + '.recovery-encrypted.json', JSON.stringify(capsules, null, 2) + '\n', { mode: 0o600 }) }
  await save()
  try {
    for (const [i, target] of TARGETS.entries()) {
      const secret = createHmac('sha256', key).update(SCOPE + ':' + target.id + ':recovery-secret').digest('hex')
      const headers = demandPurchaseHeaders(target.input, secret), nonce = demandPurchaseNonce(target.id, headers['X-Maha-Input-Hash'], secret)
      // Stable nonce for this one batch; a later run cannot make another payment.
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] })) throw Error('original_purchase_already_used_review_do_not_repay')
      const challenge = challenges[i], requirement = challenge.accepts.find(row => row.network === NETWORK)!
      const typed = demandPurchaseTypedData(target.id, target.input, headers, { scheme: 'exact', network: NETWORK, amount: target.amount,
        payTo: MAHA_PAYEE, asset, maxTimeoutSeconds: requirement.maxTimeoutSeconds, extra: USDC_NETWORKS[NETWORK].domain }, account.address)
      const signature = await account.signTypedData({ ...typed, domain: { ...typed.domain, verifyingContract: typed.domain.verifyingContract as `0x${string}` }, message: typed.message as never })
      const payment = encodePaymentSignature(requirement, typed.message, signature, challenge)
      const next = BigInt(evidence.newAuthorizedBaseUnits) + BigInt(target.amount)
      if (next > CAP) throw Error('service_payment_cap_exceeded')
      evidence.newAuthorizedBaseUnits = String(next)
      const step: Step = { offerId: target.id, resource: ORIGIN + target.path, amountBaseUnits: target.amount, state: 'authorized_outcome_unknown' }
      evidence.steps.push(step)
      capsules.push(sealRecovery(key, { productId: target.id, resource: step.resource, input: target.input, headers, paymentSignature: payment }))
      await save() // Private authorization is encrypted and retained before HTTP submission.
      const response = await fetch(step.resource, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000),
        headers: { ...OPERATOR, ...headers, 'content-type': 'application/json', 'PAYMENT-SIGNATURE': payment }, body: JSON.stringify(target.input) })
      const receipt = decodeReceipt(response.headers.get('PAYMENT-RESPONSE'))
      if (!receipt) throw Error('settlement_receipt_missing')
      verifyPaymentReceipt(receipt, account.address)
      step.transaction = receipt.transaction!; step.state = 'receipt_recorded'; await save()
      const chain = await confirmSettlement({ rpcUrl, caip2Network: NETWORK, transaction: step.transaction, asset, payer: account.address,
        payTo: MAHA_PAYEE, minAmount: target.amount, attempts: 3, retryDelayMs: 1000 })
      if (chain.status !== 'confirmed' || chain.amount !== target.amount) throw Error('exact_transfer_not_confirmed')
      step.blockNumber = chain.blockNumber; evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(target.amount)); await save()
      if (response.status !== 200 || response.headers.get('X-Maha-Result-Retained') !== 'true') throw Error('retained_delivery_not_confirmed')
      const text = await response.text()
      if (Buffer.byteLength(text) > 65536) throw Error('result_oversized')
      await verifyDemandDelivery(target.id, target.input, JSON.parse(text))
      step.payloadVerified = true; step.responseSha256 = 'sha256:' + createHash('sha256').update(text).digest('hex'); step.state = 'confirmed_and_delivered'; await save()
    }
    evidence.index = await observe()
    for (const step of evidence.steps) step.bazaarIndexed = evidence.index.indexed.includes(step.offerId as Demand6Id)
    evidence.state = evidence.index.complete && !evidence.index.missing.length ? 'indexed' : 'payments_complete_index_pending'; await save()
    console.log(JSON.stringify({ state: evidence.state, delivered: evidence.steps.filter(step => step.payloadVerified).length, indexed: evidence.index.indexed.length,
      newAuthorizedBaseUnits: evidence.newAuthorizedBaseUnits, confirmedBaseUnits: evidence.confirmedBaseUnits }))
  } catch (error) {
    evidence.state = 'stopped_review_required_no_repayment'; await save()
    // Report only allowlisted machine codes, never raw provider bodies or keys.
    const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'indexing_outcome_requires_review'
    throw Error(code)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run()
