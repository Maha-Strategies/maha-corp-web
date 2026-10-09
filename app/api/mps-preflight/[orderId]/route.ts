import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { secretMatches, type StoredPreflight, validPreflightId } from '@/lib/mps-preflight'
import { mpsPreflightAcknowledgementSha256 } from '@/lib/mps-preflight-lifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: RouteContext<'/api/mps-preflight/[orderId]'>) {
  const { orderId } = await context.params
  const access = new URL(request.url).searchParams.get('access')
  if (!validPreflightId(orderId) || !access) return Response.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Report unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const { data, error } = await ledger
    .from('mps_preflight_orders')
    .select('public_id, access_hash, customer_email, document_label, status, stripe_checkout_session_id, input_hash, report, report_sha256, failure_code, delivery_status, acknowledgement_sha256, acknowledged_at, created_at, completed_at')
    .eq('public_id', orderId)
    .maybeSingle()
  const order = data as StoredPreflight | null
  if (error) return Response.json({ error: 'Report unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (!order || !secretMatches(access, order.access_hash)) return Response.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return Response.json({
    orderId: order.public_id,
    documentLabel: order.document_label,
    status: order.status,
    inputHash: order.input_hash,
    reportSha256: order.report_sha256,
    report: order.status === 'completed' ? order.report : null,
    completedAt: order.completed_at,
    acknowledged: Boolean(order.acknowledgement_sha256 && order.acknowledged_at),
    acknowledgementSha256: order.acknowledgement_sha256,
    acknowledgedAt: order.acknowledged_at,
    sourceTextStored: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, context: RouteContext<'/api/mps-preflight/[orderId]'>) {
  const { orderId } = await context.params
  if (!validPreflightId(orderId) || !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'Invalid acknowledgement.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  let access: string
  let reportSha256: string
  try {
    const body = await request.json() as Record<string, unknown>
    if (Object.keys(body).sort().join('|') !== 'access|received|reportSha256' || body.received !== true
      || typeof body.access !== 'string' || body.access.length < 24
      || typeof body.reportSha256 !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(body.reportSha256)) {
      throw new Error('Invalid acknowledgement.')
    }
    access = body.access
    reportSha256 = body.reportSha256
  } catch {
    return Response.json({ error: 'Invalid acknowledgement.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Acknowledgement unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const { data, error } = await ledger
    .from('mps_preflight_orders')
    .select('public_id, access_hash, status, report_sha256')
    .eq('public_id', orderId)
    .maybeSingle()
  const order = data as Pick<StoredPreflight, 'public_id' | 'access_hash' | 'status' | 'report_sha256'> | null
  if (error) return Response.json({ error: 'Acknowledgement unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (!order || !secretMatches(access, order.access_hash)) return Response.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (order.status !== 'completed' || !order.report_sha256) return Response.json({ error: 'The report has not been delivered.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  if (reportSha256 !== order.report_sha256) return Response.json({ error: 'The acknowledgement does not match this report.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  const acknowledgementSha256 = mpsPreflightAcknowledgementSha256(orderId, reportSha256)
  const { data: result, error: acknowledgementError } = await ledger.rpc('record_mps_preflight_acknowledgement', {
    p_order_id: orderId,
    p_report_sha256: reportSha256,
    p_acknowledgement_sha256: acknowledgementSha256,
    p_acknowledged_at: new Date().toISOString(),
  })
  if (acknowledgementError) return Response.json({ error: 'Acknowledgement unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (result === 'target_mismatch' || result === 'conflict') return Response.json({ error: 'The acknowledgement conflicts with the delivered report.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  if (result === 'not_delivered') return Response.json({ error: 'The report has not been delivered.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  if (result === 'not_found') return Response.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (result !== 'processed' && result !== 'duplicate') return Response.json({ error: 'Acknowledgement unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return Response.json({
    status: result === 'duplicate' ? 'idempotent' : 'acknowledged',
    acknowledgementSha256,
    reportSha256,
  }, { status: result === 'duplicate' ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
}
