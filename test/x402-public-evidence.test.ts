import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { X402_OFFERS } from '../lib/x402/offers.ts'
import {
  X402_PUBLIC_MANIFEST_PATH,
  buildPublicManifest,
  findForbiddenInManifest,
  publicStatusFor,
} from '../lib/x402/public-manifest.ts'
import {
  X402_CONFORMANCE_RESULT_PATH,
  findForbiddenInConformance,
  parseConformanceResult,
  rollUp,
  type ConformanceDimension,
} from '../lib/x402/public-conformance.ts'

const ROOT = join(import.meta.dirname, '..')
const manifest = () => JSON.parse(readFileSync(join(ROOT, X402_PUBLIC_MANIFEST_PATH), 'utf8'))
const conformance = () => JSON.parse(readFileSync(join(ROOT, X402_CONFORMANCE_RESULT_PATH), 'utf8'))

test('the committed manifest reproduces from the offer catalog', () => {
  const committed = manifest()
  assert.deepEqual(committed, buildPublicManifest(committed.configurationAsOf))
})

test('every catalog offer appears, with its catalog status', () => {
  const published = manifest().offers as { id: string; status: string; payment: unknown }[]
  assert.equal(published.length, X402_OFFERS.length)
  for (const offer of X402_OFFERS) {
    const entry = published.find((candidate) => candidate.id === offer.id)
    assert.ok(entry, `manifest omits ${offer.id}`)
    assert.equal(entry.status, publicStatusFor(offer.status))
  }
})

/** A withheld offer answers 401. Publishing terms for it invites a wasted payment. */
test('payment terms are published only for active offers', () => {
  for (const entry of manifest().offers as { id: string; status: string; payment: unknown }[]) {
    if (entry.status === 'active') assert.ok(entry.payment, `${entry.id} is active but publishes no terms`)
    else assert.equal(entry.payment, null, `${entry.id} is ${entry.status} but publishes payment terms`)
  }
  const withheld = (manifest().offers as { id: string; status: string }[]).find((entry) => entry.status === 'withheld')
  assert.ok(withheld, 'the fixture should include a withheld offer, or this test proves nothing')
})

test('the manifest asserts configuration and refuses to assert behaviour', () => {
  const boundary = manifest().assertionBoundary
  assert.equal(boundary.assertsConfiguration, true)
  for (const flag of ['assertsLiveness', 'assertsSettlementHistory', 'assertsRegistryIndexing', 'assertsUptime', 'assertsTrustScore']) {
    assert.equal(boundary[flag], false, `${flag} must be false`)
  }
  assert.match(boundary.proofOfPayability, /402 PAYMENT-REQUIRED/)
  const limitations = (manifest().limitations as string[]).join(' ')
  assert.match(limitations, /not an independent trust score/i)
})

/**
 * Scan the machine-readable offer entries, not the whole document: the
 * boundary and limitations blocks name these claims in order to deny them, and
 * a keyword scan over the prose would flag its own disclaimers.
 */
test('no offer entry carries an invented liveness or reputation field', () => {
  const offers = JSON.stringify(manifest().offers).toLowerCase()
  for (const invented of [
    'uptime', 'availability', 'trustscore', 'trust_score', 'reputation',
    'settlements', 'settlementcount', 'payerhistory', 'payers', 'lastseen',
    'indexed', 'listed', 'healthy', 'online',
  ]) {
    assert.ok(!offers.includes(invented), `an offer entry carries "${invented}"`)
  }
})

test('the denials the document relies on are actually present', () => {
  const limitations = (manifest().limitations as string[]).join(' ')
  assert.match(limitations, /No settlement count, payer history, uptime figure or availability guarantee/i)
  assert.match(limitations, /Verify payability with a live 402 challenge/i)
  assert.match(limitations, /separate verdicts/i)
})

test('a mismatched or stale declaration digest is caught', () => {
  const tampered = manifest()
  tampered.offers[0].declarationIntegrity.digest = `sha256:${'0'.repeat(64)}`
  assert.notDeepEqual(tampered, buildPublicManifest(tampered.configurationAsOf))

  const malformed = manifest()
  malformed.offers[0].declarationIntegrity.digest = 'not-a-digest'
  assert.ok(!/^sha256:[0-9a-f]{64}$/.test(malformed.offers[0].declarationIntegrity.digest))
})

