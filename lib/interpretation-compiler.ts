/**
 * Interpretation compiler.
 *
 * Turns a validated celestial fact bundle plus one declared tradition into a
 * report whose every sentence traces to a transcribed source passage.
 *
 * The compiler is deterministic. It assembles narrative from the
 * `interpretation` text already recorded on each rule; it does not generate
 * prose, and there is no model in the loop. That is a stronger guarantee than
 * a constrained generator: a compiler that cannot invent a claim does not have
 * to be audited for inventing one. A renderer may later phrase these modules
 * more fluently, but it must not be permitted to add, drop, or soften a claim.
 *
 * Every stage fails closed. An unvalidated bundle, an unknown tradition, a
 * condition the compiler cannot derive, or a rule that a report policy forbids
 * all produce a refusal or a recorded exclusion — never a silent guess.
 */

import { createHash } from 'node:crypto'

import {
  ASTROLOGY_PROHIBITED_USES,
  ASTROLOGY_VERSION,
  getAstrologyPassage,
  getAstrologySource,
  getAstrologyTradition,
  getRulesForTradition,
  type AstrologyChartType,
  type InterpretationRule,
} from './astrology-traditions.ts'
import { canonicalCelestialFactBundle, validateCelestialFactBundle, type CelestialFactBundle } from './celestial-facts.ts'
import { computePanchanga, type Panchanga } from './panchanga.ts'

export const COMPILER_VERSION = 'interpretation-compiler/0.1' as const

/**
 * Techniques that may never reach generated output, mapped to the prohibited
 * use each would breach.
 *
 * This is a report policy, not a record property. The knowledge layer honestly
 * records what Ptolemy wrote about length of life and bodily disease; the
 * compiler refuses to say it to anyone. Keeping the two separate is what lets
 * the archive stay complete while the product stays bounded.
 */
export const BLOCKED_TECHNIQUES: Record<string, string> = {
  'bodily form': 'claims that a chart determines personality, capability, or behaviour',
  'quality of mind': 'claims that a chart determines personality, capability, or behaviour',
  'planetary gender': 'claims that a chart determines personality, capability, or behaviour',
  'bodily injury': 'medical diagnosis, prognosis, or treatment decisions',
  'order of judgement': 'predictions of death, disaster, or pregnancy outcomes',
}

/**
 * Published conflict-resolution policy.
 *
 * Silent resolution is the failure mode that makes a corpus untrustworthy, so
 * this policy never picks a winner. It reports every applicable rule and
 * surfaces recorded disagreements beside them.
 */
export const CONFLICT_POLICY = 'All applicable rules from the single declared tradition are reported. Recorded disagreements are surfaced alongside the rule and are never silently resolved. Rules from more than one tradition are never combined into one report: cross-tradition synthesis is refused, because a synthesis belongs to no tradition and can be checked against none.'

export type ExclusionReason =
  | 'chart-type-mismatch'
  | 'report-policy'
  | 'requires-derivation'
  | 'condition-unsatisfied'
  /** The limb the rule depends on sits too close to a division edge to assert. */
  | 'limb-uncertain'
  /** The bundle carries no observer, so no pañcāṅga could be derived. */
  | 'panchanga-unavailable'

export interface RuleExclusion {
  ruleId: string
  technique: string
  reason: ExclusionReason
  detail: string
}

export interface CompiledModule {
  id: string
  heading: string
  ruleId: string
  /** Assembled verbatim from the rule record. Not generated. */
  paragraph: string
  passageIds: string[]
  sourceIds: string[]
  factIds: string[]
  /** Pañcāṅga limb values this module matched on, e.g. "karana=Viṣṭi". */
  observedLimbs: string[]
  disagreements: string[]
  boundary: string
}

export interface ProvenanceBundle {
  compilerVersion: typeof COMPILER_VERSION
  traditionRegistryVersion: typeof ASTROLOGY_VERSION
  traditionId: string
  factBundleId: string
  factBundleSha256: string
  inputSha256: string
  ruleIds: string[]
  passageIds: string[]
  sourceIds: string[]
  compiledAt: string
}

