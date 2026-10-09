import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseReviewClientEvent, reviewChannel } from '../lib/context-review-measurement.ts'
import { recordReviewMeasurement, REVIEW_MEASUREMENT_RETENTION_SECONDS } from '../lib/context-review-measurement-server.ts'
import { readReviewBody, contextReviewMcp } from '../lib/context-review-http.ts'

test('client measurement rejects content, IDs, revenue and server-completion claims', () => {
  assert.deepEqual(parseReviewClientEvent({ event: 'export', channel: 'web' }), { event: 'export', channel: 'web' })
  for (const field of ['documents', 'ip', 'wallet', 'visitorId', 'inputHash', 'revenue']) {
    assert.throws(() => parseReviewClientEvent({ event: 'view', channel: 'web', [field]: 'restricted' }))
  }
  for (const event of ['completed', 'failed', 'paid', 'inquiry_submitted']) assert.throws(() => parseReviewClientEvent({ event, channel: 'web' }))
  assert.equal(reviewChannel('https://example.com/private?token=secret'), 'unknown')
})

test('counters contain only fixed event fields and date keys, expire, and separate client from server signals', async () => {
  const calls: unknown[][] = []
  const store = { eval: async (...args: unknown[]) => { calls.push(args); return 1 } }
  assert.equal(await recordReviewMeasurement('completed', 'claude', 'mcp', { store, now: new Date('2026-10-01T12:00:00Z') }), true)
  const [script, keys, args] = calls[0] as [string, string[], unknown[]]
  assert.match(script, /if n > 2000/)
  assert.match(script, /EXPIRE/)
  assert.ok(keys[0].endsWith('context-review:counts:2026-10-01'))
  assert.deepEqual(args, ['mcp:claude:completed', 90 * 86400])
  assert.equal(REVIEW_MEASUREMENT_RETENTION_SECONDS, 90 * 86400)
  await recordReviewMeasurement('pilot_cta', 'web', 'browser', { store })
  assert.equal((calls[1][2] as string[])[0], 'browser:web:pilot_cta')
})

test('measurement outages fail harmlessly without exposing errors', async () => {
  const store = { eval: async () => { throw new Error('synthetic provider credential') } }
  assert.equal(await recordReviewMeasurement('failed', 'web', 'web', { store }), false)
})

test('small event bodies are bounded while normal review bounds remain unchanged', async () => {
  const request = new Request('https://www.mahastrategies.com/api/context-review/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ junk: 'x'.repeat(600) }) })
  await assert.rejects(() => readReviewBody(request, 512), /size limit/)
})

test('Claude origins can initialize without accessing user accounts', async () => {
  const request = new Request('https://www.mahastrategies.com/api/mcp/context-review', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://claude.ai' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }) })
  const response = await contextReviewMcp(request)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).result.serverInfo.name, 'maha-context-review')
})

test('MCP records only enum metadata through the injectable background measurement hook', async () => {
  const calls: unknown[][] = []
  const request = new Request('https://www.mahastrategies.com/api/mcp/context-review?channel=claude', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'review_context_retention', arguments: {
      task: 'Check the synthetic release condition.', documents: [{ id: 'release', text: 'Release requires owner approval.' }], tokenBudget: 256, sanitized: true,
    } } }),
  })
  const response = await contextReviewMcp(request, (...args) => { calls.push(args) })
  assert.equal((await response.json()).result.isError, false)
  assert.deepEqual(calls, [['completed', 'claude', 'mcp']])
})

test('privacy and browser copy distinguish clicks from revenue and respect privacy preferences', () => {
  const privacy = readFileSync('app/tools/context-review/privacy/page.tsx', 'utf8')
  assert.match(privacy, /Counters expire after 90 days/)
  assert.match(privacy, /cannot identify returning users/)
  const client = readFileSync('app/tools/context-review/ReviewWorkbench.tsx', 'utf8')
  assert.match(client, /doNotTrack/)
  assert.match(client, /globalPrivacyControl/)
  assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie/)
})
