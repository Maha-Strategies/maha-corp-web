import { buildGovernedContextVerificationPack } from '@/lib/x402/context-product-family'
import { GOVERNED_CONTEXT_VERIFICATION_OFFER } from '@/lib/x402/offers'
import { discoverySourceFrom, recordOfferUsage } from '@/lib/x402/offer-telemetry'
import { withSlotRelease } from '@/lib/x402/slot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const handler = async (request: Request): Promise<Response> => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 })
  }
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > GOVERNED_CONTEXT_VERIFICATION_OFFER.maxRequestBytes) {
    return Response.json({ error: { code: 'payload_too_large', message: 'Request exceeds the published byte limit.' } }, { status: 413 })
  }
  try {
    return Response.json(buildGovernedContextVerificationPack(JSON.parse(raw)), { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, { status: 400 })
  }
}

const metered = async (request: Request) => {
  const response = await handler(request)
  await recordOfferUsage({ offerId: GOVERNED_CONTEXT_VERIFICATION_OFFER.id, eventKind: 'invocation', status: response.status, discoverySource: discoverySourceFrom(request.headers) })
  return response
}

export const POST = withSlotRelease(metered)
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
