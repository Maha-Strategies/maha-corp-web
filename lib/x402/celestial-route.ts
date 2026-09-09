import { API_CORS_HEADERS } from '../api-proxy-policy.ts'
import { buildCelestialProduct, CELESTIAL_MAX_REQUEST_BYTES, parseCalculationInput, type CelestialProductId } from './celestial-products.ts'
import { CELESTIAL_OFFERS } from './celestial-offers.ts'
import { resolveX402 } from './gateway.ts'
import { readPaymentSignature } from './protocol.ts'
import { releaseHeldSlot } from './slot.ts'
import { discoverySourceFrom, recordOfferUsage } from './offer-telemetry.ts'

type Dependencies = {
  resolve?: typeof resolveX402
  release?: typeof releaseHeldSlot
  record?: typeof recordOfferUsage
  environment?: string
}
const response = (body: unknown, status: number, headers: HeadersInit = {}) => Response.json(body, {
  status, headers: { ...API_CORS_HEADERS, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers },
})
const failure = (code: string, status: number) => response({ error: { code } }, status)

/** Bounded streaming read: never buffer an unbounded body even with no Content-Length. */
async function readInput(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_input')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > CELESTIAL_MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new Error('payload_too_large')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

export function celestialHandlers(id: CelestialProductId, dependencies: Dependencies = {}) {
  const offer = CELESTIAL_OFFERS.find(offer => offer.id === id)!
  const resolve = dependencies.resolve ?? resolveX402
  const release = dependencies.release ?? releaseHeldSlot
  const record = dependencies.record ?? recordOfferUsage
  const environment = dependencies.environment ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV
  return {
    GET: async (request: Request) => {
      if (new URL(request.url).search) return failure('query_parameters_not_allowed', 400)
      return response({ offer, execution: 'POST JSON only; GET performs no calculation',
        privacy: 'Public or synthetic inputs only. Do not place birth data in URLs, headers, or payment metadata.',
        enterprise: 'Existing enterprise authentication and billing remain at /api/v1/celestial.' }, 200)
    },
    OPTIONS: async () => new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }),
    POST: async (request: Request): Promise<Response> => {
      const url = new URL(request.url)
      if (url.pathname !== offer.path || request.method !== 'POST') return failure('method_or_route_mismatch', 400)
      if (url.search) return failure('query_parameters_not_allowed', 400)
      // Do not send this key through tenant credit billing, even with a payment.
      if (request.headers.has('authorization') || request.headers.has('x-api-key')) return failure('use_enterprise_celestial_endpoint_for_api_keys', 400)
      if (offer.status !== 'available' && !['preview', 'test', 'development'].includes(environment ?? '')) return failure('offer_not_published', 503)
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return failure('unsupported_media_type', 415)
      let input: ReturnType<typeof parseCalculationInput>
      try { input = parseCalculationInput(id, await readInput(request)) }
      catch (error) { return failure(error instanceof Error && error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_calculation_input', error instanceof Error && error.message === 'payload_too_large' ? 413 : 400) }

      // Compute only for a presented payment, before settlement, to catch all
      // deterministic core failures without charging. No result is released yet.
      let product: ReturnType<typeof buildCelestialProduct> | undefined
      if (readPaymentSignature(request.headers)) {
        try { product = buildCelestialProduct(id, input) }
        catch { return failure('calculation_unavailable_for_input', 422) }
      }
      let outcome: Awaited<ReturnType<typeof resolveX402>>
      try { outcome = await resolve(request) }
      catch {
        // Do not echo SDK exceptions, raw headers or payloads. A thrown payment
        // operation has an unknown outcome; never tell the buyer to re-pay.
        return failure('payment_outcome_unavailable_check_before_retry', 503)
      }
      if (outcome.kind === 'not_applicable') return failure('offer_not_enabled', 503)
      if (outcome.kind === 'challenge') {
        await record({ offerId: id, eventKind: 'challenge', status: 402, discoverySource: discoverySourceFrom(request.headers) })
        return response(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header })
      }
      if (outcome.kind === 'refused') return response({ error: { code: outcome.code, message: outcome.message } }, outcome.status,
        outcome.retryAfterSeconds ? { 'Retry-After': String(outcome.retryAfterSeconds) } : {})
      try {
        // Never trust client-supplied x-maha-* payment headers. Only this
        // invocation's resolveX402 result authorizes the response.
        if (!product) return failure('missing_prepared_calculation', 500)
        const result = response(product, 200, { 'PAYMENT-RESPONSE': outcome.header })
        await record({ offerId: id, eventKind: 'invocation', status: 200, discoverySource: discoverySourceFrom(request.headers) })
        return result
      } finally { await release(outcome.slot) }
    },
  }
}
