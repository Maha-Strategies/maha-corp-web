import type { AstrologyPassage, InterpretationRule } from './astrology-traditions.ts'

const BS = 'brihat-samhita-iyer'
const BJ = 'brihat-jataka-iyer-1885'

const GATE = {
  doctrineStatus: 'historical-doctrine',
  publicationGate: 'practitioner-review-required',
} as const

const CALENDAR_BOUNDARY = 'This is a source classification layered on a reproducibly calculated pañcāṅga value. It records Varāhamihira’s convention, not evidence that the classification changes outcomes. Publication remains gated on source-fidelity and rule-formalization review.'
const NATAL_BOUNDARY = 'Preserved as historical whole-nakshatra doctrine only. It is prohibited from generated reports because it claims that a chart determines personality, capability, behaviour, appearance, wealth, family, or health. Later qualifications are absent from the cited stanza.'
const AVOCATION_BOUNDARY = 'Preserved as historical doctrine only. It is prohibited from generated reports because it asserts a source of wealth from a chart and must not inform financial, employment, family, or relationship decisions.'

export const JYOTISHA_EXPANSION_PASSAGES: AstrologyPassage[] = [
  {
    id: 'bs-98-7-tikshna-list', sourceId: BS, locator: 'Chapter 98, verse 7 — On the constellations',
    excerpt: 'The constellations (nakṣatra) of Mūla, Ārdrā, Jyeṣṭhā and Āśleṣā are known as (Tīkṣṇa) sharp asterisms.',
    transcriptionNote: 'The harmful activities in the remainder of the verse are intentionally not operationalized. This passage supports classification only.',
  },
  {
    id: 'bs-98-8-ugra-list', sourceId: BS, locator: 'Chapter 98, verse 8 — On the constellations',
    excerpt: 'The constellations (nakṣatra) of Pūrvaphālguni, Pūrvāṣāḍha, Pūrvabhādrapada, Bharaṇī and Maghā are known as (Uggra) severe asterisms.',
    transcriptionNote: 'The edition spells the class “Uggra”. The harmful activities in the remainder of the verse are intentionally not operationalized.',
  },
  {
    id: 'bs-98-11-mixed-list', sourceId: BS, locator: 'Chapter 98, verse 11 — On the constellations',
    excerpt: 'The constellations (nakṣatra) of Kṛttikā and Viśākhā are known as (Mṛdu-Tīkṣṇa) soft and sharp asterisms and they produce effects of mixed character.',
  },
  {
    id: 'bs-98-11-moving-list', sourceId: BS, locator: 'Chapter 98, verse 11 — On the constellations',
    excerpt: 'Śravaṇa, Dhaniṣṭhā, Śatabhiṣaj. Hasta and Svāti are asterisms through which when the Moon passes shall be commenced works of a moving character.',
    transcriptionNote: 'The full stop after “Śatabhiṣaj” is preserved from the cited transcription. Hasta also appears in the Laghu list in verse 9; the rule registry preserves both classifications.',
  },
  {
    id: 'bs-98-12-shaving-nakshatras', sourceId: BS, locator: 'Chapter 98, verses 12–13 — On the constellations',
    excerpt: 'A person shall get shaved when the asterism of Hasta, Citrā, Dhaniṣṭhā, Svāti, Mṛgaśīrṣa, Śravaṇa, Śatabhiṣaj, Revatī, Aśvinī, Jyeṣṭhā, Puṣya or Punarvasu may happen to rise or in the Muhūrta of such asterisms or when the Moon passes through them',
    transcriptionNote: 'The excerpt ends before the verse’s alternative natal-count condition. The encoded rule represents only the directly computable Moon-transit branch.',
  },
  {
    id: 'bs-98-16-purification-criteria', sourceId: BS, locator: 'Chapter 98, verse 16 — On the constellations',
    excerpt: 'The various ceremonies of purification, religious rites, the practice of austerities and the wearing of Zone or the Sacred belt shall be commenced when the Moon passes through the asterism of Hasta, Revatī, Svāti, Anurādhā, Puṣya and Citrā, and when Jupiter is in conjunction with Mercury, Venus or the Moon.',
  },
  ...[
    ['bharani', 2, 157, 199, 'Bharani', 'A person born when the Moon passes through the asterism of Bharani will be successful at work, truthful, free from diseases, able and free from grief.'],
    ['krittika', 3, 157, 199, 'Krittika', 'A person born when the Moon passes through the asterism of Krittika will be a glutton, fond of the wives of other men, of bright appearance and of wide-spread fame.'],
    ['rohini', 4, 158, 200, 'Rohini', 'A person born when the Moon passes through the asterism of Rohini will be truthful, will not covet the property of other men, will be of cleanly habits, of sweet speech, of firm views, and of fine appearance.'],
    ['mrigasirsha', 5, 158, 200, 'Mrigasirsha', 'A person born when the Moon passes through the asterism of Mrigasirsha will be of no firm principles, will be able, timid, of good speech, of active habits, rich and will indulge in sexual pleasures.'],
    ['ardra', 6, 158, 200, 'Ardra', 'A person born when the Moon passes through the asterism of Ardra will be insincere, of irascible temper, ungrateful, troublesome and addicted to wicked deeds.'],
    ['punarvasu', 7, 158, 200, 'Punarvasu', 'A person born when the Moon passes through the asterism of Punarvasu will be devout and of patient habits, will live in comfort, will be good-natured, quiet, of wrong views, sickly, thirsty and pleased with trifles.'],
    ['pushya', 8, 158, 200, 'Pushya', 'A person born when the Moon passes through the asterism of Pushya will have a control over his desires, will be generally liked, learned in the Sastras, rich and will be found of acts of charity.'],
    ['aslesha', 9, 158, 200, 'Aslesha', 'A person born when the Moon passes through the asterism of Aslesha will not be attentive to the work of other men, will be a promiscuous eater, will be sinful, ungrateful and skilled in cheating other men.'],
    ['magha', 10, 158, 200, 'Magha', 'A person born when the Moon passes through the asterism of Magha will have numerous servants, will worship the Devas and Pitris and will be engaged in important works.'],
    ['purva-phalguni', 11, 158, 200, 'P. Phalguni', 'A person born when the Moon passes through the asterism of P. Phalguni will be of sweet speech, will be liberal in his gifts, of wandering habits and will serve under kings.'],
    ['uttara-phalguni', 12, 158, 200, 'U. Phalguni', 'A person born when the Moon passes through the asterism of U. Phalguni will be generally liked, will earn money by his learning and will live in comfort.'],
    ['hasta', 13, 158, 200, 'Hasta', 'A person born when the Moon passes through the asterism of Hasta will be of active habits, full of resources, shameless, merciless and a thief and a drunkard.'],
    ['chittra', 14, 158, 200, 'Chittra', 'A person born when the Moon passes through the asterism of Chittra will wear cloths and flowers of various colors and will have beautiful eyes and limbs.'],
    ['swati', 15, 158, 200, 'Swati', 'A person born when the Moon passes through the asterism of Swati will be of a mild and quiet nature, will control his passion, will be skilled in trade, will be merciful, unable to bear thirst, of sweet speech and disposed to do acts of charity.'],
    ['visakha', 16, 159, 201, 'Visakha', 'A person born when the Moon passes through the asterism of Visakha will be jealous of another’s prosperity, will be a niggard, of bright appearance, of distinct speech, skilled in earning money and disposed to bring about quarrels among men.'],
    ['anuradha', 17, 159, 201, 'Anuradha', 'A person born when the Moon passes through the asterism of Anuradha will be rich, will live in foreign lands, will be unable to bear hunger and disposed to wander from place to place.'],
    ['jyeshta', 18, 159, 201, 'Jyeshta', 'A person born when the Moon passes through the asterism of Jyeshta will have few friends, will be very cheerful, virtuous, and of irascible temper.'],
    ['moola', 19, 159, 201, 'Moola', 'A person born when the Moon passes through the asterism of Moola will be haughty, rich, happy, not disposed to injure other men, of firm views and will live in luxury.'],
    ['purva-ashadha', 20, 159, 201, 'P. Ashadha', 'A person born when the Moon passes through the asterism of P. Ashadha will have an agreeable wife, will be proud and attached to friends.'],
    ['uttara-ashadha', 21, 159, 201, 'U. Ashadha', 'A person born when the Moon passes through the asterism of U. Ashadha will be obedient, will be learned in the rules of virtue, will possess many friends, will be grateful and return favors received and will be generally liked.'],
    ['sravana', 22, 159, 201, 'Sravana', 'A person born when the Moon passes through the asterism of Sravana will be prosperous and learned, will have a liberal-minded wife, will be rich and of wide-spread fame.'],
    ['dhanishta', 23, 159, 201, 'Dhanishta', 'A person born when the Moon passes through the asterism of Dhanishta will be liberal in gifts, rich, valient, fond of music and will be a niggard.'],
    ['satabhishak', 24, 159, 201, 'Satabhishak', 'A person born when the Moon passes through the asterism of Satabhishak will be harsh in his speech, will be truthful will suffer grief will conquer his enemies, will thoughtlessly engage in work and will be of independent ways.'],
    ['purva-bhadrapada', 25, 159, 201, 'P. Bhadrapada', 'A person born when the Moon passes through the asterism of P. Bhadrapada will suffer from grief, will place his wealth at the disposal of his wife, will be of distinct speech, will be skilled in earning money and will be a niggard.'],
    ['uttara-bhadrapada', 26, 160, 202, 'U. Bhadrapada', 'A person born when the Moon passes through the asterism of U. Bhadrapada will be an able speaker, will be happy, will possess children and grand-children will conquer his enemies and will be virtuous.'],
    ['revati', 27, 160, 202, 'Revati', 'A person born when the Moon passes through the asterism of Revati will possess perfect limbs, will be liked by all the people, will be deeply learned, will never covet the property of other men and will be rich.'],
  ].map(([slug, stanza, page, image, sourceName, excerpt]) => ({
    id: `bj-16-${stanza}-${slug}`,
    sourceId: BJ,
    locator: `Chapter XVI, stanza ${stanza}, printed page ${page} (scan image ${image}) — On the Nakshatras`,
    excerpt: String(excerpt),
    transcriptionNote: `Checked against the page image. The edition spelling “${sourceName}” is preserved; the corresponding rule records the calculator’s canonical form. Historical typographic irregularities are not silently modernized.`,
  })),
]

