import { createCipheriv, createHmac, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { investigateModular201, RECOVERY_ID } from './investigate-modular201.ts'
import { MODULAR_201_ADDITIONS } from '../lib/api-v1/production-release.ts'
import { prepareModularPurchase, submitModularPurchase, validateModularCapsule } from '../lib/x402/modular-buyer.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { writePrivateEvidenceAtomically } from './run-modular201-indexing.ts'

export const RETRY_CONFIRMATION = 'RETRY_ONCE_AFTER_UNUSED_EXPIRED_MAX_38339'
export function assertControlledRetry(evidence: Record<string, unknown>, confirmation: string | undefined, balance: bigint) {
  if (confirmation !== RETRY_CONFIRMATION || evidence.originalExpiredUnused !== true || evidence.authorizationUsed !== false
    || evidence.id !== RECOVERY_ID || evidence.newPaymentBaseUnits !== '0' || balance < 38339n) throw Error('controlled_retry_requires_expired_unused_proof_and_cap')
}
export async function retryFinalOnce() {
  if (process.env.MODULAR201_CONTROLLED_RETRY_CONFIRMATION !== RETRY_CONFIRMATION) throw Error('explicit_retry_approval_required')
  const original = await investigateModular201(), { capsule, contract, account, client, asset, abi } = original
  const balance = await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })
  assertControlledRetry(original.evidence, process.env.MODULAR201_CONTROLLED_RETRY_CONFIRMATION, balance)
  const { authorization: prior } = await validateModularCapsule(contract, capsule)
  if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, String(prior.nonce) as `0x${string}`] })) throw Error('original_now_used_do_not_repay')
  const key = process.env.X402_BUYER_PRIVATE_KEY!, scope = MODULAR_201_ADDITIONS.version + ':approved-controlled-final-retry/1'
  const secret = createHmac('sha256', key).update(scope + ':' + contract.id + ':once').digest('hex')
  const nonce = modularPaymentNonce(contract.id, demandDigest(capsule.input), secret) as `0x${string}`
  if (nonce === prior.nonce || await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] })) throw Error('controlled_retry_nonce_already_used_no_payment')
  const path = process.env.MODULAR201_RECOVERY_OUTPUT! + '.controlled-retry.json'
  const evidence = { scope, id: contract.id, originalRun: 38722500745, classification: 'publisher-funded-operator-activity', customerRevenue: false,
    organicDemand: false, automaticRepayment: false, maximumBaseUnits: '38339', authorizedBaseUnits: '0', confirmedBaseUnits: '0',
    originalExpiredUnused: true, initialBalanceBaseUnits: String(balance), state: 'preparing', transaction: '', responseDigest: '' }
  await writePrivateEvidenceAtomically(path, evidence)
  const saved = await prepareModularPurchase(contract, { input: capsule.input, payer: account.address, maximumAmount: 38339n, secret,
    signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async fresh => {
      const encryptionKey = createHmac('sha256', key).update(scope + ':private-outbox').digest(), iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv); cipher.setAAD(Buffer.from(scope))
      const bytes = Buffer.concat([cipher.update(JSON.stringify(fresh)), cipher.final()])
      await writePrivateEvidenceAtomically(path + '.recovery-encrypted.json', { scope, packets: [{ id: contract.id,
        iv: iv.toString('hex'), ciphertext: bytes.toString('base64'), tag: cipher.getAuthTag().toString('hex') }] })
      evidence.authorizedBaseUnits = '38339'; evidence.state = 'controlled_authorization_outcome_unknown'; await writePrivateEvidenceAtomically(path, evidence)
    } })
  const result = await submitModularPurchase(contract, saved)
  Object.assign(evidence, { status: 'status' in result ? result.status : null, errorCode: 'errorCode' in result ? result.errorCode : null })
  await writePrivateEvidenceAtomically(path, evidence)
  if (result.delivery !== 'validated_response' || result.settlement !== 'provider_reported' || !result.transaction) throw Error('controlled_retry_unresolved_stop_without_repayment')
  const { authorization } = await validateModularCapsule(contract, saved)
  const receipt = await client.waitForTransactionReceipt({ hash: result.transaction as `0x${string}`, timeout: 30000, pollingInterval: 2000 })
  if (!receiptMatchesAuthorization(receipt, { transaction: result.transaction, payer: capsule.payer, payee: MODULAR_201_ADDITIONS.payee,
    amount: '38339', nonce: String(authorization.nonce) })) throw Error('controlled_retry_receipt_mismatch_stop_without_repayment')
  evidence.transaction = result.transaction; evidence.responseDigest = demandDigest(result.data); evidence.confirmedBaseUnits = '38339'; evidence.state = 'controlled_purchase_confirmed_and_delivered'
  Object.assign(evidence, { finalBalanceBaseUnits: String(await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] })) })
  await writePrivateEvidenceAtomically(path, evidence); console.log(JSON.stringify(evidence))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) retryFinalOnce().catch(() => {
  console.error('controlled_modular201_retry_stopped_no_automatic_repayment'); process.exitCode = 1
})
