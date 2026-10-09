import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from '../app/api/workflow-advisor/route.ts'
import { buildAdvisorPlan, parseAdvisorInput } from '../lib/workflow-advisor.ts'
import { CONTEXT_COMPRESSION_OFFER } from '../lib/x402/offers.ts'

const input = (objective: string, additional: Record<string, unknown> = {}) => parseAdvisorInput({
  workflow: '', objective, ...additional,
})

test('manual planning names the actual published offer and request example', () => {
  const plan = buildAdvisorPlan(input('compile-context-pack'), 'compile-context-pack')
  assert.equal(plan.decision.decision, 'select')
  assert.deepEqual(plan.decision.selectedOfferIds, ['context-compression'])
  assert.equal(plan.offers[0].priceBaseUnits, CONTEXT_COMPRESSION_OFFER.amount)
  assert.deepEqual(plan.offers[0].requestExample, CONTEXT_COMPRESSION_OFFER.discovery.input)
  assert.equal(plan.offers[0].contractUrl, 'https://www.mahastrategies.com/api/discovery/x402-offers/context-compression')
  assert.match(plan.advisory, /not a quote or authorization/)
})

test('unknown tasks, fact verification and unaffordable evaluation do not fall through to a cheaper offer', () => {
  const unknown = buildAdvisorPlan(input('other'), 'other')
  const verification = buildAdvisorPlan(input('verify-facts'), 'verify-facts')
  const unaffordable = buildAdvisorPlan(input('evaluate-context-quality', { maximumPriceBaseUnits: '1' }), 'evaluate-context-quality')
  for (const plan of [unknown, verification, unaffordable]) {
    assert.equal(plan.decision.decision, 'reject')
    assert.deepEqual(plan.offers, [])
  }
})

test('retention requirement is checked by the published selector', () => {
  const plan = buildAdvisorPlan(input('compile-context-pack', { needsRetentionMeasurement: true }), 'compile-context-pack')
  assert.deepEqual(plan.decision.selectedOfferIds, ['deep-context-evaluation'])
})

test('input validation rejects malformed ceilings and oversized workflow text', () => {
  assert.throws(() => input('compile-context-pack', { maximumPriceBaseUnits: '0.01' }), /decimal integer/)
  assert.throws(() => input('auto', { workflow: ' ' }), /Describe/)
  assert.throws(() => input('compile-context-pack', { workflow: 'x'.repeat(2001) }), /2,000/)
})

test('the route serves a free plan and leaves model mode disabled by default', async () => {
  const response = await POST(new Request('https://example.test/api/workflow-advisor', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workflow: '', objective: 'compile-context-pack' }),
  }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.mode, 'deterministic')
  assert.equal(body.plan.offers[0].path, CONTEXT_COMPRESSION_OFFER.path)

  const original = process.env.WORKFLOW_ADVISOR_AI_ENABLED
  process.env.WORKFLOW_ADVISOR_AI_ENABLED = 'false'
  try {
    const blocked = await POST(new Request('https://example.test/api/workflow-advisor', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflow: 'Select a passage', objective: 'auto' }),
    }))
    assert.equal(blocked.status, 503)
  } finally {
    if (original === undefined) delete process.env.WORKFLOW_ADVISOR_AI_ENABLED
    else process.env.WORKFLOW_ADVISOR_AI_ENABLED = original
  }
})

test('private agent mode refuses unauthenticated calls before any model invocation', async () => {
  const old = {
    enabled: process.env.WORKFLOW_ADVISOR_AI_ENABLED,
    key: process.env.OPENAI_API_KEY,
    token: process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN,
  }
  process.env.WORKFLOW_ADVISOR_AI_ENABLED = 'true'
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key'
  process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN = 'test-advisor-secret'
  try {
    const response = await POST(new Request('https://example.test/api/workflow-advisor', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflow: 'Select passages', objective: 'auto' }),
    }))
    assert.equal(response.status, 401)
  } finally {
    if (old.enabled === undefined) delete process.env.WORKFLOW_ADVISOR_AI_ENABLED
    else process.env.WORKFLOW_ADVISOR_AI_ENABLED = old.enabled
    if (old.key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = old.key
    if (old.token === undefined) delete process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN
    else process.env.WORKFLOW_ADVISOR_ACCESS_TOKEN = old.token
  }
})
