import cohort from '../content/astrology/answer-graph/cohort-v1.json' with { type: 'json' }

import { ASTROLOGY_PATH, ASTROLOGY_TRADITIONS, astrologyTraditionPath, getAstrologyTradition, getRulesForTradition } from './astrology-traditions.ts'
import { CALCULATION_REFERENCES, calculationReferencePath, getCalculationReference } from './celestial-calculation-references.ts'
import { CELESTIAL_GUIDE_LIST } from './celestial-guides.ts'
import { TIMING_REFERENCES, getTimingReference, timingReferencePath } from './celestial-timing-references.ts'
import { CORPORATE_MUNDANE_REFERENCES, corporateMundaneReferencePath, getCorporateMundaneReference } from './corporate-mundane-references.ts'
import { provenanceDigest } from './evidence-dossier/digest.ts'
import { TROPICAL_SIDEREAL_COMPARISONS, getTropicalSiderealComparison, tropicalSiderealComparisonPath } from './tropical-sidereal-comparisons.ts'

export const ASTROLOGY_ANSWER_GRAPH_VERSION = 'astrology-answer-graph/1.0' as const
export const ASTROLOGY_ANSWER_GRAPH_DATE = '2026-09-04' as const
export const ASTROLOGY_ANSWER_GRAPH_PATH = `${ASTROLOGY_PATH}/questions` as const
export const ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH = `${ASTROLOGY_ANSWER_GRAPH_PATH}/registry` as const

export const ASTROLOGY_ANSWER_CATEGORIES = [
  'Calculation foundations',
  'Coordinate frames',
  'Timing methods',
  'Traditions and evaluation',
  'Organization-event methods',
] as const

export type AstrologyAnswerCategory = typeof ASTROLOGY_ANSWER_CATEGORIES[number]
export type AstrologyAnswerFrame = 'calculation-method' | 'frame-comparison' | 'timing-method' | 'tradition-description' | 'evaluation-method' | 'organization-method'
export type AstrologyAuthorityFamily = 'calculation' | 'timing' | 'comparison' | 'corporate' | 'tradition' | 'guide'

export interface AstrologyAuthorityReference {
  id: string
  family: AstrologyAuthorityFamily
  title: string
  path: string
  establishes: string
  boundary: string
  status: string
}

interface AstrologyAnswerDraft {
  slug: string
  category: AstrologyAnswerCategory
  frame: AstrologyAnswerFrame
  question: string
  shortTitle: string
  directAnswer: string
  practicalUse: string
  authorityIds: readonly string[]
  distinctions: readonly string[]
  limitations: readonly string[]
  queryVariants: readonly [string, string, string, string]
}

export interface AstrologyAnswer extends AstrologyAnswerDraft {
  relatedSlugs: readonly string[]
  empiricalStatus: 'methodological-not-predictive' | 'documented-unvalidated-tradition' | 'parallel-unvalidated-models'
}

function entry(value: AstrologyAnswerDraft): AstrologyAnswerDraft { return value }

