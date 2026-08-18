import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { ASTROLOGY_PASSAGES, ASTROLOGY_RULES, ASTROLOGY_VERSION } from './astrology-traditions.ts'
import { digestOf } from './celestial-hypotheses/canonical.ts'
import { NATAL_CHART_VERSION } from './natal-chart.ts'
import { NATAL_TIMING_VERSION } from './natal-timing.ts'
import { PANCHANGA_VERSION } from './panchanga.ts'

export const PRACTITIONER_REVIEW_VERSION = 'practitioner-review/0.1' as const
export const PRACTITIONER_REVIEW_RUBRIC_VERSION = 1 as const

export const REVIEW_SCOPES = ['calculation-conventions', 'source-fidelity', 'rule-formalization'] as const
export type ReviewScope = typeof REVIEW_SCOPES[number]
export const CRITERION_VERDICTS = ['agree', 'agree-with-reservation', 'revise', 'disagree', 'not-qualified'] as const
export type CriterionVerdict = typeof CRITERION_VERDICTS[number]
export const REVIEW_VERDICTS = ['accepted', 'accepted-with-reservations', 'revision-required', 'disagreed', 'abstained'] as const
export type ReviewVerdict = typeof REVIEW_VERDICTS[number]
export const DISAGREEMENT_SEVERITIES = ['advisory', 'material', 'blocking'] as const

export interface ReviewCriterion {
  id: string
  label: string
  question: string
}

export interface PractitionerReviewTarget {
  scope: ReviewScope
  targetType: 'calculation-profile' | 'source-passage' | 'interpretation-rule'
  targetId: string
  targetVersion: string
  targetSha256: string
  title: string
  payload: Record<string, unknown>
  criteria: ReviewCriterion[]
}

export interface ReviewerSnapshot {
  reviewerId: string
  profileVersion: number
  displayName: string
  qualifications: string
  affiliation: string | null
  identityUrl: string | null
  conflicts: string[]
  qualifiedForScope: true
}

export interface CriterionReview {
  criterionId: string
  verdict: CriterionVerdict
  rationale: string
}

export interface ReviewDisagreement {
  criterionId: string
  severity: typeof DISAGREEMENT_SEVERITIES[number]
  statement: string
  proposedResolution: string | null
}

export interface PractitionerReviewInput {
  targetId: string
  targetVersion: string
  targetSha256: string
  reviewer: ReviewerSnapshot
  criteria: CriterionReview[]
  disagreements: ReviewDisagreement[]
  rationale: string
  supersedesReviewId: string | null
  idempotencyKey: string
}

export type PractitionerReviewRecord = Omit<PractitionerReviewInput, 'idempotencyKey'> & {
  schemaVersion: typeof PRACTITIONER_REVIEW_VERSION
  rubricVersion: typeof PRACTITIONER_REVIEW_RUBRIC_VERSION
  reviewId: string
  scope: ReviewScope
  targetType: PractitionerReviewTarget['targetType']
  verdict: ReviewVerdict
  reviewedAtUtc: string
  recordSha256: string
}

export type PublicationReviewStatus = 'awaiting-review' | 'accepted' | 'revision-required'

export interface RulePublicationReview {
  ruleId: string
  status: PublicationReviewStatus
  requirements: {
    targetId: string
    targetVersion: string
    targetSha256: string
    scope: 'source-fidelity' | 'rule-formalization'
    status: PublicationReviewStatus
  }[]
}

const CALCULATION_CRITERIA: ReviewCriterion[] = [
  { id: 'lahiri-ayanamsa', label: 'Lahiri ayanamsa', question: 'Is the declared Lahiri zero point, precession method, uncertainty, and boundary handling suitable and accurately described?' },
  { id: 'lunar-node-model', label: 'Mean versus true node', question: 'Is use of the mean lunar node appropriate for this profile, and is the distinction from the true oscillating node explicit?' },
  { id: 'house-system', label: 'House system', question: 'Is whole-sign house assignment implemented and described consistently, including its separation from ascendant calculation?' },
  { id: 'vimshottari-balance', label: 'Vimshottari balance', question: 'Does the actual-nakshatra-stay-time birth-balance method faithfully implement the declared convention, including year length and sub-period proportions?' },
]

const SOURCE_CRITERIA: ReviewCriterion[] = [
  { id: 'transcription-accuracy', label: 'Transcription', question: 'Does the excerpt match the named edition without silent modernization or correction?' },
  { id: 'locator-accuracy', label: 'Locator', question: 'Does the locator let another reviewer find the passage in the cited source and edition?' },
  { id: 'contextual-integrity', label: 'Context', question: 'Does the bounded excerpt preserve the source context needed to avoid materially changing its sense?' },
]

