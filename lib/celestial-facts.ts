export const CELESTIAL_FACT_SCHEMA_VERSION = 'celestial-facts/0.1' as const
export const CELESTIAL_FACT_PATH = '/knowledge/celestial' as const
export const CELESTIAL_FACT_SCHEMA_PATH = '/knowledge/celestial/schema' as const
export const CELESTIAL_FACT_RELEASE_DATE = '2026-08-15' as const

export type CelestialSourceRole = 'ephemeris' | 'reference-frames' | 'time-scales' | 'earth-orientation' | 'civil-time' | 'geodesy'

export interface CelestialAuthoritySource {
  id: string
  authority: string
  title: string
  url: string
  role: CelestialSourceRole
  version: string
  verifiedOn: string
  mutable: boolean
  establishes: string
  boundary: string
}

export const CELESTIAL_AUTHORITY_SOURCES: CelestialAuthoritySource[] = [
  {
    id: 'jpl-horizons-4.98d', authority: 'NASA/JPL Solar System Dynamics', title: 'Horizons System Manual',
    url: 'https://ssd.jpl.nasa.gov/horizons/manual.html', role: 'ephemeris', version: '4.98d (2025-11-21)', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: true,
    establishes: 'Solar-system object identifiers, observing centers, time inputs, reference frames, corrections, output quantities, and stated ephemeris limitations.',
    boundary: 'Horizons output is authoritative only with the complete query contract preserved; transformed or rounded values require their own provenance record.',
  },
  {
    id: 'astronomy-engine-2.1.19', authority: 'Don Cross (cosinekitty)', title: 'Astronomy Engine',
    url: 'https://github.com/cosinekitty/astronomy', role: 'ephemeris', version: '2.1.19', verifiedOn: '2026-08-16', mutable: false,
    establishes: 'Locally computed Sun and Moon positions derived from the VSOP87 and JPL-derived lunar theories, together with rise and set times, at the accuracy stated in the library documentation.',
    boundary: 'Positions are computed in process rather than fetched from an authority, so a fact citing this source carries a digest over the computed values and not over a provider response body. Its accuracy is adequate for calendrical work and is not a substitute for a Horizons query where sub-arcsecond agreement matters.',
  },
  {
    id: 'naif-spice-frames-2021', authority: 'NASA/JPL Navigation and Ancillary Information Facility', title: 'SPICE Reference Frames',
    url: 'https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html', role: 'reference-frames', version: '2021-12-31 revision', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: true,
    establishes: 'Frame identifiers, frame centers, transformations, orientation relationships, and the distinction between frames and coordinate representations.',
    boundary: 'A frame name alone does not establish the observing origin, epoch, equinox, time scale, or correction model.',
  },
  {
    id: 'naif-spice-time-2021', authority: 'NASA/JPL Navigation and Ancillary Information Facility', title: 'SPICE Time Subsystem',
    url: 'https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/time.html', role: 'time-scales', version: '2021-12-31 revision', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: true,
    establishes: 'UTC, TAI, TT, TDB, calendar and Julian-date representations, leap-second kernels, and conversions used by SPICE.',
    boundary: 'A civil timestamp is not an ephemeris time until its zone, offset, ambiguity resolution, leap-second data, and target time scale are declared.',
  },
  {
    id: 'iau-sofa-2023-10-11', authority: 'International Astronomical Union SOFA Board', title: 'Standards of Fundamental Astronomy',
    url: 'https://www.iausofa.org/current-software', role: 'reference-frames', version: '2023-10-11', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: true,
    establishes: 'IAU-approved algorithms for astrometry, time scales, Earth rotation, precession, nutation, coordinate transformations, and related fundamental astronomy.',
    boundary: 'SOFA supplies standard algorithms and validation programs; an implementation must still record its exact release and input data products.',
  },
  {
    id: 'iers-bulletins-live', authority: 'International Earth Rotation and Reference Systems Service', title: 'IERS Bulletins',
    url: 'https://datacenter.iers.org/bulletins.php', role: 'earth-orientation', version: 'live bulletin index', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: true,
    establishes: 'Bulletin A and B Earth-orientation parameters, Bulletin C leap-second announcements, and Bulletin D DUT1 announcements.',
    boundary: 'The bulletin number or data-product version used in a computation must be retained; “latest” is not a reproducible version identifier.',
  },
  {
    id: 'iana-tzdb-2026c', authority: 'Internet Assigned Numbers Authority', title: 'Time Zone Database',
    url: 'https://www.iana.org/time-zones/releases/2026c', role: 'civil-time', version: '2026c', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: false,
    establishes: 'Versioned civil-time-zone identifiers, UTC offsets, daylight-saving transitions, and historical rules for representative locations.',
    boundary: 'The database records civil-time practice and can contain historical uncertainty; it does not supply leap seconds or astronomical time scales.',
  },
  {
    id: 'epsg-4326', authority: 'EPSG Geodetic Parameter Registry', title: 'WGS 84 geographic 2D coordinate reference system',
    url: 'https://epsg.org/crs_4326/WGS-84.html', role: 'geodesy', version: 'EPSG:4326 (revision 2022-11-29)', verifiedOn: CELESTIAL_FACT_RELEASE_DATE, mutable: true,
    establishes: 'The WGS 84 latitude and longitude coordinate reference system and axis/unit definitions used for terrestrial observer locations.',
    boundary: 'EPSG:4326 is horizontal; elevation must separately name its value, unit, reference, and uncertainty.',
  },
]

