import { ASTROLOGY_VERSION, getAstrologyPassage, getAstrologySource, getRulesForTradition } from './astrology-traditions.ts'
import { compileReport } from './interpretation-compiler.ts'
import { buildLocalFactBundle } from './local-fact-bundle.ts'
import type { NatalFoundation } from './natal-foundation.ts'
import { calculationDigest } from './x402/celestial-products.ts'
import { buildEducationalJyotisha } from './jyotisha-educational.ts'

export const INSPECTABLE_JYOTISHA_VERSION = 'inspectable-jyotisha/0.2'

/** No new doctrine or approvals: project the existing compiler's accepted output. */
export function buildInspectableJyotisha(foundation: NatalFoundation, observer: { latitudeDegrees: number; longitudeDegrees: number }) {
  const chart = foundation.d1
  const educational = buildEducationalJyotisha(foundation)
  const uncertain = foundation.sensitivity.uncertaintyMinutes > 0
  const compiled = compileReport({ factBundle: buildLocalFactBundle({ instant: new Date(chart.instantUtc),
    ...observer }),
    traditionId: 'vedic-jyotisha', chartType: 'natal' })
  const rules = getRulesForTradition('vedic-jyotisha')
  const modules = (uncertain ? [] : compiled.modules).map(module => {
    const rule = rules.find(r => r.id === module.ruleId)
    if (!rule) throw new Error('missing_rule')
    const sources = module.passageIds.map(id => {
      const passage = getAstrologyPassage(id)
      const source = passage && getAstrologySource(passage.sourceId)
      if (!passage || !source || !passage.locator || !source.url) throw new Error('missing_source_trace')
      return { id, title: source.title, url: source.url, locator: passage.locator,
        edition: source.edition, translator: source.translator ?? null, rights: source.rightsStatus,
        digest: calculationDigest(passage) }
    })
    return { ruleId: rule.id, ruleDigest: calculationDigest(rule), heading: module.heading,
      interpretation: module.paragraph, tradition: 'vedic-jyotisha', evidenceBasis: 'classical-text' as const,
      chartScope: 'D1 and calendrical factors only; not D9',
      requiredFactors: rule.conditions.map(c => ({ field: c.factField, requirement: c.description })),
      matchedFactors: module.observedLimbs, factIds: module.factIds,
      qualifications: module.boundary, conflicts: module.disagreements, sources,
      reviewBasis: 'Existing compiler eligibility; not a new expert endorsement.' }
  })
  const withheld = [...compiled.exclusions.map(e => ({ ruleId: e.ruleId, reason: e.reason, explanation: e.detail })),
    ...(uncertain ? compiled.modules.map(m => ({ ruleId: m.ruleId, reason: 'birth-time-uncertainty',
      explanation: 'The full uncertainty interval has not been proved stable for this rule.' })) : [])]
  const sections = [
    { id: 'overview', heading: 'Chart overview', status: 'calculated',
      explanation: `D1 ascendant ${chart.ascendant.sidereal.sign}; D9 ascendant ${foundation.d9.ascendant.sign}. D9 is a mathematical mapping, not a second observed sky.` },
    { id: 'relationships', heading: 'Relationships', status: 'interpretation-withheld',
      explanation: 'D1/D9 placements are available. No reviewed combined-chart relationship rules are executable in this profile; a seventh-house placement does not establish a spouse or meeting date.' },
    { id: 'work', heading: 'Work', status: 'interpretation-withheld',
      explanation: 'Recorded avocation rules remain restricted by existing report policy and review requirements. No career or financial outcomes are inferred.' },
    { id: 'periods', heading: 'Current periods', status: 'calculated',
      explanation: `Nominal ${foundation.timing.vimshottari.activeMahadasha.lord}–${foundation.timing.vimshottari.activeAntardasha.lord}. The recorded interpretive period rule uses unresolved conventions and is not substituted with Vimshottari.` },
    { id: 'transits', heading: 'Upcoming transits', status: 'calculated',
      explanation: 'Thirty- and ninety-day position snapshots are provided, not ingress searches. Personal transit themes remain withheld until their rules are reviewed and executable.' },
  ]
  for (const section of sections) {
    const note = educational.sections.find(n => n.id === section.id)
    if (note) { section.status = note.status; section.explanation = note.explanation }
  }
  const payload = { version: INSPECTABLE_JYOTISHA_VERSION, registryVersion: ASTROLOGY_VERSION,
    status: 'limited-coverage', sections, modules, withheld, synthesis: educational.synthesis, educational,
    practitionerMethods: { status: 'not-enabled', reason: 'Video captions and ambiguous formulas have not passed source-fidelity and formalization review. No classical rule inherits a practitioner extension.' },
    empiricalStatus: 'Traditional interpretation; no predictive validation established.',
    readableReport: [...sections.map(s => `${s.heading}: ${s.explanation}`),
      ...educational.sections.map(n => `${n.heading}\n${n.explanation}\nReflection (Maha adaptation): ${n.reflection}\nSources: ${n.sources.map(s => `${s.title}, ${s.locator}`).join('; ')}`),
      ...educational.planetary.map(n => `${n.heading}\n${n.explanation}\nReflection (Maha adaptation): ${n.reflection}`),
      ...modules.map(m => `${m.heading}: ${m.interpretation}\nSources: ${m.sources.map(s => `${s.title}, ${s.locator}`).join('; ')}\nLimit: ${m.qualifications}`),
      educational.reviewBasis, educational.synthesis].join('\n\n') }
  return { ...payload, receiptDigest: calculationDigest(payload) }
}

export type InspectableJyotisha = ReturnType<typeof buildInspectableJyotisha>