const RULE_CRITERIA: ReviewCriterion[] = [
  { id: 'condition-fidelity', label: 'Conditions', question: 'Do the coded chart conditions express the conditions stated by the cited passage without adding unstated requirements?' },
  { id: 'interpretation-fidelity', label: 'Interpretation', question: 'Does the structured interpretation preserve the source claim without strengthening or universalizing it?' },
  { id: 'exceptions-and-variants', label: 'Exceptions and variants', question: 'Are source qualifications, disagreements, and unresolved variants represented rather than silently collapsed?' },
]

function calculationTarget(): PractitionerReviewTarget {
  const payload = {
    versions: { panchanga: PANCHANGA_VERSION, natalChart: NATAL_CHART_VERSION, natalTiming: NATAL_TIMING_VERSION },
    conventions: {
      ayanamsa: 'Lahiri (Chitrapaksha), J2000 anchor advanced with IAU 2006 general precession polynomial',
      lunarNode: 'mean ascending lunar node; Ketu exactly opposite',
      houses: 'whole-sign houses counted from the Lahiri-sidereal ascendant sign',
      vimshottariBalance: 'actual nakshatra stay time, 365.2425-day year, proportional antardashas in 120-year cycle',
    },
  }
  return { scope: 'calculation-conventions', targetType: 'calculation-profile', targetId: 'maha-vedic-calculation-profile', targetVersion: '1', targetSha256: digestOf(payload), title: 'Maha Vedic calculation profile', payload, criteria: CALCULATION_CRITERIA }
}

export function buildPractitionerReviewTargets(): PractitionerReviewTarget[] {
  const passages: PractitionerReviewTarget[] = ASTROLOGY_PASSAGES.map((passage) => {
    const payload = { registryVersion: ASTROLOGY_VERSION, passage }
    return { scope: 'source-fidelity', targetType: 'source-passage', targetId: passage.id, targetVersion: ASTROLOGY_VERSION, targetSha256: digestOf(payload), title: `Source passage: ${passage.id}`, payload, criteria: SOURCE_CRITERIA }
  })
  const rules: PractitionerReviewTarget[] = ASTROLOGY_RULES.map((rule) => {
    const citedPassages = rule.passageIds.map((id) => ASTROLOGY_PASSAGES.find((passage) => passage.id === id)).filter(Boolean)
    const payload = { registryVersion: ASTROLOGY_VERSION, rule, citedPassages }
    return { scope: 'rule-formalization', targetType: 'interpretation-rule', targetId: rule.id, targetVersion: ASTROLOGY_VERSION, targetSha256: digestOf(payload), title: `Interpretation rule: ${rule.id}`, payload, criteria: RULE_CRITERIA }
  })
  return [calculationTarget(), ...passages, ...rules]
}

function activeReviewsForTarget(target: PractitionerReviewTarget, reviews: PractitionerReviewRecord[]): PractitionerReviewRecord[] {
  const matching = reviews.filter((review) => review.targetId === target.targetId && review.targetVersion === target.targetVersion && review.targetSha256 === target.targetSha256)
  const superseded = new Set(matching.map((review) => review.supersedesReviewId).filter((id): id is string => id !== null))
  return matching.filter((review) => !superseded.has(review.reviewId))
}

function publicationStatusForTarget(target: PractitionerReviewTarget, reviews: PractitionerReviewRecord[]): PublicationReviewStatus {
  const active = activeReviewsForTarget(target, reviews)
  if (active.some((review) => review.verdict === 'revision-required' || review.verdict === 'disagreed')) return 'revision-required'
  if (active.some((review) => review.verdict === 'accepted' || review.verdict === 'accepted-with-reservations')) return 'accepted'
  return 'awaiting-review'
}

/**
 * A source-bound rule is publishable only when its own formalization and every
 * passage it cites have accepted, digest-bound practitioner reviews.
 */
