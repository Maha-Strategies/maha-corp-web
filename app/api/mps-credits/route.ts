import { authorizeClientCapabilityForBilling, bearerToken } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { recordCommercialApiUsage } from '@/lib/commercial-api-metering'
import { MPS_AUDIT_CREDIT_UNIT, creditBalance } from '@/lib/mps-credits'
import { MPS_AUDIT_CAPABILITY } from '@/lib/mps-audit-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = bearerToken(request)
  if (!token) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MPS audit client credential is required.' } }, 401)
  const authorization = await authorizeClientCapabilityForBilling(token, MPS_AUDIT_CAPABILITY)
  if (authorization.kind === 'unavailable') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The credential registry is not available.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MPS audit client credential is required.' } }, 401)
  if (authorization.kind === 'forbidden') return jsonResponse({ error: { code: 'capability_not_authorized', message: 'This credential is not authorized for MPS audit credits.' } }, 403)
  if (authorization.kind === 'rate_limited') return jsonResponse({ error: { code: 'rate_limited', message: 'Credential request limit reached. Retry after one hour.' } }, 429)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit ledger is not configured.' } }, 503)
  const [{ data: entries, error: entriesError }, { data: checkouts, error: checkoutsError }] = await Promise.all([
    ledger.from('mps_credit_ledger_entries').select('quantity').eq('client_id', authorization.clientId).eq('unit', MPS_AUDIT_CREDIT_UNIT),
    ledger.from('mps_credit_checkouts').select('public_id, credit_quantity, status, created_at, paid_at').eq('client_id', authorization.clientId).order('created_at', { ascending: false }).limit(20),
  ])
  if (entriesError || checkoutsError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit ledger could not be read.' } }, 503)
  await recordCommercialApiUsage(ledger, { credentialId: authorization.credentialId, operation: 'mps_credit_balance', statusCode: 200 })
  return jsonResponse({
    clientId: authorization.clientId,
    unit: MPS_AUDIT_CREDIT_UNIT,
    balance: creditBalance((entries ?? []) as { quantity: number | string }[]),
    billingEnforcement: authorization.billingMode === 'prepaid' ? 'prepaid' : 'internal_meter',
    checkouts: checkouts ?? [],
  }, 200)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
