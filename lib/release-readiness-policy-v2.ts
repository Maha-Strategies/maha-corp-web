import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import type { CandidateTargetDigest } from './digest-roles.ts'

/**
 * Two ways to be releasable, and they do not touch.
 *
 * Path A is the existing expert route, unchanged. Path B is an automated
 * internal editorial route with its own five axes and its own public label.
 *
 * The two are disjunctive, not a relaxation: satisfying Path B does not lower
 * any Path A requirement, and no machine axis is ever counted toward an expert
 * scope. A bundle mixing the two satisfies neither, because a review that half
 * happened is not a review.
 */

export const EXPERT_SCOPES = [
  'source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator',
] as const
export type ExpertScope = (typeof EXPERT_SCOPES)[number]

export const MACHINE_AXES = [
  'source-identity-and-fidelity', 'claim-to-passage-support', 'scope-and-unsupported-inference',
  'rights-and-locator-adequacy', 'release-boundary-and-nonclaims',
] as const
export type MachineAxis = (typeof MACHINE_AXES)[number]

export const REVIEW_POLICY_VERSION = 2

export type AssuranceLabel = 'expert-reviewed-canonical' | 'automated-internal-review-canonical'

export interface ReviewDecision {
  scope: string
  decision: 'approve' | 'revise' | 'reject'
  reviewerKind: string
  /** Every decision binds to the candidate target, never to a record revision. */
  boundTarget: string
  policyVersion: number
  decidedAt: string
  inspectedContent: boolean
  exactLocator: string | null
  /** Present only on human decisions. A machine decision carrying one is a lie. */
  personAttribution?: string | null
}

export interface ReadinessInput {
  target: CandidateTargetDigest | string
  decisions: readonly ReviewDecision[]
  alignmentAuditTarget: string | null
  alignmentClear: boolean
  activeReleaseTarget: string | null
  releaseAuthoritySeparate: boolean
}

export type ReadinessRefusal =
  | 'no-decisions' | 'stale-target' | 'mixed-policy-bundle' | 'unknown-reviewer-kind'
  | 'person-attribution-on-machine-decision' | 'missing-axis' | 'duplicate-axis'
  | 'conflicting-axis' | 'not-approved' | 'inconsistent-policy-version'
  | 'content-not-inspected' | 'locator-missing' | 'alignment-not-clear'
  | 'alignment-audit-target-mismatch' | 'release-authority-not-separate'
  | 'already-released-at-target'

export interface ReadinessVerdict {
  ready: boolean
  path: 'A' | 'B' | null
  assuranceLabel: AssuranceLabel | null
  refusals: readonly ReadinessRefusal[]
  policyVersion: number
  verdictDigest: string
}

const MACHINE_KIND = 'automated-internal-editorial'
const EXPERT_KINDS: ReadonlySet<string> = new Set(['expert', 'external-expert', 'domain-expert'])

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

/** The assurances each label may and may not carry, in public wording. */
export const ASSURANCE_DISCLOSURE = {
  'automated-internal-review-canonical': {
    label: 'automated-internal-review-canonical',
    discloses: [
      'Reviewed by an automated internal editorial process.',
      'No human reviewed this record.',
      'No external reviewer participated.',
      'No expert endorsement is claimed.',
      'No independent reproduction was performed.',
      'The release certifies provenance and policy compliance, not scientific truth.',
    ],
    humanReviewed: false,
    externallyReviewed: false,
    independent: false,
    expertEndorsement: false,
    releaseAuthority: 'separate',
    mustNeverRenderAs: [
      'expert reviewed', 'independently validated', 'human approved',
      'consensus', 'certified truth',
    ],
  },
  'expert-reviewed-canonical': {
    label: 'expert-reviewed-canonical',
    discloses: ['Reviewed against the four expert scopes.'],
    humanReviewed: true,
    externallyReviewed: true,
    independent: true,
    expertEndorsement: true,
    releaseAuthority: 'separate',
    mustNeverRenderAs: ['certified truth'],
  },
} as const

