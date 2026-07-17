import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { PublicMpsAuditConfigurationError, publicAuditVisitorHash } from '@/lib/public-mps-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let visitorHash: string
  try {
    visitorHash = publicAuditVisitorHash(request)
  } catch (error) {
    if (error instanceof PublicMpsAuditConfigurationError) return Response.json({ error: 'Unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    return Response.json({ error: 'Unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  let event: unknown
  try { event = (await request.json() as { event?: unknown }).event } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }) }
  if (event !== 'record_downloaded') return Response.json({ error: 'Invalid event.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const { error } = await ledger.from('mps_public_audit_events').insert({ visitor_hash: visitorHash, event_type: event })
  if (error) {
    console.error('Public MPS audit download event failed:', error.code)
    return Response.json({ error: 'Unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
