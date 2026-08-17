/**
 * Deterministic natal timing conventions.
 *
 * Vimśottarī periods and transit-to-natal contacts are astrological timing
 * conventions built from reproducible celestial positions. This module computes
 * their dates and geometry without assigning event, personality, or outcome
 * meanings to them.
 */

import { computeNatalChart, ZODIAC_SIGNS, type ChartMotion, type ChartPointName, type NatalAspectName, type NatalChart, type ZodiacSign } from './natal-chart.ts'
import { classicalEclipticLongitude } from './local-fact-bundle.ts'
import { lahiriAyanamsa } from './panchanga.ts'

export const NATAL_TIMING_VERSION = 'natal-timing/0.1' as const

export const VIMSHOTTARI_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const
export type VimshottariLord = typeof VIMSHOTTARI_LORDS[number]
type TransitPointName = Exclude<ChartPointName, 'Ascendant'>

export const VIMSHOTTARI_YEARS: Record<VimshottariLord, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
}

export interface TimingSourceReference {
  title: string
  locator: string
  url: string
  usage: 'calculation-convention'
  note: string
}

export interface DashaPeriod {
  level: 'mahadasha' | 'antardasha'
  lord: VimshottariLord
  parentLord?: VimshottariLord
  startUtc: string
  endUtc: string
  nominalYears: number
  activeAtReference: boolean
}

export interface VimshottariTiming {
  system: 'vimshottari-120-year'
  traditionId: 'vedic-jyotisha'
  moonNakshatra: { index: number; name: string; fractionElapsed: number }
  birthNakshatraIngressUtc: string
  birthNakshatraEgressUtc: string
  balanceMethod: 'actual-nakshatra-stay-time'
  startingLord: VimshottariLord
  balanceAtBirthYears: number
  yearLengthDays: 365.2425
  mahadashas: DashaPeriod[]
  activeMahadasha: DashaPeriod
  activeAntardasha: DashaPeriod
  antardashas: DashaPeriod[]
  nextTransition: { level: 'antardasha' | 'mahadasha'; atUtc: string; lord: VimshottariLord }
  sourceReferences: TimingSourceReference[]
}

export interface TransitPlacement {
  point: TransitPointName
  siderealSign: ZodiacSign
  degreeInSign: number
  natalWholeSignHouse: number
  motion: ChartMotion
}

export interface TransitContact {
  transitPoint: TransitPointName
  natalPoint: ChartPointName
  aspect: NatalAspectName
  exactAngle: 0 | 60 | 90 | 120 | 180
  separationDegrees: number
  orbDegrees: number
  maximumOrbDegrees: 2
  profileId: 'geometric-transit-contacts/0.1'
}

export interface NatalTiming {
  version: typeof NATAL_TIMING_VERSION
  referenceInstantUtc: string
  vimshottari: VimshottariTiming
  transits: {
    frame: 'lahiri-sidereal'
    houseReference: 'natal-whole-sign-ascendant'
    placements: TransitPlacement[]
    contacts: TransitContact[]
    contactProfileId: 'geometric-transit-contacts/0.1'
  }
  methodology: string[]
}

const DAY_MS = 86_400_000
const YEAR_DAYS = 365.2425 as const
const VIMSHOTTARI_TOTAL_YEARS = 120
const NAKSHATRA_ARC = 360 / 27
const CONTACT_PROFILE = [
  { aspect: 'conjunction', angle: 0 },
  { aspect: 'sextile', angle: 60 },
  { aspect: 'square', angle: 90 },
  { aspect: 'trine', angle: 120 },
  { aspect: 'opposition', angle: 180 },
] as const satisfies readonly { aspect: NatalAspectName; angle: TransitContact['exactAngle'] }[]