test('a wrong resource, network or version boundary is caught', () => {
  for (const mutate of [
    (value: Record<string, never>) => { (value as never as { offers: { canonicalResource: string }[] }).offers[0].canonicalResource = 'https://evil.example/api/v1/compress' },
    (value: Record<string, never>) => { (value as never as { offers: { payment: { network: string } }[] }).offers[0].payment.network = 'eip155:1' },
    (value: Record<string, never>) => { (value as never as { schemaVersion: string }).schemaVersion = '9.9.9' },
    (value: Record<string, never>) => { (value as never as { offers: { method: string }[] }).offers[0].method = 'GET' },
  ]) {
    const tampered = manifest()
    mutate(tampered)
    assert.notDeepEqual(tampered, buildPublicManifest(tampered.configurationAsOf))
  }
})

test('a manifest exposing a secret or an internal URL is refused', () => {
  for (const [label, mutate] of [
    ['bearer token', (value: Record<string, unknown>) => { value.leaked = 'Bearer abcdefghijklmnopqrstuvwxyz012345' }],
    ['anthropic key', (value: Record<string, unknown>) => { value.leaked = 'sk-ant-abcd1234efgh' }],
    ['private key material', (value: Record<string, unknown>) => { value.leaked = `0x${'a'.repeat(64)}` }],
    ['internal host', (value: Record<string, unknown>) => { value.leaked = 'http://localhost:3000/api/v1/compress' }],
    ['admin route', (value: Record<string, unknown>) => { value.leaked = 'https://www.mahastrategies.com/api/admin/x402-readiness' }],
    ['env var name', (value: Record<string, unknown>) => { value.leaked = 'CDP_API_KEY_SECRET' }],
  ] as [string, (value: Record<string, unknown>) => void][]) {
    const tampered = manifest()
    mutate(tampered)
    assert.ok(findForbiddenInManifest(tampered).length > 0, `a manifest leaking a ${label} was accepted`)
  }
  assert.deepEqual(findForbiddenInManifest(manifest()), [], 'the committed manifest itself trips a forbidden pattern')
})

test('the conformance result validates and keeps its two verdicts apart', () => {
  const result = parseConformanceResult(conformance())
  assert.ok(result.verdicts.protocolConformance)
  assert.ok(result.verdicts.discoveryEligibility)
  assert.ok(!('overall' in (result as unknown as Record<string, unknown>)), 'a combined score defeats the format')

  const categories = new Set(result.dimensions.map((entry) => entry.category))
  assert.ok(categories.has('protocol-conformance'))
  assert.ok(categories.has('discovery-eligibility'))
})

/**
 * A payment-breaking failure must not be softened by discovery passing, and a
 * discovery failure must not be reported as a payment problem.
 */
test('the two verdicts fail independently', () => {
  const base = conformance().dimensions as ConformanceDimension[]
  const brokenPayment = base.map((entry) => entry.category === 'protocol-conformance' && entry.dimension === 'replay-protection'
    ? { ...entry, verdict: 'fail' as const } : entry)
  assert.equal(rollUp(brokenPayment, 'protocol-conformance'), 'fail')
  assert.equal(rollUp(brokenPayment, 'discovery-eligibility'), 'pass', 'a payment failure leaked into discovery eligibility')

  const brokenDiscovery = base.map((entry) => entry.category === 'discovery-eligibility' && entry.dimension === 'declaration-digest-consistency'
    ? { ...entry, verdict: 'fail' as const } : entry)
  assert.equal(rollUp(brokenDiscovery, 'discovery-eligibility'), 'fail')
  assert.equal(rollUp(brokenDiscovery, 'protocol-conformance'), 'pass', 'a discovery failure leaked into protocol conformance')
})

test('a roll-up that disagrees with its dimensions is rejected', () => {
  const tampered = conformance()
  tampered.dimensions[0].verdict = 'fail'
  assert.throws(() => parseConformanceResult(tampered), /but the dimensions derive/)
})

test('unobserved dimensions are neither passing nor failing', () => {
  const result = parseConformanceResult(conformance())
  const unobserved = result.dimensions.filter((entry) => entry.verdict === 'not-observed')
  assert.ok(unobserved.length > 0, 'the fixture should carry an unobserved dimension')
  for (const entry of unobserved) {
    assert.equal(entry.evidenceClass, 'not-observed')
  }
  // Settlement is the one that matters most and is the one not observed.
  assert.ok(unobserved.some((entry) => entry.dimension === 'settlement-observed'))
})