export type CelestialTimeScale = 'UTC' | 'TAI' | 'TT' | 'TDB' | 'UT1'
export type CivilTimeFold = 'unambiguous' | 'earlier-offset' | 'later-offset'

export interface CelestialTimeInstant {
  utcInstant: string
  ephemerisTimeScale: CelestialTimeScale
  localCivilTime?: string
  ianaTimeZone?: string
  utcOffset?: string
  tzdbVersion?: string
  civilTimeFold?: CivilTimeFold
  leapSecondSourceId: string
  earthOrientationSourceId?: string
}

export interface CelestialObserver {
  id: string
  latitudeDegrees: number
  longitudeDegrees: number
  horizontalCrs: 'EPSG:4326'
  elevationMeters: number
  elevationReference: 'ellipsoidal' | 'orthometric' | 'unknown'
  horizontalUncertaintyMeters?: number
  verticalUncertaintyMeters?: number
}

export interface CelestialReferenceContract {
  origin: string
  frame: string
  epoch: string
  equinox: string | null
  timeScale: CelestialTimeScale
  coordinateRepresentation: 'equatorial-spherical' | 'ecliptic-spherical' | 'horizontal-spherical' | 'cartesian-state-vector'
  positionType: 'geometric' | 'astrometric' | 'apparent'
  lightTime: 'applied' | 'not-applied' | 'not-applicable'
  stellarAberration: 'applied' | 'not-applied' | 'not-applicable'
  gravitationalDeflection: 'applied' | 'not-applied' | 'not-applicable'
  atmosphericRefraction: 'applied' | 'not-applied' | 'not-applicable'
}

export interface CelestialCoordinateValue {
  axis: string
  value: number
  unit: 'degree' | 'kilometer' | 'kilometer-per-second'
  precision: number
  uncertainty?: number
}

export interface CelestialProvenance {
  providerSourceId: string
  providerRequestUrl: string
  providerRequestParameters: Record<string, string>
  providerResponseSha256: string
  retrievedAt: string
  software?: { name: string; version: string }
  limitations: string[]
}

export interface CelestialPositionFact {
  id: string
  subject: { name: string; identifiers: Record<string, string> }
  observerId?: string
  reference: CelestialReferenceContract
  coordinates: CelestialCoordinateValue[]
  provenance: CelestialProvenance
}

