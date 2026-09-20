import { test } from 'node:test'
import assert from 'node:assert/strict'

import { computeGeometry, sphereSpecificSurfaceAreaM2PerG } from '../lib/nanoscale-geometry.ts'

/**
 * The calculator's value is that it is checkable, so these tests check it
 * against closed forms and against its own refusals — not against a stored
 * snapshot of what it happened to print.
 */

const sphere = (diameter: number, density = 4, lengthUnit: 'nm' | 'µm' | 'mm' | 'm' = 'nm') =>
  computeGeometry({ shape: { kind: 'sphere', diameter }, lengthUnit, density, densityUnit: 'g/cm3' })

test('sphere agrees with the closed form 6/(rho*d)', () => {
  for (const [diameterNm, densityGPerCm3] of [[10, 4], [1, 1], [250, 2.65], [5, 19.3]]) {
    const result = sphere(diameterNm, densityGPerCm3)
    const expected = sphereSpecificSurfaceAreaM2PerG(diameterNm * 1e-9, densityGPerCm3 * 1000)
    assert.ok(Math.abs(result.specificSurfaceAreaM2PerG - expected) / expected < 1e-12, `${diameterNm} nm`)
  }
  // The worked case published on the example page.
  const published = sphere(10, 4)
  assert.ok(Math.abs(published.specificSurfaceAreaM2PerG - 150) < 1e-9, 'a 10 nm sphere at 4.0 g/cm³ is 150 m²/g')
  assert.ok(Math.abs(published.areaPerVolumePerM - 6e8) / 6e8 < 1e-12, 'area/volume is 6/d')
})

test('the same unit expressed differently gives the same answer', () => {
  const inNm = sphere(1000)
  const inMicrons = computeGeometry({ shape: { kind: 'sphere', diameter: 1 }, lengthUnit: 'µm', density: 4, densityUnit: 'g/cm3' })
  const inMetres = computeGeometry({ shape: { kind: 'sphere', diameter: 1e-6 }, lengthUnit: 'm', density: 4, densityUnit: 'g/cm3' })
  for (const other of [inMicrons, inMetres]) {
    assert.ok(Math.abs(other.specificSurfaceAreaM2PerG - inNm.specificSurfaceAreaM2PerG) / inNm.specificSurfaceAreaM2PerG < 1e-12)
  }
  // Density units must reconcile too: 4 g/cm³ is 4000 kg/m³.
  const byKgPerM3 = computeGeometry({ shape: { kind: 'sphere', diameter: 10 }, lengthUnit: 'nm', density: 4000, densityUnit: 'kg/m3' })
  assert.ok(Math.abs(byKgPerM3.specificSurfaceAreaM2PerG - sphere(10).specificSurfaceAreaM2PerG) < 1e-9)
})

test('smaller means more surface per unit volume, exactly inversely', () => {
  const big = sphere(100)
  const small = sphere(10)
  assert.ok(small.areaPerVolumePerM > big.areaPerVolumePerM)
  assert.ok(Math.abs(small.areaPerVolumePerM / big.areaPerVolumePerM - 10) < 1e-9, 'ten times smaller is ten times the ratio')
})

test('shape matters at constant volume: the counterexample to size-only reasoning', () => {
  // A sphere and a platelet of the same volume have very different surface.
  const s = sphere(10)
  const platelet = computeGeometry({
    shape: { kind: 'platelet', edge: 100, thickness: 0.0523598775598299 },
    lengthUnit: 'nm',
    density: 4,
    densityUnit: 'g/cm3',
  })
  assert.ok(Math.abs(platelet.volumeM3 - s.volumeM3) / s.volumeM3 < 1e-6, 'the two shapes were matched on volume')
  assert.ok(
    platelet.specificSurfaceAreaM2PerG > s.specificSurfaceAreaM2PerG * 2,
    'at equal volume the platelet has far more surface, so a size number alone cannot predict it',
  )
  // Anisotropy in the other direction: a long thin rod also beats the sphere.
  const rod = computeGeometry({ shape: { kind: 'rod', diameter: 2, length: 200 }, lengthUnit: 'nm', density: 4, densityUnit: 'g/cm3' })
  assert.ok(rod.specificSurfaceAreaM2PerG > s.specificSurfaceAreaM2PerG)
})

test('every result carries its dimensional check and its assumptions', () => {
  const result = sphere(10)
  assert.ok(result.dimensionalChecks.length >= 5)
  assert.ok(result.dimensionalChecks.some((line) => line.includes('m²/g')))
  assert.ok(result.assumptions.some((line) => /reactivity|hazard|exposure/i.test(line)), 'the geometry-only boundary must travel with the number')
  assert.ok(result.assumptions.some((line) => /distribution|aggregat/i.test(line)))
})

test('it refuses rather than returning a meaningless number', () => {
  const refusals: [string, () => unknown][] = [
    ['zero diameter', () => sphere(0)],
    ['negative diameter', () => sphere(-5)],
    ['non-finite diameter', () => sphere(Number.NaN)],
    ['zero density', () => sphere(10, 0)],
    ['negative density', () => sphere(10, -1)],
    ['zero rod length', () => computeGeometry({ shape: { kind: 'rod', diameter: 5, length: 0 }, lengthUnit: 'nm', density: 4, densityUnit: 'g/cm3' })],
    ['zero platelet thickness', () => computeGeometry({ shape: { kind: 'platelet', edge: 100, thickness: 0 }, lengthUnit: 'nm', density: 4, densityUnit: 'g/cm3' })],
    // @ts-expect-error deliberately unsupported unit
    ['unsupported length unit', () => computeGeometry({ shape: { kind: 'sphere', diameter: 10 }, lengthUnit: 'angstrom', density: 4, densityUnit: 'g/cm3' })],
    // @ts-expect-error deliberately unsupported density unit
    ['unsupported density unit', () => computeGeometry({ shape: { kind: 'sphere', diameter: 10 }, lengthUnit: 'nm', density: 4, densityUnit: 'lb/ft3' })],
    // @ts-expect-error deliberately unsupported shape
    ['unsupported shape', () => computeGeometry({ shape: { kind: 'dodecahedron', edge: 10 }, lengthUnit: 'nm', density: 4, densityUnit: 'g/cm3' })],
  ]
  for (const [name, call] of refusals) {
    assert.throws(call, /must|Unsupported/, `${name} should be refused, not computed`)
  }
})

test('the calculation is deterministic', () => {
  const first = sphere(37.5, 2.65)
  const second = sphere(37.5, 2.65)
  assert.deepEqual(first, second)
})
