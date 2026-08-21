import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  GATEWAY_COMPILED_HEADER,
  GATEWAY_CONTEXT_EXTENSION,
  GATEWAY_CONTEXT_PLACEHOLDER,
  GATEWAY_DEFAULT_MAX_BODY_BYTES,
  GATEWAY_MINIMUM_SECRET_LENGTH,
  GATEWAY_POLICY_VERSION,
  compileGatewayContext,
  evidenceHeaders,
  gatewayLimitsFrom,
  gatewaySecretFrom,
  type GatewayCompileInput,
} from '../lib/integrations/gateway-context-contract.ts'

const ROOT = join(import.meta.dirname, '..')
const SECRET = 'a'.repeat(GATEWAY_MINIMUM_SECRET_LENGTH)

/** One sanitized fixture, run through every adapter abstraction. No provider call. */
const SOURCE_SENTENCE = 'Rollback begins when the error rate exceeds two percent for five minutes.'
const longDocument = `${SOURCE_SENTENCE} ${'Operational filler describing unrelated deployment procedure. '.repeat(400)}`

const fixture = () => ({
  model: 'test-model',
  messages: [
    { role: 'system', content: `Use only this evidence:\n\n${GATEWAY_CONTEXT_PLACEHOLDER}` },
    { role: 'user', content: 'What is the rollback trigger?' },
  ],
  [GATEWAY_CONTEXT_EXTENSION]: {
    clientRequestId: 'gateway-contract-fixture-1',
    task: 'What is the rollback trigger?',
    tokenBudget: 512,
    documents: [{ id: 'runbook', title: 'Release runbook', text: longDocument }],
    provenance: 'compact',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
  },
})

const call = (overrides: Partial<GatewayCompileInput> = {}) => {
  const body = overrides.body ?? fixture()
  return compileGatewayContext({
    body,
    bodyBytes: Buffer.byteLength(JSON.stringify(body), 'utf8'),
    suppliedSecret: SECRET,
    configuredSecret: SECRET,
    contentType: 'application/json',
    alreadyCompiled: false,
    ...overrides,
  })
}

test('a valid request is compiled and rewrites only the marker', () => {
  const result = call()
  assert.equal(result.outcome, 'compiled')
  if (result.outcome !== 'compiled') return

  const messages = result.body.messages as { role: string; content: string }[]
  assert.equal(messages.length, 2)
  assert.equal(messages[1].content, 'What is the rollback trigger?', 'a message without the marker was modified')
  assert.ok(!messages[0].content.includes(GATEWAY_CONTEXT_PLACEHOLDER), 'the marker survived')
  assert.ok(messages[0].content.startsWith('Use only this evidence:'), 'surrounding prompt text was not preserved')
  assert.equal(result.body.model, 'test-model', 'an unrelated field was altered')
  assert.equal(result.body[GATEWAY_CONTEXT_EXTENSION], undefined, 'the extension was forwarded upstream')
})

test('metadata headers are present, complete and sanitized', () => {
  const result = call()
  assert.equal(result.outcome, 'compiled')
  if (result.outcome !== 'compiled') return

  for (const name of [
    GATEWAY_COMPILED_HEADER, 'x-maha-input-hash', 'x-maha-output-hash',
    'x-maha-token-budget', 'x-maha-retained-passages', 'x-maha-source-coverage-bps', 'x-maha-policy-version',
  ]) {
    assert.ok(result.headers[name] !== undefined, `missing header ${name}`)
  }
  assert.equal(result.headers[GATEWAY_COMPILED_HEADER], 'true')
  assert.match(result.headers['x-maha-input-hash'], /^sha256:[0-9a-f]{64}$/)
  assert.match(result.headers['x-maha-output-hash'], /^sha256:[0-9a-f]{64}$/)
  assert.equal(result.headers['x-maha-policy-version'], GATEWAY_POLICY_VERSION)
  // Basis points are an integer, so no locale decides the decimal separator.
  assert.match(result.headers['x-maha-source-coverage-bps'], /^\d+$/)
  assert.ok(Number(result.headers['x-maha-source-coverage-bps']) <= 10_000)
})

