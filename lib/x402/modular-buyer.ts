import { randomBytes } from 'node:crypto'
import { recoverTypedDataAddress } from 'viem'
import { decodeChallenge, decodeReceipt, buildTypedData, encodePaymentSignature, type TypedDataSigner } from './client.ts'
import { modularPaymentNonce } from './input-bound-payment.ts'
import { demandDigest } from './demand6/digest.ts'
import { MAHA_PAYEE } from './merchant-identity.ts'
import { usdcNetwork } from './networks.ts'
import { parsePaymentHeader } from './protocol.ts'

export type ModularBuyerContract = { id: string; path: string; amount: string; recoverySeconds: number;
  validateInput(input: unknown): unknown; validateOutput(output: unknown): unknown }
export type ModularCapsule = { version: 'maha-modular-buyer/1'; id: string; path: string; amount: string; payer: string; createdAt: number; recoverySeconds: number;
  input: unknown; headers: Record<string, string> }
function assertContract(c: ModularBuyerContract) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id) || !/^\/api\/v1\/(context|verify|compute|celestial|intel|library)\/[a-z0-9-]+\/[a-z0-9-]+$/.test(c.path)
    || !/^[1-9][0-9]*$/.test(c.amount) || BigInt(c.amount) < 5000n || BigInt(c.amount) > 300000n || ![86400, 30 * 86400].includes(c.recoverySeconds)) throw Error('invalid_modular_contract')
}
const urlFor = (c: Pick<ModularBuyerContract, 'path'>) => 'https://www.mahastrategies.com' + c.path
async function json(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw Error('missing_body'); const chunks: Uint8Array[] = []; let count = 0
  try { for (;;) { const next = await reader.read(); if (next.done) break; count += next.value.length; if (count > 131072) throw Error('response_too_large'); chunks.push(next.value) }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  } finally { await reader.cancel().catch(() => {}) }
}
export async function prepareModularPurchase(c: ModularBuyerContract, o: { input: unknown; payer: string; maximumAmount: bigint; signTypedData: TypedDataSigner;
  persist(capsule: ModularCapsule): Promise<void>; fetchImpl?: typeof fetch; now?: number; secret?: string }) {
  assertContract(c); if (BigInt(c.amount) > o.maximumAmount) throw Error('purchase_cap_exceeded')
  const input = c.validateInput(o.input), body = JSON.stringify(input), inputHash = demandDigest(input), now = o.now ?? Date.now(), secret = o.secret ?? randomBytes(32).toString('hex')
  if (!/^[a-f0-9]{64}$/.test(secret) || !/^0x[a-f0-9]{40}$/i.test(o.payer) || !Number.isSafeInteger(now) || now < 0 || Buffer.byteLength(body) > 262144) throw Error('invalid_modular_purchase')
  const response = await (o.fetchImpl ?? fetch)(urlFor(c), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, redirect: 'error', signal: AbortSignal.timeout(20000) })
  const header = response.headers.get('PAYMENT-REQUIRED'); await response.body?.cancel()
  if (response.status !== 402 || response.url && response.url !== urlFor(c) || !header || header.length > 16384) throw Error('quote_unavailable')
  const quote = decodeChallenge(header), requirement = quote.accepts[0], base = usdcNetwork('eip155:8453')
  const extension = quote.extensions?.['maha-input-bound-recovery'] as { info?: Record<string, unknown> } | undefined
  const info = extension?.info
  if (quote.resource.url !== urlFor(c) || quote.accepts.length !== 1 || requirement.scheme !== 'exact' || requirement.network !== 'eip155:8453'
    || requirement.amount !== c.amount || requirement.asset.toLowerCase() !== base.asset.toLowerCase() || requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || requirement.extra?.name !== base.domain.name || requirement.extra?.version !== base.domain.version || requirement.maxTimeoutSeconds !== 60
    || info?.retentionSeconds !== c.recoverySeconds || info?.automaticRepayment !== false) throw Error('quote_terms_changed')
  // Authorization time is checked against the chain's block timestamp, which
  // can lag wall time. Keep the reference client's backdate, not a one-second
  // window. The short expiry and input-bound nonce remain unchanged.
  const typed = buildTypedData(requirement, o.payer, now)
  typed.message = { ...typed.message, validAfter: BigInt(Math.max(0, Math.floor(now / 1000) - 600)), validBefore: BigInt(Math.floor(now / 1000) + 59), nonce: modularPaymentNonce(c.id, inputHash, secret) }
  const signature = await o.signTypedData(typed)
  const signer = await recoverTypedDataAddress({ ...typed, signature } as Parameters<typeof recoverTypedDataAddress>[0])
  if (signer.toLowerCase() !== o.payer.toLowerCase()) throw Error('signer_mismatch')
  const capsule: ModularCapsule = { version: 'maha-modular-buyer/1', id: c.id, path: c.path, amount: c.amount, payer: o.payer.toLowerCase(), createdAt: now, recoverySeconds: c.recoverySeconds, input,
    headers: { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(requirement, typed.message, signature, quote) } }
  await o.persist(structuredClone(capsule)); return capsule
}
export async function validateModularCapsule(c: ModularBuyerContract, capsule: ModularCapsule, now = Date.now()) {
  assertContract(c)
  if (capsule.version !== 'maha-modular-buyer/1' || capsule.id !== c.id || capsule.path !== c.path || capsule.amount !== c.amount || capsule.recoverySeconds !== c.recoverySeconds
    || !Number.isSafeInteger(now) || !Number.isSafeInteger(capsule.createdAt) || capsule.createdAt < 0 || now < capsule.createdAt || now - capsule.createdAt >= c.recoverySeconds * 1000
    || demandDigest(c.validateInput(capsule.input)) !== capsule.headers['X-Maha-Input-Hash']) throw Error('invalid_or_expired_capsule_do_not_repay')
  const headers = new Headers(capsule.headers), allowed = ['content-type', 'payment-signature', 'x-maha-input-hash', 'x-maha-recovery-secret']
  if ([...headers.keys()].some(k => !allowed.includes(k)) || headers.get('content-type') !== 'application/json' || !/^0x[a-f0-9]{40}$/.test(capsule.payer)
    || !/^[a-f0-9]{64}$/.test(headers.get('x-maha-recovery-secret') ?? '') || (headers.get('payment-signature')?.length ?? 0) > 16384
    || Buffer.byteLength(JSON.stringify(capsule.input)) > 262144) throw Error('invalid_capsule_headers')
  const parsed = parsePaymentHeader(headers.get('payment-signature'))
  if (!parsed.ok) throw Error('invalid_capsule_authorization')
  const payment = parsed.payment, terms = payment.accepted, base = usdcNetwork('eip155:8453'), authorization = payment.payload.authorization as Record<string, unknown>
  if (payment.resource?.url !== urlFor(c) || terms.amount !== c.amount || terms.scheme !== 'exact' || terms.network !== 'eip155:8453'
    || terms.asset.toLowerCase() !== base.asset.toLowerCase() || terms.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || terms.extra?.name !== base.domain.name || terms.extra?.version !== base.domain.version || terms.maxTimeoutSeconds !== 60
    || typeof authorization?.from !== 'string' || authorization.from.toLowerCase() !== capsule.payer
    || authorization?.to !== terms.payTo || authorization?.value !== c.amount || authorization?.nonce !== modularPaymentNonce(c.id, headers.get('x-maha-input-hash')!, headers.get('x-maha-recovery-secret')!)
    || !/^\d{1,12}$/.test(String(authorization?.validAfter)) || !/^\d{1,12}$/.test(String(authorization?.validBefore))
    || BigInt(String(authorization.validAfter)) >= BigInt(String(authorization.validBefore)) || typeof payment.payload.signature !== 'string' || !/^0x[a-f0-9]{130}$/i.test(payment.payload.signature)) throw Error('capsule_payment_binding_mismatch')
  const typed = buildTypedData(terms, capsule.payer)
  typed.message = { from: capsule.payer, to: terms.payTo, value: BigInt(c.amount), validAfter: BigInt(String(authorization.validAfter)), validBefore: BigInt(String(authorization.validBefore)), nonce: String(authorization.nonce) }
  const signer = await recoverTypedDataAddress({ ...typed, signature: payment.payload.signature } as Parameters<typeof recoverTypedDataAddress>[0])
  if (signer.toLowerCase() !== capsule.payer) throw Error('capsule_signer_mismatch')
  return { payment, authorization }
}
const SAFE_FAILURE_CODES = new Set([
  'authorization_refused_no_payment', 'verification_unavailable_no_payment', 'authorization_not_current_no_payment',
  'authorization_window_too_short_no_work_or_payment', 'invalid_input_or_authorization', 'payer_rate_limit',
  'purchase_in_progress_retry_same_authorization', 'settlement_unknown_do_not_repay', 'settlement_confirmation_pending_do_not_repay',
  'execution_failed_no_payment', 'retention_unavailable_no_payment', 'paid_result_not_established_do_not_repay',
  'retained_evidence_invalid_or_unavailable_do_not_repay', 'content_recovery_expired_receipt_retained_do_not_repay',
  'prepared_result_or_authorization_expired_no_payment', 'release_unavailable_no_payment', 'purchase_lock_expired_no_payment',
  'idempotency_unavailable_no_payment', 'rate_limit_unavailable_no_payment',
])
export async function submitModularPurchase(c: ModularBuyerContract, capsule: ModularCapsule, o: { fetchImpl?: typeof fetch; now?: number; recovery?: 'retained-result' | 'complimentary-correction' } = {}) {
  await validateModularCapsule(c, capsule, o.now ?? Date.now())
  const unresolved = { settlement: 'unknown' as const, delivery: 'unresolved' as const, automaticRepayment: false as const, data: null, transaction: null }
  try {
    const response = await (o.fetchImpl ?? fetch)(urlFor(c), { method: 'POST', body: JSON.stringify(capsule.input),
      headers: { ...capsule.headers, ...(o.recovery ? { 'X-Maha-Recovery-Mode': o.recovery } : {}) }, redirect: 'error', signal: AbortSignal.timeout(20000) })
    if (response.url && response.url !== urlFor(c)) { await response.body?.cancel(); return { ...unresolved, status: response.status, errorCode: 'unexpected_response_origin' } }
    if (!response.ok) {
      let errorCode = 'unclassified_http_failure'
      try { const failure = await json(response); if (SAFE_FAILURE_CODES.has(failure?.error?.code)) errorCode = failure.error.code } catch { /* Never copy a raw provider response into evidence. */ }
      return { ...unresolved, status: response.status, errorCode }
    }
    const h = response.headers.get('PAYMENT-RESPONSE'), receipt = h && h.length <= 8192 ? decodeReceipt(h) : null, result = await json(response)
    if (!receipt?.success || receipt.network !== 'eip155:8453' || receipt.payer?.toLowerCase() !== capsule.payer || !/^0x[a-f0-9]{64}$/i.test(receipt.transaction ?? '')
      || result.success !== true || Object.keys(result).sort().join(',') !== 'data,proof,success' || result.proof?.settlement_id !== receipt.transaction) throw Error('invalid_receipt_or_envelope')
    return { settlement: 'provider_reported' as const, delivery: 'validated_response' as const, automaticRepayment: false as const,
      data: c.validateOutput(result.data), transaction: receipt.transaction!, replayed: response.headers.get('X-Maha-Payment-Replayed') === 'true', status: response.status }
  } catch { return unresolved }
}
