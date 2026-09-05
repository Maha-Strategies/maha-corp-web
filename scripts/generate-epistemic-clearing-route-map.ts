import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import demand from '../content/scaling/gsc-demand-signals-2026-08-28.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import { provenanceDigest, sha256Hex } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OUTPUT_JSON = resolve(ROOT, 'content/scaling/epistemic-clearing-route-candidates-v1.json')
const OUTPUT_MD = resolve(ROOT, 'docs/operations/scaling-to-2000-candidate-map.md')

type LaneId =
  | 'evidence-clearing'
  | 'mathematics-astronomy'
  | 'tamil-religion'
  | 'astrology-infrastructure'
  | 'machine-integrations'
  | 'cross-domain-synthesis'

type DemandCluster = keyof typeof demand.clusters
type CommercialAction = 'evidence-preflight' | 'evidence-dossier' | 'licensed-retrieval' | 'provenance-receipt' | 'none'

interface Seed {
  lane: LaneId
  subcategory: string
  proposedPath: string
  title: string
  searchIntent: string
  demandClusters: readonly DemandCluster[]
  authorityFamily: string
  sourceCandidateClass: string
  lens: string
  commercialAction: CommercialAction
  canonicalSlugStatus?: 'stable-candidate' | 'provisional-until-source-boundary-inspection'
}

interface BookConcept {
  bookId: string
  bookTitle: string
  routeStatus: 'available' | 'operator-reported-offline'
  sourcePath: string
  locator: string
  concept: string
  matchPhrases: readonly string[]
  priorityWeight: number
}

const ALLOCATIONS: Readonly<Record<LaneId, number>> = {
  'evidence-clearing': 250,
  'mathematics-astronomy': 250,
  'tamil-religion': 200,
  'astrology-infrastructure': 150,
  'machine-integrations': 100,
  'cross-domain-synthesis': 50,
}

const LANE_LABELS: Readonly<Record<LaneId, string>> = {
  'evidence-clearing': 'Evidence clearing workflows',
  'mathematics-astronomy': 'Mathematics and astronomy',
  'tamil-religion': 'Tamil religion and textual traditions',
  'astrology-infrastructure': 'Astrology infrastructure',
  'machine-integrations': 'Machine integration surfaces',
  'cross-domain-synthesis': 'Cross-domain synthesis',
}

const SCORE_WEIGHTS = {
  searchDemand: 0.20,
  evidenceAvailability: 0.20,
  differentiation: 0.15,
  machineUtility: 0.20,
  commercialProximity: 0.20,
  duplicationSafety: 0.05,
} as const

const LANE_BASES: Readonly<Record<LaneId, {
  evidenceAvailability: number
  differentiation: number
  machineUtility: number
  commercialProximity: number
  duplicationRisk: number
}>> = {
  'evidence-clearing': { evidenceAvailability: 84, differentiation: 82, machineUtility: 94, commercialProximity: 96, duplicationRisk: 24 },
  'mathematics-astronomy': { evidenceAvailability: 91, differentiation: 68, machineUtility: 87, commercialProximity: 56, duplicationRisk: 22 },
  'tamil-religion': { evidenceAvailability: 78, differentiation: 96, machineUtility: 72, commercialProximity: 52, duplicationRisk: 18 },
  'astrology-infrastructure': { evidenceAvailability: 76, differentiation: 83, machineUtility: 85, commercialProximity: 61, duplicationRisk: 27 },
  'machine-integrations': { evidenceAvailability: 86, differentiation: 88, machineUtility: 98, commercialProximity: 98, duplicationRisk: 23 },
  'cross-domain-synthesis': { evidenceAvailability: 68, differentiation: 93, machineUtility: 89, commercialProximity: 75, duplicationRisk: 35 },
}

const EVIDENCE_CLASS_SCORE: Readonly<Record<string, number>> = {
  'existing governed corpus and public standards': 90,
  'formal reference with permanent identifiers': 96,
  'open institutional or observatory publication': 90,
  'open primary-text edition plus attributed scholarship': 82,
  'public astronomical data and deterministic ephemeris': 88,
  'public protocol specification and local conformance fixtures': 92,
  'multiple governed domain sources requiring typed comparison': 70,
}

/**
 * Book concepts are strategic prompts, never evidence for a factual page.
 * The Maha Principle remains in the map while its route is offline because the
 * manuscript still defines Maha's product and governance vocabulary. Its
 * higher weight raises differentiation and utility; it never changes an
 * evidence, review, release, or publication gate.
 */
const BOOK_CONCEPTS: readonly BookConcept[] = [
  {
    bookId: 'the-maha-principle', bookTitle: 'The Maha Principle', routeStatus: 'operator-reported-offline',
    sourcePath: 'content/books/the-maha-principle/The-Maha-Principle.md', locator: 'Chapter 7 — The Principle of Navigating Complexity',
    concept: 'three-system verification under complexity',
    matchPhrases: ['verification', 'evidence clearing', 'claim scope', 'source identity'], priorityWeight: 10,
  },
  {
    bookId: 'the-maha-principle', bookTitle: 'The Maha Principle', routeStatus: 'operator-reported-offline',
    sourcePath: 'content/books/the-maha-principle/The-Maha-Principle.md', locator: 'Chapter 6 — The Principle of Humane Governance',
    concept: 'humane governance and bounded authority',
    matchPhrases: ['governed release', 'authority', 'entitlement', 'bounded execution', 'rights and licensing'], priorityWeight: 10,
  },
  {
    bookId: 'the-maha-principle', bookTitle: 'The Maha Principle', routeStatus: 'operator-reported-offline',
    sourcePath: 'content/books/the-maha-principle/The-Maha-Principle.md', locator: 'Chapter 5 — The Principle of Strategy',
    concept: 'strategic timing and explicit allocation',
    matchPhrases: ['timing', 'time scales', 'ingress time', 'calendar', 'sidereal time'], priorityWeight: 10,
  },
  {
    bookId: 'the-maha-principle', bookTitle: 'The Maha Principle', routeStatus: 'operator-reported-offline',
    sourcePath: 'content/books/the-maha-principle/The-Maha-Principle.md', locator: 'Chapter 7 — Deliberate Noise and the Corruption of Evidence',
    concept: 'corrupted evidence and information discipline',
    matchPhrases: ['conflicting literature', 'metadata-only', 'machine-generated claim', 'historical inference'], priorityWeight: 10,
  },
  {
    bookId: 'the-maha-principle', bookTitle: 'The Maha Principle', routeStatus: 'operator-reported-offline',
    sourcePath: 'content/books/the-maha-principle/The-Maha-Principle.md', locator: 'Chapter 6 — Resilient Redundancy',
    concept: 'resilient redundancy and long-horizon governance',
    matchPhrases: ['version relationship', 'revision drift', 'canonical withdrawal', 'superseding claim', 'replay'], priorityWeight: 10,
  },
  {
    bookId: 'the-synthetic-self', bookTitle: 'The Synthetic Self', routeStatus: 'available',
    sourcePath: 'content/books/the-synthetic-self/the-synthetic-self.md', locator: 'Chapters 4–7 — data, alignment, black-box inspection, and human-machine work',
    concept: 'alignment and inspectable machine action',
    matchPhrases: ['agent provenance', 'mcp tool output', 'enterprise mcp gateway', 'custom enterprise agent', 'machine-generated claim'], priorityWeight: 7,
  },
  {
    bookId: 'the-orbital-mind', bookTitle: 'The Orbital Mind', routeStatus: 'available',
    sourcePath: 'content/books/the-orbital-mind/the-orbital-mind.md', locator: 'Parts IV–V — orbital dynamics, formalization, and predictions that could lose',
    concept: 'reference frames, formalization, and falsifiability',
    matchPhrases: ['reference frames', 'prospective evaluation', 'inference boundary', 'formal proof', 'uncertainty transfer'], priorityWeight: 7,
  },
  {
    bookId: 'the-cosmic-recursion', bookTitle: 'The Cosmic Recursion', routeStatus: 'available',
    sourcePath: 'content/books/the-cosmic-recursion/THE-COSMIC-RECURSION-manuscript.md', locator: 'Compression, memory, and what survives transformation',
    concept: 'compression with preserved provenance',
    matchPhrases: ['information theory', 'provenance', 'version', 'digest-bound'], priorityWeight: 6,
  },
  {
    bookId: 'the-borrowed-light', bookTitle: 'The Borrowed Light', routeStatus: 'available',
    sourcePath: 'content/books/the-borrowed-light/introduction.md', locator: 'Introduction and technical appendices — relational physics and model boundaries',
    concept: 'relational models without category transfer',
    matchPhrases: ['dimensional analysis', 'cross-domain', 'calculation and measurement transfer'], priorityWeight: 6,
  },
  {
    bookId: 'the-volcanic-engine', bookTitle: 'The Volcanic Engine', routeStatus: 'available',
    sourcePath: 'content/books/the-volcanic-engine/The-Volcanic-Engine-Introduction.md', locator: 'The Unreadable Machine — measurement, inference, and warning',
    concept: 'measurement, inference, uncertainty, and warning',
    matchPhrases: ['measurement method', 'detector calibration', 'uncertainty', 'inference boundary'], priorityWeight: 6,
  },
  {
    bookId: 'the-unfinished-species', bookTitle: 'The Unfinished Species', routeStatus: 'available',
    sourcePath: 'content/books/the-unfinished-species/The-Unfinished-Species-FULL.md', locator: 'Parts I–IV — selection, constraint, interface, and computational tools',
    concept: 'selection, constraint, and responsible intervention',
    matchPhrases: ['biomolecular claim', 'causal inference', 'counterfactuals', 'boundary adequacy'], priorityWeight: 6,
  },
  {
    bookId: 'the-imagined-life', bookTitle: 'The Imagined Life', routeStatus: 'available',
    sourcePath: 'content/books/the-imagined-life/the-imagined-life.md', locator: 'Sleep, measurement, interpretation, and the limits of external observation',
    concept: 'measurement without overclaiming inner experience',
    matchPhrases: ['neuromorphic', 'bioelectronic', 'observable', 'inference boundary'], priorityWeight: 6,
  },
] as const

