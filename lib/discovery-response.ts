import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'
import { recordAgentDiscovery, type DiscoverySurface } from './agent-discovery-metering.ts'

// One place for the two decisions every discovery document shares, so neither
// can be forgotten when a surface is added:
//
//   1. `no-store`. Vercel serves public/ assets with `max-age=0,
//      must-revalidate` and those still return x-vercel-cache: HIT, so a
//      revalidation directive does not keep a response off the edge. An
//      edge-cached document is invisible to the meter, which is the only
//      reason these are routes rather than static files.
//   2. Metering is best-effort. A document that failed to serve because a
//      counter could not be incremented would be a far worse outcome than a
//      missing data point.
export async function serveDiscoveryDocument(
  request: Request,
  input: { surface: DiscoverySurface; body: string; contentType: string },
): Promise<Response> {
  const ledger = createAgentInquiryLedger()
  if (ledger) {
    await recordAgentDiscovery(ledger, { surface: input.surface, userAgent: request.headers.get('user-agent') })
  }
  return new Response(input.body, {
    headers: {
      'Content-Type': input.contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export function discoveryOptions() {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  })
}
