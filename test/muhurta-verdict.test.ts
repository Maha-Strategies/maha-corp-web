import assert from 'node:assert/strict'
import test from 'node:test'

import { SearchMoonPhase } from 'astronomy-engine'

import { ASTROLOGY_PASSAGES, ASTROLOGY_RULES, getRulesForTradition } from '../lib/astrology-traditions.ts'
import { CELESTIAL_AUTHORITY_SOURCES, validateCelestialFactBundle } from '../lib/celestial-facts.ts'
import { compileReport } from '../lib/interpretation-compiler.ts'
import { LOCAL_EPHEMERIS_SOURCE_ID, buildLocalFactBundle } from '../lib/local-fact-bundle.ts'
import { parseInstant } from '../lib/muhurta-input.ts'
import { NAKSHATRA_NAMES, VARA_NAMES } from '../lib/panchanga.ts'

const UJJAIN = { latitudeDegrees: 23.1765, longitudeDegrees: 75.7885, elevationMeters: 494 }

function verdictAt(elongation: number) {
  const found = SearchMoonPhase(elongation, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(found)
  const factBundle = buildLocalFactBundle({ instant: found.date, ...UJJAIN })
  return compileReport({ factBundle, traditionId: 'vedic-jyotisha', chartType: 'electional' })
}

test('the local ephemeris is a registered authority, not a borrowed one', () => {
  const source = CELESTIAL_AUTHORITY_SOURCES.find((candidate) => candidate.id === LOCAL_EPHEMERIS_SOURCE_ID)
  assert.ok(source, 'astronomy-engine must be registered before facts may cite it')
  assert.equal(source.role, 'ephemeris')
  // The boundary must admit that this is a local computation, since labelling
  // it as a fetched provider response would be fabricated provenance.
  assert.match(source.boundary, /computed in process rather than fetched/i)
})

test('a locally built bundle satisfies the fact contract', () => {
  const bundle = buildLocalFactBundle({ instant: new Date('2026-08-16T05:28:00Z'), ...UJJAIN })
  assert.deepEqual(validateCelestialFactBundle(bundle), [])
  for (const fact of bundle.facts) {
    assert.equal(fact.provenance.providerSourceId, LOCAL_EPHEMERIS_SOURCE_ID)
    assert.equal(fact.provenance.software?.name, 'astronomy-engine')
    assert.ok(fact.provenance.limitations.some((limitation) => /not a provider response body/i.test(limitation)))
  }
})

test('the bundle id is stable for the same moment and place', () => {
  const input = { instant: new Date('2026-08-16T05:28:00Z'), ...UJJAIN }
  assert.equal(buildLocalFactBundle(input).bundleId, buildLocalFactBundle(input).bundleId)
  assert.notEqual(
    buildLocalFactBundle(input).bundleId,
    buildLocalFactBundle({ ...input, latitudeDegrees: 13.0827 }).bundleId,
  )
})

test('a Viṣṭi moment over Ujjain compiles a multi-limb verdict', () => {
  const report = verdictAt(45)
  assert.equal(report.panchanga?.karana.name, 'Viṣṭi')
  const observed = report.modules.flatMap((entry) => entry.observedLimbs)
  assert.ok(observed.includes('karana=Viṣṭi'))
  // The corpus now reaches beyond karaṇa.
  assert.ok(observed.some((limb) => limb.startsWith('nakshatra=')), 'a nakshatra rule should fire')
  assert.ok(observed.some((limb) => limb.startsWith('vara=')), 'a vāra rule should fire')
})

test('every rule remains accounted for as reported or withheld', () => {
  const report = verdictAt(45)
  const accounted = new Set([...report.modules.map((m) => m.ruleId), ...report.exclusions.map((e) => e.ruleId)])
  assert.equal(accounted.size, getRulesForTradition('vedic-jyotisha').length)
})

test('nakshatra rules name only nakshatras the pañcāṅga can produce', () => {
  // A rule keyed to a name the computation never emits would silently never fire.
  const canonical = new Set<string>(NAKSHATRA_NAMES)
  const varas = new Set<string>(VARA_NAMES)
  for (const rule of ASTROLOGY_RULES) {
    for (const condition of rule.conditions) {
      if (condition.requiresLimb?.limb === 'nakshatra') {
        for (const name of condition.requiresLimb.anyOf) assert.ok(canonical.has(name), `${rule.id} names unknown nakshatra ${name}`)
      }
      if (condition.requiresLimb?.limb === 'vara') {
        for (const name of condition.requiresLimb.anyOf) assert.ok(varas.has(name), `${rule.id} names unknown vāra ${name}`)
      }
    }
  }
})

test('the Bṛhat Saṃhitā transcription records the edition’s own errors', () => {
  const printed = ASTROLOGY_PASSAGES.find((passage) => passage.id === 'bs-98-6-dhruva-acts')
  assert.ok(printed)
  assert.match(printed.excerpt, /shall he commenced/, 'the compositor error is transcribed as printed')
  assert.match(printed.transcriptionNote ?? '', /compositor/i)
})

test('the Riktā claim was corrected once the further chapter was read', () => {
  // Chapter 98 verse 13 prohibits an act on Riktā tithis, so the earlier
  // "purely later doctrine" note was an overstatement.
  const rule = ASTROLOGY_RULES.find((candidate) => candidate.id === 'bs-tithi-groups')
  assert.ok(rule)
  const joined = rule.disagreements.join(' ')
  assert.match(joined, /Chapter 98 verse 13/)
  assert.match(joined, /corrected/)
  const verse = ASTROLOGY_PASSAGES.find((passage) => passage.id === 'bs-98-13-prohibited-times')
  assert.ok(verse)
  assert.match(verse.excerpt, /Rikta Tithis/)
})

test('a verdict never claims empirical support', () => {
  const report = verdictAt(45)
  assert.match(report.epistemicBoundary, /no evidence that any of it predicts anything/)
  for (const entry of report.modules) {
    assert.match(entry.boundary, /no empirical support|says nothing about whether the tradition predicts/)
  }
})

test('the moment field is read as UTC, not as server-local time', () => {
  // A bare datetime would otherwise be parsed as local time and silently shift
  // the instant by the server's offset, changing the verdict.
  assert.equal(parseInstant('2026-08-16T05:28').instant.toISOString(), '2026-08-16T05:28:00.000Z')
  assert.equal(parseInstant('2026-08-16T05:28Z').instant.toISOString(), '2026-08-16T05:28:00.000Z')
  assert.equal(parseInstant('2026-08-16T11:28+06:00').instant.toISOString(), '2026-08-16T05:28:00.000Z')
  assert.equal(parseInstant('nonsense').invalid, true)
})
