import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewContextRetention, CONTEXT_REVIEW_TOOL } from '../lib/context-review.ts'
import { contextReviewMcp, readReviewBody } from '../lib/context-review-http.ts'

const base = { task: 'What service rebate applies?', tokenBudget: 256, sanitized: true, documents: [{ id: 'amendment', text: 'The service rebate is 25%.' }], expectedEvidence: [{ sourceId: 'amendment', excerpt: '25%' }] }
test('positive 1: declared evidence retained from the correct source', () => {
  const result = reviewContextRetention(base)
  assert.equal(result.evidence[0].status, 'retained')
  assert.ok(result.includedPassages.some(row => row.sourceId === 'amendment'))
  assert.equal(result.retentionBoundaries.completenessGuaranteed, false)
})
test('positive 2: budget excludes oversized passage and reports missing evidence', () => {
  const result = reviewContextRetention({ ...base, tokenBudget: 64, documents: [{ id: 'amendment', text: 'The service rebate clause requires inspection. '.repeat(20) }], expectedEvidence: [{ sourceId: 'amendment', excerpt: 'service rebate clause' }] })
  assert.equal(result.evidence[0].status, 'not_retained_as_exact_excerpt')
})
test('positive 3: evidence absent from original is not a retention failure', () => {
  const result = reviewContextRetention({ ...base, documents: [{ id: 'amendment', text: 'The service rebate is 10%.' }] })
  assert.equal(result.evidence[0].status, 'not_in_supplied_source')
})
test('positive 4: another source cannot satisfy the declaration', () => {
  const result = reviewContextRetention({ ...base, documents: [{ id: 'amendment', text: 'The service rebate is 10%.' }, { id: 'other', text: 'The service rebate is 25%.' }] })
  assert.equal(result.evidence[0].status, 'not_in_supplied_source')
})
test('positive 5: no declarations never implies completeness', () => {
  const result = reviewContextRetention({ ...base, expectedEvidence: [] })
  assert.equal(result.declarationStatus, 'no_expected_evidence_declared')
})
test('negative: rejects unconfirmed sanitization, unknown sources and credential patterns', () => {
  assert.throws(() => reviewContextRetention({ ...base, sanitized: false }), /sanitized/)
  assert.throws(() => reviewContextRetention({ ...base, expectedEvidence: [{ sourceId: 'missing', excerpt: '25%' }] }), /unknown source/)
  assert.throws(() => reviewContextRetention({ ...base, documents: [{ id: 'amendment', text: 'api_key=abcdefghijklmnopqrstuvwxyz123456' }] }), /restricted/)
})
test('strict inputs and deterministic fingerprints include declarations and configuration', () => {
  assert.throws(() => reviewContextRetention({ ...base, filePath: '/etc/passwd' }), /Unsupported/)
  assert.throws(() => reviewContextRetention({ ...base, documents: [{ id: 'amendment', text: 'x'.repeat(66000) }] }), /64 KiB/)
  assert.throws(() => reviewContextRetention({ ...base, expectedEvidence: [{ sourceId: 'amendment', excerpt: ' ' }] }), /nonempty/)
  const a = reviewContextRetention(base), b = reviewContextRetention(base)
  assert.deepEqual(a, b)
  assert.notEqual(a.inputHash, reviewContextRetention({ ...base, tokenBudget: 512 }).inputHash)
  assert.notEqual(a.inputHash, reviewContextRetention({ ...base, expectedEvidence: [] }).inputHash)
  assert.equal('packId' in a, false)
})
test('literal checking does not claim paraphrase or cross-passage retention', () => {
  const result = reviewContextRetention({ ...base, expectedEvidence: [{ sourceId: 'amendment', excerpt: '25 percent' }] })
  assert.equal(result.evidence[0].status, 'not_in_supplied_source')
})
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com/api/mcp/context-review', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
test('MCP initializes, advertises a bounded independent tool and executes it', async () => {
  const initialized = await (await contextReviewMcp(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }))).json()
  assert.equal(initialized.result.protocolVersion, '2025-06-18')
  const listed = await (await contextReviewMcp(request({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))).json()
  assert.deepEqual(listed.result.tools[0].annotations, CONTEXT_REVIEW_TOOL.annotations)
  const result = await (await contextReviewMcp(request({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: CONTEXT_REVIEW_TOOL.name, arguments: base } }))).json()
  assert.equal(result.result.isError, false)
  assert.equal(result.result.structuredContent.evidence[0].status, 'retained')
})
test('MCP rejects wrong origins, bad envelopes, unknown methods and invalid tools', async () => {
  assert.equal((await contextReviewMcp(request({}, { origin: 'https://evil.example' }))).status, 403)
  assert.equal((await contextReviewMcp(request([]))).status, 400)
  const failed = await (await contextReviewMcp(request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: CONTEXT_REVIEW_TOOL.name, arguments: { ...base, sanitized: false } } }))).json()
  assert.equal(failed.result.isError, true)
  const missing = await (await contextReviewMcp(request({ jsonrpc: '2.0', id: 1, method: 'delete_all' }))).json()
  assert.equal(missing.error.code, -32601)
  assert.equal((await contextReviewMcp(request({ jsonrpc: '2.0', method: 'notifications/initialized' }))).status, 202)
})
test('HTTP parser bounds streaming bodies and validates type', async () => {
  await assert.rejects(() => readReviewBody(request('x'.repeat(70000))), /64 KiB/)
  await assert.rejects(() => readReviewBody(request({}, { 'Content-Type': 'text/plain' })), /application\/json/)
})