const EVIDENCE_SCENARIOS = [
  'DOI version relationship', 'repository manuscript versus version of record', 'retracted or corrected article',
  'living web page revision', 'government report version', 'standards revision', 'translated primary text',
  'manuscript witness', 'figure-only quantitative claim', 'table-derived measurement', 'abstract-only evidence',
  'metadata-only record', 'inaccessible publisher page', 'preprint to version-of-record transition', 'corrigendum binding',
  'conflicting literature', 'negative result', 'uncertainty interval', 'effect size', 'deterministic calculation receipt',
  'code and data version', 'random seed', 'container image', 'SLURM job', 'Qiskit run', 'formal proof',
  'machine-generated claim', 'MCP tool output', 'agent provenance', 'release revision drift', 'canonical withdrawal',
  'superseding claim', 'rights and licensing', 'first-party vendor claim', 'product performance claim',
  'historical inference', 'theological claim', 'clinical claim', 'legal or regulatory claim', 'financial forecast',
  'quantum claim', 'semiconductor claim', 'neuromorphic claim', 'astronomy claim', 'mathematics claim',
  'astrology claim', 'Tamil source claim', 'biomolecular claim', 'fusion claim', 'advanced-materials claim',
] as const

const EVIDENCE_LENSES = [
  ['source-identity', 'source identity', 'How should source identity be established for'],
  ['locator-sufficiency', 'locator sufficiency', 'What exact locator is sufficient for'],
  ['claim-scope', 'claim scope', 'What claim scope does the evidence permit for'],
  ['conflict-and-uncertainty', 'conflict and uncertainty', 'How should conflict and uncertainty be recorded for'],
  ['governed-release-and-retrieval', 'governed release and retrieval', 'When may a governed system release and retrieve'],
] as const

const MATH_SUBJECTS = [
  'angle normalization', 'spherical coordinates', 'uncertainty propagation', 'Bayesian updating', 'graph theory',
  'interpolation', 'root finding', 'numerical integration', 'error functions', 'gamma functions', 'condition numbers',
  'eigenvalues', 'constrained optimization', 'probability distributions', 'Monte Carlo methods',
  'ordinary differential equation solvers', 'Fourier transforms', 'convolution', 'information theory',
  'cryptographic commitments', 'causal inference', 'counterfactuals', 'dimensional analysis', 'interval arithmetic',
  'automatic differentiation',
] as const

const MATH_LENSES = [
  ['definition-boundary', 'definition and boundary', 'What is the precise definition and boundary of'],
  ['derivation', 'derivation', 'How is the core result derived for'],
  ['worked-example', 'worked example', 'What is a reproducible worked example of'],
  ['uncertainty', 'uncertainty', 'How should uncertainty be represented in'],
  ['implementation-verification', 'implementation verification', 'How can an implementation be verified for'],
] as const

const ASTRONOMY_SUBJECTS = [
  'celestial reference frames', 'astronomical time scales', 'precession and nutation', 'stellar parallax',
  'proper motion', 'radial velocity', 'photometry', 'spectroscopy', 'transit detection',
  'radial-velocity exoplanet detection', 'gravitational microlensing', 'direct imaging', 'gravitational waves',
  'active galactic nuclei', 'stellar evolution', 'compact objects', 'cosmological redshift', 'cosmic distance ladder',
  'telescope angular resolution', 'point-spread functions', 'signal-to-noise ratio', 'detector calibration',
  'planetary ephemerides', 'orbit determination', 'survey selection effects',
] as const

const ASTRONOMY_LENSES = [
  ['observable', 'observable', 'What is directly observed when measuring'],
  ['measurement-method', 'measurement method', 'How is a measurement made for'],
  ['calibration', 'calibration', 'What calibration chain is required for'],
  ['uncertainty', 'uncertainty', 'Which uncertainties control'],
  ['inference-boundary', 'inference boundary', 'What can and cannot be inferred from'],
] as const

const TOLKAPPIYAM_CONCEPTS = [
  'mullai landscape', 'kurinci landscape', 'marutam landscape', 'neytal landscape', 'palai transformation',
  'akam interior poetics', 'puram public poetics', 'mutal first elements', 'karu background elements',
  'uri human situation', 'tinai classification', 'season and landscape', 'time of day and landscape',
  'flora as poetic marker', 'fauna as poetic marker', 'occupation as poetic marker', 'deity as karu element',
  'mullai and patient waiting', 'kurinci and lovers union', 'marutam and domestic conflict',
  'neytal and anxious separation', 'palai and dangerous journey', 'mayon in Akattinaiyiyal',
  'ceyon in Akattinaiyiyal', 'ventan in Akattinaiyiyal', 'varunan in Akattinaiyiyal',
  'korravai and palai reception', 'landscape classification versus worship', 'commentary on the deity line',
  'translation choices in the deity line',
] as const

