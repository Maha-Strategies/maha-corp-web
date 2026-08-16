/**
 * Registration: the moment a hypothesis stops being editable.
 *
 * Everything this module rejects, it rejects *before* a lock is taken, because
 * the value of a pre-registration is entirely in what could not be changed
 * afterwards. A registration that admitted a vague KPI, a missing comparator,
 * or an unversioned analysis plan would be a timestamp on nothing.
 */

import { ASTROLOGY_PROHIBITED_USES, ASTROLOGY_VERSION, getAstrologyTradition, getRulesForTradition } from '../astrology-traditions.ts'
import { validateCelestialFactBundle } from '../celestial-facts.ts'
import { BLOCKED_TECHNIQUES, COMPILER_VERSION } from '../interpretation-compiler.ts'
import { digestOf, isExplicitUtcInstant } from './canonical.ts'
import {
  ACTIVITY_TYPES,
  EXPERIMENT_ID_PATTERN,
  HYPOTHESIS_REGISTRY_VERSION,
  METRIC_DIRECTIONS,
  METRIC_KINDS,
  PARTICIPANT_PSEUDONYM_PATTERN,
  SHA256_PATTERN,
  type ActivityType,
  type ExperimentDraft,
  type ExperimentRegistration,
} from './types.ts'

export class RegistrationRejected extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`Registration rejected: ${issues.length} issue(s).`)
    this.name = 'RegistrationRejected'
    this.issues = issues
  }
}

/**
 * Words that signal a KPI nobody else could reproduce.
 *
 * This is a coarse net and it is meant to be. A metric whose name is "success"
 * or "vibes" is not measurable by a third party, and the cost of a false
 * rejection — the participant renames the field — is far lower than the cost of
 * admitting an outcome the participant grades themselves.
 */
const SUBJECTIVE_TERMS = [
  'success', 'good', 'bad', 'better', 'worse', 'lucky', 'unlucky', 'auspicious',
  'inauspicious', 'feel', 'felt', 'feeling', 'vibe', 'vibes', 'sense', 'mood',
  'satisfaction', 'happiness', 'wellbeing', 'well-being', 'energy', 'flow',
  'smooth', 'smoothly', 'positive', 'negative', 'favourable', 'favorable',
]

/** Activity domains that map onto a prohibited use, refused outright. */
const PROHIBITED_ACTIVITY_TERMS = [
  'medical', 'health', 'diagnos', 'treatment', 'patient', 'clinical',
  'legal', 'litigation', 'court',
  'invest', 'trading', 'trade', 'portfolio', 'stock', 'crypto', 'loan', 'lending',
  'hiring', 'firing', 'employment', 'insurance', 'housing', 'custody',
  'pregnan', 'death', 'fatal',
]

