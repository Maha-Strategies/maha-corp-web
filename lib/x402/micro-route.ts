import { API_CORS_HEADERS } from '../api-proxy-policy.ts'
import { microPath, type MicroProductId } from './micro-contracts.ts'
import { buildMicroProduct, microDigest } from './micro-products.ts'
import { MICRO_OFFERS } from './micro-offers.ts'
import { resolveX402 } from './gateway.ts'
import { readPaymentSignature, encodePaymentResponse } from './protocol.ts'
import { releaseHeldSlot } from './slot.ts'
import { discoverySourceFrom, recordOfferUsage } from './offer-telemetry.ts'
import { microExecutionAllowed } from './micro-release.ts'

import { readMicroBody } from './micro-body.ts'
import { readMicroPurchase } from './micro-purchase.ts'
import { createMicroRecoveryReader, type MicroRecoveryReader } from './micro-recovery.ts'
import { MICRO_RECOVERY_MODE_HEADER, MICRO_RECOVERY_PAYER_HEADER, MICRO_RECOVERY_RETENTION } from './micro-recovery-contract.ts'
import { isScienceProduct } from './science/contracts.ts'

type Dependencies = {
  recover?: MicroRecoveryReader
  environment?: string
  resolve?: typeof resolveX402
  release?: typeof releaseHeldSlot
  record?: typeof recordOfferUsage
  build?: typeof buildMicroProduct
}
function response(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...API_CORS_HEADERS, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers } })
}
const failure = (code: string, status: number) => response({ error: { code } }, status)

