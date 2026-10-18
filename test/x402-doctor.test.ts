import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { discoveryExtensionsFor } from '../lib/x402/discovery.ts'
import { diagnoseX402Endpoint, doctorReportToSarif, comparableDeclarations } from '../lib/x402/doctor.ts'
import { createDeclarationDigestExtension } from '../lib/x402/declaration-digest.ts'
import type { PaymentChallenge, PaymentRequirement } from '../lib/x402/client.ts'
import { parseDoctorArgs } from '../scripts/x402-doctor.ts'

const endpoint = 'https://seller.example/api/compress'
const description = 'Compress source documents into a bounded context pack.'
const requirement: PaymentRequirement = {
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000',
  payTo: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28',
  maxTimeoutSeconds: 60,
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  extra: { name: 'USD Coin', version: '2' },
}
const extensions = await discoveryExtensionsFor({
  offerId: 'context-compression',
  method: 'POST' as const,
  path: '/api/v1/compress',
  amount: '1000',
  description,
  concurrencyCap: 8,
}, endpoint)
const challenge: PaymentChallenge = {
  x402Version: 2,
  resource: { url: endpoint, description, mimeType: 'application/json' },
  accepts: [requirement],
  extensions,
  error: 'Payment required.',
}

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64')
}

function challengeResponse(status = 402, value = challenge): Response {
  return new Response(JSON.stringify({ error: 'payment_required' }), {
    status,
    headers: { 'content-type': 'application/json', 'PAYMENT-REQUIRED': encoded(value) },
  })
}

function bazaarRecord(overrides: Record<string, unknown> = {}) {
  return {
    resource: endpoint,
    description,
    mimeType: 'application/json',
    accepts: [requirement],
    extensions,
    lastUpdated: '2026-08-08T00:00:00.000Z',
    ...overrides,
  }
}

function merchantResponse(resources: Record<string, unknown>[], total = resources.length, offset = 0, payTo = requirement.payTo) {
  return Response.json({ payTo, resources, pagination: { total, offset } })
}

function fetchSequence(responses: Response[]): typeof fetch {
  return (async () => {
    const response = responses.shift()
    // Existing scenarios focus on the declared resource. The doctor now adds
    // a same-host impossible-path control; a normal 404 is its safe default.
    return response ?? new Response(null, { status: 404 })
  }) as typeof fetch
}

test('the public live-adapter artifact is explicit about its synthetic boundary and exercises its declared verdicts', async () => {
  const artifact = JSON.parse(await readFile(new URL('../public/conformance/x402-v2/x402-doctor-live-adapter-results.json', import.meta.url), 'utf8')) as {
    $schema: string
    subject: { tool: string; toolVersion: string; mode: string; networkCalls: boolean }
    assertionBoundary: { evaluated: string[]; notEvaluated: string[] }
    results: Array<{ id: string; routeExistence: string; discoveryEligibility: string; clientInterop: { consumer: string; strength: string; outcome: string } }>
  }

  assert.match(artifact.$schema, /x402-doctor-live-adapter-results\.schema\.json$/)
  assert.equal(artifact.subject.tool, 'x402-doctor')
  assert.equal(artifact.subject.toolVersion, '0.1.0')
  assert.equal(artifact.subject.mode, 'synthetic_live_adapter')
  assert.equal(artifact.subject.networkCalls, false)
  assert.equal(artifact.assertionBoundary.notEvaluated.some((item) => item.includes('Live registry indexing')), true)
  assert.deepEqual([...new Set(artifact.results.map((result) => result.routeExistence))].sort(), ['absent', 'confirmed', 'uninformative'])
  assert.equal(artifact.results.some((result) => result.discoveryEligibility === 'not_eligible'), true)
  assert.equal(artifact.results.some((result) => result.clientInterop.strength === 'parse' && result.clientInterop.outcome === 'fail'), true)
  assert.equal(artifact.results.some((result) => result.clientInterop.strength === 'not_evaluated' && result.clientInterop.outcome === 'not_evaluated'), true)
})

