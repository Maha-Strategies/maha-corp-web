/**
 * Natal pañcāṅga report.
 *
 * Produces the calendrical facts of a birth moment — janma nakṣatra, tithi,
 * yoga, karaṇa, vāra — together with whatever sourced natal rules apply, and an
 * explicit account of everything withheld.
 *
 * The inputs are personal data. Nothing here logs them, and the caller is
 * expected to keep them out of URLs. The returned record contains the derived
 * values and the digests, not a stored copy of the request.
 */

import {
  getAstrologyPassage,
  getAstrologySource,
  getAstrologyTradition,
  type AstrologyChartType,
} from './astrology-traditions.ts'
import { CompilerRefusal, compileReport } from './interpretation-compiler.ts'
import { buildLocalFactBundle } from './local-fact-bundle.ts'
import { computeNatalChart, type NatalChart } from './natal-chart.ts'
import { computeNatalTiming, type NatalTiming } from './natal-timing.ts'
import { computePanchanga, type Panchanga } from './panchanga.ts'
import { ZonedTimeError, zonedWallTimeToUtc, type CivilTimeFold } from './zoned-time.ts'

export const BIRTH_REPORT_VERSION = 'birth-report/0.4' as const

export interface BirthInput {
  /** `YYYY-MM-DD` local to the birth place. */
  date: string
  /** `HH:MM`, 24-hour, local to the birth place. */
  time: string
  /** IANA zone, e.g. `Asia/Kolkata`. */
  timeZone: string
  latitudeDegrees: number
  longitudeDegrees: number
  elevationMeters?: number
  placeLabel?: string
  /** ISO-8601 UTC instant used for daśā selection and transit geometry. Defaults to birth. */
  timingInstantUtc?: string
}

export interface RenderedPassage {
  id: string
  excerpt: string
  locator: string
  sourceTitle: string
  translator?: string
  editionYear: number
  transcriptionNote?: string
}

export interface RenderedModule {
  id: string
  heading: string
  ruleId: string
  paragraph: string
  observedLimbs: string[]
  disagreements: string[]
  boundary: string
  passages: RenderedPassage[]
}

export interface RenderedTraditionReport {
  traditionId: string
  traditionName: string
  chartType: AstrologyChartType
  modules: RenderedModule[]
  withheld: { ruleId: string; technique: string; reason: string; detail: string }[]
  refusal: { stage: string; message: string; issues: string[] } | null
  reportId: string | null
  inputSha256: string | null
}

export interface BirthReport {
  version: typeof BIRTH_REPORT_VERSION
  instantUtc: string
  utcOffset: string
  fold: CivilTimeFold
  nonexistentLocalTime: boolean
  placeLabel: string
  latitudeDegrees: number
  longitudeDegrees: number
  panchanga: Panchanga
  natalChart: NatalChart
  timing: NatalTiming
  factBundleId: string
  traditions: RenderedTraditionReport[]
  /** Values too close to a division edge to assert at this instant. */
  uncertainLimbs: string[]
}

export class BirthInputError extends Error {}

function renderPassages(passageIds: string[]): RenderedPassage[] {
  return passageIds.flatMap((passageId) => {
    const passage = getAstrologyPassage(passageId)
    if (!passage) return []
    const source = getAstrologySource(passage.sourceId)
    return [{
      id: passage.id,
      excerpt: passage.excerpt,
      locator: passage.locator,
      sourceTitle: source?.title ?? passage.sourceId,
      translator: source?.translator,
      editionYear: source?.editionYear ?? 0,
      transcriptionNote: passage.transcriptionNote,
    }]
  })
}

function compileFor(factBundle: ReturnType<typeof buildLocalFactBundle>, traditionId: string, chartType: AstrologyChartType): RenderedTraditionReport {
  const tradition = getAstrologyTradition(traditionId)
  const base = { traditionId, traditionName: tradition?.name ?? traditionId, chartType }
  try {
    const report = compileReport({ factBundle, traditionId, chartType })
    return {
      ...base,
      modules: report.modules.map((entry) => ({
        id: entry.id,
        heading: entry.heading,
        ruleId: entry.ruleId,
        paragraph: entry.paragraph,
        observedLimbs: entry.observedLimbs,
        disagreements: entry.disagreements,
        boundary: entry.boundary,
        passages: renderPassages(entry.passageIds),
      })),
      withheld: report.exclusions.map((exclusion) => ({ ruleId: exclusion.ruleId, technique: exclusion.technique, reason: exclusion.reason, detail: exclusion.detail })),
      refusal: null,
      reportId: report.reportId,
      inputSha256: report.provenance.inputSha256,
    }
  } catch (error) {
    if (!(error instanceof CompilerRefusal)) throw error
    // A refusal is a result, not a failure to report. It is shown with its
    // stage so the reader can see which gate stopped it.
    return { ...base, modules: [], withheld: [], refusal: { stage: error.stage, message: error.message, issues: error.issues }, reportId: null, inputSha256: null }
  }
}

export function buildBirthReport(input: BirthInput): BirthReport {
  const latitude = Number(input.latitudeDegrees)
  const longitude = Number(input.longitudeDegrees)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new BirthInputError('Latitude must be a number between -90 and 90.')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new BirthInputError('Longitude must be a number between -180 and 180.')

  let resolved
  try {
    resolved = zonedWallTimeToUtc(input.date, input.time, input.timeZone)
  } catch (error) {
    throw error instanceof ZonedTimeError ? new BirthInputError(error.message) : error
  }

  const elevationMeters = Number.isFinite(Number(input.elevationMeters)) ? Number(input.elevationMeters) : 0
  const panchanga = computePanchanga({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude, elevationMeters })
  const factBundle = buildLocalFactBundle({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude, elevationMeters })
  const natalChart = computeNatalChart({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude })
  const timingInstant = input.timingInstantUtc ? new Date(input.timingInstantUtc) : resolved.instant
  if (!Number.isFinite(timingInstant.getTime())) throw new BirthInputError('Timing moment must be a valid UTC date and time.')
  if (timingInstant < resolved.instant) throw new BirthInputError('Timing moment cannot precede the birth instant.')
  const timing = computeNatalTiming({
    natalChart,
    birthInstant: resolved.instant,
    referenceInstant: timingInstant,
    latitudeDegrees: latitude,
    longitudeDegrees: longitude,
  })

  return {
    version: BIRTH_REPORT_VERSION,
    instantUtc: resolved.instant.toISOString(),
    utcOffset: resolved.utcOffset,
    fold: resolved.fold,
    nonexistentLocalTime: resolved.nonexistent,
    placeLabel: input.placeLabel?.trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitudeDegrees: latitude,
    longitudeDegrees: longitude,
    panchanga,
    natalChart,
    timing,
    factBundleId: factBundle.bundleId,
    traditions: [
      compileFor(factBundle, 'vedic-jyotisha', 'natal'),
      compileFor(factBundle, 'hellenistic-ptolemaic', 'natal'),
    ],
    uncertainLimbs: panchanga.uncertainLimbs,
  }
}