test('no source text, task text or secret reaches a header or the result object', () => {
  const result = call()
  assert.equal(result.outcome, 'compiled')
  if (result.outcome !== 'compiled') return

  const headerBlob = JSON.stringify(result.headers)
  for (const forbidden of [SOURCE_SENTENCE, 'rollback trigger', SECRET, 'Release runbook', 'runbook']) {
    assert.ok(!headerBlob.includes(forbidden), `headers leak ${forbidden.slice(0, 24)}`)
  }
  // The evidence object is the loggable one; the rewritten body is not.
  const evidenceBlob = JSON.stringify(result.evidence)
  for (const forbidden of [SOURCE_SENTENCE, SECRET, 'Release runbook']) {
    assert.ok(!evidenceBlob.includes(forbidden), `evidence leaks ${forbidden.slice(0, 24)}`)
  }
})

test('an absent or wrong secret fails closed before anything is parsed', () => {
  for (const supplied of [null, undefined, '', 'b'.repeat(GATEWAY_MINIMUM_SECRET_LENGTH)]) {
    const result = call({ suppliedSecret: supplied })
    assert.equal(result.outcome, 'rejected')
    if (result.outcome !== 'rejected') continue
    assert.equal(result.status, 401)
    assert.equal(result.code, 'invalid_interceptor_credential')
    assert.ok(!result.message.includes(SECRET), 'the rejection message echoes the secret')
  }
})

test('an unconfigured or too-short secret reports configuration, never credential', () => {
  for (const configured of [undefined, '', 'short']) {
    const result = call({ configuredSecret: configured })
    assert.equal(result.outcome, 'rejected')
    if (result.outcome !== 'rejected') continue
    assert.equal(result.status, 503)
    assert.equal(result.code, 'interceptor_not_configured')
  }
})

test('a malformed envelope fails closed', () => {
  for (const body of [null, 'a string', 42, ['array']]) {
    const result = call({ body, bodyBytes: 32 })
    assert.equal(result.outcome, 'rejected')
    if (result.outcome !== 'rejected') continue
    assert.equal(result.code, 'invalid_envelope')
  }
})

test('an oversized payload is refused rather than truncated', () => {
  const result = call({ bodyBytes: GATEWAY_DEFAULT_MAX_BODY_BYTES + 1 })
  assert.equal(result.outcome, 'rejected')
  if (result.outcome !== 'rejected') return
  assert.equal(result.status, 413)
  assert.equal(result.code, 'payload_too_large')
})

test('a non-JSON media type and a missing messages array fail closed', () => {
  const wrongType = call({ contentType: 'text/plain' })
  assert.equal(wrongType.outcome, 'rejected')
  if (wrongType.outcome === 'rejected') assert.equal(wrongType.status, 415)

  const noMessages = fixture() as Record<string, unknown>
  delete noMessages.messages
  const result = call({ body: noMessages })
  assert.equal(result.outcome, 'rejected')
  if (result.outcome === 'rejected') assert.equal(result.code, 'invalid_llm_request')
})

test('a request already marked compiled is not compiled twice', () => {
  const result = call({ alreadyCompiled: true })
  assert.equal(result.outcome, 'passthrough')
  if (result.outcome !== 'passthrough') return
  assert.equal(result.reason, 'already_compiled')
})

test('a request that never opted in is left alone', () => {
  const body = fixture() as Record<string, unknown>
  delete body[GATEWAY_CONTEXT_EXTENSION]
  const result = call({ body })
  assert.equal(result.outcome, 'passthrough')
  if (result.outcome !== 'passthrough') return
  assert.equal(result.reason, 'no_context_extension')
})

/**
 * The bypass exists so enabling the policy can never make a prompt bigger.
 * Asserting the reason is not enough; this asserts the token count.
 */
test('the minimum-size bypass never increases the forwarded context', () => {
  const body = fixture() as Record<string, unknown>
  const extension = body[GATEWAY_CONTEXT_EXTENSION] as Record<string, unknown>
  extension.documents = [{ id: 'tiny', title: 'Tiny', text: 'Rollback at two percent for five minutes.' }]
  const result = call({ body })
  assert.equal(result.outcome, 'compiled')
  if (result.outcome !== 'compiled') return

  assert.equal(result.evidence.bypassApplied, true)
  assert.equal(result.evidence.bypassReason, 'below_minimum_size')
  assert.ok(
    result.evidence.compiledEstimatedTokens <= result.evidence.originalEstimatedTokens,
    'the bypass produced a larger context than the original',
  )
  assert.equal(result.evidence.tokensSaved, 0)
  assert.equal(result.evidence.retainedPassages, 0)
  assert.equal(result.evidence.sourceCoverageBps, 10_000, 'forwarding the whole source is total coverage')
})

