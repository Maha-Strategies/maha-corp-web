import { readFile } from 'node:fs/promises'

import { CLASSICAL_BODIES } from './local-fact-bundle.ts'
import { computeNatalChart } from './natal-chart.ts'
import { BOUNDARY_TOLERANCE_DEGREES, computePanchanga } from './panchanga.ts'

export interface ConformanceCase {
  id: string
  tags: string[]
  instantUtc: string
  observer: { latitudeDegrees: number; longitudeDegrees: number; elevationMeters: number }
  note: string
  reference: {
    ayanamsaLahiriDegrees: number
    ascendantTropicalDegrees: number
    positions: Record<string, { longitudeDegrees: number; speedDegreesPerDay: number }>
    derived: { elongationDegrees: number; tithiAbsoluteIndex: number; nakshatraIndex: number }
    solarEvents: { previousSunriseUtc: string | null; nextSunsetUtc: string | null; model: string }
  }
}

export interface CelestialConformanceCorpus {
  schemaVersion: 'celestial-conformance/1.0'
  corpusVersion: string
  caseCount: number
  reference: {
    engine: string
    engineVersion: string
    pythonBinding: string
    dataFiles: { name: string; sha256: string }[]
    sourceUrls: string[]
    licensingBoundary: string
  }
  externalAnchors: { authority: string; apiVersion: string; sourceUrl: string; linkedCaseId: string; event: string; utcMinute: string }[]
  cases: ConformanceCase[]
}

export interface ConformanceResult {
  id: string
  tags: string[]
  maximumPlanetLongitudeErrorDegrees: number
  sunLongitudeErrorDegrees: number
  moonLongitudeErrorDegrees: number
  ayanamsaErrorDegrees: number
  ascendantErrorDegrees: number
  sunriseErrorMinutes: number | null
  sunsetErrorMinutes: number | null
  solarEventNullAgreement: boolean
  tithiIndexAgreement: boolean | null
  nakshatraIndexAgreement: boolean | null
  motionAgreement: Record<string, boolean | null>
}

export const CONFORMANCE_LIMITS = {
  planetLongitudeDegrees: 0.02,
  sunLongitudeDegrees: 0.005,
  moonLongitudeDegrees: 0.02,
  ayanamsaDegrees: 0.01,
  ascendantDegrees: 0.02,
  solarEventMinutes: 10,
} as const

function angularError(actual: number, expected: number): number {
  return Math.abs(((actual - expected + 540) % 360) - 180)
}

function timeErrorMinutes(actual: string | null, expected: string | null): number | null {
  if (!actual || !expected) return null
  return Math.abs(Date.parse(actual) - Date.parse(expected)) / 60_000
}

function distanceToBoundary(angle: number, division: number): number {
  const remainder = ((angle % division) + division) % division
  return Math.min(remainder, division - remainder)
}

function referenceMotion(speed: number): 'direct' | 'retrograde' | 'stationary' {
  if (Math.abs(speed) < 0.01) return 'stationary'
  return speed < 0 ? 'retrograde' : 'direct'
}

export function validateCelestialConformanceCorpus(value: unknown): asserts value is CelestialConformanceCorpus {
  if (!value || typeof value !== 'object') throw new Error('Celestial conformance corpus must be an object.')
  const corpus = value as Partial<CelestialConformanceCorpus>
  if (corpus.schemaVersion !== 'celestial-conformance/1.0') throw new Error('Unsupported celestial conformance schema.')
  if (!Array.isArray(corpus.cases) || corpus.cases.length < 100 || corpus.cases.length > 200) throw new Error('Corpus must contain 100–200 cases.')
  if (corpus.caseCount !== corpus.cases.length) throw new Error('caseCount does not match the case array.')
  const ids = new Set<string>()
  for (const entry of corpus.cases) {
    if (!entry.id || ids.has(entry.id)) throw new Error(`Missing or duplicate case id: ${entry.id}`)
    ids.add(entry.id)
    if (!Number.isFinite(Date.parse(entry.instantUtc))) throw new Error(`Invalid instant for ${entry.id}`)
    if (!entry.tags.length || !entry.reference?.positions) throw new Error(`Incomplete case: ${entry.id}`)
  }
  if (corpus.reference?.engine !== 'Swiss Ephemeris' || !corpus.reference.dataFiles?.length) throw new Error('Independent reference provenance is missing.')
}

export async function loadCelestialConformanceCorpus(url = new URL('../test/fixtures/celestial-conformance-v1.json', import.meta.url)): Promise<CelestialConformanceCorpus> {
  const corpus = JSON.parse(await readFile(url, 'utf8')) as unknown
  validateCelestialConformanceCorpus(corpus)
  return corpus
}