test('validates the live challenge, crawler request, and current Bazaar record', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(),
      merchantResponse([bazaarRecord()]),
    ]),
  })

  assert.equal(report.ok, true)
  assert.equal(report.live?.crawlerStatus, 402)
  assert.equal(report.live?.routeExistence?.verdict, 'confirmed')
  assert.equal(report.bazaar?.found, true)
  assert.equal(report.bazaar?.matchesLive, true)
  assert.equal(report.bazaar?.catalogueComplete, true)
  assert.equal(report.bazaar?.observedResources, 1)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.extensions.responses'), true)
})

function paginatedDoctorFetch(rows: Record<string, unknown>[], mutate?: (body: Record<string, unknown>, offset: number) => unknown) {
  const offsets: number[] = []
  const fetchImpl = (async (url, init) => {
    const parsed = new URL(String(url))
    if (parsed.pathname.endsWith('/merchant')) {
      assert.equal(parsed.searchParams.get('payTo'), requirement.payTo)
      assert.equal(parsed.searchParams.get('limit'), '100')
      assert.equal(init?.redirect, 'error')
      assert.ok(init?.signal)
      const offset = Number(parsed.searchParams.get('offset'))
      offsets.push(offset)
      const body = { payTo: requirement.payTo, resources: rows.slice(offset, offset + 100), pagination: { total: rows.length, offset } }
      return Response.json(mutate ? mutate(body, offset) : body)
    }
    assert.equal(new Headers(init?.headers).has('PAYMENT-SIGNATURE'), false)
    if (parsed.pathname.startsWith('/.well-known/x402-doctor-route-control-')) return new Response(null, { status: 404 })
    return challengeResponse()
  }) as typeof fetch
  return { fetchImpl, offsets }
}

function otherRecords(count: number) {
  return Array.from({ length: count }, (_, i) => bazaarRecord({ resource: `https://seller.example/api/other-${i}` }))
}