test('compilation on a large document actually reduces the context', () => {
  const result = call()
  assert.equal(result.outcome, 'compiled')
  if (result.outcome !== 'compiled') return
  assert.equal(result.evidence.bypassApplied, false)
  assert.ok(result.evidence.compiledEstimatedTokens < result.evidence.originalEstimatedTokens)
  assert.ok(result.evidence.tokensSaved > 0)
  assert.ok(result.evidence.retainedPassages > 0)
})

test('the same input compiles to the same hashes', () => {
  const first = call()
  const second = call()
  assert.equal(first.outcome, 'compiled')
  assert.equal(second.outcome, 'compiled')
  if (first.outcome !== 'compiled' || second.outcome !== 'compiled') return
  assert.equal(first.headers['x-maha-input-hash'], second.headers['x-maha-input-hash'])
  assert.equal(first.headers['x-maha-output-hash'], second.headers['x-maha-output-hash'])
})

test('a marker that is absent or repeated fails closed', () => {
  for (const content of ['no marker at all', `${GATEWAY_CONTEXT_PLACEHOLDER} and ${GATEWAY_CONTEXT_PLACEHOLDER}`]) {
    const body = fixture() as Record<string, unknown>
    ;(body.messages as { content: string }[])[0].content = content
    const result = call({ body })
    assert.equal(result.outcome, 'rejected')
    if (result.outcome !== 'rejected') continue
    assert.equal(result.code, 'context_compilation_rejected')
  }
})

test('evidenceHeaders emits exactly the seven contract headers', () => {
  const result = call()
  assert.equal(result.outcome, 'compiled')
  if (result.outcome !== 'compiled') return
  assert.deepEqual(Object.keys(evidenceHeaders(result.evidence)).sort(), [
    GATEWAY_COMPILED_HEADER,
    'x-maha-input-hash',
    'x-maha-output-hash',
    'x-maha-policy-version',
    'x-maha-retained-passages',
    'x-maha-source-coverage-bps',
    'x-maha-token-budget',
  ].sort())
})

test('limits and secret come from the environment with safe fallbacks', () => {
  assert.deepEqual(gatewayLimitsFrom({} as NodeJS.ProcessEnv), {
    maxBodyBytes: 512_000, minimumCompileTokens: 1_024, timeoutMs: 3_000,
  })
  // A nonsense value falls back rather than disabling the cap.
  assert.equal(gatewayLimitsFrom({ MAHA_GATEWAY_MAX_BODY_BYTES: '-1' } as NodeJS.ProcessEnv).maxBodyBytes, 512_000)
  assert.equal(gatewayLimitsFrom({ MAHA_GATEWAY_MAX_BODY_BYTES: 'lots' } as NodeJS.ProcessEnv).maxBodyBytes, 512_000)
  assert.equal(gatewayLimitsFrom({ MAHA_GATEWAY_TIMEOUT_MS: '1500' } as NodeJS.ProcessEnv).timeoutMs, 1_500)

  assert.equal(gatewaySecretFrom({} as NodeJS.ProcessEnv), undefined)
  assert.equal(gatewaySecretFrom({ WSO2_CONTEXT_INTERCEPTOR_SECRET: 'legacy' } as NodeJS.ProcessEnv), 'legacy')
  // The neutral name wins when both are set.
  assert.equal(gatewaySecretFrom({
    WSO2_CONTEXT_INTERCEPTOR_SECRET: 'legacy', MAHA_CONTEXT_INTERCEPTOR_SECRET: 'neutral',
  } as NodeJS.ProcessEnv), 'neutral')
})

test('WSO2 and the neutral contract share one decision, not two', () => {
  const interceptor = readFileSync(join(ROOT, 'lib/integrations/wso2-context-interceptor.ts'), 'utf8')
  assert.match(interceptor, /compileContextDecision/, 'WSO2 no longer delegates to the shared core')
  assert.ok(!interceptor.includes('compileContextPack('), 'WSO2 compiles directly, so the two can drift')
})
