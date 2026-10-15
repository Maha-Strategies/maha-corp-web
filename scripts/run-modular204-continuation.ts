import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { z } from 'zod'
import { ADDITION_CAP, observeAdditions, preflightAdditions } from './run-modular204-indexing.ts'
import { MODULAR_ADDITIONS, PRODUCTION_ADDITION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { assertFrozenDelivery } from '../lib/api-v1/frozen-delivery.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { prepareModularPurchase, submitModularPurchase, validateModularCapsule, type ModularBuyerContract, type ModularCapsule } from '../lib/x402/modular-buyer.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'

export const RECOVERY_BRANCH = 'codex/modular204-recovery-20261015'
export const RECOVERY_CONFIRMATION = 'RECOVER_FIRST_THEN_203_MAX_TOTAL_2534496'
export const ORIGINAL_RUN = '38697859110'
export const ORIGINAL_ID = 'tabular-records-declared-bound-audit'
export const ORIGINAL_AMOUNT = 10108n
export const REMAINING_CAP = ADDITION_CAP - ORIGINAL_AMOUNT
const SCOPE = MODULAR_ADDITIONS.version
const envelope = z.object({ scope: z.literal(SCOPE), packets: z.array(z.object({ id: z.string(), iv: z.string().regex(/^[a-f0-9]{24}$/),
  ciphertext: z.string().min(1).max(200000), tag: z.string().regex(/^[a-f0-9]{32}$/) }).strict()).length(1) }).strict()
export function assertContinuationAdmission(env: Record<string, string | undefined>, wallet: string, balance: bigint) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/' + RECOVERY_BRANCH || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.MODULAR204_RECOVERY_CONFIRMATION !== RECOVERY_CONFIRMATION || env.MODULAR204_ORIGINAL_RUN !== ORIGINAL_RUN
    || !env.MODULAR204_OUTPUT_PATH || !env.MODULAR204_ORIGINAL_DIRECTORY) throw Error('exact_recovery_branch_approval_required')
  if (wallet.toLowerCase() !== MODULAR_ADDITIONS.operatorWallet || balance < REMAINING_CAP) throw Error('wrong_wallet_or_insufficient_remaining_balance')
}
export function assertOriginalEvidence(value: unknown) {
  const original = z.object({ version: z.literal(SCOPE), classification: z.literal('publisher-funded-operator-activity'),
    customerRevenue: z.literal(false), organicDemand: z.literal(false), automaticRepayment: z.literal(false),
    network: z.literal(MODULAR_ADDITIONS.network), wallet: z.string(), payee: z.literal(MODULAR_ADDITIONS.payee),
    maximumBaseUnits: z.literal(String(ADDITION_CAP)), authorizedBaseUnits: z.literal(String(ORIGINAL_AMOUNT)), confirmedBaseUnits: z.literal('0'),
    state: z.literal('stopped_review_required_no_repayment'), steps: z.array(z.object({ id: z.literal(ORIGINAL_ID),
      amountBaseUnits: z.literal(String(ORIGINAL_AMOUNT)), state: z.literal('authorized_outcome_unknown'), status: z.literal(409),
      settlement: z.literal('unknown'), delivery: z.literal('unresolved') }).strict()).length(1) }).passthrough().parse(value)
  if (original.wallet.toLowerCase() !== MODULAR_ADDITIONS.operatorWallet) throw Error('original_wallet_changed')
  return original
}
const encryptionKey = (key: string) => createHmac('sha256', key).update(SCOPE + ':private-outbox').digest()
export function decryptOriginalPacket(value: unknown, key: string): ModularCapsule {
  const saved = envelope.parse(value), packet = saved.packets[0]
  if (packet.id !== ORIGINAL_ID) throw Error('wrong_original_packet')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(packet.iv, 'hex'))
  decipher.setAAD(Buffer.from(SCOPE)); decipher.setAuthTag(Buffer.from(packet.tag, 'hex'))
  const plain = Buffer.concat([decipher.update(Buffer.from(packet.ciphertext, 'base64')), decipher.final()])
  if (plain.length > 100000) throw Error('oversized_original_packet')
  return JSON.parse(plain.toString('utf8')) as ModularCapsule
}
export function continuationBudget() {
  let authorized = ORIGINAL_AMOUNT
  const seen = new Set([ORIGINAL_ID])
  return { get authorized() { return authorized }, reserve(id: string, amount: string) {
    const e = PRODUCTION_ADDITION_ENDPOINTS.find(e => e.id === id)
    if (!e || e.amount !== amount || seen.has(id)) throw Error('duplicate_or_unapproved_authorization')
    const next = authorized + BigInt(amount)
    if (next > ADDITION_CAP) throw Error('aggregate_original_cap_exceeded')
    seen.add(id); authorized = next
  } }
}
type Result = Awaited<ReturnType<typeof submitModularPurchase>>
export async function recoverRetainedOnly(contract: ModularBuyerContract, capsule: ModularCapsule, dependencies: {
  submit?: typeof submitModularPurchase; delay?: (milliseconds: number) => Promise<void>; fetchImpl?: typeof fetch
  observe?: (value: { attempt: number; status?: number; errorCode?: string }) => Promise<void>
} = {}): Promise<Result> {
  // This function cannot prepare a payment or request a new signature. The
  // server's explicit retained-result mode cannot enter its settlement path.
  const send = dependencies.submit ?? submitModularPurchase, delay = dependencies.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await send(contract, capsule, { fetchImpl: dependencies.fetchImpl, recovery: 'retained-result' })
    await dependencies.observe?.({ attempt: attempt + 1, status: 'status' in result ? result.status : undefined,
      errorCode: 'errorCode' in result ? String(result.errorCode) : undefined })
    if (result.delivery === 'validated_response' && result.settlement === 'provider_reported' && result.transaction) return result
    const pending = 'errorCode' in result && ['settlement_confirmation_pending_do_not_repay', 'settlement_unknown_do_not_repay'].includes(String(result.errorCode))
    if (!pending || attempt === 2) throw Error('retained_recovery_unresolved_stop_without_repayment')
    await delay(attempt === 0 ? 5000 : 15000)
  }
  throw Error('retained_recovery_unresolved_stop_without_repayment')
}
const transport: typeof fetch = (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000),
  headers: { ...Object.fromEntries(new Headers(init?.headers)), 'user-agent': 'maha-modular204-approved-recovery/1', 'x-maha-discovery-source': 'maha_canary' } })
