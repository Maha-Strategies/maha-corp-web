import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { BATCH132_CAP, ORIGINAL_ATTEMPT_RESERVE, batch132Budget, observeBatch132, preflightBatch132, recoverBatch132RetainedOnly, writePrivateEvidenceAtomically } from './run-modular132-indexing.ts'
import { BATCH132_PRODUCTION_ENDPOINTS, MODULAR_132_ADDITIONS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { assertFrozenDelivery } from '../lib/api-v1/frozen-delivery.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { prepareModularPurchase, submitModularPurchase, validateModularCapsule, type ModularCapsule, type ModularBuyerContract } from '../lib/x402/modular-buyer.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'

export const CONTINUATION_BRANCH = 'refs/heads/codex/modular132-recovery-20261015'
export const CONTINUATION_CONFIRMATION = 'RECOVER_THEN_CONTINUE_132_MAX_6996054_ONCE'
export const PRIOR_ID = 'reading-plans-scope-boundary-audit'
export const ORIGINAL_ID = 'edition-records-scope-boundary-audit'
export const PREPAID_BASE_UNITS = 76681n
export const ORIGINAL_EVIDENCE_HASH = 'dd43fc8009ba4fdf1351709580f1a4a67e63c9692298e1acad2025f5104d5b8f'
export const ORIGINAL_OUTBOX_HASH = '865c9f7ee202014808ee70867210f2e443e341fd78adcf9215dfd660d7211742'
const FIRST_REPLACEMENT_SCOPE = MODULAR_132_ADDITIONS.version + ':approved-billing-recovery/1'
const ORIGINAL_SCOPE = FIRST_REPLACEMENT_SCOPE + ':paid-response-recovery/1'
const SCOPE = ORIGINAL_SCOPE + ':resume-paid-second/1'
const ORIGIN = 'https://www.mahastrategies.com'
type Step = { id: string; amountBaseUnits: string; state: string; transaction?: string; responseDigest?: string; status?: number; errorCode?: string }

function assertContinuationScope(env: Record<string, string | undefined>, wallet: string) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== CONTINUATION_BRANCH || env.GITHUB_RUN_ATTEMPT !== '1' || env.GITHUB_RUN_NUMBER !== '4'
    || env.MODULAR132_CONTINUATION_CONFIRMATION !== CONTINUATION_CONFIRMATION || !env.MODULAR132_ORIGINAL_DIRECTORY || !env.MODULAR132_CONTINUATION_OUTPUT
    || wallet.toLowerCase() !== MODULAR_132_ADDITIONS.operatorWallet)
    throw Error('exact_second_run_approval_wallet_and_reserved_balance_required')
}
export function assertContinuationAdmission(env: Record<string, string | undefined>, wallet: string, balance: bigint, originalConfirmedBaseUnits = 0n) {
  assertContinuationScope(env, wallet)
  if (![0n, PREPAID_BASE_UNITS].includes(originalConfirmedBaseUnits) || balance < BATCH132_CAP + ORIGINAL_ATTEMPT_RESERVE - originalConfirmedBaseUnits)
    throw Error('exact_second_run_approval_wallet_and_reserved_balance_required')
}
export function pinnedOriginal(bytes: Buffer, digest: string) {
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('pinned_original_artifact_mismatch')
  return JSON.parse(bytes.toString('utf8'))
}
export function originalDisposition(proof: { finalizedUsed: boolean; latestUsed: boolean; finalizedTimestamp: bigint; validBefore: bigint }) {
  if (proof.finalizedUsed && !proof.latestUsed) throw Error('contradictory_nonce_state_do_not_repay')
  if (proof.latestUsed) return 'recover_paid_only' as const
  if (proof.finalizedTimestamp <= proof.validBefore) throw Error('original_not_finalized_expired_do_not_repay')
  return 'controlled_replacement_permitted' as const
}
export function continuationSecret(key: string, id: string) {
  if ([ORIGINAL_ID, PRIOR_ID].includes(id)) throw Error('paid_original_cannot_be_prepared_again')
  return createHmac('sha256', key).update(MODULAR_132_ADDITIONS.version + ':' + id + ':original-once').digest('hex')
}
export async function recoverConfirmedOriginal(contract: ModularBuyerContract, capsule: ModularCapsule, transaction: string, dependencies: {
  submit?: typeof submitModularPurchase; delay?: (ms: number) => Promise<void>; observe?: (status?: number, code?: string) => Promise<void>
} = {}) {
  const send = dependencies.submit ?? submitModularPurchase, delay = dependencies.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await send(contract, capsule, { fetchImpl: transport, recovery: 'retained-result' })
    await dependencies.observe?.('status' in result ? result.status : undefined, 'errorCode' in result ? String(result.errorCode) : undefined)
    if (result.delivery === 'validated_response') {
      if (result.transaction !== transaction) throw Error('retained_transaction_binding_mismatch')
      return result
    }
    if (attempt < 9) await delay(10000)
  }
  throw Error('confirmed_payment_retained_response_unavailable_do_not_repay')
}
function contractFor(id: string): ModularBuyerContract {
  const e = BATCH132_PRODUCTION_ENDPOINTS.find(e => e.id === id)!, sample = releaseExample(id)!, h = handlerFor(id, e.amount)!
  return { id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: x => h.input.parse(x),
    validateOutput: x => { const value = h.output.parse(x); assertFrozenDelivery(id, value, sample.output); return value } }
}
const transport: typeof fetch = (input, init) => {
  const url = new URL(String(input))
  if (url.origin !== ORIGIN || !BATCH132_PRODUCTION_ENDPOINTS.some(e => url.pathname === e.path) || url.search || url.hash) throw Error('approved_product_transport_only')
  return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { ...Object.fromEntries(new Headers(init?.headers)), 'user-agent': 'maha-operator-modular132-recovery/1', 'x-maha-discovery-source': 'maha_canary' } })
}
export async function continueModular132() {
  if (process.argv.slice(2).join(' ') !== '--continue') throw Error('explicit_continuation_mode_required')
  const directory = process.env.MODULAR132_ORIGINAL_DIRECTORY!, output = process.env.MODULAR132_CONTINUATION_OUTPUT!
  // Hash pinning happens before signer access. The original artifact remains immutable.
  const original = pinnedOriginal(await readFile(join(directory, 'modular132-continuation-evidence.json')), ORIGINAL_EVIDENCE_HASH)
  const outbox = pinnedOriginal(await readFile(join(directory, 'modular132-continuation-evidence.json.recovery-encrypted.json')), ORIGINAL_OUTBOX_HASH)
  if (original.scope !== ORIGINAL_SCOPE || outbox.scope !== ORIGINAL_SCOPE || original.steps.length !== 2 || outbox.packets.length !== 1
    || original.steps[0].id !== PRIOR_ID || original.steps[0].amountBaseUnits !== '38340' || original.steps[0].state !== 'original_confirmed_and_recovered_without_repayment'
    || original.steps[1].id !== ORIGINAL_ID || original.steps[1].amountBaseUnits !== '38341' || original.steps[1].state !== 'authorized_outcome_unknown'
    || original.authorizedBaseUnits !== '76681' || original.confirmedBaseUnits !== '38340' || original.maximumBaseUnits !== String(BATCH132_CAP)
    || original.wallet.toLowerCase() !== MODULAR_132_ADDITIONS.operatorWallet || outbox.packets[0].id !== ORIGINAL_ID) throw Error('exact_original_scope_required')
  const index = await preflightBatch132()
  if (!index.complete || !index.available) throw Error('complete_catalogue_required_before_signer_access')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim(), rpc = process.env.BASE_RPC_URL?.trim()
  if (!key || !/^0x[a-f0-9]{64}$/i.test(key) || !rpc || new URL(rpc).protocol !== 'https:') throw Error('protected_credentials_required')
  const account = privateKeyToAccount(key as `0x${string}`), client = createPublicClient({ chain: base, transport: http(rpc, { retryCount: 0, timeout: 15000 }) })
  const asset = usdcNetwork('eip155:8453').asset as `0x${string}`, abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function authorizationState(address,bytes32) view returns(bool)'])
  if (await client.getChainId() !== 8453) throw Error('wrong_chain')
  const balance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
  assertContinuationScope(process.env, account.address)
  const packet = outbox.packets[0], decryptionKey = createHmac('sha256', key).update(ORIGINAL_SCOPE + ':private-outbox').digest()
  const decipher = createDecipheriv('aes-256-gcm', decryptionKey, Buffer.from(packet.iv, 'hex')); decipher.setAAD(Buffer.from(ORIGINAL_SCOPE)); decipher.setAuthTag(Buffer.from(packet.tag, 'hex'))
  const capsule: ModularCapsule = JSON.parse(Buffer.concat([decipher.update(Buffer.from(packet.ciphertext, 'base64')), decipher.final()]).toString('utf8'))
  const originalContract = contractFor(ORIGINAL_ID), { authorization } = await validateModularCapsule(originalContract, capsule)
  if (capsule.payer !== MODULAR_132_ADDITIONS.operatorWallet || demandDigest(capsule.input) !== demandDigest(releaseExample(ORIGINAL_ID)!.input)) throw Error('original_capsule_binding_mismatch')
  const nonce = String(authorization.nonce) as `0x${string}`, finalized = await client.getBlock({ blockTag: 'finalized' })
  const [finalizedUsed, latestUsed] = await Promise.all([
    client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce], blockNumber: finalized.number }),
    client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] }),
  ])
  const disposition = originalDisposition({ finalizedUsed, latestUsed, finalizedTimestamp: finalized.timestamp, validBefore: BigInt(String(authorization.validBefore)) })
  if (disposition !== 'recover_paid_only') throw Error('expected_paid_original_nonce_not_confirmed_no_replacement_allowed')
  const evidence = { scope: SCOPE, originalRun: 38748470657, checkedAt: new Date().toISOString(), classification: 'publisher-funded-operator-activity',
    customerRevenue: false, organicDemand: false, automaticRepayment: false, wallet: account.address, payee: MODULAR_132_ADDITIONS.payee,
    maximumBaseUnits: String(BATCH132_CAP), protectedReserveBaseUnits: String(ORIGINAL_ATTEMPT_RESERVE), initialBalanceBaseUnits: String(balance),
    original: { finalizedBlock: String(finalized.number), finalizedTimestamp: String(finalized.timestamp), finalizedUsed, latestUsed, validBefore: String(authorization.validBefore), disposition,
      receiptVerified: false, retainedStatus: 0, retainedError: '', transaction: '' },
    authorizedBaseUnits: '0', confirmedBaseUnits: '0', state: 'reconciling_original', steps: [] as Step[], index }
  const packets: unknown[] = [], encryptionKey = createHmac('sha256', key).update(SCOPE + ':private-outbox').digest(), budget = batch132Budget()
  const save = async () => {
    await writePrivateEvidenceAtomically(output + '.recovery-encrypted.json', { scope: SCOPE, packets })
    await writePrivateEvidenceAtomically(output, evidence)
  }
  await save()
  try {
    const prior: Step = original.steps[0], priorEndpoint = BATCH132_PRODUCTION_ENDPOINTS.find(e => e.id === PRIOR_ID)!
    const priorSecret = createHmac('sha256', key).update(FIRST_REPLACEMENT_SCOPE + ':' + PRIOR_ID + ':original-once').digest('hex')
    const priorNonce = modularPaymentNonce(PRIOR_ID, demandDigest(releaseExample(PRIOR_ID)!.input), priorSecret)
    if (!prior.transaction || !receiptMatchesAuthorization(await client.getTransactionReceipt({ hash: prior.transaction as `0x${string}` }), {
      transaction: prior.transaction, payer: capsule.payer, payee: MODULAR_132_ADDITIONS.payee, amount: priorEndpoint.amount, nonce: priorNonce })) throw Error('prior_confirmed_receipt_mismatch_do_not_repay')
    budget.reserve(PRIOR_ID, priorEndpoint.amount); evidence.steps.push(prior)
    evidence.authorizedBaseUnits = String(budget.authorized); evidence.confirmedBaseUnits = priorEndpoint.amount; await save()
    if (disposition === 'recover_paid_only') {
      const latest = await client.getBlock(), estimated = (latest.timestamp - BigInt(String(authorization.validAfter))) / 2n + 1000n
      const window = estimated < 50000n ? estimated : 50000n, start = latest.number > window ? latest.number - window : 0n
      if ((await client.getBlock({ blockNumber: start })).timestamp > BigInt(String(authorization.validAfter))) throw Error('original_log_window_incomplete_do_not_repay')
      const event = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)'), matches: `0x${string}`[] = []
      for (let from = start; from <= latest.number; from += 2000n) {
        const to = from + 1999n < latest.number ? from + 1999n : latest.number
        for (const log of await client.getLogs({ address: asset, event, args: { authorizer: account.address, nonce }, fromBlock: from, toBlock: to, strict: true }))
          if (!log.removed && log.transactionHash) matches.push(log.transactionHash)
      }
      if (matches.length !== 1) throw Error('original_used_without_unique_settlement_do_not_repay')
      const transaction = matches[0], receipt = await client.getTransactionReceipt({ hash: transaction })
      if (!receiptMatchesAuthorization(receipt, { transaction, payer: capsule.payer, payee: MODULAR_132_ADDITIONS.payee, amount: originalContract.amount, nonce })) throw Error('original_receipt_mismatch_do_not_repay')
      evidence.original.receiptVerified = true; evidence.original.transaction = transaction
    }
    // This request cannot settle: it explicitly asks only for an already-retained result.
    const retained = await recoverConfirmedOriginal(originalContract, capsule, evidence.original.transaction, { observe: async (status, code) => {
      evidence.original.retainedStatus = status ?? 0; evidence.original.retainedError = code ?? ''; await save()
    } })
    evidence.original.retainedStatus = 'status' in retained ? retained.status ?? 0 : 0
    evidence.original.retainedError = 'errorCode' in retained ? String(retained.errorCode) : ''
    await save()
    if (disposition === 'recover_paid_only') {
      if (retained.delivery !== 'validated_response' || retained.transaction !== evidence.original.transaction) throw Error('paid_original_not_recovered_do_not_repay')
      assertContinuationAdmission(process.env, account.address, balance, PREPAID_BASE_UNITS)
      budget.reserve(ORIGINAL_ID, originalContract.amount)
      evidence.steps.push({ id: ORIGINAL_ID, amountBaseUnits: originalContract.amount, state: 'original_confirmed_and_recovered_without_repayment', transaction: retained.transaction, responseDigest: demandDigest(retained.data) })
      evidence.authorizedBaseUnits = String(budget.authorized); evidence.confirmedBaseUnits = String(PREPAID_BASE_UNITS); await save()
    } else {
      if (retained.delivery === 'validated_response') throw Error('retained_receipt_contradicts_unused_nonce_do_not_repay')
      assertContinuationAdmission(process.env, account.address, balance)
    }
    for (const e of BATCH132_PRODUCTION_ENDPOINTS) {
      if (evidence.steps.some(s => s.id === e.id && s.transaction)) continue
      if (index.indexed.includes(e.id)) { evidence.steps.push({ id: e.id, amountBaseUnits: '0', state: 'already_indexed_no_payment' }); await save(); continue }
      const contract = contractFor(e.id), input = contract.validateInput(releaseExample(e.id)!.input)
      const secret = continuationSecret(key, e.id), freshNonce = modularPaymentNonce(e.id, demandDigest(input), secret) as `0x${string}`
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, freshNonce] })) throw Error('continuation_nonce_already_used_do_not_repay')
      const step: Step = { id: e.id, amountBaseUnits: e.amount, state: 'preparing_first_authorization' }; evidence.steps.push(step)
      const fresh = await prepareModularPurchase(contract, { input, payer: account.address, maximumAmount: BigInt(e.amount), secret, fetchImpl: transport,
        signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async saved => {
          budget.reserve(e.id, e.amount)
          const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv); cipher.setAAD(Buffer.from(SCOPE))
          const bytes = Buffer.concat([cipher.update(JSON.stringify(saved)), cipher.final()])
          packets.push({ id: e.id, iv: iv.toString('hex'), ciphertext: bytes.toString('base64'), tag: cipher.getAuthTag().toString('hex') })
          evidence.authorizedBaseUnits = String(budget.authorized); step.state = 'authorized_outcome_unknown'; await save()
        } })
      let result = await submitModularPurchase(contract, fresh, { fetchImpl: transport })
      step.status = 'status' in result ? result.status : undefined; step.errorCode = 'errorCode' in result ? String(result.errorCode) : undefined; await save()
      if (result.delivery !== 'validated_response') {
        const pending = 'errorCode' in result && ['settlement_confirmation_pending_do_not_repay', 'settlement_unknown_do_not_repay', 'retained_evidence_invalid_or_unavailable_do_not_repay'].includes(String(result.errorCode))
        if (!pending) throw Error('continuation_first_submission_uncertain_stop')
        result = await recoverBatch132RetainedOnly(contract, fresh, { fetchImpl: transport, observe: async value => { step.status = value.status; step.errorCode = value.errorCode; await save() } })
      }
      if (result.delivery !== 'validated_response' || result.settlement !== 'provider_reported' || !result.transaction) throw Error('delivery_not_validated_do_not_repay')
      const { authorization: paid } = await validateModularCapsule(contract, fresh)
      const receipt = await client.waitForTransactionReceipt({ hash: result.transaction as `0x${string}`, timeout: 30000, pollingInterval: 2000 })
      if (!receiptMatchesAuthorization(receipt, { transaction: result.transaction, payer: capsule.payer, payee: MODULAR_132_ADDITIONS.payee, amount: e.amount, nonce: String(paid.nonce) })) throw Error('continuation_receipt_mismatch_do_not_repay')
      step.transaction = result.transaction; step.responseDigest = demandDigest(result.data); step.state = 'confirmed_and_delivered'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(e.amount)); await save()
      console.log(JSON.stringify({ state: 'confirmed_operator_progress', confirmedProducts: evidence.steps.filter(s => s.transaction).length,
        confirmedBaseUnits: evidence.confirmedBaseUnits, authorizedBaseUnits: evidence.authorizedBaseUnits, maximumBaseUnits: String(BATCH132_CAP) }))
      await new Promise(resolve => setTimeout(resolve, 2500))
    }
    evidence.index = await observeBatch132(); evidence.state = evidence.index.complete && evidence.index.indexed.length === 132 ? 'indexed' : 'payments_complete_index_pending'
    Object.assign(evidence, { finalBalanceBaseUnits: String(await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })) }); await save()
    console.log(JSON.stringify({ state: evidence.state, confirmedBaseUnits: evidence.confirmedBaseUnits, indexed: evidence.index.indexed.length }))
  } catch (error) {
    evidence.state = 'stopped_review_required_no_repayment'
    Object.assign(evidence, { stopReason: error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'unclassified_failure_no_secret_output' }); await save()
    throw Error('continuation_stopped_no_automatic_repayment')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) continueModular132().catch(() => {
  console.error('modular132_continuation_stopped_no_automatic_repayment_no_secret_output'); process.exitCode = 1
})
