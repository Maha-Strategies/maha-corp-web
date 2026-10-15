import { randomUUID } from 'node:crypto'
import { buildTypedData } from '../x402/client.ts'
import { assertRecoverableSignature } from '../x402/canary-evidence.ts'
import { buildPaymentRequired, parsePaymentHeader, encodeChallengeHeader, encodePaymentResponse, type PaymentFacilitator, type PaymentRequirement } from '../x402/protocol.ts'
import { createFacilitator } from '../x402/facilitator.ts'
import { usdcNetwork } from '../x402/networks.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
import { MODULAR_PAYMENT_VERSION, modularPaymentNonce, modularRecoveryContract } from '../x402/input-bound-payment.ts'
import { readMicroBody } from '../x402/micro-body.ts'
import { scopedRedisKey } from '../redis-namespace.ts'
import { redisPaymentStore, type PaymentStore, type PurchaseRecord } from './payment-store.ts'
import { baseProofReader, type BaseProofInput } from './base-proof.ts'
import { assertEndpoint, executionEnvelope, recoverySeconds, RECEIPT_RETENTION_SECONDS, type Endpoint, type HandlerContract } from './types.ts'
import { handlerFor } from './handlers.ts'
import { executionCostReleaseBlock } from './cost-policy.ts'
import { modularBazaar, modularDescription } from './bazaar.ts'
import { boundDescription } from '../x402/discovery.ts'
import { recordModularDelivery } from './delivery-meter.ts'

