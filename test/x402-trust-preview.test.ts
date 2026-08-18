import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import denyFixture from '../content/integrations/x402-trust/action-deny.json' with { type: 'json' }
import proceedFixture from '../content/integrations/x402-trust/action-proceed.json' with { type: 'json' }
import reviewFixture from '../content/integrations/x402-trust/action-review.json' with { type: 'json' }
import fixtureManifest from '../content/integrations/x402-trust/manifest.json' with { type: 'json' }
import {
  evaluateX402TrustPreview,
  fetchAndEvaluateX402TrustPreview,
  X402_TRUST_PREVIEW_ENDPOINT,
  X402_TRUST_PREVIEW_SCHEMA_SHA256,
  X402_TRUST_PREVIEW_SCHEMA_URL,
  X402_TRUST_REPORT_SCHEMA_URL,
} from '../lib/x402/trust-preview.ts'

const NOW = new Date('2026-08-18T12:00:00.000Z')
const PROBED_AT = NOW.getTime() - 30_000

function report(overrides: Record<string, unknown> = {}) {
  return {
    $schema: X402_TRUST_REPORT_SCHEMA_URL, schemaVersion: '1.0.0', schemaType: 'x402-trust',
    resource: 'https://merchant.example/api/report', serviceName: 'Merchant', description: 'PRIVATE DESCRIPTION MUST NOT BE RETAINED',
    generatedAt: NOW.getTime() - 20_000, freshness: { live: true, probedAtTs: PROBED_AT, ageSeconds: 30, liveProbeMs: 120 },
    score: 88, grade: 'A', scoreRange: { low: 82, point: 88, high: 92 }, recommendation: 'proceed', templated: false,
    gradeThresholds: { A: 80, B: 65, C: 50, D: 35, F: 0 }, confidence: 0.9,
    confidenceDetail: { overall: 0.9, observation: 0.85, economic: 0.95 },
    breakdown: { uptime: 0.99, compliance: 0.98, latency: 0.8, age: 0.9, activity: 0.7, stability: 1 },
    subscores: { technicalReliabilityScore: 90, specComplianceScore: 91, economicReputationScore: 80, economicConfidence: 0.95 },
    explanations: ['PRIVATE EXPLANATION MUST NOT BE RETAINED'], flags: [], flagsDetailed: [],
    advertised: { amount: '1000', amountUsd: 0.001, asset: '0xasset', network: 'eip155:8453', decimals: 6, observedAtTs: PROBED_AT },
    dataCompleteSince: NOW.getTime() - 86_400_000,
    stats: {
      firstSeenTs: NOW.getTime() - 86_400_000, observedDays: 30, probes30d: 20, probeOk30d: 19, excluded30d: 0,
      scoredProbes30d: 20, envelopeValid30d: 19, avgLatencyMs: 120, latencyVantage: 'test', priceChanges30d: 0,
      payTo: '0xpayee', payToLastSeenTs: PROBED_AT, payToStale: false, payToSharedWith: 0,
      settlements30d: 4, distinctPayers30d: 2, settledVolumeUnits30d: '4000', settledVolumeUsd30d: 0.004,
      settlementAsset: 'USDC', settlementDecimals: 6, delisted: false,
    },
    ...overrides,
  }
}

function preview(reportOverrides: Record<string, unknown> = {}, rootOverrides: Record<string, unknown> = {}) {
  return {
    $schema: X402_TRUST_PREVIEW_SCHEMA_URL, schemaVersion: '1.0.0', schemaType: 'x402-trust-preview', preview: true,
    note: 'Free sample only', populationSize: 100, sampled: 1, samples: [{ role: 'median', report: report(reportOverrides) }],
    paidEndpoint: { endpoint: 'POST /v1/x402-trust', priceUsd: 0.005, note: 'Paid endpoint is not called by this adapter.' },
    mcp: 'not used', ...rootOverrides,
  }
}

test('pins the reviewed provider schema and emits advisory metadata-only evidence', () => {
  assert.match(X402_TRUST_PREVIEW_SCHEMA_SHA256, /^sha256:[a-f0-9]{64}$/)
  const result = evaluateX402TrustPreview(JSON.stringify(preview()), { role: 'median', now: NOW })
  assert.equal(result.ok, true)
  assert.equal(result.evidence.decision.outcome, 'proceed')
  assert.equal(result.evidence.decision.advisoryOnly, true)
  assert.equal(result.evidence.decision.paymentAuthorized, false)
  assert.equal(result.evidence.retention.rawResponseRetained, false)
  const serialized = JSON.stringify(result.evidence)
  assert.equal(serialized.includes('PRIVATE DESCRIPTION'), false)
  assert.equal(serialized.includes('PRIVATE EXPLANATION'), false)
  assert.match(result.evidence.source.transportBytesSha256 ?? '', /^sha256:[a-f0-9]{64}$/)
})

