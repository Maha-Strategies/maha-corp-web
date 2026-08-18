import { jsonResponse } from '../../../../lib/agent-inquiries.ts'
import { createAgentInquiryLedger } from '../../../../lib/agent-inquiry-ledger.ts'
import { parseX402TrustDemoEvent, x402TrustDemoEventHash } from '../../../../lib/x402/trust-demo-telemetry.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 1024) return jsonResponse({ error: { code: 'payload_too_large', message: 'Telemetry event is too large.' } }, 413)

  let event: ReturnType<typeof parseX402TrustDemoEvent>
  try { event = parseX402TrustDemoEvent(await request.json()) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid telemetry event.' } }, 400) }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'measurement_unavailable', message: 'Measurement is temporarily unavailable.' } }, 503)
  const { error } = await ledger.rpc('record_x402_trust_demo_event', {
    p_event_hash: x402TrustDemoEventHash(event.eventId),
    p_event_type: event.eventType,
    p_scenario_id: event.scenarioId,
    p_at: new Date().toISOString(),
  })
  if (error) return jsonResponse({ error: { code: 'measurement_unavailable', message: 'Measurement is temporarily unavailable.' } }, 503)
  return jsonResponse({ accepted: true, verification: 'client_unverified' }, 202)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
