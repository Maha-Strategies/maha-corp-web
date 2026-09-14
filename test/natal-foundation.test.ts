import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildNatalFoundation, computeNavamsa, navamsaPosition } from '../lib/natal-foundation.ts'
import { computeNatalChart, ZODIAC_SIGNS } from '../lib/natal-chart.ts'
import { buildBirthReport } from '../lib/birth-report.ts'
import { buildInspectableJyotisha } from '../lib/inspectable-jyotisha.ts'
import { handleBasicJyotisha as basicHandler, parseBasicReading } from '../lib/jyotisha-basic-api.ts'
const handleBasicJyotisha = (request: Request) => basicHandler(request, async () => 'accepted')

const observer = { latitudeDegrees: 0, longitudeDegrees: 0 }
const chartInput = { instant: new Date('2000-01-01T12:00:00Z'), ...observer }
const reference = new Date('2026-09-13T12:00:00Z')
const input = { date: '2000-01-01', time: '12:00', timeZone: 'UTC', ...observer,
  timingInstantUtc: reference.toISOString(), birthTimeUncertaintyMinutes: 0 }

test('all 108 D9 divisions agree with an independent modality-based oracle', () => {
  for (let sign = 0; sign < 12; sign++) for (let division = 0; division < 9; division++) {
    const start = sign % 3 === 0 ? sign : sign % 3 === 1 ? (sign + 8) % 12 : (sign + 4) % 12
    const expected = ZODIAC_SIGNS[(start + division) % 12]
    const longitude = sign * 30 + (division + 0.5) * 30 / 9
    assert.equal(navamsaPosition(longitude).sign, expected)
  }
  assert.equal(navamsaPosition(0).sign, 'Aries')
  assert.equal(navamsaPosition(360 - 1e-8).sign, 'Pisces')
  for (const invalid of [-1, 360, Infinity, NaN]) assert.throws(() => navamsaPosition(invalid))
})

test('D9 house counting uses D9 ascendant, and a D1 seventh does not transfer automatically', () => {
  const chart = computeNatalChart(chartInput)
  chart.ascendant.sidereal.longitude = 97.33
  chart.placements.find(p => p.name === 'Rahu')!.sidereal.longitude = 238.30
  const d9 = computeNavamsa(chart)
  assert.equal(d9.ascendant.sign, 'Virgo')
  assert.equal(d9.placements.find(p => p.name === 'Rahu')!.house, 7)
  chart.ascendant.sidereal.longitude = 96.60
  assert.notEqual(computeNavamsa(chart).placements.find(p => p.name === 'Rahu')!.house, 7)
})

test('uncertain time exposes alternatives and never claims sampled agreement proves stability', () => {
  const result = buildNatalFoundation(chartInput, 120, reference)
  assert.ok(result.sensitivity.alternatives.length > 1)
  assert.equal(result.sensitivity.samples.length, 49)
  assert.equal(result.sensitivity.samples[0].offsetMinutes, -120)
  assert.equal(result.sensitivity.samples.at(-1)!.offsetMinutes, 120)
  assert.equal(result.sensitivity.intervalStabilityProven, false)
  const tiny = buildNatalFoundation(chartInput, 0.0001, reference)
  assert.equal(tiny.sensitivity.status, 'sampled-agreement-only')
  assert.equal(tiny.sensitivity.intervalStabilityProven, false)
  assert.deepEqual(buildInspectableJyotisha(tiny, observer).modules, [])
})

test('foundation and reader are deterministic, versioned and separate facts from synthesis', () => {
  const first = buildNatalFoundation(chartInput, 0, reference)
  assert.deepEqual(first, buildNatalFoundation(chartInput, 0, reference))
  const reading = buildInspectableJyotisha(first, observer)
  assert.deepEqual(reading, buildInspectableJyotisha(first, observer))
  assert.equal(reading.sections.length, 5)
  assert.ok(reading.modules.length > 0)
  for (const note of reading.modules) {
    assert.ok(note.sources.length)
    assert.ok(note.sources.every(source => source.url && source.locator && source.digest))
    assert.ok(note.requiredFactors.length)
    assert.ok(note.qualifications && note.ruleDigest && note.reviewBasis)
    assert.match(note.chartScope, /not D9/)
  }
  assert.equal(reading.practitionerMethods.status, 'not-enabled')
  assert.ok(reading.withheld.some(rule => rule.reason === 'practitioner-review-required'))
  assert.equal(first.upcoming.length, 2)
})