const ORIGIN = 'https://www.mahastrategies.com'
let instanceActive = 0
export const API_PAYMENT_VERSION = MODULAR_PAYMENT_VERSION
export const recoveryNonce = (e: Endpoint, inputHash: string, recoverySecret: string) => modularPaymentNonce(e.id, inputHash, recoverySecret)
export const API_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, PAYMENT-SIGNATURE, X-PAYMENT-SIGNATURE, X-Maha-Input-Hash, X-Maha-Recovery-Secret, X-Maha-Recovery-Mode, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
  'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Maha-Payment-Replayed',
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
export const apiJson = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...API_HEADERS, ...extra } })
export const apiFailure = (code: string, status: number) => apiJson({ success: false, data: null, proof: { settlement_id: null }, error: { code } }, status)
export type PaymentDependencies = {
  environment?: Record<string, string | undefined>; now?: () => number; store?: PaymentStore; facilitator?: PaymentFacilitator;
  confirm?: (input: BaseProofInput) => Promise<boolean>;
  recordDelivery?: typeof recordModularDelivery;
  /** Read only. Never broadcast another transaction or repeat settlement. */
  reconcile?: (record: PurchaseRecord, input: BaseProofInput) => Promise<string | null>;
}
function configuredPayee(env: Record<string, string | undefined>) {
  const payee = (env.BASE_PAYEE_ADDRESS ?? env.X402_PAY_TO)?.trim()
  if (!payee || !/^0x[\da-f]{40}$/i.test(payee) || /^0x0{40}$/i.test(payee)) throw Error('base_payee_not_configured')
  return payee
}
function provider(env: Record<string, string | undefined>): PaymentFacilitator {
  const url = env.X402_FACILITATOR_URL
  if (!url || new URL(url).protocol !== 'https:') throw Error('facilitator_not_configured')
  if (Boolean(env.CDP_API_KEY_ID) !== Boolean(env.CDP_API_KEY_SECRET)) throw Error('facilitator_credentials_incomplete')
  return createFacilitator({ url, ...(env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET ? { cdpCredentials: { apiKeyId: env.CDP_API_KEY_ID, apiKeySecret: env.CDP_API_KEY_SECRET } } : {}) })
}
function terms(e: Endpoint, payee: string): PaymentRequirement {
  const n = usdcNetwork('eip155:8453')
  return { scheme: 'exact', network: 'eip155:8453', amount: e.amount, asset: n.asset, payTo: payee, maxTimeoutSeconds: 60, extra: n.domain }
}
async function authorization(e: Endpoint, input: unknown, headers: Headers, expected: PaymentRequirement) {
  const normal = headers.get('PAYMENT-SIGNATURE'), alias = headers.get('X-PAYMENT-SIGNATURE')
  if (normal && alias && normal !== alias) throw Error('conflicting_payment_headers')
  const raw = normal ?? alias
  if (!raw || raw.length > 16384) throw Error('invalid_payment_header')
  const p = parsePaymentHeader(raw)
  if (!p.ok) throw Error('invalid_payment_payload')
  const payment = p.payment, r = payment.accepted, hash = headers.get('X-Maha-Input-Hash'), secret = headers.get('X-Maha-Recovery-Secret')
  if (payment.resource?.url !== ORIGIN + e.path || r.scheme !== expected.scheme || r.network !== expected.network || r.amount !== expected.amount
    || r.asset.toLowerCase() !== expected.asset.toLowerCase() || r.payTo.toLowerCase() !== expected.payTo.toLowerCase()
    || r.extra?.name !== expected.extra?.name || r.extra?.version !== expected.extra?.version || r.maxTimeoutSeconds !== expected.maxTimeoutSeconds
    || hash !== demandDigest(input) || !secret || !/^[a-f0-9]{64}$/.test(secret)) throw Error('payment_terms_or_input_mismatch')
  const a = payment.payload.authorization as Record<string, unknown> | undefined, signature = payment.payload.signature
  if (!a || typeof a.from !== 'string' || !/^0x[\da-f]{40}$/i.test(a.from) || typeof a.to !== 'string'
    || a.to.toLowerCase() !== expected.payTo.toLowerCase() || a.value !== expected.amount || a.nonce !== recoveryNonce(e, hash, secret)
    || typeof a.validAfter !== 'string' || !/^\d{1,12}$/.test(a.validAfter) || typeof a.validBefore !== 'string' || !/^\d{1,12}$/.test(a.validBefore)
    || BigInt(a.validAfter) >= BigInt(a.validBefore) || typeof signature !== 'string' || !/^0x[\da-f]{130}$/i.test(signature)) throw Error('invalid_eip3009_authorization')
  const typed = buildTypedData(expected, a.from)
  typed.message = { from: a.from, to: a.to, value: BigInt(a.value as string), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce as string }
  await assertRecoverableSignature(typed, signature, a.from)
  const payer = a.from.toLowerCase(), nonce = a.nonce as string
  const paymentId = demandDigest({ network: expected.network, asset: expected.asset.toLowerCase(), payer, nonce }).slice(7)
  return { payment, payer, nonce, inputHash: hash, after: Number(a.validAfter) * 1000, before: Number(a.validBefore) * 1000,
    key: scopedRedisKey('api-v1:purchase:' + paymentId) }
}
/** Central payment admission. Business handlers cannot settle funds themselves. */
export function with402Payment(e: Endpoint, handler: HandlerContract | undefined = handlerFor(e.handlerId ?? e.id, e.amount), deps: PaymentDependencies = {}) {
  assertEndpoint(e)
  const env = deps.environment ?? process.env, now = deps.now ?? Date.now, store = deps.store ?? redisPaymentStore()
  const local = ['test', 'development'].includes(env.NODE_ENV ?? '') && !env.VERCEL && !env.VERCEL_ENV
  const retainSeconds = recoverySeconds(e)
  let active = 0
  return async (request: Request): Promise<Response> => {
    const u = new URL(request.url)
    if (request.method !== e.method || u.pathname !== e.path || u.search) return apiFailure('invalid_route_or_method', 400)
    if (!handler || !['local-implemented', 'released'].includes(e.status) || (!local && !e.productionApproved)) return apiFailure('endpoint_not_released_no_payment', 503)
    const costBlock = executionCostReleaseBlock(e.execution_cost)
    if (costBlock) return apiFailure(costBlock, 503)
    if (request.headers.has('authorization') || request.headers.has('x-api-key')) return apiFailure('credentials_not_accepted', 400)
    let payee: string, expected: PaymentRequirement, facilitator: PaymentFacilitator
    try { payee = configuredPayee(env); expected = terms(e, payee); facilitator = deps.facilitator ?? provider(env) } catch { return apiFailure('payment_configuration_unavailable', 503) }
    const signed = request.headers.has('PAYMENT-SIGNATURE') || request.headers.has('X-PAYMENT-SIGNATURE')
    const authoritativeResource = { url: ORIGIN + e.path, description: boundDescription(modularDescription(e)), mimeType: 'application/json',
      serviceName: e.name, tags: e.tags.slice(0, 10), iconUrl: ORIGIN + '/icon.png' }
    if (!signed) {
      if (request.headers.has('X-Maha-Recovery-Mode')) return apiFailure('original_authorization_required', 400)
      const challenge = buildPaymentRequired([expected], authoritativeResource, 'Payment Required', {
        ...modularBazaar(e),
        'maha-input-bound-recovery': { info: { version: '1', retentionSeconds: retainSeconds, receiptRetentionSeconds: RECEIPT_RETENTION_SECONDS, automaticRepayment: false,
          complimentaryCorrection: Boolean(handler.recoverCorrection), withdrawal: 'stops-new-purchases; retained-paid-result-remains-recoverable',
          inputHashHeader: 'X-Maha-Input-Hash', secretHeader: 'X-Maha-Recovery-Secret', binding: modularRecoveryContract(e.id) }, schema: { type: 'object' } } })
      try {
        return apiJson({ ...challenge, error: 'Payment Required', protocol: 'HTTP 402 v2', network: 'base-mainnet', asset: 'USDC',
          price: e.price_usdc, payee, auth_standard: 'EIP-3009' }, 402, { 'PAYMENT-REQUIRED': encodeChallengeHeader(challenge) })
      } catch { return apiFailure('payment_challenge_unavailable_no_payment', 503) }
    }
    if (local && !deps.facilitator) return apiFailure('explicit_local_simulator_required_no_payment', 503)
    if (e.method === 'POST' && (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')
      || (request.headers.get('content-encoding') && request.headers.get('content-encoding') !== 'identity'))) return apiFailure('unsupported_media_type', 415)
    const recovery = request.headers.get('X-Maha-Recovery-Mode')
    if (recovery !== null && recovery !== 'retained-result' && !(recovery === 'complimentary-correction' && handler.recoverCorrection)) return apiFailure('invalid_recovery_mode', 400)
    if (active >= 4 || instanceActive >= 32) return apiFailure('endpoint_or_instance_capacity', 429)
    active++; instanceActive++; let key: string | undefined, owner: string | undefined
    try {
      let input: unknown, a: Awaited<ReturnType<typeof authorization>>
      try { input = handler.input.parse(e.method === 'GET' ? {} : await readMicroBody(request, 262144)); a = await authorization(e, input, request.headers, expected) }
      catch { return apiFailure('invalid_input_or_authorization', 400) }
      key = a.key; owner = randomUUID(); let record: PurchaseRecord | null
      try { if (!await store.lock(key, owner)) return apiFailure('purchase_in_progress_retry_same_authorization', 429); record = await store.get(key) }
      catch { return apiFailure('idempotency_unavailable_no_payment', 503) }
      const response = async (r: PurchaseRecord, replayed: boolean) => {
        const data = recovery === 'complimentary-correction' ? await handler.recoverCorrection!(input, r.data) : r.data
        const envelope = executionEnvelope(handler.output).parse({ success: true, data, proof: { settlement_id: r.transaction! } })
        if (!local) await (deps.recordDelivery ?? recordModularDelivery)(a.key, e.id, a.payer, r.createdAt, replayed)
        return apiJson(envelope, 200,
        { 'PAYMENT-RESPONSE': encodePaymentResponse({ network: expected.network, payer: a.payer, transaction: r.transaction! }), 'X-Maha-Payment-Replayed': String(replayed) })
      }
      const proofInput = (tx = ''): BaseProofInput => ({ transaction: tx, payer: a.payer, payee, amount: e.amount, nonce: a.nonce })
      if (record) {
        try {
          if (record.endpointId !== e.id || record.inputHash !== a.inputHash || record.payer !== a.payer || record.nonce !== a.nonce
            || !Number.isSafeInteger(record.createdAt) || record.createdAt > now()
            || (record.recoverySeconds ?? 86400) !== retainSeconds
            || !['prepared', 'settling', 'paid'].includes(record.state)) throw Error('record_mismatch')
          if (now() - record.createdAt >= retainSeconds * 1000) return apiFailure('content_recovery_expired_receipt_retained_do_not_repay', 410)
          handler.output.parse(record.data)
          if (record.dataHash !== demandDigest(record.data)) throw Error('retained_data_mismatch')
          if (record.state === 'paid') return await response(record, true)
          if (record.state === 'settling') {
            // A known tx can be re-read; an unknown tx needs an operator/journal lookup.
            let tx = record.transaction
            if (!tx) tx = await deps.reconcile?.(record, proofInput()) ?? undefined
            if (!tx || !/^0x[\da-f]{64}$/i.test(tx) || !await (deps.confirm ?? baseProofReader(env))(proofInput(tx))) return apiFailure('settlement_unknown_do_not_repay', 409)
            record = { ...record, state: 'paid', transaction: tx }; await store.put(key, record)
            return await response(record, true)
          }
        } catch { return apiFailure('retained_evidence_invalid_or_unavailable_do_not_repay', 409) }
      }
      if (recovery) return apiFailure('paid_result_not_established_do_not_repay', 409)
      if (a.after >= now() || a.before <= now() || a.before - now() > 60000) return apiFailure('authorization_not_current_no_payment', 400)
      // Prevent intentionally near-expiry authorizations consuming bounded work
      // that can no longer be settled. Source readers have a 25-second budget.
      if (!record && a.before - now() < 30000) return apiFailure('authorization_window_too_short_no_work_or_payment', 400)
      try { if (!await store.admitPayer(demandDigest(a.payer).slice(7))) return apiFailure('payer_rate_limit', 429) }
      catch { return apiFailure('rate_limit_unavailable_no_payment', 503) }
      if (!record) {
        try { const verified = await facilitator.verify(a.payment, expected); if (!verified.ok || verified.payer.toLowerCase() !== a.payer) return apiFailure('authorization_refused_no_payment', 400) }
        catch { return apiFailure('verification_unavailable_no_payment', 503) }
        if (a.before - now() < 30000) return apiFailure('authorization_window_too_short_no_work_or_payment', 400)
        let data: unknown
        try { data = handler.output.parse(await handler.execute(input)); if (Buffer.byteLength(JSON.stringify(data)) > 65000) throw Error('output_size') }
        catch { return apiFailure('execution_failed_no_payment', 422) }
        record = { endpointId: e.id, payer: a.payer, nonce: a.nonce, inputHash: a.inputHash, dataHash: demandDigest(data), createdAt: now(), state: 'prepared', data, recoverySeconds: retainSeconds }
        try { await store.put(key, record) } catch { return apiFailure('retention_unavailable_no_payment', 503) }
      }
      if (now() - record.createdAt > 60000 || a.before <= now()) return apiFailure('prepared_result_or_authorization_expired_no_payment', 409)
      try { await handler.beforeSettlement?.(input) } catch { return apiFailure('release_unavailable_no_payment', 409) }
      try { if (!await store.owns(key, owner)) return apiFailure('purchase_lock_expired_no_payment', 503); record = { ...record, state: 'settling' }; await store.put(key, record) }
      catch { return apiFailure('idempotency_unavailable_no_payment', 503) }
      try {
        // The buyer's authorization binds money/input, not discovery prose.
        // Never allow caller-controlled metadata to rewrite our Bazaar entry.
        const settled = await facilitator.settle({ ...a.payment, resource: authoritativeResource,
          extensions: { ...a.payment.extensions, ...modularBazaar(e) } }, expected)
        if (!settled.ok || settled.payer.toLowerCase() !== a.payer || !/^0x[\da-f]{64}$/i.test(settled.transaction)) return apiFailure('settlement_unknown_do_not_repay', 409)
        record = { ...record, transaction: settled.transaction }; await store.put(key, record)
        if (!await (deps.confirm ?? baseProofReader(env))(proofInput(settled.transaction))) return apiFailure('settlement_confirmation_pending_do_not_repay', 409)
        record = { ...record, state: 'paid' }; await store.put(key, record)
        return await response(record, false)
      } catch { return apiFailure('settlement_unknown_do_not_repay', 409) }
    } finally { if (key && owner) try { await store.unlock(key, owner) } catch { /* The lock expires; retained evidence stays intact. */ }; active--; instanceActive-- }
  }
}
