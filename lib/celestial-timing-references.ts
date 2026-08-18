import { VIMSHOTTARI_LORDS, VIMSHOTTARI_YEARS, type VimshottariLord } from './natal-timing.ts'

export const TIMING_REFERENCE_RELEASE_DATE = '2026-08-18' as const
export const TIMING_REFERENCE_PATH = '/knowledge/astrology/timing' as const
export const TIMING_REFERENCE_CATEGORIES = ['Ingresses', 'Stations', 'Lunations', 'Vimśottarī daśā'] as const

export type TimingReferenceCategory = typeof TIMING_REFERENCE_CATEGORIES[number]
export type TimingReferenceStatus = 'production-derived' | 'method-reference' | 'source-review-pending'

export interface TimingReferenceSource {
  id: string
  authority: string
  title: string
  url: string
  version: string
  establishes: string
  boundary: string
}

export interface TimingReference {
  slug: string
  category: TimingReferenceCategory
  title: string
  description: string
  definition: string
  calculation: string
  requiredInputs: readonly string[]
  mahaConvention: string
  uncertainty: string
  reportUse: string
  doesNotEstablish: string
  sourceIds: readonly string[]
  relatedSlugs: readonly string[]
  implementationStatus: TimingReferenceStatus
}

export const TIMING_REFERENCE_SOURCES: readonly TimingReferenceSource[] = [
  {
    id: 'jpl-horizons-4.98d', authority: 'NASA/JPL Solar System Dynamics', title: 'Horizons System Manual',
    url: 'https://ssd.jpl.nasa.gov/horizons/manual.html', version: '4.98d (2025-11-21)',
    establishes: 'Time-indexed solar-system states, observer centers, coordinate frames, apparent corrections, and output quantities used to verify planetary event searches.',
    boundary: 'Horizons establishes astronomical states only when the complete query contract is retained; it supplies no astrological interpretation.',
  },
  {
    id: 'astronomy-engine-2.1.19', authority: 'Don Cross (cosinekitty)', title: 'Astronomy Engine',
    url: 'https://github.com/cosinekitty/astronomy', version: '2.1.19',
    establishes: 'Locally computed planetary longitudes, moon phases, eclipses, and search primitives used by Maha’s deterministic calculation layer.',
    boundary: 'Library output is a computed astronomical result. Its reproducibility does not validate a symbolic or predictive meaning.',
  },
  {
    id: 'iau-sofa-2023-10-11', authority: 'International Astronomical Union SOFA Board', title: 'Standards of Fundamental Astronomy',
    url: 'https://www.iausofa.org/current-software', version: '2023-10-11 release',
    establishes: 'Standard astronomical time-scale, precession, nutation, Earth-rotation, and coordinate-transformation algorithms.',
    boundary: 'A standard transformation still requires declared inputs, ephemeris data, frame, origin, corrections, and software release.',
  },
  {
    id: 'bphs-vimshottari-calculation-convention', authority: 'Bṛhat Parāśara Horā Śāstra tradition', title: 'Vimśottarī daśā calculation convention',
    url: 'https://vedic-astro.s3.amazonaws.com/books/bhrihat_parasara_hora_shastra.pdf', version: 'Calculation locator: chapters 46 and 51; passage review pending',
    establishes: 'The conventional nine-lord order, 120-year duration, natal balance concept, and proportional sub-period structure used by the implementation.',
    boundary: 'Translation provenance and excerpt rights have not passed Maha’s passage registry. The source is used as a calculation locator only; no passage or prediction is republished.',
  },
]

