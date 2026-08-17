/**
 * Evidence-bound corporate formation report.
 *
 * This is intentionally not a natal report with a company name substituted
 * for a person. It records an organization event, its evidence and uncertainty,
 * then applies a versioned corporate significator policy only when the declared
 * event-time window leaves the relevant whole-sign geometry stable.
 */

import { ASTROLOGY_PROHIBITED_USES, getAstrologyTradition } from './astrology-traditions.ts'
import { digestOf } from './celestial-hypotheses/canonical.ts'
import { CompilerRefusal, compileReport, type RuleExclusion } from './interpretation-compiler.ts'
import { buildLocalFactBundle } from './local-fact-bundle.ts'
import { computeNatalChart, type NatalChart, type NatalHouse } from './natal-chart.ts'
import { computePanchanga, type Panchanga } from './panchanga.ts'
import { ZonedTimeError, zonedWallTimeToUtc, type CivilTimeFold } from './zoned-time.ts'

export const CORPORATE_REPORT_VERSION = 'corporate-mundane-report/0.1' as const
export const CORPORATE_LOCATION_POLICY_VERSION = 'corporate-event-location-policy/0.1' as const
export const CORPORATE_SIGNIFICATOR_POLICY_VERSION = 'maha-jyotisha-corporate-foundation/0.1' as const

export const FORMATION_EVENT_TYPES = [
  'filing-submitted',
  'filing-accepted',
  'certificate-issued',
  'first-commercial-transaction',
  'first-deployment',
  'public-launch',
  'merger-effective',
  'acquisition-close',
  'other',
] as const
export type FormationEventType = typeof FORMATION_EVENT_TYPES[number]

export const EVENT_TIME_CONFIDENCE_LEVELS = [
  'recorded-instant',
  'recorded-minute',
  'recorded-hour',
  'official-date-only',
  'estimated',
] as const
export type EventTimeConfidence = typeof EVENT_TIME_CONFIDENCE_LEVELS[number]

export const EVENT_LOCATION_BASES = [
  'authority-location',
  'registered-office',
  'operational-location',
  'transaction-location',
  'deployment-region',
  'merger-closing-location',
] as const
export type EventLocationBasis = typeof EVENT_LOCATION_BASES[number]

export const CORPORATE_EVIDENCE_KINDS = [
  'government-record',
  'bank-record',
  'platform-record',
  'deployment-record',
  'contract',
  'contemporaneous-record',
  'other',
] as const
export type CorporateEvidenceKind = typeof CORPORATE_EVIDENCE_KINDS[number]

export interface EvidenceAttachmentDigest {
  filename: string
  mediaType: string
  byteLength: number
  sha256: string
}

export interface CorporateReportInput {
  organizationName: string
  eventType: FormationEventType
  date: string
  time: string
  timeZone: string
  timeConfidence: EventTimeConfidence
  uncertaintyMinutes: number
  placeLabel?: string
  latitudeDegrees: number
  longitudeDegrees: number
  elevationMeters?: number
  locationBasis: EventLocationBasis
  locationRationale?: string
  jurisdictionCountryCode: string
  jurisdictionRegion?: string
  registrationAuthority: string
  entityIdentifier?: string
  evidenceKind: CorporateEvidenceKind
  evidenceReference: string
  evidenceAttachment?: EvidenceAttachmentDigest
}

export interface CorporateHouseDomain {
  house: number
  domain: string
  sign: string
  ruler: string
  rulerHouse: number
  occupants: string[]
}

export interface CorporateSignificator {
  point: string
  organizationalDomain: string
}

export interface CorporateInterpretationResult {
  traditionId: 'vedic-jyotisha'
  traditionName: string
  chartType: 'corporate'
  status: 'compiled' | 'withheld'
  modules: { ruleId: string; heading: string; paragraph: string; boundary: string; passageIds: string[] }[]
  exclusions: RuleExclusion[]
  refusal: { stage: string; message: string; issues: string[] } | null
  reportId: string | null
  inputSha256: string | null
}