/** Wording that must never appear on a Path B page, whatever produced it. */
export const PROHIBITED_ASSURANCE_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'expert reviewed', pattern: /\bexpert[- ]reviewed\b|\breviewed by (an? )?expert/i },
  { name: 'independently validated', pattern: /\bindependently (validated|verified|reproduced|replicated)\b/i },
  { name: 'human approved', pattern: /\bhuman[- ](approved|reviewed|verified)\b/i },
  { name: 'consensus', pattern: /\b(scientific |expert )?consensus\b/i },
  { name: 'certified truth', pattern: /\bcertified (as )?(true|truth|accurate)\b|\bcertifies? (the )?truth\b/i },
  { name: 'peer review', pattern: /\bpeer[- ]reviewed\b/i },
]

export function scanAssuranceText(text: string): readonly string[] {
  return PROHIBITED_ASSURANCE_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.name)
}

function axisProblems(
  decisions: readonly ReviewDecision[], required: readonly string[],
): ReadinessRefusal[] {
  const refusals: ReadinessRefusal[] = []
  const seen = new Map<string, ReviewDecision[]>()
  for (const decision of decisions) {
    seen.set(decision.scope, [...(seen.get(decision.scope) ?? []), decision])
  }
  for (const scope of required) {
    const found = seen.get(scope) ?? []
    if (found.length === 0) { refusals.push('missing-axis'); continue }
    if (found.length > 1) {
      // Duplicates are only a conflict when they disagree; identical repeats
      // are still refused, because a bundle should say each thing once.
      refusals.push(new Set(found.map((f) => f.decision)).size > 1 ? 'conflicting-axis' : 'duplicate-axis')
    }
    if (found.some((f) => f.decision !== 'approve')) refusals.push('not-approved')
  }
  const extra = [...seen.keys()].filter((scope) => !required.includes(scope))
  if (extra.length > 0) refusals.push('mixed-policy-bundle')
  return refusals
}

export function evaluateReadinessV2(input: ReadinessInput): ReadinessVerdict {
  const refusals: ReadinessRefusal[] = []
  const decisions = input.decisions

  if (decisions.length === 0) {
    return verdict(false, null, null, ['no-decisions'])
  }
  // Every decision must bind to the target under evaluation.
  if (decisions.some((d) => d.boundTarget !== input.target)) refusals.push('stale-target')
  if (new Set(decisions.map((d) => d.policyVersion)).size > 1) refusals.push('inconsistent-policy-version')

  const kinds = new Set(decisions.map((d) => d.reviewerKind))
  const machine = kinds.size === 1 && kinds.has(MACHINE_KIND)
  const expert = [...kinds].every((k) => EXPERT_KINDS.has(k))
  if (!machine && !expert) {
    // A bundle that is neither wholly machine nor wholly expert satisfies
    // neither path, and an unrecognised kind fails closed.
    refusals.push([...kinds].some((k) => k !== MACHINE_KIND && !EXPERT_KINDS.has(k))
      ? 'unknown-reviewer-kind' : 'mixed-policy-bundle')
  }

  if (input.activeReleaseTarget === input.target) refusals.push('already-released-at-target')
  if (!input.releaseAuthoritySeparate) refusals.push('release-authority-not-separate')
  if (!input.alignmentClear) refusals.push('alignment-not-clear')
  if (input.alignmentAuditTarget !== input.target) refusals.push('alignment-audit-target-mismatch')

  if (machine) {
    // A machine decision naming a person is refused outright.
    if (decisions.some((d) => d.personAttribution)) refusals.push('person-attribution-on-machine-decision')
    if (decisions.some((d) => !d.inspectedContent)) refusals.push('content-not-inspected')
    if (decisions.some((d) => !d.exactLocator)) refusals.push('locator-missing')
    refusals.push(...axisProblems(decisions, MACHINE_AXES))
    const ready = refusals.length === 0
    return verdict(ready, ready ? 'B' : null, ready ? 'automated-internal-review-canonical' : null, refusals)
  }

  if (expert) {
    refusals.push(...axisProblems(decisions, EXPERT_SCOPES))
    const ready = refusals.length === 0
    return verdict(ready, ready ? 'A' : null, ready ? 'expert-reviewed-canonical' : null, refusals)
  }

  return verdict(false, null, null, refusals)

  function verdict(
    ready: boolean, path: 'A' | 'B' | null, label: AssuranceLabel | null, list: ReadinessRefusal[],
  ): ReadinessVerdict {
    const unique = [...new Set(list)]
    const body = { ready, path, assuranceLabel: label, refusals: unique, policyVersion: REVIEW_POLICY_VERSION }
    return { ...body, verdictDigest: sha(body) }
  }
}
