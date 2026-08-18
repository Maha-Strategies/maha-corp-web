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
import { JYOTISHA_EXPANSION_PASSAGES, JYOTISHA_EXPANSION_RULES } from './jyotisha-classical-expansion.ts'
import { ASTROLOGY_RELEASE_DATE, ASTROLOGY_VERSION } from './astrology-version.ts'

export { ASTROLOGY_RELEASE_DATE, ASTROLOGY_VERSION } from './astrology-version.ts'
export const ASTROLOGY_PATH = '/knowledge/astrology' as const
export const ASTROLOGY_REGISTRY_PATH = '/knowledge/astrology/registry' as const
export const ASTROLOGY_SCHEMA_PATH = '/knowledge/astrology/schema' as const

/** Chart families a rule can apply to. A rule valid for one is not valid for another. */
export const ASTROLOGY_CHART_TYPES = ['natal', 'horary', 'electional', 'mundane', 'corporate', 'synastry'] as const
export type AstrologyChartType = typeof ASTROLOGY_CHART_TYPES[number]

export const JYOTISHA_COVERAGE_AREAS = [
  'planetary-house-placement',
  'house-rulers',
  'nakshatra-interpretation',
  'explicit-yogas',
  'dasha-interpretation',
  'transit-interpretation',
  'mundane-corporate-charts',
  'panchanga-selection',
] as const
export type JyotishaCoverageArea = typeof JYOTISHA_COVERAGE_AREAS[number]
export type DoctrineStatus = 'historical-doctrine' | 'translator-commentary' | 'contemporary-practice' | 'maha-synthesis'

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
  /**
   * Subjects whose facts must be present for the condition to hold. Any-of
   * semantics: one matching subject satisfies it.
   */
  requiresSubjects?: string[]
  /**
   * A pañcāṅga limb the condition reads, and the values that satisfy it.
   * Any-of semantics. Present only on rules whose condition is a calendar
   * value rather than a planetary position.
   */
  requiresLimb?: { limb: 'tithi' | 'nakshatra' | 'yoga' | 'karana' | 'vara'; anyOf: string[] }
  /**
   * `direct` conditions are decidable from a fact bundle alone. `requires-derivation`
   * conditions need a computation the compiler does not perform — orientality,
   * dominion, house cusps. Marking them is what lets the compiler fail closed
   * instead of quietly guessing.
   */
  derivation: 'direct' | 'requires-derivation'
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
  /** Present on the deliberately small, review-gated Jyotiṣa expansion. */
  sourceBoundCoverage?: {
    area: JyotishaCoverageArea
    doctrineStatus: DoctrineStatus
    /** The compiler withholds this rule until its passages and formalization are reviewed. */
    publicationGate: 'practitioner-review-required'
  }
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
    id: 'brihat-samhita-iyer',
    title: 'The Bṛhat Saṃhitā of Varāha Mihira',
    author: 'Varāhamihira',
    originalComposed: 'circa 6th century CE',
    translator: 'N. Chidambaram Iyer',
    edition: '1884 English translation, proofread transcription published by wisdomlib.org',
    editionYear: 1884,
    url: 'https://www.wisdomlib.org/hinduism/book/brihat-samhita',
    rightsStatus: 'public-domain',
    rightsNote: 'The 1884 Chidambaram Iyer translation is out of copyright. Transcribed from the proofread wisdomlib presentation rather than the Internet Archive scan, whose OCR renders the English as Devanagari mojibake and is unusable for verbatim quotation.',
    accessed: '2026-08-16',
  },
  {
    id: 'brihat-jataka-iyer-1885',
    title: 'The Bṛhat Jātaka of Varāha Mihira',
    author: 'Varāhamihira',
    originalComposed: 'circa 6th century CE',
    translator: 'N. Chidambaram Iyer',
    edition: 'Foster Press, Madras, 1885; Wellcome Collection scan',
    editionYear: 1885,
    url: 'https://wellcomecollection.org/works/afmgm695',
    rightsStatus: 'public-domain',
    rightsNote: 'Wellcome Collection marks this 1885 edition Public Domain. Passages were checked against page images in its scan; machine OCR was used only to locate candidates and is not treated as authoritative text.',
    accessed: '2026-08-17',
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
    id: 'vedic-jyotisha',
    slug: 'vedic-jyotisha',
    name: 'Vedic (Jyotiṣa)',
    period: 'classical Indian, transmitted continuously to present practice',
    zodiac: 'sidereal',
    chartTypes: ['natal', 'electional', 'mundane', 'corporate'],
    description: 'The Indian sidereal system represented here by a deliberately small source-bound corpus. Its calendrical arithmetic is reproducible; every newly encoded natal, timing, mundane, or corporate interpretation remains withheld until passage fidelity and rule formalization receive scoped practitioner review.',
  },
  {
    id: 'western-sidereal',
    slug: 'western-sidereal',
    name: 'Western sidereal',
    period: '20th century onward',
    zodiac: 'sidereal',
    chartTypes: ['natal'],
    description: 'Western practice that measures the zodiac against the fixed stars rather than the equinox. Registered here to make the frame disagreement explicit: a sidereal rule and a tropical rule that use the same sign name do not refer to the same region of sky.',
    unpopulatedReason: 'The relevant modern Western sidereal sources are in copyright. No rule will be encoded until a licence permits passage-level quotation and formalization.',
  },
]

const BS = 'brihat-samhita-iyer'

