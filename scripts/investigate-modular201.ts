import { createDecipheriv, createHash, createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { MODULAR_201_ADDITIONS, BATCH201_PRODUCTION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { assertFrozenDelivery } from '../lib/api-v1/frozen-delivery.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { submitModularPurchase, validateModularCapsule, type ModularCapsule } from '../lib/x402/modular-buyer.ts'
import { usdcNetwork } from '../lib/x402/networks.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { writePrivateEvidenceAtomically } from './run-modular201-indexing.ts'

export const RECOVERY_BRANCH = 'refs/heads/codex/modular201-recovery-20261015'
export const RECOVERY_CONFIRMATION = 'INVESTIGATE_201_FINAL_RETAINED_ONLY_NO_PAYMENT'
export const RECOVERY_ID = 'bibliographies-scope-boundary-audit'
export const ORIGINAL_EVIDENCE_HASH = '23eb35d7cdafab15f169bfc6a410969fa4de834e136e67e12b9b877d90cb467b'
export const ORIGINAL_OUTBOX_HASH = '25ed775c12f7dfaa791b65fdca25682a2efc18bebff18593e732ea8576f30992'
export function assertRecoveryAdmission(env: Record<string, string | undefined>) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== RECOVERY_BRANCH || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.MODULAR201_RECOVERY_CONFIRMATION !== RECOVERY_CONFIRMATION || !env.MODULAR201_ORIGINAL_DIRECTORY || !env.MODULAR201_RECOVERY_OUTPUT) throw Error('exact_recovery_approval_required')
}
export function pinnedJson(bytes: Buffer, digest: string) {
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('original_artifact_hash_mismatch')
  return JSON.parse(bytes.toString('utf8'))
}
export function unusedExpiredProof(used: boolean, blockTimestamp: bigint, validBefore: bigint) {
  return !used && blockTimestamp > validBefore
}
/** Investigates only: cannot sign, settle, clear a journal, or prepare another purchase. */
export async function investigateModular201() {
  if (process.argv.slice(2).join(' ') !== '--investigate') throw Error('explicit_investigate_mode_required')
  assertRecoveryAdmission(process.env)
  const directory = process.env.MODULAR201_ORIGINAL_DIRECTORY!, output = process.env.MODULAR201_RECOVERY_OUTPUT!
  const original = pinnedJson(await readFile(join(directory, 'modular201-indexing-evidence.json')), ORIGINAL_EVIDENCE_HASH)
  const outbox = pinnedJson(await readFile(join(directory, 'modular201-indexing-evidence.json.recovery-encrypted.json')), ORIGINAL_OUTBOX_HASH)
  const scope = MODULAR_201_ADDITIONS.version, completed = original.steps.filter((s: { state: string }) => s.state === 'confirmed_and_delivered')
  if (original.version !== scope || outbox.scope !== scope || original.steps.length !== 201 || completed.length !== 200
    || new Set(original.steps.map((s: { id: string }) => s.id)).size !== 201
    || original.confirmedBaseUnits !== '7193641' || original.authorizedBaseUnits !== '7231980'
    || completed.reduce((n: bigint, s: { amountBaseUnits: string }) => n + BigInt(s.amountBaseUnits), 0n) !== 7193641n
    || original.steps.at(-1).id !== RECOVERY_ID || original.steps.at(-1).state !== 'authorized_outcome_unknown'
    || original.steps.at(-1).amountBaseUnits !== '38339' || outbox.packets.length !== 201) throw Error('original_scope_mismatch')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim(), rpc = process.env.BASE_RPC_URL?.trim()
  if (!key || !/^0x[a-f0-9]{64}$/i.test(key) || !rpc || new URL(rpc).protocol !== 'https:') throw Error('protected_credentials_required')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== MODULAR_201_ADDITIONS.operatorWallet || original.wallet.toLowerCase() !== MODULAR_201_ADDITIONS.operatorWallet) throw Error('wrong_operator_wallet')
  const packets = outbox.packets.filter((p: { id: string }) => p.id === RECOVERY_ID)
  if (packets.length !== 1) throw Error('exact_original_packet_required')
  const packet = packets[0], encryptionKey = createHmac('sha256', key).update(scope + ':private-outbox').digest()
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(packet.iv, 'hex'))
  decipher.setAAD(Buffer.from(scope)); decipher.setAuthTag(Buffer.from(packet.tag, 'hex'))
  const capsule: ModularCapsule = JSON.parse(Buffer.concat([decipher.update(Buffer.from(packet.ciphertext, 'base64')), decipher.final()]).toString('utf8'))
  const e = BATCH201_PRODUCTION_ENDPOINTS.find(e => e.id === RECOVERY_ID)!, h = handlerFor(e.id, e.amount)!, sample = releaseExample(e.id)!
  const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => h.input.parse(x),
    validateOutput: (x: unknown) => { const value = h.output.parse(x); assertFrozenDelivery(e.id, value, sample.output); return value } }
  const { authorization } = await validateModularCapsule(contract, capsule)
  if (capsule.payer !== MODULAR_201_ADDITIONS.operatorWallet || demandDigest(capsule.input) !== demandDigest(sample.input)) throw Error('original_capsule_binding_mismatch')
  const client = createPublicClient({ chain: base, transport: http(rpc, { retryCount: 0, timeout: 15000 }) })
  if (await client.getChainId() !== 8453) throw Error('wrong_chain')
  const asset = usdcNetwork('eip155:8453').asset as `0x${string}`
  const abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function authorizationState(address,bytes32) view returns(bool)'])
  const block = await client.getBlock({ blockTag: 'finalized' }), nonce = String(authorization.nonce) as `0x${string}`
  const [used, balance] = await Promise.all([
    client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce], blockNumber: block.number }),
    client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address], blockNumber: block.number }),
  ])
  const evidence: Record<string, unknown> = { scope, id: e.id, originalRun: 38722500745, checkedAt: new Date().toISOString(),
    classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
    newPaymentBaseUnits: '0', newSignatures: 0, wallet: account.address, finalizedBlock: String(block.number), finalizedTimestamp: String(block.timestamp),
    validBefore: String(authorization.validBefore), authorizationUsed: used, balanceBaseUnits: String(balance),
    originalExpiredUnused: unusedExpiredProof(used, block.timestamp, BigInt(String(authorization.validBefore))), state: 'investigating' }
  await writePrivateEvidenceAtomically(output, evidence)
  if (used) {
    const event = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)')
    const matches: `0x${string}`[] = []
    if (block.number < 52635929n || block.number - 52635929n > 100000n) throw Error('original_log_window_exceeded')
    for (let start = 52635929n; start <= block.number; start += 2000n) {
      const end = start + 1999n < block.number ? start + 1999n : block.number
      const logs = await client.getLogs({ address: asset, event, args: { authorizer: account.address, nonce }, fromBlock: start, toBlock: end, strict: true })
      for (const log of logs) if (!log.removed && log.transactionHash) matches.push(log.transactionHash)
    }
    if (matches.length !== 1) throw Error('used_nonce_without_unique_settlement_do_not_repay')
    const transaction = matches[0], receipt = await client.getTransactionReceipt({ hash: transaction })
    if (!receiptMatchesAuthorization(receipt, { transaction, payer: capsule.payer, payee: MODULAR_201_ADDITIONS.payee, amount: e.amount, nonce })) throw Error('original_receipt_binding_mismatch_do_not_repay')
    evidence.transaction = transaction; evidence.receiptVerified = true
  }
  const transport: typeof fetch = (input, init) => {
    if (String(input) !== 'https://www.mahastrategies.com' + e.path || new Headers(init?.headers).get('X-Maha-Recovery-Mode') !== 'retained-result') throw Error('retained_only_transport_required')
    return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) })
  }
  const result = await submitModularPurchase(contract, capsule, { fetchImpl: transport, recovery: 'retained-result' })
  evidence.retainedStatus = 'status' in result ? result.status : null
  evidence.retainedError = 'errorCode' in result ? result.errorCode : null
  if (result.delivery === 'validated_response' && used && result.transaction === evidence.transaction) {
    evidence.responseDigest = demandDigest(result.data); evidence.state = 'original_paid_response_recovered_without_repayment'
  } else evidence.state = evidence.originalExpiredUnused ? 'original_expired_unused_no_retry_performed' : 'paid_or_unknown_retained_recovery_requires_journal_review'
  await writePrivateEvidenceAtomically(output, evidence)
  console.log(JSON.stringify(evidence))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) investigateModular201().catch(() => {
  console.error('modular201_investigation_stopped_no_payment_no_secret_output'); process.exitCode = 1
})
