/**
 * Pañcāṅga computation.
 *
 * This is a calendrical derivation, not an interpretation. "The tithi is
 * Dvādaśī and the nakshatra is Rohiṇī" is a statement about Sun and Moon
 * geometry, in the same category as a coordinate — it belongs with the fact
 * layer, not with the tradition layer.
 *
 * Nothing here says whether a moment is auspicious. That judgement requires
 * sourced rules from a named tradition, and the tradition layer will not accept
 * a rule without a transcribed passage. Keeping the two apart is the point: the
 * arithmetic is checkable, the interpretation is not, and they must not be
 * allowed to borrow each other's credibility.
 *
 * Positions come from astronomy-engine (MIT), which derives from JPL
 * ephemerides. No ephemeris under a copyleft licence is used.
 */

import { Body, EclipticGeoMoon, Observer, SearchRiseSet, SunPosition, type AstroTime } from 'astronomy-engine'

export const PANCHANGA_VERSION = 'panchanga/0.1' as const

/** One nakshatra or yoga division. 360° / 27. */
const DIVISION = 360 / 27
const TITHI_ARC = 12
const KARANA_ARC = 6

/**
 * Boundary tolerance, in degrees.
 *
 * Every limb is a floor() over a continuously moving angle, so a value near a
 * division boundary can flip on a small change in ayanāṁśa, in the ephemeris,
 * or in the assumed instant. Within this tolerance the result is reported as
 * uncertain rather than asserted. The Moon moves roughly 0.55°/hour, so 0.05°
 * is about five minutes of lunar motion.
 */
export const BOUNDARY_TOLERANCE_DEGREES = 0.05

export const TITHI_NAMES = [
  'Pratipadā', 'Dvitīyā', 'Tṛtīyā', 'Caturthī', 'Pañcamī', 'Ṣaṣṭhī', 'Saptamī',
  'Aṣṭamī', 'Navamī', 'Daśamī', 'Ekādaśī', 'Dvādaśī', 'Trayodaśī', 'Caturdaśī',
] as const

export const NAKSHATRA_NAMES = [
  'Aśvinī', 'Bharaṇī', 'Kṛttikā', 'Rohiṇī', 'Mṛgaśīrṣa', 'Ārdrā', 'Punarvasu',
  'Puṣya', 'Āśleṣā', 'Maghā', 'Pūrva Phalgunī', 'Uttara Phalgunī', 'Hasta',
  'Citrā', 'Svātī', 'Viśākhā', 'Anurādhā', 'Jyeṣṭhā', 'Mūla', 'Pūrva Āṣāḍhā',
  'Uttara Āṣāḍhā', 'Śravaṇa', 'Dhaniṣṭhā', 'Śatabhiṣā', 'Pūrva Bhādrapadā',
  'Uttara Bhādrapadā', 'Revatī',
] as const

export const YOGA_NAMES = [
  'Viṣkambha', 'Prīti', 'Āyuṣmān', 'Saubhāgya', 'Śobhana', 'Atigaṇḍa', 'Sukarman',
  'Dhṛti', 'Śūla', 'Gaṇḍa', 'Vṛddhi', 'Dhruva', 'Vyāghāta', 'Harṣaṇa', 'Vajra',
  'Siddhi', 'Vyatīpāta', 'Varīyān', 'Parigha', 'Śiva', 'Siddha', 'Sādhya',
  'Śubha', 'Śukla', 'Brahma', 'Aindra', 'Vaidhṛti',
] as const

/** The seven repeating (cara) karaṇas. */
export const MOVABLE_KARANA_NAMES = ['Bava', 'Bālava', 'Kaulava', 'Taitila', 'Gara', 'Vaṇija', 'Viṣṭi'] as const
/** The four fixed (sthira) karaṇas. */
export const FIXED_KARANA_NAMES = ['Kiṃstughna', 'Śakuni', 'Catuṣpada', 'Nāga'] as const

export const VARA_NAMES = ['Ravivāra', 'Somavāra', 'Maṅgalavāra', 'Budhavāra', 'Guruvāra', 'Śukravāra', 'Śanivāra'] as const

/**
 * Which eighth of the daylight span Rāhu Kāla occupies, indexed by weekday
 * (0 = Sunday). Values are 1-based segment numbers.
 */
const RAHU_KALA_SEGMENT = [8, 2, 7, 5, 6, 4, 3] as const

export type Paksha = 'śukla' | 'kṛṣṇa'

export interface LimbValue {
  /** 1-based index within the limb's cycle. */
  index: number
  name: string
  /** How far through this division the governing angle has travelled, 0–1. */
  fraction: number
  /**
   * True when the governing angle sits within BOUNDARY_TOLERANCE_DEGREES of a
   * division edge, so the index should not be relied on without a finer
   * ephemeris and a stated ayanāṁśa.
   */
  nearBoundary: boolean
}