function containsAny(haystack: string, needles: string[]): string | null {
  const lowered = haystack.toLowerCase()
  return needles.find((needle) => lowered.includes(needle)) ?? null
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Rejects JSON that is not structurally an ExperimentDraft before domain
 * validation or persistence touches nested fields. Drafts may be semantically
 * incomplete, but malformed JSON is not useful editable state.
 */
export function parseExperimentDraft(value: unknown): { ok: true; draft: ExperimentDraft } | { ok: false; issues: string[] } {
  const root = object(value)
  if (!root) return { ok: false, issues: ['draft must be a JSON object.'] }

  const issues: string[] = []
  const requiredStrings = [
    'experimentId', 'participantPseudonym', 'studyRole', 'activityType',
    'actionWindowStartUtc', 'actionWindowEndUtc', 'factBundleId',
    'factBundleSha256', 'compilerVersion', 'ruleRegistryVersion',
  ]
  for (const field of requiredStrings) if (typeof root[field] !== 'string') issues.push(`draft.${field} must be a string.`)

  const hypothesis = object(root.hypothesis)
  const metric = object(root.metric)
  const comparator = object(root.comparator)
  const matching = object(comparator?.matching)
  const analysisPlan = object(root.analysisPlan)
  const factBundle = object(root.factBundle)
  const factTime = object(factBundle?.time)
  for (const [name, item] of [
    ['hypothesis', hypothesis], ['metric', metric], ['comparator', comparator],
    ['comparator.matching', matching], ['analysisPlan', analysisPlan],
    ['factBundle', factBundle], ['factBundle.time', factTime],
  ] as const) if (!item) issues.push(`draft.${name} must be an object.`)

  for (const [path, item] of [
    ['hypothesis.statement', hypothesis?.statement],
    ['hypothesis.traditionId', hypothesis?.traditionId],
    ['hypothesis.ruleProvenance', hypothesis?.ruleProvenance],
    ['hypothesis.ruleEmpiricalStatus', hypothesis?.ruleEmpiricalStatus],
    ['metric.metricId', metric?.metricId], ['metric.name', metric?.name],
    ['metric.kind', metric?.kind], ['metric.unit', metric?.unit],
    ['metric.direction', metric?.direction], ['metric.measurementProcedure', metric?.measurementProcedure],
    ['metric.source', metric?.source], ['metric.dataSourceId', metric?.dataSourceId],
    ['comparator.policyVersion', comparator?.policyVersion],
    ['comparator.feasibleWindowStartUtc', comparator?.feasibleWindowStartUtc],
    ['comparator.feasibleWindowEndUtc', comparator?.feasibleWindowEndUtc],
    ['comparator.matching.timeZone', matching?.timeZone],
    ['comparator.matching.geographyId', matching?.geographyId],
    ['analysisPlan.planVersion', analysisPlan?.planVersion],
    ['analysisPlan.metricId', analysisPlan?.metricId],
    ['analysisPlan.stoppingRule', analysisPlan?.stoppingRule],
    ['analysisPlan.multiplicityPolicy', analysisPlan?.multiplicityPolicy],
  ] as const) if (typeof item !== 'string') issues.push(`draft.${path} must be a string.`)

  for (const [path, item] of [
    ['metric.horizonHours', metric?.horizonHours], ['comparator.draws', comparator?.draws],
    ['analysisPlan.targetRate', analysisPlan?.targetRate],
    ['analysisPlan.minimumObservations', analysisPlan?.minimumObservations],
    ['sampleSizeTarget', root.sampleSizeTarget],
  ] as const) if (typeof item !== 'number') issues.push(`draft.${path} must be a number.`)

  if (typeof root.prohibitedUseAttestation !== 'boolean') issues.push('draft.prohibitedUseAttestation must be a boolean.')
  if (typeof matching?.sameWeekday !== 'boolean') issues.push('draft.comparator.matching.sameWeekday must be a boolean.')
  if (typeof matching?.sameActivityType !== 'boolean') issues.push('draft.comparator.matching.sameActivityType must be a boolean.')
  if (!Array.isArray(matching?.localHourBand)) issues.push('draft.comparator.matching.localHourBand must be an array.')

  if (!Array.isArray(hypothesis?.ruleIds)) issues.push('draft.hypothesis.ruleIds must be an array.')
  if (!Array.isArray(comparator?.exclusions)) issues.push('draft.comparator.exclusions must be an array.')
  else for (const [index, exclusion] of comparator.exclusions.entries()) {
    const item = object(exclusion)
    if (!item || typeof item.startUtc !== 'string' || typeof item.endUtc !== 'string' || typeof item.reason !== 'string') {
      issues.push(`draft.comparator.exclusions[${index}] must contain string startUtc, endUtc, and reason fields.`)
    }
  }
  if (!Array.isArray(root.inclusionCriteria)) issues.push('draft.inclusionCriteria must be an array.')
  if (!Array.isArray(root.exclusionCriteria)) issues.push('draft.exclusionCriteria must be an array.')
  if (!Array.isArray(factBundle?.observers)) issues.push('draft.factBundle.observers must be an array.')
  if (!Array.isArray(factBundle?.facts)) issues.push('draft.factBundle.facts must be an array.')

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, draft: value as ExperimentDraft }
}

