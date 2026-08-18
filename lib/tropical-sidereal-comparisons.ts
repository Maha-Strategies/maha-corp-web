export const TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE = '2026-08-18' as const
export const TROPICAL_SIDEREAL_COMPARISON_PATH = '/knowledge/astrology/tropical-vs-sidereal/comparisons' as const

export const TROPICAL_SIDEREAL_COMPARISON_CATEGORIES = [
  'Coordinates and geometry',
  'Timing chronology',
  'Technique eligibility',
  'Interpretation and evaluation',
] as const

export type TropicalSiderealComparisonCategory = typeof TROPICAL_SIDEREAL_COMPARISON_CATEGORIES[number]

export interface TropicalSiderealComparisonSource {
  id: string
  authority: string
  title: string
  url: string
  establishes: string
  boundary: string
}

export interface TropicalSiderealComparison {
  slug: string
  category: TropicalSiderealComparisonCategory
  title: string
  description: string
  sharedInputs: readonly string[]
  sharedFacts: string
  tropicalView: string
  siderealView: string
  agreement: string
  disagreement: string
  preservationPolicy: string
  prohibitedSynthesis: string
  evaluationRequirement: string
  sourceIds: readonly string[]
  relatedSlugs: readonly string[]
  empiricalStatus: 'parallel-unvalidated-models'
}

export const TROPICAL_SIDEREAL_COMPARISON_SOURCES: readonly TropicalSiderealComparisonSource[] = [
  {
    id: 'maha-celestial-facts', authority: 'Maha Celestial', title: 'Celestial fact-layer specification',
    url: 'https://www.mahastrategies.com/knowledge/celestial',
    establishes: 'The shared instant, observer, ephemeris, reference-frame, precision, software, and provenance fields from which both chart frames are derived.',
    boundary: 'Reproducible celestial geometry does not validate an astrological interpretation.',
  },
  {
    id: 'maha-lahiri-method', authority: 'Maha Celestial', title: 'Lahiri ayanāṁśa calculations',
    url: 'https://www.mahastrategies.com/knowledge/astrology/lahiri-ayanamsa',
    establishes: 'Maha’s declared transformation from retained tropical longitude to a separate Lahiri-sidereal longitude.',
    boundary: 'Selecting Lahiri defines one sidereal convention; it does not establish that sidereal astrology is superior or empirically valid.',
  },
  {
    id: 'maha-frame-guide', authority: 'Maha Celestial', title: 'Tropical versus sidereal astrology',
    url: 'https://www.mahastrategies.com/knowledge/astrology/tropical-vs-sidereal',
    establishes: 'The policy that tropical and sidereal charts remain parallel declared models with separate feature and rule namespaces.',
    boundary: 'The guide is a methodology declaration, not an adjudication between traditions.',
  },
  {
    id: 'maha-timing-library', authority: 'Maha Celestial', title: 'Celestial timing reference library',
    url: 'https://www.mahastrategies.com/knowledge/astrology/timing',
    establishes: 'Frame-explicit ingress, station, lunation, repeated-crossing, and Vimśottarī chronology conventions.',
    boundary: 'A deterministic event date is not evidence that the event predicts a real-world outcome.',
  },
  {
    id: 'maha-tradition-registry', authority: 'Maha Celestial', title: 'Astrology tradition registry',
    url: 'https://www.mahastrategies.com/knowledge/astrology',
    establishes: 'Named, versioned rule namespaces and the separation between source provenance and empirical support.',
    boundary: 'A well-sourced traditional rule remains an unvalidated interpretive claim unless separately tested.',
  },
  {
    id: 'maha-corporate-method', authority: 'Maha Celestial', title: 'Corporate and mundane methodology library',
    url: 'https://www.mahastrategies.com/knowledge/astrology/corporate-mundane',
    establishes: 'Evidence-bound organization events, uncertainty handling, frame comparison, preregistration, and outcome refusals.',
    boundary: 'Corporate chart methodology cannot establish valuation, revenue, survival, investment return, or guaranteed outcomes.',
  },
]

const EMPIRICAL_REQUIREMENT = 'Treat tropical and sidereal outputs as separate candidate models. Any performance claim requires preregistered features, outcomes, horizons, baselines, model-selection policy, multiplicity control, and prospective scoring that retains misses and abstentions.'

