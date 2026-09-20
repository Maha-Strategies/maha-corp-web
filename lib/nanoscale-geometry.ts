/**
 * Unit-aware surface-area-to-volume calculation for idealised particles.
 *
 * Deterministic, dependency-free and deliberately narrow. It computes what
 * geometry determines — area, volume, the area-to-volume ratio and specific
 * surface area per gram — and refuses everything else. Geometry does not
 * predict reactivity, dissolution, toxicity or performance, and a real powder
 * has roughness, porosity, a size distribution and aggregates that none of
 * these shapes represent.
 *
 * Every input carries its unit. Internally the calculation works in metres and
 * kilograms per cubic metre, and each result records the dimensional check
 * that produced its unit, so a reviewer can follow the conversion rather than
 * trust it.
 */

export const LENGTH_UNITS = { nm: 1e-9, µm: 1e-6, um: 1e-6, mm: 1e-3, m: 1 } as const
export type LengthUnit = keyof typeof LENGTH_UNITS

/** Density units, converted to kg/m³. */
export const DENSITY_UNITS = { 'g/cm3': 1000, 'kg/m3': 1 } as const
export type DensityUnit = keyof typeof DENSITY_UNITS

export type Shape =
  | { kind: 'sphere'; diameter: number }
  | { kind: 'cube'; edge: number }
  /** A circular cylinder: a rod or a wire. */
  | { kind: 'rod'; diameter: number; length: number }
  /** A square platelet of the given thickness: a sheet or flake. */
  | { kind: 'platelet'; edge: number; thickness: number }

export type GeometryInput = {
  shape: Shape
  lengthUnit: LengthUnit
  density: number
  densityUnit: DensityUnit
}

export type GeometryResult = {
  shape: Shape['kind']
  /** Surface area of one particle, m². */
  areaM2: number
  /** Volume of one particle, m³. */
  volumeM3: number
  /** Area divided by volume, 1/m. Rises as the particle shrinks. */
  areaPerVolumePerM: number
  /** Mass of one particle, kg. */
  massKg: number
  /** Specific surface area, m²/g — the figure datasheets usually quote. */
  specificSurfaceAreaM2PerG: number
  /** The dimensional reasoning behind each unit, in order. */
  dimensionalChecks: string[]
  /** Everything the caller declared, echoed for the record. */
  assumptions: string[]
}

function positive(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number.`)
  if (value <= 0) throw new Error(`${field} must be greater than zero; a zero or negative dimension has no surface.`)
  return value
}

function lengthToMetres(value: number, field: string, unit: LengthUnit): number {
  if (!Object.hasOwn(LENGTH_UNITS, unit)) throw new Error(`Unsupported length unit: ${String(unit)}. Use nm, µm, mm or m.`)
  return positive(value, field) * LENGTH_UNITS[unit]
}

/** Area and volume for one idealised particle, in metres. */
function areaAndVolume(shape: Shape, unit: LengthUnit): { area: number; volume: number; checks: string[] } {
  switch (shape.kind) {
    case 'sphere': {
      const d = lengthToMetres(shape.diameter, 'diameter', unit)
      return {
        area: Math.PI * d ** 2,
        volume: (Math.PI / 6) * d ** 3,
        checks: ['sphere area = π·d² → m²', 'sphere volume = (π/6)·d³ → m³'],
      }
    }
    case 'cube': {
      const a = lengthToMetres(shape.edge, 'edge', unit)
      return { area: 6 * a ** 2, volume: a ** 3, checks: ['cube area = 6·a² → m²', 'cube volume = a³ → m³'] }
    }
    case 'rod': {
      const d = lengthToMetres(shape.diameter, 'diameter', unit)
      const l = lengthToMetres(shape.length, 'length', unit)
      return {
        area: Math.PI * d * l + 2 * Math.PI * (d / 2) ** 2,
        volume: Math.PI * (d / 2) ** 2 * l,
        checks: ['rod area = π·d·l + 2·π·r² → m²', 'rod volume = π·r²·l → m³'],
      }
    }
    case 'platelet': {
      const a = lengthToMetres(shape.edge, 'edge', unit)
      const t = lengthToMetres(shape.thickness, 'thickness', unit)
      return {
        area: 2 * a ** 2 + 4 * a * t,
        volume: a ** 2 * t,
        checks: ['platelet area = 2·a² + 4·a·t → m²', 'platelet volume = a²·t → m³'],
      }
    }
    default: {
      const kind = (shape as { kind?: unknown }).kind
      throw new Error(`Unsupported shape: ${String(kind)}. Use sphere, cube, rod or platelet.`)
    }
  }
}

export function computeGeometry(input: GeometryInput): GeometryResult {
  if (!input || typeof input !== 'object') throw new Error('An input object is required.')
  if (!Object.hasOwn(DENSITY_UNITS, input.densityUnit)) {
    throw new Error(`Unsupported density unit: ${String(input.densityUnit)}. Use g/cm3 or kg/m3.`)
  }
  const densityKgPerM3 = positive(input.density, 'density') * DENSITY_UNITS[input.densityUnit]
  const { area, volume, checks } = areaAndVolume(input.shape, input.lengthUnit)
  const massKg = volume * densityKgPerM3
  return {
    shape: input.shape.kind,
    areaM2: area,
    volumeM3: volume,
    areaPerVolumePerM: area / volume,
    massKg,
    // m² / (kg × 1000 g/kg) → m²/g. The specific surface area of a datasheet.
    specificSurfaceAreaM2PerG: area / (massKg * 1000),
    dimensionalChecks: [
      ...checks,
      'mass = volume (m³) × density (kg/m³) → kg',
      'area/volume = m² / m³ → 1/m',
      'specific surface area = m² / (kg × 1000 g/kg) → m²/g',
    ],
    assumptions: [
      'One perfectly smooth, non-porous, solid particle of the stated shape.',
      'A single size, not a distribution; no aggregation.',
      'Bulk density applies at this size, which is itself an assumption.',
      'Geometry only: this result says nothing about reactivity, dissolution, exposure or hazard.',
    ],
  }
}

/** Specific surface area for a sphere, the closed form the calculator must agree with. */
export function sphereSpecificSurfaceAreaM2PerG(diameterM: number, densityKgPerM3: number): number {
  // 6/(ρ·d) in m²/kg, divided by 1000 g/kg.
  return 6 / (densityKgPerM3 * diameterM) / 1000
}