const PLANETS = [
  { slug: 'sun', name: 'Sun', cadence: 'roughly one tropical sign per month', note: 'Solar ingress is the longitude of the apparent geocentric Sun crossing a zodiac boundary; it is not the Sun physically entering a constellation.' },
  { slug: 'mercury', name: 'Mercury', cadence: 'several sign boundaries in a typical season', note: 'Mercury can cross the same boundary repeatedly during a retrograde loop, so direction and crossing number must be retained.' },
  { slug: 'venus', name: 'Venus', cadence: 'usually one sign in several weeks', note: 'Venus ingress cadence lengthens sharply around a retrograde loop and can include re-entry into a prior sign.' },
  { slug: 'mars', name: 'Mars', cadence: 'usually one sign in several weeks, with much longer stays near retrograde', note: 'Mars can remain in or revisit a sign for months around opposition, making a single mean-duration estimate inadequate.' },
  { slug: 'jupiter', name: 'Jupiter', cadence: 'approximately one sign per year', note: 'Jupiter commonly makes one or three crossings of a boundary depending on whether a retrograde loop straddles it.' },
  { slug: 'saturn', name: 'Saturn', cadence: 'approximately one sign in two to three years', note: 'Saturn’s slow apparent motion makes frame choice and repeated retrograde crossings especially visible in long-range timelines.' },
  { slug: 'uranus', name: 'Uranus', cadence: 'approximately one sign in seven years', note: 'Uranus is retained as a modern comparison point and is not silently inserted into classical Jyotiṣa rule packs.' },
  { slug: 'neptune', name: 'Neptune', cadence: 'approximately one sign in fourteen years', note: 'Neptune is a modern astronomical body outside the classical nine-graha Vimśottarī sequence and must remain separately labelled.' },
  { slug: 'pluto', name: 'Pluto', cadence: 'a highly variable interval of roughly twelve to thirty-one years per sign', note: 'Pluto’s eccentric orbit makes equal sign-duration assumptions particularly misleading.' },
  { slug: 'lunar-node', name: 'Lunar node', cadence: 'approximately one sign in eighteen to nineteen months for mean retrograde motion', note: 'A node ingress depends on mean-versus-true node choice; the node is a calculated orbital intersection, not a physical planet.' },
] as const

const STATION_PLANETS = PLANETS.filter((body) => !['sun', 'lunar-node'].includes(body.slug))

function ingressReference(body: typeof PLANETS[number]): TimingReference {
  return {
    slug: `${body.slug}-ingress-reference`, category: 'Ingresses', title: `${body.name} ingress calculation reference`,
    description: `How Maha defines and brackets each ${body.name} zodiac-boundary crossing in tropical and Lahiri-sidereal coordinates, including repeated crossings and uncertainty.`,
    definition: `A ${body.name} ingress is a root of the signed angular distance between its declared geocentric ecliptic longitude and a selected 30-degree zodiac boundary. ${body.note}`,
    calculation: `Sample ${body.name} longitude through the requested interval, unwrap longitude continuously, detect every change across the selected boundary, and refine each bracket to the declared time tolerance. Repeat the search independently in tropical and Lahiri-sidereal frames; retain crossing direction rather than collapsing retrograde re-entry into the first result.`,
    requiredInputs: ['UTC search interval', `${body.name} ephemeris state and observing origin`, 'Tropical or named sidereal frame', 'Boundary longitude and numerical tolerance'],
    mahaConvention: `Maha treats ${body.cadence} as orientation only, never as a search shortcut. Results retain UTC, frame, ayanāṁśa where applicable, direction, crossing sequence, ephemeris/software version, and the continuous longitude on both sides of the root.`,
    uncertainty: `An ingress near the edge of the search interval, an ephemeris disagreement, or an ayanāṁśa difference can move the reported crossing. Retrograde loops can add crossings rather than merely shifting one date, so the complete interval must be searched before counting events.`,
    reportUse: `Reports may state that ${body.name} crossed a declared boundary at a reproducible instant and show the corresponding tropical and sidereal labels separately. Any tradition-specific interpretation must cite a reviewed rule and cannot borrow authority from the numerical crossing.`,
    doesNotEstablish: `The crossing does not establish that a new life or business phase begins, that an event will occur, or that ${body.name} causes an outcome.`,
    sourceIds: ['jpl-horizons-4.98d', 'astronomy-engine-2.1.19', 'iau-sofa-2023-10-11'],
    relatedSlugs: [`${STATION_PLANETS.some((entry) => entry.slug === body.slug) ? `${body.slug}-station-reference` : 'new-moon-reference'}`, 'vimshottari-mahadasha-reference'],
    implementationStatus: 'method-reference',
  }
}

