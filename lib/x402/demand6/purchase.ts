import { randomBytes } from 'node:crypto'
import { buildTypedData, type TypedDataRequest } from '../client.ts'
import { assertRecoverableSignature } from '../canary-evidence.ts'
import { parsePaymentHeader, type PaymentRequirement } from '../protocol.ts'
import { MAHA_PAYEE } from '../discovery-payment-recipe.ts'
import { usdcNetwork, DECLARED_PAYMENT_NETWORKS } from '../networks.ts'
import { DEMAND6_PRODUCTS, DEMAND6_VERSION, demand6Path, type Demand6Id } from './contracts.ts'
import { demandDigest } from './products.ts'
export function demandPurchaseHeaders(input: unknown, recoverySecret = randomBytes(32).toString('hex')) {
  if (!/^[a-f0-9]{64}$/.test(recoverySecret)) throw new Error('invalid_recovery_secret')
  return { 'X-Maha-Input-Hash': demandDigest(input), 'X-Maha-Recovery-Secret': recoverySecret }
}
export function demandPurchaseNonce(id: Demand6Id, inputHash: string, recoverySecret: string): `0x${string}` {
  return `0x${demandDigest({ version: DEMAND6_VERSION, productId: id, inputHash, recoverySecret }).slice(7)}`
}
/** Persist original input, headers and authorization privately before submitting. */
export function demandPurchaseTypedData(id: Demand6Id, input: unknown, headers: Record<string, string>, requirement: PaymentRequirement, payer: string, now = Date.now()) {
  if (headers['X-Maha-Input-Hash'] !== demandDigest(input) || !/^[a-f0-9]{64}$/.test(headers['X-Maha-Recovery-Secret'] ?? '')) throw new Error('invalid_purchase_binding')
  const typed = buildTypedData(requirement, payer, now)
  typed.message.nonce = demandPurchaseNonce(id, headers['X-Maha-Input-Hash'], headers['X-Maha-Recovery-Secret'])
  return typed
}
export async function readDemandAuthorization(id: Demand6Id, input: unknown, headers: Headers) {
  const raw = headers.get('PAYMENT-SIGNATURE') ?? headers.get('X-PAYMENT'), parsed = parsePaymentHeader(raw)
  if (!parsed.ok) throw new Error('invalid_payment_authorization')
  const { payment } = parsed, requirement = payment.accepted, hash = headers.get('X-Maha-Input-Hash'), secret = headers.get('X-Maha-Recovery-Secret')
  if (hash !== demandDigest(input) || !secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error('invalid_purchase_binding')
  if (!DECLARED_PAYMENT_NETWORKS.some(network => network === requirement.network)) throw new Error('invalid_payment_network')
  const definition = usdcNetwork(requirement.network)
  if (payment.resource?.url !== 'https://www.mahastrategies.com' + demand6Path(id) || requirement.amount !== DEMAND6_PRODUCTS[id].amount
    || requirement.asset.toLowerCase() !== definition.asset.toLowerCase() || requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || !Number.isInteger(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds < 1 || requirement.maxTimeoutSeconds > 300
    || requirement.extra?.name !== definition.domain.name || requirement.extra.version !== definition.domain.version) throw new Error('invalid_payment_terms')
  const a = payment.payload.authorization as Record<string, unknown> | undefined, signature = payment.payload.signature
  if (!a || typeof a.from !== 'string' || !/^0x[\da-f]{40}$/i.test(a.from) || typeof a.to !== 'string' || a.to.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || a.value !== requirement.amount || a.nonce !== demandPurchaseNonce(id, hash, secret) || typeof signature !== 'string' || !/^0x[\da-f]{130}$/i.test(signature)
    || typeof a.validAfter !== 'string' || !/^\d{1,12}$/.test(a.validAfter) || typeof a.validBefore !== 'string' || !/^\d{1,12}$/.test(a.validBefore)
    || BigInt(a.validBefore) <= BigInt(a.validAfter)) throw new Error('invalid_payment_authorization')
  const typed: TypedDataRequest = { ...buildTypedData(requirement, a.from), message: { from: a.from, to: a.to, value: BigInt(a.value as string),
    nonce: a.nonce as string, validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) } }
  await assertRecoverableSignature(typed, signature, a.from)
  // Key the underlying authorization, not unsigned metadata or an alternative
  // encoding of its signature. One native-USDC nonce cannot buy a fresh result twice.
  return { paymentId: demandDigest({ network: requirement.network, asset: definition.asset.toLowerCase(), payer: a.from.toLowerCase(), nonce: a.nonce }).slice(7), inputHash: hash, payer: a.from.toLowerCase(), network: requirement.network,
    validAfterMs: Number(a.validAfter) * 1000, validBeforeMs: Number(a.validBefore) * 1000 }
}