const SOURCE_REFERENCES: TimingSourceReference[] = [{
  title: 'Bṛhat Parāśara Horā Śāstra',
  locator: 'Chapter 46, verses 14–16; Chapter 51, verses 1–2',
  url: 'https://vedic-astro.s3.amazonaws.com/books/bhrihat_parasara_hora_shastra.pdf',
  usage: 'calculation-convention',
  note: 'Used to verify the period order, durations, birth balance, and proportional sub-period method. Translation provenance and excerpt rights have not yet passed the passage registry, so no source text is republished here.',
}]

function addYearsAsDays(instantMs: number, years: number): number {
  return instantMs + years * YEAR_DAYS * DAY_MS
}

function moonNakshatraIndexAt(instantMs: number): number {
  const instant = new Date(instantMs)
  const siderealMoon = ((classicalEclipticLongitude('Moon', instant) - lahiriAyanamsa(instant)) % 360 + 360) % 360
  return Math.floor(siderealMoon / NAKSHATRA_ARC) + 1
}

function bisectNakshatraBoundary(lowerMs: number, upperMs: number, nakshatraIndex: number, findIngress: boolean): number {
  let lower = lowerMs
  let upper = upperMs
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const midpoint = (lower + upper) / 2
    const inNakshatra = moonNakshatraIndexAt(midpoint) === nakshatraIndex
    if (findIngress ? inNakshatra : !inNakshatra) upper = midpoint
    else lower = midpoint
  }
  return upper
}

function birthNakshatraStay(birthMs: number, nakshatraIndex: number): { ingressMs: number; egressMs: number; fractionElapsed: number } {
  const stepMs = 3 * 60 * 60 * 1000
  let beforeMs = birthMs
  let afterMs = birthMs
  for (let step = 0; step < 24 && moonNakshatraIndexAt(beforeMs) === nakshatraIndex; step += 1) beforeMs -= stepMs
  for (let step = 0; step < 24 && moonNakshatraIndexAt(afterMs) === nakshatraIndex; step += 1) afterMs += stepMs
  if (moonNakshatraIndexAt(beforeMs) === nakshatraIndex || moonNakshatraIndexAt(afterMs) === nakshatraIndex) {
    throw new Error('Could not bracket the natal Moon’s nakṣatra stay.')
  }
  const ingressMs = bisectNakshatraBoundary(beforeMs, birthMs, nakshatraIndex, true)
  const egressMs = bisectNakshatraBoundary(birthMs, afterMs, nakshatraIndex, false)
  return { ingressMs, egressMs, fractionElapsed: (birthMs - ingressMs) / (egressMs - ingressMs) }
}

function activeAt(referenceMs: number, startMs: number, endMs: number): boolean {
  return referenceMs >= startMs && referenceMs < endMs
}

function period(
  level: DashaPeriod['level'],
  lord: VimshottariLord,
  startMs: number,
  endMs: number,
  nominalYears: number,
  referenceMs: number,
  parentLord?: VimshottariLord,
): DashaPeriod {
  return {
    level,
    lord,
    ...(parentLord ? { parentLord } : {}),
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
    nominalYears,
    activeAtReference: activeAt(referenceMs, startMs, endMs),
  }
}

