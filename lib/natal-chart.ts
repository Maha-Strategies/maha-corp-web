/**
 * Deterministic natal chart geometry.
 *
 * Planetary longitudes and the horizon intersection are calculations. The
 * Lahiri subtraction, mean-node choice, and whole-sign house assignment are
 * declared chart conventions. Keeping those labels in the returned object
 * prevents a useful chart table from masquerading as empirical interpretation.
 */

import { SiderealTime } from 'astronomy-engine'

import { CLASSICAL_BODIES, classicalEclipticLongitude, type ClassicalBody } from './local-fact-bundle.ts'
import { NAKSHATRA_NAMES, lahiriAyanamsa } from './panchanga.ts'

export const NATAL_CHART_VERSION = 'natal-chart/0.2' as const

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const

export type ZodiacSign = typeof ZODIAC_SIGNS[number]
export type ChartPointName = 'Ascendant' | ClassicalBody | 'Rahu' | 'Ketu'
export type ChartMotion = 'direct' | 'retrograde' | 'stationary' | 'not-applicable'
export type NatalAspectName = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'

export interface NatalAspect {
  first: ChartPointName
  second: ChartPointName
  name: NatalAspectName
  exactAngle: 0 | 60 | 90 | 120 | 180
  separationDegrees: number
  orbDegrees: number
  maximumOrbDegrees: number
}

export interface NatalHouse {
  number: number
  sign: ZodiacSign
  ruler: ClassicalBody
  rulerSign: ZodiacSign
  rulerHouse: number
  occupants: ChartPointName[]
}

export interface NodalAxis {
  rahu: { sign: ZodiacSign; house: number }
  ketu: { sign: ZodiacSign; house: number }
  separationDegrees: number
  method: string
}

export interface ZodiacPosition {
  longitude: number
  sign: ZodiacSign
  degreeInSign: number
}

export interface NakshatraPosition {
  index: number
  name: string
  pada: 1 | 2 | 3 | 4
  fraction: number
}

export interface NatalChartPoint {
  name: ChartPointName
  tropical: ZodiacPosition
  sidereal: ZodiacPosition
  nakshatra: NakshatraPosition
  wholeSignHouse: number
  motion: ChartMotion
  dailyMotionDegrees: number | null
  method: string
}

export interface NatalChart {
  version: typeof NATAL_CHART_VERSION
  instantUtc: string
  ayanamsa: { name: 'lahiri'; degrees: number }
  houseSystem: 'whole-sign'
  nodeModel: 'mean-lunar-node'
  ascendant: NatalChartPoint
  placements: NatalChartPoint[]
  houses: NatalHouse[]
  aspects: NatalAspect[]
  nodalAxis: NodalAxis
  methodology: string[]
}

const J2000_MS = Date.UTC(2000, 0, 1, 12)
const DAY_MS = 86_400_000
const NAKSHATRA_ARC = 360 / 27

const TRADITIONAL_SIGN_RULERS: Record<ZodiacSign, ClassicalBody> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
}

const ASPECT_DEFINITIONS: { name: NatalAspectName; angle: NatalAspect['exactAngle']; maximumOrbDegrees: number }[] = [
  { name: 'conjunction', angle: 0, maximumOrbDegrees: 8 },
  { name: 'sextile', angle: 60, maximumOrbDegrees: 4 },
  { name: 'square', angle: 90, maximumOrbDegrees: 6 },
  { name: 'trine', angle: 120, maximumOrbDegrees: 6 },
  { name: 'opposition', angle: 180, maximumOrbDegrees: 8 },
]

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

function signedDifference(to: number, from: number): number {
  return ((to - from + 540) % 360) - 180
}

function angularSeparation(first: number, second: number): number {
  return Math.abs(signedDifference(first, second))
}

function computeAspects(points: NatalChartPoint[]): NatalAspect[] {
  const aspects: NatalAspect[] = []
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < points.length; secondIndex += 1) {
      const first = points[firstIndex]
      const second = points[secondIndex]
      const separationDegrees = angularSeparation(first.sidereal.longitude, second.sidereal.longitude)
      for (const definition of ASPECT_DEFINITIONS) {
        const orbDegrees = Math.abs(separationDegrees - definition.angle)
        if (orbDegrees > definition.maximumOrbDegrees) continue
        aspects.push({
          first: first.name,
          second: second.name,
          name: definition.name,
          exactAngle: definition.angle,
          separationDegrees,
          orbDegrees,
          maximumOrbDegrees: definition.maximumOrbDegrees,
        })
      }
    }
  }
  return aspects.sort((first, second) => first.orbDegrees - second.orbDegrees
    || first.first.localeCompare(second.first) || first.second.localeCompare(second.second))
}

