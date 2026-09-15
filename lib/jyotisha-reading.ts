import { ASTROLOGY_VERSION, getAstrologyPassage, getAstrologySource, getRulesForTradition } from './astrology-traditions.ts'
import { compileReport } from './interpretation-compiler.ts'
import { buildLocalFactBundle, CLASSICAL_BODIES } from './local-fact-bundle.ts'
import { computeNatalChart, type NatalChart } from './natal-chart.ts'
import { buildCelestialProduct, calculationDigest, parseCalculationInput } from './x402/celestial-products.ts'

export const JYOTISHA_READING_PROFILE = 'varahamihira-iyer-lahiri/0.1'
const RULE_ID = 'bj-musala-asraya-yoga'
const fixed = new Set(['Taurus', 'Leo', 'Scorpio', 'Aquarius'])

export function parseJyotishaReading(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_input')
  const { profile, birthTimeUncertaintyMinutes, calculation, ...extra } = value as Record<string, unknown>
  if (Object.keys(extra).length || profile !== JYOTISHA_READING_PROFILE) throw new Error('invalid_profile_or_fields')
  if (typeof birthTimeUncertaintyMinutes !== 'number' || !Number.isFinite(birthTimeUncertaintyMinutes)
    || birthTimeUncertaintyMinutes < 0 || birthTimeUncertaintyMinutes > 120) throw new Error('invalid_birth_time_uncertainty')
  const input = parseCalculationInput('celestial-chart-evidence', calculation)
  // Validate both ends through the same calculation contract, including date bounds.
  for (const direction of [-1, 1]) parseCalculationInput('celestial-chart-evidence', {
    ...input, instantUtc: new Date(Date.parse(input.instantUtc) + direction * birthTimeUncertaintyMinutes * 60000).toISOString(),
  })
  return { profile: JYOTISHA_READING_PROFILE, birthTimeUncertaintyMinutes, calculation: input }
}

/** Two readings of the recorded translator note. Neither reading wins by default. */
export function assessMusalaVariants(chart: NatalChart) {
  const planets = CLASSICAL_BODIES.map(name => {
    const point = chart.placements.find(p => p.name === name)
    if (!point) throw new Error('missing_classical_planet')
    return { name, sign: point.sidereal.sign }
  })
  const allFixed = planets.every(p => fixed.has(p.sign))
  const occupied = new Set(planets.map(p => p.sign)).size
  return {
    planets,
    variants: [
      { id: 'fixed-signs-any-occupancy', matches: allFixed, meaning: 'All seven classical planets occupy fixed signs; one or more fixed signs may be occupied.' },
      { id: 'all-four-fixed-signs', matches: allFixed && occupied === 4, meaning: 'All seven classical planets occupy fixed signs and all four fixed signs are occupied.' },
    ],
    disagreementChangesClassification: allFixed && occupied !== 4,
  }
}

function sourceTrace(ruleId: string) {
  const rule = getRulesForTradition('vedic-jyotisha').find(r => r.id === ruleId)
  if (!rule) throw new Error('missing_rule')
  return rule.passageIds.map(id => {
    const passage = getAstrologyPassage(id)
    const source = passage && getAstrologySource(passage.sourceId)
    if (!passage || !source) throw new Error('missing_source_trace')
    return { passageId: id, locator: passage.locator, sourceId: source.id, title: source.title,
      translator: source.translator ?? null, edition: source.edition, url: source.url,
      rightsStatus: source.rightsStatus, passageDigest: calculationDigest(passage) }
  })
}