test('network expansion explains but never suppresses an exact integrity mismatch', async () => {
  const polygon = { ...requirement, network:'eip155:137', asset:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' }
  const oldIntegrity = await createDeclarationDigestExtension(challenge, '2026-10-18')
  const live: PaymentChallenge = { ...challenge, accepts:[requirement,polygon],extensions:{...extensions} }
  live.extensions!['declaration-integrity'] = await createDeclarationDigestExtension(live,'2026-10-18')
  const report = await diagnoseX402Endpoint({endpoint,fetchImpl:fetchSequence([
    challengeResponse(402,live),challengeResponse(402,live),
    merchantResponse([bazaarRecord({extensions:{...extensions,'declaration-integrity':oldIntegrity}})]),
  ])})
  assert.equal(report.bazaar?.matchesLive,false)
  assert.equal(report.bazaar?.comparison?.paymentOptions,'expanded')
  assert.ok(report.findings.some(f=>f.ruleId==='x402.bazaar.stale_metadata'&&f.level==='warning'))
  assert.ok(report.findings.find(f=>f.ruleId==='x402.bazaar.stale_metadata')?.detail?.includes('automaticPayment=false'))
})

for (const count of [101, 452, 1000]) {
  test(`finds the target on the last page of a complete ${count}-listing merchant catalogue`, async () => {
    const { fetchImpl, offsets } = paginatedDoctorFetch([...otherRecords(count - 1), bazaarRecord()])
    const report = await diagnoseX402Endpoint({ endpoint, fetchImpl })
    assert.equal(report.ok, true)
    assert.equal(report.bazaar?.found, true)
    assert.equal(report.bazaar?.matchesLive, true)
    assert.equal(report.bazaar?.catalogueComplete, true)
    assert.equal(report.bazaar?.observedResources, count)
    assert.deepEqual(offsets, Array.from({ length: Math.ceil(count / 100) }, (_, i) => i * 100))
    assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.not_found'), false)
  })
}

test('detects stale metadata on a later page rather than claiming the listing is missing', async () => {
  const { fetchImpl } = paginatedDoctorFetch([...otherRecords(429), bazaarRecord({ description: 'Old description.' }), ...otherRecords(22).map((r, i) => ({ ...r, resource: `https://seller.example/api/tail-${i}` }))])
  const report = await diagnoseX402Endpoint({ endpoint, fetchImpl })
  assert.equal(report.bazaar?.found, true)
  assert.equal(report.bazaar?.matchesLive, false)
  assert.equal(report.bazaar?.observedResources, 452)
  assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.stale_metadata'), true)
  assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.not_found'), false)
})

for (const count of [0, 100, 201, 1156]) {
  test(`only establishes absence after reading the complete ${count}-listing catalogue`, async () => {
    const { fetchImpl, offsets } = paginatedDoctorFetch(otherRecords(count))
    const report = await diagnoseX402Endpoint({ endpoint, fetchImpl })
    assert.equal(report.bazaar?.found, false)
    assert.equal(report.bazaar?.catalogueComplete, true)
    assert.equal(report.bazaar?.observedResources, count)
    assert.equal(offsets.length, Math.max(1, Math.ceil(count / 100)))
    assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.not_found'), true)
  })
}

const incompleteCatalogues: Array<[string, (body: Record<string, unknown>, offset: number) => unknown]> = [
  ['truncated page', (body, offset) => offset ? { ...body, resources: [] } : body],
  ['changed total', (body, offset) => offset ? { ...body, pagination: { total: 202, offset } } : body],
  ['duplicate resources', (body, offset) => offset ? { ...body, resources: [otherRecords(1)[0]] } : body],
  ['wrong merchant', (body, offset) => offset ? { ...body, payTo: `0x${'1'.repeat(40)}` } : body],
  ['wrong offset', (body, offset) => offset ? { ...body, pagination: { total: 201, offset: 0 } } : body],
  ['unbounded total', body => ({ ...body, pagination: { total: 2001, offset: 0 } })],
  ['missing pagination', body => ({ resources: body.resources, payTo: body.payTo })],
  ['malformed response', () => null],
]
for (const [name, mutate] of incompleteCatalogues) {
  test(`reports an unknown lookup, not absence, for ${name}`, async () => {
    const { fetchImpl } = paginatedDoctorFetch(otherRecords(201), mutate)
    const report = await diagnoseX402Endpoint({ endpoint, fetchImpl })
    assert.equal(report.bazaar, undefined)
    assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.lookup'), true)
    assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.not_found'), false)
  })
}

test('a later page failure cannot establish absence even when the target was already seen', async () => {
  const rows = [bazaarRecord(), ...otherRecords(100)]
  const { fetchImpl: pages } = paginatedDoctorFetch(rows)
  const fetchImpl = (async (url, init) => String(url).includes('offset=100')
    ? new Response(null, { status: 503 }) : pages(url, init)) as typeof fetch
  const report = await diagnoseX402Endpoint({ endpoint, fetchImpl })
  assert.equal(report.bazaar, undefined)
  assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.lookup'), true)
  assert.equal(report.findings.some(f => f.ruleId === 'x402.bazaar.not_found'), false)
})

test('marks route existence uninformative when the payment gate fires before routing', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(),
      merchantResponse([bazaarRecord()]),
      challengeResponse(),
    ]),
  })

  assert.equal(report.live?.routeExistence?.verdict, 'uninformative')
  assert.equal(report.live?.routeExistence?.negativeControl.classification, 'payment_gate_before_routing')
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.route_existence.uninformative_402'), true)
})

test('reports a same-host soft-200 independently from payment-gate behavior', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(),
      merchantResponse([bazaarRecord()]),
      new Response('<title>Not found</title>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ]),
  })

  assert.equal(report.live?.routeExistence?.verdict, 'uninformative')
  assert.equal(report.live?.routeExistence?.negativeControl.classification, 'soft_200')
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.route_existence.soft_200'), true)
})

test('reports a declared not-found resource as absent', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    fetchImpl: fetchSequence([new Response(null, { status: 404 }), new Response(null, { status: 404 })]),
  })

  assert.equal(report.live?.routeExistence?.verdict, 'absent')
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.route_existence.absent'), true)
})