function stationReference(body: typeof STATION_PLANETS[number]): TimingReference {
  return {
    slug: `${body.slug}-station-reference`, category: 'Stations', title: `${body.name} direct and retrograde station reference`,
    description: `A reproducible definition of ${body.name} stations based on apparent geocentric ecliptic motion, with root finding, speed thresholds, and frame boundaries.`,
    definition: `A ${body.name} station is the instant at which the time derivative of its unwrapped apparent geocentric ecliptic longitude changes sign. “Stationary” names a coordinate extremum; the body does not stop moving through physical space.`,
    calculation: `Calculate ${body.name} longitude on a sufficiently fine time grid, unwrap the angular series, estimate longitudinal speed without crossing a 0/360-degree discontinuity, bracket each speed sign change, and refine the zero. Verify the before/after direction and retain the sampling and root tolerances.`,
    requiredInputs: ['UTC search interval', `${body.name} apparent geocentric longitude`, 'Ephemeris and correction profile', 'Sampling step and station root tolerance'],
    mahaConvention: `Maha records the primary station in apparent geocentric tropical ecliptic longitude as direct-to-retrograde or retrograde-to-direct. A sidereal derivative subtracts a time-varying ayanāṁśa and can shift the numerical zero slightly, so any sidereal station is labelled as a separate convention rather than a second physical stop.`,
    uncertainty: `Near zero speed, finite differencing, ephemeris precision, and a time-varying frame offset can create or shift a broad apparent plateau. The reported instant must include a tolerance or bracket; rounded daily positions cannot support minute-level station claims.`,
    reportUse: `Reports may show the station bracket, motion before and after it, and nearby ingress crossings. They may not convert “stationary” into strength, reversal, delay, or outcome language without a named, reviewed tradition rule.`,
    doesNotEstablish: `A ${body.name} station does not establish that plans reverse, decisions fail, communications change, or any future event becomes more or less likely.`,
    sourceIds: ['jpl-horizons-4.98d', 'astronomy-engine-2.1.19', 'iau-sofa-2023-10-11'],
    relatedSlugs: [`${body.slug}-ingress-reference`, 'full-moon-reference'], implementationStatus: 'method-reference',
  }
}

const LUNATIONS = [
  { slug: 'new-moon', name: 'New Moon', angle: '0°', distinction: 'conjunction in ecliptic longitude', note: 'A New Moon is not automatically a solar eclipse; eclipse geometry also requires suitable lunar latitude and observer alignment.' },
  { slug: 'first-quarter-moon', name: 'First Quarter Moon', angle: '90°', distinction: 'waxing quadrature', note: 'The quarter name describes phase progression, not one quarter of the Moon’s orbital distance from Earth.' },
  { slug: 'full-moon', name: 'Full Moon', angle: '180°', distinction: 'opposition in phase angle', note: 'A Full Moon is not automatically a lunar eclipse; most pass north or south of Earth’s shadow.' },
  { slug: 'last-quarter-moon', name: 'Last Quarter Moon', angle: '270°', distinction: 'waning quadrature', note: 'Some APIs represent this as −90°; normalization must not erase whether the Moon is waxing or waning.' },
  { slug: 'solar-eclipse', name: 'Solar eclipse', angle: 'near 0°', distinction: 'New Moon with node and observer-path geometry', note: 'Visibility and eclipse type depend on the observer and shadow path, not only the geocentric phase angle.' },
  { slug: 'lunar-eclipse', name: 'Lunar eclipse', angle: 'near 180°', distinction: 'Full Moon entering Earth’s penumbral or umbral shadow', note: 'Penumbral, partial, and total classifications require shadow geometry beyond the ordinary Full Moon root.' },
] as const

