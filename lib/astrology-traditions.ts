/**
 * Astrology tradition layer.
 *
 * Astrology is not stored here as a single body of facts. It is stored as
 * named interpretive traditions, and `traditionId` is mandatory on every rule.
 * Without that, incompatible systems blend into an authoritative-sounding
 * synthesis that belongs to no tradition and can be checked against none.
 *
 * Two hard boundaries separate this layer from the ones below it:
 *
 *   1. Every rule is `unvalidated-tradition` on the empirical axis. The layer
 *      claims accurate transcription of a source. It does not claim, and the
 *      schema cannot express, that any rule predicts anything.
 *   2. No rule may exist without a verbatim passage from a rights-cleared
 *      source. Interpretation without a transcribed passage is not a record.
 *
 * Both are enforced in `assertAstrologyIntegrity()` rather than left to review.
 */

import { SITE_URL } from './briefs-data.ts'
import { CLAIM_EVIDENCE_SCHEMA, assertClaimEvidence, type ClaimProvenance } from './claim-evidence.ts'

export const ASTROLOGY_VERSION = 'astrology-traditions/0.1' as const
export const ASTROLOGY_RELEASE_DATE = '2026-08-16' as const
export const ASTROLOGY_PATH = '/knowledge/astrology' as const
export const ASTROLOGY_REGISTRY_PATH = '/knowledge/astrology/registry' as const
export const ASTROLOGY_SCHEMA_PATH = '/knowledge/astrology/schema' as const

/** Chart families a rule can apply to. A rule valid for one is not valid for another. */
export const ASTROLOGY_CHART_TYPES = ['natal', 'horary', 'electional', 'mundane', 'synastry'] as const
export type AstrologyChartType = typeof ASTROLOGY_CHART_TYPES[number]

/** Where a tradition places the zero point of the zodiac. Traditions that differ here are not interchangeable. */
export const ZODIAC_FRAMES = ['tropical', 'sidereal', 'unspecified'] as const
export type ZodiacFrame = typeof ZODIAC_FRAMES[number]

/**
 * Uses that are prohibited for every rule in this layer, without exception.
 *
 * These are not disclaimers attached at render time. A rule that would be read
 * as any of these must not be published, and the report compiler above this
 * layer is required to refuse them.
 */
export const ASTROLOGY_PROHIBITED_USES = [
  'medical diagnosis, prognosis, or treatment decisions',
  'legal conclusions or advice',
  'investment, trading, or other financial decisions',
  'predictions of death, disaster, or pregnancy outcomes',
  'claims that a chart determines personality, capability, or behaviour',
  'guarantees about future events',
  'high-stakes decisions taken on astrological grounds alone',
  'employment, lending, insurance, or housing decisions about a person',
] as const

/** How a source's text may be used. Only cleared sources may carry excerpts. */
export const RIGHTS_STATUSES = ['public-domain', 'freely-licensed', 'in-copyright'] as const
export type RightsStatus = typeof RIGHTS_STATUSES[number]

export interface AstrologySource {
  id: string
  title: string
  author: string
  /** Composition date of the original work, which is not the edition date. */
  originalComposed: string
  translator?: string
  edition: string
  editionYear: number
  url: string
  rightsStatus: RightsStatus
  rightsNote: string
  accessed: string
}

export interface AstrologyPassage {
  id: string
  sourceId: string
  /** Exact location within the source, precise enough to find the text again. */
  locator: string
  /** Verbatim text as it appears in the cited edition. Bounded by ASTROLOGY_MAX_EXCERPT_WORDS. */
  excerpt: string
  /** Recorded where the cited edition differs from the sense intended, or from other editions. */
  transcriptionNote?: string
}

export interface ChartCondition {
  /** The celestial fact this condition reads. Ties a rule to the fact layer rather than to prose. */
  factField: string
  description: string
}

export interface InterpretationRule {
  id: string
  /** Mandatory. A rule without a tradition is not a rule, it is a floating assertion. */
  traditionId: string
  technique: string
  chartTypes: AstrologyChartType[]
  conditions: ChartCondition[]
  /** What the tradition holds. Never asserted in Maha's own voice. */
  interpretation: string
  passageIds: string[]
  provenance: ClaimProvenance
  /** Always 'unvalidated-tradition'. Present as a field so the record is explicit, not implied. */
  empirical: 'unvalidated-tradition'
  /** Competing readings, within this tradition or against another. */
  disagreements: string[]
  boundary: string
}