const ANSWER_DRAFTS: readonly AstrologyAnswerDraft[] = [
  entry({
    slug: 'information-needed-for-an-astrology-calculation', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'What information is needed to calculate an astrology chart reproducibly?', shortTitle: 'Required chart inputs',
    directAnswer: 'A reproducible chart calculation needs an identified instant, a civil-time resolution with timezone rules, an observer location where the method depends on one, an ephemeris and software version, declared coordinate frames, and numerical precision. A name and calendar date alone do not determine those inputs, and completing the geometry does not validate an interpretation.',
    practicalUse: 'Use this checklist before comparing charts or asking an interpretation question. If one required input is absent, preserve the uncertainty instead of allowing software defaults to become hidden facts.',
    authorityIds: ['calculation:civil-time-to-utc', 'calculation:observer-latitude-longitude', 'calculation:ephemeris-versioning', 'guide:tropical-vs-sidereal'],
    distinctions: ['Source event time versus software-resolved UTC instant', 'Observer coordinates versus legal or cultural place names', 'Calculated geometry versus tradition-relative interpretation'],
    limitations: ['The checklist cannot establish that the supplied time or place is historically accurate.', 'A reproducible chart can still have no demonstrated predictive validity.'],
    queryVariants: ['What data do I need for a birth chart?', 'What inputs make an astrology chart reproducible?', 'Can a chart be calculated from a date alone?', 'What does astrology software need to calculate a chart?'],
  }),
  entry({
    slug: 'why-exact-time-matters', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'Why does exact time matter in a chart calculation?', shortTitle: 'Why exact time matters',
    directAnswer: 'Time identifies the celestial instant and, with location, controls fast-changing angles such as the ascendant and house cusps. Slow planetary longitudes may remain nearly unchanged across a short interval while houses change materially. The honest output for an uncertain time is therefore a stability analysis, not an invented precise chart.',
    practicalUse: 'Separate placements that remain stable across the allowed interval from angles or houses that do not. Interpretive systems should receive only the features that survived that calculation-level test.',
    authorityIds: ['calculation:historical-time-zone-uncertainty', 'calculation:ascendant', 'calculation:house-cusp-boundaries', 'corporate:event-time-confidence-method'],
    distinctions: ['Clock precision versus source confidence', 'Stable planetary state versus unstable angular geometry', 'A computed timestamp versus an observed timestamp'],
    limitations: ['Rectification is not evidence that a newly chosen time is the historical time.', 'Exact-looking software output cannot repair an uncertain source record.'],
    queryVariants: ['Do I need an exact birth time?', 'What changes when birth time is uncertain?', 'Why can houses change without planets changing signs?', 'How sensitive is an astrology chart to time?'],
  }),
  entry({
    slug: 'daylight-saving-time-ambiguity', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'How should daylight-saving ambiguity be handled in astrology calculations?', shortTitle: 'Daylight-saving ambiguity',
    directAnswer: 'A clock change can make one local time occur twice or make a range of local times never occur. The calculation must use a named timezone database, detect the fold or gap, retain each valid candidate instant, and refuse silent normalization. Choosing the chart that looks more persuasive is not time evidence.',
    practicalUse: 'For a fold, calculate both candidate instants unless a record distinguishes them. For a gap, reject the local time or retain a documented correction supplied by the record owner.',
    authorityIds: ['calculation:daylight-saving-folds', 'calculation:daylight-saving-gaps', 'corporate:dst-fold-corporate-event-case-study'],
    distinctions: ['Repeated local time versus nonexistent local time', 'Timezone rule result versus evidence about which clock reading was intended', 'Documented correction versus automatic repair'],
    limitations: ['Historical practice can differ from a modern timezone database.', 'This method resolves temporal ambiguity; it does not validate any interpretation.'],
    queryVariants: ['What happens to a chart during daylight saving time?', 'Can one birth time map to two charts?', 'How should an invalid local time be handled?', 'What is a DST fold in astrology software?'],
  }),
  entry({
    slug: 'timezone-versus-utc-offset', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'Why is a timezone identifier different from a UTC offset?', shortTitle: 'Timezone versus offset',
    directAnswer: 'A UTC offset is one numerical relation at one instant. An IANA timezone identifier names a versioned history of civil-time rules, including political changes and daylight-saving transitions. Reproducibility requires the local timestamp, zone identifier, timezone-database version, resolved offset, and resulting UTC instant.',
    practicalUse: 'Retain both the rule-bearing zone and the resolved offset. This allows another implementation to reproduce the instant and to identify when a later timezone-database revision changes the result.',
    authorityIds: ['calculation:iana-time-zone-identifiers', 'calculation:civil-time-to-utc', 'corporate:civil-time-resolution-for-organizations'],
    distinctions: ['Rule set versus one numerical offset', 'Local wall-clock label versus UTC instant', 'Current timezone practice versus historical reconstruction'],
    limitations: ['A valid zone does not prove the event location.', 'Older records may remain uncertain even when software returns one answer.'],
    queryVariants: ['Is UTC minus five the same as America New York?', 'Why save the IANA timezone?', 'What timezone information belongs in a chart?', 'Can a fixed offset reproduce a historical chart?'],
  }),
  entry({
    slug: 'topocentric-versus-geocentric-chart', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'What is the difference between topocentric and geocentric chart positions?', shortTitle: 'Topocentric versus geocentric',
    directAnswer: 'A geocentric position is referred to Earth’s center, while a topocentric position is referred to a specified observer on Earth. The difference is especially relevant for nearby bodies and horizon events. A comparison must keep the same instant, ephemeris, frame, correction model, and observer data rather than treating the labels as interchangeable.',
    practicalUse: 'Declare the origin for every position and retain latitude, longitude, elevation, and atmospheric assumptions for horizon-dependent work. Compare outputs only after the shared inputs are frozen.',
    authorityIds: ['calculation:geocentric-vs-topocentric', 'calculation:elevation-and-horizon', 'timing:solar-eclipse-reference'],
    distinctions: ['Earth-center origin versus observer origin', 'Geometric altitude versus atmosphere-adjusted apparent altitude', 'Coordinate choice versus interpretive meaning'],
    limitations: ['An observer-relative correction does not make a symbolic interpretation empirical.', 'Local obstructions and weather are not supplied by ideal horizon geometry.'],
    queryVariants: ['Should an astrology chart be topocentric?', 'What does geocentric mean in astrology software?', 'Does observer location change planetary positions?', 'Why does elevation matter for rise and set times?'],
  }),
  entry({
    slug: 'why-astrology-software-disagrees', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'Why can two astrology programs calculate different charts?', shortTitle: 'Why software disagrees',
    directAnswer: 'Programs can differ because they resolve civil time differently, use different ephemerides or correction models, choose different zodiac and house conventions, or round near a boundary. A meaningful comparison isolates those choices one at a time and preserves the intermediate values; it does not select whichever output produces the preferred reading.',
    practicalUse: 'Compare the instant first, then ephemeris state, coordinate frame, zodiac conversion, house system, and rounding policy. A digest over the declared input and output bundle makes the comparison repeatable.',
    authorityIds: ['calculation:ephemeris-versioning', 'calculation:precision-rounding-and-uncertainty', 'comparison:zodiac-zero-points', 'guide:tropical-vs-sidereal'],
    distinctions: ['Data-version disagreement versus method disagreement', 'Boundary rounding versus genuinely different geometry', 'Reproducibility difference versus predictive-performance difference'],
    limitations: ['Agreement between programs does not establish that an interpretation is true.', 'An unexplained discrepancy should remain unresolved rather than be averaged.'],
    queryVariants: ['Why do astrology apps give different results?', 'Why are my houses different in two programs?', 'How can I compare astrology software?', 'Which chart calculator is correct?'],
  }),
  entry({
    slug: 'how-to-audit-a-chart-calculation', category: 'Calculation foundations', frame: 'evaluation-method',
    question: 'How can a chart calculation be audited?', shortTitle: 'Audit a chart calculation',
    directAnswer: 'An auditable chart retains canonical inputs, source and software versions, intermediate conventions, uncertainty decisions, outputs, and a digest that changes when any covered field changes. The digest proves byte-level integrity of that declared bundle; it does not prove that the input event was genuine or that an interpretation predicts outcomes.',
    practicalUse: 'Export the calculation contract and reproduce it independently before examining interpretation. Treat missing versions, hidden defaults, or a digest that cannot be recomputed as provenance failures.',
    authorityIds: ['calculation:reproducibility-digests', 'calculation:ephemeris-versioning', 'corporate:evidence-attachment-fingerprinting'],
    distinctions: ['Integrity of a bundle versus truth of its contents', 'Calculation provenance versus source-event provenance', 'Reproduction of arithmetic versus validation of interpretation'],
    limitations: ['A hash cannot reveal whether an omitted input mattered.', 'Independent reproduction requires the same declared algorithms and data versions.'],
    queryVariants: ['Can I verify an astrology calculation?', 'What should a chart receipt contain?', 'What does a chart digest prove?', 'How do I reproduce a chart exactly?'],
  }),
  entry({
    slug: 'what-to-do-when-birth-time-is-unknown', category: 'Calculation foundations', frame: 'calculation-method',
    question: 'What should a chart report do when the birth time is unknown?', shortTitle: 'Unknown birth time',
    directAnswer: 'It should preserve the stated date and place, define a defensible time interval, compute which features remain stable across that interval, and withhold unstable angles or houses. It should not convert noon, sunrise, or a rectified time into an observed fact merely because software requires one instant.',
    practicalUse: 'Publish a date- or interval-based stability result and label unavailable features explicitly. A later documented time can create a new calculation revision without rewriting the earlier uncertainty.',
    authorityIds: ['calculation:historical-time-zone-uncertainty', 'calculation:house-cusp-boundaries', 'corporate:date-only-stability-audit'],
    distinctions: ['Known date versus known instant', 'Stable feature versus withheld feature', 'Declared placeholder calculation versus historical evidence'],
    limitations: ['Some fast lunar or angular features may vary substantially across a day.', 'This procedure does not endorse any rectification technique.'],
    queryVariants: ['Can I calculate a chart without a birth time?', 'What houses should be used when time is unknown?', 'Is a noon chart accurate?', 'How should date-only astrology be reported?'],
  }),
  entry({
    slug: 'tropical-versus-sidereal-zodiac', category: 'Coordinate frames', frame: 'frame-comparison',
    question: 'What is the practical difference between tropical and sidereal zodiac frames?', shortTitle: 'Tropical versus sidereal',
    directAnswer: 'Both frames can begin from the same time-indexed celestial direction. The tropical frame measures longitude from the equinox; a sidereal frame applies a named stellar-reference convention such as Lahiri. The resulting sign labels can differ without the underlying body, instant, distance, or motion becoming different.',
    practicalUse: 'Store the shared celestial state once, then derive separately named tropical and sidereal fields. Never combine sign-conditioned rules unless a rule explicitly declares the frame it consumes.',
    authorityIds: ['guide:tropical-vs-sidereal', 'comparison:zodiac-zero-points', 'calculation:tropical-zodiac-longitude', 'calculation:sidereal-zodiac-longitude'],
    distinctions: ['Shared celestial state versus derived sign label', 'Equinox-anchored zero point versus named sidereal zero point', 'Coordinate disagreement versus empirical adjudication'],
    limitations: ['“Sidereal” does not identify one universal ayanāṁśa.', 'This comparison does not establish that either interpretive system predicts outcomes.'],
    queryVariants: ['What is tropical versus sidereal astrology?', 'Why is my sign different in Vedic astrology?', 'Do tropical and sidereal charts show different planets?', 'Which zodiac uses the equinox?'],
  }),
  entry({
    slug: 'what-is-an-ayanamsha', category: 'Coordinate frames', frame: 'calculation-method',
    question: 'What is an ayanāṁśa in a reproducible astrology calculation?', shortTitle: 'What is an ayanāṁśa?',
    directAnswer: 'An ayanāṁśa is a named angular-offset convention used to transform a retained tropical ecliptic longitude into a sidereal longitude. A reproducible result records the method, version, numerical offset, input longitude, normalized output, and distance to relevant boundaries rather than saying only “sidereal.”',
    practicalUse: 'Keep the tropical longitude and the applied offset alongside the sidereal result. This makes two sidereal calculations comparable without treating every sidereal convention as Lahiri.',
    authorityIds: ['calculation:lahiri-ayanamsa-convention', 'guide:lahiri-ayanamsa', 'comparison:zodiac-zero-points'],
    distinctions: ['Named offset convention versus a universal sidereal zero point', 'Input tropical longitude versus derived sidereal longitude', 'Coordinate transformation versus interpretive validation'],
    limitations: ['Different ayanāṁśas can move a placement near a boundary.', 'Choosing an offset after reading an outcome is not a neutral calculation decision.'],
    queryVariants: ['What does ayanamsha mean?', 'How is Lahiri sidereal longitude calculated?', 'Why do sidereal charts disagree?', 'Is Lahiri the only sidereal zodiac?'],
  }),
  entry({
    slug: 'precession-versus-ayanamsha', category: 'Coordinate frames', frame: 'frame-comparison',
    question: 'How are precession and ayanāṁśa related, and how are they different?', shortTitle: 'Precession versus ayanāṁśa',
    directAnswer: 'Precession is an astronomical change in Earth’s orientation that affects coordinate transformations over time. An ayanāṁśa is a chosen convention for locating a sidereal zodiac relative to a tropical longitude. Precession motivates a changing angular relation, but it does not select one astrological zero point by itself.',
    practicalUse: 'Record the astronomical precession model separately from the named sidereal convention. This prevents a physical coordinate effect from being presented as proof of one interpretive tradition.',
    authorityIds: ['calculation:precession', 'calculation:lahiri-ayanamsa-convention', 'guide:lahiri-ayanamsa'],
    distinctions: ['Earth-orientation model versus zodiac convention', 'Astronomical transformation versus traditional namespace', 'Measured coordinate change versus interpretive claim'],
    limitations: ['This answer does not resolve debates among sidereal zero points.', 'The existence of precession does not validate astrological prediction.'],
    queryVariants: ['Is ayanamsha the same as precession?', 'Does precession prove sidereal astrology?', 'Why does the tropical sidereal gap change?', 'What does precession change in a chart?'],
  }),
  entry({
    slug: 'sign-boundary-uncertainty', category: 'Coordinate frames', frame: 'calculation-method',
    question: 'How should a chart handle a planet near a sign boundary?', shortTitle: 'Sign-boundary uncertainty',
    directAnswer: 'A boundary-sensitive result should retain the unrounded longitude, frame, uncertainty interval, numerical precision, and distance to the boundary. If plausible input or model variation crosses that boundary, the sign label is unstable and should be reported as such rather than forced by display rounding.',
    practicalUse: 'Test the calculation across the allowed time and model interval. Downstream rules conditioned on a sign should be withheld whenever the sign itself is not stable.',
    authorityIds: ['calculation:zodiac-sign-boundaries', 'calculation:precision-rounding-and-uncertainty', 'timing:sun-ingress-reference'],
    distinctions: ['Displayed degree versus retained longitude', 'Numerical rounding versus input uncertainty', 'Boundary crossing versus interpretive importance'],
    limitations: ['A stable label does not establish a stable prediction.', 'Uncertainty ranges depend on declared input and model assumptions.'],
    queryVariants: ['What if a planet is on a cusp?', 'Can rounding change a zodiac sign?', 'How close to a sign boundary is uncertain?', 'Should cusp planets have two signs?'],
  }),
  entry({
    slug: 'ascendant-and-whole-sign-houses', category: 'Coordinate frames', frame: 'frame-comparison',
    question: 'How can the same horizon produce different ascendant and whole-sign houses?', shortTitle: 'Ascendant and whole-sign houses',
    directAnswer: 'The physical horizon intersection is calculated from one instant and observer, but its zodiac label depends on the declared zodiac frame. Whole-sign houses then number complete signs from that labeled ascendant sign. Changing the frame can therefore move house labels without changing the underlying horizon geometry.',
    practicalUse: 'Retain the horizon intersection, tropical label, named sidereal conversion, and each separate house namespace. Never present the two house maps as one blended chart.',
    authorityIds: ['calculation:ascendant', 'calculation:whole-sign-houses', 'comparison:ascendant-and-whole-sign-houses'],
    distinctions: ['Horizon geometry versus zodiac label', 'Ascendant degree versus whole-sign house numbering', 'Parallel frames versus hybrid interpretation'],
    limitations: ['Accurate angular geometry still depends strongly on event time and place.', 'This comparison does not decide which house interpretation performs better.'],
    queryVariants: ['Why does my rising sign change in sidereal astrology?', 'Can whole sign houses differ by zodiac?', 'Is the ascendant a physical direction?', 'How do tropical and sidereal houses compare?'],
  }),
  entry({
    slug: 'why-house-systems-disagree', category: 'Coordinate frames', frame: 'frame-comparison',
    question: 'Why do whole-sign, equal, and Placidus houses disagree?', shortTitle: 'Why house systems disagree',
    directAnswer: 'They apply different geometric or assignment conventions. Whole-sign houses use complete zodiac signs from the ascendant sign, equal houses divide from a chosen starting degree, and Placidus uses a time-based quadrant construction with latitude limits. Their outputs are not interchangeable labels for one calculation.',
    practicalUse: 'Declare the house system, frame, observer, and fallback policy before interpretation. At polar latitudes or near cusps, report unavailable or unstable results rather than silently switching systems.',
    authorityIds: ['calculation:whole-sign-houses', 'calculation:equal-houses', 'calculation:placidus-houses', 'comparison:ascendant-and-whole-sign-houses'],
    distinctions: ['Sign assignment versus equal arcs versus quadrant construction', 'Requested method versus silent fallback', 'House geometry versus interpretive rule'],
    limitations: ['This answer does not establish that one house system predicts better.', 'Some systems can be undefined or unstable at extreme latitudes.'],
    queryVariants: ['Why are my houses different in different apps?', 'What is whole sign versus Placidus?', 'Can Placidus fail near the poles?', 'Should software switch house systems automatically?'],
  }),
  entry({
    slug: 'mean-versus-true-lunar-node', category: 'Coordinate frames', frame: 'calculation-method',
    question: 'What is the difference between the mean and true lunar node?', shortTitle: 'Mean versus true lunar node',
    directAnswer: 'Both are calculated descriptions of the Moon’s orbital-plane intersection, not physical planets. The mean node smooths short-period variation, while the true node includes a model of that oscillation. An ingress date or sign label is incomplete unless it names which node convention was used.',
    practicalUse: 'Store the node convention with longitude, speed, frame, ephemeris model, and boundary distance. Do not mix a true-node placement with a rule defined for a mean-node chronology without disclosure.',
    authorityIds: ['calculation:mean-vs-true-lunar-node', 'timing:lunar-node-ingress-reference', 'comparison:longitude-and-sign-labels'],
    distinctions: ['Orbital intersection versus physical body', 'Smoothed model versus oscillating model', 'Node convention versus zodiac frame'],
    limitations: ['Neither convention establishes interpretive efficacy.', 'Small model differences can matter near a sign boundary.'],
    queryVariants: ['Should I use true node or mean node?', 'Why does Rahu change position?', 'Is the lunar node a planet?', 'Which node is used for ingress dates?'],
  }),
  entry({
    slug: 'aspects-across-zodiac-frames', category: 'Coordinate frames', frame: 'frame-comparison',
    question: 'Do aspects change between tropical and sidereal charts?', shortTitle: 'Aspects across frames',
    directAnswer: 'A purely angular aspect computed from the same pair of physical longitudes can remain unchanged under a common rotational offset, while sign-based aspects and sign-conditioned eligibility can change with the zodiac labels. A comparison must distinguish angular separation from rules that depend on named signs or houses.',
    practicalUse: 'Retain angular geometry separately from sign relationships, orb policy, applying or separating state, and tradition namespace. This reveals which part of an apparent disagreement is arithmetic and which is interpretive.',
    authorityIds: ['calculation:aspect-geometry-and-orbs', 'calculation:applying-and-separating-aspects', 'comparison:angular-aspects-and-sign-aspects'],
    distinctions: ['Angular separation versus sign-based relationship', 'Orb convention versus exact angle', 'Shared geometry versus frame-specific eligibility'],
    limitations: ['Aspect terminology and allowable orbs vary by tradition.', 'Geometric agreement is not evidence of predictive meaning.'],
    queryVariants: ['Are aspects the same in Vedic and Western astrology?', 'Does ayanamsha change aspects?', 'What is an angular aspect?', 'Why do sign aspects disagree?'],
  }),
  entry({
    slug: 'what-is-a-planetary-ingress', category: 'Timing methods', frame: 'timing-method',
    question: 'What is a planetary ingress, computationally?', shortTitle: 'What is an ingress?',
    directAnswer: 'An ingress is a root-finding event: a body’s declared longitude crosses a declared zodiac boundary in a named frame and direction. The result needs an ephemeris, time scale, frame, precision, search interval, and crossing direction. It is a calculated timestamp, not evidence that a real-world event will follow.',
    practicalUse: 'Search a bounded interval for every crossing, refine each root to the declared tolerance, and retain frame and direction. Never use one frame’s sign label with the other frame’s crossing time.',
    authorityIds: ['timing:sun-ingress-reference', 'calculation:zodiac-sign-boundaries', 'guide:jupiter-transits'],
    distinctions: ['Boundary crossing versus residence in a sign', 'Tropical ingress versus sidereal ingress', 'Calculated event time versus predictive claim'],
    limitations: ['Display precision cannot exceed the underlying calculation and input precision.', 'Interpretive meaning requires a separately identified tradition rule.'],
    queryVariants: ['What does ingress mean in astrology?', 'How is an ingress date calculated?', 'Is a planet physically entering a sign?', 'Why do tropical and sidereal ingress dates differ?'],
  }),
  entry({
    slug: 'why-an-ingress-can-happen-three-times', category: 'Timing methods', frame: 'timing-method',
    question: 'Why can the same planetary ingress occur three times?', shortTitle: 'Repeated ingresses',
    directAnswer: 'Apparent retrograde motion can carry a planet across a boundary, back across it, and forward across it again. A complete event search preserves all crossings, their directions, and their order. Reporting only the first or preferred crossing loses chronology and can invite outcome-driven selection.',
    practicalUse: 'Search the full interval and label each direct or retrograde crossing. If an interpretation selects one crossing, that selection rule should be declared before outcomes are examined.',
    authorityIds: ['timing:jupiter-ingress-reference', 'comparison:retrograde-repeated-crossings', 'guide:jupiter-transits'],
    distinctions: ['First crossing versus full crossing sequence', 'Direct ingress versus retrograde re-entry', 'Chronology rule versus outcome-based selection'],
    limitations: ['Not every boundary is crossed three times.', 'A repeated astronomical event does not establish a repeated real-world effect.'],
    queryVariants: ['Why does Jupiter enter a sign more than once?', 'What is retrograde re-entry?', 'Which ingress date should I use?', 'Can a transit boundary be crossed three times?'],
  }),
  entry({
    slug: 'station-retrograde-and-direct-motion', category: 'Timing methods', frame: 'timing-method',
    question: 'How are station, retrograde, and direct motion determined?', shortTitle: 'Station and retrograde motion',
    directAnswer: 'The labels come from the sign and near-zero behavior of a declared apparent longitude speed. A station is a root or bounded minimum near the change of direction, not an indefinitely precise instant independent of tolerance. The calculation must preserve ephemeris, frame, speed definition, search interval, and uncertainty.',
    practicalUse: 'Report the root-finding tolerance and distinguish a numerical station instant from a broader interpretive “station period.” Search both sides of the root to confirm the direction change.',
    authorityIds: ['calculation:retrograde-station-and-direct-motion', 'timing:mercury-station-reference', 'comparison:retrograde-repeated-crossings'],
    distinctions: ['Apparent longitude speed versus physical orbital reversal', 'Numerical station instant versus interpretive window', 'Root tolerance versus display precision'],
    limitations: ['Different coordinate definitions can move the reported instant slightly.', 'The motion label alone supplies no predictive meaning.'],
    queryVariants: ['How is Mercury retrograde calculated?', 'What is a planetary station?', 'Does a planet actually move backward?', 'How precise is a station time?'],
  }),
  entry({
    slug: 'how-lunations-are-calculated', category: 'Timing methods', frame: 'timing-method',
    question: 'How are New Moon, Full Moon, and quarter phases calculated?', shortTitle: 'Calculating lunations',
    directAnswer: 'Lunations are found by solving for declared Sun–Moon angular separations: conjunction, opposition, and the two quadratures. The event record needs a time scale, ephemeris, coordinate convention, root tolerance, and handling for the angular wrap. A phase timestamp is astronomical geometry, not a prediction.',
    practicalUse: 'Search for the target elongation in a bounded interval, normalize angular difference consistently, and retain the refined UTC instant and uncertainty. Keep phase events separate from sunrise-based calendrical day labels.',
    authorityIds: ['timing:new-moon-reference', 'timing:full-moon-reference', 'calculation:tithi'],
    distinctions: ['Exact angular event versus named civil day', 'Conjunction versus visibility of the lunar crescent', 'Astronomical phase versus interpretive rule'],
    limitations: ['A New Moon instant is not the same as first visible crescent.', 'Calendar labels depend on additional location and day-boundary conventions.'],
    queryVariants: ['How is a New Moon time calculated?', 'What angle defines a Full Moon?', 'Is tithi the same as Moon phase?', 'How are lunar quarters found?'],
  }),
  entry({
    slug: 'how-eclipse-times-are-established', category: 'Timing methods', frame: 'timing-method',
    question: 'How are eclipse times established, and why are they not ordinary lunations?', shortTitle: 'Calculating eclipses',
    directAnswer: 'An eclipse requires the Sun–Moon phase geometry plus alignment with the Moon’s orbital nodes and a declared observer or Earth-centered circumstance. A conjunction or opposition alone is therefore insufficient. Contact times, visibility, and magnitude depend on the adopted ephemeris and eclipse model.',
    practicalUse: 'Use a dedicated eclipse search and retain the event type, observer context, contact definitions, ephemeris version, and uncertainty. Do not infer visibility at a location from a global phase time.',
    authorityIds: ['timing:solar-eclipse-reference', 'timing:lunar-eclipse-reference', 'calculation:geocentric-vs-topocentric'],
    distinctions: ['Lunation geometry versus nodal alignment', 'Global event versus local visibility', 'Contact calculation versus astrological interpretation'],
    limitations: ['Local weather and obstructions are outside the celestial calculation.', 'An accurately timed eclipse does not establish a social or personal effect.'],
    queryVariants: ['Why is there not an eclipse every New Moon?', 'How is solar eclipse visibility calculated?', 'What makes a lunar eclipse?', 'Is eclipse time the same everywhere?'],
  }),
  entry({
    slug: 'how-vimshottari-dasha-starts', category: 'Timing methods', frame: 'timing-method',
    question: 'How is the opening Vimśottarī daśā balance calculated?', shortTitle: 'Opening daśā balance',
    directAnswer: 'The declared method converts the natal Moon to a named sidereal frame, identifies its nakṣatra, measures the traversed and remaining fraction, and applies that fraction to the period length of the nakṣatra ruler. The result depends on ayanāṁśa, ephemeris, time, year-length, and boundary conventions.',
    practicalUse: 'Retain Moon longitude, Lahiri offset, nakṣatra boundary distance, elapsed fraction, ruler, year-length convention, and output timestamp so another implementation can reproduce the balance.',
    authorityIds: ['timing:vimshottari-birth-balance-reference', 'calculation:nakshatra-and-pada', 'guide:vimshottari-dasha'],
    distinctions: ['Calculated chronology versus interpretation of a period', 'Nakṣatra position versus ruler symbolism', 'Named year length versus civil calendar year'],
    limitations: ['The traditional calculation locator remains passage-review pending.', 'Reproducing the chronology does not validate event prediction.'],
    queryVariants: ['How do I calculate the first mahadasha?', 'What determines the opening dasha balance?', 'How does the Moon choose a Vimshottari period?', 'Why does ayanamsha change dasha dates?'],
  }),
  entry({
    slug: 'how-vimshottari-subperiods-are-calculated', category: 'Timing methods', frame: 'timing-method',
    question: 'How are Vimśottarī antardaśā subperiods calculated?', shortTitle: 'Calculating antardaśā',
    directAnswer: 'Within a mahādaśā, subperiod durations are allocated proportionally according to the fixed nine-lord sequence and declared period lengths. The implementation must specify year length, nesting order, rounding, and boundary policy. Those dates form a deterministic chronology under the convention, not evidence that the lords cause events.',
    practicalUse: 'Compute all children from the parent duration and fixed order, preserve exact intermediate durations, and reconcile the children back to the parent without hidden rounding loss.',
    authorityIds: ['timing:vimshottari-mahadasha-reference', 'timing:vimshottari-antardasha-reference', 'guide:vimshottari-dasha'],
    distinctions: ['Parent period duration versus calendar display', 'Proportional allocation versus equal subdivision', 'Chronology versus causal claim'],
    limitations: ['Different year-length conventions can shift displayed boundaries.', 'Interpretive rules require separate source and review evidence.'],
    queryVariants: ['How are antardasha dates calculated?', 'What is inside a mahadasha?', 'Why do dasha calculators show different dates?', 'Do Vimshottari subperiods have equal lengths?'],
  }),
  entry({
    slug: 'why-a-date-is-not-a-prediction', category: 'Timing methods', frame: 'evaluation-method',
    question: 'Why is a precisely calculated astrology date not itself a prediction?', shortTitle: 'A date is not a prediction',
    directAnswer: 'A date can be a reproducible astronomical or conventional boundary without specifying an outcome, population, direction, horizon, baseline, or scoring rule. Prediction begins only when those elements are declared before the outcome is known and evaluated prospectively with misses and abstentions retained.',
    practicalUse: 'Treat ingress, station, lunation, and daśā timestamps as method outputs. Attach an interpretation only through a named rule, and call it predictive only after a preregistered evaluation supports that narrower claim.',
    authorityIds: ['timing:jupiter-ingress-reference', 'comparison:prospective-model-scoring', 'corporate:corporate-outcome-preregistration'],
    distinctions: ['Event timestamp versus forecast statement', 'Retrospective fit versus prospective score', 'Calculated precision versus evidentiary strength'],
    limitations: ['A preregistered test can still be underpowered or poorly specified.', 'This framework does not assume that an astrology model will outperform a baseline.'],
    queryVariants: ['Does an accurate transit date prove astrology?', 'What makes astrology predictive?', 'Can a dasha date predict an event?', 'Why preregister astrology forecasts?'],
  }),
  entry({
    slug: 'documented-tradition-versus-validated-claim', category: 'Traditions and evaluation', frame: 'tradition-description',
    question: 'What is the difference between a documented astrology tradition and a validated claim?', shortTitle: 'Tradition versus validation',
    directAnswer: 'Documentation establishes that a named source or practice contains a rule and records its conditions faithfully. Validation asks a separate empirical question about performance against declared outcomes and baselines. A rule can have excellent provenance and no demonstrated predictive support; the system must retain both facts.',
    practicalUse: 'Display provenance and empirical status on separate axes. Never upgrade an interpretive rule because its source is old, respected, accurately transcribed, or internally coherent.',
    authorityIds: ['tradition:hellenistic-ptolemaic', 'tradition:vedic-jyotisha', 'comparison:prospective-model-scoring'],
    distinctions: ['Textual fidelity versus empirical support', 'Historical importance versus predictive accuracy', 'Named doctrine versus universal claim'],
    limitations: ['Absence of validation is not proof of impossibility.', 'Historical description cannot substitute for a prospective test.'],
    queryVariants: ['Does an ancient astrology source prove the rule works?', 'What does source-bound astrology mean?', 'Can astrology be well sourced but unvalidated?', 'What is provenance in astrology?'],
  }),
  entry({
    slug: 'why-jyotisha-uses-a-sidereal-frame', category: 'Traditions and evaluation', frame: 'tradition-description',
    question: 'Why does the Jyotiṣa layer use a sidereal frame?', shortTitle: 'Jyotiṣa and the sidereal frame',
    directAnswer: 'The registered Jyotiṣa rule namespace declares a sidereal zodiac and the implementation names Lahiri where that specific convention is used. This is a tradition and calculation contract: it keeps frame-dependent features such as nakṣatra and Vimśottarī eligibility explicit. It is not a claim that every Jyotiṣa lineage uses one setting.',
    practicalUse: 'Bind each rule to its named frame and ayanāṁśa. Keep tropical results available as shared input or comparison data without feeding them into a sidereal rule silently.',
    authorityIds: ['tradition:vedic-jyotisha', 'guide:lahiri-ayanamsa', 'comparison:vimshottari-dasha-eligibility'],
    distinctions: ['Registered Maha convention versus every living lineage', 'Sidereal frame versus Lahiri specifically', 'Calculation eligibility versus predictive validity'],
    limitations: ['The current rule corpus is deliberately small.', 'Passage and practitioner review remain separate from arithmetic reproducibility.'],
    queryVariants: ['Is Vedic astrology always sidereal?', 'Why does Jyotisha use ayanamsha?', 'Does Vimshottari require a sidereal Moon?', 'Which sidereal system does Maha use?'],
  }),
  entry({
    slug: 'what-ptolemaic-astrology-means-here', category: 'Traditions and evaluation', frame: 'tradition-description',
    question: 'What does “Ptolemaic astrology” mean in this knowledge system?', shortTitle: 'Ptolemaic scope',
    directAnswer: 'It names the bounded Hellenistic rule namespace represented through Ptolemy’s Tetrabiblos and its transmission history. It does not stand for every ancient, medieval, Renaissance, or modern Western technique. The tradition page records sourced rules and disagreements while fixing their empirical status as unvalidated tradition.',
    practicalUse: 'Use the label only for rules actually tied to the registered source and passage set. Related later practices should receive their own namespace rather than being backfilled into Ptolemy.',
    authorityIds: ['tradition:hellenistic-ptolemaic', 'guide:tropical-vs-sidereal', 'comparison:dignity-rulership-and-house-lords'],
    distinctions: ['Ptolemy’s source corpus versus all Western astrology', 'Tropical coordinate frame versus later technique package', 'Transmission history versus unchanged doctrine'],
    limitations: ['The registry is not a complete history of Hellenistic astrology.', 'Source fidelity does not establish empirical performance.'],
    queryVariants: ['What is Ptolemaic astrology?', 'Is all Western astrology Ptolemaic?', 'What sources define the Hellenistic tradition here?', 'Does Ptolemaic mean tropical astrology?'],
  }),
  entry({
    slug: 'why-horary-rules-are-withheld', category: 'Traditions and evaluation', frame: 'tradition-description',
    question: 'Why are William Lilly horary rules registered but not published?', shortTitle: 'Why horary rules are withheld',
    directAnswer: 'The source is public domain, but the available machine transcriptions identified by the registry are unproofread OCR of difficult seventeenth-century typography. Publishing extracted rules would claim transcription fidelity that the evidence cannot support. The tradition remains registered while its rule set remains empty.',
    practicalUse: 'Treat source rights, transcription quality, passage identity, and rule formalization as separate gates. A public-domain label clears only the rights question.',
    authorityIds: ['tradition:horary-lilly', 'calculation:reproducibility-digests', 'comparison:prospective-model-scoring'],
    distinctions: ['Public-domain status versus usable transcription', 'OCR availability versus passage fidelity', 'Registered tradition versus published rule corpus'],
    limitations: ['This is a statement about the currently reviewed source route, not every possible edition.', 'Withholding rules makes no empirical judgment about horary astrology.'],
    queryVariants: ['Why are there no horary rules on Maha?', 'Is William Lilly public domain?', 'Can unproofread OCR be used as evidence?', 'What blocks the horary tradition registry?'],
  }),
  entry({
    slug: 'how-to-compare-astrology-traditions', category: 'Traditions and evaluation', frame: 'frame-comparison',
    question: 'How can astrology traditions be compared without blending them?', shortTitle: 'Compare traditions without blending',
    directAnswer: 'Start with one shared celestial fact bundle, then apply separately named coordinate, technique, and rule namespaces. Record where the systems agree, where they disagree, and which inputs each requires. Do not average outputs, translate sign labels silently, or select a tradition after seeing the outcome.',
    practicalUse: 'Keep parallel feature sets and score any empirical models independently under one preregistered outcome contract. A comparison page should preserve disagreement rather than manufacture consensus.',
    authorityIds: ['tradition:hellenistic-ptolemaic', 'tradition:vedic-jyotisha', 'comparison:zodiac-zero-points', 'comparison:prospective-model-scoring'],
    distinctions: ['Shared facts versus separate rule namespaces', 'Descriptive comparison versus hybrid synthesis', 'Historical relation versus performance comparison'],
    limitations: ['Translation between vocabularies can lose doctrine-specific meaning.', 'Agreement between two traditions is not independent validation.'],
    queryVariants: ['Can Western and Vedic astrology be combined?', 'How should tropical and sidereal systems be compared?', 'What is a hybrid astrology chart?', 'How do you preserve disagreement between traditions?'],
  }),
  entry({
    slug: 'how-astrology-could-be-tested', category: 'Traditions and evaluation', frame: 'evaluation-method',
    question: 'What would a meaningful empirical test of an astrology claim require?', shortTitle: 'How astrology could be tested',
    directAnswer: 'A meaningful test must define the rule, inputs, target population, outcome, direction, horizon, baseline, scoring rule, exclusions, model-selection policy, and multiplicity control before outcomes are known. It must then retain misses, non-events, abstentions, and ordinary periods rather than reporting only matches.',
    practicalUse: 'Convert one bounded interpretive statement into a preregistered candidate model. Freeze the calculation and rule versions, compare against a non-astrological baseline, and publish the complete result rather than a curated anecdote.',
    authorityIds: ['comparison:prospective-model-scoring', 'corporate:corporate-outcome-preregistration', 'guide:jupiter-transits'],
    distinctions: ['Rule documentation versus test specification', 'Retrospective example versus prospective evaluation', 'Statistical association versus causal explanation'],
    limitations: ['One successful test would support only the tested claim and conditions.', 'Poorly measured outcomes or flexible analysis can invalidate an otherwise prospective study.'],
    queryVariants: ['Can astrology be scientifically tested?', 'What is a fair test of astrology?', 'How should transit predictions be scored?', 'Why are astrology anecdotes not enough?'],
  }),
  entry({
    slug: 'which-event-starts-a-corporate-chart', category: 'Organization-event methods', frame: 'organization-method',
    question: 'Which event should be used to start a corporate chart?', shortTitle: 'Choose the organization event',
    directAnswer: 'A company has several documentable beginnings—submission, legal acceptance, first transaction, first deployment, public launch, or merger—and none is automatically the unique event. The method must name and justify the event type before calculation, preserve the evidence for it, and keep competing events separate.',
    practicalUse: 'Choose the event that matches the research or interpretive question, record its authority and timestamp confidence, and resist replacing it later because another chart appears more favorable.',
    authorityIds: ['corporate:organization-event-taxonomy', 'guide:corporate-charts', 'calculation:civil-time-to-utc'],
    distinctions: ['Legal event versus commercial event versus technical event', 'Document date versus event timestamp', 'Declared selection rule versus post-hoc preference'],
    limitations: ['An event taxonomy cannot prove one metaphysically correct corporate birth.', 'The chart cannot establish legal status or business value.'],
    queryVariants: ['What is a company birth date?', 'Should a corporate chart use incorporation or launch?', 'Which timestamp starts a business horoscope?', 'Can a company have multiple charts?'],
  }),
  entry({
    slug: 'incorporation-submission-versus-acceptance', category: 'Organization-event methods', frame: 'organization-method',
    question: 'Should an incorporation chart use filing submission or official acceptance?', shortTitle: 'Submission versus acceptance',
    directAnswer: 'Submission and acceptance are different administrative events. A legal-formation method should retain both when available, identify the registry authority and status transition, and use only the event defined in advance for the stated analysis. A later certificate date must not be converted into an unsupported minute-level acceptance time.',
    practicalUse: 'Build a lineage of filing events rather than one overwritten date. Apply date-only stability analysis when an official record supplies no time.',
    authorityIds: ['corporate:legal-formation-event-selection', 'corporate:filing-submission-versus-acceptance-case-study', 'calculation:historical-time-zone-uncertainty'],
    distinctions: ['Submission receipt versus registry acceptance', 'Certificate issuance versus effective legal status', 'Recorded timestamp versus inferred time'],
    limitations: ['Legal effect varies by jurisdiction and requires authoritative legal records.', 'The method does not establish which event has astrological significance.'],
    queryVariants: ['Use filing date or incorporation date for a company chart?', 'What time should an incorporation chart use?', 'Is certificate date the company birth time?', 'How should multiple formation timestamps be handled?'],
  }),
  entry({
    slug: 'deployment-versus-public-launch', category: 'Organization-event methods', frame: 'organization-method',
    question: 'Is a production deployment the same corporate event as a public launch?', shortTitle: 'Deployment versus launch',
    directAnswer: 'No. A deployment records a technical environment transition; a public launch records declared availability to an audience. Their timestamps, locations, evidence, and failure states can differ. A governed event corpus stores them separately and does not substitute one after examining a chart or outcome.',
    practicalUse: 'Preregister the deployment or launch state that counts, retain provider or publication evidence, and identify region, environment, clock, and success condition. Related timestamps remain linked but distinct.',
    authorityIds: ['corporate:first-deployment-method', 'corporate:public-launch-method', 'corporate:deployment-versus-launch-case-study', 'calculation:civil-time-to-utc'],
    distinctions: ['Technical success versus public availability', 'Regional completion versus global announcement', 'Provider telemetry versus marketing copy'],
    limitations: ['Distributed systems may have no single universal deployment instant.', 'Neither event establishes commercial success or predictive skill.'],
    queryVariants: ['Should a startup chart use deployment or launch?', 'What is a product launch timestamp?', 'Does a git merge count as company launch?', 'How do you chart a distributed deployment?'],
  }),
  entry({
    slug: 'corporate-event-time-uncertainty', category: 'Organization-event methods', frame: 'organization-method',
    question: 'How should uncertainty in a corporate event time be handled?', shortTitle: 'Corporate time uncertainty',
    directAnswer: 'The event record should classify whether it has an instant, minute, hour, official date, or estimate, convert that statement into an explicit time interval, and test chart features across the interval. Houses or angles that change should be withheld rather than printed at a convenient placeholder time.',
    practicalUse: 'Use the confidence class to generate the interval, retain the original evidence wording, and publish a stability matrix showing which calculated features survive.',
    authorityIds: ['corporate:event-time-confidence-method', 'corporate:date-only-stability-audit', 'calculation:house-cusp-boundaries'],
    distinctions: ['Timestamp precision versus evidence confidence', 'Date-only record versus noon placeholder', 'Stable feature versus unavailable interpretation'],
    limitations: ['A broad interval can make most angular features unusable.', 'Stability does not establish predictive validity.'],
    queryVariants: ['What if a company launch time is unknown?', 'Can I use noon for an incorporation chart?', 'How do you handle date-only corporate events?', 'Which chart features survive time uncertainty?'],
  }),
  entry({
    slug: 'jurisdiction-versus-event-location', category: 'Organization-event methods', frame: 'organization-method',
    question: 'Should a corporate chart use the legal jurisdiction or the event location?', shortTitle: 'Jurisdiction versus location',
    directAnswer: 'Jurisdiction and event location are separate facts. A filing can be governed by one authority while an operational event occurs in another place or across several regions. The method must state which location belongs to the selected event and why; a registered office or founder location cannot be substituted silently.',
    practicalUse: 'Retain jurisdiction, authority, event location, observer coordinates, and location-selection policy as separate fields. For distributed events, record each relevant region and the preregistered primary rule.',
    authorityIds: ['corporate:event-location-policy', 'corporate:jurisdiction-versus-event-location', 'calculation:observer-latitude-longitude'],
    distinctions: ['Legal authority versus physical observer location', 'Headquarters versus operational region', 'One documented site versus distributed event'],
    limitations: ['The policy cannot make a distributed event geographically singular.', 'Location choice does not establish an astrological effect.'],
    queryVariants: ['What location should a company chart use?', 'Use registered office or launch location?', 'How do you chart a cloud deployment region?', 'Is incorporation jurisdiction the chart location?'],
  }),
  entry({
    slug: 'what-a-corporate-chart-cannot-establish', category: 'Organization-event methods', frame: 'evaluation-method',
    question: 'What can a corporate astrology chart not establish?', shortTitle: 'Corporate-chart non-claims',
    directAnswer: 'A corporate chart cannot establish legal status, valuation, revenue, solvency, investment return, survival, causation, or a guaranteed business outcome. At most, a governed system can reproduce event geometry, document a named interpretive tradition, and prospectively test a narrowly specified claim against an ordinary baseline.',
    practicalUse: 'Use the chart as a declared symbolic or research model, never as due diligence. Keep legal, financial, operational, and empirical evidence in their own authority systems.',
    authorityIds: ['corporate:corporate-outcome-preregistration', 'comparison:corporate-event-chart-comparison', 'guide:corporate-charts'],
    distinctions: ['Symbolic model versus business evidence', 'Event provenance versus outcome causation', 'Prospective test versus investment recommendation'],
    limitations: ['This layer is not legal, financial, or investment advice.', 'No current methodology page claims demonstrated predictive skill.'],
    queryVariants: ['Can astrology value a company?', 'Can a corporate chart predict revenue?', 'Is a company horoscope investment advice?', 'What claims are prohibited in corporate astrology?'],
  }),
]

