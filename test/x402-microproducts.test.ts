import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { MICRO_IDS, MICRO_INPUT_SCHEMAS, MICRO_MAX_REQUEST_BYTES, MICRO_MAX_RESPONSE_BYTES, MICRO_PRODUCTS, microPath, schemaAccepts } from '../lib/x402/micro-contracts.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { NEXT_IDS, NEXT_PRODUCTS } from '../lib/x402/micro-next-contracts.ts'
import { MICRO_SAMPLE_INPUTS } from '../lib/x402/micro-samples.ts'
import { buildMicroProduct, microDigest, canonicalMicro, verifyMicroProduct } from '../lib/x402/micro-products.ts'
import { projectReleasePacket, type ReleaseCorpus } from '../lib/x402/micro-corpus.ts'
import { digest } from '../lib/federation/readiness-tranche-22.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { validate } from './helpers/json-schema.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { releasesSlot } from '../lib/x402/slot.ts'
import { isReleasedMicro } from '../lib/x402/micro-release.ts'

const sample = (id: keyof typeof MICRO_PRODUCTS) => structuredClone(MICRO_SAMPLE_INPUTS[id])
const root = new URL('../', import.meta.url)
const read = (file: string) => readFileSync(new URL(file, root), 'utf8')
const hash = (c: string) => `sha256:${c.repeat(64)}`

for (const id of MICRO_IDS) {
  test(`${id}: deterministic, independent-schema-valid example and recomputation`, async () => {
    const offer = MICRO_OFFERS.find(o => o.id === id)!, input = sample(id)
    assert.equal(offer.status, isReleasedMicro(id) ? 'available' : 'withheld')
    assert.equal(offer.availability.payableInProduction, isReleasedMicro(id))
    assert.equal(payableOffers().some(o => o.id === id), isReleasedMicro(id))
    assert.equal(Buffer.byteLength(offer.description) <= 480, true)
    assert.deepEqual(validate(input, offer.discovery.inputSchema), [])
    const result = await buildMicroProduct(id, input)
    assert.deepEqual(validate(result, offer.discovery.outputSchema), [])
    assert.ok(validate({ ...result, amountBaseUnits: offer.amount === '5000' ? '10000' : '5000' }, offer.discovery.outputSchema).length > 0)
    assert.deepEqual(result, offer.discovery.output)
    assert.deepEqual(await buildMicroProduct(id, Object.fromEntries(Object.entries(input).reverse())), result)
    assert.ok(await verifyMicroProduct(id, input, result))
    const forged = structuredClone(result)
    forged.result = { ...forged.result, counterfeit: true }
    const { receiptDigest: _discard, ...unsigned } = forged
    assert.equal(_discard, result.receiptDigest)
    forged.receiptDigest = microDigest(unsigned)
    assert.equal(await verifyMicroProduct(id, input, forged), false)
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= MICRO_MAX_RESPONSE_BYTES)
  })
  test(`${id}: refuses undeclared fields, missing fields and private data classes`, async () => {
    for (const input of [{ ...sample(id), unknown: 'private-marker' }, { ...sample(id), dataClass: 'private' }, {}, null, []]) {
      await assert.rejects(buildMicroProduct(id, input), /invalid_or_unsupported/)
    }
    assert.equal(apiProxyGate(microPath(id), 'POST', false), 'self_managed')
    assert.notEqual(apiProxyGate(microPath(id) + '/extra', 'POST', false), 'self_managed')
    assert.equal(releasesSlot('POST', microPath(id)), true)
    const route = read(`app/api/v1/micro/${id}/route.ts`)
    assert.ok(route.includes(`microHandlers('${id}')`))
    assert.ok(route.includes("dynamic = 'force-dynamic'"))
  })
}

test('first ten retain prices and twelve additions use only approved price bands', () => {
  const half = ['citation-binding-check', 'revision-lineage-check', 'dimensional-consistency-check', 'exact-interpolation-receipt', 'tiruvaymoli-context-packet']
  assert.equal(MICRO_IDS.length, 22)
  assert.equal(new Set(MICRO_IDS.map(microPath)).size, 22)
  const original = MICRO_OFFERS.filter(o => !NEXT_IDS.includes(o.id as keyof typeof NEXT_PRODUCTS))
  assert.equal(original.length, 10)
  // Two approved bands. A settled amount may carry a small per-product offset
  // so the ledger can attribute a payment, so the band is the amount floored to
  // its tier rather than the amount itself.
  const band = (amount: string) => String(Math.floor(Number(amount) / 1000) * 1000)
  const offset = (amount: string) => Number(amount) - Number(band(amount))
  for (const o of original) {
    assert.equal(band(o.amount), half.includes(o.id) ? '5000' : '10000', `${o.id}: price band`)
    assert.ok(offset(o.amount) < 100, `${o.id}: an attribution offset stays inside its band`)
  }
  for (const id of NEXT_IDS) {
    const amount = MICRO_OFFERS.find(o => o.id === id)!.amount
    assert.ok(['5000', '10000'].includes(band(amount)), `${id}: price band`)
    assert.ok(offset(amount) < 100, `${id}: an attribution offset stays inside its band`)
  }
})

