/** Browser-safe ephemeris; receipt hashing remains on the server. */
import { Body, Ecliptic, EclipticGeoMoon, GeoVector, SunPosition } from 'astronomy-engine'

/**
 * The seven classical grahas. Rules keyed to a body absent from the bundle are
 * excluded as `condition-unsatisfied`, which reads as a judgement about the
 * chart when it is really a missing input — so all seven are always computed.
 */
export const CLASSICAL_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
export type ClassicalBody = typeof CLASSICAL_BODIES[number]

/**
 * The three modern outer planets, deliberately a *separate* list rather than an
 * extension of CLASSICAL_BODIES.
 *
 * Three things break if they are merged into the classical set. The
 * public-authority conformance corpus carries real JPL Horizons reference
 * longitudes keyed by ClassicalBody; widening that type would demand Horizons
 * values for three more bodies, and inventing them is the fabricated provenance
 * this file's header exists to refuse. The seven-planet rulership scheme and the
 * nine-lord Vimśottarī sequence are both closed classical structures, so an
 * outer planet entering either would misreport the tradition rather than extend
 * it. And the fact bundle is asserted to be exactly the seven grahas.
 *
 * So these are computed, labelled, and kept out of every classical rule path.
 * `celestial-timing-references.ts` already states the same boundary in prose.
 */
export const MODERN_BODIES = ['Uranus', 'Neptune', 'Pluto'] as const
export type ModernBody = typeof MODERN_BODIES[number]

export function classicalEclipticLongitude(body: ClassicalBody, instant: Date): number {
  if (body === 'Sun') return SunPosition(instant).elon
  if (body === 'Moon') return EclipticGeoMoon(instant).lon
  return Ecliptic(GeoVector(Body[body], instant, true)).elon
}

/**
 * Same apparent geocentric ecliptic longitude of date as the classical bodies,
 * from the same astronomy-engine release, so the two sets are directly
 * comparable. Separate function because the *provenance claim* differs: these
 * three are not covered by the public-authority conformance corpus.
 */
export function modernEclipticLongitude(body: ModernBody, instant: Date): number {
  return Ecliptic(GeoVector(Body[body], instant, true)).elon
}
