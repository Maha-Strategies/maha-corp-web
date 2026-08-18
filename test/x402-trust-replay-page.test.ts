import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import canonicalize from 'canonicalize'

import { GET, dynamicParams, generateStaticParams } from '../app/api/x402-trust/replay/[decision]/route.ts'
import { POST as recordTelemetry } from '../app/api/x402-trust/telemetry/route.ts'
import { parseX402TrustDemoEvent, x402TrustDemoEventHash } from '../lib/x402/trust-demo-telemetry.ts'
import { getPublicX402TrustEvidence, getPublicX402TrustReplays } from '../lib/x402/trust-replay.ts'

test('the public replay exposes exactly three frozen deterministic actions', () => {
  const replays = getPublicX402TrustReplays()
  assert.equal(replays.length, 3)
  assert.deepEqual(replays.map((replay) => replay.result.nextAction), [
    'continue_to_buyer_policy', 'request_human_review', 'stop',
  ])
  assert.deepEqual(replays.map((replay) => replay.result.outcome), ['proceed', 'require_review', 'deny'])
  for (const replay of replays) {
    assert.equal(replay.schemaValid, true)
    assert.equal(replay.semanticValid, true)
    assert.equal(replay.result.advisoryOnly, true)
    assert.equal(replay.result.paymentAuthorized, false)
    assert.match(replay.fixtureSha256, /^sha256:[a-f0-9]{64}$/)
    assert.match(replay.result.replayedInputSha256, /^sha256:[a-f0-9]{64}$/)
  }
})

test('the public replay DTO retains no report prose or paid-endpoint instructions', () => {
  const serialized = JSON.stringify(getPublicX402TrustReplays())
  assert.doesNotMatch(serialized, /description|explanations|flagsDetailed|paidEndpoint|serviceName/)
  assert.doesNotMatch(serialized, /private key|credential|payment signature/i)
})

test('each decision produces digest-bound metadata-only downloadable evidence', () => {
  for (const id of ['proceed', 'review', 'deny']) {
    const download = getPublicX402TrustEvidence(id)
    assert.ok(download)
    const canonical = canonicalize(download.evidence)
    assert.ok(canonical)
    assert.equal(download.evidenceSha256, `sha256:${createHash('sha256').update(canonical).digest('hex')}`)
    assert.equal(download.evidence.decision.paymentAuthorized, false)
    assert.deepEqual(download.evidence.retention, {
      rawReportRetained: false, reportProseRetained: false, credentialsRetained: false, paymentMaterialRetained: false,
    })
    const serialized = JSON.stringify(download)
    assert.doesNotMatch(serialized, /description|explanations|flagsDetailed|paidEndpoint|serviceName/)
    assert.match(serialized, /not authorize a payment/)
  }
  assert.equal(getPublicX402TrustEvidence('unknown'), null)
})

test('the evidence route is an attachment with immutable caching and a matching digest header', async () => {
  assert.equal(dynamicParams, false)
  assert.deepEqual(generateStaticParams(), [{ decision: 'proceed' }, { decision: 'review' }, { decision: 'deny' }])
  const response = await GET(new Request('https://www.mahastrategies.com/api/x402-trust/replay/proceed'), { params: Promise.resolve({ decision: 'proceed' }) })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="maha-x402-trust-proceed-evidence-v1.json"')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  const body = await response.json()
  assert.equal(response.headers.get('x-maha-evidence-sha256'), body.evidenceSha256)
  assert.equal(body.evidence.fixture.synthetic, true)

  const missing = await GET(new Request('https://www.mahastrategies.com/api/x402-trust/replay/unknown'), { params: Promise.resolve({ decision: 'unknown' }) })
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get('cache-control'), 'no-store')
})

test('the public replay remains read-only while a client island records only four coarse events', async () => {
  const [page, telemetry] = await Promise.all([
    readFile(new URL('../app/x402-trust/replay/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/x402-trust/replay/X402TrustTelemetry.tsx', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(page, /['"]use client['"]|\bfetch\s*\(|<form|\baction\s*=\s*\{/)
  assert.match(page, /No live fetch, arbitrary URL, form submission, task creation, signature, or settlement occurs/)
  assert.match(page, /paymentAuthorized/)
  assert.match(page, /Download metadata-only evidence/)
  assert.match(page, /Request a bounded integration/)
  for (const event of ['demo_started', 'scenario_completed', 'evidence_downloaded', 'integration_requested']) assert.match(telemetry, new RegExp(event))
  assert.doesNotMatch(telemetry, /localStorage|sessionStorage|document\.cookie|document\.referrer|userAgent/)
  assert.match(telemetry, /credentials: 'omit'/)
})

test('minimal telemetry accepts only the closed event and scenario vocabulary', () => {
  const id = 'x402trust_12345678-1234-1234-1234-123456789abc'
  assert.deepEqual(parseX402TrustDemoEvent({ eventId: id, eventType: 'demo_started', scenarioId: null }), { eventId: id, eventType: 'demo_started', scenarioId: null })
  assert.deepEqual(parseX402TrustDemoEvent({ eventId: id, eventType: 'scenario_completed', scenarioId: 'review' }), { eventId: id, eventType: 'scenario_completed', scenarioId: 'review' })
  assert.throws(() => parseX402TrustDemoEvent({ eventId: id, eventType: 'scenario_completed', scenarioId: null }), /required/)
  assert.throws(() => parseX402TrustDemoEvent({ eventId: id, eventType: 'demo_started', scenarioId: 'proceed' }), /not allowed/)
  assert.throws(() => parseX402TrustDemoEvent({ eventId: id, eventType: 'unknown', scenarioId: null }), /eventType/)
  assert.throws(() => parseX402TrustDemoEvent({ eventId: id, eventType: 'demo_started', scenarioId: null, report: 'private' }), /unsupported fields/)
  assert.match(x402TrustDemoEventHash(id), /^sha256:[a-f0-9]{64}$/)
})

test('the telemetry endpoint fails closed before storage on malformed events', async () => {
  const response = await recordTelemetry(new Request('https://www.mahastrategies.com/api/x402-trust/telemetry', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'demo_started' }),
  }))
  assert.equal(response.status, 400)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('the telemetry migration retains no visitor, report, evidence, credential, wallet, or payment fields', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260818000100_x402_trust_demo_telemetry.sql', import.meta.url), 'utf8')
  for (const column of ['ip_address', 'user_agent', 'referrer', 'visitor_id', 'report_body', 'evidence_body', 'credential', 'wallet_address', 'payment_material']) {
    assert.doesNotMatch(migration, new RegExp(`\\b${column}\\s+text\\b`), `must not define ${column}`)
  }
  for (const event of ['demo_started', 'scenario_completed', 'evidence_downloaded', 'integration_requested']) assert.match(migration, new RegExp(event))
  assert.match(migration, /enable row level security/)
})

test('the replay is linked from public navigation and the sitemap', async () => {
  const [tools, buyerPolicy, sitemap] = await Promise.all([
    readFile(new URL('../app/tools/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/x402-buyer-policy/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [tools, buyerPolicy, sitemap]) assert.match(source, /\/x402-trust\/replay/)
})
