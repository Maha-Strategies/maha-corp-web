import { API_CORS_HEADERS } from '../../../../lib/api-proxy-policy.ts'
import { buildOfferSelectionDocument } from '../../../../lib/x402/offer-selection.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The machine-readable offer selection guide, served at
// /.well-known/maha/offer-selection.json via a rewrite in next.config.ts --
// the same arrangement the other discovery documents use, so the canonical
// public URL stays stable while the request still reaches the origin.
//
// Unauthenticated and free, deliberately. This document exists so an
// autonomous buyer can decide *whether* to pay; putting it behind a payment
// would mean charging for the answer to "should I pay you", and an agent that
// cannot read it will guess instead. Guessing between these two offers is the
// expensive failure: both compile a context pack, and only one measures
// anything.
//
// Generated from the offer catalog rather than hand-maintained, so a price,
// limit, status or availability change cannot leave the guide recommending
// terms that no longer exist.
//
// Plain `Response`, relative imports, no next/server: the same shape as the
// other discovery route handlers, which is what makes them directly callable
// from the test runner.
export async function GET() {
  return Response.json(buildOfferSelectionDocument(), {
    status: 200,
    headers: {
      ...API_CORS_HEADERS,
      // Cacheable: the document changes only when a deployment changes the
      // catalog. Short enough that a status change propagates quickly.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'GET, OPTIONS' } })
}
