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
export const ORIGINAL_ID = 'reading-plans-scope-boundary-audit'
export const ORIGINAL_EVIDENCE_HASH = '309c960b83e02f42f79122984521a596c5a8726193b3a52cf8e75e185ef857fe'
export const ORIGINAL_OUTBOX_HASH = '8b36734276111c4e7649e7736becb09f003dcf90d5d6e1a42321b9dae8aa3eba'
const ORIGINAL_SCOPE = MODULAR_132_ADDITIONS.version
const SCOPE = ORIGINAL_SCOPE + ':approved-billing-recovery/1'
const ORIGIN = 'https://www.mahastrategies.com'
type Step = { id: string; amountBaseUnits: string; state: string; transaction?: string; responseDigest?: string; status?: number; errorCode?: string }

function assertContinuationScope(env: Record<string, string | undefined>, wallet: string) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== CONTINUATION_BRANCH || env.GITHUB_RUN_ATTEMPT !== '1' || env.GITHUB_RUN_NUMBER !== '2'
    || env.MODULAR132_CONTINUATION_CONFIRMATION !== CONTINUATION_CONFIRMATION || !env.MODULAR132_ORIGINAL_DIRECTORY || !env.MODULAR132_CONTINUATION_OUTPUT
    || wallet.toLowerCase() !== MODULAR_132_ADDITIONS.operatorWallet)
    throw Error('exact_second_run_approval_wallet_and_reserved_balance_required')
}
export function assertContinuationAdmission(env: Record<string, string | undefined>, wallet: string, balance: bigint, originalConfirmedBaseUnits = 0n) {
  assertContinuationScope(env, wallet)
  if (![0n, 38340n].includes(originalConfirmedBaseUnits) || balance < BATCH132_CAP + ORIGINAL_ATTEMPT_RESERVE - originalConfirmedBaseUnits)
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
export function continuationSecret(key: string, id: string, replacement: boolean) {
  return createHmac('sha256', key).update((replacement ? SCOPE : ORIGINAL_SCOPE) + ':' + id + ':original-once').digest('hex')
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
  const original = pinnedOriginal(await readFile(join(directory, 'modular132-indexing-evidence.json')), ORIGINAL_EVIDENCE_HASH)
  const outbox = pinnedOriginal(await readFile(join(directory, 'modular132-indexing-evidence.json.recovery-encrypted.json')), ORIGINAL_OUTBOX_HASH)
  if (original.version !== ORIGINAL_SCOPE || outbox.scope !== ORIGINAL_SCOPE || original.steps.length !== 1 || outbox.packets.length !== 1
    || original.steps[0].id !== ORIGINAL_ID || original.steps[0].amountBaseUnits !== '38340' || original.steps[0].state !== 'authorized_outcome_unknown'
    || original.authorizedBaseUnits !== '38340' || original.confirmedBaseUnits !== '0' || original.maximumBaseUnits !== String(BATCH132_CAP)
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
  const evidence = { scope: SCOPE, originalRun: 38739743218, checkedAt: new Date().toISOString(), classification: 'publisher-funded-operator-activity',
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
    if (disposition === 'recover_paid_only') {
      const latest = await client.getBlock(), start = latest.number > 50000n ? latest.number - 50000n : 0n
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
    const retained = await submitModularPurchase(originalContract, capsule, { fetchImpl: transport, recovery: 'retained-result' })
    evidence.original.retainedStatus = 'status' in retained ? retained.status ?? 0 : 0
    evidence.original.retainedError = 'errorCode' in retained ? String(retained.errorCode) : ''
    await save()
    if (disposition === 'recover_paid_only') {
      if (retained.delivery !== 'validated_response' || retained.transaction !== evidence.original.transaction) throw Error('paid_original_not_recovered_do_not_repay')
      assertContinuationAdmission(process.env, account.address, balance, BigInt(originalContract.amount))
      budget.reserve(ORIGINAL_ID, originalContract.amount)
      evidence.steps.push({ id: ORIGINAL_ID, amountBaseUnits: originalContract.amount, state: 'original_confirmed_and_recovered_without_repayment', transaction: retained.transaction, responseDigest: demandDigest(retained.data) })
      evidence.authorizedBaseUnits = String(budget.authorized); evidence.confirmedBaseUnits = originalContract.amount; await save()
    } else {
      if (retained.delivery === 'validated_response') throw Error('retained_receipt_contradicts_unused_nonce_do_not_repay')
      assertContinuationAdmission(process.env, account.address, balance)
    }
    for (const e of BATCH132_PRODUCTION_ENDPOINTS) {
      if (e.id === ORIGINAL_ID && disposition === 'recover_paid_only') continue
      if (index.indexed.includes(e.id)) { evidence.steps.push({ id: e.id, amountBaseUnits: '0', state: 'already_indexed_no_payment' }); await save(); continue }
      const contract = contractFor(e.id), input = contract.validateInput(releaseExample(e.id)!.input)
      const replacement = e.id === ORIGINAL_ID, secret = continuationSecret(key, e.id, replacement), freshNonce = modularPaymentNonce(e.id, demandDigest(input), secret) as `0x${string}`
      if (replacement && (freshNonce === nonce || await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] }))) throw Error('original_now_used_do_not_repay')
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, freshNonce] })) throw Error('continuation_nonce_already_used_do_not_repay')
      const step: Step = { id: e.id, amountBaseUnits: e.amount, state: replacement ? 'approved_controlled_replacement_preparing' : 'preparing_first_authorization' }; evidence.steps.push(step)
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
        const pending = 'errorCode' in result && ['settlement_confirmation_pending_do_not_repay', 'settlement_unknown_do_not_repay'].includes(String(result.errorCode))
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
