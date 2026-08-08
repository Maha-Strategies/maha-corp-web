import assert from 'node:assert/strict'
import test from 'node:test'

import { discoveryExtensionsFor } from '../lib/x402/discovery.ts'
import { diagnoseX402Endpoint, doctorReportToSarif } from '../lib/x402/doctor.ts'
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

function challengeResponse(status = 402): Response {
  return new Response(JSON.stringify({ error: 'payment_required' }), {
    status,
    headers: { 'content-type': 'application/json', 'PAYMENT-REQUIRED': encoded(challenge) },
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