/**
 * The fields the digest covers.
 *
 * `notes` is excluded on purpose: a registration should be annotatable without
 * breaking its own seal. Everything an analysis could turn on is inside.
 */
export function registrationCore(draft: ExperimentDraft) {
  const lockedDraft = Object.fromEntries(Object.entries(draft).filter(([key]) => key !== 'notes'))
  return {
    registryVersion: HYPOTHESIS_REGISTRY_VERSION,
    ...lockedDraft,
  }
}

export function registrationDigest(draft: ExperimentDraft): string {
  return digestOf(registrationCore(draft))
}

/** Digest of the declared analysis plan alone, exposed in the provenance bundle. */
export function analysisPlanDigest(draft: ExperimentDraft): string {
  return digestOf(draft.analysisPlan)
}

function validateIdentity(draft: ExperimentDraft, issues: string[]): void {
  if (!EXPERIMENT_ID_PATTERN.test(draft.experimentId)) issues.push('experimentId must match exp_[a-z0-9]{16,48}.')
  if (!PARTICIPANT_PSEUDONYM_PATTERN.test(draft.participantPseudonym)) {
    issues.push('participantPseudonym must match pseudo_[a-z0-9]{8,64}; real identifiers are not accepted.')
  }
  // Defence in depth: the pattern already forbids `@`, but an identifier that
  // reaches this far carrying one indicates a caller passing an email address.
  if (draft.participantPseudonym.includes('@')) issues.push('participantPseudonym must not contain an email address.')
  if (draft.studyRole !== 'confirmatory') {
    issues.push('This registry version accepts confirmatory registrations only; exploratory and replication roles are not yet supported.')
  }
}

function validateHypothesis(draft: ExperimentDraft, issues: string[]): void {
  const { hypothesis } = draft
  if (hypothesis.ruleEmpiricalStatus !== 'unvalidated-tradition') {
    issues.push('ruleEmpiricalStatus must remain unvalidated-tradition; the registry cannot raise a rule\'s empirical standing.')
  }
  if (!hypothesis.statement || hypothesis.statement.trim().length < 40) {
    issues.push('hypothesis.statement must state a falsifiable prediction of at least 40 characters.')
  }

  const tradition = getAstrologyTradition(hypothesis.traditionId)
  if (!tradition) {
    issues.push(`Unknown tradition ${hypothesis.traditionId}.`)
    return
  }
  if (hypothesis.ruleIds.length === 0) {
    issues.push('At least one rule id is required.')
    return
  }

  const traditionRules = new Map(getRulesForTradition(hypothesis.traditionId).map((rule) => [rule.id, rule]))
  for (const ruleId of hypothesis.ruleIds) {
    const rule = traditionRules.get(ruleId)
    if (!rule) {
      // Either the id does not exist, or it belongs to another tradition. Both
      // are refused; a hypothesis spanning traditions belongs to none of them.
      issues.push(`Rule ${ruleId} is not a rule of tradition ${hypothesis.traditionId}.`)
      continue
    }
    const blocked = BLOCKED_TECHNIQUES[rule.technique]
    if (blocked) issues.push(`Rule ${ruleId} uses technique "${rule.technique}", which is withheld from all output: ${blocked}.`)
    if (rule.provenance !== hypothesis.ruleProvenance) {
      issues.push(`Rule ${ruleId} provenance is ${rule.provenance}, not the declared ${hypothesis.ruleProvenance}.`)
    }
  }
}

function validateActivity(draft: ExperimentDraft, issues: string[]): void {
  if (!ACTIVITY_TYPES.includes(draft.activityType as ActivityType)) {
    issues.push(`activityType must be one of: ${ACTIVITY_TYPES.join(', ')}.`)
  }
  const prohibited = containsAny(draft.activityType, PROHIBITED_ACTIVITY_TERMS)
  if (prohibited) issues.push(`activityType touches a prohibited domain ("${prohibited}").`)
  if (!draft.prohibitedUseAttestation) {
    issues.push(`prohibitedUseAttestation is required. Prohibited uses: ${ASTROLOGY_PROHIBITED_USES.join('; ')}.`)
  }
}

