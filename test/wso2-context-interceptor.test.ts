import assert from 'node:assert/strict'
import test from 'node:test'

import workload from '../content/integrations/wso2-context-compiler-workload.json' with { type: 'json' }
import {
  MAX_WSO2_OPENAI_BODY_BYTES,
  WSO2_CONTEXT_EXTENSION,
  WSO2_CONTEXT_PLACEHOLDER,
  WSO2_INTERCEPTOR_TOKEN_HEADER,
  handleWso2ContextRequest,
} from '../lib/integrations/wso2-context-interceptor.ts'

const secret = 'wso2-context-interceptor-test-secret'

function envelope(body: Record<string, unknown>, token = secret) {
  return {
    requestHeaders: { 'content-type': 'application/json', [WSO2_INTERCEPTOR_TOKEN_HEADER]: token },
    requestBody: Buffer.from(JSON.stringify(body), 'utf8').toString('base64'),
    invocationContext: { requestId: 'request-1', method: 'POST', path: '/v1/chat/completions' },
  }
}

function responseError(result: ReturnType<typeof handleWso2ContextRequest>) {
  assert.ok(result.body)
  return JSON.parse(Buffer.from(result.body, 'base64').toString('utf8')) as { error: { code: string; message: string } }
}

test('WSO2 requests without the explicit Maha extension pass through untouched', () => {
  const result = handleWso2ContextRequest(envelope({ model: 'test', messages: [] }), secret)
  assert.deepEqual(result, { headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER] })
})

test('WSO2 context requests fail closed when the integration secret is not configured', () => {
  const result = handleWso2ContextRequest(envelope({}), undefined)
  assert.equal(result.directRespond, true)
  assert.equal(result.responseCode, 503)
  assert.equal(responseError(result).error.code, 'interceptor_not_configured')
})

test('WSO2 context requests reject an invalid integration credential and strip it', () => {
  const result = handleWso2ContextRequest(envelope({}, 'wrong-secret'), secret)
  assert.equal(result.directRespond, true)
  assert.equal(result.responseCode, 401)
  assert.equal(responseError(result).error.code, 'invalid_interceptor_credential')
  assert.ok(result.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER))
})

test('WSO2 context requests rewrite one explicit placeholder and return bounded evidence', () => {
  const input = {
    model: 'test-model',
    messages: [
      { role: 'system', content: `Evidence follows:\n${WSO2_CONTEXT_PLACEHOLDER}` },
      { role: 'user', content: workload.request.task },
    ],
    [WSO2_CONTEXT_EXTENSION]: workload.request,
    temperature: 0,
  }
  const result = handleWso2ContextRequest(envelope(input), secret)

  assert.equal(result.directRespond, undefined)
  assert.ok(result.body)
  assert.ok(result.headersToAdd)
  assert.ok(result.interceptorContext)
  assert.ok(result.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER))
  assert.ok(result.headersToRemove?.includes('content-length'))
  assert.equal(result.headersToAdd['x-maha-zero-data-retention'], 'true')
  assert.match(result.headersToAdd['x-maha-context-input-hash'], /^sha256:[a-f0-9]{64}$/)
  assert.match(result.headersToAdd['x-maha-context-output-hash'], /^sha256:[a-f0-9]{64}$/)
  assert.equal(result.interceptorContext.inputHash, result.headersToAdd['x-maha-context-input-hash'])

  const rewritten = JSON.parse(Buffer.from(result.body, 'base64').toString('utf8')) as Record<string, unknown>
  assert.equal(rewritten[WSO2_CONTEXT_EXTENSION], undefined)
  assert.equal(rewritten.model, 'test-model')
  assert.equal(rewritten.temperature, 0)
  const rendered = JSON.stringify(rewritten.messages)
  assert.equal(rendered.includes(WSO2_CONTEXT_PLACEHOLDER), false)
  assert.match(rendered, /\[release-policy:/)
  for (const fact of workload.requiredFacts) assert.match(rendered.toLowerCase(), new RegExp(fact.toLowerCase().replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  // Evidence carries hashes and aggregate measurements, never supplied text.
  const evidence = JSON.stringify({ headers: result.headersToAdd, context: result.interceptorContext })
  for (const document of workload.request.documents) assert.equal(evidence.includes(document.text), false)
})

test('WSO2 context requests require exactly one placeholder', () => {
  for (const messages of [
    [{ role: 'user', content: 'No marker.' }],
    [{ role: 'user', content: `${WSO2_CONTEXT_PLACEHOLDER} ${WSO2_CONTEXT_PLACEHOLDER}` }],
  ]) {
    const result = handleWso2ContextRequest(envelope({ messages, [WSO2_CONTEXT_EXTENSION]: workload.request }), secret)
    assert.equal(result.responseCode, 400)
    assert.equal(responseError(result).error.code, 'context_compilation_rejected')
  }
})

test('WSO2 context requests reject malformed base64, non-JSON, and oversized decoded bodies', () => {
  const malformed = handleWso2ContextRequest({
    requestHeaders: { [WSO2_INTERCEPTOR_TOKEN_HEADER]: secret },
    requestBody: 'not-base64',
  }, secret)
  assert.equal(malformed.responseCode, 400)
  assert.equal(responseError(malformed).error.code, 'invalid_interceptor_body')

  const nonJson = handleWso2ContextRequest({
    requestHeaders: { [WSO2_INTERCEPTOR_TOKEN_HEADER]: secret },
    requestBody: Buffer.from('not json').toString('base64'),
  }, secret)
  assert.equal(nonJson.responseCode, 400)

  const oversized = handleWso2ContextRequest({
    requestHeaders: { [WSO2_INTERCEPTOR_TOKEN_HEADER]: secret },
    requestBody: Buffer.alloc(MAX_WSO2_OPENAI_BODY_BYTES + 1, 97).toString('base64'),
  }, secret)
  assert.equal(oversized.responseCode, 413)
  assert.equal(responseError(oversized).error.code, 'payload_too_large')
})
