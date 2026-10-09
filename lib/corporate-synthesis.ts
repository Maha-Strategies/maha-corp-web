import { getAstrologyPassage, getAstrologySource } from './astrology-traditions.ts'
import { digestOf } from './celestial-hypotheses/canonical.ts'
import { assessFactor, corporateSamples, CORPORATE_FACTOR_VERSION, type Predicate } from './corporate-factors.ts'
import type { CorporateReportInput } from './corporate-report.ts'
import type { NatalChart } from './natal-chart.ts'
import { classicalCalculation, CORPORATE_CLASSICAL_SOURCES, CLASSICAL_POINTS } from './corporate-classical.ts'
import { corporateTiming } from './corporate-timing.ts'
import { synthesizeCorporateEvidence } from './corporate-conflicts.ts'

export const CORPORATE_SYNTHESIS_VERSION = 'corporate-synthesis/2.0'
export type Layer = 'traditional' | 'maha-reflective'
export type CorporateRule = { id: string; version: string; chartType: 'corporate'; layer: Layer; title: string; predicates: Predicate[]; passageIds: string[]; text: string; scope: string; disagreements: string[]; conflictsWith?: string[]; requiresVerifiedEvent: boolean }
const BOUNDARY = 'A reflection within a declared framework—not evidence of organizational traits, future events, valuation, revenue or profitability.'
const reflection = (id: string, title: string, predicates: Predicate[], text: string): CorporateRule => ({ id, version: '1', title, predicates, text, chartType: 'corporate', layer: 'maha-reflective', passageIds: ['maha-corporate-reflection-policy-v1'], scope: BOUNDARY, disagreements: ['These are Maha-authored discussion prompts, not classical corporate doctrine or empirical findings.'], requiresVerifiedEvent: true })
export const CORPORATE_RULES: CorporateRule[] = [
  { id: 'corporate-mridu-classification', version: '1', chartType: 'corporate', layer: 'traditional', title: 'Named lunar category, not a corporate prediction', predicates: [{ kind: 'nakshatra', chart: 'D1', point: 'Moon', names: ['Anurādhā', 'Citrā', 'Revatī', 'Mṛgaśīrṣa'] }], passageIds: ['bs-98-10-mridu-list'], text: 'The calculated lunar nakshatra belongs to the Mṛdu category named in this edition. This identifies a textual classification; it does not establish that a company is collaborative or that its partnerships will endure.', scope: 'Bṛhat Saṃhitā 98.10 classification only. No transfer of electional advice into retrospective corporate prediction.', disagreements: ['Naming the lunar category is distinct from extending advice about commencing activities to a legal entity.'], requiresVerifiedEvent: true },
  reflection('corp-sun-first', 'Executive identity: a governance question', [{ kind: 'house', chart: 'D1', point: 'Sun', house: 1 }], 'With the Sun placed in the first whole-sign house, Maha’s proposed analogy pairs executive mandate with institutional identity. A useful question is whether decision authority and accountability are documented consistently. The chart does not tell us whether they are.'),
  reflection('corp-jupiter-seventh', 'Counterparties: a counsel question', [{ kind: 'house', chart: 'D1', point: 'Jupiter', house: 7 }], 'Jupiter in the seventh whole-sign house joins the declared counsel and counterparty symbols. Consider how advice, partner selection and contract review fit together. This does not predict alliances, funding or partner reliability.'),
  reflection('corp-saturn-fourth', 'Institutional base: a durability question', [{ kind: 'house', chart: 'D1', point: 'Saturn', house: 4 }], 'Saturn in the fourth whole-sign house pairs the declared constraint symbol with the institutional base. Consider which obligations, premises and operating dependencies deserve resilience planning. This is a prompt, not evidence that the company is durable.'),
  reflection('corp-dhanu', 'Declared identity and direction', [{ kind: 'sign', chart: 'D1', point: 'Ascendant', sign: 'Sagittarius' }], 'For a Sagittarius ascendant, this proposed Maha analogy invites an explicit discussion of mission and scope. It does not establish a philosophical personality or an expansion trajectory for the organization.'),
  reflection('corp-mercury-own-sign', 'Communication under an own-sign convention', [{ kind: 'own-sign', chart: 'D1', point: 'Mercury' }], 'Mercury meets the declared own-sign classification. Under Maha’s communication analogy, consider whether information ownership and contract terminology are coherent. Own-sign status is not a measured communication capability.'),
  reflection('corp-sun-mercury-conjunction', 'Mandate and communication together', [{ kind: 'conjunction', chart: 'D1', first: 'Sun', second: 'Mercury', angle: 0, orb: 8, convention: 'geometric-degrees-not-graha-drishti' }], 'Sun and Mercury satisfy the declared eight-degree geometric conjunction. Maha’s analogy asks how executive decisions become clear communications. This is not a classical yoga judgment; combustion and other dignity claims are not evaluated.'),
  reflection('corp-jupiter-saturn-opposition', 'Expansion and constraint in tension', [{ kind: 'aspect', chart: 'D1', first: 'Jupiter', second: 'Saturn', angle: 180, orb: 8, convention: 'geometric-degrees-not-graha-drishti' }], 'The two points satisfy a geometric opposition under the stated orb. Maha’s proposed analogy asks how expansion plans and continuing obligations are reconciled. The geometry neither establishes a conflict nor predicts an outcome.'),
]

