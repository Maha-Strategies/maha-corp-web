import assert from 'node:assert/strict'
import test from 'node:test'

import { computeNatalChart } from '../lib/natal-chart.ts'

const FOUNDER = {
  instant: new Date('1992-12-01T02:09:00.000Z'),
  latitudeDegrees: 48.588,
  longitudeDegrees: -93.4084,
}

test('the founder chart reproduces the declared Lahiri whole-sign placements', () => {
  const chart = computeNatalChart(FOUNDER)
  assert.equal(chart.ascendant.sidereal.sign, 'Cancer')
  assert.equal(chart.ascendant.wholeSignHouse, 1)

  const placements = new Map(chart.placements.map((entry) => [entry.name, entry]))
  const expected = {
    Mars: ['Cancer', 1],
    Jupiter: ['Virgo', 3],
    Mercury: ['Libra', 4],
    Sun: ['Scorpio', 5],
    Rahu: ['Scorpio', 5],
    Venus: ['Sagittarius', 6],
    Saturn: ['Capricorn', 7],
    Moon: ['Aquarius', 8],
    Ketu: ['Taurus', 11],
  } as const

  for (const [name, [sign, house]] of Object.entries(expected)) {
    const placement = placements.get(name as typeof chart.placements[number]['name'])
    assert.ok(placement, `${name} is absent`)
    assert.equal(placement.sidereal.sign, sign, `${name} sidereal sign`)
    assert.equal(placement.wholeSignHouse, house, `${name} whole-sign house`)
  }
})

test('tropical and sidereal frames remain separately inspectable', () => {
  const chart = computeNatalChart(FOUNDER)
  const sun = chart.placements.find((entry) => entry.name === 'Sun')!
  assert.equal(sun.tropical.sign, 'Sagittarius')
  assert.equal(sun.sidereal.sign, 'Scorpio')
  assert.ok(chart.ayanamsa.degrees > 23 && chart.ayanamsa.degrees < 24)
  assert.match(chart.methodology.join(' '), /not evidence/i)
})

test('every chart point carries a nakshatra, pada, house, and calculation method', () => {
  const chart = computeNatalChart(FOUNDER)
  for (const point of [chart.ascendant, ...chart.placements]) {
    assert.ok(point.nakshatra.index >= 1 && point.nakshatra.index <= 27)
    assert.ok(point.nakshatra.pada >= 1 && point.nakshatra.pada <= 4)
    assert.ok(point.wholeSignHouse >= 1 && point.wholeSignHouse <= 12)
    assert.ok(point.method.length > 20)
  }
  assert.equal(chart.nodeModel, 'mean-lunar-node')
  assert.equal(chart.houseSystem, 'whole-sign')
})

test('the founder house-lord network is computed from the Cancer whole-sign ascendant', () => {
  const chart = computeNatalChart(FOUNDER)
  const expected = [
    [1, 'Cancer', 'Moon', 8], [2, 'Leo', 'Sun', 5], [3, 'Virgo', 'Mercury', 4],
    [4, 'Libra', 'Venus', 6], [5, 'Scorpio', 'Mars', 1], [6, 'Sagittarius', 'Jupiter', 3],
    [7, 'Capricorn', 'Saturn', 7], [8, 'Aquarius', 'Saturn', 7], [9, 'Pisces', 'Jupiter', 3],
    [10, 'Aries', 'Mars', 1], [11, 'Taurus', 'Venus', 6], [12, 'Gemini', 'Mercury', 4],
  ] as const
  assert.equal(chart.houses.length, 12)
  for (const [number, sign, ruler, rulerHouse] of expected) {
    const house = chart.houses[number - 1]
    assert.equal(house.sign, sign, `house ${number} sign`)
    assert.equal(house.ruler, ruler, `house ${number} ruler`)
    assert.equal(house.rulerHouse, rulerHouse, `house ${number} ruler placement`)
  }
  assert.deepEqual(chart.houses[4].occupants, ['Sun', 'Rahu'])
})

test('aspects preserve exact geometry and declared orb conventions', () => {
  const chart = computeNatalChart(FOUNDER)
  const nodeOpposition = chart.aspects.find((aspect) =>
    aspect.name === 'opposition' && new Set([aspect.first, aspect.second]).has('Rahu')
    && new Set([aspect.first, aspect.second]).has('Ketu'))
  assert.ok(nodeOpposition)
  assert.ok(nodeOpposition.orbDegrees < 1e-9)
  assert.equal(nodeOpposition.separationDegrees, 180)
  assert.ok(chart.aspects.every((aspect) => aspect.orbDegrees <= aspect.maximumOrbDegrees))
  assert.deepEqual([...chart.aspects].sort((a, b) => a.orbDegrees - b.orbDegrees), chart.aspects)
  assert.match(chart.methodology.join(' '), /aspect.*orbs/i)
})

test('the nodal axis is explicit rather than inferred in narrative', () => {
  const chart = computeNatalChart(FOUNDER)
  assert.deepEqual(chart.nodalAxis.rahu, { sign: 'Scorpio', house: 5 })
  assert.deepEqual(chart.nodalAxis.ketu, { sign: 'Taurus', house: 11 })
  assert.equal(chart.nodalAxis.separationDegrees, 180)
})