function parseAuthorityId(id: string): { family: AstrologyAuthorityFamily; slug: string } {
  const separator = id.indexOf(':')
  if (separator < 1) throw new Error(`Malformed astrology authority id: ${id}`)
  const family = id.slice(0, separator) as AstrologyAuthorityFamily
  if (!['calculation', 'timing', 'comparison', 'corporate', 'tradition', 'guide'].includes(family)) throw new Error(`Unknown astrology authority family: ${family}`)
  return { family, slug: id.slice(separator + 1) }
}

export function resolveAstrologyAuthority(id: string): AstrologyAuthorityReference | undefined {
  const { family, slug } = parseAuthorityId(id)
  if (family === 'calculation') {
    const value = getCalculationReference(slug)
    return value && { id, family, title: value.title, path: calculationReferencePath(value), establishes: value.definition, boundary: value.doesNotEstablish, status: value.implementationStatus }
  }
  if (family === 'timing') {
    const value = getTimingReference(slug)
    return value && { id, family, title: value.title, path: timingReferencePath(value), establishes: value.definition, boundary: value.doesNotEstablish, status: value.implementationStatus }
  }
  if (family === 'comparison') {
    const value = getTropicalSiderealComparison(slug)
    return value && { id, family, title: value.title, path: tropicalSiderealComparisonPath(value), establishes: value.sharedFacts, boundary: value.prohibitedSynthesis, status: value.empiricalStatus }
  }
  if (family === 'corporate') {
    const value = getCorporateMundaneReference(slug)
    return value && { id, family, title: value.title, path: corporateMundaneReferencePath(value), establishes: value.method, boundary: value.doesNotEstablish, status: value.empiricalStatus }
  }
  if (family === 'tradition') {
    const value = getAstrologyTradition(slug)
    return value && {
      id, family, title: value.name, path: astrologyTraditionPath(value), establishes: value.description,
      boundary: value.unpopulatedReason ?? 'The registry documents a named interpretive tradition. It does not claim that any rule predicts an outcome.',
      status: getRulesForTradition(value.id).length > 0 ? 'documented-unvalidated-tradition' : 'registered-rules-withheld',
    }
  }
  const value = CELESTIAL_GUIDE_LIST.find((guide) => guide.path.endsWith(`/${slug}`))
  return value && { id, family, title: value.title, path: value.path, establishes: value.summary, boundary: value.interpretationBoundary, status: 'public-method-guide' }
}