const DIVINE_NAMES = [
  'Mayon', 'Mal', 'Tirumal', 'Kannan', 'Narayana', 'Netumal', 'Mayavan', 'Govinda', 'Madhava', 'Kesava',
  'Damodara', 'Vamana', 'Narasimha', 'Nambi', 'Ceyon', 'Murukan', 'Ventan', 'Varunan', 'Korravai',
  'Valiyon', 'Nappinnai', 'Lakshmi', 'Sadagopan', 'Alvar', 'Tulasi-bearing lord',
] as const

const LANDSCAPE_RELATIONS = [
  'Mayon and mullai', 'Ceyon and kurinci', 'Ventan and marutam', 'Varunan and neytal', 'Korravai and palai',
  'Mayon and pastoral occupation', 'Murukan and mountain ecology', 'Indra and cultivated land',
  'Varuna and littoral livelihood', 'Korravai and journey danger', 'mullai and evening',
  'kurinci and midnight', 'marutam and dawn', 'neytal and dusk', 'palai and midday heat',
  'landscape deity and poetic convention', 'landscape deity and ritual inference', 'landscape deity and later temple identity',
  'landscape ecology and historical geography', 'five landscapes and later reception',
] as const

const TRANSLATION_COMPARISONS = [
  'Mayon versus Mal in translation', 'Tirumal versus Vishnu in translation', 'Kannan versus Krishna in translation',
  'Ceyon versus Murukan in translation', 'Ventan versus Indra in translation', 'Varunan versus Varuna in translation',
  'Korravai versus Durga in translation', 'mullai as forest versus pastoral tract',
  'kurinci as mountain versus union landscape', 'palai as desert versus transformed terrain',
  'deity versus presiding figure', 'primary wording versus commentator gloss', 'poetic epithet versus proper name',
  'devotional address versus identity statement', 'translation equivalence versus historical continuity',
] as const

const RECEPTION_LINEAGES = [
  'Mayon to Tirumal', 'Mayon to Mayavan', 'Kannan in Alvar reception', 'Narayana in Tiruvaymoli',
  'mullai imagery in later bhakti', 'Paripatal Tirumal in later reception', 'sacred hill to temple localization',
  'Nappinnai in later Vaishnava reception', 'Tamil epithets in Sanskritic identification',
  'Sangam landscape grammar in devotional poetry',
] as const

const TEXTUAL_METHODS = [
  'primary text and translation separation', 'edition identity and version control', 'printed unit boundary verification',
  'commentary attribution', 'historical inference labelling', 'theological claim separation', 'divine-name disambiguation',
  'cross-century reception mapping', 'manuscript and printed-edition authority', 'machine answers from layered textual evidence',
] as const

const ASTROLOGY_REFERENCE_CASES = [
  'UTC and local time', 'Julian day', 'Delta T', 'geocentric and topocentric positions', 'tropical and sidereal zodiacs',
  'ayanamsa selection', 'ecliptic and equatorial coordinates', 'whole-sign and quadrant houses',
  'observer latitude and longitude', 'atmospheric refraction', 'apparent and mean position', 'true and mean lunar node',
  'precession', 'nutation', 'stellar aberration', 'light-time correction', 'ephemeris version', 'calendar conversion',
  'daylight-saving transitions', 'polar latitudes', 'rise and set conventions', 'civil twilight',
  'local sidereal time', 'east-west longitude sign', 'coordinate precision', 'birth-time uncertainty',
  'historical time zones', 'leap seconds', 'Gregorian and Julian calendar boundary', 'missing location inputs',
] as const

const ASTROLOGY_CALCULATIONS = [
  'Julian day', 'Greenwich sidereal time', 'local sidereal time', 'ascendant longitude', 'midheaven longitude',
  'whole-sign house assignment', 'equal-house cusp', 'ayanamsa subtraction', 'longitude normalization',
  'minimum angular separation', 'aspect orb', 'declination', 'ecliptic-to-equatorial conversion',
  'topocentric parallax', 'rise time', 'set time', 'zodiacal ingress time', 'station time', 'lunation phase',
  'eclipse separation', 'nakshatra index', 'tithi index', 'yoga index', 'karana index', 'weekday at sunrise',
  'planetary hour', 'solar return time', 'lunar return time', 'annual profection index', 'dasha elapsed fraction',
] as const

const ASTROLOGY_EVALUATIONS = [
  'event-timing forecast', 'binary outcome forecast', 'multi-class outcome forecast', 'ranked-choice forecast',
  'market-regime forecast', 'weather claim', 'health claim', 'relationship claim', 'career claim', 'electional claim',
  'mundane-ingress claim', 'retrograde-period claim', 'lunation claim', 'eclipse claim', 'planetary-return claim',
  'house-system comparison', 'ayanamsa comparison', 'tropical-sidereal comparison', 'topocentric-geocentric comparison',
  'transit-orb comparison', 'birth-time sensitivity', 'location sensitivity', 'ephemeris sensitivity',
  'historical backtest', 'prospective preregistration', 'null-result reporting', 'calibration curve', 'Brier score',
  'base-rate benchmark', 'holdout-period evaluation',
] as const

const TRADITION_MAPS = [
  'Hellenistic and modern Western houses', 'tropical and sidereal reference frames', 'Lahiri and Raman ayanamsas',
  'Parashari and Jaimini rule systems', 'whole-sign and Placidus houses', 'mean and true lunar nodes',
  'nakshatra and zodiacal sign frameworks', 'tithi and lunar phase', 'dasha and annual profection timing',
  'transits and primary directions', 'solar return and varshaphala', 'electional and muhurta methods',
  'mundane ingress and natal interpretation', 'topocentric and geocentric calculation', 'traditional and modern rulerships',
  'aspect doctrine across traditions', 'essential dignity and shadbala', 'lots and Arabic parts',
  'fixed stars across traditions', 'interpretive rule and empirical hypothesis',
] as const

const PROVENANCE_GUIDES = [
  'birth-time provenance', 'location provenance', 'time-zone database version', 'ephemeris file version',
  'ayanamsa identifier', 'house-system identifier', 'calculation-kernel version', 'tradition rule-set version',
  'input redaction and privacy', 'digest-bound chart reproduction',
] as const

const MACHINE_SCENARIOS = [
  'enterprise MCP gateway', 'Claude Desktop client', 'Cursor client', 'custom enterprise agent', 'CARP seller',
  'CABEZON buyer', 'Evidence Preflight client', 'Evidence Dossier retrieval', 'calculation receipt retrieval',
  'runtime witness receipt', 'SLURM job agent', 'Docker job agent', 'Qiskit job agent', 'webhook consumer',
  'batch API client', 'multi-tenant gateway', 'offline verifier', 'release registry reader', 'entitlement service',
  'audit export client',
] as const

const MACHINE_LENSES = [
  ['identity-binding', 'identity binding', 'How should identity be bound for a'],
  ['entitlement-decision', 'entitlement decision', 'How should entitlement be decided for a'],
  ['quota-and-metering', 'quota and metering', 'How should quota and metering work for a'],
  ['bounded-execution', 'bounded execution', 'How should execution be bounded for a'],
  ['receipt-and-acknowledgement', 'receipt and acknowledgement', 'How should delivery be receipted and acknowledged for a'],
] as const

