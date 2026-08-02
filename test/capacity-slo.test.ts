import assert from 'node:assert/strict'
import test from 'node:test'

import { capacityConfiguration, capacityFailures, capacityReport, capacityScenarios, percentile } from '../lib/capacity-slo.ts'

test('capacity configuration rejects accidental Production and unconfirmed credit-consuming tests', () => {
  assert.throws(() => capacityConfiguration({ CAPACITY_BASE_URL: 'https://www.mahastrategies.com' }), /Production capacity tests require/)
  assert.throws(() => capacityConfiguration({ CAPACITY_BASE_URL: 'https://preview.example.test/path' }), /must be an origin/)
  assert.throws(() => capacityConfiguration({ CAPACITY_BASE_URL: 'https://preview.example.test', CAPACITY_PROFILE: 'mcp' }), /CREDIT_CONFIRMATION/)
  const safe = capacityConfiguration({ CAPACITY_BASE_URL: 'https://preview.example.test', CAPACITY_PROFILE: 'public', CAPACITY_REQUESTS_PER_SCENARIO: '20', CAPACITY_CONCURRENCY: '2' })
  assert.equal(safe.production, false)
  assert.equal(safe.requestsPerScenario, 20)
})

test('capacity scenarios keep secrets in headers and require a bounded MCP server ID', () => {
  const environment = { CAPACITY_RELEASE_HEALTH_TOKEN: 'release-secret', CAPACITY_API_KEY: 'api-secret' }
  const control = capacityScenarios(environment, 'control-plane')
  assert.deepEqual(control.map(({ name }) => name), ['homepage', 'openapi', 'billing-readiness', 'observability-readiness', 'upstash-balance'])
  assert.ok(!JSON.stringify(control.map(({ name, path }) => ({ name, path }))).includes('secret'))
  assert.throws(() => capacityScenarios({ ...environment, CAPACITY_MCP_SERVER_ID: 'bad' }, 'mcp'), /invalid/)
})

test('capacity reports use nearest-rank percentiles and fail closed on SLO breaches', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40)
  const report = capacityReport({ scenario: { name: 'test', path: '/', method: 'GET' }, latencies: [10, 20, 30, 40], statuses: [200, 200, 200, 503], elapsedMs: 1_000 })
  assert.equal(report.successRate, 0.75)
  assert.equal(report.latencyMs.p50, 20)
  assert.deepEqual(report.statuses, { 200: 3, 503: 1 })
  assert.deepEqual(capacityFailures([report], { minSuccessRate: 0.99, maxP95Ms: 35, maxP99Ms: 100 }), ['test: success rate 0.75 is below 0.99', 'test: p95 40ms exceeds 35ms'])
})