/**
 * Bṛhat Saṃhitā, Chapter 99 — on lunar days and half lunar days.
 *
 * The chapter that governs karaṇa and tithi selection, which is the part of
 * muhūrta the pañcāṅga layer can already compute.
 */
const BRIHAT_SAMHITA_PASSAGES: AstrologyPassage[] = [
  {
    id: 'bs-98-6-dhruva-list', sourceId: BS, locator: 'Chapter 98, verse 6 — On the constellations',
    excerpt: 'Of these 28 constellations (nakṣatra), those of Uttaraphālguni, Uttarāṣāḍha and Uttarabhādrapada together with the constellation of Rohiṇī are known as (Dhruva) stable asterisms.',
    transcriptionNote: 'The edition transliterates the nakshatra names differently from the forms used in `lib/panchanga.ts`; the rule maps them to the canonical forms and the mapping is stated in its boundary.',
  },
  {
    id: 'bs-98-6-dhruva-acts', sourceId: BS, locator: 'Chapter 98, verse 6 — On the constellations',
    excerpt: 'Coronation of kings, expiatory ceremonies, planting of trees, the building of towns, acts of public utility, the sowing of seeds and acts of permanent effects shall he commenced when the Moon passes through the stable asterisms.',
    transcriptionNote: 'The cited edition reads “shall he commenced”, evidently a compositor’s error for “shall be commenced”. Transcribed as printed rather than silently corrected.',
  },
  {
    id: 'bs-98-9-laghu-list', sourceId: BS, locator: 'Chapter 98, verse 9 — On the constellations',
    excerpt: 'The constellations (nakṣatra) of Hasta. Aśvinī and Puṣya are known as (Laghu) light asterisms.',
    transcriptionNote: 'The full stop after “Hasta” is a comma in the printed text; retained here as the edition transcribes it.',
  },
  {
    id: 'bs-98-9-laghu-acts', sourceId: BS, locator: 'Chapter 98, verse 9 — On the constellations',
    excerpt: 'Sales, acts of sexual love, acquisition of knowledge, wearing of ornaments, arts, sculpture, medicine purchase of carriage and the like shall be commenced when the Moon passes through the light asterisms.',
  },
  {
    id: 'bs-98-10-mridu-list', sourceId: BS, locator: 'Chapter 98, verse 10 — On the constellations',
    excerpt: 'The constellations (nakṣatra) of Anurādhā, Citrā, Revatī and Mṛgaśīrṣa are known as (Mṛdu) soft asterisms.',
  },
  {
    id: 'bs-98-10-mridu-acts', sourceId: BS, locator: 'Chapter 98, verse 10 — On the constellations',
    excerpt: 'Acts of friendship, sexual union, the purchase of clothes, the wearing or making of ornaments, any auspicious deeds and music shall be commenced when the Moon passes through the soft asterisms.',
  },
  {
    id: 'bs-98-13-prohibited-times', sourceId: BS, locator: 'Chapter 98, verse 13 — On the constellations',
    excerpt: 'Shaving is prohibited in twilight hours, hours of night, on Tuesdays, Saturdays and Sundays, on Rikta Tithis, on the ninth lunar day and when the karaṇa is Bhadra.',
    transcriptionNote: 'A footnote marker after “Rikta” in the source is omitted. This verse is the evidence that Riktā avoidance and the Bhadra prohibition are Varāhamihira’s own, not only later doctrine.',
  },
  {
    id: 'bs-99-2-tithi-groups', sourceId: BS, locator: 'Chapter 99, verse 2 — On lunar days and half lunar days',
    excerpt: 'The 1st, 6th and 11th lunar days are known as Nandā; the 2nd, 7th, and 12th, lunar days are known as Bhadrā; the 3rd, 8th and 13th lunar days are known as Vijayā; the 4th, 9th, and 14th lunar days are known as Riktā and the 5th, 10th and 15th lunar days are known as Pūrṇā.',
  },
  {
    id: 'bs-99-4-movable-karanas', sourceId: BS, locator: 'Chapter 99, verse 4 — On lunar days and half lunar days',
    excerpt: 'The lords of the seven Karaṇas are, viz. Bava, Bālava, Kaulava, Taitila, Gara, Vaṇija, and Viṣṭi, are Indra, Brahmā, Mitra, Aryaman, Bhū, Śrī and Yama.',
  },
  {
    id: 'bs-99-5-fixed-karanas', sourceId: BS, locator: 'Chapter 99, verse 5 — On lunar days and half lunar days',
    excerpt: 'The four Dhruva (fixed) Karaṇas are—Śakuni, Catuṣpada, Nāga and Kiṃstughna and they begin from the second half of the 14th day of the waning moon.',
  },
  {
    id: 'bs-99-6-bava', sourceId: BS, locator: 'Chapter 99, verse 6 — On lunar days and half lunar days',
    excerpt: 'In a Bava Karaṇa shall be done deeds of an auspicious, a moveable or a fixed character as well as deeds for the promotion of a person’s health or comfort.',
  },
  {
    id: 'bs-99-7-vishti', sourceId: BS, locator: 'Chapter 99, verse 7 — On lunar days and half lunar days',
    excerpt: 'In a Viṣṭi or Bhadra Karaṇa, auspicious deeds shall not be done but acts aimed at the ruin of enemies and those connected with poison may be done.',
    transcriptionNote: 'Transcribed in full for fidelity. Only the prohibition is carried into a rule; the remainder of the verse is recorded as historical text and is not acted on, and the prohibited uses attached to this layer forbid it.',
  },
  {
    id: 'bs-99-8-kimstughna', sourceId: BS, locator: 'Chapter 99, verse 8 — On lunar days and half lunar days',
    excerpt: 'In a Kiṃstughna Karaṇa, a person shall do any work for the increase of his health and comfort as well as auspicious deeds.',
  },
]