function contractFor(id: string): ModularBuyerContract {
  const e = PRODUCTION_ADDITION_ENDPOINTS.find(e => e.id === id)!, h = handlerFor(id, e.amount)!, sample = releaseExample(id)!
  return { id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: x => h.input.parse(x),
    validateOutput: x => { const value = h.output.parse(x); assertFrozenDelivery(id, value, sample.output); return value } }
}
export async function runContinuation() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--preflight', '--continue'].includes(args[0])) throw Error('explicit_continuation_mode_required')
  const index = await preflightAdditions()
  if (args[0] === '--preflight') { console.log(JSON.stringify({ state: 'unpaid_preflight_passed', indexed: index.indexed.length })); return }
  if (!index.available || !index.complete) throw Error('complete_catalogue_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim(), rpc = process.env.BASE_RPC_URL?.trim()
  if (!key || !/^0x[a-f0-9]{64}$/i.test(key) || !rpc || new URL(rpc).protocol !== 'https:') throw Error('protected_signer_and_managed_rpc_required')
  const account = privateKeyToAccount(key as `0x${string}`), client = createPublicClient({ chain: base, transport: http(rpc, { retryCount: 0, timeout: 15000 }) })
  const asset = usdcNetwork('eip155:8453').asset as `0x${string}`, abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function authorizationState(address,bytes32) view returns(bool)'])
  if (await client.getChainId() !== 8453) throw Error('wrong_chain')
  const balance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
  assertContinuationAdmission(process.env, account.address, balance)
  const directory = process.env.MODULAR204_ORIGINAL_DIRECTORY!
  const read = async (name: string) => { const content = await readFile(directory + '/' + name, 'utf8'); if (content.length > 300000) throw Error('oversized_original_artifact'); return JSON.parse(content) }
  const original = assertOriginalEvidence(await read('modular204-indexing-evidence.json'))
  const packets = envelope.parse(await read('modular204-indexing-evidence.json.recovery-encrypted.json')).packets
  const capsule = decryptOriginalPacket({ scope: SCOPE, packets }, key), firstContract = contractFor(ORIGINAL_ID)
  if (capsule.id !== ORIGINAL_ID || capsule.payer !== MODULAR_ADDITIONS.operatorWallet || capsule.amount !== String(ORIGINAL_AMOUNT)
    || demandDigest(capsule.input) !== demandDigest(releaseExample(ORIGINAL_ID)!.input)) throw Error('original_capsule_scope_changed')
  await validateModularCapsule(firstContract, capsule)
  const budget = continuationBudget(), output = process.env.MODULAR204_OUTPUT_PATH!
  type Step = { id: string; amountBaseUnits: string; state: string; transaction?: string; status?: number; errorCode?: string; responseDigest?: string }
  const evidence = { version: SCOPE, originalRun: ORIGINAL_RUN, originalAuthorizedBaseUnits: original.authorizedBaseUnits,
    classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
    network: MODULAR_ADDITIONS.network, wallet: account.address, payee: MODULAR_ADDITIONS.payee, maximumBaseUnits: String(ADDITION_CAP),
    balanceAtContinuationBaseUnits: String(balance), authorizedBaseUnits: String(budget.authorized), confirmedBaseUnits: '0',
    state: 'recovering_original_no_new_signature', startedAt: new Date().toISOString(), steps: [] as Step[], index }
  const save = async () => { await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
    await writeFile(output + '.recovery-encrypted.json', JSON.stringify({ scope: SCOPE, packets }), { mode: 0o600 }) }
  const confirm = async (id: string, saved: ModularCapsule, result: Result, step: Step) => {
    if (result.delivery !== 'validated_response' || result.settlement !== 'provider_reported' || !result.transaction) throw Error('delivery_not_validated')
    const { authorization } = await validateModularCapsule(contractFor(id), saved)
    const receipt = await client.waitForTransactionReceipt({ hash: result.transaction as `0x${string}`, timeout: 30000, pollingInterval: 2000 })
    if (!receiptMatchesAuthorization(receipt, { transaction: result.transaction, payer: account.address.toLowerCase(), payee: MODULAR_ADDITIONS.payee,
      amount: saved.amount, nonce: String(authorization.nonce) })) throw Error('receipt_mismatch_no_repayment')
    step.transaction = result.transaction; step.responseDigest = demandDigest(result.data); step.state = 'confirmed_and_delivered'
    evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(saved.amount)); await save()
    console.log(JSON.stringify({ state: 'confirmed_operator_progress', delivered: evidence.steps.filter(s => s.state === 'confirmed_and_delivered').length,
      confirmedBaseUnits: evidence.confirmedBaseUnits, authorizedBaseUnits: evidence.authorizedBaseUnits, maximumBaseUnits: String(ADDITION_CAP) }))
  }
  await save()
  try {
    const first: Step = { id: ORIGINAL_ID, amountBaseUnits: String(ORIGINAL_AMOUNT), state: 'recovery_only_no_repayment' }; evidence.steps.push(first); await save()
    const recovered = await recoverRetainedOnly(firstContract, capsule, { fetchImpl: transport, observe: async value => {
      first.status = value.status; first.errorCode = value.errorCode; await save()
    } })
    await confirm(ORIGINAL_ID, capsule, recovered, first)
    evidence.state = 'original_recovered_continuing_203'; await save()
    for (const e of PRODUCTION_ADDITION_ENDPOINTS.filter(e => e.id !== ORIGINAL_ID)) {
      if (index.indexed.includes(e.id)) { evidence.steps.push({ id: e.id, amountBaseUnits: '0', state: 'already_indexed_no_payment' }); await save(); continue }
      const contract = contractFor(e.id), input = contract.validateInput(releaseExample(e.id)!.input)
      const secret = createHmac('sha256', key).update(SCOPE + ':' + e.id + ':original-once').digest('hex')
      const nonce = modularPaymentNonce(e.id, demandDigest(input), secret) as `0x${string}`
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] })) throw Error('existing_authorization_stop_do_not_repay')
      const step: Step = { id: e.id, amountBaseUnits: e.amount, state: 'preparing_first_authorization' }; evidence.steps.push(step)
      const fresh = await prepareModularPurchase(contract, { input, payer: account.address, maximumAmount: BigInt(e.amount), secret,
        signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), fetchImpl: transport, persist: async saved => {
          budget.reserve(e.id, e.amount)
          const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv); cipher.setAAD(Buffer.from(SCOPE))
          const bytes = Buffer.concat([cipher.update(JSON.stringify(saved)), cipher.final()])
          packets.push({ id: e.id, iv: iv.toString('hex'), ciphertext: bytes.toString('base64'), tag: cipher.getAuthTag().toString('hex') })
          evidence.authorizedBaseUnits = String(budget.authorized); step.state = 'authorized_outcome_unknown'; await save()
        } })
      let result = await submitModularPurchase(contract, fresh, { fetchImpl: transport })
      step.status = 'status' in result ? result.status : undefined; step.errorCode = 'errorCode' in result ? String(result.errorCode) : undefined; await save()
      if (result.delivery !== 'validated_response') {
        const pending = 'errorCode' in result && ['settlement_confirmation_pending_do_not_repay', 'settlement_unknown_do_not_repay'].includes(String(result.errorCode))
        if (!pending) throw Error('uncertain_first_submission_stop_without_repayment')
        // Same capsule, explicit retained-result mode, no new signature and no
        // retry of the original settlement-capable request.
        await new Promise(resolve => setTimeout(resolve, 5000))
        result = await recoverRetainedOnly(contract, fresh, { fetchImpl: transport, observe: async value => {
          step.status = value.status; step.errorCode = value.errorCode; await save()
        } })
      }
      await confirm(e.id, fresh, result, step)
      await new Promise(resolve => setTimeout(resolve, 2500))
    }
    evidence.index = await observeAdditions()
    evidence.state = evidence.index.complete && evidence.index.indexed.length === 204 ? 'indexed' : 'payments_complete_index_pending'
    const finalBalance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
    Object.assign(evidence, { finalBalanceBaseUnits: String(finalBalance) }); await save()
    console.log(JSON.stringify({ state: evidence.state, confirmedBaseUnits: evidence.confirmedBaseUnits, indexed: evidence.index.indexed.length }))
  } catch (error) {
    evidence.state = 'stopped_review_required_no_repayment'; await save()
    // All thrown messages here are fixed local codes, not provider payloads.
    console.error(error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'continuation_failed_no_repayment')
    throw Error('continuation_stopped_no_automatic_repayment')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runContinuation().catch(() => { console.error('modular204_continuation_stopped_no_repayment'); process.exitCode = 1 })
