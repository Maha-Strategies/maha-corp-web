import assert from 'node:assert/strict'
import test from 'node:test'

import { BirthInputError, buildBirthReport } from '../lib/birth-report.ts'
import { CLASSICAL_BODIES, buildLocalFactBundle } from '../lib/local-fact-bundle.ts'
import { validateCelestialFactBundle } from '../lib/celestial-facts.ts'
import { zonedWallTimeToUtc } from '../lib/zoned-time.ts'

const CHENNAI = { latitudeDegrees: 13.0827, longitudeDegrees: 80.2707, timeZone: 'Asia/Kolkata' }

test('wall time resolves against the historical offset, not a fixed one', () => {
  // New York in June is EDT, in January EST. A fixed offset would be wrong for one.
  assert.equal(zonedWallTimeToUtc('1985-06-14', '21:40', 'America/New_York').utcOffset, '-04:00')
  assert.equal(zonedWallTimeToUtc('1985-01-14', '21:40', 'America/New_York').utcOffset, '-05:00')
  // British Standard Time: the UK stayed on +01:00 year-round from 1968 to 1971.
  assert.equal(zonedWallTimeToUtc('1969-01-14', '12:00', 'Europe/London').utcOffset, '+01:00')
})

test('daylight-saving edges are surfaced rather than resolved silently', () => {
  const ambiguous = zonedWallTimeToUtc('2024-11-03', '01:30', 'America/New_York')
  assert.equal(ambiguous.fold, 'earlier-offset')
  assert.equal(ambiguous.nonexistent, false)

  const nonexistent = zonedWallTimeToUtc('2024-03-10', '02:30', 'America/New_York')
  assert.equal(nonexistent.nonexistent, true)
})

test('a birth report carries the pañcāṅga and its resolved instant', () => {
  const report = buildBirthReport({ date: '1985-06-14', time: '21:40', ...CHENNAI, placeLabel: 'Chennai' })
  assert.equal(report.instantUtc, '1985-06-14T16:10:00.000Z')
  assert.equal(report.utcOffset, '+05:30')
  assert.equal(report.panchanga.nakshatra.name, 'Bharaṇī')
  assert.equal(report.panchanga.tithi.paksha, 'kṛṣṇa')
  assert.ok(report.natalChart.placements.length === 9)
  assert.ok(report.panchanga.ayanamsa.degrees > 23 && report.panchanga.ayanamsa.degrees < 24)
})

test('the fact bundle carries all seven classical bodies', () => {
  // A rule keyed to an absent body is excluded as `condition-unsatisfied`,
  // which reads as a judgement about the chart rather than a missing input.
  const bundle = buildLocalFactBundle({ instant: new Date('1985-06-14T16:10:00Z'), latitudeDegrees: 13.0827, longitudeDegrees: 80.2707 })
  assert.deepEqual(validateCelestialFactBundle(bundle), [])
  assert.deepEqual(bundle.facts.map((fact) => fact.subject.name), [...CLASSICAL_BODIES])
})

test('natal rules that survive policy actually apply', () => {
  const report = buildBirthReport({ date: '1985-06-14', time: '21:40', ...CHENNAI })
  const hellenistic = report.traditions.find((tradition) => tradition.traditionId === 'hellenistic-ptolemaic')
  assert.ok(hellenistic)
  assert.ok(hellenistic.modules.length >= 3, 'the benefic, malefic and common rules should all apply')
  for (const entry of hellenistic.modules) assert.ok(entry.passages.length > 0, `${entry.ruleId} has no passage`)
})

test('personality and appearance rules are withheld by policy, not quietly absent', () => {
  const report = buildBirthReport({ date: '1985-06-14', time: '21:40', ...CHENNAI })
  const hellenistic = report.traditions.find((tradition) => tradition.traditionId === 'hellenistic-ptolemaic')
  assert.ok(hellenistic)
  const withheldTechniques = new Set(hellenistic.withheld.filter((item) => item.reason === 'report-policy').map((item) => item.technique))
  for (const technique of ['bodily form', 'quality of mind', 'bodily injury', 'order of judgement']) {
    assert.ok(withheldTechniques.has(technique), `${technique} must appear as withheld`)
  }
})

test('electional rules do not leak into a natal report', () => {
  const report = buildBirthReport({ date: '1985-06-14', time: '21:40', ...CHENNAI })
  const jyotisha = report.traditions.find((tradition) => tradition.traditionId === 'vedic-jyotisha')
  assert.ok(jyotisha)
  assert.ok(jyotisha.withheld.some((item) => item.reason === 'chart-type-mismatch'))
  for (const entry of jyotisha.modules) assert.notEqual(entry.heading, 'karaṇa selection')
})

test('a report is reproducible from the same inputs', () => {
  const input = { date: '1985-06-14', time: '21:40', ...CHENNAI }
  const first = buildBirthReport(input)
  const second = buildBirthReport(input)
  assert.equal(first.factBundleId, second.factBundleId)
  assert.deepEqual(first.traditions.map((t) => t.reportId), second.traditions.map((t) => t.reportId))
})

test('bad input is rejected with a usable message', () => {
  assert.throws(() => buildBirthReport({ date: '1985-06-14', time: '21:40', timeZone: 'Not/AZone', latitudeDegrees: 13, longitudeDegrees: 80 }), BirthInputError)
  assert.throws(() => buildBirthReport({ date: '14-06-1985', time: '21:40', ...CHENNAI }), /YYYY-MM-DD/)
  assert.throws(() => buildBirthReport({ date: '1985-06-14', time: '21:40', ...CHENNAI, latitudeDegrees: 999 }), /Latitude/)
})