export interface CorporateReport {
  version: typeof CORPORATE_REPORT_VERSION
  reportId: string
  subjectType: 'organization'
  organizationName: string
  formationEvent: {
    type: FormationEventType
    label: string
    representativeInstantUtc: string
    localDate: string
    localTime: string
    timeZone: string
    utcOffset: string
    fold: CivilTimeFold
    confidence: EventTimeConfidence
    uncertaintyMinutes: number
    possibleStartUtc: string
    possibleEndUtc: string
    evidence: {
      kind: CorporateEvidenceKind
      reference: string
      attachment?: EvidenceAttachmentDigest
    }
  }
  jurisdiction: {
    countryCode: string
    region?: string
    registrationAuthority: string
    entityIdentifier?: string
  }
  eventLocation: {
    label: string
    latitudeDegrees: number
    longitudeDegrees: number
    basis: EventLocationBasis
    policyVersion: typeof CORPORATE_LOCATION_POLICY_VERSION
    policyStatus: 'recommended' | 'documented-exception'
    rationale: string
  }
  panchanga: Panchanga
  formationChart: NatalChart
  timeSensitivity: {
    status: 'point-in-time' | 'stable-across-declared-window' | 'unstable-across-declared-window'
    ascendantSignStable: boolean
    wholeSignHousesStable: boolean
    panchangaLimbsChanged: string[]
    organizationHouseApplicationsAllowed: boolean
    explanation: string
  }
  organizationFramework: {
    version: typeof CORPORATE_SIGNIFICATOR_POLICY_VERSION
    traditionId: 'vedic-jyotisha'
    traditionName: string
    status: 'maha-synthesis-unvalidated'
    practitionerReviewRequired: true
    eventFocusHouses: number[]
    houses: CorporateHouseDomain[]
    significators: CorporateSignificator[]
    boundary: string
  }
  interpretation: CorporateInterpretationResult
  factBundleId: string
  inputSha256: string
  refusals: string[]
}

export class CorporateReportInputError extends Error {}

const EVENT_LABELS: Record<FormationEventType, string> = {
  'filing-submitted': 'Filing submitted',
  'filing-accepted': 'Filing accepted',
  'certificate-issued': 'Certificate issued',
  'first-commercial-transaction': 'First commercial transaction',
  'first-deployment': 'First deployment',
  'public-launch': 'Public launch',
  'merger-effective': 'Merger effective',
  'acquisition-close': 'Acquisition close',
  other: 'Other documented formation event',
}

const RECOMMENDED_LOCATION_BASES: Record<FormationEventType, EventLocationBasis[]> = {
  'filing-submitted': ['authority-location', 'registered-office'],
  'filing-accepted': ['authority-location', 'registered-office'],
  'certificate-issued': ['authority-location', 'registered-office'],
  'first-commercial-transaction': ['transaction-location', 'operational-location'],
  'first-deployment': ['deployment-region', 'operational-location'],
  'public-launch': ['operational-location', 'deployment-region'],
  'merger-effective': ['merger-closing-location', 'authority-location'],
  'acquisition-close': ['merger-closing-location', 'authority-location'],
  other: ['operational-location', 'registered-office'],
}

const EVENT_FOCUS_HOUSES: Record<FormationEventType, number[]> = {
  'filing-submitted': [1, 9, 10],
  'filing-accepted': [1, 9, 10],
  'certificate-issued': [1, 9, 10],
  'first-commercial-transaction': [2, 7, 11],
  'first-deployment': [3, 6, 10],
  'public-launch': [3, 10, 11],
  'merger-effective': [7, 8, 10],
  'acquisition-close': [7, 8, 10],
  other: [1, 10],
}

const HOUSE_DOMAINS = [
  'organizational identity and formation',
  'owned resources, liquidity, and revenue records',
  'communications, distribution, and routine operations',
  'registered base, premises, and institutional roots',
  'products, creative output, and speculative initiatives',
  'service delivery, workforce operations, and liabilities',
  'contracts, counterparties, and formal partnerships',
  'shared assets, obligations, restructuring, and discontinuity',
  'law, regulation, publishing, and cross-border reach',
  'governance, public responsibility, and organizational action',
  'networks, market participation, and realized gains',
  'hidden costs, closure, isolation, and institutional loss',
] as const

const SIGNIFICATORS: CorporateSignificator[] = [
  { point: 'Ascendant', organizationalDomain: 'the constituted organization and the event-defined identity' },
  { point: 'Sun', organizationalDomain: 'governance, executive authority, and public mandate' },
  { point: 'Moon', organizationalDomain: 'stakeholder response, operating rhythm, and public reception' },
  { point: 'Mercury', organizationalDomain: 'contracts, accounting, information, and commercial communication' },
  { point: 'Venus', organizationalDomain: 'alliances, customer affinity, design, and negotiated value' },
  { point: 'Mars', organizationalDomain: 'execution, competition, engineering effort, and conflict' },
  { point: 'Jupiter', organizationalDomain: 'institutional expansion, counsel, capital access, and policy' },
  { point: 'Saturn', organizationalDomain: 'durability, constraints, compliance, and long-term obligations' },
  { point: 'Rahu/Ketu', organizationalDomain: 'the mean-node axis used by this convention; no outcome is inferred from it here' },
]