export function evaluateConformanceCase(entry: ConformanceCase): ConformanceResult {
  const instant = new Date(entry.instantUtc)
  const input = { instant, latitudeDegrees: entry.observer.latitudeDegrees, longitudeDegrees: entry.observer.longitudeDegrees }
  const panchanga = computePanchanga(input)
  const chart = computeNatalChart(input)
  const placementMap = new Map(chart.placements.map((placement) => [placement.name, placement]))
  const positionErrors = CLASSICAL_BODIES.map((body) => {
    const actual = placementMap.get(body)
    if (!actual) throw new Error(`${entry.id} has no ${body} placement.`)
    return angularError(actual.tropical.longitude, entry.reference.positions[body].longitudeDegrees)
  })
  const boundaryCase = entry.tags.some((tag) => tag.includes('boundary') || tag === 'new-moon' || tag === 'full-moon')
  const tithiStable = distanceToBoundary(entry.reference.derived.elongationDegrees, 12) > BOUNDARY_TOLERANCE_DEGREES + CONFORMANCE_LIMITS.moonLongitudeDegrees
  const moonSidereal = (entry.reference.positions.Moon.longitudeDegrees - entry.reference.ayanamsaLahiriDegrees + 360) % 360
  const nakshatraStable = distanceToBoundary(moonSidereal, 360 / 27) > BOUNDARY_TOLERANCE_DEGREES + CONFORMANCE_LIMITS.ayanamsaDegrees
  const motionAgreement: Record<string, boolean | null> = {}
  for (const body of CLASSICAL_BODIES) {
    const referenceSpeed = entry.reference.positions[body].speedDegreesPerDay
    const actual = placementMap.get(body)!
    motionAgreement[body] = Math.abs(referenceSpeed) < 0.05 ? null : actual.motion === referenceMotion(referenceSpeed)
  }
  return {
    id: entry.id,
    tags: entry.tags,
    maximumPlanetLongitudeErrorDegrees: Math.max(...positionErrors),
    sunLongitudeErrorDegrees: angularError(panchanga.sunLongitudeTropical, entry.reference.positions.Sun.longitudeDegrees),
    moonLongitudeErrorDegrees: angularError(panchanga.moonLongitudeTropical, entry.reference.positions.Moon.longitudeDegrees),
    ayanamsaErrorDegrees: angularError(panchanga.ayanamsa.degrees, entry.reference.ayanamsaLahiriDegrees),
    ascendantErrorDegrees: angularError(chart.ascendant.tropical.longitude, entry.reference.ascendantTropicalDegrees),
    sunriseErrorMinutes: timeErrorMinutes(panchanga.day.sunrise, entry.reference.solarEvents.previousSunriseUtc),
    sunsetErrorMinutes: timeErrorMinutes(panchanga.day.sunset, entry.reference.solarEvents.nextSunsetUtc),
    solarEventNullAgreement: (panchanga.day.sunrise === null) === (entry.reference.solarEvents.previousSunriseUtc === null)
      && (panchanga.day.sunset === null) === (entry.reference.solarEvents.nextSunsetUtc === null),
    tithiIndexAgreement: boundaryCase || !tithiStable ? null : panchanga.tithi.absoluteIndex === entry.reference.derived.tithiAbsoluteIndex,
    nakshatraIndexAgreement: boundaryCase || !nakshatraStable ? null : panchanga.nakshatra.index === entry.reference.derived.nakshatraIndex,
    motionAgreement,
  }
}

export function summarizeCelestialConformance(corpus: CelestialConformanceCorpus) {
  const results = corpus.cases.map(evaluateConformanceCase)
  const maximum = (selector: (result: ConformanceResult) => number | null) => Math.max(0, ...results.map(selector).filter((value): value is number => value !== null))
  const disagreements = results.flatMap((result) => [
    result.tithiIndexAgreement === false ? `${result.id}:tithi` : null,
    result.nakshatraIndexAgreement === false ? `${result.id}:nakshatra` : null,
    !result.solarEventNullAgreement ? `${result.id}:solar-null` : null,
    ...Object.entries(result.motionAgreement).map(([body, agreed]) => agreed === false ? `${result.id}:motion:${body}` : null),
  ]).filter((value): value is string => value !== null)
  return {
    corpusVersion: corpus.corpusVersion,
    caseCount: results.length,
    maxima: {
      planetLongitudeErrorDegrees: maximum((result) => result.maximumPlanetLongitudeErrorDegrees),
      sunLongitudeErrorDegrees: maximum((result) => result.sunLongitudeErrorDegrees),
      moonLongitudeErrorDegrees: maximum((result) => result.moonLongitudeErrorDegrees),
      ayanamsaErrorDegrees: maximum((result) => result.ayanamsaErrorDegrees),
      ascendantErrorDegrees: maximum((result) => result.ascendantErrorDegrees),
      sunriseErrorMinutes: maximum((result) => result.sunriseErrorMinutes),
      sunsetErrorMinutes: maximum((result) => result.sunsetErrorMinutes),
    },
    disagreements,
    results,
  }
}
