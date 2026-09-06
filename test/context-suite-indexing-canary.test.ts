import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTEXT_SUITE_INDEXING_TARGETS,
  isContextSuiteTargetIndexed,
} from '../scripts/run-context-suite-indexing-canaries.ts'

const payTo = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
const asset = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

test('the authorized sequence is exactly Budget Ladder then Evidence Matrix', () => {
  assert.deepEqual(CONTEXT_SUITE_INDEXING_TARGETS.map(({ offerId, amount }) => ({ offerId, amount })), [
    { offerId: 'context-budget-ladder', amount: '5000' },
    { offerId: 'evidence-retention-matrix', amount: '50000' },
  ])
  assert.equal(CONTEXT_SUITE_INDEXING_TARGETS.reduce((sum, target) => sum + BigInt(target.amount), BigInt(0)), BigInt(55_000))
})

test('Bazaar discovery requires the exact route and payment terms', () => {
  const target = CONTEXT_SUITE_INDEXING_TARGETS[0]
  const resource = {
    resource: target.resource,
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: target.amount, payTo, asset, maxTimeoutSeconds: 60 }],
    extensions: { bazaar: { schema: {} } },
  }
  assert.equal(isContextSuiteTargetIndexed([resource], target), true)
  assert.equal(isContextSuiteTargetIndexed([{ ...resource, resource: `${target.resource}/wrong` }], target), false)
  assert.equal(isContextSuiteTargetIndexed([{ ...resource, accepts: [{ ...resource.accepts[0], amount: '50000' }] }], target), false)
  assert.equal(isContextSuiteTargetIndexed([{ ...resource, extensions: {} }], target), false)
})