const BRIDGES = [
  ['astronomy-astrology', 'astronomy and astrology', ['astronomy', 'astrology']],
  ['mathematics-uncertainty', 'mathematics and uncertainty', ['mathematics', 'evidence']],
  ['religion-textual-authority', 'religion and textual authority', ['religion', 'evidence']],
  ['quantum-formal-proof', 'quantum science and formal proof', ['mathematics', 'machine']],
  ['semiconductor-provenance', 'semiconductor evidence and provenance', ['semiconductor', 'evidence']],
  ['neuromorphic-evaluation', 'neuromorphic systems and evaluation', ['neuromorphic', 'evidence']],
  ['biomolecular-dossier', 'biomolecular claims and Evidence Dossiers', ['evidence']],
  ['fusion-computational-witness', 'fusion computation and runtime witnessing', ['evidence', 'machine']],
  ['advanced-materials-alignment', 'advanced materials and source alignment', ['evidence']],
  ['mcp-licensed-evidence', 'MCP and licensed evidence', ['machine', 'evidence']],
] as const satisfies readonly (readonly [string, string, readonly DemandCluster[]])[]

const BRIDGE_DIMENSIONS = [
  ['terminology-boundary', 'terminology boundary', 'How should terminology be bounded between'],
  ['source-contract', 'source contract', 'What source contract governs claims crossing'],
  ['calculation-and-measurement-transfer', 'calculation and measurement transfer', 'When may calculations or measurements transfer between'],
  ['uncertainty-transfer', 'uncertainty transfer', 'How must uncertainty be preserved between'],
  ['machine-retrieval-contract', 'machine retrieval contract', 'How should a machine retrieve evidence spanning'],
] as const

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function cross(
  lane: LaneId,
  subcategory: string,
  prefix: string,
  subjects: readonly string[],
  lenses: readonly (readonly [string, string, string])[],
  demandClusters: readonly DemandCluster[],
  authorityFamily: string,
  sourceCandidateClass: string,
  commercialAction: CommercialAction,
): Seed[] {
  return subjects.flatMap((subject) => lenses.map(([lensSlug, lensLabel, question]) => ({
    lane,
    subcategory,
    proposedPath: `${prefix}/${slug(subject)}-${lensSlug}`,
    title: `${subject[0].toUpperCase()}${subject.slice(1)}: ${lensLabel}`,
    searchIntent: `${question} ${subject}?`,
    demandClusters,
    authorityFamily,
    sourceCandidateClass,
    lens: lensSlug,
    commercialAction,
    canonicalSlugStatus: 'stable-candidate' as const,
  })))
}

function simpleSeeds(args: {
  lane: LaneId
  subcategory: string
  prefix: string
  subjects: readonly string[]
  titleSuffix: string
  question: (subject: string, index: number) => string
  demandClusters: readonly DemandCluster[]
  authorityFamily: string
  sourceCandidateClass: string
  lens: string
  commercialAction: CommercialAction
  provisional?: boolean
}): Seed[] {
  return args.subjects.map((subject, index) => ({
    lane: args.lane,
    subcategory: args.subcategory,
    proposedPath: `${args.prefix}/${slug(subject)}`,
    title: `${subject}${args.titleSuffix}`,
    searchIntent: args.question(subject, index),
    demandClusters: args.demandClusters,
    authorityFamily: args.authorityFamily,
    sourceCandidateClass: args.sourceCandidateClass,
    lens: args.lens,
    commercialAction: args.commercialAction,
    canonicalSlugStatus: args.provisional
      ? 'provisional-until-source-boundary-inspection' as const
      : 'stable-candidate' as const,
  }))
}

