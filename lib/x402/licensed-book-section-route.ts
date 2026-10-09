import { API_CORS_HEADERS } from '../api-proxy-policy.ts'
import { buildLicensedSection, LICENSED_SECTION_OFFERS, licensedSectionMetadata, licensedSectionPath, type LicensedSectionBook } from './licensed-book-sections.ts'
import { resolveX402 } from './gateway.ts'
import { readPaymentSignature } from './protocol.ts'
import { releaseHeldSlot } from './slot.ts'
import { discoverySourceFrom, recordOfferUsage } from './offer-telemetry.ts'

type Dependencies = { resolve?: typeof resolveX402; release?: typeof releaseHeldSlot; record?: typeof recordOfferUsage; build?: typeof buildLicensedSection }
const json = (body: unknown, status: number, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { ...API_CORS_HEADERS, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers } })
async function boundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid-body')
  let timer: ReturnType<typeof setTimeout> | undefined, size = 0, timedOut = false
  const chunks: Uint8Array[] = []
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); reject(new Error('body-timeout')) }, 5000) })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout])
      if (timedOut) throw new Error('body-timeout')
      if (done) break
      size += value.byteLength
      if (size > 1024) { void reader.cancel().catch(() => {}); throw new Error('body-too-large') }
      chunks.push(value)
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  } finally { clearTimeout(timer); reader.releaseLock() }
}
async function bestEffort(effect: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { await Promise.race([Promise.resolve().then(effect), new Promise<void>(done => { timer = setTimeout(done, 250) })]) } catch { /* telemetry and slot TTL cannot discard a paid result */ } finally { clearTimeout(timer) }
}
export function licensedSectionHandlers(book: LicensedSectionBook, deps: Dependencies = {}) {
  const offer = LICENSED_SECTION_OFFERS.find(o => o.path === licensedSectionPath(book))!
  const resolve = deps.resolve ?? resolveX402, build = deps.build ?? buildLicensedSection, release = deps.release ?? releaseHeldSlot, record = deps.record ?? recordOfferUsage
  let active = 0
  return {
    GET: async (request: Request) => {
      const url = new URL(request.url)
      if (url.pathname !== offer.path || url.search) return json({ error: { code: 'invalid-discovery-url' } }, 400)
      return json({ offer, catalogue: licensedSectionMetadata(book), note: 'Metadata only. Paid section delivery requires an enabled route and valid x402 payment.' }, 200)
    },
    OPTIONS: async () => new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, POST, OPTIONS' } }),
    POST: async (request: Request) => {
      if (active >= 4) return json({ error: { code: 'local-work-capacity' } }, 429)
      active++
      try {
        const url = new URL(request.url)
        if (request.method !== 'POST' || url.pathname !== offer.path || url.search || request.headers.has('authorization') || request.headers.has('x-api-key')) return json({ error: { code: 'route-or-credentials-invalid' } }, 400)
        let prepared: ReturnType<typeof buildLicensedSection> | undefined
        const signed = Boolean(readPaymentSignature(request.headers))
        if (signed) {
          if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') || (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity')) return json({ error: { code: 'unsupported-media-type' } }, 415)
          try { prepared = build(book, await boundedBody(request)) } catch (error) {
            const reason = error instanceof Error ? error.message : ''
            return json({ error: { code: reason === 'body-too-large' ? reason : reason === 'body-timeout' ? reason : 'invalid-section-or-edition' } }, reason === 'body-too-large' ? 413 : reason === 'body-timeout' ? 408 : 400)
          }
        }
        let outcome: Awaited<ReturnType<typeof resolveX402>>
        try { outcome = await resolve(request) } catch { return json({ error: { code: 'payment-outcome-unknown-check-before-repaying' } }, 503) }
        if (outcome.kind === 'not_applicable') return json({ error: { code: 'offer-not-enabled' } }, 503)
        if (outcome.kind === 'refused') return json({ error: { code: outcome.code } }, outcome.status)
        if (outcome.kind === 'challenge') {
          await bestEffort(() => record({ offerId: offer.id, eventKind: 'challenge', status: 402, discoverySource: discoverySourceFrom(request.headers) }))
          return json(outcome.body, 402, { 'PAYMENT-REQUIRED': outcome.header })
        }
        try {
          if (!signed || !prepared) return json({ error: { code: 'payment-outcome-unknown-check-before-repaying' } }, 503)
          const delivered = json(prepared, 200, { 'PAYMENT-RESPONSE': outcome.header })
          await bestEffort(() => record({ offerId: offer.id, eventKind: 'invocation', status: 200, discoverySource: discoverySourceFrom(request.headers) }))
          return delivered
        } finally { await bestEffort(() => release(outcome.slot)) }
      } finally { active-- }
    },
  }
}