export function buildJyotishaReading(supplied: unknown) {
  const input = parseJyotishaReading(supplied)
  const observer = { instant: new Date(input.calculation.instantUtc),
    latitudeDegrees: input.calculation.latitudeDegrees!, longitudeDegrees: input.calculation.longitudeDegrees! }
  const chartEvidence = buildCelestialProduct('celestial-chart-evidence', input.calculation)
  const report = compileReport({ factBundle: buildLocalFactBundle(observer), traditionId: 'vedic-jyotisha', chartType: 'natal' })
  const offsets = input.birthTimeUncertaintyMinutes === 0 ? [0] : [-input.birthTimeUncertaintyMinutes, 0, input.birthTimeUncertaintyMinutes]
  const samples = offsets.map(offsetMinutes => {
    const chart = computeNatalChart({ ...observer, instant: new Date(observer.instant.getTime() + offsetMinutes * 60000) })
    const moon = chart.placements.find(p => p.name === 'Moon')!
    return { offsetMinutes, instantUtc: chart.instantUtc, ascendantSign: chart.ascendant.sidereal.sign,
      moonNakshatra: moon.nakshatra.name,
      houses: chart.placements.map(p => ({ body: p.name, house: p.wholeSignHouse })),
      musala: assessMusalaVariants(chart) }
  })
  const uncertain = input.birthTimeUncertaintyMinutes > 0
  const modules = uncertain ? [] : report.modules.map(m => ({
    ...m, evidenceBasis: 'traditional-text' as const, empiricalStatus: 'unvalidated-tradition' as const,
    sources: sourceTrace(m.ruleId),
    chartFactors: { factIds: m.factIds, observedLimbs: m.observedLimbs,
      karana: report.panchanga?.karana.name ?? null },
  }))
  const musalaRule = getRulesForTradition('vedic-jyotisha').find(r => r.id === RULE_ID)!
  const payload = {
    schemaVersion: 'jyotisha-reading/0.1', profile: input.profile, registryVersion: ASTROLOGY_VERSION,
    status: modules.length ? 'limited-reading' : 'uncertainty-withheld',
    reviewBasis: 'Existing registry transcription; no new practitioner acceptance recorded by this service.',
    inputDigest: calculationDigest(input), calculationReceiptDigest: chartEvidence.receiptDigest,
    conventions: chartEvidence.conventions,
    profileDescription: 'Varāhamihira through N. Chidambaram Iyer’s editions, evaluated using Maha’s modern Lahiri calculation profile. This does not attribute Lahiri conventions to the historical author.',
    modules,
    exclusions: report.exclusions,
    birthTimeSensitivity: { uncertaintyMinutes: input.birthTimeUncertaintyMinutes,
      method: 'earliest-nominal-latest samples', samples,
      observedChange: new Set(samples.map(s => calculationDigest({ ascendant: s.ascendantSign, moon: s.moonNakshatra, houses: s.houses, variants: s.musala.variants }))).size > 1,
      intervalStabilityProven: false,
      explanation: uncertain ? 'Samples can reveal changes but cannot prove stability throughout the interval. Interpretive modules are withheld for nonzero birth-time uncertainty.' : 'The caller declared zero time uncertainty. This does not prove the recorded birth time is accurate.' },
    pendingRuleAssessment: { ruleId: RULE_ID, status: 'practitioner-review-required',
      sources: sourceTrace(RULE_ID), disagreements: musalaRule.disagreements,
      note: 'Variant matching is a calculation preview. It grants no authority to publish the source doctrine as a personal reading.' },
    timing: { endpoint: '/api/v1/calculations/vimshottari', interpretationStatus: 'unavailable',
      reason: 'The registry’s daśā rule has unresolved period conventions. Vimshottari output cannot silently be substituted for that rule.' },
    empiricalAssessment: { status: 'unvalidated-tradition', predictiveValidation: false },
    readableReport: [
      'Jyotiṣa reading — Varāhamihira / Iyer pilot',
      ...modules.map(m => `${m.heading}: ${m.paragraph}\nSource: ${m.sources.map(s => `${s.title}, ${s.locator}`).join('; ')}\nLimit: ${m.boundary}`),
      uncertain ? 'Birth-time uncertainty: interpretation withheld pending an interval-aware evaluator.' : 'Current coverage explains calendar structure. A complete natal personality or life-event reading is not available.',
      'Musala: both recorded occupancy readings are evaluated separately in the structured response; source and rule reviews remain pending.',
      'Timing interpretation remains unavailable. Traditional interpretation has no predictive validation in this service.',
    ].join('\n\n'),
  }
  return { ...payload, receiptDigest: calculationDigest(payload) }
}

/** Recompute against the request, not just a self-declared response hash. */
export function verifyJyotishaReading(input: unknown, result: unknown): boolean {
  try {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return false
    const { receiptDigest, ...payload } = result as Record<string, unknown>
    return receiptDigest === calculationDigest(payload) && receiptDigest === buildJyotishaReading(input).receiptDigest
  } catch { return false }
}
