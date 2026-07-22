import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateSalesPipeline } from '../lib/sales-pipeline-metrics.ts'

test('pipeline counts lifecycle stages and only includes explicitly linked revenue', () => {
  const output = aggregateSalesPipeline({
    prospects: [
      { publicId: 'prospect_a', offerId: 'mps-prepaid-audit-access', sourceKind: 'manual', contactBasis: 'public_business_contact', fitScore: 80, status: 'replied' },
      { publicId: 'prospect_b', offerId: 'utility-receipts-to-csv', sourceKind: 'manual', contactBasis: 'prior_relationship', fitScore: 75, status: 'won' },
    ],
    attributions: [{ prospectId: 'prospect_b', opportunityId: 'revopp_b' }],
    opportunities: [{ publicId: 'revopp_b', offerId: 'utility-receipts-to-csv', status: 'paid' }, { publicId: 'revopp_unlinked', offerId: 'mps-prepaid-audit-access', status: 'paid' }],
    reconciliations: [
      { opportunityId: 'revopp_b', grossAmountCents: 1000, refundedAmountCents: 200, currency: 'usd' },
      { opportunityId: 'revopp_unlinked', grossAmountCents: 5000, refundedAmountCents: 0, currency: 'usd' },
    ],
  })
  assert.equal(output.funnel.prospects, 2)
  assert.equal(output.funnel.sent, 2)
  assert.equal(output.funnel.replied, 2)
  assert.equal(output.funnel.won, 1)
  assert.equal(output.attribution.linkedProspects, 1)
  assert.equal(output.attribution.unlinkedProspects, 1)
  assert.deepEqual(output.attribution.linkedRevenue, [{ offerId: 'utility-receipts-to-csv', currency: 'usd', grossCents: 1000, refundedCents: 200, netCents: 800, paidCount: 1 }])
})