export function assessRulePublicationReview(ruleId: string, reviews: PractitionerReviewRecord[]): RulePublicationReview {
  const rule = ASTROLOGY_RULES.find((candidate) => candidate.id === ruleId)
  if (!rule) throw new Error(`Unknown interpretation rule ${ruleId}.`)
  const targetById = new Map(buildPractitionerReviewTargets().map((target) => [`${target.scope}:${target.targetId}`, target]))
  const targets = [
    ...rule.passageIds.map((passageId) => targetById.get(`source-fidelity:${passageId}`)),
    targetById.get(`rule-formalization:${rule.id}`),
  ]
  if (targets.some((target) => !target)) throw new Error(`${ruleId} is missing a required practitioner-review target.`)
  const requirements = (targets as PractitionerReviewTarget[]).map((target) => ({
    targetId: target.targetId,
    targetVersion: target.targetVersion,
    targetSha256: target.targetSha256,
    scope: target.scope as 'source-fidelity' | 'rule-formalization',
    status: publicationStatusForTarget(target, reviews),
  }))
  const status = requirements.some((requirement) => requirement.status === 'revision-required')
    ? 'revision-required'
    : requirements.every((requirement) => requirement.status === 'accepted') ? 'accepted' : 'awaiting-review'
  return { ruleId, status, requirements }
}