const CORPORATE_REFUSALS = [
  'The report does not estimate enterprise valuation or certify a valuation method.',
  'The report does not predict investment return, recommend a security, or guide a financial transaction.',
  'The report does not guarantee revenue, growth, survival, financing, market adoption, or any other business outcome.',
  'The report does not establish legal formation, good standing, regulatory compliance, or the legal effect of an event.',
] as const

function bounded(value: string | undefined, label: string, maximum: number, required = true): string {
  const clean = value?.trim() ?? ''
  if (required && !clean) throw new CorporateReportInputError(`${label} is required.`)
  if (clean.length > maximum) throw new CorporateReportInputError(`${label} must be ${maximum} characters or fewer.`)
  return clean
}

function validateUncertainty(confidence: EventTimeConfidence, value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 43_200) throw new CorporateReportInputError('Time uncertainty must be between 0 and 43,200 minutes.')
  const minimums: Record<EventTimeConfidence, number> = {
    'recorded-instant': 0,
    'recorded-minute': 1,
    'recorded-hour': 30,
    'official-date-only': 720,
    estimated: 1,
  }
  if (confidence === 'recorded-instant' && value !== 0) throw new CorporateReportInputError('A recorded instant must use zero minutes of uncertainty.')
  if (value < minimums[confidence]) throw new CorporateReportInputError(`${confidence} requires at least ${minimums[confidence]} minutes of uncertainty.`)
  return value
}

function sameWholeSignGeometry(first: NatalChart, second: NatalChart): boolean {
  if (first.ascendant.sidereal.sign !== second.ascendant.sidereal.sign) return false
  const secondHouses = new Map(second.placements.map((point) => [point.name, point.wholeSignHouse]))
  return first.placements.every((point) => secondHouses.get(point.name) === point.wholeSignHouse)
}

function changedPanchangaLimbs(first: Panchanga, second: Panchanga): string[] {
  return [
    ['tithi', first.tithi.name, second.tithi.name],
    ['nakshatra', first.nakshatra.name, second.nakshatra.name],
    ['yoga', first.yoga.name, second.yoga.name],
    ['karana', first.karana.name, second.karana.name],
    ['vara', first.vara.name, second.vara.name],
  ].filter(([, left, right]) => left !== right).map(([limb]) => limb)
}

function houseDomain(house: NatalHouse): CorporateHouseDomain {
  return {
    house: house.number,
    domain: HOUSE_DOMAINS[house.number - 1],
    sign: house.sign,
    ruler: house.ruler,
    rulerHouse: house.rulerHouse,
    occupants: house.occupants,
  }
}

