import agentCard from '../../../../content/discovery/agent-card.json' with { type: 'json' }
import { createAgentInquiryLedger } from '../../../../lib/agent-inquiry-ledger.ts'
import { recordAgentDiscovery } from '../../../../lib/agent-discovery-metering.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Serves the canonical /.well-known/agent.json via a rewrite. The document
// itself is unchanged; it moved out of public/ only so that a request for it
// reaches the origin and can be counted.
//
// `no-store`, not merely `max-age=0`. Production serves public/ assets with
// `public, max-age=0, must-revalidate` and those responses still return
// x-vercel-cache: HIT with a non-zero age, so that directive does not keep a
// response off the edge. A cached discovery document is invisible to
// measurement, and measurement is the entire reason this is a route rather than
// a static file. These documents are small and low-traffic; the origin cost is
// the price of the signal.
export async function GET(request: Request) {
  const ledger = createAgentInquiryLedger()
  if (ledger) {
    // Best-effort: the document must serve even when the meter cannot write.
    await recordAgentDiscovery(ledger, { surface: 'agent_card', userAgent: request.headers.get('user-agent') })
  }
  return Response.json(agentCard, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  })
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  })
}