test('citations expose exact mismatch dimensions, never passage support', async () => {
  const input = sample('citation-binding-check')
  const bindings = input.bindings as { expected: Record<string, unknown>; observed: Record<string, unknown> }[]
  bindings[0].observed = { sourceId: 'other', sourceRevision: hash('2'), kind: 'page', value: '9' }
  const r = (await buildMicroProduct('citation-binding-check', input)).result
  assert.equal(r.allMatch, false)
  assert.deepEqual((r.checks as { mismatches: string[] }[])[0].mismatches, ['sourceId', 'sourceRevision', 'kind', 'value'])
  assert.equal(r.claimSupportVerified, false)
  bindings[0].observed.value = ' '
  await assert.rejects(buildMicroProduct('citation-binding-check', input))
})

test('lineage distinguishes valid transitions, substitutions and no-change; review is never inherited', async () => {
  const input = sample('revision-lineage-check')
  const next = input.next as Record<string, unknown>
  next.predecessorDigest = hash('9')
  const r = (await buildMicroProduct('revision-lineage-check', input)).result
  assert.equal(r.consistent, false)
  assert.deepEqual(r.issues, ['predecessor-digest-mismatch'])
  assert.equal(r.reviewInherited, false)
  input.previous = null; next.predecessorDigest = null; next.relation = 'initial'
  assert.equal((await buildMicroProduct('revision-lineage-check', input)).result.consistent, true)
})

test('audit export rejects duplicate IDs, impossible calendar dates, extra fields and over-limit batches', async () => {
  const input = sample('audit-export-normalizer'), events = input.events as Record<string, unknown>[]
  const baseline = (await buildMicroProduct('audit-export-normalizer', input)).result
  assert.deepEqual((await buildMicroProduct('audit-export-normalizer', { ...input, events: [...events].reverse() })).result, baseline)
  await assert.rejects(buildMicroProduct('audit-export-normalizer', { ...input, events: [events[0], events[0]] }))
  for (const occurredAt of ['2026-02-30T00:00:00.000Z', '2026-09-09T10:00:00+00:00']) await assert.rejects(buildMicroProduct('audit-export-normalizer', { ...input, events: [{ ...events[0], occurredAt }] }))
  await assert.rejects(buildMicroProduct('audit-export-normalizer', { ...input, events: [{ ...events[0], customerSubmission: 'secret' }] }))
  await assert.rejects(buildMicroProduct('audit-export-normalizer', { ...input, events: Array(101).fill(events[0]) }))
})

test('SI dimension vectors have exactly seven integer exponents; mismatch is a negative finding', async () => {
  const input = sample('dimensional-consistency-check')
  input.expected = [0, 0, 0, 0, 0, 0, 0]
  assert.equal((await buildMicroProduct('dimensional-consistency-check', input)).result.consistent, false)
  for (const left of [[1], [1.5, 0, 0, 0, 0, 0, 0], [99, 0, 0, 0, 0, 0, 0]]) await assert.rejects(buildMicroProduct('dimensional-consistency-check', { ...input, left }))
})

test('interpolation is an independently checked fraction; extrapolation, repeated nodes, large and non-integer inputs refuse', async () => {
  const input = sample('exact-interpolation-receipt')
  const r = (await buildMicroProduct('exact-interpolation-receipt', input)).result
  assert.equal(r.numerator, '5'); assert.equal(r.denominator, '2')
  for (const change of [{ x: '5' }, { x1: '0' }, { x: '1.5' }, { x: 1 }, { x: '1'.repeat(1000) }, { yUnit: '' }]) await assert.rejects(buildMicroProduct('exact-interpolation-receipt', { ...input, ...change }))
  for (let x = 0; x <= 20; x++) {
    const value = (await buildMicroProduct('exact-interpolation-receipt', { ...input, x0: '0', y0: '1', x1: '20', y1: '61', x: String(x) })).result
    assert.equal(BigInt(value.numerator as string), BigInt(3 * x + 1) * BigInt(value.denominator as string))
  }
})

