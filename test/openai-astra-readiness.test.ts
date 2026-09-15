import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASTRA_EVALUATION_LANES,
  GPT_6_ASTRA_MODEL,
  assessAstraRequest,
  decideAstraRollout,
  mayAutomaticallyFallback,
} from '../lib/openai-astra-readiness.ts'

test('a compatible Responses request is canary-ready only after access and flag confirmation', () => {
  const readiness = assessAstraRequest('responses', {
    model: GPT_6_ASTRA_MODEL,
    reasoning: { effort: 'high' },
    tools: [{ type: 'function', name: 'retrieve_evidence', async: true }],
  })

  assert.equal(readiness.compatible, true)
  assert.deepEqual(decideAstraRollout({ accessConfirmed: false, canaryEnabled: true, readiness }), {
    action: 'hold-current-model',
    reason: 'access-unconfirmed',
  })
  assert.deepEqual(decideAstraRollout({ accessConfirmed: true, canaryEnabled: false, readiness }), {
    action: 'hold-current-model',
    reason: 'canary-disabled',
  })
  assert.deepEqual(decideAstraRollout({ accessConfirmed: true, canaryEnabled: true, readiness }), {
    action: 'run-astra-canary',
    model: GPT_6_ASTRA_MODEL,
  })
})

test('unsupported sampling and reasoning controls fail closed', () => {
  const readiness = assessAstraRequest('responses', {
    model: GPT_6_ASTRA_MODEL,
    temperature: 0,
    top_p: 1,
    top_logprobs: 5,
    reasoning: { effort: 'none' },
    include: ['message.output_text.logprobs'],
  })

  assert.equal(readiness.compatible, false)
  assert.deepEqual(readiness.issues.map((issue) => issue.path), [
    'temperature',
    'top_p',
    'top_logprobs',
    'include',
    'reasoning.effort',
  ])
})

test('Chat Completions remains text-compatible but refuses Astra tool calling', () => {
  assert.equal(assessAstraRequest('chat-completions', {
    model: GPT_6_ASTRA_MODEL,
    messages: [{ role: 'user', content: 'hello' }],
    reasoning_effort: 'low',
  }).compatible, true)

  const withTools = assessAstraRequest('chat-completions', {
    model: GPT_6_ASTRA_MODEL,
    messages: [{ role: 'user', content: 'retrieve evidence' }],
    tools: [{ type: 'function', function: { name: 'retrieve_evidence' } }],
  })
  assert.equal(withTools.compatible, false)
  assert.ok(withTools.issues.some((issue) => issue.code === 'responses-required-for-tools'))
})

test('fallback cannot duplicate a side-effectful tool operation', () => {
  assert.equal(mayAutomaticallyFallback({ sideEffectfulToolDispatched: false, failure: 'model-unavailable' }), true)
  assert.equal(mayAutomaticallyFallback({ sideEffectfulToolDispatched: false, failure: 'permission-denied' }), true)
  assert.equal(mayAutomaticallyFallback({ sideEffectfulToolDispatched: false, failure: 'rate-limited' }), false)
  assert.equal(mayAutomaticallyFallback({ sideEffectfulToolDispatched: true, failure: 'model-unavailable' }), false)
})

test('the readiness matrix covers Maha evidence, release, machine, privacy, and economics risks', () => {
  assert.equal(ASTRA_EVALUATION_LANES.length, 8)
  assert.ok(ASTRA_EVALUATION_LANES.includes('evidence-preflight-boundary-fidelity'))
  assert.ok(ASTRA_EVALUATION_LANES.includes('mcp-tool-entitlement-and-side-effect-bounds'))
  assert.ok(ASTRA_EVALUATION_LANES.includes('privacy-and-private-corpus-non-disclosure'))
  assert.ok(ASTRA_EVALUATION_LANES.includes('cost-latency-token-and-schema-regression'))
})