function codeUnitOrder(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0 }

function relatedSlugsFor(draft: AstrologyAnswerDraft): string[] {
  const authorities = new Set(draft.authorityIds)
  return ANSWER_DRAFTS
    .filter((candidate) => candidate.slug !== draft.slug)
    .map((candidate) => ({
      slug: candidate.slug,
      score: candidate.authorityIds.filter((id) => authorities.has(id)).length * 10 + (candidate.category === draft.category ? 3 : 0) + (candidate.frame === draft.frame ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score || codeUnitOrder(left.slug, right.slug))
    .slice(0, 3)
    .map(({ slug }) => slug)
}

function empiricalStatus(frame: AstrologyAnswerFrame): AstrologyAnswer['empiricalStatus'] {
  if (frame === 'tradition-description') return 'documented-unvalidated-tradition'
  if (frame === 'frame-comparison') return 'parallel-unvalidated-models'
  return 'methodological-not-predictive'
}

export const ASTROLOGY_ANSWERS: readonly AstrologyAnswer[] = ANSWER_DRAFTS.map((draft) => ({
  ...draft,
  relatedSlugs: relatedSlugsFor(draft),
  empiricalStatus: empiricalStatus(draft.frame),
}))

const answerBySlug = new Map(ASTROLOGY_ANSWERS.map((answer) => [answer.slug, answer]))

export function astrologyAnswerPath(answer: Pick<AstrologyAnswer, 'slug'>): string { return `${ASTROLOGY_ANSWER_GRAPH_PATH}/${answer.slug}` }
export function getAstrologyAnswer(slug: string): AstrologyAnswer | undefined { return answerBySlug.get(slug) }
export function getAstrologyAnswerAuthorities(answer: AstrologyAnswer): AstrologyAuthorityReference[] {
  return answer.authorityIds.map(resolveAstrologyAuthority).filter((value): value is AstrologyAuthorityReference => value !== undefined)
}
export function getAstrologyAnswersForAuthority(authorityId: string): AstrologyAnswer[] {
  return ASTROLOGY_ANSWERS.filter((answer) => answer.authorityIds.includes(authorityId))
}

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const QUERY_STOPWORDS = new Set(['about', 'and', 'are', 'astrology', 'can', 'chart', 'does', 'for', 'from', 'have', 'how', 'into', 'should', 'that', 'the', 'this', 'what', 'when', 'which', 'why', 'with', 'your'])
function tokens(value: string): string[] { return [...new Set(normalized(value).split(' ').filter((token) => token.length > 2 && !QUERY_STOPWORDS.has(token)))] }

export interface AstrologyAnswerSearchResult { answer: AstrologyAnswer; score: number; matchedTokens: readonly string[] }

export function searchAstrologyAnswers(query: string, limit = 5): AstrologyAnswerSearchResult[] {
  const normalizedQuery = normalized(query)
  const queryTokens = tokens(query)
  if (!normalizedQuery || queryTokens.length === 0 || limit <= 0) return []
  return ASTROLOGY_ANSWERS.map((answer) => {
    const variants = [answer.question, ...answer.queryVariants]
    const document = normalized([answer.question, answer.shortTitle, answer.directAnswer, ...answer.queryVariants].join(' '))
    const matchedTokens = queryTokens.filter((token) => document.split(' ').includes(token))
    const exact = variants.some((variant) => normalized(variant) === normalizedQuery) ? 100 : 0
    const phrase = document.includes(normalizedQuery) ? 30 : 0
    return { answer, score: exact + phrase + matchedTokens.length * 5, matchedTokens }
  })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || codeUnitOrder(left.answer.slug, right.answer.slug))
    .slice(0, Math.min(limit, 20))
}

export const ASTROLOGY_ANSWER_QUALITY = ASTROLOGY_ANSWERS.map((answer) => {
  const authorities = getAstrologyAnswerAuthorities(answer)
  const families = new Set(authorities.map((authority) => authority.family))
  const blockers = [
    ...(authorities.length !== answer.authorityIds.length ? ['unresolved-authority'] : []),
    ...(authorities.length < 3 ? ['insufficient-authorities'] : []),
    ...(families.size < 2 ? ['single-family-paraphrase'] : []),
    ...(answer.directAnswer.length < 220 ? ['thin-direct-answer'] : []),
    ...(answer.queryVariants.length !== 4 ? ['query-coverage-incomplete'] : []),
    ...(answer.distinctions.length < 3 ? ['distinctions-incomplete'] : []),
    ...(answer.limitations.length < 2 ? ['limitations-incomplete'] : []),
    ...(answer.relatedSlugs.length !== 3 ? ['related-graph-incomplete'] : []),
  ]
  return { slug: answer.slug, eligible: blockers.length === 0, blockers, authorityCount: authorities.length, authorityFamilyCount: families.size, boundedQuestionCount: answer.queryVariants.length }
})

export const ASTROLOGY_ANSWER_PUBLIC_REGISTRY = {
  schemaVersion: ASTROLOGY_ANSWER_GRAPH_VERSION,
  releasedOn: ASTROLOGY_ANSWER_GRAPH_DATE,
  status: 'prepared-not-deployed',
  scope: 'Question-led projections over existing public authority contracts; no new empirical or predictive claims.',
  boundaries: {
    celestialFacts: 'Astronomical and civil-time inputs are calculation facts only under their declared versions and uncertainty.',
    traditions: 'Interpretive rules are documented as tradition-relative and empirically unvalidated.',
    evaluation: 'Performance claims require prospective, preregistered comparison against a baseline.',
    personalization: 'The registry does not provide personalized predictions, medical advice, legal advice, or investment advice.',
  },
  counts: {
    topics: ASTROLOGY_ANSWERS.length,
    boundedQuestions: ASTROLOGY_ANSWERS.reduce((sum, answer) => sum + answer.queryVariants.length, 0),
    authorityLinks: ASTROLOGY_ANSWERS.reduce((sum, answer) => sum + answer.authorityIds.length, 0),
  },
  answers: ASTROLOGY_ANSWERS.map((answer) => ({
    slug: answer.slug,
    path: astrologyAnswerPath(answer),
    category: answer.category,
    frame: answer.frame,
    question: answer.question,
    queryVariants: answer.queryVariants,
    directAnswer: answer.directAnswer,
    practicalUse: answer.practicalUse,
    distinctions: answer.distinctions,
    limitations: answer.limitations,
    empiricalStatus: answer.empiricalStatus,
    relatedPaths: answer.relatedSlugs.map((slug) => `${ASTROLOGY_ANSWER_GRAPH_PATH}/${slug}`),
    authorities: getAstrologyAnswerAuthorities(answer),
  })),
} as const

export const ASTROLOGY_ANSWER_REGISTRY_DIGEST = provenanceDigest(ASTROLOGY_ANSWER_PUBLIC_REGISTRY)

export function assertAstrologyAnswerIntegrity(): void {
  if (ASTROLOGY_ANSWERS.length !== cohort.topicCount) throw new Error('Astrology answer count diverged from its frozen cohort.')
  if (ASTROLOGY_ANSWERS.map((answer) => answer.slug).join('|') !== cohort.topicSlugs.join('|')) throw new Error('Astrology answer cohort identity or order changed.')
  if (new Set(ASTROLOGY_ANSWERS.map((answer) => answer.slug)).size !== ASTROLOGY_ANSWERS.length) throw new Error('Astrology answer slugs must be unique.')
  if (ASTROLOGY_ANSWER_QUALITY.some((quality) => !quality.eligible)) throw new Error(`Astrology answer quality gate refused: ${ASTROLOGY_ANSWER_QUALITY.filter((quality) => !quality.eligible).map((quality) => `${quality.slug}:${quality.blockers.join(',')}`).join('; ')}`)
  const allLegacyIds = new Set([
    ...CALCULATION_REFERENCES.map((value) => `calculation:${value.slug}`),
    ...TIMING_REFERENCES.map((value) => `timing:${value.slug}`),
    ...TROPICAL_SIDEREAL_COMPARISONS.map((value) => `comparison:${value.slug}`),
    ...CORPORATE_MUNDANE_REFERENCES.map((value) => `corporate:${value.slug}`),
    ...ASTROLOGY_TRADITIONS.map((value) => `tradition:${value.id}`),
    ...CELESTIAL_GUIDE_LIST.map((value) => `guide:${value.path.split('/').at(-1)}`),
  ])
  for (const answer of ASTROLOGY_ANSWERS) {
    for (const authorityId of answer.authorityIds) if (!allLegacyIds.has(authorityId)) throw new Error(`Unknown authority ${authorityId} on ${answer.slug}.`)
  }
}

assertAstrologyAnswerIntegrity()
