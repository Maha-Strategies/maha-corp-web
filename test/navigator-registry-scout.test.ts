import assert from 'node:assert/strict'
import test from 'node:test'

import { NAVIGATOR_CLAIM_TYPES } from '../lib/maha-navigator-research.ts'
import { recommendationFromRegistry } from '../lib/navigator-registry-recommendations.ts'
import { dedupeRegistryRecords, runNavigatorRegistryScout, type NavigatorDraftSubmitter } from '../lib/navigator-registry-runner.ts'
import {
  configuredNavigatorRegistrySources,
  parseA2ACardRecord,
  parseBazaarRecords,
  parseMcpRecords,
  parsePayanRecords,
  type NavigatorRegistryRecord,
  type NavigatorRegistrySource,
} from '../lib/navigator-registry-sources.ts'

const observed = new Date('2026-08-11T12:00:00.000Z')

function record(overrides: Partial<NavigatorRegistryRecord> = {}): NavigatorRegistryRecord {
  return {
    registry: 'bazaar', listingId: 'bazaar:abc', evidenceUrl: 'https://catalog.example.com/resource/1',
    companyName: 'Example Agent Platform', companyDomain: 'example.com', description: 'Agent payment and tool execution service.',
    capabilities: ['Agent payment and tool execution'], sourcePublishedOn: '2026-08-10', observedOn: '2026-08-11', ...overrides,
  }
}

test('Bazaar records preserve the live resource, description, and update date', () => {
  const rows = parseBazaarRecords({ resources: [{ resource: 'https://agent.example.com/x402/run', description: 'Paid agent execution', lastUpdated: '2026-08-10T05:00:00Z' }] }, 'agent payments', observed)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].registry, 'bazaar')
  assert.equal(rows[0].companyDomain, 'agent.example.com')
  assert.equal(rows[0].sourcePublishedOn, '2026-08-10')
  assert.equal(rows[0].evidenceUrl, 'https://agent.example.com/x402/run')
})

test('official MCP Registry records use the declared remote and registry evidence URL', () => {
  const rows = parseMcpRecords({ servers: [{
    server: { name: 'com.example/mcp', title: 'Example MCP', description: 'Enterprise MCP tools', remotes: [{ type: 'streamable-http', url: 'https://mcp.example.com/rpc' }] },
    _meta: { 'io.modelcontextprotocol.registry/official': { updatedAt: '2026-08-09T10:00:00Z' } },
  }] }, 'MCP security', observed)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].companyName, 'Example MCP')
  assert.equal(rows[0].companyDomain, 'mcp.example.com')
  assert.match(rows[0].evidenceUrl, /^https:\/\/registry\.modelcontextprotocol\.io\/v0\.1\/servers\?search=/)
})

test('PayanAgent uses public offer detail and drops offers with no attributable external domain', () => {
  const rows = parsePayanRecords({ offers: [
    { _id: 'offer-1', title: 'Governed agent API', description: 'Call https://api.vendor.example/run', sourceLastUpdated: '2026-08-08T00:00:00Z' },
    { _id: 'offer-2', title: 'Generic prompt', description: 'No attributable provider endpoint.' },
  ] }, 'agent governance', observed)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].companyDomain, 'api.vendor.example')
  assert.equal(rows[0].evidenceUrl, 'https://payanagent.com/api/v1/offers/offer-1')
})

test('public A2A cards become source-linked candidate records', () => {
  const row = parseA2ACardRecord({
    name: 'Example A2A', description: 'Coordinates governed infrastructure tasks.', url: 'https://agent.example.com/rpc', protocolVersion: '0.3.0',
    skills: [{ id: 'assess', name: 'Assess deployment', description: 'Checks an agent deployment.' }],
  }, 'https://agent.example.com/.well-known/agent-card.json', observed, 'Mon, 10 Aug 2026 12:00:00 GMT')
  assert.equal(row.registry, 'a2a')
  assert.equal(row.companyDomain, 'agent.example.com')
  assert.deepEqual(row.capabilities, ['Assess deployment: Checks an agent deployment.'])
  assert.equal(row.sourcePublishedOn, '2026-08-10')
})

test('registry recommendations are conservative four-claim drafts with no contact fields', () => {
  const candidate = recommendationFromRegistry(record())
  assert.deepEqual(candidate.claims.map((claim) => claim.type), NAVIGATOR_CLAIM_TYPES)
  assert.match(candidate.claims.find((claim) => claim.type === 'buying_trigger')!.statement, /not evidence.*intends to buy/i)
  assert.match(candidate.claims.find((claim) => claim.type === 'likely_owner')!.statement, /hypothesis only/i)
  assert.match(candidate.claims.find((claim) => claim.type === 'disqualifier')!.statement, /not contact permission/i)
  assert.ok(candidate.claims.every((claim) => claim.sourceQuality === 'credible_secondary'))
  const serialized = JSON.stringify(candidate)
  for (const forbidden of ['recipient', 'emailAddress', 'messageBody']) assert.equal(serialized.includes(forbidden), false)
})

test('deduplication treats a company as one review target across registries', () => {
  const unique = dedupeRegistryRecords([
    record({ registry: 'bazaar', listingId: 'one' }),
    record({ registry: 'mcp', listingId: 'two' }),
    record({ companyDomain: 'other.example', listingId: 'three' }),
  ])
  assert.equal(unique.length, 2)
  assert.equal(unique[0].registry, 'bazaar')
})

test('the runner creates drafts only and retains explicit no-email authority', async () => {
  const source: NavigatorRegistrySource = { id: 'bazaar', read: async () => [record(), record({ listingId: 'duplicate', registry: 'mcp' })] }
  const submitted: Record<string, unknown>[] = []
  const submit: NavigatorDraftSubmitter = async (candidate) => { submitted.push(candidate); return { ok: true, status: 201, idempotentReplay: false } }
  const summary = await runNavigatorRegistryScout({ fetchImpl: (() => { throw new Error('unused') }) as typeof fetch, submit, sources: [source], runId: 'run-1' })
  assert.equal(summary.discovered, 2)
  assert.equal(summary.uniqueCompanies, 1)
  assert.equal(summary.draftsCreated, 1)
  assert.equal(summary.emailAuthorized, false)
  assert.equal(summary.outreachAuthorized, false)
  assert.equal(submitted[0].action, 'create_candidate')
  for (const forbidden of ['to', 'email', 'recipient', 'message', 'send', 'amount']) assert.ok(!(forbidden in submitted[0]), `draft must not contain ${forbidden}`)
})

test('registry configuration connects all four sources and bounds explicit A2A cards', () => {
  const sources = configuredNavigatorRegistrySources({
    NAVIGATOR_REGISTRY_SOURCES: 'bazaar,payan,mcp,a2a',
    NAVIGATOR_REGISTRY_QUERIES: '["agent governance"]',
    NAVIGATOR_A2A_CARD_URLS: '["https://agent.example.com/.well-known/agent-card.json"]',
  })
  assert.deepEqual(sources.map((source) => source.id), ['bazaar', 'payan', 'mcp', 'a2a'])
  assert.throws(() => configuredNavigatorRegistrySources({ NAVIGATOR_REGISTRY_SOURCES: 'email' }), /unsupported registry/)
  assert.throws(() => configuredNavigatorRegistrySources({ NAVIGATOR_REGISTRY_SOURCES: 'a2a', NAVIGATOR_A2A_CARD_URLS: '["http://localhost/card"]' }), /public HTTPS URLs/)
})
