import agentOffers from '../../../../content/discovery/agent-offers.json' with { type: 'json' }
import { createAgentInquiryLedger } from '../../../../lib/agent-inquiry-ledger.ts'
import { recordAgentDiscovery } from '../../../../lib/agent-discovery-metering.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Serves the canonical /agent-offers.json via a rewrite. See the agent-card
// route for why this is a route handler and why `no-store` rather than a
// zero max-age is what actually keeps it off the edge.
export async function GET(request: Request) {
  const ledger = createAgentInquiryLedger()
  if (ledger) {
    await recordAgentDiscovery(ledger, { surface: 'agent_offers', userAgent: request.headers.get('user-agent') })
  }
  return Response.json(agentOffers, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  })
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  })
}
