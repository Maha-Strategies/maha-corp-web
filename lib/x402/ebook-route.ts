import { EBOOK_ORIGIN, EBOOKS, EBOOK_VERSION, ebookArtifacts, ebookBundleHash, ebookPath, ebookOfferId, ebookOrderHash, ebookTerms, ebookTermsHash, parseEbookOrder, type EbookId } from './ebook-contract.ts'
import { EBOOK_OFFERS } from './ebook-offers.ts'
import { authorizeEbookRecovery, ebookDelivery, findPaidEbook, loadEbook, validateEbookPayload } from './ebook-delivery.ts'
import { resolveX402 } from './gateway.ts'
import { releaseHeldSlot } from './slot.ts'
import { API_CORS_HEADERS } from '../api-proxy-policy.ts'
import { discoverySourceFrom, recordOfferUsage } from './offer-telemetry.ts'

const headers = { ...API_CORS_HEADERS, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...headers, ...extra } })
const fail = (code: string, status: number) => json({ error: { code } }, status)
async function readBody(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new Error('unsupported_media_type')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_order')
  const chunks: Uint8Array[] = []; let size = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error('body_timeout')) }, 5000)
  })
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), expired])
      if (done) break
      size += value.byteLength
      if (size > 2048) { await reader.cancel(); throw new Error('payload_too_large') }
      chunks.push(value)
    }
  } finally { clearTimeout(timer); reader.releaseLock() }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
}
type Dependencies = { load?: typeof loadEbook; find?: typeof findPaidEbook; resolve?: typeof resolveX402; release?: typeof releaseHeldSlot; enabled?: boolean; record?: typeof recordOfferUsage }

export function ebookHandlers(id: EbookId, d: Dependencies = {}) {
  const load = d.load ?? loadEbook, resolve = d.resolve ?? resolveX402, release = d.release ?? releaseHeldSlot
  const record = async (request: Request, eventKind: 'invocation' | 'challenge', status: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try { await Promise.race([(d.record ?? recordOfferUsage)({ offerId: ebookOfferId(id), eventKind, status, discoverySource: discoverySourceFrom(request.headers) }), new Promise<void>(r => { timer = setTimeout(r, 250) })]) }
    catch { /* Metering cannot invalidate delivery. */ }
    finally { clearTimeout(timer) }
  }
  const enabled = () => d.enabled ?? (process.env.X402_ENABLED === 'true' && process.env.X402_CABEZON_EBOOKS_ENABLED === 'true')
  const exactResource = (request: Request, suffix = '') => {
    const u = new URL(request.url)
    return request.method === 'POST' && u.origin === EBOOK_ORIGIN && u.pathname === ebookPath(id) + suffix && !u.search
  }
  return {
    GET: async () => {
      try {
        await load(id)
        return json({ offer: EBOOK_OFFERS.find(o => o.id === ebookOfferId(id)), purchaseEnabled: enabled(),
          edition: { version: EBOOK_VERSION, ...EBOOKS[id], mediaType: 'application/epub+zip' },
          artifacts: ebookArtifacts(id), artifactHash: ebookBundleHash(id),
          terms: ebookTerms(id), termsHash: ebookTermsHash(id), retrieve: ebookPath(id) + '/retrieve',
          recovery: 'Save payer and exact original order, including a fresh private recoverySecret, before paying. POST {payer,order} to retrieve without any payment header; never put secrets in URLs or logs.' })
      } catch { return fail('ebook_unavailable_no_payment', 503) }
    },
    POST: async (request: Request) => {
      if (!enabled()) return fail('ebook_not_enabled', 503)
      if (!exactResource(request) || request.headers.has('authorization') || request.headers.has('x-api-key')) return fail('resource_or_auth_mismatch', 400)
      if (!request.headers.has('PAYMENT-SIGNATURE') && !request.headers.has('X-PAYMENT')) {
        const outcome = await resolve(request)
        if (outcome.kind === 'challenge') {
          await record(request, 'challenge', 402)
          return json(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header })
        }
        return fail(outcome.kind === 'refused' ? outcome.code : 'ebook_not_configured', outcome.kind === 'refused' ? outcome.status : 503)
      }
      let order
      try {
        order = parseEbookOrder(id, await readBody(request))
        if (request.headers.get('x-maha-idempotency-key') !== order.clientRequestId || request.headers.get('x-maha-input-hash') !== ebookOrderHash(id, order)) return fail('order_headers_mismatch', 409)
      } catch (e) {
        const code = e instanceof Error ? e.message : 'invalid_order'
        return fail(code, code === 'payload_too_large' ? 413 : code === 'unsupported_media_type' ? 415 : 400)
      }
      let bytes
      try { bytes = validateEbookPayload(id, await load(id)) } catch { return fail('ebook_unavailable_no_payment', 503) }
      // Validate delivery before invoking any payment verification or settlement.
      try {
        const outcome = await resolve(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(order) }))
        if (outcome.kind === 'not_applicable') return fail('ebook_not_configured', 503)
        if (outcome.kind === 'challenge') {
          await record(request, 'challenge', 402)
          return json(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header })
        }
        if (outcome.kind === 'refused') return fail(outcome.code, outcome.status)
        try {
          const response = json(ebookDelivery(id, order, bytes, outcome.transaction, Boolean(outcome.replayed)), 200, { 'PAYMENT-RESPONSE': outcome.header })
          await record(request, 'invocation', 200)
          return response
        }
        catch { return fail('ebook_delivery_unavailable_recover_do_not_repay', 503) }
        finally { try { await release(outcome.slot) } catch { /* Slot TTL bounds cleanup failure; do not discard an already paid delivery. */ } }
      } catch { return fail('payment_outcome_unknown_reconcile_do_not_repay', 503) }
    },
    RETRIEVE: async (request: Request) => {
      if (!exactResource(request, '/retrieve') || ['PAYMENT-SIGNATURE', 'X-PAYMENT', 'authorization', 'x-api-key'].some(h => request.headers.has(h))) return fail('retrieval_request_invalid', 400)
      try {
        const v = await readBody(request)
        if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== 'order,payer' || typeof v.payer !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(v.payer)) return fail('retrieval_request_invalid', 400)
        const order = parseEbookOrder(id, v.order)
        const row = await (d.find ?? findPaidEbook)(id, v.payer.toLowerCase(), order.clientRequestId)
        const transaction = authorizeEbookRecovery(id, order, row)
        return json(ebookDelivery(id, order, await load(id), transaction, true))
      } catch { return fail('recovery_unavailable_contact_seller_do_not_repay', 404) }
    },
    OPTIONS: () => new Response(null, { status: 204, headers: { ...headers, Allow: 'GET, POST, OPTIONS' } }),
  }
}