export interface CompiledReport {
  reportId: string
  traditionId: string
  traditionName: string
  chartType: AstrologyChartType
  epistemicBoundary: string
  prohibitedUses: string[]
  conflictPolicy: string
  modules: CompiledModule[]
  exclusions: RuleExclusion[]
  /** The pañcāṅga derived for this moment, when the bundle allowed one. */
  panchanga: Panchanga | null
  provenance: ProvenanceBundle
}

export interface CompileInput {
  factBundle: CelestialFactBundle
  traditionId: string
  chartType: AstrologyChartType
  /** Fixed clock for deterministic output. Defaults to the bundle's own recordedAt. */
  compiledAt?: string
}

export class CompilerRefusal extends Error {
  readonly stage: string
  readonly issues: string[]

  constructor(stage: string, message: string, issues: string[] = []) {
    super(message)
    this.name = 'CompilerRefusal'
    this.stage = stage
    this.issues = issues
  }
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

const EPISTEMIC_BOUNDARY = 'This report states what one named interpretive tradition holds, sourced to transcribed passages. Every rule it draws on is recorded as unvalidated tradition: there is no evidence that any of it predicts anything. It is not advice, and it must not inform any decision listed under prohibited uses.'

/** Subjects present in the bundle, by name, mapped to the fact ids that carry them. */
function subjectIndex(bundle: CelestialFactBundle): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const fact of bundle.facts) {
    const existing = index.get(fact.subject.name) ?? []
    existing.push(fact.id)
    index.set(fact.subject.name, existing)
  }
  return index
}

/** Reads one limb off a computed pañcāṅga. */
function limbValue(panchanga: Panchanga, limb: NonNullable<InterpretationRule['conditions'][number]['requiresLimb']>['limb']): { name: string; nearBoundary: boolean } {
  switch (limb) {
    case 'tithi': return { name: panchanga.tithi.name, nearBoundary: panchanga.tithi.nearBoundary }
    case 'nakshatra': return { name: panchanga.nakshatra.name, nearBoundary: panchanga.nakshatra.nearBoundary }
    case 'yoga': return { name: panchanga.yoga.name, nearBoundary: panchanga.yoga.nearBoundary }
    case 'karana': return { name: panchanga.karana.name, nearBoundary: panchanga.karana.nearBoundary }
    case 'vara': return { name: panchanga.vara.name, nearBoundary: false }
  }
}