test('records a bounded public dependency code without logging the unsigned body',async()=>{
  const report=await diagnoseX402Endpoint({endpoint,fetchImpl:fetchSequence([
    Response.json({error:{code:'seller_notifications_not_ready'},privateMessage:'DO_NOT_LOG_THIS'}, {status:503}),
    new Response(null,{status:404}),
  ])})
  assert.equal(report.live?.failureCode,'seller_notifications_not_ready')
  assert.ok(report.findings.find(f=>f.ruleId==='x402.http.challenge_status')?.detail?.includes('public_failure_code=seller_notifications_not_ready'))
  assert.ok(!JSON.stringify(report).includes('DO_NOT_LOG_THIS'))
})
test('ignores oversized or non-code failure bodies',async()=>{
  for(const body of [{error:{code:'unsafe https://private.invalid'}},{error:{code:'safe_code'},padding:'x'.repeat(5000)}]){
    const report=await diagnoseX402Endpoint({endpoint,fetchImpl:fetchSequence([Response.json(body,{status:503}),new Response(null,{status:404})])})
    assert.equal(report.live?.failureCode,undefined)
    assert.equal(report.ok,false)
  }
})

test('records route existence when a malformed challenge fails decoder interop', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    fetchImpl: fetchSequence([
      new Response(JSON.stringify({ error: 'payment_required' }), {
        status: 402,
        headers: { 'content-type': 'application/json', 'PAYMENT-REQUIRED': 'this-is-not-a-payment-challenge' },
      }),
      new Response(null, { status: 404 }),
    ]),
  })

  assert.equal(report.live?.routeExistence?.verdict, 'confirmed')
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.header.payment_required' && finding.level === 'error'), true)
})

test('detects the accidental crawler 400 and stale Bazaar metadata', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(400),
      merchantResponse([bazaarRecord({ description: 'Old description.' })]),
    ]),
  })

  assert.equal(report.ok, false)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.bazaar.crawler_status' && finding.level === 'error'), true)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.bazaar.stale_metadata' && finding.level === 'warning'), true)
})

test('uses a catalog-computed declaration digest instead of reconstructing catalog fields', async () => {
  const declaration = {
    x402Version: challenge.x402Version,
    resource: challenge.resource,
    accepts: challenge.accepts,
    extensions: challenge.extensions,
  }
  const integrity = await createDeclarationDigestExtension(declaration, '2026-08-09')
  const liveChallenge: PaymentChallenge = {
    ...challenge,
    extensions: { ...challenge.extensions, 'declaration-integrity': integrity },
  }
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(402, liveChallenge),
      challengeResponse(402, liveChallenge),
      merchantResponse([bazaarRecord({ description: 'Catalogs may flatten this differently.', declarationIntegrity: integrity })]),
    ]),
  })

  assert.equal(report.ok, true)
  assert.equal(report.live?.declaredIntegrityDigest, integrity.declarationDigest)
  assert.equal(report.bazaar?.digestSource, 'catalog')
  assert.equal(report.bazaar?.matchesLive, true)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.bazaar.stale_metadata'), false)
})

test('rejects a seller digest that does not describe its own live declaration', async () => {
  const liveChallenge: PaymentChallenge = {
    ...challenge,
    extensions: {
      ...challenge.extensions,
      'declaration-integrity': {
        declarationDigest: `sha256:${'0'.repeat(64)}`,
        metadataVersion: '2026-08-09',
        canonicalResource: endpoint,
      },
    },
  }
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(402, liveChallenge),
      challengeResponse(402, liveChallenge),
      merchantResponse([bazaarRecord()]),
    ]),
  })

  assert.equal(report.ok, false)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.declaration_integrity.self_mismatch' && finding.level === 'error'), true)
})

test('flags deprecated v1 response headers alongside the canonical v2 challenge', async () => {
  const first = challengeResponse()
  first.headers.set('X-PAYMENT', 'legacy')
  const report = await diagnoseX402Endpoint({
    endpoint,
    fetchImpl: fetchSequence([
      first,
      challengeResponse(),
      merchantResponse([bazaarRecord()]),
    ]),
  })

  assert.equal(report.ok, true)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.headers.legacy' && finding.level === 'warning'), true)
})

