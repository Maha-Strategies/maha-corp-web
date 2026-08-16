import assert from 'node:assert/strict'
import test from 'node:test'

import { SearchMoonPhase } from 'astronomy-engine'

import {
  BOUNDARY_TOLERANCE_DEGREES,
  NAKSHATRA_NAMES,
  YOGA_NAMES,
  computePanchanga,
  lahiriAyanamsa,
} from '../lib/panchanga.ts'

/** Chennai, a reference location for published pañcāṅga tables. */
const CHENNAI = { latitudeDegrees: 13.0827, longitudeDegrees: 80.2707 }

test('Lahiri ayanāṁśa matches published anchors', () => {
  // Indian Calendar Reform Committee value at J2000.0, and two further anchors.
  assert.ok(Math.abs(lahiriAyanamsa(new Date('2000-01-01T12:00:00Z')) - 23.853) < 0.01)
  assert.ok(Math.abs(lahiriAyanamsa(new Date('1950-01-01T00:00:00Z')) - 23.155) < 0.02)
  assert.ok(Math.abs(lahiriAyanamsa(new Date('2026-08-16T00:00:00Z')) - 24.225) < 0.02)
})

test('ayanāṁśa advances at the general precession rate', () => {
  const rate = lahiriAyanamsa(new Date('2100-01-01T00:00:00Z')) - lahiriAyanamsa(new Date('2000-01-01T00:00:00Z'))
  // ~5028.8 arcsec/century, i.e. about 1.397 degrees.
  assert.ok(Math.abs(rate - 1.397) < 0.005, `precession over a century was ${rate}`)
})

test('a true new moon is Śukla Pratipadā', () => {
  // Checked against astronomy-engine's own phase search, which is an
  // independent path to the same geometry.
  const newMoon = SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(newMoon)
  const panchanga = computePanchanga({ instant: new Date(newMoon.date.getTime() + 60_000), ...CHENNAI })
  assert.equal(panchanga.tithi.absoluteIndex, 1)
  assert.equal(panchanga.tithi.paksha, 'śukla')
  assert.equal(panchanga.tithi.name, 'Pratipadā')
})