function buildSeeds(): Seed[] {
  const seeds: Seed[] = []

  seeds.push(...cross(
    'evidence-clearing', 'claim clearance scenario', '/knowledge/epistemic-system/clearing',
    EVIDENCE_SCENARIOS, EVIDENCE_LENSES, ['evidence'], 'Maha governance contracts plus the governing public source',
    'existing governed corpus and public standards', 'evidence-preflight',
  ))

  seeds.push(...cross(
    'mathematics-astronomy', 'formal mathematics', '/knowledge/mathematics/clearing', MATH_SUBJECTS, MATH_LENSES,
    ['mathematics'], 'DLMF, standards, textbooks, and reproducible kernels',
    'formal reference with permanent identifiers', 'provenance-receipt',
  ))
  seeds.push(...cross(
    'mathematics-astronomy', 'observational astronomy', '/knowledge/astronomy/clearing', ASTRONOMY_SUBJECTS,
    ASTRONOMY_LENSES, ['astronomy'], 'NASA, JPL, IAU, observatories, and peer-reviewed open literature',
    'open institutional or observatory publication', 'provenance-receipt',
  ))

  const continuationUnits = Array.from({ length: 50 }, (_, i) => `Tiruvaymoli continuation unit ${String(i + 47).padStart(3, '0')}`)
  const paripatalUnits = Array.from({ length: 40 }, (_, i) => `Paripatal passage unit ${String(i + 1).padStart(2, '0')}`)
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'Tiruvaymoli complete-unit guide',
    prefix: '/knowledge/religion/clearing/tiruvaymoli', subjects: continuationUnits, titleSuffix: '',
    question: (subject) => `What does the exact printed boundary of ${subject} establish, and what remains commentary?`,
    demandClusters: ['religion'], authorityFamily: 'Project Madurai printed edition plus attributed scholarship',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'passage-guide',
    commercialAction: 'none', provisional: true,
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'Paripatal passage guide',
    prefix: '/knowledge/religion/clearing/paripatal', subjects: paripatalUnits, titleSuffix: '',
    question: (subject) => `Which names, places, speakers, and claims occur in ${subject}?`,
    demandClusters: ['religion'], authorityFamily: 'Project Madurai Paripatal edition plus named translations and scholarship',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'passage-guide',
    commercialAction: 'none', provisional: true,
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'Tolkappiyam concept guide', prefix: '/knowledge/religion/clearing/tolkappiyam',
    subjects: TOLKAPPIYAM_CONCEPTS, titleSuffix: ' in the Tolkappiyam',
    question: (subject) => `How does the inspected Tolkappiyam passage define or use ${subject}?`,
    demandClusters: ['religion'], authorityFamily: 'Named Tolkappiyam edition, translation, and commentary',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'concept-and-passage', commercialAction: 'none',
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'divine-name occurrence map', prefix: '/knowledge/religion/clearing/divine-names',
    subjects: DIVINE_NAMES, titleSuffix: ' occurrence and identity map',
    question: (subject) => `Where does ${subject} occur, and which identity relationships are textual, translated, or inferred?`,
    demandClusters: ['religion'], authorityFamily: 'Inspected Tamil primary texts, translations, and reception scholarship',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'identity-map', commercialAction: 'none',
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'landscape and deity relationship', prefix: '/knowledge/religion/clearing/landscape-deities',
    subjects: LANDSCAPE_RELATIONS, titleSuffix: ' evidence map',
    question: (subject) => `What is directly established, translated, and later inferred about ${subject}?`,
    demandClusters: ['religion'], authorityFamily: 'Tolkappiyam, Sangam texts, named translations, and historical scholarship',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'relationship-map', commercialAction: 'none',
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'translation and commentary comparison', prefix: '/knowledge/religion/clearing/translation',
    subjects: TRANSLATION_COMPARISONS, titleSuffix: ' evidence comparison',
    question: (subject) => `Which differences in ${subject} come from primary wording, translation, or commentary?`,
    demandClusters: ['religion'], authorityFamily: 'Paired editions, named translations, and attributed commentary',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'bounded-comparison', commercialAction: 'none',
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'Alvar reception lineage', prefix: '/knowledge/religion/clearing/reception',
    subjects: RECEPTION_LINEAGES, titleSuffix: ' reception lineage',
    question: (subject) => `Which links in ${subject} are attested, and which require historical inference?`,
    demandClusters: ['religion'], authorityFamily: 'Inspected primary passages plus reception-history scholarship',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'reception-lineage', commercialAction: 'none',
  }))
  seeds.push(...simpleSeeds({
    lane: 'tamil-religion', subcategory: 'textual evidence method', prefix: '/knowledge/religion/clearing/methods',
    subjects: TEXTUAL_METHODS, titleSuffix: ' for Tamil religious evidence',
    question: (subject) => `How should a governed answer apply ${subject}?`,
    demandClusters: ['religion', 'evidence'], authorityFamily: 'Maha textual-authority contract and named scholarly methods',
    sourceCandidateClass: 'existing governed corpus and public standards', lens: 'method', commercialAction: 'evidence-preflight',
  }))

  seeds.push(...simpleSeeds({
    lane: 'astrology-infrastructure', subcategory: 'input and reference-frame workflow',
    prefix: '/knowledge/astrology/workflows/reference-frames', subjects: ASTROLOGY_REFERENCE_CASES,
    titleSuffix: ' input workflow', question: (subject) => `Which inputs and conventions must be fixed for ${subject}?`,
    demandClusters: ['astrology', 'astronomy'], authorityFamily: 'IERS, IAU, JPL, tzdb, and versioned ephemeris documentation',
    sourceCandidateClass: 'public astronomical data and deterministic ephemeris', lens: 'input-workflow', commercialAction: 'provenance-receipt',
  }))
  seeds.push(...simpleSeeds({
    lane: 'astrology-infrastructure', subcategory: 'deterministic calculation receipt',
    prefix: '/knowledge/astrology/workflows/calculations', subjects: ASTROLOGY_CALCULATIONS,
    titleSuffix: ' calculation receipt', question: (subject) => `How can ${subject} be recomputed from versioned inputs?`,
    demandClusters: ['astrology', 'mathematics'], authorityFamily: 'Versioned astronomy references and Maha deterministic kernel',
    sourceCandidateClass: 'public astronomical data and deterministic ephemeris', lens: 'calculation-receipt', commercialAction: 'provenance-receipt',
  }))
  seeds.push(...simpleSeeds({
    lane: 'astrology-infrastructure', subcategory: 'uncertainty and sensitivity workflow',
    prefix: '/knowledge/astrology/workflows/sensitivity', subjects: ASTROLOGY_REFERENCE_CASES,
    titleSuffix: ' sensitivity analysis', question: (subject) => `How does uncertainty in ${subject} change deterministic outputs?`,
    demandClusters: ['astrology', 'mathematics'], authorityFamily: 'NIST uncertainty guidance and versioned astronomy references',
    sourceCandidateClass: 'public astronomical data and deterministic ephemeris', lens: 'sensitivity-analysis', commercialAction: 'provenance-receipt',
  }))
  seeds.push(...simpleSeeds({
    lane: 'astrology-infrastructure', subcategory: 'prospective evaluation protocol',
    prefix: '/knowledge/astrology/workflows/evaluation', subjects: ASTROLOGY_EVALUATIONS,
    titleSuffix: ' prospective evaluation protocol', question: (subject) => `How should a ${subject} be preregistered and evaluated against a baseline?`,
    demandClusters: ['astrology', 'evidence'], authorityFamily: 'Statistical evaluation standards and explicitly versioned tradition rules',
    sourceCandidateClass: 'existing governed corpus and public standards', lens: 'prospective-evaluation', commercialAction: 'evidence-dossier',
  }))
  seeds.push(...simpleSeeds({
    lane: 'astrology-infrastructure', subcategory: 'tradition decision map',
    prefix: '/knowledge/astrology/workflows/tradition-comparisons', subjects: TRADITION_MAPS,
    titleSuffix: ' decision map', question: (subject) => `Which choice points distinguish ${subject} without treating either as scientifically validated?`,
    demandClusters: ['astrology'], authorityFamily: 'Named tradition sources plus shared astronomical inputs',
    sourceCandidateClass: 'open primary-text edition plus attributed scholarship', lens: 'decision-map', commercialAction: 'none',
  }))
  seeds.push(...simpleSeeds({
    lane: 'astrology-infrastructure', subcategory: 'data provenance guide',
    prefix: '/knowledge/astrology/workflows/provenance', subjects: PROVENANCE_GUIDES,
    titleSuffix: ' provenance guide', question: (subject) => `What must a machine preserve for ${subject}?`,
    demandClusters: ['astrology', 'machine'], authorityFamily: 'Versioned data-provider documentation and Maha receipt contracts',
    sourceCandidateClass: 'public protocol specification and local conformance fixtures', lens: 'data-provenance', commercialAction: 'provenance-receipt',
  }))

  seeds.push(...cross(
    'machine-integrations', 'machine evidence lifecycle', '/developers/epistemic-clearing', MACHINE_SCENARIOS, MACHINE_LENSES,
    ['machine', 'evidence'], 'MCP/CARP contracts, provider documentation, and local conformance fixtures',
    'public protocol specification and local conformance fixtures', 'licensed-retrieval',
  ))

  for (const [bridgeSlug, bridgeLabel, clusters] of BRIDGES) {
    for (const [dimensionSlug, dimensionLabel, question] of BRIDGE_DIMENSIONS) {
      seeds.push({
        lane: 'cross-domain-synthesis', subcategory: 'typed epistemic bridge',
        proposedPath: `/knowledge/integrations/epistemic-clearing/${bridgeSlug}-${dimensionSlug}`,
        title: `${bridgeLabel}: ${dimensionLabel}`,
        searchIntent: `${question} ${bridgeLabel}?`, demandClusters: clusters,
        authorityFamily: 'The separately governed sources and contracts on both sides of the bridge',
        sourceCandidateClass: 'multiple governed domain sources requiring typed comparison', lens: dimensionSlug,
        commercialAction: dimensionSlug === 'machine-retrieval-contract' ? 'licensed-retrieval' : 'evidence-dossier',
        canonicalSlugStatus: 'stable-candidate',
      })
    }
  }

  return seeds
}

function normalize(value: string): string {
  return slug(value).replace(/-/g, ' ')
}

const OVERLAP_STOP_WORDS = new Set([
  'knowledge', 'clearing', 'workflow', 'workflows', 'evidence', 'epistemic', 'system', 'systems',
  'developers', 'developer', 'guide', 'guides', 'method', 'methods', 'what', 'which', 'when', 'where',
  'should', 'does', 'from', 'with', 'into', 'between', 'about', 'route', 'page', 'read',
])

function routeTokens(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !OVERLAP_STOP_WORDS.has(token)))
}

