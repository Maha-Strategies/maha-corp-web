import { randomUUID } from 'node:crypto'
import { acquireSlot, releaseSlot, type SlotResult } from '../concurrency.ts'
import { DEMAND6_SOURCE_REGISTRY } from './sources.ts'
import { API_CORS_HEADERS } from '../../api-proxy-policy.ts'
import { resolveX402 } from '../gateway.ts'
import { readPaymentSignature } from '../protocol.ts'
import { releaseHeldSlot } from '../slot.ts'
import { recordOfferUsage, discoverySourceFrom } from '../offer-telemetry.ts'
import { readMicroBody } from '../micro-body.ts'
import { decodeReceipt } from '../client.ts'
import { verifyDemandBeforeWork } from './preverify.ts'
import { DEMAND6_OFFERS } from './offers.ts'
import { demandResultSchema, demand6Path, parseDemandInput, DEMAND6_RETAIN_SECONDS, type Demand6Id } from './contracts.ts'
import { buildDemandProduct, demandDigest } from './products.ts'
import { readDemandAuthorization } from './purchase.ts'
import { redisDemandStore, demandStoreKey, type DemandStore, type PreparedRecord } from './store.ts'
type Dependencies = { resolve?: typeof resolveX402; verify?: typeof verifyDemandBeforeWork; build?: typeof buildDemandProduct; record?: typeof recordOfferUsage;
  release?: typeof releaseHeldSlot; store?: DemandStore; environment?: string; enabled?: boolean; now?: () => number;
  acquirePreparation?: typeof acquireSlot; releasePreparation?: typeof releaseSlot }
const json = (body: unknown, status: number, headers: Record<string, string> = {}) => Response.json(body, { status, headers: {
  ...API_CORS_HEADERS, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'Access-Control-Expose-Headers': API_CORS_HEADERS['Access-Control-Expose-Headers'] + ', X-Maha-Result-Retained, X-Maha-Payment-Replayed', ...headers } })