function computeVimshottari(natalChart: NatalChart, birthMs: number, referenceMs: number): VimshottariTiming {
  const moon = natalChart.placements.find((entry) => entry.name === 'Moon')
  if (!moon) throw new Error('Vimśottarī timing requires a natal Moon position.')

  const startingIndex = (moon.nakshatra.index - 1) % VIMSHOTTARI_LORDS.length
  const startingLord = VIMSHOTTARI_LORDS[startingIndex]
  const nakshatraStay = birthNakshatraStay(birthMs, moon.nakshatra.index)
  const elapsedYearsAtBirth = nakshatraStay.fractionElapsed * VIMSHOTTARI_YEARS[startingLord]
  const balanceAtBirthYears = VIMSHOTTARI_YEARS[startingLord] - elapsedYearsAtBirth
  const cycleStartMs = addYearsAsDays(birthMs, -elapsedYearsAtBirth)

  let cursorMs = cycleStartMs
  const mahadashas: DashaPeriod[] = []
  for (let offset = 0; offset < VIMSHOTTARI_LORDS.length; offset += 1) {
    const lord = VIMSHOTTARI_LORDS[(startingIndex + offset) % VIMSHOTTARI_LORDS.length]
    const endMs = addYearsAsDays(cursorMs, VIMSHOTTARI_YEARS[lord])
    mahadashas.push(period('mahadasha', lord, cursorMs, endMs, VIMSHOTTARI_YEARS[lord], referenceMs))
    cursorMs = endMs
  }

  const activeMahadasha = mahadashas.find((entry) => entry.activeAtReference)
  if (!activeMahadasha) throw new Error('The timing moment falls outside the first 120-year Vimśottarī cycle anchored at birth.')

  const mahaStartMs = Date.parse(activeMahadasha.startUtc)
  const mahaEndMs = Date.parse(activeMahadasha.endUtc)
  const mahaLordIndex = VIMSHOTTARI_LORDS.indexOf(activeMahadasha.lord)
  cursorMs = mahaStartMs
  const antardashas: DashaPeriod[] = []
  for (let offset = 0; offset < VIMSHOTTARI_LORDS.length; offset += 1) {
    const lord = VIMSHOTTARI_LORDS[(mahaLordIndex + offset) % VIMSHOTTARI_LORDS.length]
    const nominalYears = activeMahadasha.nominalYears * VIMSHOTTARI_YEARS[lord] / VIMSHOTTARI_TOTAL_YEARS
    const endMs = offset === VIMSHOTTARI_LORDS.length - 1 ? mahaEndMs : addYearsAsDays(cursorMs, nominalYears)
    antardashas.push(period('antardasha', lord, cursorMs, endMs, nominalYears, referenceMs, activeMahadasha.lord))
    cursorMs = endMs
  }

  const activeAntardasha = antardashas.find((entry) => entry.activeAtReference)
  if (!activeAntardasha) throw new Error('The timing moment does not resolve to a Vimśottarī antardaśā.')
  const nextMahadasha = mahadashas[mahadashas.indexOf(activeMahadasha) + 1]
  const nextAntardasha = antardashas[antardashas.indexOf(activeAntardasha) + 1]
  const nextTransition = nextAntardasha
    ? { level: 'antardasha' as const, atUtc: activeAntardasha.endUtc, lord: nextAntardasha.lord }
    : { level: 'mahadasha' as const, atUtc: activeMahadasha.endUtc, lord: nextMahadasha?.lord ?? VIMSHOTTARI_LORDS[(mahaLordIndex + 1) % VIMSHOTTARI_LORDS.length] }

  return {
    system: 'vimshottari-120-year',
    traditionId: 'vedic-jyotisha',
    moonNakshatra: { index: moon.nakshatra.index, name: moon.nakshatra.name, fractionElapsed: nakshatraStay.fractionElapsed },
    birthNakshatraIngressUtc: new Date(nakshatraStay.ingressMs).toISOString(),
    birthNakshatraEgressUtc: new Date(nakshatraStay.egressMs).toISOString(),
    balanceMethod: 'actual-nakshatra-stay-time',
    startingLord,
    balanceAtBirthYears,
    yearLengthDays: YEAR_DAYS,
    mahadashas,
    activeMahadasha,
    activeAntardasha,
    antardashas,
    nextTransition,
    sourceReferences: SOURCE_REFERENCES,
  }
}

function angularSeparation(first: number, second: number): number {
  const difference = Math.abs(((first - second + 540) % 360) - 180)
  return difference
}

function natalHouseFor(longitude: number, natalAscendantSign: ZodiacSign): number {
  const signIndex = Math.floor((((longitude % 360) + 360) % 360) / 30)
  const ascendantIndex = ZODIAC_SIGNS.indexOf(natalAscendantSign)
  return ((signIndex - ascendantIndex + 12) % 12) + 1
}