function duplicationEvidence(seed: Seed) {
  const candidateTokens = routeTokens(`${seed.proposedPath} ${seed.title}`)
  let nearestObservedRoute: string | null = null
  let containmentSimilarity = 0
  let bestIntersection = 0
  for (const path of observation.sitemapPaths as string[]) {
    const observedTokens = routeTokens(path)
    const intersection = [...candidateTokens].filter((token) => observedTokens.has(token)).length
    const denominator = Math.min(candidateTokens.size, observedTokens.size)
    const similarity = denominator === 0 ? 0 : intersection / denominator
    if (similarity > containmentSimilarity
      || (similarity === containmentSimilarity && intersection > bestIntersection)
      || (similarity === containmentSimilarity && intersection === bestIntersection && similarity > 0
        && (nearestObservedRoute === null || path < nearestObservedRoute))) {
      containmentSimilarity = similarity
      bestIntersection = intersection
      nearestObservedRoute = path
    }
  }
  return {
    exactCollision: nearestObservedRoute !== null && nearestObservedRoute === seed.proposedPath,
    nearestObservedRoute,
    containmentSimilarity: Number(containmentSimilarity.toFixed(3)),
    observedSurfaceSize: (observation.sitemapPaths as string[]).length,
    caveat: 'Similarity is a screening signal against the last observed sitemap, not proof that two pages answer the same intent.',
  }
}

function bookPriority(seed: Seed) {
  const haystack = normalize(`${seed.title} ${seed.searchIntent} ${seed.proposedPath} ${seed.lens}`)
  const matched = BOOK_CONCEPTS.filter((entry) =>
    entry.matchPhrases.some((phrase) => haystack.includes(normalize(phrase))),
  ).sort((a, b) => b.priorityWeight - a.priorityWeight
    || (a.bookId < b.bookId ? -1 : a.bookId > b.bookId ? 1 : 0)
    || (a.concept < b.concept ? -1 : a.concept > b.concept ? 1 : 0))
    .slice(0, 3)
  const mahaMatched = matched.some((entry) => entry.bookId === 'the-maha-principle')
  const otherBooks = new Set(matched.filter((entry) => entry.bookId !== 'the-maha-principle').map((entry) => entry.bookId)).size
  return {
    matched: matched.map((entry) => ({
      bookId: entry.bookId,
      bookTitle: entry.bookTitle,
      routeStatus: entry.routeStatus,
      sourcePath: entry.sourcePath,
      locator: entry.locator,
      concept: entry.concept,
      priorityWeight: entry.priorityWeight,
    })),
    priorityWeight: matched.reduce((sum, entry) => sum + entry.priorityWeight, 0),
    componentAdjustments: {
      differentiation: matched.length === 0 ? 0 : Math.min(10, (mahaMatched ? 8 : 4) + Math.min(2, otherBooks)),
      machineUtility: matched.length === 0 ? 0 : Math.min(5, (mahaMatched ? 3 : 2) + Math.min(2, otherBooks)),
      commercialProximity: mahaMatched ? 2 : 0,
    },
    evidentiaryRole: 'conceptual-priority-only',
    caveat: matched.length === 0
      ? 'No book-concept priority applied.'
      : 'Book concepts raise strategic priority only; the manuscript is not evidence for the candidate claim.',
  }
}

function demandScore(seed: Seed) {
  const haystack = normalize(`${seed.title} ${seed.searchIntent} ${seed.proposedPath}`)
  const matching = seed.demandClusters.flatMap((clusterId) => {
    const cluster = demand.clusters[clusterId]
    return cluster.signals
      .filter((signal) => signal.kind === 'query')
      .filter((signal) => {
        const phrase = normalize(signal.value)
        return phrase.length > 0 && haystack.includes(phrase)
      })
      .map((signal) => ({ cluster: clusterId, query: signal.value, impressions: signal.impressions }))
  })
  const unique = [...new Map(matching.map((item) => [`${item.cluster}:${item.query}`, item])).values()]
  if (unique.length > 0) {
    const impressions = unique.reduce((sum, item) => sum + item.impressions, 0)
    return {
      score: Math.min(100, 52 + Math.round(Math.log2(impressions + 1) * 8)),
      basis: 'observed-query' as const,
      observedImpressions: impressions,
      matchedSignals: unique,
    }
  }
  const adjacency = Math.max(...seed.demandClusters.map((cluster) => demand.clusters[cluster].adjacencyScore))
  return { score: adjacency, basis: 'adjacent-to-observed' as const, observedImpressions: 0, matchedSignals: [] }
}

function lensModifier(lens: string, dimension: 'differentiation' | 'machineUtility' | 'commercialProximity' | 'duplicationRisk'): number {
  const joined = lens.toLowerCase()
  if (dimension === 'machineUtility') {
    if (/receipt|implementation|retrieval|bounded-execution|provenance|calculation/.test(joined)) return 5
    if (/passage|occurrence/.test(joined)) return -5
  }
  if (dimension === 'commercialProximity') {
    if (/retrieval|entitlement|metering|release|dossier|preflight/.test(joined)) return 4
    if (/passage|observable|reception/.test(joined)) return -4
  }
  if (dimension === 'differentiation') {
    if (/identity|boundary|uncertainty|receipt|lineage/.test(joined)) return 3
  }
  if (dimension === 'duplicationRisk') {
    if (/passage|worked-example|calculation|receipt/.test(joined)) return -4
    if (/definition|comparison|concept/.test(joined)) return 4
  }
  return 0
}

