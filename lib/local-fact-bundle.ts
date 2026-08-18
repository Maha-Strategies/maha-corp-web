/**
 * Builds a celestial fact bundle from locally computed positions.
 *
 * The provenance names astronomy-engine as the provider, because that is what
 * actually produced the numbers. Labelling a local computation as a JPL
 * Horizons response would be fabricated provenance — precisely the failure this
 * stack exists to prevent — so the digest is taken over the computed payload
 * and a limitation records that it is not a provider response body.
 */

import { createHash } from 'node:crypto'

import { Body, Ecliptic, EclipticGeoMoon, GeoVector, SunPosition } from 'astronomy-engine'

import { CELESTIAL_FACT_SCHEMA_VERSION, type CelestialFactBundle, type CelestialPositionFact, type CelestialReferenceContract } from './celestial-facts.ts'

export const LOCAL_EPHEMERIS_SOURCE_ID = 'astronomy-engine-2.1.19'

const REFERENCE: CelestialReferenceContract = {
  origin: 'geocentre',
  frame: 'ecliptic of date',
  epoch: 'of date',
  equinox: 'true equinox of date',
  timeScale: 'TT',
  coordinateRepresentation: 'ecliptic-spherical',
  positionType: 'apparent',
  lightTime: 'applied',
  stellarAberration: 'applied',
  gravitationalDeflection: 'not-applied',
  atmosphericRefraction: 'not-applicable',
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/**
 * The seven classical grahas. Rules keyed to a body absent from the bundle are
 * excluded as `condition-unsatisfied`, which reads as a judgement about the
 * chart when it is really a missing input — so all seven are always computed.
 */
export const CLASSICAL_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
export type ClassicalBody = typeof CLASSICAL_BODIES[number]

export function classicalEclipticLongitude(body: ClassicalBody, instant: Date): number {
  if (body === 'Sun') return SunPosition(instant).elon
  if (body === 'Moon') return EclipticGeoMoon(instant).lon
  return Ecliptic(GeoVector(Body[body], instant, true)).elon
}

export interface LocalBundleInput {
  instant: Date
  latitudeDegrees: number
  longitudeDegrees: number
  elevationMeters?: number
  observerId?: string
}

export function buildLocalFactBundle(input: LocalBundleInput): CelestialFactBundle {
  const { instant, latitudeDegrees, longitudeDegrees, elevationMeters = 0, observerId = 'obs-local' } = input
  const iso = instant.toISOString()

  const positions: [string, number][] = CLASSICAL_BODIES.map((body) => [body, normalize(classicalEclipticLongitude(body, instant))])

  const facts: CelestialPositionFact[] = positions.map(([name, longitude]) => ({
    id: `fact-${name.toLowerCase()}`,
    subject: { name, identifiers: { 'astronomy-engine-body': name } },
    observerId,
    reference: REFERENCE,
    coordinates: [{
      axis: 'longitude', value: longitude, unit: 'degree', precision: 0.000001,
      uncertainty: name === 'Moon' ? 0.02 : 0.005,
    }],
    provenance: {
      providerSourceId: LOCAL_EPHEMERIS_SOURCE_ID,
      providerRequestUrl: 'https://github.com/cosinekitty/astronomy',
      providerRequestParameters: { body: name, instant: iso, method: name === 'Sun' ? 'SunPosition' : name === 'Moon' ? 'EclipticGeoMoon' : 'GeoVector+Ecliptic' },
      providerResponseSha256: sha256(JSON.stringify({ body: name, instant: iso, longitude })),
      retrievedAt: iso,
      software: { name: 'astronomy-engine', version: '2.1.19' },
      limitations: [
        'Computed in process rather than fetched, so the digest covers the computed value and not a provider response body.',
        'Apparent geocentric ecliptic longitude of date; latitude and distance are not carried because no rule in the corpus reads them.',
        'Uncertainty is a conservative cross-engine conformance envelope, not the number of printed decimal places; the Moon envelope includes the 1600–2099 extremes.',
      ],
    },
  }))

  // A bundle id must be stable for identical inputs so that a report compiled
  // twice from the same moment and place keeps the same identity.
  const digest = sha256(JSON.stringify({ iso, latitudeDegrees, longitudeDegrees, elevationMeters })).slice(7, 27)

  return {
    schemaVersion: CELESTIAL_FACT_SCHEMA_VERSION,
    bundleId: `cel_local_${digest}`,
    recordedAt: iso,
    time: { utcInstant: iso, ephemerisTimeScale: 'TT', leapSecondSourceId: 'iers-bulletins-live' },
    observers: [{
      id: observerId,
      latitudeDegrees,
      longitudeDegrees,
      horizontalCrs: 'EPSG:4326',
      elevationMeters,
      elevationReference: 'ellipsoidal',
    }],
    facts,
  }
}