for (const point of CLASSICAL_POINTS) {
  CORPORATE_RULES.push({ id: `corp-d9-own-${point.toLowerCase()}`, version: '1', chartType: 'corporate', layer: 'traditional', title: `${point}: own Navāṃśa category`, predicates: [{ kind: 'own-sign', chart: 'D9', point }], passageIds: ['bj-i6-navamsa', 'bj-ii19-own-navamsa'], text: `${point} occupies its own sign in the calculated D9. The named text includes own Navāṃśa among positional-strength categories. This classifies a chart factor; it does not measure business capability or establish a corporate outcome.`, scope: 'Textual category only, not corporate prediction or a complete strength assessment.', disagreements: ['D9 is a derived coordinate. Corporate forecasting requires separate justification.'], requiresVerifiedEvent: true })
  CORPORATE_RULES.push({ id: `corp-vargottama-${point.toLowerCase()}`, version: '1', chartType: 'corporate', layer: 'traditional', title: `${point}: repeated D1/D9 sign`, predicates: [{ kind: 'vargottama', chart: 'D1', point }], passageIds: ['bj-i6-navamsa', 'bj-i14-vargottama'], text: `${point} repeats its D1 sign in D9, meeting the named vargottama classification. The text gives this category a favorable traditional meaning, but that is not evidence of favorable company performance.`, scope: 'Sign-repetition classification; no valuation, funding, durability or marriage inference.', disagreements: ['A repeated sign does not erase other chart factors or uncertainty.'], requiresVerifiedEvent: true })
}
function sourcePacket(id: string) {
  const classical = CORPORATE_CLASSICAL_SOURCES.find(s => s.id === id)
  if (classical) return { id, sourceId: 'brihat-jataka-iyer-transcription', locator: classical.locator, url: classical.url, textKind: 'paraphrase', excerpt: classical.summary, boundary: classical.boundary }
  if (id === 'maha-corporate-reflection-policy-v1') return { id, sourceId: 'maha-authored-policy', locator: 'corporate-synthesis.ts: CORPORATE_RULES, version 1', url: null, textKind: 'maha-authored-policy', excerpt: 'Maha’s declared organizational mappings are discussion prompts, not traditional corporate doctrine or empirical descriptions.', boundary: BOUNDARY }
  const passage = getAstrologyPassage(id)
  if (!passage) throw new Error('missing-source')
  const source = getAstrologySource(passage.sourceId)
  if (!source) throw new Error('missing-source')
  return { id, sourceId: passage.sourceId, locator: passage.locator, url: source.url, textKind: 'source-excerpt', excerpt: passage.excerpt, boundary: 'The passage establishes only its own textual claim.' }
}
export function corporateRuleDigest(rule: CorporateRule) { return digestOf({ rule, factorVersion: CORPORATE_FACTOR_VERSION, sources: rule.passageIds.map(sourcePacket) }) }
export type CorporateReview = { reviewId: string; ruleId: string; targetDigest: string; layer: Layer; scope: 'source-and-rule' | 'maha-analogy-approval'; decision: 'accepted' | 'revise'; reviewedAt: string; recordDigest: string }
export type EventReview = { reviewId: string; eventDigest: string; documentDigest: string; decision: 'inspected-record' | 'revise'; reviewedAt: string; recordDigest: string }
// Server-supplied trust context only. Neither public form fields nor request JSON
// may populate it. Hashes bind records; they are not authentication credentials.
export type CorporateTrust = { ruleReviews?: readonly CorporateReview[]; eventReviews?: readonly EventReview[] }
export function corporateEventDigest(input: CorporateReportInput) {
  return digestOf(Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== 'timingReferenceUtc' && value !== undefined && value !== '').map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])))
}
function intact(record: { recordDigest: string }) { const { recordDigest, ...body } = record; return recordDigest === digestOf(body) }
// Input ordering cannot resurrect an older approval. A damaged record or
// conflicting decisions at the latest timestamp require human reconciliation.
function latestReview<T extends { recordDigest: string; reviewedAt: string; reviewId: string }>(records: readonly T[]): T | undefined {
  if (!records.length || records.some(r => !intact(r) || !r.reviewId.trim() || !Number.isFinite(Date.parse(r.reviewedAt)))) return undefined
  const latestTime = Math.max(...records.map(r => Date.parse(r.reviewedAt)))
  const latest = records.filter(r => Date.parse(r.reviewedAt) === latestTime)
  return new Set(latest.map(r => r.recordDigest)).size === 1 ? latest[0] : undefined
}
export function compileCorporateLayers(input: CorporateReportInput, chart: NatalChart, start: Date, end: Date, trust: CorporateTrust = {}, rules: readonly CorporateRule[] = CORPORATE_RULES, chartType = 'corporate') {
  const samples = corporateSamples(chart, start, end, input.latitudeDegrees, input.longitudeDegrees)
  const eventDigest = corporateEventDigest(input)
  const event = latestReview((trust.eventReviews ?? []).filter(r => r.eventDigest === eventDigest))
  const eventVerified = !!event && event.decision === 'inspected-record' && !!input.evidenceAttachment && event.documentDigest === input.evidenceAttachment.sha256
  const facts = chart.placements.map(point => {
    const sign = assessFactor({ kind: 'sign', chart: 'D1', point: point.name, sign: point.sidereal.sign }, samples, start, end)
    const house = assessFactor({ kind: 'house', chart: 'D1', point: point.name, house: point.wholeSignHouse }, samples, start, end)
    return { point: point.name, sign, house, explanation: `${point.name} is calculated in ${point.sidereal.sign}, whole-sign house ${point.wholeSignHouse}, at the representative instant. ${start.getTime() === end.getTime() ? 'This is conditional on the entered event time.' : 'See the factor-specific interval states; this is not an unconditional interval reading.'}` }
  })
  const decisions = rules.map(rule => {
    const factors = rule.predicates.map(p => assessFactor(p, samples, start, end))
    let ruleDigest: string | null = null
    let sources: ReturnType<typeof sourcePacket>[] = []
    const reasons: string[] = []
    try { sources = rule.passageIds.map(sourcePacket); ruleDigest = corporateRuleDigest(rule) } catch { reasons.push('missing-source') }
    // This is an explicit curated source-to-rule approval boundary, not a check
    // that any valid citation ID exists. Unknown/modified rules need re-admission.
    const admitted = CORPORATE_RULES.find(r => r.id === rule.id)
    if (!admitted || digestOf(rule) !== digestOf(admitted)) reasons.push('rule-revision-unadmitted')
    if (!rule.passageIds.length || !admitted || rule.passageIds.join() !== admitted.passageIds.join()) reasons.push('irrelevant-citation')
    if (rule.chartType !== chartType) reasons.push('chart-type-mismatch')
    if (!['certificate-issued', 'filing-accepted'].includes(input.eventType)) reasons.push('event-scope')
    if (rule.requiresVerifiedEvent && !eventVerified) reasons.push('unverified-event')
    if (factors.some(f => !f.satisfied)) reasons.push('condition-unsatisfied')
    if (factors.some(f => f.state === 'alternatives-observed' || f.state === 'interval-unproven')) reasons.push('factor-uncertain')
    const reviews = (trust.ruleReviews ?? []).filter(r => r.ruleId === rule.id)
    const latest = latestReview(reviews)
    if (!latest || latest.targetDigest !== ruleDigest || latest.layer !== rule.layer || latest.scope !== (rule.layer === 'traditional' ? 'source-and-rule' : 'maha-analogy-approval') || latest.decision !== 'accepted') reasons.push(latest?.targetDigest !== ruleDigest && latest ? 'stale-review' : 'missing-review')
    return { ruleId: rule.id, heading: rule.title, layer: rule.layer, state: reasons.length ? 'excluded' as const : 'included' as const, reasons, factors, ruleDigest, sources, passageIds: rule.passageIds, disagreements: rule.disagreements, boundary: rule.scope, paragraph: reasons.length ? null : rule.text, reviews: reviews.map(r => ({ ...r })), reviewStatus: reasons.includes('missing-review') || reasons.includes('stale-review') ? 'awaiting-review' : 'reviewed' }
  })
  const layer = (id: Layer) => {
    const entries = decisions.filter(d => d.layer === id)
    const modules = entries.filter(d => d.state === 'included')
    return { reviewStatus: modules.length ? 'contains-reviewed-modules' : 'no-approved-applicable-modules', modules, exclusions: entries.filter(d => d.state === 'excluded') }
  }
  const payload = { version: CORPORATE_SYNTHESIS_VERSION, status: 'report-available', eventReview: { status: eventVerified ? 'inspected-record' : 'unverified', eventDigest, record: event ?? null, boundary: 'Record inspection is not a legal opinion or proof of predictive validity.' }, calculated: { reviewStatus: 'calculation-only', chartVersion: chart.version, factorVersion: CORPORATE_FACTOR_VERSION, facts, boundary: 'Positions are calculations under Lahiri, whole-sign houses and mean nodes. Mathematical stability is not source verification.' }, traditional: layer('traditional'), mahaReflective: layer('maha-reflective'), summary: 'Your calculation report is available. Interpretive modules are included only when their exact source/rule review, event evidence and chart prerequisites pass. Excluded modules explain their own gaps; they do not suppress the calculation report.', limitations: ['D9 interpretation, full dignity, classical aspects, periods and transit synthesis are not implemented by this corporate rule pack.', 'No prediction of finances, organizational character, funding or future events.', 'Sampled alternatives are not an exhaustive interval solution. Polynomial enclosures prove only the implemented mean-node sign convention.'] }
  const advanced = classicalCalculation(chart)
  const d9Factors = advanced.d9.placements.map(p => ({ point: p.name, sign: assessFactor({ kind: 'sign', chart: 'D9', point: p.name, sign: p.sign }, samples, start, end), house: assessFactor({ kind: 'house', chart: 'D9', point: p.name, house: p.house }, samples, start, end) }))
  const synthesis = synthesizeCorporateEvidence(decisions.map(m => ({ ...m, conflictsWith: rules.find(r => r.id === m.ruleId)?.conflictsWith })))
  const complete = { ...payload, advanced: { ...advanced, d9Factors }, timing: corporateTiming(chart, start, end, input.latitudeDegrees, input.longitudeDegrees, input.timingReferenceUtc), synthesis,
    limitations: ['Dignity is categorical, not shadbala; exact exaltation peaks, combustion, friendship and cancellation rules are not evaluated.', 'Classical full aspects follow Iyer II.13; geometric timing contacts use a different named convention.', 'Corporate D9 and period forecasts remain unapproved; classification rules require exact reviews.', 'Sampled alternatives are not exhaustive. Continuous mean-node enclosures cover D1 and D9 signs only.'] }
  return { ...complete, reportDigest: digestOf(complete) }
}
export type CorporateLayers = ReturnType<typeof compileCorporateLayers>