test('a true full moon opens the dark fortnight', () => {
  const fullMoon = SearchMoonPhase(180, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(fullMoon)
  const panchanga = computePanchanga({ instant: new Date(fullMoon.date.getTime() + 60_000), ...CHENNAI })
  assert.equal(panchanga.tithi.absoluteIndex, 16)
  assert.equal(panchanga.tithi.paksha, 'kṛṣṇa')
})

test('the fifteenth tithi of each fortnight is named for the moon, not numbered', () => {
  const fullMoon = SearchMoonPhase(180, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(fullMoon)
  const purnima = computePanchanga({ instant: new Date(fullMoon.date.getTime() - 60_000), ...CHENNAI })
  assert.equal(purnima.tithi.name, 'Pūrṇimā')

  const newMoon = SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(newMoon)
  const amavasya = computePanchanga({ instant: new Date(newMoon.date.getTime() - 60_000), ...CHENNAI })
  assert.equal(amavasya.tithi.name, 'Amāvāsyā')
})

test('the lunar month opens with Kiṃstughna and closes with the fixed karaṇas', () => {
  const newMoon = SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(newMoon)
  assert.equal(computePanchanga({ instant: new Date(newMoon.date.getTime() + 60_000), ...CHENNAI }).karana.name, 'Kiṃstughna')
  assert.equal(computePanchanga({ instant: new Date(newMoon.date.getTime() - 60_000), ...CHENNAI }).karana.name, 'Nāga')
})

test('the fixed karaṇas begin where the Bṛhat Saṃhitā says they do', () => {
  // Chapter 99 verse 5: the four fixed karaṇas "begin from the second half of
  // the 14th day of the waning moon". The 14th waning tithi is the 29th of the
  // lunar month, spanning 336°–348° of elongation, so its second half begins at
  // 342°. This checks an independently implemented sequence against a 6th-century
  // structural claim — it validates the arithmetic, not the tradition.
  const secondHalf = SearchMoonPhase(343, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(secondHalf)
  const panchanga = computePanchanga({ instant: secondHalf.date, ...CHENNAI })
  assert.equal(panchanga.tithi.absoluteIndex, 29, 'the 14th day of the waning moon')
  assert.equal(panchanga.tithi.paksha, 'kṛṣṇa')
  assert.equal(panchanga.karana.name, 'Śakuni', 'the first fixed karaṇa')

  // The first half of the same tithi is still a movable karaṇa.
  const firstHalf = SearchMoonPhase(339, new Date('2026-08-01T00:00:00Z'), 40)
  assert.ok(firstHalf)
  assert.equal(computePanchanga({ instant: firstHalf.date, ...CHENNAI }).karana.name, 'Viṣṭi')
})

test('tithi and karaṇa do not depend on the ayanāṁśa', () => {
  // Both derive from the Sun–Moon elongation, so a different sidereal zero
  // point must leave them untouched. Nakshatra and yoga are not so lucky, which
  // is why the ayanāṁśa is reported alongside them.
  const instant = new Date('2026-08-16T06:00:00Z')
  const panchanga = computePanchanga({ instant, ...CHENNAI })
  const shifted = (panchanga.moonLongitudeTropical - panchanga.sunLongitudeTropical + 360) % 360
  assert.ok(Math.abs(shifted - panchanga.elongation) < 1e-9)
})

test('sunrise, sunset, and vāra agree with the civil day at Chennai', () => {
  const panchanga = computePanchanga({ instant: new Date('2026-08-16T06:00:00Z'), ...CHENNAI })
  assert.ok(panchanga.day.sunrise && panchanga.day.sunset)
  // 2026-08-16 is a Sunday; sunrise near 05:57 IST is 00:27Z.
  assert.equal(panchanga.vara.name, 'Ravivāra')
  assert.match(panchanga.day.sunrise, /^2026-08-16T00:2/)
  assert.match(panchanga.day.sunset, /^2026-08-16T12:5/)
})

test('Rāhu Kāla takes the correct eighth of daylight for the weekday', () => {
  const sunday = computePanchanga({ instant: new Date('2026-08-16T06:00:00Z'), ...CHENNAI })
  assert.ok(sunday.rahuKala)
  assert.equal(sunday.rahuKala.segment, 8, 'Sunday takes the eighth segment')
  // The eighth segment ends at sunset.
  assert.equal(sunday.rahuKala.end.slice(0, 16), sunday.day.sunset?.slice(0, 16))

  const monday = computePanchanga({ instant: new Date('2026-08-17T06:00:00Z'), ...CHENNAI })
  assert.ok(monday.rahuKala)
  assert.equal(monday.rahuKala.segment, 2, 'Monday takes the second segment')
})

test('limb indices stay inside their cycles across a full year', () => {
  for (let day = 0; day < 365; day += 7) {
    const instant = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000)
    const panchanga = computePanchanga({ instant, ...CHENNAI })
    assert.ok(panchanga.tithi.absoluteIndex >= 1 && panchanga.tithi.absoluteIndex <= 30, `tithi ${panchanga.tithi.absoluteIndex}`)
    assert.ok(panchanga.nakshatra.index >= 1 && panchanga.nakshatra.index <= 27)
    assert.ok(panchanga.yoga.index >= 1 && panchanga.yoga.index <= 27)
    assert.ok(panchanga.karana.index >= 1 && panchanga.karana.index <= 60)
    assert.ok(NAKSHATRA_NAMES.includes(panchanga.nakshatra.name as never))
    assert.ok(YOGA_NAMES.includes(panchanga.yoga.name as never))
  }
})

test('values near a division edge are flagged rather than asserted', () => {
  // Walk in fine steps until the Moon sits within tolerance of a nakshatra
  // boundary, then confirm the flag is raised.
  let flagged = false
  for (let minutes = 0; minutes < 60 * 30 && !flagged; minutes += 3) {
    const instant = new Date(Date.UTC(2026, 7, 16) + minutes * 60_000)
    const panchanga = computePanchanga({ instant, ...CHENNAI })
    if (panchanga.nakshatra.nearBoundary) {
      flagged = true
      assert.ok(panchanga.uncertainLimbs.includes('nakshatra'))
      const degreesIntoDivision = panchanga.nakshatra.fraction * (360 / 27)
      const toEdge = Math.min(degreesIntoDivision, (360 / 27) - degreesIntoDivision)
      assert.ok(toEdge <= BOUNDARY_TOLERANCE_DEGREES + 1e-9)
    }
  }
  assert.ok(flagged, 'a boundary should occur within a month of stepping')
})

test('polar latitudes report undefined day periods instead of inventing them', () => {
  // Longyearbyen in midsummer: the Sun does not set, so Rāhu Kāla is undefined.
  const panchanga = computePanchanga({ instant: new Date('2026-06-21T12:00:00Z'), latitudeDegrees: 78.22, longitudeDegrees: 15.65 })
  assert.equal(panchanga.rahuKala, null)
  assert.ok(panchanga.day.note)
  // The lunar limbs are still well defined; only the day-fraction periods fail.
  assert.ok(panchanga.tithi.absoluteIndex >= 1)
})

test('invalid input is rejected', () => {
  assert.throws(() => computePanchanga({ instant: new Date('nope'), ...CHENNAI }), /valid instant/)
  assert.throws(() => computePanchanga({ instant: new Date(), latitudeDegrees: 100, longitudeDegrees: 0 }), /Latitude/)
  assert.throws(() => computePanchanga({ instant: new Date(), latitudeDegrees: 0, longitudeDegrees: 200 }), /Longitude/)
})

test('computation is deterministic', () => {
  const input = { instant: new Date('2026-08-16T06:00:00Z'), ...CHENNAI }
  assert.deepEqual(computePanchanga(input), computePanchanga(input))
})

test('the result reports its ayanāṁśa and never claims auspiciousness', () => {
  const panchanga = computePanchanga({ instant: new Date('2026-08-16T06:00:00Z'), ...CHENNAI })
  assert.equal(panchanga.ayanamsa.name, 'lahiri')
  assert.match(panchanga.ayanamsa.accuracyNote, /different ayanāṁśa shifts nakshatra and yoga/)
  // This layer is calendrical. Any notion of auspiciousness belongs to a
  // sourced tradition rule, not to the arithmetic.
  assert.ok(!JSON.stringify(panchanga).toLowerCase().includes('auspicious'))
})