const P = 'ptolemy-tetrabiblos-ashmand'
const BJ = 'brihat-jataka-iyer-1885'

const BRIHAT_JATAKA_PASSAGES: AstrologyPassage[] = [
  {
    id: 'bj-10-1-planets-tenth-house', sourceId: BJ, locator: 'Chapter X, stanza 1, printed page 110 (scan image 152) — On Avocation',
    excerpt: 'A person gets wealth from his father, mother, enemy, friend, brother, wife or servant according as the planet which occupies the 10th house from the Lagna or from the Moon is the Sun, or the Moon, or Mars or Mercury, or Jupiter or Venus or Saturn respectively.',
    transcriptionNote: 'Checked against the page image. The comma after “enemy” is faint in the scan. The source makes a financial and relational prediction; the corpus records it as historical doctrine and does not authorize financial use.',
  },
  {
    id: 'bj-10-1-tenth-lord-navamsa', sourceId: BJ, locator: 'Chapter X, stanza 1, printed page 110 (scan image 152) — On Avocation',
    excerpt: 'If there be no such planet, the avocation of a person will be that stated for the planets which might be the lords of the Navamsas occupied by the lords of the 10th houses from Lagna, the Moon and the Sun.',
    transcriptionNote: 'Checked against the page image. Parenthetical note markers in the printed line are omitted from the bounded excerpt.',
  },
  {
    id: 'bj-12-2-musala-yoga', sourceId: BJ, locator: 'Chapter XII, stanza 2, printed page 122 (scan image 164) — On Nabhasa Yogas',
    excerpt: 'According to Satyachariyar if all the planets occupy the movable, fixed or common signs, the yogas are respectively known as Rajju, Musala, and Nala and these three form the group of Asraya yogas.',
    transcriptionNote: 'Checked against the page image. Diacritics are absent in the 1885 edition; the rule retains its spellings rather than silently modernizing them.',
  },
  {
    id: 'bj-12-2-asraya-variant', sourceId: BJ, locator: 'Chapter XII, stanza 2, note (a), printed page 122 (scan image 164) — On Nabhasa Yogas',
    excerpt: 'One or two or three or all the four of the signs. According to some the planets ought to occupy all the four signs. This is opposed to Garga.',
    transcriptionNote: 'The note preserves a material disagreement about whether every sign of the relevant modality must be occupied; the rule therefore does not collapse this condition to one reading.',
  },
  {
    id: 'bj-8-10-dasha-upachaya', sourceId: BJ, locator: 'Chapter VIII, stanza 10, printed page 82 (scan image 124) — On Dasas and Antardasas',
    excerpt: 'if the lord of the dasa period occupy the 3rd, 6th, 10th or 11th house from the Lagna, such dasa period will be a prosperous one',
    transcriptionNote: 'Checked against the page image. This is one alternative in a longer compound stanza; the rule encodes only this independently testable branch and does not imply that it is the whole stanza.',
  },
  {
    id: 'bj-9-moon-zero-bindus', sourceId: BJ, locator: 'Chapter IX, A.V. of the Moon, printed page 101 (scan image 143) — On Ashtakavargas',
    excerpt: 'No work shall be commenced when the Moon passes through signs in which there are no figures in the A. V. of the Moon.',
    transcriptionNote: 'Checked against the page image. “A. V.” abbreviates Ashtakavarga in this edition. Evaluating the condition requires a separately specified Ashtakavarga implementation.',
  },
  {
    id: 'bj-16-1-ashwini', sourceId: BJ, locator: 'Chapter XVI, stanza 1, printed page 157 (scan image 199) — On the Nakshatras',
    excerpt: 'A person born when the Moon passes through the asterism of Aswini will be fond of ornaments, will be of fine appearance, will be popular, skilled in work and intelligent.',
    transcriptionNote: 'Checked against the page image. The source spells the asterism “Aswini”; the rule maps it to the calculator’s canonical “Aśvinī” while preserving the edition wording here.',
  },
]