export interface AstrologyTradition {
  id: string
  slug: string
  name: string
  period: string
  zodiac: ZodiacFrame
  chartTypes: AstrologyChartType[]
  description: string
  /** Why a registered tradition carries no rules yet. Required when it has none. */
  unpopulatedReason?: string
}

export const ASTROLOGY_MAX_EXCERPT_WORDS = 60

export const ASTROLOGY_SOURCES: AstrologySource[] = [
  {
    id: 'ptolemy-tetrabiblos-ashmand',
    title: 'Ptolemy’s Tetrabiblos, or Quadripartite',
    author: 'Claudius Ptolemy',
    originalComposed: 'circa 2nd century CE',
    translator: 'J. M. Ashmand',
    edition: 'Project Gutenberg eBook #70850, from the 1822 Ashmand translation',
    editionYear: 1822,
    url: 'https://www.gutenberg.org/ebooks/70850',
    rightsStatus: 'public-domain',
    rightsNote: 'The 1822 Ashmand translation is out of copyright, and the Project Gutenberg transcription is distributed without restriction in the United States.',
    accessed: '2026-08-16',
  },
  {
    id: 'lilly-christian-astrology-1647',
    title: 'Christian Astrology',
    author: 'William Lilly',
    originalComposed: '1647',
    edition: 'Internet Archive scans of the 1647 and 1659 printings',
    editionYear: 1647,
    url: 'https://archive.org/details/christian-astrology-1647',
    rightsStatus: 'public-domain',
    rightsNote: 'The 1647 text is out of copyright. No passages are transcribed here: the available machine transcriptions are unproofread OCR of 17th-century typography, and quoting them would introduce corruption into a layer whose only claim is transcription fidelity.',
    accessed: '2026-08-16',
  },
]

export const ASTROLOGY_TRADITIONS: AstrologyTradition[] = [
  {
    id: 'hellenistic-ptolemaic',
    slug: 'hellenistic-ptolemaic',
    name: 'Hellenistic (Ptolemaic)',
    period: '2nd century CE, transmitted through Arabic and Latin commentary',
    zodiac: 'tropical',
    chartTypes: ['natal', 'mundane'],
    description: 'The system set out in Ptolemy’s Tetrabiblos, which grounds planetary signification in the four elemental qualities and treats the zodiac as measured from the equinox. It is the transmission route for much later Western practice, and it is not identical to any of them.',
  },
  {
    id: 'horary-lilly',
    slug: 'horary-lilly',
    name: 'Horary (Lilly)',
    period: '17th-century England',
    zodiac: 'tropical',
    chartTypes: ['horary', 'electional'],
    description: 'The question-based practice codified in William Lilly’s Christian Astrology, which judges a chart cast for the moment a question is understood rather than for a birth.',
    unpopulatedReason: 'No rights-cleared, proofread transcription of the 1647 text is available. The source is public domain, but every machine transcription found is unproofread OCR; publishing rules from it would violate this layer’s transcription-fidelity claim.',
  },
  {
    id: 'western-sidereal',
    slug: 'western-sidereal',
    name: 'Western sidereal',
    period: '20th century onward',
    zodiac: 'sidereal',
    chartTypes: ['natal'],
    description: 'Western practice that measures the zodiac against the fixed stars rather than the equinox. Registered here to make the frame disagreement explicit: a sidereal rule and a tropical rule that use the same sign name do not refer to the same region of sky.',
    unpopulatedReason: 'Primary sources for this tradition are 20th-century and in copyright. Passage-level excerpting requires a licensing decision that has not been taken.',
  },
]

const P = 'ptolemy-tetrabiblos-ashmand'

