import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { secretMatches, type StoredPreflight, validPreflightId } from '@/lib/mps-preflight'

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
    .select('public_id, access_hash, customer_email, document_label, status, stripe_checkout_session_id, input_hash, report, failure_code, delivery_status, created_at, completed_at')
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
    report: order.status === 'completed' ? order.report : null,
    completedAt: order.completed_at,
    sourceTextStored: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