function validateWindows(draft: ExperimentDraft, issues: string[]): void {
  for (const [field, value] of [
    ['actionWindowStartUtc', draft.actionWindowStartUtc],
    ['actionWindowEndUtc', draft.actionWindowEndUtc],
    ['comparator.feasibleWindowStartUtc', draft.comparator?.feasibleWindowStartUtc],
    ['comparator.feasibleWindowEndUtc', draft.comparator?.feasibleWindowEndUtc],
  ] as const) {
    if (!isExplicitUtcInstant(value)) issues.push(`${field} must be an explicit UTC instant ending in Z.`)
  }
  if (isExplicitUtcInstant(draft.actionWindowStartUtc) && isExplicitUtcInstant(draft.actionWindowEndUtc)) {
    if (new Date(draft.actionWindowEndUtc) <= new Date(draft.actionWindowStartUtc)) {
      issues.push('actionWindowEndUtc must be after actionWindowStartUtc.')
    }
    if (draft.comparator && isExplicitUtcInstant(draft.comparator.feasibleWindowStartUtc)
      && isExplicitUtcInstant(draft.comparator.feasibleWindowEndUtc)) {
      const feasibleStart = new Date(draft.comparator.feasibleWindowStartUtc).getTime()
      const feasibleEnd = new Date(draft.comparator.feasibleWindowEndUtc).getTime()
      if (feasibleEnd <= feasibleStart) issues.push('comparator feasible window must have a positive duration.')
      if (new Date(draft.actionWindowStartUtc).getTime() < feasibleStart
        || new Date(draft.actionWindowEndUtc).getTime() > feasibleEnd) {
        issues.push('The declared action window must lie inside the comparator feasible window.')
      }
    }
  }
}

function validateMetric(draft: ExperimentDraft, issues: string[]): void {
  const metric = draft.metric
  if (!metric) { issues.push('metric is required.'); return }
  if (!metric.metricId?.trim()) issues.push('metric.metricId is required.')
  if (!METRIC_KINDS.includes(metric.kind)) issues.push(`metric.kind must be one of: ${METRIC_KINDS.join(', ')}.`)
  if (!METRIC_DIRECTIONS.includes(metric.direction)) issues.push('metric.direction must declare which way is better.')
  if (!metric.unit?.trim()) issues.push('metric.unit is required.')
  if (!Number.isFinite(metric.horizonHours) || metric.horizonHours <= 0) issues.push('metric.horizonHours must be a positive number.')
  if (!metric.dataSourceId?.trim()) issues.push('metric.dataSourceId must name the system of record.')
  if (!metric.measurementProcedure || metric.measurementProcedure.trim().length < 40) {
    issues.push('metric.measurementProcedure must describe, in at least 40 characters, how a third party would obtain the same number.')
  }

  // A participant-graded outcome cannot be blinded to the elected moment.
  if (metric.source === 'self-reported') {
    issues.push('metric.source must be instrumented or third-party-record; self-reported outcomes cannot be blinded to the elected moment.')
  }

  const subjectiveName = containsAny(metric.name ?? '', SUBJECTIVE_TERMS)
  if (subjectiveName) issues.push(`metric.name is subjective ("${subjectiveName}"); name the countable quantity instead.`)
  const subjectiveUnit = containsAny(metric.unit ?? '', SUBJECTIVE_TERMS)
  if (subjectiveUnit) issues.push(`metric.unit is subjective ("${subjectiveUnit}").`)
}

