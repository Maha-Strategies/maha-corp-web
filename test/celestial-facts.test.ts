import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CELESTIAL_AUTHORITY_SOURCES,
  CELESTIAL_FACT_SCHEMA,
  CELESTIAL_FACT_SCHEMA_VERSION,
  canonicalCelestialFactBundle,
  validateCelestialFactBundle,
  type CelestialFactBundle,
} from '../lib/celestial-facts.ts'

function validBundle(): CelestialFactBundle {
  return {
    schemaVersion: CELESTIAL_FACT_SCHEMA_VERSION,
    bundleId: 'cel_reference_20260815',
    recordedAt: '2026-08-15T00:00:00Z',
    time: {
      utcInstant: '2026-08-15T00:00:00Z', ephemerisTimeScale: 'TDB',
      localCivilTime: '2026-08-15T05:30:00', ianaTimeZone: 'Asia/Colombo', utcOffset: '+05:30', tzdbVersion: '2026c', civilTimeFold: 'unambiguous',
      leapSecondSourceId: 'iers-bulletins-live', earthOrientationSourceId: 'iers-bulletins-live',
    },
    observers: [{ id: 'obs_colombo', latitudeDegrees: 6.9271, longitudeDegrees: 79.8612, horizontalCrs: 'EPSG:4326', elevationMeters: 7, elevationReference: 'orthometric', horizontalUncertaintyMeters: 1000, verticalUncertaintyMeters: 20 }],
    facts: [{
      id: 'fact_sun_reference', subject: { name: 'Sun', identifiers: { naif: '10' } }, observerId: 'obs_colombo',
      reference: { origin: 'Earth topocenter obs_colombo', frame: 'ICRF', epoch: 'J2000.0', equinox: null, timeScale: 'TDB', coordinateRepresentation: 'equatorial-spherical', positionType: 'apparent', lightTime: 'applied', stellarAberration: 'applied', gravitationalDeflection: 'applied', atmosphericRefraction: 'not-applied' },
      coordinates: [{ axis: 'right-ascension', value: 1, unit: 'degree', precision: 0.000001 }, { axis: 'declination', value: 1, unit: 'degree', precision: 0.000001 }],
      provenance: { providerSourceId: 'jpl-horizons-4.98d', providerRequestUrl: 'https://ssd.jpl.nasa.gov/api/horizons.api', providerRequestParameters: { COMMAND: '10' }, providerResponseSha256: `sha256:${'a'.repeat(64)}`, retrievedAt: '2026-08-15T00:01:00Z', limitations: ['Synthetic coordinate values used only to validate the record contract.'] },
    }],
  }
}

test('authority registry is unique, official, versioned, and bounded', () => {
  assert.ok(CELESTIAL_AUTHORITY_SOURCES.length >= 7)
  assert.equal(new Set(CELESTIAL_AUTHORITY_SOURCES.map((source) => source.id)).size, CELESTIAL_AUTHORITY_SOURCES.length)
  for (const source of CELESTIAL_AUTHORITY_SOURCES) {
    assert.match(source.url, /^https:\/\//)
    assert.ok(source.version.length > 3)
    assert.ok(source.establishes.length >= 80)
    assert.ok(source.boundary.length >= 80)
  }
})

test('a complete celestial fact bundle passes the contract', () => {
  assert.deepEqual(validateCelestialFactBundle(validBundle()), [])
})

test('civil-time provenance fails closed when resolution fields are incomplete', () => {
  const bundle = validBundle()
  delete bundle.time.tzdbVersion
  assert.ok(validateCelestialFactBundle(bundle).some((issue) => issue.includes('Civil time provenance')))
})

test('frames, observers, providers, and response digests cannot be implicit', () => {
  const bundle = validBundle()
  bundle.facts[0].observerId = 'missing'
  bundle.facts[0].reference.frame = ''
  bundle.facts[0].provenance.providerSourceId = 'unknown'
  bundle.facts[0].provenance.providerResponseSha256 = 'not-a-digest'
  const issues = validateCelestialFactBundle(bundle).join(' ')
  assert.match(issues, /unknown observer/)
  assert.match(issues, /origin, frame, and epoch/)
  assert.match(issues, /unregistered provider/)
  assert.match(issues, /SHA-256/)
})

test('canonicalization is independent of object key insertion order', () => {
  const first = validBundle()
  const second = { facts: first.facts, observers: first.observers, time: first.time, recordedAt: first.recordedAt, bundleId: first.bundleId, schemaVersion: first.schemaVersion } as CelestialFactBundle
  assert.equal(canonicalCelestialFactBundle(first), canonicalCelestialFactBundle(second))
})

test('public schema remains a fact-only contract', () => {
  const serialized = JSON.stringify(CELESTIAL_FACT_SCHEMA).toLowerCase()
  assert.match(serialized, /no scientific explanation or astrological interpretation/)
  assert.ok(!serialized.includes('horoscope'))
  assert.ok(!serialized.includes('zodiac'))
  assert.equal(CELESTIAL_FACT_SCHEMA.$defs.fact.additionalProperties, false)
  assert.equal(CELESTIAL_FACT_SCHEMA.$defs.reference.additionalProperties, false)
})

test('authority roles cannot be substituted merely because an identifier exists', () => {
  const bundle = validBundle()
  bundle.time.leapSecondSourceId = 'jpl-horizons-4.98d'
  bundle.facts[0].provenance.providerSourceId = 'iana-tzdb-2026c'
  const issues = validateCelestialFactBundle(bundle).join(' ')
  assert.match(issues, /Earth-orientation authority/)
  assert.match(issues, /ephemeris authority/)
})
