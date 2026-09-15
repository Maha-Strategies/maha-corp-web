import type { NatalFoundation } from './natal-foundation.ts'
import { calculationDigest } from './x402/celestial-products.ts'

export const EDUCATIONAL_PROFILE = 'iyer-symbolic-reflection/0.1' as const
export const EDUCATIONAL_REVIEW = 'Maha automated internal source and implementation review; not practitioner or expert review.'
const book = {
  title: 'Bṛhat Jātaka, translated by N. Chidambaram Iyer',
  edition: 'Foster Press, Madras, 1885',
  url: 'https://wellcomecollection.org/works/afmgm695',
  rights: 'Public Domain Mark, Wellcome Collection',
  inspectedAt: '2026-09-14',
}

// These bounded paraphrases were checked against the downloaded Wellcome PDF
// images (one-based PDF pages below). No old practitioner acceptance is reused.
export const EDUCATIONAL_SOURCES = {
  houses: { ...book, id: 'iyer-I-15', locator: 'Chapter I, stanza 15 and note (a), printed pp. 11–12; PDF pp. 52–53',
    account: 'The text assigns the seventh house to wife and the tenth to avocation. The translator’s table adds generosity and respect to the seventh, and knowledge and clothes to the tenth.',
    boundary: 'Historical gendered vocabulary, not a claim about a visitor’s orientation, spouse, occupation or prospects. Gender-neutral relationship reflection is Maha’s adaptation.' },
  symbols: { ...book, id: 'iyer-II-1', locator: 'Chapter II, stanza 1, printed p. 14; PDF p. 55',
    account: 'In the Kalapurusha framework the text associates Sun with soul, Moon with mind, Mars with strength, Mercury with speech, Jupiter with knowledge and health, Venus with desire, and Saturn with sorrow.',
    boundary: 'These are historical correspondences, not diagnoses or measured personal qualities. Health and sorrow are not turned into health or misfortune predictions.' },
  nodes: { ...book, id: 'iyer-II-3', locator: 'Chapter II, stanza 3, printed p. 15; PDF p. 56',
    account: 'The stanza lists names of Rahu, the ascending node, and Ketu, the descending node.',
    boundary: 'This passage identifies the nodes. It does not support a foreign-spouse, karmic-destiny or period-outcome rule.' },
} as const

const prompts: Record<string, { symbol: string; question: string }> = {
  Sun: { symbol: 'soul', question: 'Which commitments reflect the values you actually want to live by?' },
  Moon: { symbol: 'mind', question: 'What do you notice about your responses, and what evidence might change your interpretation of them?' },
  Mars: { symbol: 'strength', question: 'Where would deliberate effort help, and where would a pause prevent unnecessary conflict?' },
  Mercury: { symbol: 'speech', question: 'What needs to be expressed more clearly, and what should you ask rather than assume?' },
  Jupiter: { symbol: 'knowledge', question: 'What do you need to learn or verify before taking the next step?' },
  Venus: { symbol: 'desire', question: 'What do you value or want, and how can you discuss it with respect for another person’s choices?' },
  Saturn: { symbol: 'sorrow', question: 'Which limits or difficult commitments deserve acknowledgement and a practical response?' },
}