export const ASTROLOGY_PASSAGES: AstrologyPassage[] = [
  { id: 'ptb-1-5-benefic', sourceId: P, locator: 'Book I, Chapter V — Benefics and Malefics', excerpt: 'Therefore, two of the planets, on account of their temperate quality, and because heat and moisture are predominant in them, are considered by the ancients as benefic, or causers of good: these are Jupiter and Venus.' },
  { id: 'ptb-1-5-malefic', sourceId: P, locator: 'Book I, Chapter V — Benefics and Malefics', excerpt: 'But Saturn and Mars are esteemed of a contrary nature, and malefic, or causers of evil: the first from his excess of cold, the other from his excess of dryness.' },
  { id: 'ptb-1-5-common', sourceId: P, locator: 'Book I, Chapter V — Benefics and Malefics', excerpt: 'The Sun and Mercury are deemed of common influence, and productive either of good or evil in unison with whatever planets they may be connected with.' },
  { id: 'ptb-1-6-feminine', sourceId: P, locator: 'Book I, Chapter VI — Masculine and Feminine', excerpt: 'The Moon and Venus are therefore said to be feminine, since their qualities are principally moist.' },
  { id: 'ptb-1-6-masculine', sourceId: P, locator: 'Book I, Chapter VI — Masculine and Feminine', excerpt: 'The Sun, Saturn, Jupiter, and Mars are called masculine. Mercury is common to both genders, because at certain times he produces dryness, and at others moisture, and performs each in an equal ratio.' },
  { id: 'ptb-3-1-genethlialogy', sourceId: P, locator: 'Book III, Chapter I — Proem', excerpt: 'The foreknowledge of these particular events is called Genethlialogy, or the science of Nativities.' },
  { id: 'ptb-3-11-life', sourceId: P, locator: 'Book III, Chapter XI — The Duration of Life', excerpt: 'Of all events whatsoever, which take place after birth, the most essential is the continuance of life.' },
  { id: 'ptb-3-12-prorogatory', sourceId: P, locator: 'Book III, Chapter XII — The Prorogatory Places', excerpt: 'These several places are the sign on the angle of the ascendant, from the fifth degree above the horizon, to the twenty-fifth degree below it.' },
  { id: 'ptb-3-16-saturn', sourceId: P, locator: 'Book III, Chapter XVI — The Form and Temperament of the Body', excerpt: 'Saturn, when oriental, acts on the personal figure by producing a yellowish complexion and a good constitution; with black and curled hair, a broad and stout chest, eyes of ordinary quality, and a proportionate size of body.' },
  { id: 'ptb-3-16-jupiter', sourceId: P, locator: 'Book III, Chapter XVI — The Form and Temperament of the Body', excerpt: 'Jupiter ruling, when oriental, makes the person white or fair, with a clear complexion, moderate growth of hair, and large eyes, and of good and dignified stature.' },
  { id: 'ptb-3-16-mars', sourceId: P, locator: 'Book III, Chapter XVI — The Form and Temperament of the Body', excerpt: 'Mars, ascending, gives a fair ruddiness to the person, with large size, a healthy constitution, blue or grey eyes, a sturdy figure, and a moderate growth of hair.' },
  { id: 'ptb-3-16-venus', sourceId: P, locator: 'Book III, Chapter XVI — The Form and Temperament of the Body', excerpt: 'Venus operates in a manner similar to that of Jupiter, but, at the same time, more becomingly and more gracefully. She also peculiarly makes the eyes beautiful, and renders them of an azure tint.' },
  { id: 'ptb-3-16-mercury', sourceId: P, locator: 'Book III, Chapter XVI — The Form and Temperament of the Body', excerpt: 'Mercury, when oriental, makes the personal figure of a yellowish complexion, and of stature proportionate and well shaped, with small eyes and a moderate growth of hair.' },
  { id: 'ptb-3-17-injury-angles', sourceId: P, locator: 'Book III, Chapter XVII — The Hurts, Injuries, and Diseases of the Body', excerpt: 'For the investigation of these circumstances, the two angles on the horizon, both the ascendant and the western, must in all cases be remarked.' },
  {
    id: 'ptb-3-18-mind',
    sourceId: P,
    locator: 'Book III, Chapter XVIII — The Quality of the Mind',
    excerpt: 'Of the spiritual qualities, however, all those which are national and intellectual are contemplated by the situation of Mercury.',
    transcriptionNote: 'The cited Gutenberg edition reads “national”. Other printings of the Ashmand translation read “rational”, which the surrounding argument supports. Transcribed as it appears in the cited edition rather than silently corrected.',
  },
]

