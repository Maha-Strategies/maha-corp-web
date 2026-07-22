import assert from 'node:assert/strict'
import test from 'node:test'

import { demandClusterId, demandGateHash, parseDemandCluster, scoreDemandCluster } from '../lib/demand-gate.ts'

const ids = ['a', 'b', 'c'].map((letter) => `mapopp_${letter.repeat(32)}`)

test('validates a corroborated demand cluster deterministically', () => {
  const result = scoreDemandCluster([
    { source: 'search_console', signal_class: 'buyer_demand', commercial_intent: 14 },
    { source: 'freelance_market', signal_class: 'marketplace_request', commercial_intent: 18 },
    { source: 'outbound_scout', signal_class: 'buyer_demand', commercial_intent: 12 },
  ])
  assert.equal(result.status, 'validated')
  assert.equal(result.score, 100)
  assert.equal(result.directDemandSignals, 3)
  assert.match(demandClusterId(), /^demand_[a-f0-9]{32}$/)
  assert.match(demandGateHash('cluster-create-001'), /^sha256:[a-f0-9]{64}$/)
})

test('does not turn editorial or competitor relevance into demand', () => {
  const result = scoreDemandCluster([
    { source: 'outbound_scout', signal_class: 'competitor_content', commercial_intent: 20 },
    { source: 'outbound_scout', signal_class: 'editorial_content', commercial_intent: 15 },
    { source: 'search_console', signal_class: 'editorial_content', commercial_intent: 12 },
  ])
  assert.equal(result.status, 'insufficient_evidence')
  assert.equal(result.directDemandSignals, 0)
})

test('parses only bounded, distinct approved signal references', () => {
  const parsed = parseDemandCluster({ title: 'Editorial claim verification demand', buyer: 'Editorial operations teams', jobToBeDone: 'Review AI-assisted writing for unsupported factual claims before publication.', offer: 'A bounded claim-verification workflow and evidence audit.', opportunityIds: ids, idempotencyKey: 'cluster-create-001' })
  assert.deepEqual(parsed.opportunityIds, ids)
  assert.throws(() => parseDemandCluster({ title: 'Editorial claim verification demand', buyer: 'Editorial operations teams', jobToBeDone: 'Review AI-assisted writing for unsupported factual claims before publication.', offer: 'A bounded claim-verification workflow and evidence audit.', opportunityIds: [ids[0], ids[0], ids[2]], idempotencyKey: 'cluster-create-001' }), /distinct/)
})
