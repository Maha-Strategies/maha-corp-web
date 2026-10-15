import { createCipheriv, createHmac, randomBytes } from 'node:crypto'
import { open, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'
import { MODULAR_42_ADDITIONS, FINAL42_PRODUCTION_ENDPOINTS as BATCH42_PRODUCTION_ENDPOINTS, PRODUCTION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { validateFinal42Delivery } from '../lib/api-v1/final42-validation.ts'
import { recoverySeconds } from '../lib/api-v1/types.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { prepareModularPurchase, submitModularPurchase, validateModularCapsule, type ModularBuyerContract, type ModularCapsule } from '../lib/x402/modular-buyer.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { readProductIndex } from '../lib/x402/product-index.ts'
import { paymentRequiredHeaderBytes, PAYMENT_REQUIRED_HEADER_LIMIT } from '../lib/x402/response-header-budget.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'

export const BATCH42_CAP = 2592940n
export const SAFETY_RESERVE = 0n
export const BATCH42_CONFIRMATION = 'PUBLISHER_FUNDED_42_ONCE_MAX_2592940'
const ORIGIN = 'https://www.mahastrategies.com', SCOPE = MODULAR_42_ADDITIONS.version
/** Keep the previous complete outbox until its replacement is durable. */
export async function writePrivateEvidenceAtomically(path: string, value: unknown, replace = rename) {
  const temporary = path + '.pending-' + randomBytes(12).toString('hex')
  try {
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync() } finally { await file.close() }
    await replace(temporary, path)
    const directory = await open(dirname(path), 'r')
    try { await directory.sync() } finally { await directory.close() }
  } finally { await unlink(temporary).catch(() => {}) }
}
const transport: typeof fetch = (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000),
  headers: { ...Object.fromEntries(new Headers(init?.headers)), 'user-agent': 'maha-operator-modular42/1', 'x-maha-discovery-source': 'maha_canary' } })