/** Decides one rule's fate. Returns the fact ids it reads, or the reason it was excluded. */
function screenRule(
  rule: InterpretationRule,
  chartType: AstrologyChartType,
  subjects: Map<string, string[]>,
  panchanga: Panchanga | null,
): { included: true; factIds: string[]; observed: string[] } | { included: false; exclusion: RuleExclusion } {
  const base = { ruleId: rule.id, technique: rule.technique }

  if (!rule.chartTypes.includes(chartType)) {
    return { included: false, exclusion: { ...base, reason: 'chart-type-mismatch', detail: `Rule applies to ${rule.chartTypes.join(', ')}, not ${chartType}.` } }
  }

  // Policy is screened before conditions: a forbidden rule must not be reported
  // as merely inapplicable, because that would misdescribe why it was withheld.
  const blocked = BLOCKED_TECHNIQUES[rule.technique]
  if (blocked) {
    return { included: false, exclusion: { ...base, reason: 'report-policy', detail: `Technique "${rule.technique}" is withheld from all generated output: ${blocked}.` } }
  }

  const factIds: string[] = []
  const observed: string[] = []
  for (const condition of rule.conditions) {
    if (condition.derivation === 'requires-derivation') {
      return { included: false, exclusion: { ...base, reason: 'requires-derivation', detail: `Condition on ${condition.factField} needs a derivation the compiler does not perform: ${condition.description}` } }
    }

    if (condition.factField.startsWith('panchanga.')) {
      if (!panchanga) {
        return { included: false, exclusion: { ...base, reason: 'panchanga-unavailable', detail: 'No observer is present in the fact bundle, so no pañcāṅga could be derived for this moment.' } }
      }
      if (condition.requiresLimb) {
        const { limb, anyOf } = condition.requiresLimb
        const value = limbValue(panchanga, limb)
        // A limb within tolerance of a division edge would flip on a small
        // change of ayanāṁśa or instant. Reporting a verdict off it would be
        // asserting more precision than the input carries.
        if (value.nearBoundary) {
          return { included: false, exclusion: { ...base, reason: 'limb-uncertain', detail: `The ${limb} is within the boundary tolerance of a division edge, so it is not asserted for this moment.` } }
        }
        if (!anyOf.includes(value.name)) {
          return { included: false, exclusion: { ...base, reason: 'condition-unsatisfied', detail: `The ${limb} is ${value.name}; this rule requires ${anyOf.join(' or ')}.` } }
        }
        observed.push(`${limb}=${value.name}`)
      }
      continue
    }

    if (condition.requiresSubjects) {
      const matched = condition.requiresSubjects.flatMap((subject) => subjects.get(subject) ?? [])
      if (matched.length === 0) {
        return { included: false, exclusion: { ...base, reason: 'condition-unsatisfied', detail: `None of ${condition.requiresSubjects.join(', ')} is present in the fact bundle.` } }
      }
      factIds.push(...matched)
    }
  }

  return { included: true, factIds: [...new Set(factIds)], observed }
}

export function compileReport(input: CompileInput): CompiledReport {
  const { factBundle, traditionId, chartType } = input

  // Stage 1 — the fact layer must be valid before anything reads it.
  const issues = validateCelestialFactBundle(factBundle)
  if (issues.length > 0) throw new CompilerRefusal('validate-facts', 'The celestial fact bundle is not valid.', issues)

  // Stage 2 — one declared tradition, and it must practise this chart type.
  const tradition = getAstrologyTradition(traditionId)
  if (!tradition) throw new CompilerRefusal('resolve-tradition', `Unknown tradition ${traditionId}.`)
  if (!tradition.chartTypes.includes(chartType)) throw new CompilerRefusal('resolve-tradition', `Tradition ${traditionId} does not practise ${chartType} charts.`)

  const rules = getRulesForTradition(traditionId)
  if (rules.length === 0) throw new CompilerRefusal('select-rules', `Tradition ${traditionId} has no published rules.`, tradition.unpopulatedReason ? [tradition.unpopulatedReason] : [])

  // Stage 3 — screen every rule, recording why each one was kept or withheld.
  const subjects = subjectIndex(factBundle)
  // Derived from the bundle rather than passed in, so the report cannot be
  // compiled against a pañcāṅga belonging to a different moment or place.
  const observer = factBundle.observers[0]
  const panchanga = observer
    ? computePanchanga({
      instant: new Date(factBundle.time.utcInstant),
      latitudeDegrees: observer.latitudeDegrees,
      longitudeDegrees: observer.longitudeDegrees,
      elevationMeters: observer.elevationMeters,
    })
    : null
  const modules: CompiledModule[] = []
  const exclusions: RuleExclusion[] = []

  for (const rule of rules) {
    const screened = screenRule(rule, chartType, subjects, panchanga)
    if (!screened.included) { exclusions.push(screened.exclusion); continue }

    const sourceIds = [...new Set(rule.passageIds.map((id) => getAstrologyPassage(id)?.sourceId).filter((id) => id !== undefined))]
    modules.push({
      id: `reportModule-${rule.id}`,
      heading: rule.technique,
      ruleId: rule.id,
      paragraph: rule.interpretation,
      passageIds: [...rule.passageIds],
      sourceIds,
      factIds: screened.factIds,
      observedLimbs: screened.observed,
      disagreements: [...rule.disagreements],
      boundary: rule.boundary,
    })
  }

  if (modules.length === 0) throw new CompilerRefusal('compose', 'No rule survived screening, so there is nothing this tradition can say about these facts.', exclusions.map((exclusion) => `${exclusion.ruleId}: ${exclusion.detail}`))

  // Stage 4 — provenance, keyed to digests of the exact inputs.
  const factBundleSha256 = sha256(canonicalCelestialFactBundle(factBundle))
  const inputSha256 = sha256(JSON.stringify({ factBundleSha256, traditionId, chartType, compilerVersion: COMPILER_VERSION, registryVersion: ASTROLOGY_VERSION, panchangaVersion: panchanga?.version ?? null }))

  const report: CompiledReport = {
    reportId: `rep_${inputSha256.slice(7, 27)}`,
    traditionId,
    traditionName: tradition.name,
    chartType,
    epistemicBoundary: EPISTEMIC_BOUNDARY,
    prohibitedUses: [...ASTROLOGY_PROHIBITED_USES],
    conflictPolicy: CONFLICT_POLICY,
    modules,
    exclusions,
    panchanga,
    provenance: {
      compilerVersion: COMPILER_VERSION,
      traditionRegistryVersion: ASTROLOGY_VERSION,
      traditionId,
      factBundleId: factBundle.bundleId,
      factBundleSha256,
      inputSha256,
      ruleIds: modules.map((reportModule) => reportModule.ruleId),
      passageIds: [...new Set(modules.flatMap((reportModule) => reportModule.passageIds))],
      sourceIds: [...new Set(modules.flatMap((reportModule) => reportModule.sourceIds))],
      compiledAt: input.compiledAt ?? factBundle.recordedAt,
    },
  }

  // Stage 5 — audit the compiler's own output before returning it.
  auditReport(report)
  return report
}