type SourceId = keyof typeof EDUCATIONAL_SOURCES
type Factor = { chart: 'D1' | 'D9' | 'timing' | 'transit'; name: string; value: string }
function trace(ids: SourceId[]) {
  return ids.map(id => {
    const source = EDUCATIONAL_SOURCES[id]
    if (!source?.locator || !source.url || !source.rights || !source.account) throw new Error('missing_educational_source')
    return { ...source, digest: calculationDigest(source) }
  })
}
function note(id: string, heading: string, factors: Factor[], sourceIds: SourceId[], explanation: string, reflection: string, uncertain: boolean) {
  if (!factors.length || factors.some(f => !f.value)) throw new Error('missing_educational_prerequisite')
  const payload = { id, heading, factors, sources: trace(sourceIds), explanation,
    reflection: uncertain ? 'Reflection withheld: the stated birth-time interval has not been proved stable. Read the nominal calculation and alternatives, not an unconditional interpretation.' : reflection,
    status: uncertain ? 'nominal-study-only' : 'educational-reflection',
    rule: { profile: EDUCATIONAL_PROFILE, chartScopes: [...new Set(factors.map(f => f.chart))],
      requiredFactors: factors.map(f => `${f.chart}:${f.name}`),
      qualification: 'Exact declared calculation profile; source vocabulary and modern prompts remain separate. No personal trait or event is established.',
      exceptions: ['Missing factors or sources refuse the note.', 'Nonzero birth-time uncertainty withholds personal reflection.', 'D1 house meanings do not automatically transfer to D9.'],
      conflicts: ['Other editions and schools may differ; this profile does not claim to reconcile uninspected teachings.'] },
    reviewBasis: EDUCATIONAL_REVIEW,
    reflectionBasis: 'Maha-authored optional reflection, not a quotation, classical prediction, or empirically validated conclusion.' }
  return { ...payload, ruleDigest: calculationDigest(payload.rule), receiptDigest: calculationDigest(payload) }
}