function bounded(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function score(seed: Seed, books: ReturnType<typeof bookPriority>) {
  const demandResult = demandScore(seed)
  const base = LANE_BASES[seed.lane]
  const evidenceAvailability = EVIDENCE_CLASS_SCORE[seed.sourceCandidateClass] ?? base.evidenceAvailability
  const differentiation = bounded(base.differentiation + lensModifier(seed.lens, 'differentiation') + books.componentAdjustments.differentiation)
  const machineUtility = bounded(base.machineUtility + lensModifier(seed.lens, 'machineUtility') + books.componentAdjustments.machineUtility)
  const commercialProximity = bounded(base.commercialProximity + lensModifier(seed.lens, 'commercialProximity') + books.componentAdjustments.commercialProximity)
  const overlap = duplicationEvidence(seed)
  const duplicationRisk = bounded(base.duplicationRisk + lensModifier(seed.lens, 'duplicationRisk')
    + Math.round(overlap.containmentSimilarity * 35))
  const duplicationSafety = 100 - duplicationRisk
  const weightedTotal = Number((
    demandResult.score * SCORE_WEIGHTS.searchDemand
    + evidenceAvailability * SCORE_WEIGHTS.evidenceAvailability
    + differentiation * SCORE_WEIGHTS.differentiation
    + machineUtility * SCORE_WEIGHTS.machineUtility
    + commercialProximity * SCORE_WEIGHTS.commercialProximity
    + duplicationSafety * SCORE_WEIGHTS.duplicationSafety
  ).toFixed(2))
  return {
    searchDemand: demandResult.score,
    evidenceAvailability,
    differentiation,
    machineUtility,
    commercialProximity,
    duplicationRisk,
    duplicationSafety,
    weightedTotal,
    duplicationEvidence: overlap,
    demandEvidence: {
      basis: demandResult.basis,
      observedImpressions: demandResult.observedImpressions,
      matchedSignals: demandResult.matchedSignals,
      caveat: demandResult.basis === 'observed-query'
        ? 'The query appeared in the supplied export; this candidate is not a traffic forecast.'
        : 'The lane is adjacent to observed demand, but this exact intent has no measured query signal.',
    },
  }
}

function buildArtifact() {
  const seeds = buildSeeds()
  for (const [lane, expected] of Object.entries(ALLOCATIONS)) {
    const actual = seeds.filter((seed) => seed.lane === lane).length
    if (actual !== expected) throw new Error(`${lane} allocation is ${actual}, expected ${expected}`)
  }
  if (seeds.length !== 1000) throw new Error(`Generated ${seeds.length} candidates, expected 1000`)

  const scored = seeds.map((seed) => {
    const books = bookPriority(seed)
    return {
      candidateId: `route-candidate:${sha256Hex(seed.proposedPath).slice(0, 24)}`,
      ...seed,
      bookPriority: books,
      scores: score(seed, books),
      evidencePlan: {
        authorityFamily: seed.authorityFamily,
        sourceCandidateClass: seed.sourceCandidateClass,
        sourceIdentityStatus: 'not-started',
        contentInspectionStatus: 'not-started',
        locatorStatus: 'not-started',
        rightsStatus: 'not-started',
      },
      publication: {
        state: 'candidate-only',
        inspected: false,
        alignmentClear: false,
        exactRevisionReviewed: false,
        activeCanonicalRelease: false,
        compiled: false,
        crawlable: false,
      },
    }
  }).sort((a, b) => {
    const scoreOrder = b.scores.weightedTotal - a.scores.weightedTotal
    if (scoreOrder !== 0) return scoreOrder
    return a.proposedPath < b.proposedPath ? -1 : a.proposedPath > b.proposedPath ? 1 : 0
  })

  const ranked = scored.map((candidate, index) => ({ ...candidate, rank: index + 1, wave: Math.floor(index / 250) + 1 }))
  const laneSummary = Object.entries(ALLOCATIONS).map(([lane, count]) => {
    const candidates = ranked.filter((candidate) => candidate.lane === lane)
    return {
      lane,
      label: LANE_LABELS[lane as LaneId],
      count,
      averageScore: Number((candidates.reduce((sum, candidate) => sum + candidate.scores.weightedTotal, 0) / count).toFixed(2)),
      observedQueryCandidates: candidates.filter((candidate) => candidate.scores.demandEvidence.basis === 'observed-query').length,
    }
  })
  const waveSummary = [1, 2, 3, 4].map((wave) => ({
    wave,
    count: ranked.filter((candidate) => candidate.wave === wave).length,
    minimumScore: Math.min(...ranked.filter((candidate) => candidate.wave === wave).map((candidate) => candidate.scores.weightedTotal)),
    maximumScore: Math.max(...ranked.filter((candidate) => candidate.wave === wave).map((candidate) => candidate.scores.weightedTotal)),
  }))

  const body = {
    schemaVersion: 'maha-epistemic-clearing-route-map/1.0',
    preparedOn: '2026-09-04',
    objective: 'A governed candidate map for routes 1,001 through 2,000, prioritizing existing strengths and Maha as an epistemic clearing layer.',
    countingBoundary: 'Exactly 1,000 proposed canonical routes. No aliases, filters, query parameters, redirects, answer fragments, or machine-only endpoints are counted.',
    baseline: {
      operatorReportedRoutesBeforeTiruvaymoliContinuation: 974,
      preparedTiruvaymoliContinuationRoutes: 26,
      projectedStartingPointAfterOneApprovedBuildAndDeployment: 1000,
      directlyObservedProductionCount: 793,
      warning: 'The 1,000 starting point is a projection from prepared work, not a fresh Production observation.',
    },
    scoringModel: {
      weights: SCORE_WEIGHTS,
      laneBases: LANE_BASES,
      evidenceClassScores: EVIDENCE_CLASS_SCORE,
      lensModifiers: {
        rule: 'Only named semantic lens classes receive a modifier; all others receive zero.',
        machineUtility: '+5 for receipt, implementation, retrieval, bounded execution, provenance, or calculation; -5 for passage or occurrence.',
        commercialProximity: '+4 for retrieval, entitlement, metering, release, dossier, or preflight; -4 for passage, observable, or reception.',
        differentiation: '+3 for identity, boundary, uncertainty, receipt, or lineage.',
        duplicationRisk: '-4 for passage, worked example, calculation, or receipt; +4 for definition, comparison, or concept.',
      },
      bookConceptPriority: {
        role: 'Strategic concept priority only; a book manuscript is never evidence for the route claim.',
        rule: 'A matched book concept raises differentiation and machine utility within the same six-factor model. The Maha Principle has priority weight 10 and can add +8 differentiation, +3 machine utility, and +2 commercial proximity; other books have weight 6–7 and smaller bounded adjustments.',
        offlineRule: 'An offline book can shape priority but cannot supply a live route, source inspection, review, release, or publication state.',
      },
      formula: '0.20 search demand + 0.20 evidence availability + 0.15 differentiation + 0.20 machine utility + 0.20 commercial proximity + 0.05 duplication safety, where duplication safety = 100 - duplication risk.',
      interpretation: 'Scores prioritize research order. They are not publication decisions, search forecasts, or commercial validation.',
      demandRule: 'Observed-query requires a matching query in the supplied export. Adjacent-to-observed is capped by the cluster score and is never labelled measured demand.',
      duplicationRule: 'Duplication risk combines the lane/lens prior with a token-containment comparison against every path in the last observed sitemap. Exact collisions are forbidden; semantic similarity is a screening signal for editorial review.',
    },
    requiredGates: [
      'distinct search intent and no route duplication',
      'exact source identity and version relationship',
      'content inspection at the depth required by the claim',
      'exact locator and claim-to-passage support',
      'rights and access basis',
      'claim scope, uncertainty, and unsupported-inference checks',
      'exact-revision internal review',
      'active matching canonical release when the page carries a canonical record',
      'deterministic generation and public-bundle inspection',
    ],
    allocation: laneSummary,
    waves: waveSummary,
    summary: {
      candidates: ranked.length,
      candidateOnly: ranked.filter((candidate) => candidate.publication.state === 'candidate-only').length,
      inspected: ranked.filter((candidate) => candidate.publication.inspected).length,
      reviewed: ranked.filter((candidate) => candidate.publication.exactRevisionReviewed).length,
      released: ranked.filter((candidate) => candidate.publication.activeCanonicalRelease).length,
      crawlable: ranked.filter((candidate) => candidate.publication.crawlable).length,
      observedQueryCandidates: ranked.filter((candidate) => candidate.scores.demandEvidence.basis === 'observed-query').length,
    },
    sourceDemandArtifact: {
      schemaVersion: demand.schemaVersion,
      sourceDigests: demand.sourceDigests,
      limitations: demand.limitations,
    },
    bookPortfolio: {
      role: 'conceptual-priority-only',
      books: [...new Map(BOOK_CONCEPTS.map((entry) => [entry.bookId, {
        bookId: entry.bookId,
        bookTitle: entry.bookTitle,
        routeStatus: entry.routeStatus,
        sourcePath: entry.sourcePath,
        priorityWeight: entry.priorityWeight,
      }])).values()].map((book) => ({
        ...book,
        matchedCandidates: ranked.filter((candidate) =>
          candidate.bookPriority.matched.some((entry) => entry.bookId === book.bookId),
        ).length,
      })),
      matchedCandidates: ranked.filter((candidate) => candidate.bookPriority.matched.length > 0).length,
      mahaPrincipleMatchedCandidates: ranked.filter((candidate) =>
        candidate.bookPriority.matched.some((entry) => entry.bookId === 'the-maha-principle'),
      ).length,
    },
    candidates: ranked,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function markdown(artifact: ReturnType<typeof buildArtifact>): string {
  const top = artifact.candidates.slice(0, 30)
  const laneTop = Object.keys(ALLOCATIONS).flatMap((lane) =>
    artifact.candidates.filter((candidate) => candidate.lane === lane).slice(0, 5),
  )
  const lines = [
    '# Scored route map: 1,000 candidates for the epistemic clearing layer',
    '',
    `Generated: ${artifact.preparedOn}  `,
    `Artifact: \`${artifact.schemaVersion}\`  `,
    `Digest: \`${artifact.provenanceDigest}\``,
    '',
    '## Decision',
    '',
    'This is a research queue for routes 1,001–2,000, not a publication queue. All 1,000 entries are candidate-only: 0 inspected, 0 reviewed, 0 released, and 0 crawlable. A high score earns earlier research; it does not waive a gate.',
    '',
    'The baseline of 1,000 is itself projected from the operator-reported 974 routes plus the prepared 26-route Tiruvāymoḻi continuation. The last directly observed Production count remains 793. The map therefore does not claim the site already serves 1,000 routes.',
    '',
    '## Allocation',
    '',
    '| Lane | Candidates | Average score | Direct observed-query matches |',
    '|---|---:|---:|---:|',
    ...artifact.allocation.map((row) => `| ${row.label} | ${row.count} | ${row.averageScore.toFixed(2)} | ${row.observedQueryCandidates} |`),
    '| **Total** | **1,000** |  |  |',
    '',
    '## Scoring',
    '',
    artifact.scoringModel.formula,
    '',
    '- Search demand distinguishes exact observed-query matches from category adjacency. Adjacency is not search volume.',
    '- Evidence availability estimates whether lawful, inspectable, stable sources are likely to exist; every source still starts uninspected.',
    '- Differentiation rewards subjects where Maha can contribute a typed evidence boundary rather than another summary.',
    '- Machine utility rewards deterministic inputs, receipts, registries, and retrieval contracts.',
    '- Commercial proximity rewards direct paths to preflight, dossiers, provenance, entitlement, and licensed retrieval.',
    '- Duplication risk is a penalty. The formula uses duplication safety, `100 - risk`, so a higher risk lowers the total.',
    '',
    '## Book-concept priority',
    '',
    `${artifact.bookPortfolio.matchedCandidates} candidates match a concept developed in the book manuscripts; ${artifact.bookPortfolio.mahaPrincipleMatchedCandidates} match The Maha Principle. These matches receive an explicit, bounded increase inside differentiation, machine utility, and—in The Maha Principle’s case—commercial proximity. They do not receive evidence credit.`,
    '',
    '**The Maha Principle is operator-reported offline.** Its manuscript remains a high-weight strategic source for concepts such as humane governance, three-system verification, navigating complexity, strategic timing, and resilient redundancy. It contributes 0 live routes to this map and cannot satisfy source inspection, review, release, or publication gates.',
    '',
    '| Book | Route status | Priority weight | Role |',
    '|---|---|---:|---|',
    ...artifact.bookPortfolio.books.map((book) => `| ${book.bookTitle} | ${book.routeStatus} | ${book.priorityWeight} | conceptual priority only |`),
    '',
    '## Four research waves',
    '',
    '| Wave | Candidates | Score range |',
    '|---|---:|---:|',
    ...artifact.waves.map((wave) => `| ${wave.wave} | ${wave.count} | ${wave.minimumScore.toFixed(2)}–${wave.maximumScore.toFixed(2)} |`),
    '',
    'Waves are global score bands of 250. Before each wave, duplicates must be rechecked against everything published since this artifact was generated. A route may be removed without replacing it if its intent is already answered.',
    '',
    '## Top 30 overall',
    '',
    '| Rank | Score | Lane | Candidate | Demand basis | Book priority |',
    '|---:|---:|---|---|---|---:|',
    ...top.map((candidate) => `| ${candidate.rank} | ${candidate.scores.weightedTotal.toFixed(2)} | ${LANE_LABELS[candidate.lane]} | \`${candidate.proposedPath}\` | ${candidate.scores.demandEvidence.basis}${candidate.scores.demandEvidence.observedImpressions ? ` (${candidate.scores.demandEvidence.observedImpressions} impressions)` : ''} | ${candidate.bookPriority.priorityWeight} |`),
    '',
    '## Top five within each lane',
    '',
    '| Lane | Score | Candidate | Commercial action |',
    '|---|---:|---|---|',
    ...laneTop.map((candidate) => `| ${LANE_LABELS[candidate.lane]} | ${candidate.scores.weightedTotal.toFixed(2)} | \`${candidate.proposedPath}\` | ${candidate.commercialAction} |`),
    '',
    '## Publication gates',
    '',
    ...artifact.requiredGates.map((gate) => `- ${gate}`),
    '',
    'Passage-sequence slugs marked provisional must not ship until the exact printed unit boundary is inspected. Calculations remain optional: where inputs, units, assumptions, and uncertainty are incomplete, the page must say so rather than invent a receipt.',
    '',
    '## Evidence and demand caveats',
    '',
    ...artifact.sourceDemandArtifact.limitations.map((limitation) => `- ${limitation}`),
    '- Tamil religion has demonstrated generative-search discovery through textual authority, but most proposed passage and identity intents remain unmeasured.',
    '- Machine-integration candidates have high commercial and machine utility but lower raw search evidence; they should be evaluated by qualified enquiries and licensed retrievals, not impressions alone.',
    '- Cross-domain pages carry the highest semantic-overlap risk. Each must prove a typed transfer rule or be rejected as a duplicate.',
    '',
    '## Recommended operating order',
    '',
    '1. Research Wave 1 in source-first batches; freeze exact candidates before inspection.',
    '2. Reject duplicates and inaccessible or metadata-only candidates without substituting weaker evidence.',
    '3. Compile only candidates that pass the complete evidence, review, release, and bundle-safety chain.',
    '4. Deploy in substantial tranches only after explicit build approval, then replace projections with observed Production counts.',
    '5. Re-score the remaining queue with fresh Search Console and qualified-enquiry evidence after each tranche.',
    '',
    'The complete per-route score, rationale, source plan, demand evidence, gate state, rank, and wave are in `content/scaling/epistemic-clearing-route-candidates-v1.json`.',
    '',
  ]
  return `${lines.join('\n')}\n`
}

const artifact = buildArtifact()
mkdirSync(dirname(OUTPUT_JSON), { recursive: true })
mkdirSync(dirname(OUTPUT_MD), { recursive: true })
writeFileSync(OUTPUT_JSON, `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync(OUTPUT_MD, markdown(artifact))
console.log(JSON.stringify({
  candidates: artifact.summary.candidates,
  observedQueryCandidates: artifact.summary.observedQueryCandidates,
  digest: artifact.provenanceDigest,
  allocation: Object.fromEntries(artifact.allocation.map((row) => [row.lane, row.count])),
}, null, 2))