export function buildCorporateReport(input: CorporateReportInput): CorporateReport {
  const organizationName = bounded(input.organizationName, 'Organization name', 160)
  if (!FORMATION_EVENT_TYPES.includes(input.eventType)) throw new CorporateReportInputError('Formation event type is not supported.')
  if (!EVENT_TIME_CONFIDENCE_LEVELS.includes(input.timeConfidence)) throw new CorporateReportInputError('Event-time confidence is not supported.')
  if (!EVENT_LOCATION_BASES.includes(input.locationBasis)) throw new CorporateReportInputError('Event-location basis is not supported.')
  if (!CORPORATE_EVIDENCE_KINDS.includes(input.evidenceKind)) throw new CorporateReportInputError('Evidence type is not supported.')

  const uncertaintyMinutes = validateUncertainty(input.timeConfidence, Number(input.uncertaintyMinutes))
  if (input.timeConfidence === 'official-date-only' && input.time !== '12:00') {
    throw new CorporateReportInputError('An official date without a recorded time must use 12:00 local as its representative midpoint.')
  }
  const latitude = Number(input.latitudeDegrees)
  const longitude = Number(input.longitudeDegrees)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new CorporateReportInputError('Latitude must be a number between -90 and 90.')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new CorporateReportInputError('Longitude must be a number between -180 and 180.')
  const countryCode = bounded(input.jurisdictionCountryCode, 'Jurisdiction country code', 2).toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new CorporateReportInputError('Jurisdiction country code must be a two-letter ISO code.')

  let resolved
  try {
    resolved = zonedWallTimeToUtc(input.date, input.time, input.timeZone)
  } catch (error) {
    throw error instanceof ZonedTimeError ? new CorporateReportInputError(error.message) : error
  }
  if (resolved.nonexistent) throw new CorporateReportInputError('The selected local time does not exist because of a clock change. Choose a recorded valid time.')

  const evidenceReference = bounded(input.evidenceReference, 'Evidence reference', 500)
  let evidenceAttachment: EvidenceAttachmentDigest | undefined
  if (input.evidenceAttachment) {
    const filename = bounded(input.evidenceAttachment.filename, 'Evidence filename', 180)
    const mediaType = bounded(input.evidenceAttachment.mediaType, 'Evidence media type', 120)
    const byteLength = Number(input.evidenceAttachment.byteLength)
    if (!Number.isInteger(byteLength) || byteLength < 1 || byteLength > 5 * 1024 * 1024) throw new CorporateReportInputError('Evidence attachment size must be between 1 byte and 5 MB.')
    if (!/^sha256:[a-f0-9]{64}$/.test(input.evidenceAttachment.sha256)) throw new CorporateReportInputError('Evidence attachment must have a valid SHA-256 fingerprint.')
    evidenceAttachment = { filename, mediaType, byteLength, sha256: input.evidenceAttachment.sha256 }
  }
  const registrationAuthority = bounded(input.registrationAuthority, 'Registration authority', 200)
  const recommendedBases = RECOMMENDED_LOCATION_BASES[input.eventType]
  const policyStatus = recommendedBases.includes(input.locationBasis) ? 'recommended' : 'documented-exception'
  const locationRationale = bounded(
    input.locationRationale,
    'Location rationale',
    500,
    policyStatus === 'documented-exception',
  ) || `The ${input.locationBasis.replaceAll('-', ' ')} is a recommended location basis for this event type.`

  const elevationMeters = Number.isFinite(Number(input.elevationMeters)) ? Number(input.elevationMeters) : 0
  const halfWindowMs = uncertaintyMinutes * 60_000
  const possibleStart = new Date(resolved.instant.getTime() - halfWindowMs)
  const possibleEnd = new Date(resolved.instant.getTime() + halfWindowMs)
  const chart = computeNatalChart({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude })
  const startChart = uncertaintyMinutes === 0 ? chart : computeNatalChart({ instant: possibleStart, latitudeDegrees: latitude, longitudeDegrees: longitude })
  const endChart = uncertaintyMinutes === 0 ? chart : computeNatalChart({ instant: possibleEnd, latitudeDegrees: latitude, longitudeDegrees: longitude })
  const ascendantSignStable = startChart.ascendant.sidereal.sign === chart.ascendant.sidereal.sign
    && chart.ascendant.sidereal.sign === endChart.ascendant.sidereal.sign
  const wholeSignHousesStable = sameWholeSignGeometry(startChart, chart) && sameWholeSignGeometry(chart, endChart)

  const panchanga = computePanchanga({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude, elevationMeters })
  const startPanchanga = uncertaintyMinutes === 0 ? panchanga : computePanchanga({ instant: possibleStart, latitudeDegrees: latitude, longitudeDegrees: longitude, elevationMeters })
  const endPanchanga = uncertaintyMinutes === 0 ? panchanga : computePanchanga({ instant: possibleEnd, latitudeDegrees: latitude, longitudeDegrees: longitude, elevationMeters })
  const panchangaLimbsChanged = [...new Set([
    ...changedPanchangaLimbs(startPanchanga, panchanga),
    ...changedPanchangaLimbs(panchanga, endPanchanga),
  ])]
  const allowed = ascendantSignStable && wholeSignHousesStable
  const timeStatus = uncertaintyMinutes === 0
    ? 'point-in-time'
    : allowed ? 'stable-across-declared-window' : 'unstable-across-declared-window'

  const factBundle = buildLocalFactBundle({ instant: resolved.instant, latitudeDegrees: latitude, longitudeDegrees: longitude, elevationMeters })
  const tradition = getAstrologyTradition('vedic-jyotisha')
  let interpretation: CorporateInterpretationResult
  const legalFormationEvent = input.eventType === 'filing-accepted' || input.eventType === 'certificate-issued'
  try {
    if (!legalFormationEvent) {
      throw new CompilerRefusal(
        'event-scope',
        'The current source-bound corporate rule is limited to legal formation. It is not generalized to this event type.',
        [`${input.eventType} requires its own sourced and reviewed corporate rule before interpretation.`],
      )
    }
    const compiled = compileReport({ factBundle, traditionId: 'vedic-jyotisha', chartType: 'corporate' })
    interpretation = {
      traditionId: 'vedic-jyotisha', traditionName: compiled.traditionName, chartType: 'corporate', status: 'compiled',
      modules: compiled.modules.map((module) => ({ ruleId: module.ruleId, heading: module.heading, paragraph: module.paragraph, boundary: module.boundary, passageIds: module.passageIds })),
      exclusions: compiled.exclusions, refusal: null, reportId: compiled.reportId, inputSha256: compiled.provenance.inputSha256,
    }
  } catch (error) {
    if (!(error instanceof CompilerRefusal)) throw error
    interpretation = {
      traditionId: 'vedic-jyotisha', traditionName: tradition?.name ?? 'Vedic (Jyotiṣa)', chartType: 'corporate', status: 'withheld',
      modules: [], exclusions: [], refusal: { stage: error.stage, message: error.message, issues: error.issues }, reportId: null, inputSha256: null,
    }
  }

  const normalizedInput = {
    version: CORPORATE_REPORT_VERSION, organizationName, eventType: input.eventType,
    instantUtc: resolved.instant.toISOString(), timeConfidence: input.timeConfidence, uncertaintyMinutes,
    latitude, longitude, locationBasis: input.locationBasis, locationRationale,
    countryCode, jurisdictionRegion: input.jurisdictionRegion?.trim() || null,
    registrationAuthority, entityIdentifier: input.entityIdentifier?.trim() || null,
    evidenceKind: input.evidenceKind, evidenceReference, evidenceAttachment: evidenceAttachment ?? null,
    locationPolicyVersion: CORPORATE_LOCATION_POLICY_VERSION,
    significatorPolicyVersion: CORPORATE_SIGNIFICATOR_POLICY_VERSION,
  }
  const inputSha256 = digestOf(normalizedInput)

  return {
    version: CORPORATE_REPORT_VERSION,
    reportId: `corp_${inputSha256.slice(7, 27)}`,
    subjectType: 'organization',
    organizationName,
    formationEvent: {
      type: input.eventType,
      label: EVENT_LABELS[input.eventType],
      representativeInstantUtc: resolved.instant.toISOString(),
      localDate: input.date,
      localTime: input.time,
      timeZone: input.timeZone,
      utcOffset: resolved.utcOffset,
      fold: resolved.fold,
      confidence: input.timeConfidence,
      uncertaintyMinutes,
      possibleStartUtc: possibleStart.toISOString(),
      possibleEndUtc: possibleEnd.toISOString(),
      evidence: { kind: input.evidenceKind, reference: evidenceReference, attachment: evidenceAttachment },
    },
    jurisdiction: {
      countryCode,
      region: bounded(input.jurisdictionRegion, 'Jurisdiction region', 160, false) || undefined,
      registrationAuthority,
      entityIdentifier: bounded(input.entityIdentifier, 'Entity identifier', 160, false) || undefined,
    },
    eventLocation: {
      label: bounded(input.placeLabel, 'Event location', 200, false) || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitudeDegrees: latitude,
      longitudeDegrees: longitude,
      basis: input.locationBasis,
      policyVersion: CORPORATE_LOCATION_POLICY_VERSION,
      policyStatus,
      rationale: locationRationale,
    },
    panchanga,
    formationChart: chart,
    timeSensitivity: {
      status: timeStatus,
      ascendantSignStable,
      wholeSignHousesStable,
      panchangaLimbsChanged,
      organizationHouseApplicationsAllowed: allowed,
      explanation: allowed
        ? 'The sampled endpoints preserve the sidereal ascendant sign and every whole-sign placement across the declared time window.'
        : 'The declared time window changes the ascendant or a whole-sign placement. Organization-house applications are withheld; the representative chart remains visible only as a calculation at the entered time.',
    },
    organizationFramework: {
      version: CORPORATE_SIGNIFICATOR_POLICY_VERSION,
      traditionId: 'vedic-jyotisha',
      traditionName: tradition?.name ?? 'Vedic (Jyotiṣa)',
      status: 'maha-synthesis-unvalidated',
      practitionerReviewRequired: true,
      eventFocusHouses: EVENT_FOCUS_HOUSES[input.eventType],
      houses: allowed ? chart.houses.map(houseDomain) : [],
      significators: SIGNIFICATORS,
      boundary: 'These organization domains and significators are a versioned Maha synthesis under a named Jyotiṣa convention. They are not classical consensus, empirical findings, or predictions. Empty house applications mean the declared event-time window did not support stable house geometry.',
    },
    interpretation,
    factBundleId: factBundle.bundleId,
    inputSha256,
    refusals: [...CORPORATE_REFUSALS, ...ASTROLOGY_PROHIBITED_USES],
  }
}