test('every dimension declares how its verdict was reached', () => {
  const result = parseConformanceResult(conformance())
  const allowed = new Set(['local-contract-test', 'unpaid-live-probe', 'paid-settlement', 'third-party-tool', 'not-observed'])
  for (const entry of result.dimensions) {
    assert.ok(allowed.has(entry.evidenceClass), `${entry.dimension} has an unknown evidence class`)
    assert.ok(entry.detail.length > 20, `${entry.dimension} has no usable detail`)
  }
})

test('a conformance result carrying credentials, signatures or raw headers is refused', () => {
  for (const [label, mutate] of [
    ['payment signature', (value: Record<string, unknown>) => { value.leaked = 'PAYMENT-SIGNATURE: abc' }],
    ['bearer token', (value: Record<string, unknown>) => { value.leaked = 'Bearer abcdefghijklmnopqrstuvwxyz012345' }],
    ['raw headers', (value: Record<string, unknown>) => { value.headers = { authorization: 'x' } }],
    ['request body', (value: Record<string, unknown>) => { value.requestBody = 'source text' }],
    ['response body', (value: Record<string, unknown>) => { value.responseBody = 'model answer' }],
  ] as [string, (value: Record<string, unknown>) => void][]) {
    const tampered = conformance()
    mutate(tampered)
    assert.ok(findForbiddenInConformance(tampered).length > 0, `a result leaking ${label} was accepted`)
    assert.throws(() => parseConformanceResult(tampered))
  }
  assert.deepEqual(findForbiddenInConformance(conformance()), [])
})

test('a sanitization flag cannot be flipped to permit retention', () => {
  for (const flag of ['credentialsIncluded', 'paymentSignaturesIncluded', 'requestContentIncluded', 'responseBodiesIncluded', 'rawHeadersIncluded', 'customerDataIncluded']) {
    const tampered = conformance()
    tampered.sanitization[flag] = true
    assert.throws(() => parseConformanceResult(tampered), new RegExp(flag))
  }
})

test('a malformed conformance envelope fails closed', () => {
  assert.throws(() => parseConformanceResult('not an object'), /must be a JSON object/)
  assert.throws(() => parseConformanceResult({ ...conformance(), schemaVersion: '2.0.0' }), /Unsupported conformance schema version/)
  assert.throws(() => parseConformanceResult({ ...conformance(), configurationAsOf: 'whenever' }), /must be an ISO date/)
  assert.throws(() => parseConformanceResult({ ...conformance(), dimensions: [] }), /at least one measured dimension/)
  const noVerdicts = conformance(); delete noVerdicts.verdicts
  assert.throws(() => parseConformanceResult(noVerdicts), /separately/)
})

test('the manifest points only at public evidence surfaces', () => {
  const evidence = manifest().evidence as Record<string, string>
  for (const [key, value] of Object.entries(evidence)) {
    if (value.startsWith('npm run')) continue
    assert.match(value, /^https:\/\/www\.mahastrategies\.com\//, `evidence.${key} is not a public https URL`)
  }
})

/**
 * The rename exists because `generatedAt` invited "last verified". A guard, so
 * the old name cannot come back through a copy-paste and quietly re-acquire
 * the reading the field was renamed to avoid.
 */
test('the snapshot field is configurationAsOf, and generatedAt is gone', () => {
  for (const document of [manifest(), conformance()]) {
    assert.equal(typeof document.configurationAsOf, 'string')
    assert.match(document.configurationAsOf, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(!('generatedAt' in document), 'generatedAt is still published')
    assert.ok(!JSON.stringify(document).includes('generatedAt'), 'generatedAt appears somewhere in the document')
  }
})

test('the document says in-band what configurationAsOf does and does not mean', () => {
  const meaning = manifest().assertionBoundary.configurationAsOfMeaning as string
  assert.match(meaning, /configuration snapshot this document describes/i)
  for (const notThis of ['probe time', 'build timestamp', 'freshness', 'uptime', 'indexing', 'settlement']) {
    assert.ok(meaning.toLowerCase().includes(notThis), `the meaning does not rule out "${notThis}"`)
  }
})

test('the snapshot value is deterministic across regeneration', async () => {
  const { execFileSync } = await import('node:child_process')
  const before = readFileSync(join(ROOT, X402_PUBLIC_MANIFEST_PATH), 'utf8')
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-x402-public-evidence.ts'],
    { cwd: ROOT, stdio: 'ignore' })
  const after = readFileSync(join(ROOT, X402_PUBLIC_MANIFEST_PATH), 'utf8')
  assert.equal(after, before, 'regeneration changed the artifact; the snapshot value is not deterministic')
})