type NakshatraClass = { name: string; classes: string[]; passageIds: string[] }

const NAKSHATRA_CLASSES: NakshatraClass[] = [
  { name: 'Aśvinī', classes: ['Laghu (light)'], passageIds: ['bs-98-9-laghu-list'] },
  { name: 'Bharaṇī', classes: ['Ugra (severe)'], passageIds: ['bs-98-8-ugra-list'] },
  { name: 'Kṛttikā', classes: ['Mṛdu-Tīkṣṇa (soft-sharp/mixed)'], passageIds: ['bs-98-11-mixed-list'] },
  { name: 'Rohiṇī', classes: ['Dhruva (stable)'], passageIds: ['bs-98-6-dhruva-list'] },
  { name: 'Mṛgaśīrṣa', classes: ['Mṛdu (soft)'], passageIds: ['bs-98-10-mridu-list'] },
  { name: 'Ārdrā', classes: ['Tīkṣṇa (sharp)'], passageIds: ['bs-98-7-tikshna-list'] },
  { name: 'Punarvasu', classes: ['unclassified in verses 6–11'], passageIds: ['bs-98-6-dhruva-list', 'bs-98-7-tikshna-list', 'bs-98-8-ugra-list', 'bs-98-9-laghu-list', 'bs-98-10-mridu-list', 'bs-98-11-mixed-list', 'bs-98-11-moving-list'] },
  { name: 'Puṣya', classes: ['Laghu (light)'], passageIds: ['bs-98-9-laghu-list'] },
  { name: 'Āśleṣā', classes: ['Tīkṣṇa (sharp)'], passageIds: ['bs-98-7-tikshna-list'] },
  { name: 'Maghā', classes: ['Ugra (severe)'], passageIds: ['bs-98-8-ugra-list'] },
  { name: 'Pūrva Phalgunī', classes: ['Ugra (severe)'], passageIds: ['bs-98-8-ugra-list'] },
  { name: 'Uttara Phalgunī', classes: ['Dhruva (stable)'], passageIds: ['bs-98-6-dhruva-list'] },
  { name: 'Hasta', classes: ['Laghu (light)', 'moving'], passageIds: ['bs-98-9-laghu-list', 'bs-98-11-moving-list'] },
  { name: 'Citrā', classes: ['Mṛdu (soft)'], passageIds: ['bs-98-10-mridu-list'] },
  { name: 'Svātī', classes: ['moving'], passageIds: ['bs-98-11-moving-list'] },
  { name: 'Viśākhā', classes: ['Mṛdu-Tīkṣṇa (soft-sharp/mixed)'], passageIds: ['bs-98-11-mixed-list'] },
  { name: 'Anurādhā', classes: ['Mṛdu (soft)'], passageIds: ['bs-98-10-mridu-list'] },
  { name: 'Jyeṣṭhā', classes: ['Tīkṣṇa (sharp)'], passageIds: ['bs-98-7-tikshna-list'] },
  { name: 'Mūla', classes: ['Tīkṣṇa (sharp)'], passageIds: ['bs-98-7-tikshna-list'] },
  { name: 'Pūrva Āṣāḍhā', classes: ['Ugra (severe)'], passageIds: ['bs-98-8-ugra-list'] },
  { name: 'Uttara Āṣāḍhā', classes: ['Dhruva (stable)'], passageIds: ['bs-98-6-dhruva-list'] },
  { name: 'Śravaṇa', classes: ['moving'], passageIds: ['bs-98-11-moving-list'] },
  { name: 'Dhaniṣṭhā', classes: ['moving'], passageIds: ['bs-98-11-moving-list'] },
  { name: 'Śatabhiṣā', classes: ['moving'], passageIds: ['bs-98-11-moving-list'] },
  { name: 'Pūrva Bhādrapadā', classes: ['Ugra (severe)'], passageIds: ['bs-98-8-ugra-list'] },
  { name: 'Uttara Bhādrapadā', classes: ['Dhruva (stable)'], passageIds: ['bs-98-6-dhruva-list'] },
  { name: 'Revatī', classes: ['Mṛdu (soft)'], passageIds: ['bs-98-10-mridu-list'] },
]