test('integration reports trapezoidal approximation rather than exact underlying integral', async () => {
  const input = sample('sampled-series-integration'), r = (await buildMicroProduct('sampled-series-integration', input)).result
  assert.equal(r.numerator, '3'); assert.equal(r.denominator, '1')
  assert.equal(r.approximationError, 'not-estimated')
  for (const change of [{ spacing: '0' }, { spacing: '-1' }, { ordinates: ['1'] }, { ordinates: Array(129).fill('1') }]) await assert.rejects(buildMicroProduct('sampled-series-integration', { ...input, ...change }))
})

test('evidence comparison separates exclusions and insufficiency from no observed conflict', async () => {
  const input = sample('evidence-conflict-comparator'), observations = input.observations as Record<string, unknown>[]
  assert.equal((await buildMicroProduct('evidence-conflict-comparator', input)).result.state, 'conflict-observed')
  observations[1].population = 'different-population'
  const r = (await buildMicroProduct('evidence-conflict-comparator', input)).result
  assert.equal(r.state, 'insufficient-comparable-observations')
  assert.deepEqual(r.excluded, [{ observationId: 'obs-2', reasons: ['population-mismatch'] }])
  observations[1].normalizedClaimId = 'substituted-claim'
  await assert.rejects(buildMicroProduct('evidence-conflict-comparator', input))
})

test('plan check catches missing declarations without registering or claiming predictive validity', async () => {
  const input = sample('astrology-experiment-plan-check')
  const r = (await buildMicroProduct('astrology-experiment-plan-check', { ...input, startUtc: input.assessedAtUtc, comparator: 'none', sampleSize: 0 })).result
  assert.equal(r.state, 'revise')
  assert.deepEqual(r.issues, ['start-not-after-declared-assessment', 'comparator-missing', 'fewer-than-two-observations-planned'])
  assert.equal(r.registered, false); assert.equal(r.trustedTimestamp, false); assert.equal(r.predictionValidated, false)
  for (const extra of [{ activity: 'medical' }, { participantName: 'private-person' }, { birthDate: '1990-01-01' }, { startUtc: '2026-02-30T10:00:00.000Z' }]) await assert.rejects(buildMicroProduct('astrology-experiment-plan-check', { ...input, ...extra }))
})

test('release packet refuses changed revision, release, foreign host and private path', async () => {
  const input = sample('release-bound-evidence-packet')
  for (const change of [{ expectedContentDigest: hash('9') }, { expectedReleaseDigest: hash('9') }, { canonicalUrl: 'https://evil.invalid/policy/assurance-cases/definition' }, { canonicalUrl: 'https://www.mahastrategies.com/api/admin/epistemic-releases' }]) await assert.rejects(buildMicroProduct('release-bound-evidence-packet', { ...input, ...change }))
})

function corpusFixture(): ReleaseCorpus {
  const m = JSON.parse(read('content/federation/implementations/maha-policy-pages-v2.json'))
  const p = m.pages.find((p: { canonicalUrl: string }) => p.canonicalUrl === MICRO_SAMPLE_INPUTS['release-bound-evidence-packet'].canonicalUrl)
  m.pages = [p]
  const ledger = JSON.parse(read('content/federation/public/federation-canonical-release-ledger-v1.json'))
  ledger.entries = ledger.entries.filter((r: { candidateId: string }) => r.candidateId === p.candidateId)
  const index = JSON.parse(read('content/federation/public/federation-public-route-index-v1.json'))
  index.entries = index.entries.filter((r: { candidateId: string }) => r.candidateId === p.candidateId)
  for (const obj of [m, ledger, index]) obj.provenanceDigest = digest(Object.fromEntries(Object.entries(obj).filter(([k]) => k !== 'provenanceDigest')))
  return { manifests: [m], ledger, index }
}

