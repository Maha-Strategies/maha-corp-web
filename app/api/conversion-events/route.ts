import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { parsePublicConversionEvent } from '@/lib/conversion-measurement'
import { publicEventHash } from '@/lib/conversion-measurement-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 4096) return jsonResponse({ error: { code: 'payload_too_large', message: 'Conversion event is too large.' } }, 413)
  let event: ReturnType<typeof parsePublicConversionEvent>
  try { event = parsePublicConversionEvent(await request.json()) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid conversion event.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'measurement_unavailable', message: 'Measurement is temporarily unavailable.' } }, 503)
  const { error } = await ledger.rpc('record_public_conversion_measurement', {
    p_event_hash: publicEventHash(event.eventId), p_event_type: event.eventType, p_event_name: event.eventName,
    p_experiment_id: event.experimentId, p_source_path: event.sourcePath, p_at: new Date().toISOString(),
  })
  if (error) return jsonResponse({ error: { code: 'measurement_unavailable', message: 'Measurement is temporarily unavailable.' } }, 503)
  return jsonResponse({ accepted: true, verification: 'client_unverified' }, 202)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