/**
 * Post-compilation audit.
 *
 * The compiler is deterministic, so this should never fire. It exists because
 * "should never fire" is a claim worth testing on every single call rather
 * than asserting in a comment.
 */
export function auditReport(report: CompiledReport): void {
  const findings: string[] = []

  for (const reportModule of report.modules) {
    const rule = getRulesForTradition(report.traditionId).find((candidate) => candidate.id === reportModule.ruleId)
    if (!rule) { findings.push(`${reportModule.id} cites rule ${reportModule.ruleId}, which is not in the declared tradition.`); continue }

    // Every reportModule must be traceable to a transcribed passage from a
    // rights-cleared source, or it is an unsupported claim.
    if (reportModule.passageIds.length === 0) findings.push(`${reportModule.id} has no source passage.`)
    for (const passageId of reportModule.passageIds) {
      const passage = getAstrologyPassage(passageId)
      if (!passage) { findings.push(`${reportModule.id} cites missing passage ${passageId}.`); continue }
      const source = getAstrologySource(passage.sourceId)
      if (!source) findings.push(`${reportModule.id} cites passage ${passageId} with no source.`)
      else if (source.rightsStatus === 'in-copyright') findings.push(`${reportModule.id} cites an in-copyright source.`)
    }

    // The narrative must be the recorded interpretation, unaltered.
    if (reportModule.paragraph !== rule.interpretation) findings.push(`${reportModule.id} text does not match rule ${rule.id}; the compiler must not rewrite a claim.`)
    if (rule.empirical !== 'unvalidated-tradition') findings.push(`${reportModule.id} draws on a rule that is not unvalidated-tradition.`)
    if (BLOCKED_TECHNIQUES[rule.technique]) findings.push(`${reportModule.id} uses blocked technique ${rule.technique}.`)
    if (!reportModule.boundary) findings.push(`${reportModule.id} has no boundary.`)
  }

  if (!report.epistemicBoundary) findings.push('Report has no epistemic boundary.')
  if (report.prohibitedUses.length === 0) findings.push('Report does not publish its prohibited uses.')

  if (findings.length > 0) throw new CompilerRefusal('audit', 'The compiled report failed its own audit.', findings)
}