const failure = (code: string, status: number) => json({ error: { code } }, status)
async function bestEffort(effect: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { await Promise.race([effect(), new Promise<void>(done => { timer = setTimeout(done, 250) })]) }
  catch { /* Paid output must not be discarded by telemetry or cleanup. */ }
  finally { clearTimeout(timer) }
}
export function demand6Handlers(id: Demand6Id, dependencies: Dependencies = {}) {
  const offer = DEMAND6_OFFERS.find(offer => offer.id === id)!, build = dependencies.build ?? buildDemandProduct
  const resolve = dependencies.resolve ?? resolveX402, release = dependencies.release ?? releaseHeldSlot
  const verify = dependencies.verify ?? verifyDemandBeforeWork
  const store = dependencies.store ?? redisDemandStore(), now = dependencies.now ?? Date.now
  const record = dependencies.record ?? recordOfferUsage
  const environment = dependencies.environment ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV
  const enabled = dependencies.enabled ?? process.env.X402_DEMAND6_ENABLED === 'true'
  const acquirePreparation = dependencies.acquirePreparation ?? acquireSlot, releasePreparation = dependencies.releasePreparation ?? releaseSlot
  let active = 0
  const recordResponse = (request: Request, eventKind: 'challenge' | 'invocation', status: number) => bestEffort(() => record({ offerId: id, eventKind, status, discoverySource: discoverySourceFrom(request.headers) }))
  return {
    GET: async (request: Request) => {
      const url = new URL(request.url)
      if (url.pathname !== demand6Path(id) || url.search) return failure('invalid_discovery_url', 400)
      return json({ offer, execution: enabled ? 'Released bounded service. A valid unpaid 402 quote confirms deployment enablement, not settlement or delivery.' : 'Declared release; payment is disabled in this deployment.',
        approvedTargets: { endpointScope: 'Exact released Maha x402 resource URLs only; no arbitrary third-party providers.',
          sourceUrls: DEMAND6_SOURCE_REGISTRY.map(source => source.url), historyResource: 'https://www.mahastrategies.com/api/v1/compress' },
        examples: 'Outputs are generated from original synthetic fixtures, not real availability or customer evidence.',
        recovery: 'Save the exact input, private purchase headers and signed authorization before submitting. Retry that same authorization for a retained paid result within 24 hours; never automatically create a replacement payment.' }, 200)
    },
    OPTIONS: async () => new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, POST, OPTIONS' } }),
    POST: async (request: Request) => {
      if (active >= 4) return failure('local_work_capacity', 429)
      active++
      let key: string | undefined, lockToken: string | undefined, preparation: SlotResult | undefined
      const preparationResource = 'demand6-preparation:' + id
      try {
        const url = new URL(request.url)
        if (url.pathname !== demand6Path(id) || url.search || request.method !== 'POST') return failure('invalid_route', 400)
        if (request.headers.has('authorization') || request.headers.has('x-api-key')) return failure('enterprise_credentials_not_accepted', 400)
        if (!['development', 'test'].includes(environment ?? '') && (offer.status !== 'available' || !enabled || environment !== 'production')) return failure('offer_not_enabled', 503)
        if (!readPaymentSignature(request.headers)) {
          let outcome: Awaited<ReturnType<typeof resolveX402>>
          try { outcome = await resolve(request) } catch { return failure('payment_unavailable', 503) }
          if (outcome.kind === 'challenge') { await recordResponse(request, 'challenge', 402); return json(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header }) }
          if (outcome.kind === 'paid') await bestEffort(() => release(outcome.slot))
          return failure(outcome.kind === 'refused' ? outcome.code : 'offer_not_enabled', outcome.kind === 'refused' ? outcome.status : 503)
        }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') || (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity')) return failure('unsupported_media_type', 415)
        let input: ReturnType<typeof parseDemandInput>, binding: Awaited<ReturnType<typeof readDemandAuthorization>>
        try { input = parseDemandInput(id, await readMicroBody(request)); binding = await readDemandAuthorization(id, input, request.headers) }
        catch (error) { const code = error instanceof Error ? error.message : ''; return failure(code === 'payload_too_large' ? code : code === 'body_timeout' ? code : 'invalid_input_or_authorization', code === 'payload_too_large' ? 413 : code === 'body_timeout' ? 408 : 400) }
        key = demandStoreKey(id, binding.paymentId); lockToken = randomUUID()
        try { if (!await store.lock(key, lockToken)) return failure('purchase_in_progress_retry_same_authorization', 429) }
        catch { return failure('result_retention_unavailable_no_payment', 503) }
        let saved: PreparedRecord | null
        try { saved = await store.get(key) }
        catch { return failure('result_retention_unavailable_no_payment', 503) }
        if (saved) {
          try {
            const validated = demandResultSchema(id).parse(saved.product)
            if (saved.inputHash !== binding.inputHash || validated.inputHash !== binding.inputHash || saved.payer !== binding.payer || saved.network !== binding.network
              || !Number.isFinite(saved.createdAt) || saved.createdAt > now() || now() - saved.createdAt >= DEMAND6_RETAIN_SECONDS * 1000
              || demandDigest(validated.result) !== validated.resultHash || demandDigest({ version: validated.version, productId: id, inputHash: validated.inputHash, resultHash: validated.resultHash }) !== validated.receiptDigest
              || !['prepared', 'paid'].includes(saved.state)) throw new Error()
            if (saved.state === 'paid') {
              const receipt = decodeReceipt(saved.receiptHeader ?? null)
              if (!saved.receiptHeader || !receipt?.success || receipt.network !== binding.network || receipt.payer?.toLowerCase() !== binding.payer || !/^0x[\da-f]{64}$/i.test(receipt.transaction ?? '')) throw new Error()
              await recordResponse(request, 'invocation', 200)
              return json(validated, 200, { 'PAYMENT-RESPONSE': saved.receiptHeader, 'X-Maha-Payment-Replayed': 'true', 'X-Maha-Result-Retained': 'true' })
            }
          } catch { return failure('purchase_evidence_invalid_operator_review_do_not_repay', 409) }
        }
        if (binding.validBeforeMs <= now() || binding.validAfterMs >= now() || binding.validBeforeMs - now() > 300000) return failure('authorization_not_current_no_payment', 400)
        if (!saved) {
          try { preparation = await acquirePreparation(preparationResource, 2, 90) }
          catch { return failure('preparation_capacity_unavailable_no_payment', 503) }
          if (!preparation.admitted) return failure('preparation_capacity_unavailable_no_payment', 429)
          try {
            if (!await verify(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(input) }))) return failure('payment_verification_refused_no_work_or_payment', 400)
          } catch { return failure('payment_verification_unavailable_no_work_or_payment', 503) }
          let prepared: Awaited<ReturnType<typeof buildDemandProduct>>
          try { prepared = await build(id, input) }
          catch { return failure('bounded_work_unavailable_no_payment', 422) }
          saved = { inputHash: binding.inputHash, payer: binding.payer, network: binding.network, createdAt: now(), product: prepared, state: 'prepared' }
          try { await store.put(key, saved) } catch { return failure('result_retention_unavailable_no_payment', 503) }
        } else if (now() - saved.createdAt > 300000) return failure('prepared_result_stale_operator_review_do_not_repay', 409)
        try { if (!await store.owns(key, lockToken)) return failure('purchase_lock_expired_no_payment', 503) }
        catch { return failure('purchase_lock_unavailable_no_payment', 503) }
        let outcome: Awaited<ReturnType<typeof resolveX402>>
        try { outcome = await resolve(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(input) })) }
        catch { return failure('payment_outcome_unknown_check_before_repaying', 503) }
        if (outcome.kind === 'challenge') { await recordResponse(request, 'challenge', 402); return json(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header }) }
        if (outcome.kind !== 'paid') return failure(outcome.kind === 'refused' ? outcome.code : 'offer_not_enabled', outcome.kind === 'refused' ? outcome.status : 503)
        try {
          if (outcome.amountPaid !== offer.amount || outcome.payer.toLowerCase() !== binding.payer || outcome.network !== binding.network) return failure('settlement_identity_mismatch_operator_review_do_not_repay', 409)
          let retained = true
          try { await store.put(key, { ...saved, state: 'paid', receiptHeader: outcome.header }) } catch { retained = false }
          await recordResponse(request, 'invocation', 200)
          return json(saved.product, 200, { 'PAYMENT-RESPONSE': outcome.header, 'X-Maha-Result-Retained': String(retained), 'X-Maha-Payment-Replayed': String(outcome.replayed ?? false) })
        } finally { await bestEffort(() => release(outcome.slot)) }
      } finally {
        if (preparation?.admitted && preparation.token) await bestEffort(() => releasePreparation(preparationResource, preparation!.token!))
        if (key && lockToken) await bestEffort(() => store.unlock(key!, lockToken!))
        active--
      }
    },
  }
}