function computeHouses(ascendant: NatalChartPoint, placements: NatalChartPoint[]): NatalHouse[] {
  const ascendantSignIndex = ZODIAC_SIGNS.indexOf(ascendant.sidereal.sign)
  const pointMap = new Map(placements.map((placement) => [placement.name, placement]))
  return Array.from({ length: 12 }, (_, index) => {
    const number = index + 1
    const sign = ZODIAC_SIGNS[(ascendantSignIndex + index) % 12]
    const ruler = TRADITIONAL_SIGN_RULERS[sign]
    const rulerPlacement = pointMap.get(ruler)
    if (!rulerPlacement) throw new Error(`Natal chart is missing house ruler ${ruler}.`)
    return {
      number,
      sign,
      ruler,
      rulerSign: rulerPlacement.sidereal.sign,
      rulerHouse: rulerPlacement.wholeSignHouse,
      occupants: placements.filter((placement) => placement.wholeSignHouse === number).map((placement) => placement.name),
    }
  })
}

function zodiacPosition(longitude: number): ZodiacPosition {
  const normalized = normalize(longitude)
  const signIndex = Math.floor(normalized / 30)
  return { longitude: normalized, sign: ZODIAC_SIGNS[signIndex], degreeInSign: normalized % 30 }
}

function nakshatraPosition(siderealLongitude: number): NakshatraPosition {
  const normalized = normalize(siderealLongitude)
  const raw = normalized / NAKSHATRA_ARC
  const index = Math.floor(raw)
  const fraction = raw - index
  return {
    index: index + 1,
    name: NAKSHATRA_NAMES[index],
    pada: (Math.floor(fraction * 4) + 1) as 1 | 2 | 3 | 4,
    fraction,
  }
}

function wholeSignHouse(siderealLongitude: number, ascendantSiderealLongitude: number): number {
  const sign = Math.floor(normalize(siderealLongitude) / 30)
  const ascendantSign = Math.floor(normalize(ascendantSiderealLongitude) / 30)
  return ((sign - ascendantSign + 12) % 12) + 1
}

/** IAU-style mean obliquity, sufficient to far below displayed ascendant precision. */
function meanObliquityDegrees(instant: Date): number {
  const centuries = (instant.getTime() - J2000_MS) / (36_525 * DAY_MS)
  const arcseconds = 21.448 - 46.815 * centuries - 0.00059 * centuries ** 2 + 0.001813 * centuries ** 3
  return 23 + 26 / 60 + arcseconds / 3600
}

/** Eastern intersection of the ecliptic and local horizon, tropical longitude of date. */
export function tropicalAscendantLongitude(instant: Date, latitudeDegrees: number, longitudeDegrees: number): number {
  const radians = Math.PI / 180
  const localSidereal = normalize(SiderealTime(instant) * 15 + longitudeDegrees) * radians
  const latitude = latitudeDegrees * radians
  const obliquity = meanObliquityDegrees(instant) * radians
  const longitude = normalize(Math.atan2(
    Math.cos(localSidereal),
    -(Math.sin(localSidereal) * Math.cos(obliquity) + Math.tan(latitude) * Math.sin(obliquity)),
  ) / radians)

  // The ecliptic and horizon intersect at two antipodal points. The atan2
  // branch above normally returns the eastern one, but it can select the
  // western intersection inside the polar circles. Resolve the branch from
  // the candidate's projection onto the local east vector instead of assuming
  // one hemisphere. The antipode has the opposite projection.
  const candidate = longitude * radians
  const eastProjection = -Math.cos(candidate) * Math.sin(localSidereal)
    + Math.sin(candidate) * Math.cos(obliquity) * Math.cos(localSidereal)
  return eastProjection >= 0 ? longitude : normalize(longitude + 180)
}

/** Mean ascending lunar node in the ecliptic of date (Meeus polynomial). */
export function meanNodeLongitude(instant: Date): number {
  const centuries = (instant.getTime() - J2000_MS) / (36_525 * DAY_MS)
  return normalize(125.04452 - 1934.136261 * centuries + 0.0020708 * centuries ** 2 + centuries ** 3 / 450_000)
}