export interface TithiValue extends LimbValue {
  paksha: Paksha
  /** 1–30 across the full lunar month, which the 1–15 index does not distinguish. */
  absoluteIndex: number
}

export interface DaySpan {
  sunrise: string | null
  sunset: string | null
  /** Null when the Sun does not rise or set at this latitude on this date. */
  note?: string
}

export interface RahuKala {
  start: string
  end: string
  segment: number
}

export interface Panchanga {
  version: typeof PANCHANGA_VERSION
  instant: string
  observer: { latitudeDegrees: number; longitudeDegrees: number; elevationMeters: number }
  ayanamsa: { name: 'lahiri'; degrees: number; accuracyNote: string }
  sunLongitudeTropical: number
  moonLongitudeTropical: number
  sunLongitudeSidereal: number
  moonLongitudeSidereal: number
  elongation: number
  tithi: TithiValue
  nakshatra: LimbValue
  yoga: LimbValue
  karana: LimbValue
  vara: { index: number; name: string; note: string }
  day: DaySpan
  rahuKala: RahuKala | null
  /** Every limb whose index is boundary-sensitive at this instant. */
  uncertainLimbs: string[]
}

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)

/**
 * Lahiri (Chitrapakṣa) ayanāṁśa.
 *
 * Anchored to the Indian Calendar Reform Committee value at J2000.0 and
 * advanced by the IAU 2006 general-precession-in-longitude polynomial. Agrees
 * with published Lahiri tables to within roughly an arcsecond across the modern
 * era, which is far finer than the 0.05° boundary tolerance applied above.
 *
 * Deriving the value from Spica's computed position instead was tried and
 * rejected: it drifted about 0.35° by 2026 against published tables.
 */