function comparison(entry: Omit<TropicalSiderealComparison, 'empiricalStatus'>): TropicalSiderealComparison {
  return { ...entry, empiricalStatus: 'parallel-unvalidated-models' }
}

export const TROPICAL_SIDEREAL_COMPARISONS: readonly TropicalSiderealComparison[] = [
  comparison({
    slug: 'zodiac-zero-points', category: 'Coordinates and geometry', title: 'Zodiac zero points: equinox and Lahiri reference',
    description: 'The foundational comparison between an equinox-anchored tropical longitude and a Lahiri-sidereal longitude derived from the same celestial state.',
    sharedInputs: ['One UTC instant', 'One ephemeris state', 'One ecliptic reference frame', 'One numerical precision policy', 'Named Lahiri ayanāṁśa and version'],
    sharedFacts: 'The body, instant, observer assumptions, and underlying ecliptic direction are unchanged. The comparison begins from one retained tropical longitude rather than calculating two unrelated skies.',
    tropicalView: 'Longitude is measured from the true equinox of date. Zero Aries follows the equinoctial origin, so seasonal sign labels remain tied to that moving reference.',
    siderealView: 'The declared Lahiri offset is subtracted and the result normalized to 0–360 degrees. Zero Aries follows that named sidereal convention, not every possible stellar zodiac.',
    agreement: 'Both views describe the same time-indexed celestial direction and preserve the same body identity, motion state, and ephemeris provenance.',
    disagreement: 'They assign different longitude numbers, sign labels, and degrees within sign because their zero points differ. Neither label can be silently substituted for the other.',
    preservationPolicy: 'Store the tropical longitude, named ayanāṁśa, numerical offset, and resulting sidereal longitude as separate fields in one provenance bundle.',
    prohibitedSynthesis: 'Do not average the longitudes, call Lahiri “the sidereal zodiac,” or select a zero point after reading an interpretation or outcome.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-celestial-facts', 'maha-lahiri-method', 'maha-frame-guide'], relatedSlugs: ['longitude-and-sign-labels', 'ascendant-and-whole-sign-houses'],
  }),
  comparison({
    slug: 'longitude-and-sign-labels', category: 'Coordinates and geometry', title: 'One celestial direction, two sign labels',
    description: 'Why a planet can receive different sign and degree labels while its physical direction, distance, speed, and observation time remain unchanged.',
    sharedInputs: ['Frozen fact-bundle digest', 'Tropical ecliptic longitude', 'Longitude speed', 'Lahiri offset', 'Boundary-distance tolerance'],
    sharedFacts: 'Physical state vectors, apparent direction, direct or retrograde motion, and angular relationships remain facts about the same calculated moment.',
    tropicalView: 'The tropical sign is floor(normalized tropical longitude ÷ 30), with degree within sign measured from the corresponding equinoctial boundary.',
    siderealView: 'The sidereal sign applies the same segmentation only after the named ayanāṁśa transformation, so a body may move to the preceding sign label.',
    agreement: 'The two records can agree on a sign when the transformed longitude remains inside the same named 30-degree segment, but that agreement is contingent rather than required.',
    disagreement: 'A sign disagreement is a coordinate-label disagreement. It propagates into sign-conditioned rules, dignity, rulers, and sign-based houses without changing the underlying body.',
    preservationPolicy: 'Expose both normalized longitudes and labels with explicit namespaces such as tropical.sign and lahiriSidereal.sign; retain boundary sensitivity for each.',
    prohibitedSynthesis: 'Do not describe a planet as simultaneously occupying an unlabeled hybrid sign or choose whichever sign yields the more compelling narrative.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-celestial-facts', 'maha-lahiri-method'], relatedSlugs: ['zodiac-zero-points', 'dignity-rulership-and-house-lords'],
  }),
  comparison({
    slug: 'ascendant-and-whole-sign-houses', category: 'Coordinates and geometry', title: 'Ascendant labels and whole-sign house geometry',
    description: 'How one horizon intersection can yield different ascendant signs and therefore different whole-sign house assignments under parallel zodiac frames.',
    sharedInputs: ['Resolved UTC instant', 'WGS 84 observer coordinates', 'Earth-rotation and obliquity method', 'Tropical ascendant longitude', 'Lahiri offset'],
    sharedFacts: 'The eastern intersection of the ecliptic and local horizon is one geometric direction for the declared instant, observer, and Earth-orientation convention.',
    tropicalView: 'The intersection receives a tropical sign label. Tropical whole-sign houses, if requested, count signs from that tropical ascendant sign.',
    siderealView: 'The same tropical ascendant longitude is transformed by Lahiri. Jyotiṣa whole-sign houses count from the resulting sidereal ascendant sign.',
    agreement: 'Both views use the same observer and horizon geometry. They may agree on house numbers when the ascendant and target placement shift together, but this must be calculated rather than assumed.',
    disagreement: 'Ascendant sign, first-house boundary, house lords, and planet house assignments can differ. Different quadrant-house conventions introduce an additional disagreement not caused by zodiac frame alone.',
    preservationPolicy: 'Record ascendant longitude before and after conversion, house-system identifier, and every house assignment inside the frame-specific namespace.',
    prohibitedSynthesis: 'Do not combine a tropical ascendant with sidereal planetary signs or borrow house rulers across frames unless an explicitly named tradition rule requires that combination.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-celestial-facts', 'maha-lahiri-method', 'maha-tradition-registry'], relatedSlugs: ['zodiac-zero-points', 'dignity-rulership-and-house-lords'],
  }),
  comparison({
    slug: 'planetary-ingress-dates', category: 'Timing chronology', title: 'Planetary ingress dates in tropical and sidereal frames',
    description: 'Why the same planet crosses tropical and Lahiri-sidereal sign boundaries on different dates and why neither timestamp may replace the other.',
    sharedInputs: ['Planetary longitude function', 'Search interval', 'Ephemeris and time scale', 'Frame-specific boundary', 'Root-finding tolerance'],
    sharedFacts: 'The planet follows one calculated trajectory. An ingress is a solved crossing of that trajectory against a boundary defined by the selected zodiac frame.',
    tropicalView: 'The root occurs when tropical longitude crosses a multiple of 30 degrees measured from the equinox-defined origin, with direction and solver tolerance retained.',
    siderealView: 'The root occurs when the Lahiri-transformed longitude crosses its corresponding 30-degree boundary, generally at a different instant.',
    agreement: 'Direction of motion and the ordered physical trajectory are shared. Both calculations should reproduce from the same ephemeris and declared tolerance.',
    disagreement: 'The dates and sign names differ because the boundaries differ. The time gap is not a calculation error and should not be compressed into one approximate “ingress season.”',
    preservationPolicy: 'Persist each crossing with frame, boundary, direction, UTC instant, solver bracket, tolerance, and calculation version.',
    prohibitedSynthesis: 'Do not average ingress dates, use the tropical date with a sidereal sign name, or select the crossing nearest a known milestone after the fact.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-timing-library', 'maha-lahiri-method'], relatedSlugs: ['retrograde-repeated-crossings', 'transit-windows-and-natal-contacts'],
  }),
  comparison({
    slug: 'retrograde-repeated-crossings', category: 'Timing chronology', title: 'Retrograde motion and repeated boundary crossings',
    description: 'A frame-preserving chronology for direct ingress, retrograde re-entry, and final direct ingress without cherry-picking one crossing.',
    sharedInputs: ['Full search interval', 'Longitude and speed function', 'Tropical and Lahiri boundaries', 'Crossing direction', 'Station chronology'],
    sharedFacts: 'Stations and reversals describe the same planetary motion in both zodiac frames, although a station can fall inside differently named signs.',
    tropicalView: 'Every crossing of the tropical boundary is retained in chronological order with direct or retrograde direction, including the solver bracket and station context.',
    siderealView: 'Every crossing of the Lahiri-sidereal boundary is retained independently; its sequence can occur weeks or months away from the tropical sequence.',
    agreement: 'Both models agree that deleting retrograde crossings distorts the trajectory and that all roots inside the declared interval belong in the event record.',
    disagreement: 'The two frames disagree on which boundary is being crossed and when. They may also produce different counts inside a short reporting window.',
    preservationPolicy: 'Publish two complete crossing arrays and connect them only through the shared body and ephemeris, not through nearest-date matching.',
    prohibitedSynthesis: 'Do not call the first, final, or closest crossing uniquely operative unless that selection policy was declared before the target outcome.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-timing-library', 'maha-frame-guide'], relatedSlugs: ['planetary-ingress-dates', 'transit-windows-and-natal-contacts'],
  }),
  comparison({
    slug: 'transit-windows-and-natal-contacts', category: 'Timing chronology', title: 'Transit windows and natal or event-chart contacts',
    description: 'How transit-to-chart contacts remain coherent when each model uses its own frame, natal features, orb policy, and exact-hit chronology.',
    sharedInputs: ['Frozen natal or event instant', 'Transit search interval', 'Ephemeris version', 'Aspect and orb policy', 'Frame-specific natal features'],
    sharedFacts: 'Pure angular separation between two ecliptic longitudes is invariant when the same offset is applied to both; the underlying pair of bodies and motion remain the same.',
    tropicalView: 'Transits are matched to tropical natal longitudes and tropical sign or house conditions under a tropical rule namespace.',
    siderealView: 'Transits are matched to Lahiri-sidereal natal longitudes and Jyotiṣa sign, house, nakṣatra, or lordship conditions under a sidereal namespace.',
    agreement: 'Degree-based conjunctions and angular aspects can occur at the same instants when both endpoints are transformed consistently, subject to identical apparent-position choices.',
    disagreement: 'Sign labels, house applications, dispositors, nakṣatras, and eligible interpretation rules can disagree even when an exact angular contact is shared.',
    preservationPolicy: 'Keep shared angular hits separate from frame-conditioned labels and rule matches; each narrative paragraph must cite the feature namespace it consumed.',
    prohibitedSynthesis: 'Do not calculate the transit in one frame and compare it with a natal point from the other, or count one shared angular hit as independent confirmation by two systems.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-timing-library', 'maha-tradition-registry', 'maha-frame-guide'], relatedSlugs: ['planetary-ingress-dates', 'angular-aspects-and-sign-aspects'],
  }),
  comparison({
    slug: 'angular-aspects-and-sign-aspects', category: 'Technique eligibility', title: 'Angular aspects versus sign-based aspects',
    description: 'A comparison that separates invariant degree geometry from sign-conditioned aspect doctrines that can change with the zodiac frame.',
    sharedInputs: ['Two retained tropical longitudes', 'Lahiri offset', 'Angular separation method', 'Aspect set and orb', 'Named sign-aspect doctrine'],
    sharedFacts: 'Subtracting the same ayanāṁśa from both points preserves their angular separation. A 180-degree opposition remains 180 degrees in either consistently transformed frame.',
    tropicalView: 'A tropical rule pack may use degree aspects, sign relationships, or both, based on tropical sign labels and its declared orb policy.',
    siderealView: 'A Jyotiṣa rule pack may use graha dṛṣṭi, rāśi relationships, degree contacts, or another declared doctrine based on sidereal placements.',
    agreement: 'Frame conversion alone does not change pairwise angular distance. Exact degree-aspect timing is therefore shared when calculation conventions are otherwise identical.',
    disagreement: 'Sign-based relationships and technique eligibility can change. Graha dṛṣṭi and western aspect doctrine are also different rule systems, not alternate labels for one calculation.',
    preservationPolicy: 'Store angular geometry once, then record each doctrine’s rule match separately with tradition, frame, aspect type, orb, and source passage.',
    prohibitedSynthesis: 'Do not count the same angular separation twice as corroboration or translate one tradition’s aspect doctrine into another without an explicit sourced rule.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-celestial-facts', 'maha-tradition-registry'], relatedSlugs: ['transit-windows-and-natal-contacts', 'dignity-rulership-and-house-lords'],
  }),
  comparison({
    slug: 'nakshatra-and-lunar-mansion-eligibility', category: 'Technique eligibility', title: 'Nakṣatra and lunar-mansion eligibility',
    description: 'Why Maha treats Lahiri nakṣatra placement as a sidereal technique input rather than retrofitting it onto an unlabeled tropical Moon.',
    sharedInputs: ['Moon tropical longitude', 'Named ayanāṁśa', 'Sidereal Moon longitude', '27-fold mansion segmentation', 'Boundary-distance tolerance'],
    sharedFacts: 'The Moon’s instant, apparent longitude, speed, and angular separation from the Sun are shared celestial facts before mansion labels are applied.',
    tropicalView: 'A tropical chart can retain Moon longitude and phase without automatically receiving a Jyotiṣa nakṣatra interpretation. Tropical lunar-mansion methods require their own named convention.',
    siderealView: 'The Lahiri-sidereal Moon is segmented into 27 equal nakṣatras and padas under the declared Jyotiṣa calculation contract.',
    agreement: 'Both views can consume the same Moon observation and numerical precision. Neither gains additional astronomical evidence from a traditional mansion name.',
    disagreement: 'Technique eligibility differs: a Jyotiṣa nakṣatra rule consumes the sidereal Moon, while an unrelated tropical rule cannot claim the same placement without declaring a separate system.',
    preservationPolicy: 'Keep phase geometry in the fact layer and store nakṣatra, pada, ruler, boundary distance, and rule matches only in the declared sidereal technique namespace.',
    prohibitedSynthesis: 'Do not combine a tropical Moon sign with a Lahiri nakṣatra as if the pair came from one unnamed classical system, unless a registered synthesis explicitly says so.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-lahiri-method', 'maha-tradition-registry'], relatedSlugs: ['vimshottari-dasha-eligibility', 'longitude-and-sign-labels'],
  }),
  comparison({
    slug: 'vimshottari-dasha-eligibility', category: 'Technique eligibility', title: 'Vimśottarī daśā eligibility and opening balance',
    description: 'Why the implemented Vimśottarī chronology belongs to a declared Lahiri-Jyotiṣa model and is not blended into tropical timing output.',
    sharedInputs: ['Birth or event instant', 'Moon tropical longitude', 'Lahiri ayanāṁśa', 'Nakṣatra position', 'Daśā year-length convention'],
    sharedFacts: 'The input instant and Moon ephemeris state are shared. The 120-year sequence is a traditional timing convention rather than an astronomical cycle discovered from the ephemeris.',
    tropicalView: 'The tropical model does not receive a Vimśottarī period merely because it has a Moon longitude. A tropical timing method must be declared and calculated under its own rules.',
    siderealView: 'The Lahiri Moon identifies the janma nakṣatra and elapsed fraction, which determine the opening mahādaśā and remaining balance under the versioned Jyotiṣa method.',
    agreement: 'Both models retain the same underlying Moon and birth-time provenance, including uncertainty that may affect a boundary-sensitive result.',
    disagreement: 'They disagree on technique eligibility, not merely labels. Only the declared sidereal model produces this daśā timeline in the current system.',
    preservationPolicy: 'Namespace Vimśottarī features as Jyotiṣa/Lahiri, retain the Moon conversion and balance arithmetic, and mark any tropical model’s corresponding field not applicable.',
    prohibitedSynthesis: 'Do not use tropical sign interpretations to explain a sidereal daśā result or present the absence of a tropical Vimśottarī output as evidence against tropical astrology.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-timing-library', 'maha-lahiri-method', 'maha-tradition-registry'], relatedSlugs: ['nakshatra-and-lunar-mansion-eligibility', 'transit-windows-and-natal-contacts'],
  }),
  comparison({
    slug: 'dignity-rulership-and-house-lords', category: 'Interpretation and evaluation', title: 'Dignity, rulership, and house-lord disagreements',
    description: 'How changed sign labels and tradition-specific rulership schemes propagate into dignity, dispositors, house lords, and eligible interpretation rules.',
    sharedInputs: ['Frame-specific sign placements', 'Frame-specific ascendant', 'Named rulership table', 'Dignity doctrine', 'Tradition-scoped rule pack'],
    sharedFacts: 'The celestial bodies and their geometric directions are unchanged; dignity and rulership are symbolic classifications supplied by a named tradition.',
    tropicalView: 'A tropical tradition applies its sign labels, rulership scheme, dignity conditions, and house system without borrowing Jyotiṣa lordship logic by default.',
    siderealView: 'A Jyotiṣa model applies Lahiri rāśis, whole-sign houses, graha rulership, and source-bound lordship rules inside the sidereal namespace.',
    agreement: 'The two models may assign the same ruler or dignity in some charts, but accidental agreement does not merge the underlying rule systems.',
    disagreement: 'A planet can change sign, dignity, dispositor, house lordship, and interpretive eligibility. The disagreement is preserved at every derived step rather than only at the final paragraph.',
    preservationPolicy: 'Emit a derivation chain from frame-specific sign to ruler table to dignity or lordship to rule ID, with tradition and source attached to every rule.',
    prohibitedSynthesis: 'Do not choose the stronger dignity, combine two rulers into an unlabeled result, or treat agreement as independent empirical confirmation.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-tradition-registry', 'maha-frame-guide'], relatedSlugs: ['longitude-and-sign-labels', 'ascendant-and-whole-sign-houses'],
  }),
  comparison({
    slug: 'corporate-event-chart-comparison', category: 'Interpretation and evaluation', title: 'Parallel frames for one corporate event',
    description: 'An evidence-bound corporate comparison that freezes one organization event before deriving separate tropical and Lahiri-sidereal chart views.',
    sharedInputs: ['One evidenced organization event', 'Event-time confidence interval', 'One observer-location policy', 'Fact-bundle digest', 'Two versioned model profiles'],
    sharedFacts: 'Event type, evidence, jurisdiction, selected location, time confidence, UTC resolution, ephemeris, and uncertainty interval remain identical across the comparison.',
    tropicalView: 'The tropical model derives signs, houses, transits, and organization interpretations only from its registered frame and rule profile.',
    siderealView: 'The Lahiri-Jyotiṣa model derives rāśis, whole-sign houses, nakṣatras, daśās, transits, and organization rules only where its profile permits them.',
    agreement: 'Both models are accountable to the same event evidence and outcome record. Neither may improve its inputs after seeing business performance.',
    disagreement: 'They can disagree on signs, houses, lords, applicable techniques, timing windows, verdict, or abstention. The report exposes each disagreement rather than writing one confident corporate story.',
    preservationPolicy: 'Persist one fact bundle and two immutable derived bundles, then show agreement, disagreement, and unavailable comparisons as separate fields.',
    prohibitedSynthesis: 'Do not select the frame whose narrative best matches known company history or infer valuation, revenue, investment return, survival, or guaranteed growth.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-corporate-method', 'maha-frame-guide', 'maha-tradition-registry'], relatedSlugs: ['prospective-model-scoring', 'transit-windows-and-natal-contacts'],
  }),
  comparison({
    slug: 'prospective-model-scoring', category: 'Interpretation and evaluation', title: 'Prospective scoring without post-hoc frame selection',
    description: 'The empirical protocol required to compare tropical, Lahiri-sidereal, combined, and ordinary baselines without letting outcomes choose the winning system.',
    sharedInputs: ['Locked target and outcome horizon', 'Frozen tropical model', 'Frozen sidereal model', 'Ordinary or random baseline', 'Analysis and multiplicity policy'],
    sharedFacts: 'Every model receives the same eligible tasks, outcome definitions, information cutoff, scoring rule, blinded evaluation schedule, and prospectively fixed stopping point.',
    tropicalView: 'Tropical predictions are issued and persisted under a fixed model version before the outcome becomes available, including abstentions and confidence where allowed.',
    siderealView: 'Sidereal predictions follow the identical submission contract while retaining their own feature namespace, rules, training history, and abstentions.',
    agreement: 'When both models issue the same verdict, it is recorded as agreement but remains one paired task outcome—not two independent observations.',
    disagreement: 'Opposed verdicts, differing confidence, and one-model abstention remain explicit. The system does not resolve them narratively after the result.',
    preservationPolicy: 'Score each model separately, report paired differences against the same baseline, and evaluate any ensemble only if its weights and conflict policy were frozen in advance.',
    prohibitedSynthesis: 'Do not report the better retrospective score as the prospective policy, drop discordant tasks, tune weights on the test set, or call agreement proof of truth.',
    evaluationRequirement: EMPIRICAL_REQUIREMENT, sourceIds: ['maha-frame-guide', 'maha-corporate-method'], relatedSlugs: ['corporate-event-chart-comparison', 'planetary-ingress-dates'],
  }),
]

const comparisonBySlug = new Map(TROPICAL_SIDEREAL_COMPARISONS.map((entry) => [entry.slug, entry]))
const sourceById = new Map(TROPICAL_SIDEREAL_COMPARISON_SOURCES.map((source) => [source.id, source]))

export function tropicalSiderealComparisonPath(entry: TropicalSiderealComparison): string { return `${TROPICAL_SIDEREAL_COMPARISON_PATH}/${entry.slug}` }
export function getTropicalSiderealComparison(slug: string): TropicalSiderealComparison | undefined { return comparisonBySlug.get(slug) }
export function getTropicalSiderealComparisonSource(id: string): TropicalSiderealComparisonSource | undefined { return sourceById.get(id) }
export function getTropicalSiderealComparisonsByCategory(category: TropicalSiderealComparisonCategory): TropicalSiderealComparison[] { return TROPICAL_SIDEREAL_COMPARISONS.filter((entry) => entry.category === category) }
