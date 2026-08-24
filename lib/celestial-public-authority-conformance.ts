import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { SearchMoonPhase } from 'astronomy-engine'

import { CLASSICAL_BODIES, classicalEclipticLongitude, type ClassicalBody } from './local-fact-bundle.ts'

export const PUBLIC_AUTHORITY_CONFORMANCE_DATE = '2026-08-24' as const
const PUBLIC_AUTHORITY_CONFORMANCE_PATH = join(
  process.cwd(),
  'public',
  'conformance',
  'celestial-public-authority-v1.json',
)

export interface PublicAuthorityConformanceCorpus {
  schemaVersion: 'celestial-public-authority-conformance/1.0'
  corpusVersion: string
  retrievedAt: string
  privacyBoundary: string
  jplHorizons: {
    authority: string
    apiSignatureVersion: string
    documentationVersion: string
    manualVersion: string
    ephemeris: string
    sourceUrl: string
    manualUrl: string
    queryContract: Record<string, string>
    targetIds: Record<ClassicalBody, string>
  }
  longitudeToleranceDegrees: number
  longitudeCases: Array<{
    id: string
    instantUtc: string
    referenceLongitudes: Record<ClassicalBody, number>
  }>
  usnoMoonPhases: {
    authority: string
    apiVersion: string
    sourceUrl: string
    documentationUrl: string
    timeToleranceMinutes: number
    events: Array<{
      id: string
      phase: string
      phaseAngleDegrees: number
      searchStartUtc: string
      referenceUtcMinute: string
    }>
  }
  interpretationBoundary: string
}

function angularError(actual: number, expected: number): number {
  return Math.abs(((actual - expected + 540) % 360) - 180)
}

export function validatePublicAuthorityConformanceCorpus(value: unknown): asserts value is PublicAuthorityConformanceCorpus {
  if (!value || typeof value !== 'object') throw new Error('Public-authority conformance corpus must be an object.')
  const corpus = value as Partial<PublicAuthorityConformanceCorpus>
  if (corpus.schemaVersion !== 'celestial-public-authority-conformance/1.0') throw new Error('Unsupported public-authority conformance schema.')
  if (!Array.isArray(corpus.longitudeCases) || corpus.longitudeCases.length < 4) throw new Error('At least four JPL longitude cases are required.')
  if (!Array.isArray(corpus.usnoMoonPhases?.events) || corpus.usnoMoonPhases.events.length < 2) throw new Error('At least two USNO phase events are required.')
  if (corpus.jplHorizons?.ephemeris !== 'DE441') throw new Error('JPL ephemeris provenance is missing.')
  if (!corpus.privacyBoundary || !corpus.interpretationBoundary) throw new Error('Conformance boundaries are required.')
}

export async function loadPublicAuthorityConformanceCorpus(
  path = PUBLIC_AUTHORITY_CONFORMANCE_PATH,
): Promise<PublicAuthorityConformanceCorpus> {
  const corpus = JSON.parse(await readFile(path, 'utf8')) as unknown
  validatePublicAuthorityConformanceCorpus(corpus)
  return corpus
}

export function evaluatePublicAuthorityConformance(corpus: PublicAuthorityConformanceCorpus) {
  const longitudeResults = corpus.longitudeCases.flatMap((entry) => CLASSICAL_BODIES.map((body) => {
    const actual = classicalEclipticLongitude(body, new Date(entry.instantUtc))
    const expected = entry.referenceLongitudes[body]
    return { caseId: entry.id, body, actual, expected, errorDegrees: angularError(actual, expected) }
  }))
  const moonPhaseResults = corpus.usnoMoonPhases.events.map((entry) => {
    const actual = SearchMoonPhase(entry.phaseAngleDegrees, new Date(entry.searchStartUtc), 40)?.date ?? null
    const errorMinutes = actual ? Math.abs(actual.getTime() - Date.parse(entry.referenceUtcMinute)) / 60_000 : null
    return { ...entry, actualUtc: actual?.toISOString() ?? null, errorMinutes }
  })
  const maximumLongitudeErrorDegrees = Math.max(...longitudeResults.map((entry) => entry.errorDegrees))
  const maximumPhaseTimeErrorMinutes = Math.max(...moonPhaseResults.map((entry) => entry.errorMinutes ?? Number.POSITIVE_INFINITY))
  const disagreements = [
    ...longitudeResults.filter((entry) => entry.errorDegrees > corpus.longitudeToleranceDegrees).map((entry) => `${entry.caseId}:${entry.body}:longitude`),
    ...moonPhaseResults.filter((entry) => entry.errorMinutes === null || entry.errorMinutes > corpus.usnoMoonPhases.timeToleranceMinutes).map((entry) => `${entry.id}:phase-time`),
  ]
  return {
    corpusVersion: corpus.corpusVersion,
    authorities: [corpus.jplHorizons.authority, corpus.usnoMoonPhases.authority],
    counts: { longitudeComparisons: longitudeResults.length, moonPhaseEvents: moonPhaseResults.length },
    maxima: { maximumLongitudeErrorDegrees, maximumPhaseTimeErrorMinutes },
    tolerances: { longitudeDegrees: corpus.longitudeToleranceDegrees, phaseTimeMinutes: corpus.usnoMoonPhases.timeToleranceMinutes },
    disagreements,
    longitudeResults,
    moonPhaseResults,
    privacyBoundary: corpus.privacyBoundary,
    interpretationBoundary: corpus.interpretationBoundary,
  }
}