export function lahiriAyanamsa(instant: Date): number {
  const centuries = (instant.getTime() - J2000_MS) / (365.25 * 86_400_000 * 100)
  return 23.85297 + (5028.796195 * centuries + 1.1054348 * centuries * centuries) / 3600
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

function limb(angle: number, arc: number, names: readonly string[], cycle: number): LimbValue {
  const position = angle / arc
  const index = Math.floor(position) % cycle
  const fraction = position - Math.floor(position)
  const distanceToEdge = Math.min(fraction, 1 - fraction) * arc
  return {
    index: index + 1,
    name: names[index] ?? `#${index + 1}`,
    fraction,
    nearBoundary: distanceToEdge <= BOUNDARY_TOLERANCE_DEGREES,
  }
}

function karanaAt(elongation: number): LimbValue {
  const position = elongation / KARANA_ARC
  const slot = Math.floor(position) % 60
  const fraction = position - Math.floor(position)
  const distanceToEdge = Math.min(fraction, 1 - fraction) * KARANA_ARC

  // Slot 0 is Kiṃstughna; slots 57–59 are Śakuni, Catuṣpada, Nāga; the seven
  // movable karaṇas repeat through the middle of the month.
  let name: string
  if (slot === 0) name = FIXED_KARANA_NAMES[0]
  else if (slot >= 57) name = FIXED_KARANA_NAMES[slot - 56]
  else name = MOVABLE_KARANA_NAMES[(slot - 1) % 7]

  return { index: slot + 1, name, fraction, nearBoundary: distanceToEdge <= BOUNDARY_TOLERANCE_DEGREES }
}

function isoOrNull(time: AstroTime | null): string | null {
  return time ? time.date.toISOString() : null
}

export interface PanchangaInput {
  instant: Date
  latitudeDegrees: number
  longitudeDegrees: number
  elevationMeters?: number
}

export function computePanchanga(input: PanchangaInput): Panchanga {
  const { instant, latitudeDegrees, longitudeDegrees, elevationMeters = 0 } = input
  if (!Number.isFinite(instant.getTime())) throw new Error('Pañcāṅga requires a valid instant.')
  if (latitudeDegrees < -90 || latitudeDegrees > 90) throw new Error('Latitude must lie between -90 and 90 degrees.')
  if (longitudeDegrees < -180 || longitudeDegrees > 180) throw new Error('Longitude must lie between -180 and 180 degrees.')

  const observer = new Observer(latitudeDegrees, longitudeDegrees, elevationMeters)
  const ayanamsa = lahiriAyanamsa(instant)

  const sunTropical = normalize(SunPosition(instant).elon)
  const moonTropical = normalize(EclipticGeoMoon(instant).lon)
  const sunSidereal = normalize(sunTropical - ayanamsa)
  const moonSidereal = normalize(moonTropical - ayanamsa)

  // Tithi and karaṇa depend only on the Sun–Moon elongation, so the ayanāṁśa
  // cancels and they are unaffected by the choice of sidereal zero point.
  const elongation = normalize(moonTropical - sunTropical)

  const tithiPosition = elongation / TITHI_ARC
  const absoluteIndex = Math.floor(tithiPosition) + 1
  const withinPaksha = ((absoluteIndex - 1) % 15) + 1
  const paksha: Paksha = absoluteIndex <= 15 ? 'śukla' : 'kṛṣṇa'
  const tithiFraction = tithiPosition - Math.floor(tithiPosition)
  const tithiEdge = Math.min(tithiFraction, 1 - tithiFraction) * TITHI_ARC
  const tithiName = withinPaksha === 15 ? (paksha === 'śukla' ? 'Pūrṇimā' : 'Amāvāsyā') : TITHI_NAMES[withinPaksha - 1]

  const tithi: TithiValue = {
    index: withinPaksha,
    absoluteIndex,
    name: tithiName,
    paksha,
    fraction: tithiFraction,
    nearBoundary: tithiEdge <= BOUNDARY_TOLERANCE_DEGREES,
  }

  const nakshatra = limb(moonSidereal, DIVISION, NAKSHATRA_NAMES, 27)
  // Yoga takes the sum of the sidereal longitudes, so the ayanāṁśa enters twice.
  const yoga = limb(normalize(sunSidereal + moonSidereal), DIVISION, YOGA_NAMES, 27)
  const karana = karanaAt(elongation)

  // The civil day used for vāra runs sunrise to sunrise, so an instant before
  // sunrise belongs to the previous weekday.
  const sunrise = SearchRiseSet(Body.Sun, observer, +1, instant, -1)
  const sunset = SearchRiseSet(Body.Sun, observer, -1, instant, 1)
  const dayAnchor = sunrise ? sunrise.date : instant
  const varaIndex = dayAnchor.getUTCDay()

  let rahuKala: RahuKala | null = null
  const nextSunset = SearchRiseSet(Body.Sun, observer, -1, dayAnchor, 1)
  if (sunrise && nextSunset && nextSunset.date > dayAnchor) {
    const daylightMs = nextSunset.date.getTime() - dayAnchor.getTime()
    const segment = RAHU_KALA_SEGMENT[varaIndex]
    const start = new Date(dayAnchor.getTime() + (daylightMs * (segment - 1)) / 8)
    const end = new Date(dayAnchor.getTime() + (daylightMs * segment) / 8)
    rahuKala = { start: start.toISOString(), end: end.toISOString(), segment }
  }

  const uncertainLimbs = [
    tithi.nearBoundary ? 'tithi' : null,
    nakshatra.nearBoundary ? 'nakshatra' : null,
    yoga.nearBoundary ? 'yoga' : null,
    karana.nearBoundary ? 'karana' : null,
  ].filter((value) => value !== null)

  return {
    version: PANCHANGA_VERSION,
    instant: instant.toISOString(),
    observer: { latitudeDegrees, longitudeDegrees, elevationMeters },
    ayanamsa: {
      name: 'lahiri',
      degrees: ayanamsa,
      accuracyNote: 'Lahiri (Chitrapakṣa), anchored at J2000.0 and advanced by IAU 2006 general precession in longitude. Agrees with published tables to about an arcsecond over the modern era. A different ayanāṁśa shifts nakshatra and yoga, and leaves tithi and karaṇa unchanged.',
    },
    sunLongitudeTropical: sunTropical,
    moonLongitudeTropical: moonTropical,
    sunLongitudeSidereal: sunSidereal,
    moonLongitudeSidereal: moonSidereal,
    elongation,
    tithi,
    nakshatra,
    yoga,
    karana,
    vara: {
      index: varaIndex + 1,
      name: VARA_NAMES[varaIndex],
      note: sunrise
        ? 'The vāra is taken from the sunrise that opens the current civil day, not from the UTC calendar date.'
        : 'No sunrise was found near this instant, so the vāra falls back to the UTC weekday and should not be relied on.',
    },
    day: {
      sunrise: isoOrNull(sunrise),
      sunset: isoOrNull(sunset),
      note: sunrise && sunset ? undefined : 'The Sun does not both rise and set here on this date, so day-fraction periods such as Rāhu Kāla are undefined.',
    },
    rahuKala,
    uncertainLimbs,
  }
}

/** Marks whether a prior sunrise was resolvable, used only by tests of the vāra rule. */
export function sunriseAnchor(input: PanchangaInput): { current: string | null; previous: string | null } {
  const observer = new Observer(input.latitudeDegrees, input.longitudeDegrees, input.elevationMeters ?? 0)
  return {
    current: isoOrNull(SearchRiseSet(Body.Sun, observer, +1, input.instant, -1)),
    previous: isoOrNull(SearchRiseSet(Body.Sun, observer, +1, input.instant, -2)),
  }
}