const UNVALIDATED = 'unvalidated-tradition' as const

/** Boundary text shared by rules that describe a person's body or mind from a chart. */
const DESCRIPTIVE_BOUNDARY = 'Recorded as historical doctrine of the named tradition. There is no evidence that planetary position corresponds to physical appearance or mental character, and this rule must not be used to describe, assess, or make decisions about any person.'

export const ASTROLOGY_RULES: InterpretationRule[] = [
  {
    id: 'ptb-planet-nature-benefic', traditionId: 'hellenistic-ptolemaic', technique: 'planetary nature', chartTypes: ['natal', 'mundane'],
    conditions: [{ factField: 'subject.identifiers', description: 'Jupiter or Venus is present in the chart.' }],
    interpretation: 'The tradition classes Jupiter and Venus as benefic, deriving the classification from a predominance of the heat and moisture held to be nutritive.',
    passageIds: ['ptb-1-5-benefic'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Later traditions treat benefic and malefic as contextual rather than fixed, conditioning the classification on sect, dignity, and house placement.'],
    boundary: 'A classification internal to the tradition’s elemental physics. The underlying qualitative theory of heat, cold, moisture, and dryness is not a description of the planets as understood by astronomy.',
  },
  {
    id: 'ptb-planet-nature-malefic', traditionId: 'hellenistic-ptolemaic', technique: 'planetary nature', chartTypes: ['natal', 'mundane'],
    conditions: [{ factField: 'subject.identifiers', description: 'Saturn or Mars is present in the chart.' }],
    interpretation: 'The tradition classes Saturn and Mars as malefic, attributing the classification to an excess of cold in Saturn and an excess of dryness in Mars.',
    passageIds: ['ptb-1-5-malefic'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Psychological astrology of the 20th century generally rejects the benefic/malefic division as a description of outcomes.'],
    boundary: 'A classification internal to the tradition’s elemental physics, not a claim that these planets produce harm.',
  },
  {
    id: 'ptb-planet-nature-common', traditionId: 'hellenistic-ptolemaic', technique: 'planetary nature', chartTypes: ['natal', 'mundane'],
    conditions: [{ factField: 'subject.identifiers', description: 'The Sun or Mercury is present in the chart.' }],
    interpretation: 'The tradition treats the Sun and Mercury as of common influence, taking their effect from the planets they are configured with rather than from a fixed nature.',
    passageIds: ['ptb-1-5-common'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Some Hellenistic authors treat the Sun as malefic when too close to another planet, a condition Ptolemy does not frame this way here.'],
    boundary: 'Recorded as doctrine of the named tradition; the conditional framing is Ptolemy’s, not a general rule of Western astrology.',
  },
  {
    id: 'ptb-planet-gender-feminine', traditionId: 'hellenistic-ptolemaic', technique: 'planetary gender', chartTypes: ['natal'],
    conditions: [{ factField: 'subject.identifiers', description: 'The Moon or Venus is present in the chart.' }],
    interpretation: 'The tradition assigns the Moon and Venus to the feminine category on the grounds that their qualities are principally moist.',
    passageIds: ['ptb-1-6-feminine'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The gendered classification of planets is rejected or reinterpreted as symbolic polarity across most contemporary practice.'],
    boundary: 'A 2nd-century classification recorded for historical accuracy. It reflects the gender assumptions of its period, carries no evidential weight, and must not be applied to any person or used to infer anything about sex or gender.',
  },
  {
    id: 'ptb-planet-gender-masculine', traditionId: 'hellenistic-ptolemaic', technique: 'planetary gender', chartTypes: ['natal'],
    conditions: [{ factField: 'subject.identifiers', description: 'The Sun, Saturn, Jupiter, or Mars is present in the chart.' }],
    interpretation: 'The tradition assigns the Sun, Saturn, Jupiter, and Mars to the masculine category, and treats Mercury as common to both because it produces dryness and moisture in equal ratio.',
    passageIds: ['ptb-1-6-masculine'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The gendered classification of planets is rejected or reinterpreted as symbolic polarity across most contemporary practice.'],
    boundary: 'A 2nd-century classification recorded for historical accuracy. It reflects the gender assumptions of its period, carries no evidential weight, and must not be applied to any person or used to infer anything about sex or gender.',
  },
  {
    id: 'ptb-genethlialogy-scope', traditionId: 'hellenistic-ptolemaic', technique: 'scope of nativities', chartTypes: ['natal'],
    conditions: [{ factField: 'time.utcInstant', description: 'A birth moment is given.' }],
    interpretation: 'The tradition names the study of individual nativities Genethlialogy and separates it from the general or mundane inquiry treated earlier in the work.',
    passageIds: ['ptb-3-1-genethlialogy'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: 'A definition of the tradition’s own scope. It records how the text divides its subject and asserts nothing about what a birth chart can show.',
  },
  {
    id: 'ptb-life-precedence', traditionId: 'hellenistic-ptolemaic', technique: 'order of judgement', chartTypes: ['natal'],
    conditions: [{ factField: 'time.utcInstant', description: 'A birth moment is given.' }],
    interpretation: 'The tradition holds that the question of the duration of life is taken up before all other post-natal questions, on the reasoning that other predictions are moot without it.',
    passageIds: ['ptb-3-11-life'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Contemporary practice generally abandons length-of-life technique entirely, on both evidential and ethical grounds.'],
    boundary: 'Recorded as the structure of a historical text. Maha does not publish length-of-life judgements, and no report may generate one: see the prohibited uses attached to this layer.',
  },
  {
    id: 'ptb-prorogatory-places', traditionId: 'hellenistic-ptolemaic', technique: 'prorogation', chartTypes: ['natal'],
    conditions: [
      { factField: 'coordinates.values', description: 'Ecliptic longitudes of the angles are computed.' },
      { factField: 'observer.position', description: 'Observer latitude is known, since the angles depend on it.' },
    ],
    interpretation: 'The tradition restricts the prorogatory places to a defined set, beginning with the region of the ascendant running from five degrees above the horizon to twenty-five degrees below it.',
    passageIds: ['ptb-3-12-prorogatory'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The set of prorogatory places and their ordering differ between Ptolemy and other Hellenistic authors, and the technique is not used in most modern practice.'],
    boundary: 'A technical specification internal to the tradition. It is reproducible as geometry from the fact layer; that reproducibility says nothing about whether the technique means anything.',
  },
  {
    id: 'ptb-body-saturn', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Saturn holds dominion and is oriental to the Sun.' }],
    interpretation: 'The tradition holds that Saturn oriental gives a yellowish complexion, black curled hair, a broad chest, and proportionate size.',
    passageIds: ['ptb-3-16-saturn'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-jupiter', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Jupiter holds dominion and is oriental to the Sun.' }],
    interpretation: 'The tradition holds that Jupiter oriental gives a fair and clear complexion, moderate hair, large eyes, and dignified stature.',
    passageIds: ['ptb-3-16-jupiter'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-mars', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Mars holds dominion and is ascending.' }],
    interpretation: 'The tradition holds that Mars ascending gives ruddiness, large size, blue or grey eyes, and a sturdy figure.',
    passageIds: ['ptb-3-16-mars'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-venus', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Venus holds dominion over the form.' }],
    interpretation: 'The tradition holds that Venus works as Jupiter does but more gracefully, and is said to make the eyes beautiful and azure.',
    passageIds: ['ptb-3-16-venus'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-mercury', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Mercury holds dominion and is oriental to the Sun.' }],
    interpretation: 'The tradition holds that Mercury oriental gives a yellowish complexion, proportionate and well-shaped stature, small eyes, and moderate hair.',
    passageIds: ['ptb-3-16-mercury'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-injury-angles', traditionId: 'hellenistic-ptolemaic', technique: 'bodily injury', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'The ascendant and descendant are computed, and malefic configurations to them are examined.' }],
    interpretation: 'The tradition directs that the ascendant and western angle be examined first when the question concerns bodily injury or disease.',
    passageIds: ['ptb-3-17-injury-angles'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Medical application of astrology is rejected by contemporary medicine and by most contemporary astrological practice.'],
    boundary: 'Recorded as historical doctrine only. This rule must never contribute to a health statement of any kind: medical diagnosis, prognosis, and treatment are prohibited uses of this layer without exception.',
  },
  {
    id: 'ptb-mind-mercury', traditionId: 'hellenistic-ptolemaic', technique: 'quality of mind', chartTypes: ['natal'],
    conditions: [
      { factField: 'coordinates.values', description: 'The position of Mercury is computed.' },
      { factField: 'coordinates.values', description: 'The position of the Moon and its applications and separations are computed.' },
    ],
    interpretation: 'The tradition assigns the intellectual qualities to the situation of Mercury, and the sensitive faculties independent of reason to the Moon and the stars configured with her.',
    passageIds: ['ptb-3-18-mind'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The division of mind between two significators is handled differently across Hellenistic authors, and psychological astrology reframes it as symbolic rather than causal.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
]

const SOURCE_MAP = new Map(ASTROLOGY_SOURCES.map((source) => [source.id, source]))
const PASSAGE_MAP = new Map(ASTROLOGY_PASSAGES.map((passage) => [passage.id, passage]))
const TRADITION_MAP = new Map(ASTROLOGY_TRADITIONS.map((tradition) => [tradition.id, tradition]))

export function getAstrologyTradition(id: string): AstrologyTradition | undefined { return TRADITION_MAP.get(id) }
export function getAstrologyTraditionBySlug(slug: string): AstrologyTradition | undefined { return ASTROLOGY_TRADITIONS.find((tradition) => tradition.slug === slug) }
export function getAstrologyPassage(id: string): AstrologyPassage | undefined { return PASSAGE_MAP.get(id) }
export function getAstrologySource(id: string): AstrologySource | undefined { return SOURCE_MAP.get(id) }
export function astrologyTraditionPath(tradition: AstrologyTradition): string { return `${ASTROLOGY_PATH}/${tradition.slug}` }
export function getRulesForTradition(traditionId: string): InterpretationRule[] { return ASTROLOGY_RULES.filter((rule) => rule.traditionId === traditionId) }

export function wordCount(value: string): number { return value.trim().split(/\s+/).filter(Boolean).length }

export const ASTROLOGY_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${SITE_URL}${ASTROLOGY_SCHEMA_PATH}`,
  title: 'Maha Astrology Tradition Registry',
  description: 'Named interpretive traditions with passage-level provenance. Every rule is empirically unvalidated by construction; this registry records what sources say, not what is true.',
  type: 'object', additionalProperties: false,
  required: ['version', 'releasedOn', 'epistemicBoundary', 'prohibitedUses', 'traditions', 'sources', 'passages', 'rules'],
  $defs: {
    rule: {
      type: 'object', additionalProperties: false,
      required: ['id', 'traditionId', 'technique', 'chartTypes', 'conditions', 'interpretation', 'passageIds', 'provenance', 'empirical', 'disagreements', 'boundary'],
      properties: {
        id: { type: 'string', minLength: 1 },
        traditionId: { type: 'string', minLength: 1, description: 'Mandatory. A rule is only valid inside the tradition that declares it.' },
        technique: { type: 'string', minLength: 1 },
        chartTypes: { type: 'array', minItems: 1, items: { enum: ASTROLOGY_CHART_TYPES } },
        conditions: { type: 'array', minItems: 1, items: { type: 'object', required: ['factField', 'description'], additionalProperties: false, properties: { factField: { type: 'string' }, description: { type: 'string' } } } },
        interpretation: { type: 'string', minLength: 40 },
        passageIds: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'At least one verbatim passage. A rule with no passage cannot be published.' },
        provenance: CLAIM_EVIDENCE_SCHEMA.provenance,
        empirical: { const: 'unvalidated-tradition', description: 'Fixed. This layer cannot express empirical support for an interpretive rule.' },
        disagreements: { type: 'array', items: { type: 'string' } },
        boundary: { type: 'string', minLength: 40 },
      },
    },
  },
} as const

export function buildAstrologyRegistry() {
  return {
    version: ASTROLOGY_VERSION,
    releasedOn: ASTROLOGY_RELEASE_DATE,
    epistemicBoundary: 'Every rule in this registry is recorded as documented interpretive tradition. Provenance is claimed; empirical validity is not, and the schema cannot express it. Presence in this registry is not evidence that a rule predicts anything.',
    prohibitedUses: [...ASTROLOGY_PROHIBITED_USES],
    schema: `${SITE_URL}${ASTROLOGY_SCHEMA_PATH}`,
    traditions: ASTROLOGY_TRADITIONS.map((tradition) => ({ ...tradition, ruleCount: getRulesForTradition(tradition.id).length })),
    sources: ASTROLOGY_SOURCES,
    passages: ASTROLOGY_PASSAGES,
    rules: ASTROLOGY_RULES,
  }
}

export function assertAstrologyIntegrity(): void {
  const traditionIds = new Set(ASTROLOGY_TRADITIONS.map((tradition) => tradition.id))
  if (traditionIds.size !== ASTROLOGY_TRADITIONS.length) throw new Error('Astrology tradition identifiers must be unique.')
  if (new Set(ASTROLOGY_TRADITIONS.map((tradition) => tradition.slug)).size !== ASTROLOGY_TRADITIONS.length) throw new Error('Astrology tradition slugs must be unique.')
  if (new Set(ASTROLOGY_PASSAGES.map((passage) => passage.id)).size !== ASTROLOGY_PASSAGES.length) throw new Error('Astrology passage identifiers must be unique.')
  if (new Set(ASTROLOGY_RULES.map((rule) => rule.id)).size !== ASTROLOGY_RULES.length) throw new Error('Astrology rule identifiers must be unique.')

  for (const source of ASTROLOGY_SOURCES) {
    if (!source.url.startsWith('https://')) throw new Error(`${source.id} must use HTTPS.`)
    if (source.rightsNote.length < 60) throw new Error(`${source.id} needs an explicit rights note.`)
  }

  for (const passage of ASTROLOGY_PASSAGES) {
    const source = SOURCE_MAP.get(passage.sourceId)
    if (!source) throw new Error(`${passage.id} references missing source ${passage.sourceId}.`)
    // Excerpting an in-copyright edition is a licensing decision, not a
    // transcription decision, so the layer refuses it outright.
    if (source.rightsStatus === 'in-copyright') throw new Error(`${passage.id} excerpts an in-copyright source (${source.id}).`)
    if (!passage.locator.trim()) throw new Error(`${passage.id} needs a locator precise enough to find the text again.`)
    const words = wordCount(passage.excerpt)
    if (words === 0) throw new Error(`${passage.id} has an empty excerpt.`)
    if (words > ASTROLOGY_MAX_EXCERPT_WORDS) throw new Error(`${passage.id} excerpt is ${words} words, over the ${ASTROLOGY_MAX_EXCERPT_WORDS}-word bound.`)
  }

  for (const rule of ASTROLOGY_RULES) {
    // The central invariant of the layer.
    if (!traditionIds.has(rule.traditionId)) throw new Error(`${rule.id} has no valid tradition (${rule.traditionId}); every rule must belong to a declared tradition.`)
    // The second: no interpretation without a transcribed source passage.
    if (rule.passageIds.length === 0) throw new Error(`${rule.id} has no passage; an interpretation without a transcribed source is not a record.`)
    for (const passageId of rule.passageIds) if (!PASSAGE_MAP.has(passageId)) throw new Error(`${rule.id} references missing passage ${passageId}.`)
    // The third: this layer cannot claim empirical support.
    if (rule.empirical !== 'unvalidated-tradition') throw new Error(`${rule.id} must be recorded as unvalidated-tradition.`)
    assertClaimEvidence({ provenance: rule.provenance, empirical: rule.empirical }, rule.id)
    if (rule.boundary.length < 40) throw new Error(`${rule.id} needs an explicit boundary.`)
    if (rule.conditions.length === 0) throw new Error(`${rule.id} needs at least one chart condition.`)

    const tradition = TRADITION_MAP.get(rule.traditionId)!
    for (const chartType of rule.chartTypes) {
      if (!tradition.chartTypes.includes(chartType)) throw new Error(`${rule.id} claims chart type ${chartType}, which its tradition ${tradition.id} does not practise.`)
    }
  }

  for (const tradition of ASTROLOGY_TRADITIONS) {
    // A tradition with no rules must say why, so emptiness is a recorded
    // decision rather than something that looks like an oversight.
    if (getRulesForTradition(tradition.id).length === 0 && !tradition.unpopulatedReason) {
      throw new Error(`${tradition.id} has no rules and no unpopulatedReason.`)
    }
  }
}

assertAstrologyIntegrity()