export function buildEducationalJyotisha(foundation: NatalFoundation) {
  const uncertain = foundation.sensitivity.uncertaintyMinutes > 0
  const point = (name: string) => {
    const result = foundation.d1.placements.find(p => p.name === name)
    if (!result) throw new Error('missing_chart_factor')
    return result
  }
  const d9point = (name: string) => {
    const result = foundation.d9.placements.find(p => p.name === name)
    if (!result) throw new Error('missing_divisional_factor')
    return result
  }
  const house = (number: number) => {
    const result = foundation.d1.houses.find(h => h.number === number)
    if (!result) throw new Error('missing_house_factor')
    return result
  }
  const houseNote = (number: 7 | 10, id: string, heading: string) => {
    const h = house(number), ruler = point(h.ruler), divisional = d9point(h.ruler)
    const symbol = prompts[h.ruler]
    if (!symbol) throw new Error('unsupported_house_ruler')
    return note(id, heading, [
      { chart: 'D1', name: `house-${number}`, value: `${h.sign}; ruler ${h.ruler}; occupants ${h.occupants.join(', ') || 'none'}` },
      { chart: 'D1', name: h.ruler, value: `${ruler.sidereal.sign}, house ${ruler.wholeSignHouse}` },
      { chart: 'D9', name: h.ruler, value: `${divisional.sign}, D9 house ${divisional.house}` },
    ], ['houses', 'symbols'],
    `Your nominal D1 house ${number} is ${h.sign}, ruled by ${h.ruler}. The Iyer edition associates this house with ${number === 7 ? 'wife; its commentary also names generosity and respect' : 'avocation; its commentary also names knowledge'}. Its planetary vocabulary associates ${h.ruler} with ${symbol.symbol}. Connecting that vocabulary to a reflection prompt is Maha’s educational adaptation, not a sourced outcome rule. The ruler occupies ${ruler.sidereal.sign} in D1 and ${divisional.sign} in D9. ${ruler.sidereal.sign === divisional.sign ? 'The sign repeats' : 'The sign differs'}; this comparison establishes no marriage or career outcome. An empty house is not an absent area of life.`,
    `${number === 7 ? 'For a relationship discussion' : 'For reflecting on your work'}: ${symbol.question}`, uncertain)
  }
  const relationships = houseNote(7, 'relationships', 'Relationships: respect, desire and communication')
  const work = houseNote(10, 'work', 'Work: vocation as a reflection, not a forecast')
  const planetary = foundation.d1.placements.map(p => {
    const symbol = prompts[p.name]
    if (!symbol && !['Rahu', 'Ketu'].includes(p.name)) throw new Error('unsupported_educational_planet')
    return note(`planet-${p.name}`, `${p.name}: ${symbol?.symbol ?? 'node identification only'}`,
      [{ chart: 'D1', name: p.name, value: `${p.sidereal.sign} ${p.sidereal.degreeInSign.toFixed(2)}°, house ${p.wholeSignHouse}` }],
      [symbol ? 'symbols' : 'nodes'], symbol
        ? `The calculated placement is ${p.sidereal.sign}, house ${p.wholeSignHouse}. Chapter II.1 uses ${symbol.symbol} as a correspondence for ${p.name}. It does not establish that this placement gives you a particular personality. The prompt below uses that vocabulary without deriving an outcome from the sign or house.`
        : `${p.name} is a calculated lunar node. The inspected naming passage does not justify assigning a spouse, destiny or psychological character to this placement.`,
      symbol?.question ?? 'No personal node interpretation is available from this inspected passage.', uncertain)
  })
  const major = foundation.timing.vimshottari.activeMahadasha.lord
  const minor = foundation.timing.vimshottari.activeAntardasha.lord
  const periodPrompt = [major, minor].map(lord => `${lord}: ${prompts[lord]?.question ?? 'The inspected source does not supply a personal node-period interpretation.'}`).join(' ')
  const periods = note('periods', 'Current periods: a declared clock, not a promised event',
    [{ chart: 'timing', name: 'Vimshottari', value: `${major}–${minor}; next boundary ${foundation.timing.vimshottari.nextTransition.atUtc}` }],
    ['symbols', 'nodes'],
    `The declared Vimshottari calculation places the nominal reference instant in ${major}–${minor}. Using these period names to select reflection vocabulary is a modern display choice, not a period-outcome rule in Chapter II.1. Bṛhat Jātaka’s separate daśā technique is not silently substituted with Vimshottari. Dates depend on birth time, balance method and year length.`, periodPrompt, uncertain)
  const transits = note('transits', 'Upcoming transits: positions and reflective themes',
    foundation.upcoming.flatMap(s => s.placements.map(p => ({ chart: 'transit' as const,
      name: `${p.name}@${s.instantUtc}`, value: `${p.sign}, nominal D1 house ${p.nominalD1House}` }))),
    ['symbols', 'nodes'],
    'The report samples Jupiter, Saturn and Rahu at 30 and 90 days after your chosen reference instant. Those are snapshots, not an ingress search or an event window. Jupiter’s knowledge and Saturn’s sorrow are vocabulary from II.1; turning them into learning and acknowledging limits is Maha’s modern reflection. The cited source does not validate a personal prediction from these transits.',
    'What would you like to learn over the next month, and which commitments need realistic limits? Revisit those questions in three months using actual experience. No Rahu event theme is inferred.', uncertain)
  const r = house(7).ruler, w = house(10).ruler
  const synthesis = uncertain ? 'Use this report to study the nominal chart alongside its alternatives. Reflection is withheld because sampled agreement is not proof that the whole time range is stable.'
    : r === w ? `Both selected D1 houses have ${r} as ruler, so the two prompts share a vocabulary. This is not double evidence or a prediction that work and relationships will merge. Consider how the same question has different answers in each area.`
      : `The relationship prompt uses ${r} (${prompts[r]?.symbol}), while the work prompt uses ${w} (${prompts[w]?.symbol}). These are separate lenses, not competing verdicts. If their questions suggest different priorities, consider the practical trade-off; the chart does not decide which choice is right. Period and transit reflections add no evidence of an event.`
  const payload = { profile: EDUCATIONAL_PROFILE, reviewBasis: EDUCATIONAL_REVIEW,
    status: uncertain ? 'uncertainty-limited-educational-report' : 'educational-report',
    calculationReceiptDigest: foundation.receiptDigest, predictiveValidation: false,
    sections: [relationships, work, periods, transits], planetary, synthesis,
    unavailable: ['Spouse identity or meeting dates', 'D9 marriage-outcome rules', 'Practitioner video methods', 'Medical, death, financial and guaranteed-event predictions'],
    privacy: 'Computed per request. No report storage is requested or provided. Receipt digests are not anonymization.' }
  return { ...payload, receiptDigest: calculationDigest(payload) }
}