function point(
  name: ChartPointName,
  tropicalLongitude: number,
  ayanamsa: number,
  ascendantSidereal: number,
  motion: ChartMotion,
  dailyMotionDegrees: number | null,
  method: string,
): NatalChartPoint {
  const siderealLongitude = normalize(tropicalLongitude - ayanamsa)
  return {
    name,
    tropical: zodiacPosition(tropicalLongitude),
    sidereal: zodiacPosition(siderealLongitude),
    nakshatra: nakshatraPosition(siderealLongitude),
    wholeSignHouse: wholeSignHouse(siderealLongitude, ascendantSidereal),
    motion,
    dailyMotionDegrees,
    method,
  }
}

function classicalMotion(body: ClassicalBody, instant: Date): { motion: ChartMotion; dailyMotionDegrees: number } {
  const later = new Date(instant.getTime() + DAY_MS)
  const dailyMotionDegrees = signedDifference(classicalEclipticLongitude(body, later), classicalEclipticLongitude(body, instant))
  const motion: ChartMotion = Math.abs(dailyMotionDegrees) < 0.01 ? 'stationary' : dailyMotionDegrees < 0 ? 'retrograde' : 'direct'
  return { motion, dailyMotionDegrees }
}

export interface NatalChartInput {
  instant: Date
  latitudeDegrees: number
  longitudeDegrees: number
}

export function computeNatalChart(input: NatalChartInput): NatalChart {
  const { instant, latitudeDegrees, longitudeDegrees } = input
  const ayanamsa = lahiriAyanamsa(instant)
  const ascendantTropical = tropicalAscendantLongitude(instant, latitudeDegrees, longitudeDegrees)
  const ascendantSidereal = normalize(ascendantTropical - ayanamsa)
  const ascendant = point(
    'Ascendant', ascendantTropical, ayanamsa, ascendantSidereal, 'not-applicable', null,
    'Eastern ecliptic–horizon intersection; local apparent sidereal time and mean obliquity of date.',
  )

  const classical = CLASSICAL_BODIES.map((body) => {
    const motion = classicalMotion(body, instant)
    return point(
      body, classicalEclipticLongitude(body, instant), ayanamsa, ascendantSidereal,
      motion.motion, motion.dailyMotionDegrees,
      'Apparent geocentric ecliptic longitude of date from astronomy-engine 2.1.19.',
    )
  })

  const rahuTropical = meanNodeLongitude(instant)
  const nodeDailyMotion = signedDifference(meanNodeLongitude(new Date(instant.getTime() + DAY_MS)), rahuTropical)
  const rahu = point(
    'Rahu', rahuTropical, ayanamsa, ascendantSidereal, 'retrograde', nodeDailyMotion,
    'Mean ascending lunar node; Meeus polynomial, not the true oscillating node.',
  )
  const ketu = point(
    'Ketu', normalize(rahuTropical + 180), ayanamsa, ascendantSidereal, 'retrograde', nodeDailyMotion,
    'Point exactly opposite the mean ascending lunar node.',
  )

  const placements = [...classical, rahu, ketu]
  const houses = computeHouses(ascendant, placements)
  const aspects = computeAspects([ascendant, ...placements])
  const nodalAxis: NodalAxis = {
    rahu: { sign: rahu.sidereal.sign, house: rahu.wholeSignHouse },
    ketu: { sign: ketu.sidereal.sign, house: ketu.wholeSignHouse },
    separationDegrees: angularSeparation(rahu.sidereal.longitude, ketu.sidereal.longitude),
    method: 'Ketu is defined as the point exactly opposite the mean ascending lunar node.',
  }

  return {
    version: NATAL_CHART_VERSION,
    instantUtc: instant.toISOString(),
    ayanamsa: { name: 'lahiri', degrees: ayanamsa },
    houseSystem: 'whole-sign',
    nodeModel: 'mean-lunar-node',
    ascendant,
    placements,
    houses,
    aspects,
    nodalAxis,
    methodology: [
      'Tropical positions use the true equinox of date; Lahiri sidereal positions subtract the stated ayanāṁśa.',
      'Houses are whole-sign houses counted from the Lahiri-sidereal ascendant sign.',
      'Rahu is the mean ascending lunar node and Ketu is its exact opposite; true-node charts can differ slightly.',
      'House rulers use the traditional seven-planet rulership scheme; nodes do not rule signs in this calculation.',
      'Displayed aspects are geometric classifications using declared maximum orbs: conjunction 8°, sextile 4°, square 6°, trine 6°, opposition 8°. Orb choices are conventions and vary by tradition.',
      'Signs, houses, nakṣatras, and pādas are chart classifications, not evidence that interpretations predict outcomes.',
    ],
  }
}
