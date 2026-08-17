import assert from 'node:assert/strict'
import test from 'node:test'

import { computeNatalChart } from '../lib/natal-chart.ts'
import { computeNatalTiming, VIMSHOTTARI_YEARS } from '../lib/natal-timing.ts'

const FOUNDER = {
  instant: new Date('1992-12-01T02:09:00.000Z'),
  latitudeDegrees: 48.588,
  longitudeDegrees: -93.4084,
}

function founderTiming(referenceInstant: Date) {
  const natalChart = computeNatalChart(FOUNDER)
  return computeNatalTiming({
    natalChart,
    birthInstant: FOUNDER.instant,
    referenceInstant,
    latitudeDegrees: FOUNDER.latitudeDegrees,
    longitudeDegrees: FOUNDER.longitudeDegrees,
  })
}

test('the founder timing resolves the August 2026 Jupiter/Rahu boundary', () => {
  const timing = founderTiming(new Date('2026-08-17T06:45:00.000Z'))
  assert.equal(timing.vimshottari.moonNakshatra.name, 'Dhaniṣṭhā')
  assert.equal(timing.vimshottari.startingLord, 'Mars')
  assert.ok(Math.abs(timing.vimshottari.balanceAtBirthYears - 2.1056241960) < 1e-8)
  assert.equal(timing.vimshottari.balanceMethod, 'actual-nakshatra-stay-time')
  assert.equal(timing.vimshottari.birthNakshatraIngressUtc, '1992-11-30T07:20:45.066Z')
  assert.equal(timing.vimshottari.birthNakshatraEgressUtc, '1992-12-01T10:14:23.242Z')
  assert.equal(timing.vimshottari.activeMahadasha.lord, 'Jupiter')
  assert.equal(timing.vimshottari.activeAntardasha.lord, 'Rahu')
  assert.equal(timing.vimshottari.activeAntardasha.startUtc, '2026-08-15T19:35:04.883Z')
  assert.equal(timing.vimshottari.nextTransition.lord, 'Saturn')
  assert.equal(timing.vimshottari.nextTransition.atUtc, '2029-01-08T09:33:09.683Z')
})

test('Vimshottari major and sub-periods are contiguous and preserve the 120-year proportions', () => {
  const timing = founderTiming(new Date('2026-08-17T06:45:00.000Z')).vimshottari
  assert.equal(timing.mahadashas.length, 9)
  assert.equal(timing.mahadashas.reduce((sum, entry) => sum + entry.nominalYears, 0), 120)
  for (let index = 1; index < timing.mahadashas.length; index += 1) {
    assert.equal(timing.mahadashas[index - 1].endUtc, timing.mahadashas[index].startUtc)
  }
  assert.equal(timing.antardashas.length, 9)
  assert.equal(timing.antardashas[0].lord, timing.activeMahadasha.lord)
  assert.ok(Math.abs(timing.antardashas.reduce((sum, entry) => sum + entry.nominalYears, 0) - timing.activeMahadasha.nominalYears) < 1e-12)
  for (const entry of timing.antardashas) {
    assert.equal(entry.nominalYears, timing.activeMahadasha.nominalYears * VIMSHOTTARI_YEARS[entry.lord] / 120)
  }
})

test('transits are expressed against natal houses and a declared contact profile', () => {
  const timing = founderTiming(new Date('2026-08-17T06:45:00.000Z'))
  const placements = new Map(timing.transits.placements.map((entry) => [entry.point, entry]))
  assert.equal(placements.get('Jupiter')?.siderealSign, 'Cancer')
  assert.equal(placements.get('Jupiter')?.natalWholeSignHouse, 1)
  assert.equal(placements.get('Saturn')?.natalWholeSignHouse, 9)
  assert.equal(placements.get('Rahu')?.natalWholeSignHouse, 8)
  assert.equal(placements.get('Ketu')?.natalWholeSignHouse, 2)
  assert.ok(timing.transits.contacts.every((entry) => entry.orbDegrees <= entry.maximumOrbDegrees))
  assert.deepEqual([...timing.transits.contacts].sort((a, b) => a.orbDegrees - b.orbDegrees), timing.transits.contacts)
  assert.match(timing.methodology.join(' '), /not presented as a universal Vedic aspect doctrine/i)
  assert.match(timing.methodology.join(' '), /do not establish that an event will occur/i)
})

test('a timing reference before birth is rejected', () => {
  assert.throws(() => founderTiming(new Date('1992-11-30T00:00:00.000Z')), /cannot precede the birth instant/)
})
