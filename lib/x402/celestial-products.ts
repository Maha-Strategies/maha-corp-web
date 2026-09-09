import { createHash } from 'node:crypto'
import { CLASSICAL_BODIES, classicalEclipticLongitude, LOCAL_EPHEMERIS_SOURCE_ID } from '../local-fact-bundle.ts'
import { computeNatalChart, NATAL_CHART_VERSION } from '../natal-chart.ts'
import { computeNatalTiming, NATAL_TIMING_VERSION } from '../natal-timing.ts'
import { computePanchanga, lahiriAyanamsa, PANCHANGA_VERSION } from '../panchanga.ts'

export const CELESTIAL_PRODUCT_VERSION = 'maha-celestial-calculations/0.1'
export const CELESTIAL_PRODUCTS = {
  'celestial-position-snapshot': { path: '/api/v1/calculations/positions', amount: '10001' },
  'celestial-chart-evidence': { path: '/api/v1/calculations/chart', amount: '50001' },
  'celestial-vimshottari-timing': { path: '/api/v1/calculations/vimshottari', amount: '100001' },
} as const
export type CelestialProductId = keyof typeof CELESTIAL_PRODUCTS
export const CELESTIAL_MAX_REQUEST_BYTES = 2048
export const CELESTIAL_UTC_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'
export type CalculationInput = {
  dataClass: 'public' | 'synthetic'
  instantUtc: string
  latitudeDegrees?: number
  longitudeDegrees?: number
  referenceInstantUtc?: string
}
export function isCelestialProduct(id: string): id is CelestialProductId {
  return Object.hasOwn(CELESTIAL_PRODUCTS, id)
}
export function celestialProductAt(path: string): CelestialProductId | undefined {
  return (Object.keys(CELESTIAL_PRODUCTS) as CelestialProductId[]).find(id => CELESTIAL_PRODUCTS[id].path === path)
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function utc(value: unknown): string {
  if (typeof value !== 'string' || !new RegExp(CELESTIAL_UTC_PATTERN).test(value)) throw new Error('invalid_utc_instant')
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value || date.getUTCFullYear() < 1600 || date.getUTCFullYear() > 2099) throw new Error('invalid_utc_instant')
  return value
}
export function parseCalculationInput(id: CelestialProductId, value: unknown): CalculationInput {
  if (!object(value)) throw new Error('invalid_input')
  const fields = ['dataClass', 'instantUtc', ...(id === 'celestial-position-snapshot' ? [] : ['latitudeDegrees', 'longitudeDegrees']),
    ...(id === 'celestial-vimshottari-timing' ? ['referenceInstantUtc'] : [])]
  if (Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) throw new Error('invalid_input_fields')
  if (value.dataClass !== 'public' && value.dataClass !== 'synthetic') throw new Error('public_or_synthetic_only')
  const result: CalculationInput = { dataClass: value.dataClass, instantUtc: utc(value.instantUtc) }
  if (id !== 'celestial-position-snapshot') {
    for (const [key, limit] of [['latitudeDegrees', 89.9], ['longitudeDegrees', 180]] as const) {
      const n = value[key]
      if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > limit) throw new Error('invalid_coordinates')
      result[key] = n === 0 ? 0 : n
    }
  }
  if (id === 'celestial-vimshottari-timing') {
    result.referenceInstantUtc = utc(value.referenceInstantUtc)
    const span = Date.parse(result.referenceInstantUtc) - Date.parse(result.instantUtc)
    if (span < 0 || span >= 100 * 365.2425 * 86400000) throw new Error('timing_reference_out_of_range')
  }
  return result
}

/** Sorted object keys, ordered arrays, finite JSON numbers. No field exclusions. */
export function canonicalCalculationJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalCalculationJson).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalCalculationJson(value[key])}`).join(',')}}`
  throw new Error('non_json_calculation_value')
}
export const calculationDigest = (value: unknown): string => `sha256:${createHash('sha256').update(canonicalCalculationJson(value)).digest('hex')}`