export function assertBatch42Quote(challenge: ReturnType<typeof decodeChallenge>, id: string) {
  const e = BATCH42_PRODUCTION_ENDPOINTS.find(e => e.id === id), t = challenge.accepts[0], n = usdcNetwork('eip155:8453')
  if (!e || challenge.x402Version !== 2 || challenge.accepts.length !== 1 || challenge.resource.url !== ORIGIN + e.path
    || t.network !== MODULAR_42_ADDITIONS.network || t.amount !== e.amount || t.asset.toLowerCase() !== n.asset.toLowerCase()
    || t.payTo.toLowerCase() !== MODULAR_42_ADDITIONS.payee || t.scheme !== 'exact' || t.maxTimeoutSeconds !== 60
    || t.extra?.name !== n.domain.name || t.extra?.version !== n.domain.version) throw Error('batch42_quote_terms_changed')
  const b = challenge.extensions?.bazaar
  if (!b || !validateDiscoveryExtensionSpec(b as Record<string, unknown>).valid || !validateDiscoveryExtension(b as Parameters<typeof validateDiscoveryExtension>[0]).valid) throw Error('batch42_bazaar_declaration_invalid')
  const recovery = challenge.extensions?.['maha-input-bound-recovery'] as { info?: { retentionSeconds?: number; receiptRetentionSeconds?: number; automaticRepayment?: boolean } }
  const contract = challenge.extensions?.['maha-modular-contract'] as { info?: { id?: string; contractHash?: string; declarationUrl?: string } }
  if (recovery?.info?.retentionSeconds !== recoverySeconds(e) || recovery.info.receiptRetentionSeconds !== 7776000 || recovery.info.automaticRepayment !== false
    || contract?.info?.id !== id || contract.info.contractHash !== releaseExample(id)?.contractHash
    || contract.info.declarationUrl !== ORIGIN + '/api/v1/discovery/describe?id=' + encodeURIComponent(id)) throw Error('batch42_recovery_or_contract_changed')
}
export async function observeBatch42() {
  const index = await readProductIndex({ timeoutMs: 30000 })
  return { checkedAt: index.checkedAt, complete: index.complete, available: index.available,
    indexed: BATCH42_PRODUCTION_ENDPOINTS.filter(e => index.resources.includes(ORIGIN + e.path)).map(e => e.id), totalMerchantResources: index.resources.length,
    allModularIndexed: PRODUCTION_ENDPOINTS.filter(e => index.resources.includes(ORIGIN + e.path)).length }
}
export async function preflightBatch42() {
  for (const e of BATCH42_PRODUCTION_ENDPOINTS) {
    const response = await transport(ORIGIN + e.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: releaseExample(e.id)!.inputJson })
    const header = response.headers.get('PAYMENT-REQUIRED'); await response.body?.cancel()
    if (response.status !== 402 || !header || paymentRequiredHeaderBytes(header) > PAYMENT_REQUIRED_HEADER_LIMIT) throw Error('next_unpaid_quote_failed:' + e.id)
    assertBatch42Quote(decodeChallenge(header), e.id)
  }
  return observeBatch42()
}
export function assertBatch42Admission(env: Record<string, string | undefined>, wallet: string, balance: bigint) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_RUN_ATTEMPT !== '1' || env.GITHUB_RUN_NUMBER !== '1'
    || env.MODULAR42_CONFIRMATION !== BATCH42_CONFIRMATION || !env.MODULAR42_OUTPUT_PATH) throw Error('exact_first_main_attempt_approval_required')
  if (wallet.toLowerCase() !== MODULAR_42_ADDITIONS.operatorWallet || balance < BATCH42_CAP + SAFETY_RESERVE) throw Error('wrong_wallet_or_insufficient_balance')
}
export function batch42Budget() {
  let authorized = 0n
  const seen = new Set<string>()
  return { get authorized() { return authorized }, reserve(id: string, amount: string) {
    const e = BATCH42_PRODUCTION_ENDPOINTS.find(e => e.id === id)
    if (!e || e.amount !== amount || seen.has(id)) throw Error('duplicate_or_unapproved_authorization')
    const next = authorized + BigInt(amount)
    if (next > BATCH42_CAP) throw Error('approved_batch42_cap_exceeded')
    seen.add(id); authorized = next
  } }
}
type Result = Awaited<ReturnType<typeof submitModularPurchase>>
export async function recoverBatch42RetainedOnly(contract: ModularBuyerContract, capsule: ModularCapsule, dependencies: {
  submit?: typeof submitModularPurchase; delay?: (ms: number) => Promise<void>; fetchImpl?: typeof fetch
  observe?: (value: { attempt: number; status?: number; errorCode?: string }) => Promise<void>
} = {}): Promise<Result> {
  const send = dependencies.submit ?? submitModularPurchase, delay = dependencies.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  // Recovery is an explicit retained-result read. It cannot prepare, sign or
  // repeat an original settlement-capable request, even after auth expiry.
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await send(contract, capsule, { fetchImpl: dependencies.fetchImpl, recovery: 'retained-result' })
    await dependencies.observe?.({ attempt: attempt + 1, status: 'status' in result ? result.status : undefined,
      errorCode: 'errorCode' in result ? String(result.errorCode) : undefined })
    if (result.delivery === 'validated_response' && result.settlement === 'provider_reported' && result.transaction) return result
    const pending = 'errorCode' in result && ['settlement_confirmation_pending_do_not_repay', 'settlement_unknown_do_not_repay', 'retained_evidence_invalid_or_unavailable_do_not_repay'].includes(String(result.errorCode))
    if (!pending || attempt === 9) throw Error('retained_recovery_unresolved_stop_without_repayment')
    await delay(5000)
  }
  throw Error('retained_recovery_unresolved_stop_without_repayment')
}
function contractFor(id: string): ModularBuyerContract {
  const e = BATCH42_PRODUCTION_ENDPOINTS.find(e => e.id === id)!, h = handlerFor(id, e.amount)!, sample = releaseExample(id)!
  return { id, path: e.path, amount: e.amount, recoverySeconds: recoverySeconds(e), validateInput: x => h.input.parse(x),
    validateOutput: x => validateFinal42Delivery(e, sample.input, x, sample.output) }
}
export async function runBatch42() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--preflight', '--pay', '--observe'].includes(args[0])) throw Error('explicit_final42_mode_required')
  if (args[0] === '--observe') { console.log(JSON.stringify(await observeBatch42())); return }
  const index = await preflightBatch42()
  if (args[0] === '--preflight') { console.log(JSON.stringify({ state: '42_unpaid_quotes_verified', index, maximumBaseUnits: String(BATCH42_CAP) })); return }
  if (!index.available || !index.complete) throw Error('complete_catalogue_required_before_signer_access')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim(), rpc = process.env.BASE_RPC_URL?.trim()
  if (!key || !/^0x[a-f0-9]{64}$/i.test(key) || !rpc || new URL(rpc).protocol !== 'https:') throw Error('protected_signer_and_managed_rpc_required')
  const account = privateKeyToAccount(key as `0x${string}`), client = createPublicClient({ chain: base, transport: http(rpc, { retryCount: 0, timeout: 15000 }) })
  const asset = usdcNetwork('eip155:8453').asset as `0x${string}`, abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function authorizationState(address,bytes32) view returns(bool)'])
  if (await client.getChainId() !== 8453) throw Error('wrong_payment_chain')
  const balance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
  assertBatch42Admission(process.env, account.address, balance)
  const output = process.env.MODULAR42_OUTPUT_PATH!, budget = batch42Budget()
  type Step = { id: string; amountBaseUnits: string; state: string; transaction?: string; status?: number; errorCode?: string; responseDigest?: string }
  const evidence = { version: SCOPE, classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
    network: MODULAR_42_ADDITIONS.network, wallet: account.address, payee: MODULAR_42_ADDITIONS.payee, maximumBaseUnits: String(BATCH42_CAP),
    initialBalanceBaseUnits: String(balance), authorizedBaseUnits: '0', confirmedBaseUnits: '0', state: 'running', startedAt: new Date().toISOString(), steps: [] as Step[], index }
  const packets: unknown[] = [], encryptionKey = createHmac('sha256', key).update(SCOPE + ':private-outbox').digest()
  const save = async () => {
    // Capsules first: no original submission can happen before the encrypted
    // outbox is atomically replaced and synced. Later progress writes cannot
    // truncate the only retained copy of a paid authorization.
    await writePrivateEvidenceAtomically(output + '.recovery-encrypted.json', { scope: SCOPE, packets })
    await writePrivateEvidenceAtomically(output, evidence)
  }
  await save()
  try {
    for (const e of BATCH42_PRODUCTION_ENDPOINTS) {
      if (index.indexed.includes(e.id)) { evidence.steps.push({ id: e.id, amountBaseUnits: '0', state: 'already_indexed_no_payment' }); await save(); continue }
      const contract = contractFor(e.id), input = contract.validateInput(releaseExample(e.id)!.input)
      const secret = createHmac('sha256', key).update(SCOPE + ':' + e.id + ':original-once').digest('hex')
      const nonce = modularPaymentNonce(e.id, demandDigest(input), secret) as `0x${string}`
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] })) throw Error('existing_authorization_stop_do_not_repay')
      const step: Step = { id: e.id, amountBaseUnits: e.amount, state: 'preparing_first_authorization' }; evidence.steps.push(step)
      const capsule = await prepareModularPurchase(contract, { input, payer: account.address, maximumAmount: BigInt(e.amount), secret,
        fetchImpl: transport, signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async saved => {
          budget.reserve(e.id, e.amount)
          const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv); cipher.setAAD(Buffer.from(SCOPE))
          const bytes = Buffer.concat([cipher.update(JSON.stringify(saved)), cipher.final()])
          packets.push({ id: e.id, iv: iv.toString('hex'), ciphertext: bytes.toString('base64'), tag: cipher.getAuthTag().toString('hex') })
          evidence.authorizedBaseUnits = String(budget.authorized); step.state = 'authorized_outcome_unknown'; await save()
        } })
      let result = await submitModularPurchase(contract, capsule, { fetchImpl: transport })
      step.status = 'status' in result ? result.status : undefined; step.errorCode = 'errorCode' in result ? String(result.errorCode) : undefined; await save()
      if (result.delivery !== 'validated_response') {
        const pending = 'errorCode' in result && ['settlement_confirmation_pending_do_not_repay', 'settlement_unknown_do_not_repay'].includes(String(result.errorCode))
        if (!pending) throw Error('uncertain_first_submission_stop_without_repayment')
        await new Promise(resolve => setTimeout(resolve, 5000))
        result = await recoverBatch42RetainedOnly(contract, capsule, { fetchImpl: transport, observe: async value => {
          step.status = value.status; step.errorCode = value.errorCode; await save()
        } })
      }
      if (result.delivery !== 'validated_response' || result.settlement !== 'provider_reported' || !result.transaction) throw Error('delivery_not_validated_stop_without_repayment')
      const { authorization } = await validateModularCapsule(contract, capsule)
      const receipt = await client.waitForTransactionReceipt({ hash: result.transaction as `0x${string}`, timeout: 30000, pollingInterval: 2000 })
      if (!receiptMatchesAuthorization(receipt, { transaction: result.transaction, payer: account.address.toLowerCase(), payee: MODULAR_42_ADDITIONS.payee,
        amount: e.amount, nonce: String(authorization.nonce) })) throw Error('receipt_mismatch_no_repayment')
      step.transaction = result.transaction; step.responseDigest = demandDigest(result.data); step.state = 'confirmed_and_delivered'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(e.amount)); await save()
      console.log(JSON.stringify({ state: 'confirmed_operator_progress', delivered: evidence.steps.filter(s => s.state === 'confirmed_and_delivered').length,
        confirmedBaseUnits: evidence.confirmedBaseUnits, authorizedBaseUnits: evidence.authorizedBaseUnits, maximumBaseUnits: String(BATCH42_CAP) }))
      await new Promise(resolve => setTimeout(resolve, 2500))
    }
    evidence.index = await observeBatch42(); evidence.state = evidence.index.complete && evidence.index.indexed.length === 42 && evidence.index.allModularIndexed === 1000 ? 'indexed' : 'payments_complete_index_pending'
    const finalBalance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
    Object.assign(evidence, { finalBalanceBaseUnits: String(finalBalance) }); await save()
    console.log(JSON.stringify({ state: evidence.state, confirmedBaseUnits: evidence.confirmedBaseUnits, indexed: evidence.index.indexed.length }))
  } catch (error) {
    evidence.state = 'stopped_review_required_no_repayment'; await save()
    console.error(error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'next_indexing_failed_no_repayment')
    throw Error('next_indexing_stopped_no_automatic_repayment')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runBatch42().catch(() => { console.error('modular42_failed_no_automatic_repayment'); process.exitCode = 1 })