const TITHI_GROUPS = [
  ['Pratipadā', 'Nandā'], ['Dvitīyā', 'Bhadrā'], ['Tṛtīyā', 'Vijayā'], ['Caturthī', 'Riktā'], ['Pañcamī', 'Pūrṇā'],
  ['Ṣaṣṭhī', 'Nandā'], ['Saptamī', 'Bhadrā'], ['Aṣṭamī', 'Vijayā'], ['Navamī', 'Riktā'], ['Daśamī', 'Pūrṇā'],
  ['Ekādaśī', 'Nandā'], ['Dvādaśī', 'Bhadrā'], ['Trayodaśī', 'Vijayā'], ['Caturdaśī', 'Riktā'], ['Pūrṇimā|Amāvāsyā', 'Pūrṇā'],
] as const

const KARANA_LORDS = [
  ['Bava', 'Indra'], ['Bālava', 'Brahmā'], ['Kaulava', 'Mitra'], ['Taitila', 'Aryaman'], ['Gara', 'Bhū'], ['Vaṇija', 'Śrī'], ['Viṣṭi', 'Yama'],
] as const

const FIXED_KARANAS = ['Śakuni', 'Catuṣpada', 'Nāga', 'Kiṃstughna'] as const

const NATAL_NAKSHATRAS = [
  ['Bharaṇī', 'bharani', 2], ['Kṛttikā', 'krittika', 3], ['Rohiṇī', 'rohini', 4], ['Mṛgaśīrṣa', 'mrigasirsha', 5],
  ['Ārdrā', 'ardra', 6], ['Punarvasu', 'punarvasu', 7], ['Puṣya', 'pushya', 8], ['Āśleṣā', 'aslesha', 9],
  ['Maghā', 'magha', 10], ['Pūrva Phalgunī', 'purva-phalguni', 11], ['Uttara Phalgunī', 'uttara-phalguni', 12],
  ['Hasta', 'hasta', 13], ['Citrā', 'chittra', 14], ['Svātī', 'swati', 15], ['Viśākhā', 'visakha', 16],
  ['Anurādhā', 'anuradha', 17], ['Jyeṣṭhā', 'jyeshta', 18], ['Mūla', 'moola', 19], ['Pūrva Āṣāḍhā', 'purva-ashadha', 20],
  ['Uttara Āṣāḍhā', 'uttara-ashadha', 21], ['Śravaṇa', 'sravana', 22], ['Dhaniṣṭhā', 'dhanishta', 23],
  ['Śatabhiṣā', 'satabhishak', 24], ['Pūrva Bhādrapadā', 'purva-bhadrapada', 25],
  ['Uttara Bhādrapadā', 'uttara-bhadrapada', 26], ['Revatī', 'revati', 27],
] as const

