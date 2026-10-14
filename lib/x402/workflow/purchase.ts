import { randomBytes } from 'node:crypto'
import { buildTypedData, type TypedDataRequest } from '../client.ts'
import { assertRecoverableSignature } from '../canary-evidence.ts'
import { parsePaymentHeader, type PaymentRequirement } from '../protocol.ts'
import { MAHA_PAYEE } from '../merchant-identity.ts'
import { DECLARED_PAYMENT_NETWORKS, usdcNetwork } from '../networks.ts'
import { demandDigest } from '../demand6/digest.ts'
import { WORKFLOW_PRODUCTS, workflowPath, type WorkflowId } from './contracts.ts'
import { modularPaymentNonce } from '../input-bound-payment.ts'
export function workflowPurchaseHeaders(input: unknown, secret = randomBytes(32).toString('hex')) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('invalid_recovery_secret')
  return { 'X-Maha-Input-Hash': demandDigest(input), 'X-Maha-Recovery-Secret': secret }
}
export function workflowNonce(id: WorkflowId, inputHash: string, recoverySecret: string): `0x${string}` {
  return modularPaymentNonce(id, inputHash, recoverySecret)
}
export function workflowTypedData(id: WorkflowId, input: unknown, headers: Record<string, string>, requirement: PaymentRequirement, payer: string, now: number) {
  if (!Number.isSafeInteger(now) || now < 0 || headers['X-Maha-Input-Hash'] !== demandDigest(input)
    || !/^[a-f0-9]{64}$/.test(headers['X-Maha-Recovery-Secret'] ?? '')) throw new Error('invalid_purchase_binding')
  const typed = buildTypedData(requirement, payer, now)
  typed.message.nonce = workflowNonce(id, headers['X-Maha-Input-Hash'], headers['X-Maha-Recovery-Secret'])
  return typed
}
export async function readWorkflowAuthorization(id: WorkflowId, input: unknown, headers: Headers) {
  const parsed = parsePaymentHeader(headers.get('PAYMENT-SIGNATURE'))
  if (!parsed.ok) throw new Error('invalid_payment_authorization')
  const { payment } = parsed, requirement = payment.accepted, hash = headers.get('X-Maha-Input-Hash'), secret = headers.get('X-Maha-Recovery-Secret')
  if (hash !== demandDigest(input) || !secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error('invalid_purchase_binding')
  if (!DECLARED_PAYMENT_NETWORKS.some(n => n === requirement.network)) throw new Error('invalid_payment_network')
  const definition = usdcNetwork(requirement.network)
  if (requirement.scheme !== 'exact' || payment.resource?.url !== 'https://www.mahastrategies.com' + workflowPath(id)
    || requirement.amount !== WORKFLOW_PRODUCTS[id].amount || requirement.asset.toLowerCase() !== definition.asset.toLowerCase()
    || requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase() || requirement.extra?.name !== definition.domain.name
    || requirement.extra?.version !== definition.domain.version || !Number.isInteger(requirement.maxTimeoutSeconds)
    || requirement.maxTimeoutSeconds < 1 || requirement.maxTimeoutSeconds > 300) throw new Error('invalid_payment_terms')
  const a = payment.payload.authorization as Record<string, unknown> | undefined, signature = payment.payload.signature
  if (!a || typeof a.from !== 'string' || !/^0x[\da-f]{40}$/i.test(a.from) || typeof a.to !== 'string' || a.to.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || a.value !== requirement.amount || a.nonce !== workflowNonce(id, hash, secret) || typeof signature !== 'string' || !/^0x[\da-f]{130}$/i.test(signature)
    || typeof a.validAfter !== 'string' || !/^\d{1,12}$/.test(a.validAfter) || typeof a.validBefore !== 'string' || !/^\d{1,12}$/.test(a.validBefore)
    || BigInt(a.validBefore) <= BigInt(a.validAfter)) throw new Error('invalid_payment_authorization')
  const typed: TypedDataRequest = { ...buildTypedData(requirement, a.from), message: { from: a.from, to: a.to,
    value: BigInt(a.value as string), nonce: a.nonce as string, validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) } }
  await assertRecoverableSignature(typed, signature, a.from)
  return { paymentId: demandDigest({ network: requirement.network, asset: definition.asset.toLowerCase(), payer: a.from.toLowerCase(), nonce: a.nonce }).slice(7),
    payer: a.from.toLowerCase(), network: requirement.network, inputHash: hash, validAfterMs: Number(a.validAfter) * 1000, validBeforeMs: Number(a.validBefore) * 1000 }
}