function transitPointName(name: ChartPointName): TransitPointName {
  if (name === 'Ascendant') throw new Error('A transit placement cannot be an ascendant.')
  return name
}

function computeTransits(natalChart: NatalChart, referenceChart: NatalChart): NatalTiming['transits'] {
  const placements: TransitPlacement[] = referenceChart.placements.map((entry) => ({
    point: transitPointName(entry.name),
    siderealSign: entry.sidereal.sign,
    degreeInSign: entry.sidereal.degreeInSign,
    natalWholeSignHouse: natalHouseFor(entry.sidereal.longitude, natalChart.ascendant.sidereal.sign),
    motion: entry.motion,
  }))

  const natalPoints = [natalChart.ascendant, ...natalChart.placements]
  const contacts: TransitContact[] = []
  for (const transit of referenceChart.placements) {
    for (const natal of natalPoints) {
      const separationDegrees = angularSeparation(transit.sidereal.longitude, natal.sidereal.longitude)
      for (const definition of CONTACT_PROFILE) {
        const orbDegrees = Math.abs(separationDegrees - definition.angle)
        if (orbDegrees > 2) continue
        contacts.push({
          transitPoint: transitPointName(transit.name),
          natalPoint: natal.name,
          aspect: definition.aspect,
          exactAngle: definition.angle,
          separationDegrees,
          orbDegrees,
          maximumOrbDegrees: 2,
          profileId: 'geometric-transit-contacts/0.1',
        })
      }
    }
  }

  contacts.sort((first, second) => first.orbDegrees - second.orbDegrees
    || first.transitPoint.localeCompare(second.transitPoint) || first.natalPoint.localeCompare(second.natalPoint))
  return {
    frame: 'lahiri-sidereal',
    houseReference: 'natal-whole-sign-ascendant',
    placements,
    contacts,
    contactProfileId: 'geometric-transit-contacts/0.1',
  }
}

export interface NatalTimingInput {
  natalChart: NatalChart
  birthInstant: Date
  referenceInstant: Date
  latitudeDegrees: number
  longitudeDegrees: number
}

export function computeNatalTiming(input: NatalTimingInput): NatalTiming {
  const birthMs = input.birthInstant.getTime()
  const referenceMs = input.referenceInstant.getTime()
  if (!Number.isFinite(birthMs) || !Number.isFinite(referenceMs)) throw new Error('Natal timing requires valid birth and reference instants.')
  if (referenceMs < birthMs) throw new Error('The timing moment cannot precede the birth instant.')

  const referenceChart = computeNatalChart({
    instant: input.referenceInstant,
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
  })

  return {
    version: NATAL_TIMING_VERSION,
    referenceInstantUtc: input.referenceInstant.toISOString(),
    vimshottari: computeVimshottari(input.natalChart, birthMs, referenceMs),
    transits: computeTransits(input.natalChart, referenceChart),
    methodology: [
      'Vimśottarī starts from the ruler of the natal Moon’s Lahiri-sidereal nakṣatra; the elapsed opening period uses the Moon’s solved ingress-to-egress time fraction, not a constant-speed degree shortcut.',
      'Period durations use a declared 365.2425-day year. Other software may use 360-day, 365-day, or civil-calendar conventions and therefore produce different boundary dates.',
      'Antardaśā durations are proportional to each lord’s years in the 120-year cycle and begin with the mahādaśā lord.',
      'Transit houses are whole-sign houses counted from the natal Lahiri-sidereal ascendant, not houses of a chart recast for the timing location.',
      'Transit contacts use a separate declared geometric profile: 0°, 60°, 90°, 120°, and 180°, each with a 2° maximum orb. This profile is not presented as a universal Vedic aspect doctrine.',
      'Period labels and transit contacts are timing classifications. They do not establish that an event will occur or what the event would mean.',
    ],
  }
}
