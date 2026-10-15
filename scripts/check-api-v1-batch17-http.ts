import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SEVENTEENTH_BATCH } from '../lib/api-v1/batch50.ts'
import { REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { SEVENTEENTH_BATCH_SAMPLES } from '../lib/api-v1/batch17-audits.ts'
import { decodeChallenge } from '../lib/x402/client.ts'

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8834')
// Never probe a production server, nor follow a redirect to one.
if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.pathname !== '/' || origin.search || origin.username || origin.password) throw Error('loopback_origin_required')
const out = resolve(process.argv[3] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch17-2026-10-15')
await mkdir(out, { recursive: true })
const request = (path: string, init?: RequestInit) => fetch(new URL(path, origin), { ...init, redirect: 'error', signal: AbortSignal.timeout(90000) })
const results = []
for (const e of SEVENTEENTH_BATCH) {
  const response = await request(e.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(SEVENTEENTH_BATCH_SAMPLES[e.id]) })
  assert.equal(response.status, 402, e.id)
  const headerLineBytes = Buffer.byteLength(response.headers.get('PAYMENT-REQUIRED')!, 'ascii') + 20
  assert.ok(headerLineBytes <= 8000, 'seller_header_over_budget:' + e.id)
  const quote = decodeChallenge(response.headers.get('PAYMENT-REQUIRED')!), body = await response.json()
  assert.equal(quote.resource.url, 'https://www.mahastrategies.com' + e.path)
  assert.equal(quote.accepts.length, 1); assert.equal(quote.accepts[0].amount, e.amount)
  assert.equal(quote.accepts[0].network, 'eip155:8453')
  assert.equal(quote.accepts[0].asset.toLowerCase(), '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
  assert.equal(quote.accepts[0].payTo.toLowerCase(), '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28')
  assert.equal(body.price, e.price_usdc); assert.equal(body.auth_standard, 'EIP-3009')
  assert.ok(!response.headers.has('PAYMENT-RESPONSE')); assert.equal(response.headers.get('cache-control'), 'no-store')
  const discovery = await request('/api/v1/discovery/search?q=' + encodeURIComponent(e.id) + '&domain=' + encodeURIComponent(e.domain) + '&limit=10')
  assert.equal(discovery.status, 200)
  const search = await discovery.json()
  const match = search.matches.find((item: { id: string }) => item.id === e.id)
  assert.ok(match, 'discovery missing: ' + e.id)
  assert.deepEqual(match.schema, e.schema); assert.deepEqual(match.pricing, e.pricing); assert.deepEqual(match.execution_cost, e.execution_cost); assert.equal(match.paymentEnabled, false)
  assert.ok(search.matches.length <= 10)
  results.push({ id: e.id, path: e.path, quoteStatus: response.status, amount: quote.accepts[0].amount, headerLineBytes, discoverySchemaMatched: true, productionEnabled: false })
}
const discoveryResponse = await request('/api/v1/discovery/search'), discovery = await discoveryResponse.json()
assert.equal(discoveryResponse.status, 200); assert.equal(discovery.totalMatches, REGISTRY_SUMMARY.localImplemented); assert.equal(discovery.matches.length, 5)
assert.equal((await request('/api/v1/discovery/search?limit=11')).status, 400)
const gated = await request(SEVENTEENTH_BATCH[0].path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': 'unfunded-local-fixture-not-an-authorization' }, body: '{}' })
assert.equal(gated.status, 503); assert.equal((await gated.json()).error.code, 'explicit_local_simulator_required_no_payment')
const proof = { checkedAt: new Date().toISOString(), loopbackOnly: true, framework: 'actual Next.js development HTTP server',
  unsignedQuotes: results.length, discoverySchemaChecks: results.length, cumulativeDiscoverable: discovery.totalMatches,
  discoveryLimitEnforced: true, defaultSignedRequestsBlockedWithoutSimulator: true, sellerHeaderBudgetChecked: true, maximumHeaderLineBytes: Math.max(...results.map(r => r.headerLineBytes)), results,
  boundaries: ['Unsigned challenges and discovery only; paid delivery is tested with explicit local simulators in the separate unit/integration suite.',
    'No assertion of production deployment, Bazaar indexing or mainnet delivery.'],
  safety: { payments: 0, indexingCalls: 0, deployments: 0, hostedMigrations: 0 },
}
await writeFile(resolve(out, 'http-verification.json'), JSON.stringify(proof, null, 2) + '\n')
console.log(JSON.stringify({ out, unsignedQuotes: results.length, discoverySchemaChecks: results.length, cumulativeDiscoverable: discovery.totalMatches, safety: proof.safety }))