export function buildCelestialProduct(id: CelestialProductId, supplied: unknown) {
  const input = parseCalculationInput(id, supplied)
  const instant = new Date(input.instantUtc)
  let result: Record<string, unknown>
  if (id === 'celestial-position-snapshot') {
    const ayanamsa = lahiriAyanamsa(instant)
    result = { instantUtc: input.instantUtc, ayanamsaDegrees: ayanamsa, positions: CLASSICAL_BODIES.map(body => {
      const tropicalLongitude = classicalEclipticLongitude(body, instant)
      return { body, tropicalLongitude, siderealLongitude: ((tropicalLongitude - ayanamsa) % 360 + 360) % 360 }
    }) }
  } else {
    const observer = { instant, latitudeDegrees: input.latitudeDegrees!, longitudeDegrees: input.longitudeDegrees! }
    const chart = computeNatalChart(observer)
    if (id === 'celestial-chart-evidence') {
      result = { chart, panchanga: computePanchanga({ ...observer, elevationMeters: 0 }) }
    } else {
      // Reuse the convention core, but do not sell transit scans or interpretations.
      const timing = computeNatalTiming({ natalChart: chart, birthInstant: instant,
        referenceInstant: new Date(input.referenceInstantUtc!), latitudeDegrees: input.latitudeDegrees!, longitudeDegrees: input.longitudeDegrees! })
      result = { referenceInstantUtc: input.referenceInstantUtc!, vimshottari: timing.vimshottari }
    }
  }
  // Core types contain optional undefined properties. Commit the JSON wire
  // representation (where those are absent), and reject non-finite numbers.
  const wireResult: Record<string, unknown> = JSON.parse(JSON.stringify(result, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non_finite_calculation')
    return value
  }))
  const payload = {
    version: CELESTIAL_PRODUCT_VERSION, offerId: id,
    inputDigest: calculationDigest(input), result: wireResult,
    conventions: {
      ephemeris: LOCAL_EPHEMERIS_SOURCE_ID, chartVersion: NATAL_CHART_VERSION,
      panchangaVersion: PANCHANGA_VERSION, timingVersion: NATAL_TIMING_VERSION,
      frames: ['tropical', 'lahiri-sidereal'], ayanamsa: 'maha-lahiri-j2000-iau2006/1',
      origin: 'geocentric', houses: 'sidereal-whole-sign', nodes: 'mean',
      inputTime: 'UTC; caller resolves local time and DST', elevationMeters: 0,
      yearLengthDays: 365.2425, birthBalance: 'actual-nakshatra-stay-time',
    },
    boundaries: [
      'Calculation and convention evidence only; no forecasting narrative, interpretation, recommendation, or predictive certification.',
      'Frames are returned separately, never averaged. Lahiri is this versioned implementation, not a claim of exact Swiss equivalence.',
      'Conformance is bounded to a reference corpus, not a global accuracy guarantee. Classifications near boundaries are sensitive to input and numerical uncertainty.',
      'Motion labels use a 24-hour difference, not exact station times. No event-window solver is included.',
      'Timing includes the first nine mahadashas and the nine antardashas of the active mahadasha at one reference instant; not every subperiod in a date range.',
      'Input and result digests are private response fields, not anonymization. Keep this receipt private when inputs could identify someone.',
      'Unsigned digests verify integrity against a trusted copy, not origin, settlement, delivery to another buyer, or scientific predictive validity.',
    ],
  }
  return { ...payload, receiptDigest: calculationDigest(payload) }
}

/** Recompute locally against the expected offer and request. No network or LLM. */
export function verifyCelestialProduct(id: CelestialProductId, input: unknown, response: unknown): boolean {
  try {
    if (!object(response)) return false
    const { receiptDigest, ...payload } = response
    return receiptDigest === calculationDigest(payload)
      && receiptDigest === buildCelestialProduct(id, input).receiptDigest
  } catch { return false }
}

export const SYNTHETIC_CALCULATION_INPUTS: Record<CelestialProductId, CalculationInput> = {
  'celestial-position-snapshot': { dataClass: 'synthetic', instantUtc: '2000-01-01T12:00:00.000Z' },
  'celestial-chart-evidence': { dataClass: 'synthetic', instantUtc: '2000-01-01T12:00:00.000Z', latitudeDegrees: 0, longitudeDegrees: 0 },
  'celestial-vimshottari-timing': { dataClass: 'synthetic', instantUtc: '2000-01-01T12:00:00.000Z', latitudeDegrees: 0, longitudeDegrees: 0, referenceInstantUtc: '2026-01-01T12:00:00.000Z' },
}
