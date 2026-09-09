import { API_CORS_HEADERS } from '../api-proxy-policy.ts'
import { MICRO_MAX_REQUEST_BYTES, microPath, type MicroProductId } from './micro-contracts.ts'
import { buildMicroProduct } from './micro-products.ts'
import { MICRO_OFFERS } from './micro-offers.ts'
import { resolveX402 } from './gateway.ts'
import { releaseHeldSlot } from './slot.ts'
import { discoverySourceFrom, recordOfferUsage } from './offer-telemetry.ts'

type Dependencies = {
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

/** Bounded, fatal-UTF8 streaming read. The timeout also covers a body that never ends. */
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_input')
  let length = 0
  const chunks: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); reject(new Error('body_timeout')) }, 5000)
  })
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), expired])
      if (timedOut) throw new Error('body_timeout')
      if (done) break
      length += value.byteLength
      if (length > MICRO_MAX_REQUEST_BYTES) { void reader.cancel().catch(() => {}); throw new Error('payload_too_large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } finally { clearTimeout(timer); reader.releaseLock() }
}

export function microHandlers(id: MicroProductId, dependencies: Dependencies = {}) {
  const offer = MICRO_OFFERS.find(o => o.id === id)!
  const resolve = dependencies.resolve ?? resolveX402, release = dependencies.release ?? releaseHeldSlot
  const build = dependencies.build ?? buildMicroProduct
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
      return response({ offer, execution: 'Withheld; local development and injected tests only. GET returns a free contract and example, not caller-specific execution.' }, 200)
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
      // Even accidental X402_RESOURCES configuration cannot enable Preview or Production settlement.
      if (!['test', 'development'].includes(environment ?? '')) return failure('offer_not_published', 503)
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return failure('unsupported_media_type', 415)
      if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') return failure('content_encoding_not_supported', 415)
      let prepared: Awaited<ReturnType<typeof buildMicroProduct>>
      try { prepared = await build(id, await readBody(request)) }
      catch (error) {
        const reason = error instanceof Error ? error.message : ''
        return failure(reason === 'payload_too_large' ? 'payload_too_large' : 'invalid_or_unsupported_micro_input', reason === 'payload_too_large' ? 413 : reason === 'body_timeout' ? 408 : 400)
      }
      // All deterministic failures above happen before settlement. No result is released unpaid.
      let outcome: Awaited<ReturnType<typeof resolveX402>>
      try { outcome = await resolve(request) }
      catch { return failure('payment_outcome_unknown_check_settlement_before_repaying', 503) }
      if (outcome.kind === 'not_applicable') return failure('offer_not_enabled', 503)
      if (outcome.kind === 'challenge') {
        await recordSafely(request, 'challenge', 402)
        return response(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header })
      }
      if (outcome.kind === 'refused') return response({ error: { code: outcome.code } }, outcome.status, outcome.retryAfterSeconds ? { 'Retry-After': String(outcome.retryAfterSeconds) } : {})
      try {
        const delivered = response(prepared, 200, { 'PAYMENT-RESPONSE': outcome.header })
        await recordSafely(request, 'invocation', 200)
        return delivered
      } finally {
        await bestEffort(() => release(outcome.slot))
      }
      } finally { active-- }
    },
  }
}
