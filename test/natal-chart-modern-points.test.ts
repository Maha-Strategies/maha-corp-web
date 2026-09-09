import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { CLASSICAL_BODIES, MODERN_BODIES, buildLocalFactBundle } from '../lib/local-fact-bundle.ts'
import { computeNatalChart } from '../lib/natal-chart.ts'
import { VIMSHOTTARI_LORDS } from '../lib/natal-timing.ts'

const ROOT = join(import.meta.dirname, '..')

/**
 * Uranus, Neptune and Pluto are reported next to the chart, never inside it.
 * Every assertion here is about that boundary. The classical structures --
 * placements, houses, rulership, aspects, Vimśottarī, the fact bundle and the
 * public-authority conformance corpus -- must be byte-for-byte unaffected by
 * the modern set existing.
 */
const INSTANT = new Date('1990-07-15T04:30:00Z')
const chart = () => computeNatalChart({ instant: INSTANT, latitudeDegrees: 13.0827, longitudeDegrees: 80.2707 })
const modernNames = new Set<string>(MODERN_BODIES)

test('the modern set is exactly the three outer planets', () => {
  assert.deepEqual([...MODERN_BODIES], ['Uranus', 'Neptune', 'Pluto'])
  assert.deepEqual(chart().modernPoints.map((entry) => entry.name), ['Uranus', 'Neptune', 'Pluto'])
})

test('the classical set did not absorb them', () => {
  assert.equal(CLASSICAL_BODIES.length, 7)
  for (const body of MODERN_BODIES) {
    assert.ok(!(CLASSICAL_BODIES as readonly string[]).includes(body), `${body} leaked into CLASSICAL_BODIES`)
  }
})

/** Nine placements: seven grahas plus the two nodes. Adding a tenth is the regression. */
test('placements remain the nine classical points', () => {
  const placements = chart().placements
  assert.equal(placements.length, 9)
  assert.deepEqual(placements.map((entry) => entry.name), [...CLASSICAL_BODIES, 'Rahu', 'Ketu'])
  assert.ok(!placements.some((entry) => modernNames.has(entry.name)))
})

test('modern points occupy no house and rule no sign', () => {
  const { houses } = chart()
  for (const house of houses) {
    assert.ok(!house.occupants.some((name) => modernNames.has(name)), `house ${house.number} lists a modern point`)
    assert.ok(!modernNames.has(house.ruler), `house ${house.number} is ruled by ${house.ruler}`)
  }
})

test('modern points form none of the reported aspects', () => {
  for (const aspect of chart().aspects) {
    assert.ok(!modernNames.has(aspect.first) && !modernNames.has(aspect.second), `${aspect.first}/${aspect.second} is a modern aspect`)
  }
})

/** The nine-lord sequence is closed. An outer planet in it would misreport the tradition. */
test('the Vimshottari sequence is untouched', () => {
  assert.equal(VIMSHOTTARI_LORDS.length, 9)
  for (const body of MODERN_BODIES) {
    assert.ok(!(VIMSHOTTARI_LORDS as readonly string[]).includes(body), `${body} entered the Vimshottari sequence`)
  }
})

test('the celestial fact bundle still carries the seven grahas only', () => {
  const bundle = buildLocalFactBundle({ instant: INSTANT, latitudeDegrees: 13.0827, longitudeDegrees: 80.2707 })
  assert.deepEqual(bundle.facts.map((fact) => fact.subject.name), [...CLASSICAL_BODIES])
})

/**
 * The corpus holds real JPL Horizons reference longitudes. Adding a body to it
 * would mean inventing a Horizons value, so the corpus must stay at seven and
 * the modern points must say they are outside it.
 */
test('the public-authority conformance corpus stays at the seven classical bodies', () => {
  const corpus = JSON.parse(readFileSync(join(ROOT, 'public/conformance/celestial-public-authority-v1.json'), 'utf8'))
  assert.deepEqual(Object.keys(corpus.jplHorizons.targetIds), [...CLASSICAL_BODIES])
  for (const kase of corpus.longitudeCases) {
    assert.deepEqual(Object.keys(kase.referenceLongitudes), [...CLASSICAL_BODIES])
  }
})

test('every modern point declares that it is outside the conformance corpus', () => {
  for (const entry of chart().modernPoints) {
    assert.match(entry.method, /astronomy-engine 2\.1\.19/)
    assert.match(entry.method, /Not covered by the public-authority conformance corpus/)
  }
})

test('the chart states the boundary in its methodology', () => {
  const methodology = chart().methodology.join(' ')
  assert.match(methodology, /Uranus, Neptune, and Pluto/)
  assert.match(methodology, /They are not grahas/)
  assert.match(methodology, /Vimśottarī/)
})

/**
 * Positions are computed, not stubbed. Checked against the frame the chart
 * declares rather than against a hardcoded longitude, so this survives an
 * ephemeris upgrade while still failing on a wiring mistake.
 */
test('modern longitudes are real, distinct, and consistent with the declared ayanamsa', () => {
  const result = chart()
  const longitudes = result.modernPoints.map((entry) => entry.sidereal.longitude)
  assert.equal(new Set(longitudes).size, 3, 'two modern points share a longitude')
  for (const entry of result.modernPoints) {
    assert.ok(Number.isFinite(entry.sidereal.longitude) && entry.sidereal.longitude >= 0 && entry.sidereal.longitude < 360)
    const expected = ((entry.tropical.longitude - result.ayanamsa.degrees) % 360 + 360) % 360
    assert.ok(Math.abs(expected - entry.sidereal.longitude) < 1e-9, `${entry.name} sidereal does not match tropical minus ayanamsa`)
    assert.ok(entry.dailyMotionDegrees !== null && Math.abs(entry.dailyMotionDegrees) < 0.1, `${entry.name} daily motion is implausible for an outer planet`)
  }
})

/**
 * Mid-1990: Uranus and Neptune in tropical Capricorn, Pluto in tropical Scorpio.
 * A sign-level check catches a swapped body or a sidereal/tropical mix-up
 * without pinning a longitude to the current ephemeris release.
 */
test('the computed 1990 positions match the known outer-planet placements', () => {
  const byName = new Map(chart().modernPoints.map((entry) => [entry.name, entry]))
  assert.equal(byName.get('Uranus')?.tropical.sign, 'Capricorn')
  assert.equal(byName.get('Neptune')?.tropical.sign, 'Capricorn')
  assert.equal(byName.get('Pluto')?.tropical.sign, 'Scorpio')
})
