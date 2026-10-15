import { createCipheriv, createHmac, randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'
import { MODULAR_ADDITIONS, PRODUCTION_ADDITION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { readProductIndex } from '../lib/x402/product-index.ts'
import { parsePaymentHeader } from '../lib/x402/protocol.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'

export const ADDITION_CAP = 2534496n
export const ADDITION_CONFIRMATION = 'PUBLISHER_FUNDED_204_ONCE_MAX_2534496'
const ORIGIN = 'https://www.mahastrategies.com', SCOPE = MODULAR_ADDITIONS.version
const transport: typeof fetch = (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000),
  headers: { ...Object.fromEntries(new Headers(init?.headers)), 'user-agent': 'maha-operator-modular204/1', 'x-maha-discovery-source': 'maha_canary' } })
export function assertAdditionQuote(challenge: ReturnType<typeof decodeChallenge>, id: string) {
  const e = PRODUCTION_ADDITION_ENDPOINTS.find(e => e.id === id), t = challenge.accepts[0], n = usdcNetwork('eip155:8453')
  if (!e || challenge.x402Version !== 2 || challenge.accepts.length !== 1 || challenge.resource.url !== ORIGIN + e.path
    || t.network !== MODULAR_ADDITIONS.network || t.amount !== e.amount || t.asset.toLowerCase() !== n.asset.toLowerCase()
    || t.payTo.toLowerCase() !== MODULAR_ADDITIONS.payee || t.scheme !== 'exact' || t.maxTimeoutSeconds !== 60
    || t.extra?.name !== n.domain.name || t.extra?.version !== n.domain.version) throw Error('addition_quote_terms_changed')
  const b = challenge.extensions?.bazaar
  if (!b || !validateDiscoveryExtensionSpec(b as Record<string, unknown>).valid || !validateDiscoveryExtension(b as Parameters<typeof validateDiscoveryExtension>[0]).valid) throw Error('addition_bazaar_declaration_invalid')
  const recovery = challenge.extensions?.['maha-input-bound-recovery'] as { info?: { retentionSeconds?: number; receiptRetentionSeconds?: number; automaticRepayment?: boolean } }
  if (recovery?.info?.retentionSeconds !== 86400 || recovery.info.receiptRetentionSeconds !== 7776000 || recovery.info.automaticRepayment !== false) throw Error('addition_recovery_terms_changed')
}
export async function observeAdditions() {
  // The offline operator check can wait for all seven pages; keep the public
  // page's existing six-second latency budget unchanged.
  const index = await readProductIndex({ timeoutMs: 30000 })
  return { checkedAt: index.checkedAt, complete: index.complete, available: index.available,
    indexed: PRODUCTION_ADDITION_ENDPOINTS.filter(e => index.resources.includes(ORIGIN + e.path)).map(e => e.id),
    totalMerchantResources: index.resources.length }
}
export async function preflightAdditions() {
  for (const e of PRODUCTION_ADDITION_ENDPOINTS) {
    const response = await transport(ORIGIN + e.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: releaseExample(e.id)!.inputJson })
    const header = response.headers.get('PAYMENT-REQUIRED'); await response.body?.cancel()
    if (response.status !== 402 || !header || Buffer.byteLength(header) + 20 > 8000) throw Error('addition_unpaid_quote_failed:' + e.id)
    assertAdditionQuote(decodeChallenge(header), e.id)
  }
  return observeAdditions()
}
export function assertAdditionAdmission(env: Record<string, string | undefined>, wallet: string, balance: bigint) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.MODULAR204_CONFIRMATION !== ADDITION_CONFIRMATION || !env.MODULAR204_OUTPUT_PATH) throw Error('exact_first_attempt_approval_required')
  if (wallet.toLowerCase() !== MODULAR_ADDITIONS.operatorWallet || balance < ADDITION_CAP) throw Error('wrong_wallet_or_insufficient_balance')
}
export async function runAdditions() {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.some(a => !['--pay', '--observe'].includes(a))) throw Error('unsupported_indexing_mode')
  if (args.includes('--observe')) { console.log(JSON.stringify(await observeAdditions())); return }
  const index = await preflightAdditions()
  if (!args.includes('--pay')) { console.log(JSON.stringify({ state: '204_unpaid_quotes_verified', capBaseUnits: String(ADDITION_CAP), index })); return }
  // All public quotes are checked before reading a signing credential.
  if (!index.complete || !index.available) throw Error('complete_index_required_before_payment')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw Error('protected_signer_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`), asset = usdcNetwork('eip155:8453').asset as `0x${string}`
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org', { retryCount: 0, timeout: 15000 }) })
  const abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function authorizationState(address,bytes32) view returns(bool)'])
  if (await client.getChainId() !== 8453) throw Error('wrong_payment_chain')
  const initialBalance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
  assertAdditionAdmission(process.env, account.address, initialBalance)
  const output = process.env.MODULAR204_OUTPUT_PATH!
  type Step = { id: string; amountBaseUnits: string; state: string; transaction?: string; responseDigest?: string; status?: number; settlement?: string; delivery?: string }
  const evidence = { version: SCOPE, classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
    network: MODULAR_ADDITIONS.network, wallet: account.address, payee: MODULAR_ADDITIONS.payee, maximumBaseUnits: String(ADDITION_CAP), initialBalanceBaseUnits: String(initialBalance),
    authorizedBaseUnits: '0', confirmedBaseUnits: '0', startedAt: new Date().toISOString(), state: 'running', steps: [] as Step[], index }
  const packets: unknown[] = [], encryptionKey = createHmac('sha256', key).update(SCOPE + ':private-outbox').digest()
  const save = async () => {
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
    await writeFile(output + '.recovery-encrypted.json', JSON.stringify({ scope: SCOPE, packets }), { mode: 0o600 })
  }
  await save()
  try {
    for (const e of PRODUCTION_ADDITION_ENDPOINTS) {
      if (index.indexed.includes(e.id)) { evidence.steps.push({ id: e.id, amountBaseUnits: '0', state: 'already_indexed_no_payment' }); await save(); continue }
      const handler = handlerFor(e.id, e.amount)!, sample = releaseExample(e.id)!, input = handler.input.parse(sample.input)
      const secret = createHmac('sha256', key).update(SCOPE + ':' + e.id + ':original-once').digest('hex')
      const nonce = modularPaymentNonce(e.id, demandDigest(input), secret) as `0x${string}`
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] })) throw Error('authorization_already_used_do_not_repay')
      const step: Step = { id: e.id, amountBaseUnits: e.amount, state: 'preparing' }; evidence.steps.push(step)
      const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => handler.input.parse(x),
        validateOutput: (x: unknown) => { const value = handler.output.parse(x); if (demandDigest(value) !== demandDigest(sample.output)) throw Error('deterministic_delivery_mismatch'); return value } }
      const capsule = await prepareModularPurchase(contract, { input, payer: account.address, maximumAmount: BigInt(e.amount), secret, fetchImpl: transport,
        signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async capsule => {
          const next = BigInt(evidence.authorizedBaseUnits) + BigInt(e.amount); if (next > ADDITION_CAP) throw Error('approved_payment_cap_exceeded')
          const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv); cipher.setAAD(Buffer.from(SCOPE))
          const encrypted = Buffer.concat([cipher.update(JSON.stringify(capsule)), cipher.final()])
          packets.push({ id: e.id, iv: iv.toString('hex'), ciphertext: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('hex') })
          evidence.authorizedBaseUnits = String(next); step.state = 'authorized_outcome_unknown'; await save()
        } })
      const result = await submitModularPurchase(contract, capsule, { fetchImpl: transport })
      step.status = 'status' in result ? result.status : undefined; step.settlement = result.settlement; step.delivery = result.delivery
      if (result.transaction) step.transaction = result.transaction
      await save()
      if (result.settlement !== 'provider_reported' || result.delivery !== 'validated_response' || !result.transaction) throw Error('uncertain_outcome_stop_without_repayment')
      step.responseDigest = demandDigest(result.data)
      const p = parsePaymentHeader(capsule.headers['PAYMENT-SIGNATURE']); if (!p.ok) throw Error('invalid_saved_authorization')
      const receipt = await client.waitForTransactionReceipt({ hash: result.transaction as `0x${string}`, timeout: 20000, pollingInterval: 1500 })
      if (!receiptMatchesAuthorization(receipt, { transaction: result.transaction, payer: account.address.toLowerCase(), payee: MODULAR_ADDITIONS.payee, amount: e.amount,
        nonce: (p.payment.payload.authorization as { nonce: string }).nonce })) throw Error('chain_confirmation_missing_do_not_repay')
      step.state = 'confirmed_and_delivered'; evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(e.amount)); await save()
      console.log(JSON.stringify({ state: 'operator_indexing_progress', confirmed: evidence.steps.filter(s => s.state === 'confirmed_and_delivered').length, confirmedBaseUnits: evidence.confirmedBaseUnits, maximumBaseUnits: String(ADDITION_CAP) }))
      await new Promise(resolve => setTimeout(resolve, 2200))
    }
    evidence.index = await observeAdditions(); evidence.state = evidence.index.complete && evidence.index.indexed.length === 204 ? 'indexed' : 'payments_complete_index_pending'; await save()
    console.log(JSON.stringify({ state: evidence.state, confirmedBaseUnits: evidence.confirmedBaseUnits, indexed: evidence.index.indexed.length }))
  } catch { evidence.state = 'stopped_review_required_no_repayment'; await save(); throw Error('operator_indexing_stopped_review_required') }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runAdditions().catch(() => { console.error('modular204_failed_no_automatic_repayment'); process.exitCode = 1 })