const TARGETS = buildPractitionerReviewTargets()
const TARGET_MAP = new Map(TARGETS.map((target) => [`${target.targetId}:${target.targetVersion}`, target]))

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < minimum || parsed.length > maximum || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain ${minimum}–${maximum} characters on one line.`)
  return parsed
}

function paragraph(value: unknown, field: string, minimum = 20, maximum = 4_000): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < minimum || parsed.length > maximum) throw new Error(`${field} must contain ${minimum}–${maximum} characters.`)
  return parsed
}

function nullableLine(value: unknown, field: string, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null
  return line(value, field, 2, maximum)
}

function httpsUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = line(value, field, 8, 2_000)
  let url: URL
  try { url = new URL(parsed) } catch { throw new Error(`${field} must be an absolute HTTPS URL.`) }
  if (url.protocol !== 'https:') throw new Error(`${field} must be an absolute HTTPS URL.`)
  return url.toString()
}

function reviewer(value: unknown): ReviewerSnapshot {
  const input = record(value, 'reviewer')
  const reviewerId = line(input.reviewerId, 'reviewer.reviewerId', 20, 80)
  if (!/^practitioner_[a-z0-9][a-z0-9_-]{6,63}$/.test(reviewerId)) throw new Error('reviewer.reviewerId is not valid.')
  if (!Number.isInteger(input.profileVersion) || Number(input.profileVersion) < 1) throw new Error('reviewer.profileVersion must be a positive integer.')
  if (input.qualifiedForScope !== true) throw new Error('The reviewer must attest that their qualifications cover this review scope.')
  if (!Array.isArray(input.conflicts) || input.conflicts.length > 20) throw new Error('reviewer.conflicts must be an array with at most 20 entries.')
  return {
    reviewerId,
    profileVersion: Number(input.profileVersion),
    displayName: line(input.displayName, 'reviewer.displayName', 3, 160),
    qualifications: paragraph(input.qualifications, 'reviewer.qualifications', 20, 2_000),
    affiliation: nullableLine(input.affiliation, 'reviewer.affiliation', 200),
    identityUrl: httpsUrl(input.identityUrl, 'reviewer.identityUrl'),
    conflicts: input.conflicts.map((item, index) => line(item, `reviewer.conflicts[${index}]`, 2, 500)),
    qualifiedForScope: true,
  }
}

export function deriveReviewVerdict(criteria: CriterionReview[]): ReviewVerdict {
  const verdicts = new Set(criteria.map((criterion) => criterion.verdict))
  if (verdicts.has('disagree')) return 'disagreed'
  if (verdicts.has('revise')) return 'revision-required'
  if (verdicts.has('not-qualified')) return 'abstained'
  if (verdicts.has('agree-with-reservation')) return 'accepted-with-reservations'
  return 'accepted'
}

export function parsePractitionerReview(value: unknown): PractitionerReviewInput & { target: PractitionerReviewTarget; verdict: ReviewVerdict } {
  const input = record(value, 'request body')
  const targetId = line(input.targetId, 'targetId', 3, 160)
  const targetVersion = line(input.targetVersion, 'targetVersion', 1, 80)
  const targetSha256 = line(input.targetSha256, 'targetSha256', 71, 71)
  if (!/^sha256:[a-f0-9]{64}$/.test(targetSha256)) throw new Error('targetSha256 is not valid.')
  const target = TARGET_MAP.get(`${targetId}:${targetVersion}`)
  if (!target || target.targetSha256 !== targetSha256) throw new Error('The reviewed target version or digest is not in the current review registry.')
  if (!Array.isArray(input.criteria) || input.criteria.length !== target.criteria.length) throw new Error(`criteria must contain exactly ${target.criteria.length} independent criterion reviews.`)
  const allowedCriteria = new Set(target.criteria.map((criterion) => criterion.id))
  const seen = new Set<string>()
  const criteria = input.criteria.map((item, index) => {
    const criterion = record(item, `criteria[${index}]`)
    const criterionId = line(criterion.criterionId, `criteria[${index}].criterionId`, 3, 80)
    if (!allowedCriteria.has(criterionId) || seen.has(criterionId)) throw new Error(`criteria[${index}].criterionId is missing, duplicated, or outside this scope.`)
    seen.add(criterionId)
    if (typeof criterion.verdict !== 'string' || !CRITERION_VERDICTS.includes(criterion.verdict as CriterionVerdict)) throw new Error(`criteria[${index}].verdict is not supported.`)
    return { criterionId, verdict: criterion.verdict as CriterionVerdict, rationale: paragraph(criterion.rationale, `criteria[${index}].rationale`) }
  })
  if (!Array.isArray(input.disagreements) || input.disagreements.length > 20) throw new Error('disagreements must be an array with at most 20 entries.')
  const disagreements = input.disagreements.map((item, index) => {
    const disagreement = record(item, `disagreements[${index}]`)
    const criterionId = line(disagreement.criterionId, `disagreements[${index}].criterionId`, 3, 80)
    if (!allowedCriteria.has(criterionId)) throw new Error(`disagreements[${index}].criterionId is outside this scope.`)
    if (typeof disagreement.severity !== 'string' || !DISAGREEMENT_SEVERITIES.includes(disagreement.severity as ReviewDisagreement['severity'])) throw new Error(`disagreements[${index}].severity is not supported.`)
    return { criterionId, severity: disagreement.severity as ReviewDisagreement['severity'], statement: paragraph(disagreement.statement, `disagreements[${index}].statement`), proposedResolution: disagreement.proposedResolution ? paragraph(disagreement.proposedResolution, `disagreements[${index}].proposedResolution`, 10) : null }
  })
  if (criteria.some((criterion) => ['revise', 'disagree'].includes(criterion.verdict)) && disagreements.length === 0) throw new Error('A revise or disagree verdict requires a structured disagreement.')
  const supersedesReviewId = input.supersedesReviewId === undefined || input.supersedesReviewId === null || input.supersedesReviewId === '' ? null : line(input.supersedesReviewId, 'supersedesReviewId', 41, 41)
  if (supersedesReviewId && !/^prreview_[a-f0-9]{32}$/.test(supersedesReviewId)) throw new Error('supersedesReviewId is not valid.')
  return {
    targetId, targetVersion, targetSha256, target,
    reviewer: reviewer(input.reviewer), criteria, disagreements,
    rationale: paragraph(input.rationale, 'rationale'), supersedesReviewId,
    idempotencyKey: line(input.idempotencyKey, 'idempotencyKey', 8, 160),
    verdict: deriveReviewVerdict(criteria),
  }
}

export function buildPractitionerReviewRecord(input: ReturnType<typeof parsePractitionerReview>, reviewedAt = new Date()): PractitionerReviewRecord {
  if (!Number.isFinite(reviewedAt.getTime())) throw new Error('reviewedAt must be valid.')
  const reviewId = `prreview_${randomUUID().replaceAll('-', '')}`
  const unsigned = {
    schemaVersion: PRACTITIONER_REVIEW_VERSION, rubricVersion: PRACTITIONER_REVIEW_RUBRIC_VERSION,
    reviewId, scope: input.target.scope, targetType: input.target.targetType,
    targetId: input.targetId, targetVersion: input.targetVersion, targetSha256: input.targetSha256,
    reviewer: input.reviewer, criteria: input.criteria, verdict: input.verdict,
    disagreements: input.disagreements, rationale: input.rationale,
    supersedesReviewId: input.supersedesReviewId, reviewedAtUtc: reviewedAt.toISOString(),
  }
  return { ...unsigned, recordSha256: digestOf(unsigned) }
}

export function practitionerReviewHash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function authorizePractitionerReview(request: Request): { authorized: boolean; actorFingerprint?: string } {
  const token = process.env.PRACTITIONER_REVIEW_TOKEN
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || Buffer.byteLength(token) < 32 || !presented) return { authorized: false }
  const expected = Buffer.from(token), actual = Buffer.from(presented)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { authorized: false }
  return { authorized: true, actorFingerprint: practitionerReviewHash(token) }
}

export const PRACTITIONER_REVIEW_BOUNDARY = 'A practitioner review records a scoped expert judgement about one frozen calculation profile, source passage, or rule formalization. It is not product approval, scientific validation, or evidence that astrology predicts outcomes.'
