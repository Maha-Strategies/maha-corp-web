import { buildBookSectionReceipt, type MachineBookId } from './book-section-product.ts'
import type { X402Offer } from './offers.ts'
import { discoverySourceFrom, recordOfferUsage } from './offer-telemetry.ts'
import { withSlotRelease } from './slot.ts'

export function bookSectionPost(bookId: MachineBookId, offer: X402Offer) {
  const handler = async (request: Request): Promise<Response> => {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return Response.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 })
    }
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > offer.maxRequestBytes) {
      return Response.json({ error: { code: 'payload_too_large', message: 'Request exceeds the published byte limit.' } }, { status: 413 })
    }
    try {
      return Response.json(buildBookSectionReceipt(bookId, JSON.parse(raw)), { status: 200, headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return Response.json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, { status: 400 })
    }
  }
  return withSlotRelease(async (request: Request) => {
    const response = await handler(request)
    await recordOfferUsage({ offerId: offer.id, eventKind: 'invocation', status: response.status, discoverySource: discoverySourceFrom(request.headers) })
    return response
  })
}