const AVOCATION_MAP = [
  ['Sun', 'father'], ['Moon', 'mother'], ['Mars', 'enemy'], ['Mercury', 'friend'], ['Jupiter', 'brother'], ['Venus', 'wife'], ['Saturn', 'servant'],
] as const

const activityRule = (id: string, label: string, names: string[], passageIds: string[], interpretation: string): InterpretationRule => ({
  id, traditionId: 'vedic-jyotisha', technique: 'nakshatra activity doctrine', chartTypes: ['electional'],
  conditions: [{ factField: 'panchanga.nakshatra', description: `The Moon occupies a ${label} nakshatra.`, requiresLimb: { limb: 'nakshatra', anyOf: names }, derivation: 'direct' }],
  interpretation, passageIds, provenance: 'restates-source', empirical: 'unvalidated-tradition', disagreements: [], boundary: CALENDAR_BOUNDARY,
  sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
})

export const JYOTISHA_EXPANSION_RULES: InterpretationRule[] = [
  ...NAKSHATRA_CLASSES.map(({ name, classes, passageIds }): InterpretationRule => ({
    id: `bs-nakshatra-class-${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-')}`,
    traditionId: 'vedic-jyotisha', technique: 'nakshatra class taxonomy', chartTypes: ['electional', 'natal'],
    conditions: [{ factField: 'panchanga.nakshatra', description: `The Moon occupies ${name}.`, requiresLimb: { limb: 'nakshatra', anyOf: [name] }, derivation: 'direct' }],
    interpretation: classes[0] === 'unclassified in verses 6–11'
      ? `Punarvasu is used in the chapter’s shaving election, but it is not assigned to one of the activity classes enumerated in verses 6–11.`
      : `The cited chapter classifies ${name} as ${classes.join(' and ')}.`,
    passageIds, provenance: 'restates-source', empirical: 'unvalidated-tradition',
    disagreements: classes.length > 1 ? ['The chapter places Hasta in both the Laghu list and the moving-work list. Both classifications are retained; neither is silently selected as authoritative.'] : [],
    boundary: CALENDAR_BOUNDARY, sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
  })),
  ...TITHI_GROUPS.map(([name, group], index): InterpretationRule => {
    const names = name.split('|')
    return {
      id: `bs-tithi-class-${index + 1}`, traditionId: 'vedic-jyotisha', technique: 'tithi group taxonomy', chartTypes: ['electional', 'natal'],
      conditions: [{ factField: 'panchanga.tithi', description: `The tithi is the ${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} of its fortnight.`, requiresLimb: { limb: 'tithi', anyOf: names }, derivation: 'direct' }],
      interpretation: `The cited verse assigns tithi number ${index + 1} of either fortnight to the ${group} group.`,
      passageIds: ['bs-99-2-tithi-groups'], provenance: 'restates-source', empirical: 'unvalidated-tradition', disagreements: [], boundary: CALENDAR_BOUNDARY,
      sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
    }
  }),
  ...KARANA_LORDS.map(([name, lord]): InterpretationRule => ({
    id: `bs-karana-lord-${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-')}`,
    traditionId: 'vedic-jyotisha', technique: 'karaṇa lord taxonomy', chartTypes: ['electional', 'natal'],
    conditions: [{ factField: 'panchanga.karana', description: `The current karaṇa is ${name}.`, requiresLimb: { limb: 'karana', anyOf: [name] }, derivation: 'direct' }],
    interpretation: `The cited verse names ${lord} as the lord corresponding to the ${name} karaṇa.`,
    passageIds: ['bs-99-4-movable-karanas'], provenance: 'restates-source', empirical: 'unvalidated-tradition', disagreements: [], boundary: CALENDAR_BOUNDARY,
    sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
  })),
  ...FIXED_KARANAS.map((name, index): InterpretationRule => ({
    id: `bs-fixed-karana-member-${index + 1}`, traditionId: 'vedic-jyotisha', technique: 'fixed karaṇa taxonomy', chartTypes: ['electional', 'natal'],
    conditions: [{ factField: 'panchanga.karana', description: `The current karaṇa is ${name}.`, requiresLimb: { limb: 'karana', anyOf: [name] }, derivation: 'direct' }],
    interpretation: `The cited verse places ${name} at position ${index + 1} in its stated sequence of four fixed karaṇas.`,
    passageIds: ['bs-99-5-fixed-karanas'], provenance: 'restates-source', empirical: 'unvalidated-tradition', disagreements: [], boundary: CALENDAR_BOUNDARY,
    sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
  })),
  ...NATAL_NAKSHATRAS.map(([name, slug, stanza]): InterpretationRule => ({
    id: `bj-natal-${slug}-moon`, traditionId: 'vedic-jyotisha', technique: 'natal nakshatra interpretation', chartTypes: ['natal'],
    conditions: [{ factField: 'panchanga.nakshatra', description: `At birth, the Moon occupies ${name}.`, requiresLimb: { limb: 'nakshatra', anyOf: [name] }, derivation: 'direct' }],
    interpretation: `The text assigns a compound set of personal characteristics and life circumstances to a birth with the Moon in ${name}; the exact historical wording is retained in the cited passage rather than presented as a factual description of a person.`,
    passageIds: [`bj-16-${stanza}-${slug}`], provenance: 'restates-source', empirical: 'unvalidated-tradition',
    disagreements: ['This is a whole-nakshatra statement. Later practice may qualify it by pāda, lordship, aspects, conjunctions, and daśā, none of which appears in the cited stanza.'],
    boundary: NATAL_BOUNDARY, sourceBoundCoverage: { area: 'nakshatra-interpretation', ...GATE },
  })),
  ...AVOCATION_MAP.map(([planet, source]): InterpretationRule => ({
    id: `bj-tenth-house-${planet.toLowerCase()}-avocation`, traditionId: 'vedic-jyotisha', technique: 'avocation source mapping', chartTypes: ['natal'],
    conditions: [{ factField: 'vedicChart.wholeSignHouses.10.occupants', description: `${planet} occupies the tenth whole-sign house from the ascendant or Moon.`, requiresSubjects: [planet], derivation: 'requires-derivation' }],
    interpretation: `The cited stanza maps ${planet} in the tenth house from the ascendant or Moon to the ${source} as an asserted source of wealth.`,
    passageIds: ['bj-10-1-planets-tenth-house'], provenance: 'restates-source', empirical: 'unvalidated-tradition',
    disagreements: ['The stanza does not resolve multiple occupants or disagreement between the tenth house from the ascendant and the tenth from the Moon.'],
    boundary: AVOCATION_BOUNDARY, sourceBoundCoverage: { area: 'planetary-house-placement', ...GATE },
  })),
  activityRule('bs-dhruva-activity-doctrine', 'stable (Dhruva)', ['Uttara Phalgunī', 'Uttara Āṣāḍhā', 'Uttara Bhādrapadā', 'Rohiṇī'], ['bs-98-6-dhruva-list', 'bs-98-6-dhruva-acts'], 'The source associates stable nakshatras with undertakings intended to endure, including planting, building, sowing, and public works.'),
  activityRule('bs-laghu-activity-doctrine', 'light (Laghu)', ['Hasta', 'Aśvinī', 'Puṣya'], ['bs-98-9-laghu-list', 'bs-98-9-laghu-acts'], 'The source associates light nakshatras with sales, acquiring knowledge, arts, ornaments, sculpture, medicine, and acquiring a carriage.'),
  activityRule('bs-mridu-activity-doctrine', 'soft (Mṛdu)', ['Anurādhā', 'Citrā', 'Revatī', 'Mṛgaśīrṣa'], ['bs-98-10-mridu-list', 'bs-98-10-mridu-acts'], 'The source associates soft nakshatras with friendship, clothing and ornaments, music, and undertakings it calls auspicious.'),
  activityRule('bs-mixed-activity-doctrine', 'mixed (Mṛdu-Tīkṣṇa)', ['Kṛttikā', 'Viśākhā'], ['bs-98-11-mixed-list'], 'The source calls Kṛttikā and Viśākhā soft-sharp and says they produce effects of mixed character.'),
  activityRule('bs-moving-activity-doctrine', 'moving', ['Śravaṇa', 'Dhaniṣṭhā', 'Śatabhiṣā', 'Hasta', 'Svātī'], ['bs-98-11-moving-list'], 'The source associates this list of nakshatras with works of a moving character.'),
  {
    id: 'bs-shaving-moon-nakshatra', traditionId: 'vedic-jyotisha', technique: 'grooming election doctrine', chartTypes: ['electional'],
    conditions: [{ factField: 'panchanga.nakshatra', description: 'The Moon occupies one of the nakshatras listed for shaving.', requiresLimb: { limb: 'nakshatra', anyOf: ['Hasta', 'Citrā', 'Dhaniṣṭhā', 'Svātī', 'Mṛgaśīrṣa', 'Śravaṇa', 'Śatabhiṣā', 'Revatī', 'Aśvinī', 'Jyeṣṭhā', 'Puṣya', 'Punarvasu'] }, derivation: 'direct' }],
    interpretation: 'For the directly computable branch of verses 12–13, the source permits shaving while the Moon passes through any of the twelve listed nakshatras.',
    passageIds: ['bs-98-12-shaving-nakshatras'], provenance: 'restates-source', empirical: 'unvalidated-tradition',
    disagreements: ['The full verse also permits an asterism rising, its muhūrta, and certain counts from the natal Moon. Those alternative branches are not encoded here.'],
    boundary: CALENDAR_BOUNDARY, sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
  },
  {
    id: 'bs-purification-election-criteria', traditionId: 'vedic-jyotisha', technique: 'ritual election doctrine', chartTypes: ['electional'],
    conditions: [
      { factField: 'panchanga.nakshatra', description: 'The Moon occupies one of six named nakshatras.', requiresLimb: { limb: 'nakshatra', anyOf: ['Hasta', 'Revatī', 'Svātī', 'Anurādhā', 'Puṣya', 'Citrā'] }, derivation: 'direct' },
      { factField: 'vedicChart.conjunctions', description: 'Jupiter is conjunct Mercury, Venus, or the Moon under a reviewed orb convention.', requiresSubjects: ['Jupiter', 'Mercury', 'Venus', 'Moon'], derivation: 'requires-derivation' },
    ],
    interpretation: 'The source joins a six-nakshatra Moon condition with Jupiter conjunct Mercury, Venus, or the Moon for purification rites, austerities, and investiture with the sacred belt.',
    passageIds: ['bs-98-16-purification-criteria'], provenance: 'restates-source', empirical: 'unvalidated-tradition',
    disagreements: ['The source does not specify a numerical conjunction orb; the condition remains non-executable until a reviewed convention supplies one.'],
    boundary: CALENDAR_BOUNDARY, sourceBoundCoverage: { area: 'panchanga-selection', ...GATE },
  },
]
