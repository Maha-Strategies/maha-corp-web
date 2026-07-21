import assert from 'node:assert/strict'
import test from 'node:test'
import { marketMappingHash, marketOpportunityScore, parseMarketOperation, parseMarketOpportunity } from '../lib/market-mapping.ts'

const input = {
  source: 'outbound_scout', sourceReference: 'scout:2026-07-21:receipt-ops', title: 'Receipt-expense CSV gap for small operators',
  problem: 'Independent operators need a fast way to turn photographed receipts into accounting-ready CSV without adopting a full expense platform.',
  buyer: 'Independent service businesses with lightweight bookkeeping', proposedSolution: 'A fixed-price receipt image to CSV utility with a fast, no-login paid batch.',
  evidence: [{ url: 'https://example.com/evidence', note: 'Repeated demand signal in an approved research source.' }],
  demandEvidence: 24, commercialIntent: 20, capabilityFit: 18, speedToValidate: 12, riskPenalty: 4,
}

test('market opportunities require attributable HTTPS evidence and score deterministically', () => {
  const parsed = parseMarketOpportunity(input)
  assert.equal(marketOpportunityScore(parsed), 70)
  assert.throws(() => parseMarketOpportunity({ ...input, evidence: [{ url: 'http://example.com', note: 'Bad scheme.' }] }), /HTTPS/)
  assert.throws(() => parseMarketOpportunity({ ...input, demandEvidence: 31 }), /between 0 and 30/)
})

test('market operations exclude publishing, spend, and outreach actions', () => {
  const opportunityId = `mapopp_${'a'.repeat(32)}`
  assert.deepEqual(parseMarketOperation({ opportunityId, action: 'approve_experiment', note: 'Validate with a private brief.', idempotencyKey: 'market-op-0001' }), { opportunityId, action: 'approve_experiment', note: 'Validate with a private brief.', idempotencyKey: 'market-op-0001' })
  assert.throws(() => parseMarketOperation({ opportunityId, action: 'publish', idempotencyKey: 'market-op-0001' }), /not supported/)
  assert.match(marketMappingHash('market-op-0001'), /^sha256:[a-f0-9]{64}$/)
})
