import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateRevenueMetrics, periodKey,
  type InboundRecord, type Opportunity, type OpportunityEvent, type PaymentReconciliation, type UtilityCheckoutRecord,
} from '../lib/revenue-metrics.ts'

const T = '2026-07-20T10:00:00.000Z'

function opp(publicId: string, offerId: string, sourceType: string, qualified: boolean, status: string): Opportunity {
  return { publicId, offerId, sourceType, qualified, status, createdAt: T }
}
function ev(opportunityId: string, eventType: string): OpportunityEvent {
  return { opportunityId, eventType, amountCents: null, currency: null, createdAt: T }
}
function base() {
  return { opportunities: [], events: [], reconciliations: [], inbound: [], utilityCheckouts: [] } as {
    opportunities: Opportunity[]; events: OpportunityEvent[]; reconciliations: PaymentReconciliation[]
    inbound: InboundRecord[]; utilityCheckouts: UtilityCheckoutRecord[]
  }
}

test('funnel counts derive from the append-only event ledger, not terminal status', () => {
  const opportunities: Opportunity[] = [
    opp('revopp_o1', 'book-the-imagined-life', 'agent_inquiry', true, 'refunded'),
    opp('revopp_o2', 'book-the-imagined-life', 'website_contact', true, 'paid'),
    opp('revopp_o3', 'mps-preflight', 'manual_operator', false, 'checkout_started'),
    opp('revopp_o4', 'mps-preflight', 'agent_inquiry', true, 'routed'),
    opp('revopp_o5', 'utility-receipts-to-csv', 'manual_operator', true, 'partially_refunded'),
  ]
  const events: OpportunityEvent[] = [
    // o1 was delivered THEN refunded — both stages must count despite terminal 'refunded'.
    ev('revopp_o1', 'routed'), ev('revopp_o1', 'checkout_started'), ev('revopp_o1', 'paid'), ev('revopp_o1', 'delivered'), ev('revopp_o1', 'refunded'),
    ev('revopp_o2', 'routed'), ev('revopp_o2', 'checkout_started'), ev('revopp_o2', 'paid'),
    ev('revopp_o3', 'routed'), ev('revopp_o3', 'checkout_started'),
    ev('revopp_o4', 'routed'),
    ev('revopp_o5', 'routed'), ev('revopp_o5', 'checkout_started'), ev('revopp_o5', 'paid'), ev('revopp_o5', 'delivered'), ev('revopp_o5', 'partially_refunded'),
  ]
  const { funnel } = aggregateRevenueMetrics({ ...base(), opportunities, events })

  assert.deepEqual(funnel.overall, {
    opportunities: 5, qualified: 4, checkoutStarted: 4, paid: 3, delivered: 2, partiallyRefunded: 1, refunded: 1,
  })

  const book = funnel.byOffer.find((row) => row.offerId === 'book-the-imagined-life')!
  assert.deepEqual(book, { offerId: 'book-the-imagined-life', opportunities: 2, qualified: 2, checkoutStarted: 2, paid: 2, delivered: 1, partiallyRefunded: 0, refunded: 1 })
  const preflight = funnel.byOffer.find((row) => row.offerId === 'mps-preflight')!
  assert.deepEqual(preflight, { offerId: 'mps-preflight', opportunities: 2, qualified: 1, checkoutStarted: 1, paid: 0, delivered: 0, partiallyRefunded: 0, refunded: 0 })

  const agent = funnel.bySource.find((row) => row.sourceType === 'agent_inquiry')!
  assert.equal(agent.opportunities, 2)
  assert.equal(agent.delivered, 1)
  assert.equal(agent.refunded, 1)
  // Deterministic ordering.
  assert.deepEqual(funnel.byOffer.map((r) => r.offerId), ['book-the-imagined-life', 'mps-preflight', 'utility-receipts-to-csv'])
  assert.deepEqual(funnel.bySource.map((r) => r.sourceType), ['agent_inquiry', 'manual_operator', 'website_contact'])
})

test('refund netting: net = gross - refunded, per offer and in totals, incl. partial and full', () => {
  const opportunities: Opportunity[] = [
    opp('revopp_o1', 'book-the-imagined-life', 'agent_inquiry', true, 'refunded'),
    opp('revopp_o2', 'book-the-imagined-life', 'website_contact', true, 'paid'),
    opp('revopp_o5', 'utility-receipts-to-csv', 'manual_operator', true, 'partially_refunded'),
  ]
  const reconciliations: PaymentReconciliation[] = [
    { opportunityId: 'revopp_o1', grossAmountCents: 900, refundedAmountCents: 900, currency: 'usd', paidAt: T }, // fully refunded → net 0
    { opportunityId: 'revopp_o2', grossAmountCents: 900, refundedAmountCents: 0, currency: 'usd', paidAt: T },
    { opportunityId: 'revopp_o5', grossAmountCents: 1000, refundedAmountCents: 300, currency: 'usd', paidAt: T }, // partial → net 700
    { opportunityId: 'revopp_missing', grossAmountCents: 500, refundedAmountCents: 0, currency: 'usd', paidAt: T }, // no opportunity → unattributed
  ]
  const { revenue } = aggregateRevenueMetrics({ ...base(), opportunities, reconciliations })

  assert.deepEqual(revenue.totals, { grossCents: 3300, refundedCents: 1200, netCents: 2100, paidCount: 4 })

  const book = revenue.byOffer.find((r) => r.offerId === 'book-the-imagined-life')!
  assert.deepEqual(book, { offerId: 'book-the-imagined-life', currency: 'usd', grossCents: 1800, refundedCents: 900, netCents: 900, paidCount: 2 })
  const utility = revenue.byOffer.find((r) => r.offerId === 'utility-receipts-to-csv')!
  assert.equal(utility.netCents, 700)
  const unattributed = revenue.byOffer.find((r) => r.offerId === 'unattributed')!
  assert.deepEqual(unattributed, { offerId: 'unattributed', currency: 'usd', grossCents: 500, refundedCents: 0, netCents: 500, paidCount: 1 })
})