function lunationReference(event: typeof LUNATIONS[number]): TimingReference {
  const eclipse = event.slug.includes('eclipse')
  return {
    slug: `${event.slug}-reference`, category: 'Lunations', title: `${event.name} calculation reference`,
    description: `How Maha calculates the ${event.name} as ${event.distinction}, preserving UTC, phase direction, event type, location dependence, and uncertainty.`,
    definition: `The ${event.name} is defined by a Sun–Moon phase-angle condition centered on ${event.angle}. ${event.note}`,
    calculation: eclipse
      ? `Search for the supporting syzygy, compute the Moon’s relation to its orbital nodes and the relevant shadow or observer geometry, classify the event, and refine contact times. Preserve geocentric event time separately from local visibility and contact circumstances.`
      : `Search the continuous geocentric Sun–Moon phase angle for ${event.angle}, bracket the crossing, preserve waxing or waning direction, and refine the root to the declared tolerance. Retain the ephemeris, time scale, longitude convention, and software version.`,
    requiredInputs: ['UTC search interval', 'Geocentric Sun and Moon state', 'Phase-angle and root convention', ...(eclipse ? ['Observer or shadow geometry and eclipse classification method'] : ['Numerical tolerance and phase direction'])],
    mahaConvention: `Maha records the ${event.name} instant as celestial geometry before deriving tithi, zodiac position, local date, or a tradition label. Tropical and sidereal Moon labels may differ, while the underlying Sun–Moon phase event remains one astronomical event.`,
    uncertainty: `${eclipse ? 'Contact and visibility times' : 'The phase root'} can differ with ephemeris, correction model, timescale, and numerical tolerance. Local calendar date additionally depends on timezone; a date without UTC and zone provenance is not reproducible.`,
    reportUse: `Reports may show the exact ${event.name} root, local rendering, zodiac-frame labels, and separation from nearby chart points. Symbolic language requires a separately reviewed rule and must remain distinct from the phase calculation.`,
    doesNotEstablish: `The ${event.name} does not establish a beginning, culmination, crisis, release, or event outcome, and it is not evidence that a chart predicts reality.`,
    sourceIds: ['astronomy-engine-2.1.19', 'jpl-horizons-4.98d', 'iau-sofa-2023-10-11'],
    relatedSlugs: event.slug.includes('moon') ? ['solar-eclipse-reference', 'lunar-eclipse-reference'] : ['new-moon-reference', 'full-moon-reference'],
    implementationStatus: 'method-reference',
  }
}