function validateComparator(draft: ExperimentDraft, issues: string[]): void {
  const comparator = draft.comparator
  if (!comparator) { issues.push('comparator policy is required; an experiment with no declared null baseline is not testable.'); return }
  if (comparator.policyVersion !== 'comparator/1') issues.push('comparator.policyVersion must be comparator/1.')
  if (!Number.isInteger(comparator.draws) || comparator.draws < 1 || comparator.draws > 1_000) {
    issues.push('comparator.draws must be an integer between 1 and 1000.')
  }

  const matching = comparator.matching
  if (!matching) { issues.push('comparator.matching is required.'); return }
  const [low, high] = matching.localHourBand ?? []
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 23 || low > high) {
    issues.push('comparator.matching.localHourBand must be an inclusive [low, high] band within 0-23.')
  }
  if (!matching.geographyId?.trim()) issues.push('comparator.matching.geographyId must be declared.')
  if (matching.sameActivityType !== true) issues.push('comparator.matching.sameActivityType must be true in comparator/1.')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: matching.timeZone }).format(new Date(0))
  } catch {
    issues.push('comparator.matching.timeZone must be a valid IANA time zone.')
  }

  const hasSeed = typeof comparator.seed === 'string' && comparator.seed.length >= 16
  const hasCommitment = typeof comparator.seedCommitmentSha256 === 'string' && SHA256_PATTERN.test(comparator.seedCommitmentSha256)
  if (hasSeed === hasCommitment) {
    issues.push('comparator must carry exactly one of seed or seedCommitmentSha256.')
  }

  for (const exclusion of comparator.exclusions ?? []) {
    if (!isExplicitUtcInstant(exclusion.startUtc) || !isExplicitUtcInstant(exclusion.endUtc)) {
      issues.push('Every comparator exclusion must use explicit UTC instants.')
    }
    if (isExplicitUtcInstant(exclusion.startUtc) && isExplicitUtcInstant(exclusion.endUtc)
      && new Date(exclusion.endUtc) <= new Date(exclusion.startUtc)) {
      issues.push('Every comparator exclusion must have a positive duration.')
    }
    if (!exclusion.reason?.trim()) issues.push('Every comparator exclusion must state a reason.')
  }
}

function validateAnalysisPlan(draft: ExperimentDraft, issues: string[]): void {
  const plan = draft.analysisPlan
  if (!plan) { issues.push('analysisPlan is required.'); return }
  if (plan.planVersion !== 'binary-outcome/1') {
    issues.push('analysisPlan.planVersion must be a declared version; this registry ships binary-outcome/1 only.')
  }
  if (plan.metricId !== draft.metric?.metricId) issues.push('analysisPlan.metricId must reference the declared metric.')
  if (!Number.isFinite(plan.targetRate) || plan.targetRate < 0 || plan.targetRate > 1) issues.push('analysisPlan.targetRate must be a rate in [0, 1].')
  if (!Number.isInteger(plan.minimumObservations) || plan.minimumObservations < 1) issues.push('analysisPlan.minimumObservations must be a positive integer.')
  if (!plan.stoppingRule || plan.stoppingRule.trim().length < 20) {
    issues.push('analysisPlan.stoppingRule must be declared; analysing whenever the numbers look good is not a stopping rule.')
  }
  if (!plan.multiplicityPolicy || plan.multiplicityPolicy.trim().length < 20) {
    issues.push('analysisPlan.multiplicityPolicy must be declared, even when only one comparison is planned.')
  }
  if (plan.planVersion === 'binary-outcome/1' && draft.metric?.kind !== 'binary') {
    issues.push('binary-outcome/1 requires a binary metric.')
  }
}

function validateSampling(draft: ExperimentDraft, issues: string[]): void {
  if (!Number.isInteger(draft.sampleSizeTarget) || draft.sampleSizeTarget < 1) issues.push('sampleSizeTarget must be a positive integer.')
  if (draft.analysisPlan && Number.isInteger(draft.analysisPlan.minimumObservations)
    && draft.sampleSizeTarget !== draft.analysisPlan.minimumObservations) {
    issues.push('sampleSizeTarget must equal analysisPlan.minimumObservations in binary-outcome/1 so the stopping point is fixed.')
  }
  if (!Array.isArray(draft.inclusionCriteria) || draft.inclusionCriteria.length === 0) issues.push('At least one inclusion criterion is required.')
  if (!Array.isArray(draft.exclusionCriteria)) issues.push('exclusionCriteria must be an array, empty if nothing is excluded.')
}

