/** Local, offline surface-area-to-volume calculator. No network, no writes. */
import { computeGeometry, type GeometryInput, type LengthUnit, type DensityUnit } from '../lib/nanoscale-geometry.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const shapeKind = flag('shape', 'sphere')!
const size = Number(flag('size', '10'))
const second = Number(flag('second', '0'))
const lengthUnit = (flag('unit', 'nm') ?? 'nm') as LengthUnit
const density = Number(flag('density', '4'))
const densityUnit = (flag('density-unit', 'g/cm3') ?? 'g/cm3') as DensityUnit

const shape: GeometryInput['shape'] =
  shapeKind === 'cube' ? { kind: 'cube', edge: size }
  : shapeKind === 'rod' ? { kind: 'rod', diameter: size, length: second || size * 10 }
  : shapeKind === 'platelet' ? { kind: 'platelet', edge: size, thickness: second || size / 10 }
  : { kind: 'sphere', diameter: size }

const result = computeGeometry({ shape, lengthUnit, density, densityUnit })
console.log(JSON.stringify({
  input: { shape, lengthUnit, density, densityUnit },
  specificSurfaceArea_m2_per_g: Number(result.specificSurfaceAreaM2PerG.toPrecision(4)),
  areaPerVolume_per_m: Number(result.areaPerVolumePerM.toPrecision(4)),
  area_m2: result.areaM2,
  volume_m3: result.volumeM3,
  mass_kg: result.massKg,
  dimensionalChecks: result.dimensionalChecks,
  assumptions: result.assumptions,
}, null, 2))
