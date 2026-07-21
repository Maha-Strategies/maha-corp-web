import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import {
  aggregateRevenueMetrics,
  type Granularity,
  type InboundRecord,
  type Opportunity,
  type OpportunityEvent,
  type PaymentReconciliation,
  type UtilityCheckoutRecord,
} from '@/lib/revenue-metrics'
import { authorizeRevenueOperations } from '@/lib/revenue-control-plane'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Read-only dashboard: pull aggregate-friendly, PII-free columns only. Requester
// name/email/message/context and free-text references are never selected.
const ROW_CAP = 50_000

function parseGranularity(value: string | null): Granularity {
  return value === 'day' || value === 'week' || value === 'month' ? value : 'month'
}

export async function GET(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind === 'unconfigured') return jsonResponse({ error: { code: 'operations_unavailable', message: 'The revenue control plane is not configured.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid revenue control bearer token is required.' } }, 401)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The revenue ledger could not be read.' } }, 503)

  const granularity = parseGranularity(new URL(request.url).searchParams.get('period'))

  const [opportunities, events, reconciliations, inbound, utility] = await Promise.all([
    ledger.from('revenue_opportunities').select('public_id, offer_id, source_type, qualified, status, created_at').limit(ROW_CAP),
    ledger.from('revenue_opportunity_events').select('opportunity_id, event_type, amount_cents, currency, created_at').limit(ROW_CAP),
    ledger.from('revenue_payment_reconciliations').select('opportunity_id, gross_amount_cents, refunded_amount_cents, currency, paid_at').limit(ROW_CAP),
    ledger.from('inbound_submissions').select('offer_id, qualification_status, revenue_opportunity_id, created_at').limit(ROW_CAP),
    ledger.from('utility_checkouts').select('utility, status, run_status, stripe_payment_amount, stripe_payment_currency, created_at, paid_at').limit(ROW_CAP),
  ])

  const failure = opportunities.error ?? events.error ?? reconciliations.error ?? inbound.error ?? utility.error
  if (failure) {
    console.error('Revenue metrics query failed:', failure.code ?? 'unknown_error')
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The revenue ledger could not be read.' } }, 503)
  }

  const metrics = aggregateRevenueMetrics({
    granularity,
    now: new Date().toISOString(),
    opportunities: (opportunities.data ?? []).map((row): Opportunity => ({
      publicId: row.public_id, offerId: row.offer_id, sourceType: row.source_type, qualified: row.qualified, status: row.status, createdAt: row.created_at,
    })),
    events: (events.data ?? []).map((row): OpportunityEvent => ({
      opportunityId: row.opportunity_id, eventType: row.event_type, amountCents: row.amount_cents, currency: row.currency, createdAt: row.created_at,
    })),
    reconciliations: (reconciliations.data ?? []).map((row): PaymentReconciliation => ({
      opportunityId: row.opportunity_id, grossAmountCents: row.gross_amount_cents, refundedAmountCents: row.refunded_amount_cents, currency: row.currency, paidAt: row.paid_at,
    })),
    inbound: (inbound.data ?? []).map((row): InboundRecord => ({
      offerId: row.offer_id, qualificationStatus: row.qualification_status, revenueOpportunityId: row.revenue_opportunity_id, createdAt: row.created_at,
    })),
    utilityCheckouts: (utility.data ?? []).map((row): UtilityCheckoutRecord => ({
      utility: row.utility, status: row.status, runStatus: row.run_status, paymentAmountCents: row.stripe_payment_amount, paymentCurrency: row.stripe_payment_currency, createdAt: row.created_at, paidAt: row.paid_at,
    })),
  })

  return jsonResponse(metrics, 200)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