test('revenue is bucketed by time period from paid_at', () => {
  const reconciliations: PaymentReconciliation[] = [
    { opportunityId: 'x', grossAmountCents: 1000, refundedAmountCents: 0, currency: 'usd', paidAt: '2026-07-01T10:00:00Z' },
    { opportunityId: 'y', grossAmountCents: 500, refundedAmountCents: 100, currency: 'usd', paidAt: '2026-07-20T10:00:00Z' },
    { opportunityId: 'z', grossAmountCents: 200, refundedAmountCents: 0, currency: 'usd', paidAt: '2026-08-02T10:00:00Z' },
  ]
  const monthly = aggregateRevenueMetrics({ ...base(), reconciliations, granularity: 'month' }).revenue.byPeriod
  assert.deepEqual(monthly.map((r) => [r.period, r.grossCents, r.netCents]), [['2026-07', 1500, 1400], ['2026-08', 200, 200]])

  const daily = aggregateRevenueMetrics({ ...base(), reconciliations, granularity: 'day' }).revenue.byPeriod
  assert.deepEqual(daily.map((r) => r.period), ['2026-07-01', '2026-07-20', '2026-08-02'])
})

test('periodKey is deterministic and UTC-based (day, month, ISO week)', () => {
  assert.equal(periodKey('2026-07-20T23:59:00Z', 'day'), '2026-07-20')
  assert.equal(periodKey('2026-07-20T10:00:00Z', 'month'), '2026-07')
  assert.equal(periodKey('2026-01-01T12:00:00Z', 'week'), '2026-W01') // Thursday → ISO week 1
  assert.equal(periodKey('2026-01-05T12:00:00Z', 'week'), '2026-W02') // following Monday
  assert.equal(periodKey('not-a-date', 'day'), 'unknown')
})

test('inbound and utility summaries count without exposing identity', () => {
  const inbound: InboundRecord[] = [
    { offerId: 'mps-preflight', qualificationStatus: 'qualified', revenueOpportunityId: 'revopp_x', createdAt: T },
    { offerId: 'mps-preflight', qualificationStatus: 'needs_clarification', revenueOpportunityId: null, createdAt: T },
    { offerId: 'verified-research-brief', qualificationStatus: 'qualified', revenueOpportunityId: null, createdAt: T },
  ]
  const utilityCheckouts: UtilityCheckoutRecord[] = [
    { utility: 'receipts-to-csv', status: 'paid', runStatus: 'consumed', paymentAmountCents: 1000, paymentCurrency: 'usd', createdAt: T, paidAt: T },
    { utility: 'receipts-to-csv', status: 'paid', runStatus: 'refunded', paymentAmountCents: 1000, paymentCurrency: 'usd', createdAt: T, paidAt: T },
    { utility: 'receipts-to-csv', status: 'awaiting_payment', runStatus: 'unused', paymentAmountCents: null, paymentCurrency: null, createdAt: T, paidAt: null },
    { utility: 'receipts-to-csv', status: 'failed', runStatus: 'unused', paymentAmountCents: null, paymentCurrency: null, createdAt: T, paidAt: null },
  ]
  const { inbound: inb, utility } = aggregateRevenueMetrics({ ...base(), inbound, utilityCheckouts })

  assert.equal(inb.total, 3)
  assert.equal(inb.qualified, 2)
  assert.equal(inb.needsClarification, 1)
  assert.equal(inb.converted, 1)
  assert.deepEqual(inb.byOffer, [
    { offerId: 'mps-preflight', total: 2, converted: 1 },
    { offerId: 'verified-research-brief', total: 1, converted: 0 },
  ])

  assert.deepEqual(utility.byStatus, { paid: 2, awaiting_payment: 1, failed: 1 })
  assert.deepEqual(utility.byRunStatus, { consumed: 1, refunded: 2 - 1, unused: 2 })
  assert.deepEqual(utility.paid, [{ currency: 'usd', grossCents: 2000, count: 2 }])
  assert.equal(utility.refundedRuns, 1)
})