export function microHandlers(id: MicroProductId, dependencies: Dependencies = {}) {
  const offer = MICRO_OFFERS.find(o => o.id === id)!
  const resolve = dependencies.resolve ?? resolveX402, release = dependencies.release ?? releaseHeldSlot
  const build = dependencies.build ?? buildMicroProduct
  const recover = dependencies.recover ?? createMicroRecoveryReader()
  const record = dependencies.record ?? recordOfferUsage
  const environment = dependencies.environment ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV
  let active = 0
  const bestEffort = async (effect: () => Promise<unknown>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try { await Promise.race([Promise.resolve().then(effect), new Promise<void>(r => { timer = setTimeout(r, 250) })]) }
    catch { /* coarse telemetry and slot TTL are not delivery authority */ }
    finally { clearTimeout(timer) }
  }
  // Telemetry/cleanup failure must not destroy an already paid response. No exception text logged.
  const recordSafely = async (request: Request, eventKind: 'challenge' | 'invocation', status: number) => {
    await bestEffort(() => record({ offerId: id, eventKind, status, discoverySource: discoverySourceFrom(request.headers) }))
  }
  return {
    GET: async (request: Request) => {
      const url = new URL(request.url)
      if (url.pathname !== microPath(id) || url.search) return failure('invalid_discovery_url', 400)
      return response({ offer, ...(isScienceProduct(id) ? { recovery: MICRO_RECOVERY_RETENTION } : {}), execution: offer.availability.payableInProduction
        ? 'POST requires x402 payment and enabled deployment configuration. GET returns a free contract and example, not caller-specific execution.'
        : 'Withheld; local development and injected tests only. GET returns a free contract and example, not caller-specific execution.' }, 200)
    },
    OPTIONS: async () => new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }),
    POST: async (request: Request): Promise<Response> => {
      // Per-worker pre-payment work bound, in addition to the distributed settlement slot.
      if (active >= 4) return failure('local_work_capacity', 429)
      active++
      try {
      const url = new URL(request.url)
      if (request.method !== 'POST' || url.pathname !== microPath(id) || url.search) return failure('method_or_route_mismatch', 400)
      if (request.headers.has('authorization') || request.headers.has('x-api-key')) return failure('enterprise_credentials_not_accepted', 400)
      // Configuration cannot enable any product outside the reviewed release cohort.
      if (!microExecutionAllowed(id, environment)) return failure('offer_not_published', 503)

      const recoveryMode = request.headers.get(MICRO_RECOVERY_MODE_HEADER)
      if (recoveryMode && !isScienceProduct(id)) return failure('recovery_not_supported_for_offer', 400)
      if (recoveryMode !== null && recoveryMode !== 'replay') return failure('invalid_recovery_mode', 400)
      if (recoveryMode && readPaymentSignature(request.headers)) return failure('recovery_must_not_include_payment', 400)
      let paymentRequest = request
      const settle = async (): Promise<Awaited<ReturnType<typeof resolveX402>> | Response> => {
        try { return await resolve(paymentRequest) }
        catch { return failure('payment_outcome_unknown_check_settlement_before_repaying', 503) }
      }
      const challenged = async (outcome: Extract<Awaited<ReturnType<typeof resolveX402>>, { kind: 'challenge' }>) => {
        await recordSafely(request, 'challenge', 402)
        return response(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header })
      }

      // An unpaid request is answered with the payment challenge before the body
      // is read, and before Content-Type is judged.
      //
      // These validated first, so a caller with no payment got 400
      // invalid_or_unsupported_micro_input and never saw a price. A Bazaar
      // crawler probes with a minimal body precisely because it does not know
      // the input shape yet, so all five published microproducts were
      // undiscoverable while the manifest declared them payable -- and each
      // probe ran a full product build for a result nobody could buy.
      if (!recoveryMode && !readPaymentSignature(request.headers)) {
        const unpaid = await settle()
        if (unpaid instanceof Response) return unpaid
        if (unpaid.kind === 'not_applicable') return failure('offer_not_enabled', 503)
        if (unpaid.kind === 'challenge') return challenged(unpaid)
        if (unpaid.kind === 'refused') return response({ error: { code: unpaid.code } }, unpaid.status,
          unpaid.retryAfterSeconds ? { 'Retry-After': String(unpaid.retryAfterSeconds) } : {})
        // A settled outcome with no presented signature cannot be attributed to
        // this request; release the slot and refuse rather than deliver.
        await bestEffort(() => release(unpaid.slot))
        return failure('payment_outcome_unknown_check_settlement_before_repaying', 503)
      }

      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return failure('unsupported_media_type', 415)
      if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') return failure('content_encoding_not_supported', 415)
      let prepared: Awaited<ReturnType<typeof buildMicroProduct>>
      let input: unknown
      try { input = await readMicroBody(request); prepared = await build(id, input) }
      catch (error) {
        const reason = error instanceof Error ? error.message : ''
        return failure(reason === 'civic_source_not_reviewed' ? reason : reason === 'payload_too_large' ? 'payload_too_large' : 'invalid_or_unsupported_micro_input', reason === 'payload_too_large' ? 413 : reason === 'body_timeout' ? 408 : 400)
      }
      let binding: ReturnType<typeof readMicroPurchase> | undefined
      try { if (isScienceProduct(id)) binding = readMicroPurchase(request.headers, id, input) }
      catch { return failure('invalid_micro_purchase', 400) }
      if (recoveryMode) {
        if (!binding) return failure('invalid_micro_purchase', 400)
        const payer = (request.headers.get(MICRO_RECOVERY_PAYER_HEADER) ?? '').toLowerCase()
        if (!/^0x[a-fA-F0-9]{40}$/.test(payer)) return failure('invalid_recovery_payer', 400)
        try {
          const saved = await recover({ offerId: id, payer, purchaseId: binding.purchaseId, inputHash: binding.inputHash, secretHash: binding.secretHash })
          if (!saved) return failure('purchase_not_found', 404)
          if (saved.state !== 'paid') return failure(`purchase_${saved.state}_operator_review_required`, 409)
          if (!saved.transaction || !saved.network || saved.response_digest !== microDigest(prepared)) return failure('purchase_result_changed_operator_review_required', 409)
          return response(prepared, 200, { 'PAYMENT-RESPONSE': encodePaymentResponse({ transaction: saved.transaction, network: saved.network, payer }), 'x-maha-payment-replayed': 'true' })
        } catch { return failure('purchase_recovery_unavailable_do_not_repay', 503) }
      }
      // Reading consumed the body; the gateway independently verifies a bounded
      // copy. No client-provided response digest is trusted before settlement.
      paymentRequest = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(input) })
      // All deterministic failures above happen before settlement. No result is released unpaid.
      const resolved = await settle()
      if (resolved instanceof Response) return resolved
      const outcome = resolved
      if (outcome.kind === 'not_applicable') return failure('offer_not_enabled', 503)
      if (outcome.kind === 'challenge') return challenged(outcome)
      if (outcome.kind === 'refused') return response({ error: { code: outcome.code } }, outcome.status, outcome.retryAfterSeconds ? { 'Retry-After': String(outcome.retryAfterSeconds) } : {})
      try {
        if (isScienceProduct(id) && outcome.microResponseDigest !== microDigest(prepared)) return failure('purchase_result_changed_operator_review_required', 409)
        const delivered = response(prepared, 200, { 'PAYMENT-RESPONSE': outcome.header, 'x-maha-payment-replayed': outcome.replayed ? 'true' : 'false' })
        await recordSafely(request, 'invocation', 200)
        return delivered
      } finally {
        await bestEffort(() => release(outcome.slot))
      }
      } finally { active-- }
    },
  }
}