function dashaLordReference(lord: VimshottariLord): TimingReference {
  const years = VIMSHOTTARI_YEARS[lord]
  return {
    slug: `vimshottari-${lord.toLowerCase()}-dasha-reference`, category: 'Vimśottarī daśā', title: `${lord} period in the Vimśottarī chronology`,
    description: `The calculation role of ${lord} in the nine-lord Vimśottarī sequence, including its ${years}-year nominal mahādaśā duration and proportional sub-period timing.`,
    definition: `${lord} is one member of the fixed Vimśottarī order Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, and Mercury. Its nominal mahādaśā allocation is ${years} years within the conventional 120-year cycle.`,
    calculation: `Locate ${lord} in the fixed sequence. For a ${lord} mahādaśā, convert ${years} nominal years using the declared year-length convention. For a ${lord} antardaśā inside any parent period, multiply the parent duration by ${years}/120 and preserve the parent lord, timestamps, and rounding policy.`,
    requiredInputs: ['Natal Moon Lahiri-sidereal nakṣatra and elapsed fraction', 'Fixed nine-lord sequence', `${lord} duration weight of ${years}/120`, 'Declared year length and timestamp rounding'],
    mahaConvention: `Maha uses 365.2425 days per nominal year, computes the birth balance from the Moon’s solved ingress-to-egress time fraction, and stores UTC boundaries. The ${lord} label identifies a position in that chronology, not a generated interpretation.`,
    uncertainty: `Birth-time uncertainty, ayanāṁśa choice, Moon ephemeris, nakṣatra-boundary proximity, year length, and rounding can alter period boundaries. A natal Moon near a nakṣatra edge can also change the starting lord entirely.`,
    reportUse: `A report may state when the calculated ${lord} period starts and ends, its level, parent period, nominal duration, and method. Interpretive statements require source-bound daśā rules and practitioner review; none are inferred from the lord name here.`,
    doesNotEstablish: `A ${lord} period does not establish that a particular event, personality state, financial result, relationship change, or business outcome will occur.`,
    sourceIds: ['bphs-vimshottari-calculation-convention', 'astronomy-engine-2.1.19'],
    relatedSlugs: ['vimshottari-mahadasha-reference', 'vimshottari-antardasha-reference', 'vimshottari-birth-balance-reference'],
    implementationStatus: 'production-derived',
  }
}