test('release projection fails on withdrawal, review/dependency failure, duplicates and rehashed host substitution', () => {
  const input = sample('release-bound-evidence-packet')
  assert.ok(projectReleasePacket(input, corpusFixture()))
  const mutations: ((c: ReleaseCorpus) => void)[] = [
    c => { Object.assign(c.ledger.entries[0], { status: 'withdrawn' }) },
    c => { c.manifests[0].pages[0].adoption.exactRevisionReviewed = false },
    c => { c.manifests[0].pages[0].adoption.blockedDependencies = ['missing'] },
    c => { c.ledger.entries.push(c.ledger.entries[0]) },
    c => { c.index.entries[0].canonicalHost = 'substituted.invalid' },
    c => { c.index.entries[0].releaseDigest = hash('7') },
  ]
  for (const mutate of mutations) {
    const c = corpusFixture(); mutate(c)
    // Rehash every changed layer and supply its new pins, so the semantic
    // refusal cannot accidentally pass only because an outer digest is stale.
    const page = c.manifests[0].pages[0], release = c.ledger.entries[0]
    page.contentDigest = digest(Object.fromEntries(Object.entries(page).filter(([k]) => k !== 'contentDigest')))
    release.targetContentDigest = page.contentDigest
    c.index.entries[0].targetContentDigest = page.contentDigest
    release.releaseDigest = digest(Object.fromEntries(Object.entries(release).filter(([k]) => k !== 'releaseDigest')))
    if (c.index.entries[0].releaseDigest === input.expectedReleaseDigest) c.index.entries[0].releaseDigest = release.releaseDigest
    for (const object of [c.manifests[0], c.ledger, c.index]) object.provenanceDigest = digest(Object.fromEntries(Object.entries(object).filter(([k]) => k !== 'provenanceDigest')))
    assert.throws(() => projectReleasePacket({ ...input, expectedContentDigest: page.contentDigest, expectedReleaseDigest: release.releaseDigest }, c))
  }
})

test('release projection never spreads private fields from a valid digest-bound source or review', () => {
  const c = corpusFixture(), page = c.manifests[0].pages[0], release = c.ledger.entries[0]
  Object.assign(page.sources[0], { privatePassage: 'NEVER-EXPOSE-ME' })
  Object.assign(page.adoption, { reviewerIdentity: 'NEVER-EXPOSE-ME' })
  page.contentDigest = digest(Object.fromEntries(Object.entries(page).filter(([k]) => k !== 'contentDigest')))
  release.targetContentDigest = page.contentDigest
  release.releaseDigest = digest(Object.fromEntries(Object.entries(release).filter(([k]) => k !== 'releaseDigest')))
  c.index.entries[0].targetContentDigest = page.contentDigest
  c.index.entries[0].releaseDigest = release.releaseDigest
  for (const object of [c.manifests[0], c.ledger, c.index]) object.provenanceDigest = digest(Object.fromEntries(Object.entries(object).filter(([k]) => k !== 'provenanceDigest')))
  const result = projectReleasePacket({ ...sample('release-bound-evidence-packet'), expectedContentDigest: page.contentDigest, expectedReleaseDigest: release.releaseDigest }, c)
  assert.doesNotMatch(JSON.stringify(result), /NEVER-EXPOSE|privatePassage|reviewerIdentity/)
})

test('context packet binds named edition and registry; unknown unit or wrong registry is refused', async () => {
  const input = sample('tiruvaymoli-context-packet'), r = (await buildMicroProduct('tiruvaymoli-context-packet', input)).result
  assert.equal((r.answers as unknown[]).length, 5)
  assert.equal(r.sourceTextIncluded, false); assert.equal(r.redistributionRightsGranted, false)
  assert.ok(JSON.stringify(r).includes('Kausalya Hart'))
  await assert.rejects(buildMicroProduct('tiruvaymoli-context-packet', { ...input, expectedRegistryDigest: hash('9') }))
  await assert.rejects(buildMicroProduct('tiruvaymoli-context-packet', { ...input, slug: 'missing-unit' }))
})

test('schema rejects nonfinite values, prototype keys, nested unknown fields and overlarge arrays', () => {
  const s = MICRO_INPUT_SCHEMAS['citation-binding-check'], input = sample('citation-binding-check')
  assert.equal(schemaAccepts(s, JSON.parse('{"__proto__":{"polluted":true}}')), false)
  assert.equal(schemaAccepts(s, { ...input, bindings: Array(21).fill((input.bindings as unknown[])[0]) }), false)
  assert.throws(() => canonicalMicro({ value: Infinity }))
  assert.ok(MICRO_MAX_REQUEST_BYTES < MICRO_MAX_RESPONSE_BYTES)
})

test('examples regenerate byte-identically with no remote mode; no client import of micro runtime', () => {
  const before = read('content/discovery/microproduct-examples.json')
  for (let i = 0; i < 2; i++) execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-microproduct-examples.ts', '--check'], { cwd: root })
  assert.equal(read('content/discovery/microproduct-examples.json'), before)
  for (const file of ['lib/x402/micro-contracts.ts', 'lib/x402/micro-products.ts', 'lib/x402/micro-corpus.ts']) {
    const code = read(file)
    assert.ok(!/\bfetch\s*\(|\.rpc\s*\(|process\.env|writeFile/.test(code), file)
  }
  const output = JSON.parse(before)
  for (const result of Object.values(output.outputs)) for (const forbidden of ['customerSubmission', 'reviewerIdentity', 'fullText', 'sourceExcerpt', 'credentialValue']) assert.ok(!JSON.stringify(result).includes(forbidden))
})