test('fails closed at schema validation when a nested report omits its declared identity', () => {
  const fixture = preview()
  delete (fixture.samples[0].report as Record<string, unknown>).$schema
  delete (fixture.samples[0].report as Record<string, unknown>).schemaVersion
  delete (fixture.samples[0].report as Record<string, unknown>).schemaType
  const result = evaluateX402TrustPreview(JSON.stringify(fixture), { now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.validation.schemaValid, false)
  assert.equal(result.evidence.decision.outcome, 'deny')
  assert.deepEqual(result.evidence.decision.reasonCodes, ['trust_contract_invalid'])
  assert.ok(result.validation.errors.some((error) => error.includes("must have required property '$schema'")))
})

test('rejects unsupported top-level versions before interpreting trust fields', () => {
  const result = evaluateX402TrustPreview(JSON.stringify(preview({}, { schemaVersion: '2.0.0' })), { now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.validation.schemaValid, false)
  assert.equal(result.evidence.observation.recommendation, null)
})

test('adds semantic bounds that the provider schema does not express', () => {
  const result = evaluateX402TrustPreview(JSON.stringify(preview({ confidence: 4, confidenceDetail: { overall: 4, observation: 0.8, economic: 0.9 } })), { now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.validation.schemaValid, true)
  assert.equal(result.validation.semanticValid, false)
  assert.ok(result.validation.errors.some((error) => error.includes('confidence values')))
})

test('rejects a probe timestamp that postdates report generation', () => {
  const result = evaluateX402TrustPreview(JSON.stringify(preview({ generatedAt: PROBED_AT - 120_000 })), { now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.validation.schemaValid, true)
  assert.ok(result.validation.errors.some((error) => error.includes('cannot postdate report generation')))
})

test('denies stale, thin, or adverse evidence without converting it into payment authority', () => {
  const result = evaluateX402TrustPreview(JSON.stringify(preview({
    freshness: { live: false, probedAtTs: NOW.getTime() - 600_000, ageSeconds: 600 }, score: 70,
    scoreRange: { low: 45, point: 70, high: 80 }, recommendation: 'avoid', confidence: 0.4,
    confidenceDetail: { overall: 0.4, observation: 0.3, economic: 0.5 },
  })), { now: NOW })
  assert.equal(result.ok, true)
  assert.equal(result.evidence.decision.outcome, 'deny')
  assert.deepEqual(result.evidence.decision.reasonCodes, [
    'trust_evidence_stale', 'trust_confidence_below_floor', 'trust_score_floor_not_met', 'provider_recommendation_avoid',
  ])
  assert.equal(result.evidence.decision.paymentAuthorized, false)
})

test('maps caution to human review when evidence floors otherwise pass', () => {
  const result = evaluateX402TrustPreview(JSON.stringify(preview({ recommendation: 'caution' })), { now: NOW })
  assert.equal(result.ok, true)
  assert.equal(result.evidence.decision.outcome, 'require_review')
  assert.deepEqual(result.evidence.decision.reasonCodes, ['provider_recommendation_caution'])
})

test('three frozen action fixtures reproduce their reviewed orchestration boundary', async () => {
  const fixtures = [proceedFixture, reviewFixture, denyFixture]
  assert.equal(fixtureManifest.fixtures.length, 3)
  assert.deepEqual(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 3)

  for (const manifestEntry of fixtureManifest.fixtures) {
    const bytes = await readFile(new URL(`../content/integrations/x402-trust/${manifestEntry.file}`, import.meta.url))
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, manifestEntry.sha256)
  }

  for (const fixture of fixtures) {
    const result = evaluateX402TrustPreview(JSON.stringify(fixture.input), {
      role: fixture.sampleRole as 'best' | 'median' | 'worst',
      policy: fixture.policy,
      now: new Date(fixture.frozenAt),
    })
    assert.equal(result.ok, true, fixture.fixtureId)
    assert.equal(result.validation.schemaValid, fixture.expected.schemaValid, fixture.fixtureId)
    assert.equal(result.validation.semanticValid, fixture.expected.semanticValid, fixture.fixtureId)
    assert.equal(result.evidence.decision.outcome, fixture.expected.outcome, fixture.fixtureId)
    assert.equal(result.evidence.decision.nextAction, fixture.expected.nextAction, fixture.fixtureId)
    assert.deepEqual(result.evidence.decision.reasonCodes, fixture.expected.reasonCodes, fixture.fixtureId)
    assert.equal(result.evidence.decision.advisoryOnly, fixture.expected.advisoryOnly, fixture.fixtureId)
    assert.equal(result.evidence.decision.paymentAuthorized, fixture.expected.paymentAuthorized, fixture.fixtureId)
  }
})

test('fetches only the fixed free preview endpoint and never follows a redirect to a paid surface', async () => {
  const calls: Array<{ url: string; method: string | undefined; redirect: RequestRedirect | undefined }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method, redirect: init?.redirect })
    return new Response(JSON.stringify(preview()), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const result = await fetchAndEvaluateX402TrustPreview({ fetchImpl, now: NOW })
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [{ url: X402_TRUST_PREVIEW_ENDPOINT, method: 'GET', redirect: 'error' }])
})

test('turns non-JSON, oversized, and unavailable responses into advisory deny evidence', async () => {
  const nonJson = await fetchAndEvaluateX402TrustPreview({
    fetchImpl: async () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }), now: NOW,
  })
  assert.equal(nonJson.ok, false)
  assert.match(nonJson.validation.errors[0], /Content-Type is not JSON/)
  assert.deepEqual(nonJson.evidence.decision.reasonCodes, ['trust_evidence_unavailable'])
  assert.equal(nonJson.evidence.source.transportBytesSha256, null)

  const oversized = await fetchAndEvaluateX402TrustPreview({
    fetchImpl: async () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(600_000) } }), now: NOW,
  })
  assert.match(oversized.validation.errors[0], /exceeds the byte ceiling/)

  const unavailable = await fetchAndEvaluateX402TrustPreview({ fetchImpl: async () => { throw new Error('offline') }, now: NOW })
  assert.equal(unavailable.evidence.decision.outcome, 'deny')
  assert.deepEqual(unavailable.validation.errors, ['transport: offline'])
})
