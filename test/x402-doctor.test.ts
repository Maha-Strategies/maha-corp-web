import assert from 'node:assert/strict'
import test from 'node:test'

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
const extensions = discoveryExtensionsFor({
  pathPrefix: '/api/v1/compress',
  amount: '1000',
  description,
  concurrencyCap: 8,
})!
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

function fetchSequence(responses: Response[]): typeof fetch {
  return (async () => {
    const response = responses.shift()
    if (!response) throw new Error('Unexpected fetch.')
    return response
  }) as typeof fetch
}

test('validates the live challenge, crawler request, and current Bazaar record', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(),
      Response.json({ resources: [bazaarRecord()] }),
    ]),
  })

  assert.equal(report.ok, true)
  assert.equal(report.live?.crawlerStatus, 402)
  assert.equal(report.bazaar?.found, true)
  assert.equal(report.bazaar?.matchesLive, true)
  assert.equal(report.findings.some((finding) => finding.ruleId === 'x402.extensions.responses'), true)
})

test('detects the accidental crawler 400 and stale Bazaar metadata', async () => {
  const report = await diagnoseX402Endpoint({
    endpoint,
    request: { method: 'POST' },
    fetchImpl: fetchSequence([
      challengeResponse(),
      challengeResponse(400),
      Response.json({ resources: [bazaarRecord({ description: 'Old description.' })] }),
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
      Response.json({ resources: [bazaarRecord({ description: 'Catalogs may flatten this differently.', declarationIntegrity: integrity })] }),
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
      Response.json({ resources: [bazaarRecord()] }),
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
      Response.json({ resources: [bazaarRecord()] }),
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
      Response.json({ resources: [bazaarRecord()] }),
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