test('nominal legacy notes cannot bypass uncertain-time withholding', () => {
  const result = buildBirthReport({ ...input, birthTimeUncertaintyMinutes: 2 })
  assert.equal(result.reading.modules.length, 0)
  assert.ok(result.traditions.every(tradition => tradition.modules.length === 0))
})

test('shared visitor report refuses civil-time ambiguity and impossible dates before calculation', () => {
  for (const invalid of [
    { ...input, date: '2000-02-30' },
    { ...input, date: '2024-03-10', time: '02:30', timeZone: 'America/New_York' },
    { ...input, date: '2024-11-03', time: '01:30', timeZone: 'America/New_York' },
    { ...input, timingInstantUtc: '2026-02-30T12:00:00Z' },
    { ...input, timingInstantUtc: '2026-09-13T12:00:00' },
    { ...input, birthTimeUncertaintyMinutes: 60, timingInstantUtc: '2000-01-01T12:30:00Z' },
  ]) assert.throws(() => buildBirthReport(invalid))
  assert.throws(() => buildBirthReport({ ...input, timeZone: 'private-invalid-zone' }), error => {
    assert.doesNotMatch(String(error), /private-invalid-zone/)
    return true
  })
})

test('strict basic input refuses impossible dates, implicit zones, review injection and DST gaps/folds', () => {
  for (const invalid of [
    { ...input, date: '2000-02-30' }, { ...input, name: 'not-collected' },
    { ...input, reviews: [{ accepted: true }] }, { ...input, latitudeDegrees: '' },
    { ...input, timingInstantUtc: '2026-09-13T12:00:00' },
    { ...input, date: '2024-03-10', time: '02:30', timeZone: 'America/New_York' },
    { ...input, date: '2024-11-03', time: '01:30', timeZone: 'America/New_York' },
  ]) assert.throws(() => parseBasicReading(invalid))
  assert.deepEqual(parseBasicReading(input), input)
})

test('anonymous API bounds actual bytes, refuses queries and returns private non-indexable responses', async () => {
  const post = (body: string, query = '') => new Request(`http://localhost/api/v1/interpretations/jyotisha/basic${query}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  })
  const good = await handleBasicJyotisha(post(JSON.stringify(input)))
  assert.equal(good.status, 200)
  assert.match(good.headers.get('cache-control')!, /no-store/)
  assert.match(good.headers.get('x-robots-tag')!, /noindex/)
  assert.equal(good.headers.get('set-cookie'), null)
  assert.equal((await good.json()).reading.status, 'limited-coverage')
  assert.equal((await handleBasicJyotisha(post(' '.repeat(2049)))).status, 413)
  assert.equal((await handleBasicJyotisha(post(JSON.stringify(input), '?date=private'))).status, 400)
  const bad = await handleBasicJyotisha(post(JSON.stringify({ ...input, secret: 'must-not-echo' })))
  assert.equal(bad.status, 400)
  assert.doesNotMatch(await bad.text(), /must-not-echo/)
  assert.equal((await handleBasicJyotisha(new Request('http://localhost/basic'))).status, 405)
})

test('reader uses per-request projection; local handlers contain no persistence or telemetry calls', () => {
  for (const file of ['lib/jyotisha-basic-api.ts', 'lib/natal-foundation.ts', 'lib/inspectable-jyotisha.ts']) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /console\.|localStorage|writeFile|captureException|captureMessage|fetch\(/)
  }
  const ui = readFileSync('app/knowledge/birth/InspectableReading.tsx', 'utf8')
  assert.match(ui, /import type/)
  assert.doesNotMatch(ui, /from ['"].*astrology-traditions/)
  assert.match(ui, /<summary/)
  assert.match(ui, /focus-visible/)
  const form = readFileSync('app/knowledge/birth/BirthForm.tsx', 'utf8')
  assert.match(form, /computeBirthReport\(\{ status: 'idle' \}, formData\)/)
  assert.doesNotMatch(form, /FormData>\(computeBirthReport,/)
})