test('records an explicitly injected bounded settlement and extension response', async () => {
  let paid = false
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(),
      merchantResponse([bazaarRecord()]),
    ]),
    paidProbe: async () => {
      paid = true
      return Response.json({ packId: 'ctxpack_test' }, {
        status: 201,
        headers: {
          'PAYMENT-RESPONSE': encoded({ success: true, transaction: `0x${'a'.repeat(64)}`, network: 'eip155:8453' }),
          'EXTENSION-RESPONSES': JSON.stringify({ bazaar: { status: 'processing' } }),
        },
      })
    },
  })

  assert.equal(paid, true)
  assert.equal(report.ok, true)
  assert.equal(report.live?.paidStatus, 201)
  assert.equal(report.extensionResponses[0]?.source, 'paid')
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.payment.settled'), true)
})

test('emits GitHub-compatible SARIF without embedding request bodies', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST', body: '{"private":"not-reported"}' },
    fetchImpl: fetchSequence([new Response(null, { status: 400 })]),
  })
  const sarif = doctorReportToSarif(report)
  const serialized = JSON.stringify(sarif)

  assert.equal(sarif.version, '2.1.0')
  assert.equal(serialized.includes('not-reported'), false)
  assert.equal(serialized.includes('x402.http.challenge_status'), true)
})

test('the CLI makes paid probes explicit and base-unit bounded', async () => {
  await assert.rejects(
    parseDoctorArgs([endpoint, '--pay']),
    /--pay requires an explicit --max-amount/,
  )
  const options = await parseDoctorArgs([
    endpoint,
    '--method', 'post',
    '--pay',
    '--max-amount', '1000',
    '--private-key-env', 'DEDICATED_CANARY_KEY',
  ])
  assert.equal(options.request.method, 'POST')
  assert.equal(options.pay, true)
  assert.equal(options.maxAmount, BigInt(1000))
  assert.equal(options.privateKeyEnvironment, 'DEDICATED_CANARY_KEY')
})

// ---------------------------------------------------------------------------
// Reconstructed comparison against a catalog that drops fields
// ---------------------------------------------------------------------------

test('a field the catalog never returns is not evidence of drift', () => {
  // CDP's merchant record omits mimeType. Treating that absence as null made
  // every healthy listing hash differently from its own live declaration, so
  // the stale-metadata warning fired permanently and prompted bounded
  // settlements to refresh a listing that was already current.
  const live = { resource: 'https://x/y', description: 'd', mimeType: 'application/json', accepts: [], extensions: {} }
  const indexed = { resource: 'https://x/y', description: 'd', mimeType: null, accepts: [], extensions: {} }

  const comparable = comparableDeclarations(indexed, live)
  assert.deepEqual(comparable.uncompared, ['mimeType'])
  assert.ok(!('mimeType' in comparable.indexed))
  assert.ok(!('mimeType' in comparable.live), 'dropping from one side only would still mismatch')
  assert.deepEqual(Object.keys(comparable.indexed), Object.keys(comparable.live))
})

test('a field the catalog returns with a different value is still drift', () => {
  // The fix must not silence real disagreement. An indexed description that
  // has genuinely fallen behind is exactly what this check exists to catch.
  const live = { resource: 'https://x/y', description: 'new text', mimeType: 'application/json' }
  const indexed = { resource: 'https://x/y', description: 'old text', mimeType: null }

  const comparable = comparableDeclarations(indexed, live)
  assert.equal(comparable.indexed.description, 'old text')
  assert.equal(comparable.live.description, 'new text')
  assert.deepEqual(comparable.uncompared, ['mimeType'])
})

test('an empty value the catalog does carry stays in the comparison', () => {
  // Absent and empty are different claims. A catalog that returns an empty
  // description is asserting one, and that disagreement should surface.
  const comparable = comparableDeclarations(
    { description: '', extensions: {} },
    { description: 'real text', extensions: {} },
  )
  assert.deepEqual(comparable.uncompared, [])
  assert.equal(comparable.indexed.description, '')
})