export const ASTROLOGY_PASSAGES: AstrologyPassage[] = [
  ...BRIHAT_SAMHITA_PASSAGES,
  ...BRIHAT_JATAKA_PASSAGES,
  ...JYOTISHA_EXPANSION_PASSAGES,
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

/**
 * Muhūrta boundary shared by the Jyotiṣa timing rules.
 *
 * These rules are unusual in this corpus: their chart conditions are fully
 * computable today, so the temptation to present the output as a real verdict
 * is at its strongest here. Reproducible arithmetic feeding a rule does not
 * make the rule predictive.
 */
const MUHURTA_BOUNDARY = 'The pañcāṅga input is computed and reproducible, but the rule built on it is documented tradition with no empirical support. A moment being Viṣṭi or Riktā is a fact about the Sun and Moon; that such a moment is unfavourable for an undertaking is not, and no outcome should be expected either way.'

export const ASTROLOGY_RULES: InterpretationRule[] = [
  {
    id: 'bs-nakshatra-dhruva', traditionId: 'vedic-jyotisha', technique: 'nakshatra selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'The Moon occupies one of the four stable (Dhruva) nakshatras.', requiresLimb: { limb: 'nakshatra', anyOf: ['Uttara Phalgunī', 'Uttara Āṣāḍhā', 'Uttara Bhādrapadā', 'Rohiṇī'] }, derivation: 'direct' }],
    interpretation: 'The tradition classes these four nakshatras as stable (Dhruva) and directs that undertakings meant to endure — planting, building, sowing, and acts of public utility — be begun while the Moon passes through them.',
    passageIds: ['bs-98-6-dhruva-list', 'bs-98-6-dhruva-acts'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: `${MUHURTA_BOUNDARY} The nakshatra names are matched against the canonical forms used by the pañcāṅga computation; the 1884 edition spells them Uttaraphālguni, Uttarāṣāḍha and Uttarabhādrapada, and that normalisation is a transcription decision rather than a doctrinal one.`,
  },
  {
    id: 'bs-nakshatra-laghu', traditionId: 'vedic-jyotisha', technique: 'nakshatra selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'The Moon occupies one of the three light (Laghu) nakshatras.', requiresLimb: { limb: 'nakshatra', anyOf: ['Hasta', 'Aśvinī', 'Puṣya'] }, derivation: 'direct' }],
    interpretation: 'The tradition classes these three nakshatras as light (Laghu) and associates them with sales, the acquisition of knowledge, the arts, and similar undertakings.',
    passageIds: ['bs-98-9-laghu-list', 'bs-98-9-laghu-acts'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: MUHURTA_BOUNDARY,
  },
  {
    id: 'bs-nakshatra-mridu', traditionId: 'vedic-jyotisha', technique: 'nakshatra selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'The Moon occupies one of the four soft (Mṛdu) nakshatras.', requiresLimb: { limb: 'nakshatra', anyOf: ['Anurādhā', 'Citrā', 'Revatī', 'Mṛgaśīrṣa'] }, derivation: 'direct' }],
    interpretation: 'The tradition classes these four nakshatras as soft (Mṛdu) and associates them with acts of friendship, the making of ornaments, music, and auspicious undertakings generally.',
    passageIds: ['bs-98-10-mridu-list', 'bs-98-10-mridu-acts'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: MUHURTA_BOUNDARY,
  },
  {
    id: 'bs-vara-prohibited-days', traditionId: 'vedic-jyotisha', technique: 'vāra selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.vara', description: 'The vāra is Tuesday, Saturday or Sunday.', requiresLimb: { limb: 'vara', anyOf: ['Maṅgalavāra', 'Śanivāra', 'Ravivāra'] }, derivation: 'direct' }],
    interpretation: 'The tradition prohibits shaving on Tuesdays, Saturdays and Sundays, and the same verse extends the prohibition to twilight and night hours, Riktā tithis, the ninth lunar day, and the Bhadra karaṇa.',
    passageIds: ['bs-98-13-prohibited-times'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The verse conditions a single act on several limbs at once. This rule fires on the vāra alone; the tithi and karaṇa conditions in the same verse are recorded in the passage but are not separately evaluated, so the rule is narrower than the source.'],
    boundary: `${MUHURTA_BOUNDARY} The rule is deliberately narrower than its verse: the source joins several conditions with "or", which the condition model, being a conjunction of limbs, cannot express.`,
  },
  {
    id: 'bs-muhurta-vishti-prohibition', traditionId: 'vedic-jyotisha', technique: 'karaṇa selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.karana', description: 'The karaṇa current at the moment under consideration is Viṣṭi (Bhadra).', requiresLimb: { limb: 'karana', anyOf: ['Viṣṭi'] }, derivation: 'direct' }],
    interpretation: 'The tradition holds that auspicious undertakings are not to be begun during the Viṣṭi (Bhadra) karaṇa.',
    passageIds: ['bs-99-7-vishti'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Later muhūrta literature narrows the prohibition by the portion of Bhadra that falls in daylight and by which loka it is held to occupy, so practice varies on how much of the period is avoided.'],
    boundary: `${MUHURTA_BOUNDARY} Only the prohibition in the cited verse is carried into this rule; the remainder of the verse is recorded in the passage for transcription fidelity and is not acted on.`,
  },
  {
    id: 'bs-muhurta-bava-favourable', traditionId: 'vedic-jyotisha', technique: 'karaṇa selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.karana', description: 'The karaṇa current at the moment under consideration is Bava.', requiresLimb: { limb: 'karana', anyOf: ['Bava'] }, derivation: 'direct' }],
    interpretation: 'The tradition holds that the Bava karaṇa suits auspicious undertakings, whether of a moveable or a fixed character, and acts directed at health and comfort.',
    passageIds: ['bs-99-6-bava'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: MUHURTA_BOUNDARY,
  },
  {
    id: 'bs-muhurta-kimstughna-favourable', traditionId: 'vedic-jyotisha', technique: 'karaṇa selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.karana', description: 'The karaṇa current at the moment under consideration is Kiṃstughna.', requiresLimb: { limb: 'karana', anyOf: ['Kiṃstughna'] }, derivation: 'direct' }],
    interpretation: 'The tradition holds that the Kiṃstughna karaṇa suits work for health and comfort and auspicious undertakings generally.',
    passageIds: ['bs-99-8-kimstughna'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: MUHURTA_BOUNDARY,
  },
  {
    id: 'bs-tithi-groups', traditionId: 'vedic-jyotisha', technique: 'tithi selection', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.tithi', description: 'The tithi current at the moment under consideration, taken within its fortnight.', derivation: 'direct' }],
    interpretation: 'The tradition sorts the fifteen tithis of a fortnight into five named groups — Nandā, Bhadrā, Vijayā, Riktā and Pūrṇā — which later practice treats as the basis for selecting or avoiding a lunar day, Riktā being the group generally avoided.',
    passageIds: ['bs-99-2-tithi-groups'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Verse 2 names the five groups without ranking them, but Chapter 98 verse 13 prohibits an act on Riktā tithis, so the avoidance of Riktā is Varāhamihira’s own and not purely later doctrine. An earlier revision of this record claimed otherwise and was corrected when the further chapter was transcribed.'],
    boundary: `${MUHURTA_BOUNDARY} The grouping is transcribed from the source; the avoidance ranking attached to it is later practice and is flagged as such in the recorded disagreement.`,
  },
  {
    id: 'bs-fixed-karana-placement', traditionId: 'vedic-jyotisha', technique: 'karaṇa structure', chartTypes: ['electional', 'natal'],
    conditions: [{ factField: 'panchanga.karana', description: 'The position of the four fixed karaṇas within the lunar month.', derivation: 'direct' }],
    interpretation: 'The tradition places the four fixed karaṇas — Śakuni, Catuṣpada, Nāga and Kiṃstughna — beginning from the second half of the fourteenth day of the waning moon.',
    passageIds: ['bs-99-5-fixed-karanas'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: 'This is a structural claim about the calendar rather than a judgement about a moment, and it is one of the few places where a classical text can be checked directly against the computation: `test/panchanga.test.ts` asserts that the implemented karaṇa sequence puts Śakuni at exactly this point. Agreement confirms the arithmetic matches the tradition; it says nothing about whether the tradition predicts anything.',
  },
  {
    id: 'bj-planetary-tenth-house-avocation', traditionId: 'vedic-jyotisha', technique: 'avocation from house placement', chartTypes: ['natal'],
    conditions: [{ factField: 'vedicChart.wholeSignHouses.10.occupants', description: 'At least one classical planet occupies the tenth whole-sign house from the ascendant or from the Moon.', derivation: 'requires-derivation' }],
    interpretation: 'The text maps the planet occupying the tenth house from the ascendant or Moon to an asserted source of wealth: Sun to father, Moon to mother, Mars to enemy, Mercury to friend, Jupiter to brother, Venus to wife, and Saturn to servant.',
    passageIds: ['bj-10-1-planets-tenth-house'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The verse gives a compact one-to-one list and does not state how to resolve several occupants or disagreement between the tenth house from the ascendant and the tenth from the Moon; the translator’s note says several occupants indicate several sources.'],
    boundary: 'Recorded as historical doctrine, not as a reliable account of income, relationships, or work. It must not inform financial, employment, or relationship decisions, and the report compiler withholds it independently of practitioner review.',
    sourceBoundCoverage: { area: 'planetary-house-placement', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'bj-tenth-house-ruler-navamsa', traditionId: 'vedic-jyotisha', technique: 'avocation from house ruler', chartTypes: ['natal'],
    conditions: [{ factField: 'vedicChart.tenthHouseLord.navamsaLord', description: 'No planet occupies the tenth house; derive the Navāṃśa lord occupied by each tenth-house lord counted from the ascendant, Moon, and Sun.', derivation: 'requires-derivation' }],
    interpretation: 'When no planet occupies the relevant tenth house, the text directs the reader to infer avocation from the planet ruling the Navāṃśa occupied by the lord of the tenth house, considered from the ascendant, Moon, and Sun.',
    passageIds: ['bj-10-1-tenth-lord-navamsa'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['This formalization treats “no such planet” as a prerequisite. A practitioner must review whether the fallback is evaluated separately for each of the three reference points or only when all three relevant houses are empty.'],
    boundary: 'Recorded as historical doctrine, not as a reliable description of occupation or earning capacity. The unresolved fallback semantics are preserved, and the report compiler withholds this technique independently of practitioner review.',
    sourceBoundCoverage: { area: 'house-rulers', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'bj-natal-ashwini-moon', traditionId: 'vedic-jyotisha', technique: 'natal nakshatra interpretation', chartTypes: ['natal'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'At birth, the Moon occupies Aśvinī.', requiresLimb: { limb: 'nakshatra', anyOf: ['Aśvinī'] }, derivation: 'direct' }],
    interpretation: 'The text attributes fondness for ornaments, fine appearance, popularity, skill in work, and intelligence to a birth with the Moon in the asterism it calls Aswini.',
    passageIds: ['bj-16-1-ashwini'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['This is a whole-nakshatra statement. Later practice may qualify it by pāda, lordship, aspects, conjunctions, and daśā, none of which appears in the cited stanza.'],
    boundary: 'Preserved as historical doctrine only. There is no evidence that a lunar mansion determines appearance, popularity, intelligence, capability, or behaviour; this technique is prohibited from generated reports even after source and rule review.',
    sourceBoundCoverage: { area: 'nakshatra-interpretation', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'bj-musala-asraya-yoga', traditionId: 'vedic-jyotisha', technique: 'explicit yoga definition', chartTypes: ['natal', 'mundane', 'corporate'],
    conditions: [{ factField: 'vedicChart.classicalPlanets.signModalities', description: 'All seven classical planets occupy fixed signs under the selected interpretation of the source note.', derivation: 'requires-derivation' }],
    interpretation: 'The text names the configuration in which all planets occupy fixed signs Musala yoga and places it in the Āśraya group of Nabhasa yogas.',
    passageIds: ['bj-12-2-musala-yoga', 'bj-12-2-asraya-variant'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The translator’s note records a live source disagreement: one reading permits occupation of one, two, three, or all four fixed signs, while another requires all four fixed signs to be occupied; Garga is cited against the latter. This rule requires all planets to be in the fixed modality but does not require all four fixed signs.'],
    boundary: 'This rule only detects and names a configuration. It does not assign an outcome. The seven-planet scope, treatment of the lunar nodes, and disputed all-four-sign requirement require practitioner review before publication.',
    sourceBoundCoverage: { area: 'explicit-yogas', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'bj-dasha-lord-upachaya', traditionId: 'vedic-jyotisha', technique: 'daśā interpretation', chartTypes: ['natal'],
    conditions: [{ factField: 'vedicTiming.activeDashaLord.houseFromDashaLagna', description: 'At the start of the daśā, its lord occupies the third, sixth, tenth, or eleventh house from the daśā commencement ascendant.', derivation: 'requires-derivation' }],
    interpretation: 'For the encoded branch of stanza 10, the text calls a daśā prosperous when its lord occupies the third, sixth, tenth, or eleventh house from the ascendant cast for the commencement of that period.',
    passageIds: ['bj-8-10-dasha-upachaya'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The translator’s note says “Lagna” here means the ascendant at the daśā commencement, not necessarily the natal ascendant. The note also says the rule may apply to an antardaśā. Both convention choices remain unresolved pending review.'],
    boundary: 'The daśā timetable and commencement chart can be computed reproducibly, but “prosperous” is an unvalidated historical judgement. It is not a financial forecast or assurance and must not guide financial or other high-stakes decisions.',
    sourceBoundCoverage: { area: 'dasha-interpretation', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'bj-moon-ashtakavarga-zero-transit', traditionId: 'vedic-jyotisha', technique: 'Aṣṭakavarga transit interpretation', chartTypes: ['electional', 'natal'],
    conditions: [{ factField: 'vedicTiming.moonTransit.bhinnaAshtakavargaBindus', description: 'The transiting Moon occupies a sign carrying zero bindus in the Moon’s Bhinna Aṣṭakavarga.', derivation: 'requires-derivation' }],
    interpretation: 'The text directs that work not be commenced while the Moon transits a sign containing no figure in the Moon’s Aṣṭakavarga.',
    passageIds: ['bj-9-moon-zero-bindus'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The cited edition abbreviates the method as A.V. and assumes the chapter’s preceding reduction procedure. The exact Aṣṭakavarga calculation and whether later correction methods apply must be fixed as a reviewed calculation convention before this condition is executable.'],
    boundary: 'Recorded as historical transit doctrine, not evidence that such a transit changes outcomes. The condition remains non-executable until an independently tested Aṣṭakavarga implementation and practitioner-reviewed convention profile exist.',
    sourceBoundCoverage: { area: 'transit-interpretation', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'bs-dhruva-mundane-foundation', traditionId: 'vedic-jyotisha', technique: 'mundane foundation timing', chartTypes: ['mundane'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'The mundane foundation moment has the Moon in a stable (Dhruva) nakshatra.', requiresLimb: { limb: 'nakshatra', anyOf: ['Uttara Phalgunī', 'Uttara Āṣāḍhā', 'Uttara Bhādrapadā', 'Rohiṇī'] }, derivation: 'direct' }],
    interpretation: 'For undertakings intended to endure, the source includes building towns and acts of public utility among works to begin while the Moon passes through a stable nakshatra.',
    passageIds: ['bs-98-6-dhruva-list', 'bs-98-6-dhruva-acts'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The source describes selecting a commencement moment, not interpreting every mundane chart retrospectively. The rule is therefore limited to a declared foundation event.'],
    boundary: `${MUHURTA_BOUNDARY} The words “building of towns” and “acts of public utility” are historical categories and are not generalized to every public or institutional event.`,
    sourceBoundCoverage: { area: 'mundane-corporate-charts', doctrineStatus: 'historical-doctrine', publicationGate: 'practitioner-review-required' },
  },
  {
    id: 'maha-dhruva-corporate-incorporation', traditionId: 'vedic-jyotisha', technique: 'corporate foundation timing', chartTypes: ['corporate'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'The legal incorporation moment has the Moon in a stable (Dhruva) nakshatra.', requiresLimb: { limb: 'nakshatra', anyOf: ['Uttara Phalgunī', 'Uttara Āṣāḍhā', 'Uttara Bhādrapadā', 'Rohiṇī'] }, derivation: 'direct' }],
    interpretation: 'Maha’s synthesis treats legal incorporation as a modern foundation event and tests whether the source’s stable-nakshatra category for permanent works can be operationalized for corporate charts.',
    passageIds: ['bs-98-6-dhruva-list', 'bs-98-6-dhruva-acts'], provenance: 'maha-inference', empirical: UNVALIDATED,
    disagreements: ['Varāhamihira does not mention corporations or legal incorporation. This is a contemporary testable extension from building towns, public works, and acts intended to have permanent effects; a reviewer must judge the analogy separately from transcription fidelity.'],
    boundary: 'This is explicitly Maha’s synthesis, not classical doctrine. It must be preregistered and tested against corporate outcomes before any predictive claim; it cannot guide legal, investment, or financial decisions and carries no assurance about a company’s future.',
    sourceBoundCoverage: { area: 'mundane-corporate-charts', doctrineStatus: 'maha-synthesis', publicationGate: 'practitioner-review-required' },
  },
  ...JYOTISHA_EXPANSION_RULES,
  {
    id: 'ptb-planet-nature-benefic', traditionId: 'hellenistic-ptolemaic', technique: 'planetary nature', chartTypes: ['natal', 'mundane'],
    conditions: [{ factField: 'subject.identifiers', description: 'Jupiter or Venus is present in the chart.', requiresSubjects: ['Jupiter', 'Venus'], derivation: 'direct' }],
    interpretation: 'The tradition classes Jupiter and Venus as benefic, deriving the classification from a predominance of the heat and moisture held to be nutritive.',
    passageIds: ['ptb-1-5-benefic'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Later traditions treat benefic and malefic as contextual rather than fixed, conditioning the classification on sect, dignity, and house placement.'],
    boundary: 'A classification internal to the tradition’s elemental physics. The underlying qualitative theory of heat, cold, moisture, and dryness is not a description of the planets as understood by astronomy.',
  },
  {
    id: 'ptb-planet-nature-malefic', traditionId: 'hellenistic-ptolemaic', technique: 'planetary nature', chartTypes: ['natal', 'mundane'],
    conditions: [{ factField: 'subject.identifiers', description: 'Saturn or Mars is present in the chart.', requiresSubjects: ['Saturn', 'Mars'], derivation: 'direct' }],
    interpretation: 'The tradition classes Saturn and Mars as malefic, attributing the classification to an excess of cold in Saturn and an excess of dryness in Mars.',
    passageIds: ['ptb-1-5-malefic'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Psychological astrology of the 20th century generally rejects the benefic/malefic division as a description of outcomes.'],
    boundary: 'A classification internal to the tradition’s elemental physics, not a claim that these planets produce harm.',
  },
  {
    id: 'ptb-planet-nature-common', traditionId: 'hellenistic-ptolemaic', technique: 'planetary nature', chartTypes: ['natal', 'mundane'],
    conditions: [{ factField: 'subject.identifiers', description: 'The Sun or Mercury is present in the chart.', requiresSubjects: ['Sun', 'Mercury'], derivation: 'direct' }],
    interpretation: 'The tradition treats the Sun and Mercury as of common influence, taking their effect from the planets they are configured with rather than from a fixed nature.',
    passageIds: ['ptb-1-5-common'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Some Hellenistic authors treat the Sun as malefic when too close to another planet, a condition Ptolemy does not frame this way here.'],
    boundary: 'Recorded as doctrine of the named tradition; the conditional framing is Ptolemy’s, not a general rule of Western astrology.',
  },
  {
    id: 'ptb-planet-gender-feminine', traditionId: 'hellenistic-ptolemaic', technique: 'planetary gender', chartTypes: ['natal'],
    conditions: [{ factField: 'subject.identifiers', description: 'The Moon or Venus is present in the chart.', requiresSubjects: ['Moon', 'Venus'], derivation: 'direct' }],
    interpretation: 'The tradition assigns the Moon and Venus to the feminine category on the grounds that their qualities are principally moist.',
    passageIds: ['ptb-1-6-feminine'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The gendered classification of planets is rejected or reinterpreted as symbolic polarity across most contemporary practice.'],
    boundary: 'A 2nd-century classification recorded for historical accuracy. It reflects the gender assumptions of its period, carries no evidential weight, and must not be applied to any person or used to infer anything about sex or gender.',
  },
  {
    id: 'ptb-planet-gender-masculine', traditionId: 'hellenistic-ptolemaic', technique: 'planetary gender', chartTypes: ['natal'],
    conditions: [{ factField: 'subject.identifiers', description: 'The Sun, Saturn, Jupiter, or Mars is present in the chart.', requiresSubjects: ['Sun', 'Saturn', 'Jupiter', 'Mars'], derivation: 'direct' }],
    interpretation: 'The tradition assigns the Sun, Saturn, Jupiter, and Mars to the masculine category, and treats Mercury as common to both because it produces dryness and moisture in equal ratio.',
    passageIds: ['ptb-1-6-masculine'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The gendered classification of planets is rejected or reinterpreted as symbolic polarity across most contemporary practice.'],
    boundary: 'A 2nd-century classification recorded for historical accuracy. It reflects the gender assumptions of its period, carries no evidential weight, and must not be applied to any person or used to infer anything about sex or gender.',
  },
  {
    id: 'ptb-genethlialogy-scope', traditionId: 'hellenistic-ptolemaic', technique: 'scope of nativities', chartTypes: ['natal'],
    conditions: [{ factField: 'time.utcInstant', description: 'A birth moment is given.', derivation: 'direct' }],
    interpretation: 'The tradition names the study of individual nativities Genethlialogy and separates it from the general or mundane inquiry treated earlier in the work.',
    passageIds: ['ptb-3-1-genethlialogy'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: [],
    boundary: 'A definition of the tradition’s own scope. It records how the text divides its subject and asserts nothing about what a birth chart can show.',
  },
  {
    id: 'ptb-life-precedence', traditionId: 'hellenistic-ptolemaic', technique: 'order of judgement', chartTypes: ['natal'],
    conditions: [{ factField: 'time.utcInstant', description: 'A birth moment is given.', derivation: 'direct' }],
    interpretation: 'The tradition holds that the question of the duration of life is taken up before all other post-natal questions, on the reasoning that other predictions are moot without it.',
    passageIds: ['ptb-3-11-life'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Contemporary practice generally abandons length-of-life technique entirely, on both evidential and ethical grounds.'],
    boundary: 'Recorded as the structure of a historical text. Maha does not publish length-of-life judgements, and no report may generate one: see the prohibited uses attached to this layer.',
  },
  {
    id: 'ptb-prorogatory-places', traditionId: 'hellenistic-ptolemaic', technique: 'prorogation', chartTypes: ['natal'],
    conditions: [
      { factField: 'coordinates.values', description: 'Ecliptic longitudes of the angles are computed.', derivation: 'requires-derivation' },
      { factField: 'observer.position', description: 'Observer latitude is known, since the angles depend on it.', derivation: 'requires-derivation' },
    ],
    interpretation: 'The tradition restricts the prorogatory places to a defined set, beginning with the region of the ascendant running from five degrees above the horizon to twenty-five degrees below it.',
    passageIds: ['ptb-3-12-prorogatory'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['The set of prorogatory places and their ordering differ between Ptolemy and other Hellenistic authors, and the technique is not used in most modern practice.'],
    boundary: 'A technical specification internal to the tradition. It is reproducible as geometry from the fact layer; that reproducibility says nothing about whether the technique means anything.',
  },
  {
    id: 'ptb-body-saturn', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Saturn holds dominion and is oriental to the Sun.', requiresSubjects: ['Saturn'], derivation: 'requires-derivation' }],
    interpretation: 'The tradition holds that Saturn oriental gives a yellowish complexion, black curled hair, a broad chest, and proportionate size.',
    passageIds: ['ptb-3-16-saturn'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-jupiter', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Jupiter holds dominion and is oriental to the Sun.', requiresSubjects: ['Jupiter'], derivation: 'requires-derivation' }],
    interpretation: 'The tradition holds that Jupiter oriental gives a fair and clear complexion, moderate hair, large eyes, and dignified stature.',
    passageIds: ['ptb-3-16-jupiter'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-mars', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Mars holds dominion and is ascending.', requiresSubjects: ['Mars'], derivation: 'requires-derivation' }],
    interpretation: 'The tradition holds that Mars ascending gives ruddiness, large size, blue or grey eyes, and a sturdy figure.',
    passageIds: ['ptb-3-16-mars'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-venus', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Venus holds dominion over the form.', requiresSubjects: ['Venus'], derivation: 'requires-derivation' }],
    interpretation: 'The tradition holds that Venus works as Jupiter does but more gracefully, and is said to make the eyes beautiful and azure.',
    passageIds: ['ptb-3-16-venus'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-body-mercury', traditionId: 'hellenistic-ptolemaic', technique: 'bodily form', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'Mercury holds dominion and is oriental to the Sun.', requiresSubjects: ['Mercury'], derivation: 'requires-derivation' }],
    interpretation: 'The tradition holds that Mercury oriental gives a yellowish complexion, proportionate and well-shaped stature, small eyes, and moderate hair.',
    passageIds: ['ptb-3-16-mercury'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Physical-description technique is abandoned in most contemporary practice.'],
    boundary: DESCRIPTIVE_BOUNDARY,
  },
  {
    id: 'ptb-injury-angles', traditionId: 'hellenistic-ptolemaic', technique: 'bodily injury', chartTypes: ['natal'],
    conditions: [{ factField: 'coordinates.values', description: 'The ascendant and descendant are computed, and malefic configurations to them are examined.', derivation: 'requires-derivation' }],
    interpretation: 'The tradition directs that the ascendant and western angle be examined first when the question concerns bodily injury or disease.',
    passageIds: ['ptb-3-17-injury-angles'], provenance: 'restates-source', empirical: UNVALIDATED,
    disagreements: ['Medical application of astrology is rejected by contemporary medicine and by most contemporary astrological practice.'],
    boundary: 'Recorded as historical doctrine only. This rule must never contribute to a health statement of any kind: medical diagnosis, prognosis, and treatment are prohibited uses of this layer without exception.',
  },
  {
    id: 'ptb-mind-mercury', traditionId: 'hellenistic-ptolemaic', technique: 'quality of mind', chartTypes: ['natal'],
    conditions: [
      { factField: 'coordinates.values', description: 'The position of Mercury is computed.', requiresSubjects: ['Mercury'], derivation: 'requires-derivation' },
      { factField: 'coordinates.values', description: 'The position of the Moon and its applications and separations are computed.', requiresSubjects: ['Moon'], derivation: 'requires-derivation' },
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
        sourceBoundCoverage: {
          type: 'object', additionalProperties: false,
          required: ['area', 'doctrineStatus', 'publicationGate'],
          properties: {
            area: { enum: JYOTISHA_COVERAGE_AREAS },
            doctrineStatus: { enum: ['historical-doctrine', 'translator-commentary', 'contemporary-practice', 'maha-synthesis'] },
            publicationGate: { const: 'practitioner-review-required' },
          },
        },
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

    if (rule.sourceBoundCoverage) {
      if (rule.traditionId !== 'vedic-jyotisha') throw new Error(`${rule.id} claims Jyotiṣa source-bound coverage outside the Jyotiṣa tradition.`)
      if (rule.sourceBoundCoverage.publicationGate !== 'practitioner-review-required') throw new Error(`${rule.id} must remain practitioner-review gated.`)
      const synthesis = rule.sourceBoundCoverage.doctrineStatus === 'maha-synthesis'
      if (synthesis !== (rule.provenance === 'maha-inference')) throw new Error(`${rule.id} must keep Maha synthesis and Maha inference provenance aligned.`)
    }

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
