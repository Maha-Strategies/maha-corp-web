import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildNatalFoundation } from '../lib/natal-foundation.ts'
import { buildEducationalJyotisha, EDUCATIONAL_SOURCES } from '../lib/jyotisha-educational.ts'
import { consumeReadingCapacity } from '../lib/jyotisha-capacity.ts'
import { handleBasicJyotisha } from '../lib/jyotisha-basic-api.ts'
import { isPrivateReadingTelemetry } from '../lib/jyotisha-telemetry.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { calculationDigest } from '../lib/x402/celestial-products.ts'

const chart = { instant: new Date('2000-01-01T12:00:00Z'), latitudeDegrees: 0, longitudeDegrees: 0 }
const reference = new Date('2026-09-14T12:00:00Z')
const foundation = () => buildNatalFoundation(chart, 0, reference)

test('educational output is deterministic and does not claim expert or predictive acceptance', () => {
  const f = foundation(), first = buildEducationalJyotisha(f)
  assert.deepEqual(first, buildEducationalJyotisha(f))
  assert.equal(first.sections.length, 4)
  assert.equal(first.planetary.length, 9)
  assert.equal(first.predictiveValidation, false)
  assert.match(first.reviewBasis, /not practitioner or expert/)
  const { receiptDigest, ...body } = first
  assert.equal(receiptDigest, calculationDigest(body))
  for (const note of [...first.sections, ...first.planetary]) {
    assert.ok(note.sources.length && note.factors.length && note.rule.requiredFactors.length)
    assert.match(note.reflectionBasis, /Maha-authored/)
    assert.ok(note.sources.every(s => s.locator && s.edition && s.rights && s.digest))
    assert.equal(note.ruleDigest, calculationDigest(note.rule))
  }
})

test('house notes bind their exact D1 ruler and D9 position, without assigning D1 semantics to D9', () => {
  const f = foundation(), r = buildEducationalJyotisha(f)
  for (const [i, houseNumber] of [7, 10].entries()) {
    const h = f.d1.houses.find(h => h.number === houseNumber)!
    const d9 = f.d9.placements.find(p => p.name === h.ruler)!
    assert.ok(r.sections[i].factors.some(p => p.chart === 'D9' && p.name === h.ruler && p.value.includes(d9.sign)))
    assert.ok(r.sections[i].rule.exceptions.some(e => /do not automatically transfer to D9/.test(e)))
  }
  assert.ok(r.unavailable.includes('D9 marriage-outcome rules'))
})

test('missing factors or locators refuse rather than activating a partial rule', () => {
  const f = foundation()
  f.d9.placements = []
  assert.throws(() => buildEducationalJyotisha(f), /missing_divisional/)
  const record = EDUCATIONAL_SOURCES.houses as { locator: string }
  const original = record.locator
  try {
    record.locator = ''
    assert.throws(() => buildEducationalJyotisha(foundation()), /missing_educational_source/)
  } finally { record.locator = original }
  const source = readFileSync('lib/jyotisha-educational.ts', 'utf8')
  assert.doesNotMatch(source, /accepted-with-reservations|qualifiedForScope|practitionerReviews:/)
  assert.ok(EDUCATIONAL_SOURCES.nodes.boundary.includes('does not support'))
})

test('time uncertainty withholds every reflection, even with sampled agreement', () => {
  const r = buildEducationalJyotisha(buildNatalFoundation(chart, 0.0001, reference))
  for (const n of [...r.sections, ...r.planetary]) {
    assert.equal(n.status, 'nominal-study-only')
    assert.match(n.reflection, /withheld/)
  }
})

test('missing node doctrine stays unavailable rather than receiving a classical planet prompt', () => {
  const r = buildEducationalJyotisha(foundation())
  for (const name of ['Rahu', 'Ketu']) {
    const n = r.planetary.find(n => n.id === `planet-${name}`)!
    assert.match(n.reflection, /No personal node interpretation/)
    assert.deepEqual(n.sources.map(s => s.id), ['iyer-II-3'])
  }
  assert.match(r.sections.find(n => n.id === 'periods')!.explanation, /not a period-outcome rule/)
  assert.match(r.sections.find(n => n.id === 'transits')!.explanation, /not an ingress search/)
})

test('global distributed limiter accepts only explicit success and stores no visitor identifiers', async () => {
  assert.equal(await consumeReadingCapacity(async (_script, keys) => {
    assert.ok(keys.every(k => /jyotisha:capacity:(minute|day)$/.test(k)))
    return 1
  }), 'accepted')
  assert.equal(await consumeReadingCapacity(async () => 0), 'limited')
  assert.equal(await consumeReadingCapacity(async () => '1'), 'unavailable')
  assert.equal(await consumeReadingCapacity(async () => { throw new Error('private') }), 'unavailable')
})

test('basic API refuses capacity failures before any report generation', async () => {
  const request = () => new Request('http://localhost/api/v1/interpretations/jyotisha/basic', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  })
  assert.equal((await handleBasicJyotisha(request(), async () => 'limited')).status, 429)
  const unavailable = await handleBasicJyotisha(request(), async () => 'unavailable')
  assert.equal(unavailable.status, 503)
  assert.match(unavailable.headers.get('cache-control')!, /no-store/)
  for (const path of ['/api/v1/interpretations/jyotisha', '/api/v1/interpretations/jyotisha/basic'])
    assert.equal(apiProxyGate(path, 'POST', false), 'self_managed')
  assert.notEqual(apiProxyGate('/api/v1/interpretations/jyotisha/unreviewed', 'POST', false), 'self_managed')
})

test('private reading telemetry is discarded, including navigation breadcrumbs', () => {
  assert.equal(isPrivateReadingTelemetry({ request: { url: 'https://example.org/knowledge/birth?private=1' } }), true)
  assert.equal(isPrivateReadingTelemetry({ transaction: 'POST /api/v1/interpretations/jyotisha/basic' }), true)
  assert.equal(isPrivateReadingTelemetry({ breadcrumbs: [{ data: { from: '/knowledge/birth', to: '/' } }] }), true)
  assert.equal(isPrivateReadingTelemetry({ request: { url: 'https://example.org/knowledge' } }), false)
})
