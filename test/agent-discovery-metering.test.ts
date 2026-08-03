import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateAgentDiscovery, classifyClient, recordAgentDiscovery, type AgentDiscoveryUsageRow } from '../lib/agent-discovery-metering.ts'

test('AI vendor crawlers are separated from agent runtimes', () => {
  // Real GPTBot advertises both "openai" and "gptbot"; the crawler reading is
  // the correct one, so crawler signatures are tested first.
  assert.equal(classifyClient('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot'), 'ai_crawler')
  assert.equal(classifyClient('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'), 'ai_crawler')
  assert.equal(classifyClient('Mozilla/5.0 (compatible; PerplexityBot/1.0)'), 'ai_crawler')
})

test('an agent runtime calling on its own behalf is identified', () => {
  assert.equal(classifyClient('modelcontextprotocol-sdk/1.2.0'), 'agent_runtime')
  assert.equal(classifyClient('langchain/0.3.1 python/3.11'), 'agent_runtime')
  assert.equal(classifyClient('anthropic-sdk-typescript/0.110.0'), 'agent_runtime')
  assert.equal(classifyClient('MyCompany-Agent/2.0'), 'agent_runtime')
})

test('conventional crawlers claiming Mozilla are not counted as browsers', () => {
  assert.equal(classifyClient('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), 'search_crawler')
  assert.equal(classifyClient('Mozilla/5.0 (compatible; bingbot/2.0)'), 'search_crawler')
})

test('scripted clients are distinguished from people', () => {
  assert.equal(classifyClient('curl/8.4.0'), 'http_client')
  assert.equal(classifyClient('python-requests/2.31.0'), 'http_client')
  assert.equal(classifyClient('Go-http-client/2.0'), 'http_client')
  assert.equal(classifyClient('node-fetch/3.3.2'), 'http_client')
})

test('a real browser is classified last, not first', () => {
  assert.equal(classifyClient('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'), 'browser')
  assert.equal(classifyClient('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'), 'browser')
})

test('an absent or unrecognised user agent is recorded honestly, not guessed', () => {
  assert.equal(classifyClient(null), 'unspecified')
  assert.equal(classifyClient(undefined), 'unspecified')
  assert.equal(classifyClient('   '), 'unspecified')
  assert.equal(classifyClient('SomethingEntirelyNew/1.0'), 'other')
})

test('javascript is not mistaken for a Java http client', () => {
  assert.equal(classifyClient('javascript-runtime/1.0'), 'other')
})

test('the meter sends only a class, never the user agent', async () => {
  const calls: Record<string, unknown>[] = []
  const ledger = { rpc: async (_name: string, args: Record<string, unknown>) => { calls.push(args); return { error: null } } }
  const identifying = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36'
  await recordAgentDiscovery(ledger, { surface: 'agent_card', userAgent: identifying })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].p_client_class, 'browser')
  assert.equal(calls[0].p_surface, 'agent_card')
  assert.equal(JSON.stringify(calls[0]).includes('Mozilla'), false)
  assert.equal(JSON.stringify(calls[0]).includes('Macintosh'), false)
})

test('a meter failure never propagates to the caller', async () => {
  const ledger = { rpc: async () => ({ error: { code: 'PGRST205' } }) }
  await assert.doesNotReject(() => recordAgentDiscovery(ledger, { surface: 'agent_offers', userAgent: 'curl/8.4.0' }))
})

test('aggregation reports the machine share the thesis depends on', () => {
  const rows: AgentDiscoveryUsageRow[] = [
    { usage_day: '2026-08-01', surface: 'agent_card', client_class: 'agent_runtime', request_count: 30 },
    { usage_day: '2026-08-01', surface: 'agent_card', client_class: 'browser', request_count: 10 },
    { usage_day: '2026-08-01', surface: 'agent_offers', client_class: 'ai_crawler', request_count: 40 },
    { usage_day: '2026-08-02', surface: 'agent_offers', client_class: 'http_client', request_count: '20' },
  ]
  const summary = aggregateAgentDiscovery(rows)
  assert.equal(summary.requests, 100)
  assert.equal(summary.machineRequests, 90)
  assert.equal(summary.agentRuntimeRequests, 30)
  assert.equal(summary.machineShare, 0.9)
  assert.deepEqual(summary.bySurface.map((entry) => [entry.surface, entry.requests]), [['agent_offers', 60], ['agent_card', 40]])
  assert.equal(summary.bySurface[1].path, '/.well-known/agent.json')
  assert.equal(summary.byClientClass.every((entry) => entry.requests > 0), true)
})

test('an empty period reports no share rather than a false zero', () => {
  const summary = aggregateAgentDiscovery([])
  assert.equal(summary.requests, 0)
  assert.equal(summary.machineShare, null)
  assert.deepEqual(summary.bySurface, [])
})