function validateFactChain(draft: ExperimentDraft, issues: string[]): void {
  if (!draft.factBundle || typeof draft.factBundle !== 'object') {
    issues.push('factBundle is required so the committed celestial inputs can be independently verified.')
  } else {
    try {
      for (const issue of validateCelestialFactBundle(draft.factBundle)) issues.push(`factBundle: ${issue}`)
    } catch {
      issues.push('factBundle is structurally invalid and cannot be validated.')
    }
    if (draft.factBundle.bundleId !== draft.factBundleId) issues.push('factBundleId must match factBundle.bundleId.')
    const actualDigest = digestOf(draft.factBundle)
    if (actualDigest !== draft.factBundleSha256) issues.push('factBundleSha256 must match the canonical factBundle digest.')
    if (isExplicitUtcInstant(draft.factBundle.time.utcInstant)
      && isExplicitUtcInstant(draft.actionWindowStartUtc)
      && isExplicitUtcInstant(draft.actionWindowEndUtc)) {
      const instant = new Date(draft.factBundle.time.utcInstant).getTime()
      if (instant < new Date(draft.actionWindowStartUtc).getTime()
        || instant > new Date(draft.actionWindowEndUtc).getTime()) {
        issues.push('factBundle.time.utcInstant must lie inside the declared action window.')
      }
    }
  }
  if (!/^cel_[a-z0-9_-]{8,80}$/.test(draft.factBundleId ?? '')) issues.push('factBundleId must be a celestial fact bundle id.')
  if (!SHA256_PATTERN.test(draft.factBundleSha256 ?? '')) issues.push('factBundleSha256 must be a sha256 digest.')
  if (draft.compilerVersion !== COMPILER_VERSION) issues.push(`compilerVersion must be ${COMPILER_VERSION}.`)
  if (draft.ruleRegistryVersion !== ASTROLOGY_VERSION) issues.push(`ruleRegistryVersion must be ${ASTROLOGY_VERSION}.`)
}

/** Every reason this draft cannot be locked. Empty means it can. */
export function validateDraft(draft: ExperimentDraft): string[] {
  const issues: string[] = []
  if (!draft || typeof draft !== 'object') return ['A draft object is required.']
  validateIdentity(draft, issues)
  validateHypothesis(draft, issues)
  validateActivity(draft, issues)
  validateWindows(draft, issues)
  validateMetric(draft, issues)
  validateComparator(draft, issues)
  validateAnalysisPlan(draft, issues)
  validateSampling(draft, issues)
  validateFactChain(draft, issues)
  return issues
}

export interface RegisterOptions {
  /** Injected so registration time is testable and always explicitly UTC. */
  now?: () => Date
}

export function registerExperiment(draft: ExperimentDraft, options: RegisterOptions = {}): ExperimentRegistration {
  const issues = validateDraft(draft)
  const registeredAtUtc = (options.now?.() ?? new Date()).toISOString()
  if (!isExplicitUtcInstant(registeredAtUtc)) {
    issues.push('registeredAtUtc must be an explicit UTC instant.')
  } else if (isExplicitUtcInstant(draft.actionWindowStartUtc)
    && new Date(draft.actionWindowStartUtc).getTime() <= new Date(registeredAtUtc).getTime()) {
    issues.push('actionWindowStartUtc must be after registeredAtUtc; an action that already began cannot be pre-registered.')
  }
  if (issues.length > 0) throw new RegistrationRejected(issues)

  return {
    experimentId: draft.experimentId,
    status: 'registered',
    registryVersion: HYPOTHESIS_REGISTRY_VERSION,
    registrationSha256: registrationDigest(draft),
    registeredAtUtc,
    draft,
  }
}