const DASHA_METHODS: TimingReference[] = [
  {
    slug: 'vimshottari-birth-balance-reference', category: 'Vimśottarī daśā', title: 'Vimśottarī birth balance calculation',
    description: 'How the natal Moon’s elapsed nakṣatra fraction selects the opening lord and determines the unexpired portion of the first Vimśottarī period.',
    definition: 'The birth balance is the unexpired fraction of the mahādaśā ruled by the natal Moon’s nakṣatra. It anchors the entire reported 120-year chronology to the birth instant.',
    calculation: 'Convert the natal Moon to Lahiri-sidereal longitude, identify its nakṣatra and ruler, solve the Moon’s actual ingress and egress times for that nakṣatra, divide elapsed stay time by total stay time, and apply the unelapsed fraction to the ruler’s nominal duration.',
    requiredInputs: ['Birth UTC instant', 'Natal Moon ephemeris', 'Lahiri ayanāṁśa implementation', 'Nakṣatra ruler sequence', 'Declared year length'],
    mahaConvention: 'Maha uses actual solved nakṣatra stay time rather than assuming the Moon moves at constant angular speed. The result retains ingress, egress, elapsed fraction, starting lord, balance in years, UTC boundaries, and software version.',
    uncertainty: 'Moon or birth-time uncertainty near a nakṣatra boundary can change the starting lord. Elsewhere it shifts the opening balance continuously; reports should propagate the plausible time interval rather than print unsupported precision.',
    reportUse: 'The birth report exposes the starting lord, balance, and solved nakṣatra timestamps so the subsequent chronology can be reproduced independently.',
    doesNotEstablish: 'A precise opening balance does not establish that the daśā system predicts events or that its conventional lords cause life outcomes.',
    sourceIds: ['bphs-vimshottari-calculation-convention', 'astronomy-engine-2.1.19'], relatedSlugs: ['vimshottari-mahadasha-reference', 'vimshottari-antardasha-reference'], implementationStatus: 'production-derived',
  },
  {
    slug: 'vimshottari-mahadasha-reference', category: 'Vimśottarī daśā', title: 'Vimśottarī mahādaśā sequence reference',
    description: 'The nine major-period order, nominal durations, 120-year cycle, and timestamp conventions used to construct a complete Vimśottarī timeline.',
    definition: 'A mahādaśā is a major interval in the fixed nine-lord Vimśottarī cycle. The conventional allocations total 120 nominal years before the sequence repeats.',
    calculation: 'Start from the birth-balance anchor, advance through Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, and Mercury cyclically, and add each lord’s declared nominal duration using one frozen year-length convention.',
    requiredInputs: ['Birth-balance anchor', 'Starting lord', 'Nine-lord order and durations', 'Nominal year length', 'UTC serialization policy'],
    mahaConvention: 'Maha uses 365.2425 days per nominal year and half-open UTC intervals: a period is active at its start and inactive at its end. The final boundary of one period is exactly the first boundary of the next.',
    uncertainty: 'Different year lengths, balance methods, ayanāṁśas, or timestamp rounding policies accumulate disagreement across decades. Comparing software requires isolating these choices rather than comparing only the displayed lord.',
    reportUse: 'Reports may show the complete major-period chronology and active interval. They do not assign a generic meaning to a major period without a reviewed, source-bound interpretation rule.',
    doesNotEstablish: 'The mahādaśā sequence does not establish a causal timeline or demonstrate predictive skill merely because its dates are deterministic.',
    sourceIds: ['bphs-vimshottari-calculation-convention'], relatedSlugs: ['vimshottari-birth-balance-reference', 'vimshottari-antardasha-reference'], implementationStatus: 'production-derived',
  },
  {
    slug: 'vimshottari-antardasha-reference', category: 'Vimśottarī daśā', title: 'Vimśottarī antardaśā proportional timing reference',
    description: 'How Maha subdivides each major period into nine proportional sub-periods while preserving parent lord, sequence, boundaries, and rounding.',
    definition: 'An antardaśā is a nested sub-period whose duration is the parent mahādaśā duration multiplied by the sub-lord’s nominal years divided by 120.',
    calculation: 'Begin with the mahādaśā lord, follow the same cyclic nine-lord order, allocate parentDuration × subLordYears / 120 to each interval, and force the final sub-period end to equal the parent end so rounding cannot create a gap or overlap.',
    requiredInputs: ['Parent mahādaśā start and end', 'Parent lord', 'Nine-lord sequence and duration weights', 'Timestamp rounding policy'],
    mahaConvention: 'Maha stores parent and sub-lord explicitly, starts the sub-period order with the parent lord, uses half-open UTC intervals, and makes the last antardaśā boundary exactly equal the containing mahādaśā boundary.',
    uncertainty: 'Sub-period boundaries inherit every uncertainty in the natal anchor and parent period. Repeated floating-point rounding can create drift unless calculations use one duration basis and reconcile the final boundary.',
    reportUse: 'Reports may identify the active major/sub-period pair and next transition. Narrative interpretation is compiled only from applicable reviewed rules, not generated from the two lord names.',
    doesNotEstablish: 'A nested period pair does not establish a more precise forecast; additional labels can increase apparent specificity without adding empirical evidence.',
    sourceIds: ['bphs-vimshottari-calculation-convention'], relatedSlugs: ['vimshottari-mahadasha-reference', 'vimshottari-birth-balance-reference'], implementationStatus: 'production-derived',
  },
]

export const TIMING_REFERENCES: readonly TimingReference[] = [
  ...PLANETS.map(ingressReference),
  ...STATION_PLANETS.map(stationReference),
  ...LUNATIONS.map(lunationReference),
  ...DASHA_METHODS,
  ...VIMSHOTTARI_LORDS.map(dashaLordReference),
]

const bySlug = new Map(TIMING_REFERENCES.map((entry) => [entry.slug, entry]))
const sourceById = new Map(TIMING_REFERENCE_SOURCES.map((source) => [source.id, source]))

export function timingReferencePath(entry: TimingReference): string { return `${TIMING_REFERENCE_PATH}/${entry.slug}` }
export function getTimingReference(slug: string): TimingReference | undefined { return bySlug.get(slug) }
export function getTimingReferenceSource(id: string): TimingReferenceSource | undefined { return sourceById.get(id) }
export function getTimingReferencesByCategory(category: TimingReferenceCategory): TimingReference[] { return TIMING_REFERENCES.filter((entry) => entry.category === category) }