export interface CelestialFactBundle {
  schemaVersion: typeof CELESTIAL_FACT_SCHEMA_VERSION
  bundleId: string
  recordedAt: string
  time: CelestialTimeInstant
  observers: CelestialObserver[]
  facts: CelestialPositionFact[]
}

export const CELESTIAL_FACT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://www.mahastrategies.com/knowledge/celestial/schema',
  title: 'Maha Celestial Fact Bundle',
  description: 'A provenance-preserving contract for reproducible celestial positions. It contains no scientific explanation or astrological interpretation.',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'bundleId', 'recordedAt', 'time', 'observers', 'facts'],
  $defs: {
    observer: {
      type: 'object', additionalProperties: false,
      required: ['id', 'latitudeDegrees', 'longitudeDegrees', 'horizontalCrs', 'elevationMeters', 'elevationReference'],
      properties: {
        id: { type: 'string', minLength: 1 },
        latitudeDegrees: { type: 'number', minimum: -90, maximum: 90 },
        longitudeDegrees: { type: 'number', minimum: -180, maximum: 180 },
        horizontalCrs: { const: 'EPSG:4326' }, elevationMeters: { type: 'number' },
        elevationReference: { enum: ['ellipsoidal', 'orthometric', 'unknown'] },
        horizontalUncertaintyMeters: { type: 'number', minimum: 0 }, verticalUncertaintyMeters: { type: 'number', minimum: 0 },
      },
    },
    reference: {
      type: 'object', additionalProperties: false,
      required: ['origin', 'frame', 'epoch', 'equinox', 'timeScale', 'coordinateRepresentation', 'positionType', 'lightTime', 'stellarAberration', 'gravitationalDeflection', 'atmosphericRefraction'],
      properties: {
        origin: { type: 'string', minLength: 1 }, frame: { type: 'string', minLength: 1 }, epoch: { type: 'string', minLength: 1 },
        equinox: { type: ['string', 'null'] }, timeScale: { enum: ['UTC', 'TAI', 'TT', 'TDB', 'UT1'] },
        coordinateRepresentation: { enum: ['equatorial-spherical', 'ecliptic-spherical', 'horizontal-spherical', 'cartesian-state-vector'] },
        positionType: { enum: ['geometric', 'astrometric', 'apparent'] },
        lightTime: { enum: ['applied', 'not-applied', 'not-applicable'] },
        stellarAberration: { enum: ['applied', 'not-applied', 'not-applicable'] },
        gravitationalDeflection: { enum: ['applied', 'not-applied', 'not-applicable'] },
        atmosphericRefraction: { enum: ['applied', 'not-applied', 'not-applicable'] },
      },
    },
    coordinate: {
      type: 'object', additionalProperties: false,
      required: ['axis', 'value', 'unit', 'precision'],
      properties: {
        axis: { type: 'string', minLength: 1 }, value: { type: 'number' },
        unit: { enum: ['degree', 'kilometer', 'kilometer-per-second'] }, precision: { type: 'number', minimum: 0 }, uncertainty: { type: 'number', minimum: 0 },
      },
    },
    provenance: {
      type: 'object', additionalProperties: false,
      required: ['providerSourceId', 'providerRequestUrl', 'providerRequestParameters', 'providerResponseSha256', 'retrievedAt', 'limitations'],
      properties: {
        providerSourceId: { type: 'string', minLength: 1 }, providerRequestUrl: { type: 'string', format: 'uri', pattern: '^https://' },
        providerRequestParameters: { type: 'object', additionalProperties: { type: 'string' } },
        providerResponseSha256: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' }, retrievedAt: { type: 'string', format: 'date-time' },
        software: { type: 'object', additionalProperties: false, required: ['name', 'version'], properties: { name: { type: 'string', minLength: 1 }, version: { type: 'string', minLength: 1 } } },
        limitations: { type: 'array', items: { type: 'string', minLength: 1 } },
      },
    },
    fact: {
      type: 'object', additionalProperties: false,
      required: ['id', 'subject', 'reference', 'coordinates', 'provenance'],
      properties: {
        id: { type: 'string', minLength: 1 },
        subject: { type: 'object', additionalProperties: false, required: ['name', 'identifiers'], properties: { name: { type: 'string', minLength: 1 }, identifiers: { type: 'object', minProperties: 1, additionalProperties: { type: 'string' } } } },
        observerId: { type: 'string', minLength: 1 }, reference: { $ref: '#/$defs/reference' },
        coordinates: { type: 'array', minItems: 1, items: { $ref: '#/$defs/coordinate' } }, provenance: { $ref: '#/$defs/provenance' },
      },
    },
  },
  properties: {
    schemaVersion: { const: CELESTIAL_FACT_SCHEMA_VERSION },
    bundleId: { type: 'string', pattern: '^cel_[a-z0-9_-]{8,80}$' },
    recordedAt: { type: 'string', format: 'date-time' },
    time: {
      type: 'object', additionalProperties: false,
      required: ['utcInstant', 'ephemerisTimeScale', 'leapSecondSourceId'],
      properties: {
        utcInstant: { type: 'string', format: 'date-time' },
        ephemerisTimeScale: { enum: ['UTC', 'TAI', 'TT', 'TDB', 'UT1'] },
        localCivilTime: { type: 'string' }, ianaTimeZone: { type: 'string' }, utcOffset: { type: 'string' }, tzdbVersion: { type: 'string' },
        civilTimeFold: { enum: ['unambiguous', 'earlier-offset', 'later-offset'] }, leapSecondSourceId: { type: 'string' }, earthOrientationSourceId: { type: 'string' },
      },
    },
    observers: { type: 'array', items: { $ref: '#/$defs/observer' } },
    facts: { type: 'array', minItems: 1, items: { $ref: '#/$defs/fact' } },
  },
} as const

function isUtcInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value))
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]))
  return value
}

export function canonicalCelestialFactBundle(bundle: CelestialFactBundle): string {
  return JSON.stringify(stableValue(bundle))
}

export function validateCelestialFactBundle(bundle: CelestialFactBundle): string[] {
  const issues: string[] = []
  const sourcesById = new Map(CELESTIAL_AUTHORITY_SOURCES.map((source) => [source.id, source]))
  const sourceIds = new Set(sourcesById.keys())
  if (bundle.schemaVersion !== CELESTIAL_FACT_SCHEMA_VERSION) issues.push('schemaVersion is not supported.')
  if (!/^cel_[a-z0-9_-]{8,80}$/.test(bundle.bundleId)) issues.push('bundleId is not valid.')
  if (!isUtcInstant(bundle.recordedAt)) issues.push('recordedAt must be an explicit UTC instant.')
  if (!isUtcInstant(bundle.time.utcInstant)) issues.push('time.utcInstant must be an explicit UTC instant.')
  if (!sourceIds.has(bundle.time.leapSecondSourceId)) issues.push('time.leapSecondSourceId is not registered.')
  else if (sourcesById.get(bundle.time.leapSecondSourceId)?.role !== 'earth-orientation') issues.push('time.leapSecondSourceId must reference an Earth-orientation authority.')
  if (bundle.time.earthOrientationSourceId && !sourceIds.has(bundle.time.earthOrientationSourceId)) issues.push('time.earthOrientationSourceId is not registered.')
  else if (bundle.time.earthOrientationSourceId && sourcesById.get(bundle.time.earthOrientationSourceId)?.role !== 'earth-orientation') issues.push('time.earthOrientationSourceId must reference an Earth-orientation authority.')

  const civilFields = [bundle.time.localCivilTime, bundle.time.ianaTimeZone, bundle.time.utcOffset, bundle.time.tzdbVersion, bundle.time.civilTimeFold]
  if (civilFields.some((value) => value !== undefined) && civilFields.some((value) => value === undefined)) issues.push('Civil time provenance must include local time, IANA zone, UTC offset, tzdb version, and fold resolution together.')
  if (bundle.time.localCivilTime?.endsWith('Z')) issues.push('localCivilTime must not masquerade as UTC.')
  if (bundle.time.ianaTimeZone && !bundle.time.ianaTimeZone.includes('/')) issues.push('ianaTimeZone must use an IANA area/location identifier.')
  if (bundle.time.utcOffset && !/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/.test(bundle.time.utcOffset)) issues.push('utcOffset must use signed HH:MM form.')

  const observerIds = new Set<string>()
  for (const observer of bundle.observers) {
    if (observerIds.has(observer.id)) issues.push(`Observer ${observer.id} is duplicated.`)
    observerIds.add(observer.id)
    if (observer.latitudeDegrees < -90 || observer.latitudeDegrees > 90) issues.push(`Observer ${observer.id} latitude is outside -90 to 90 degrees.`)
    if (observer.longitudeDegrees < -180 || observer.longitudeDegrees > 180) issues.push(`Observer ${observer.id} longitude is outside -180 to 180 degrees.`)
    if (!Number.isFinite(observer.elevationMeters)) issues.push(`Observer ${observer.id} elevation is not finite.`)
  }

  const factIds = new Set<string>()
  if (bundle.facts.length === 0) issues.push('At least one celestial fact is required.')
  for (const fact of bundle.facts) {
    if (factIds.has(fact.id)) issues.push(`Fact ${fact.id} is duplicated.`)
    factIds.add(fact.id)
    if (Object.keys(fact.subject.identifiers).length === 0) issues.push(`Fact ${fact.id} needs an authority identifier.`)
    if (fact.observerId && !observerIds.has(fact.observerId)) issues.push(`Fact ${fact.id} references an unknown observer.`)
    if (!fact.reference.origin || !fact.reference.frame || !fact.reference.epoch) issues.push(`Fact ${fact.id} needs an origin, frame, and epoch.`)
    if (fact.coordinates.length === 0) issues.push(`Fact ${fact.id} needs coordinates.`)
    if (fact.coordinates.some((coordinate) => !Number.isFinite(coordinate.value) || coordinate.precision < 0)) issues.push(`Fact ${fact.id} contains an invalid coordinate value or precision.`)
    if (!sourceIds.has(fact.provenance.providerSourceId)) issues.push(`Fact ${fact.id} uses an unregistered provider source.`)
    else if (sourcesById.get(fact.provenance.providerSourceId)?.role !== 'ephemeris') issues.push(`Fact ${fact.id} provider must reference an ephemeris authority.`)
    if (!fact.provenance.providerRequestUrl.startsWith('https://')) issues.push(`Fact ${fact.id} provider request must use HTTPS.`)
    if (!/^sha256:[a-f0-9]{64}$/.test(fact.provenance.providerResponseSha256)) issues.push(`Fact ${fact.id} needs a SHA-256 response digest.`)
    if (!isUtcInstant(fact.provenance.retrievedAt)) issues.push(`Fact ${fact.id} retrievedAt must be an explicit UTC instant.`)
  }
  return issues
}

export function assertCelestialFactIntegrity(): void {
  const ids = new Set<string>()
  for (const source of CELESTIAL_AUTHORITY_SOURCES) {
    if (ids.has(source.id)) throw new Error(`Duplicate celestial source ${source.id}`)
    ids.add(source.id)
    if (!source.url.startsWith('https://')) throw new Error(`${source.id} must use HTTPS`)
    if (source.establishes.length < 80 || source.boundary.length < 80) throw new Error(`${source.id} needs an explicit scope and boundary`)
  }
}

assertCelestialFactIntegrity()
