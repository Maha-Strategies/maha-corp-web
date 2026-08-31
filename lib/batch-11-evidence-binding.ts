import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * Binds executed rehearsal evidence to the code that was reviewed.
 *
 * The previous artifact described what happened without saying which commit it
 * happened from. Everything in it could be true of a run from any tree, so a
 * reader had no way to tell reviewed code from unreviewed code, and the
 * verifier had nothing to check the operator's claimed SHA against.
 *
 * The reviewed commit here comes from the rehearsal's own validated inputs -
 * the environment value the workflow supplied and the commit actually checked
 * out - and never from a field on an artifact, which is the thing being
 * authenticated. It is then folded into the artifact digest alongside the
 * cohort identity, so a correct artifact from a different commit, or the same
 * artifact with a swapped record, produces a different digest.
 */

export const BOUND_EVIDENCE_SCHEMA = 'maha-batch-11-rehearsal-evidence/2.0' as const

export type BindingRefusal =
  | 'reviewed-commit-malformed'
  | 'reviewed-commit-mismatch'
  | 'cohort-identity-missing'
  | 'lineage-classification-mismatch'
  | 'phase-outcomes-incomplete'
  | 'release-identity-missing'
  | 'cleanup-status-missing'

export class EvidenceBindingRefused extends Error {
  code: BindingRefusal

  constructor(code: BindingRefusal, message: string) {
    super(message)
    this.name = 'EvidenceBindingRefused'
    this.code = code
  }
}

/**
 * Resolves the reviewed commit from validated inputs, or refuses.
 *
 * Both values must be full forty-character hexadecimal and must agree. A
 * missing environment value is a refusal rather than a fallback to whatever
 * happens to be checked out: "the tree I am standing in" is not evidence that
 * a human reviewed it.
 */
export function bindReviewedCommit(expected: string, checkedOut: string): string {
  const sha = /^[0-9a-f]{40}$/
  if (!sha.test(expected)) {
    throw new EvidenceBindingRefused('reviewed-commit-malformed', 'The declared reviewed commit is not a 40-character lowercase hexadecimal SHA.')
  }
  if (!sha.test(checkedOut)) {
    throw new EvidenceBindingRefused('reviewed-commit-malformed', 'The checked-out commit is not a 40-character lowercase hexadecimal SHA.')
  }
  if (expected !== checkedOut) {
    throw new EvidenceBindingRefused('reviewed-commit-mismatch', 'The checked-out commit does not equal the declared reviewed commit.')
  }
  return expected
}

export interface ReleaseIdentity {
  recordId: string
  releaseId: string
  targetSha256: string
  releaseKind: 'initial' | 'superseding'
  supersedesReleaseId: string | null
}

export interface LineageClassification {
  recordId: string
  expected: 'initial' | 'superseding'
  observed: 'initial' | 'superseding'
}

export interface PhaseOutcome {
  phase: string
  status: string
  mutations: number
}

export interface CleanupStatus {
  branchDestroyed: boolean
  deploymentDestroyed: boolean
  markerRemoved: boolean
}

export interface BoundEvidenceInput {
  expectedReviewedCommit: string
  checkedOutCommit: string
  workflowRunId: string | null
  planDigest: string
  /** Ordered. Order is part of the identity and part of the digest. */
  cohortRecordIds: readonly string[]
  lineageClassifications: readonly LineageClassification[]
  phaseOutcomes: readonly PhaseOutcome[]
  releaseIdentities: readonly ReleaseIdentity[]
  replayedReleases: number
  /** The marker this run wrote, or null when no deployment was created. */
  deploymentMarker: Readonly<Record<string, unknown>> | null
  cleanup: CleanupStatus
  requiredPhaseCount: number
}

export interface BoundEvidence {
  artifactSchema: typeof BOUND_EVIDENCE_SCHEMA
  reviewedCommit: string
  workflowRunId: string | null
  planDigest: string
  cohortRecordIds: readonly string[]
  lineageClassifications: readonly LineageClassification[]
  phaseOutcomes: readonly PhaseOutcome[]
  releaseIdentities: readonly ReleaseIdentity[]
  releaseCounts: { total: number; initial: number; superseding: number; replayed: number }
  deploymentMarkerDigest: string | null
  cleanup: CleanupStatus
  artifactDigest: string
}

/**
 * Digest over the fields that identify the run.
 *
 * Deliberately narrow: the reviewed commit, the cohort in order, the plan
 * digest, the classifications, the phase outcomes, the release identities and
 * the cleanup status. Free text and counters derivable from these are left out,
 * so the digest moves when identity moves and not when prose does.
 */
export function boundEvidenceDigest(evidence: Omit<BoundEvidence, 'artifactDigest'>): string {
  const identity = {
    artifactSchema: evidence.artifactSchema,
    reviewedCommit: evidence.reviewedCommit,
    planDigest: evidence.planDigest,
    cohortRecordIds: evidence.cohortRecordIds,
    lineageClassifications: evidence.lineageClassifications,
    phaseOutcomes: evidence.phaseOutcomes.map((entry) => ({ phase: entry.phase, status: entry.status })),
    releaseIdentities: evidence.releaseIdentities,
    deploymentMarkerDigest: evidence.deploymentMarkerDigest,
    cleanup: evidence.cleanup,
  }
  return `sha256:${createHash('sha256').update(canonicalJson(identity), 'utf8').digest('hex')}`
}

/** Builds the bound block, refusing anything that would leave it unverifiable. */
export function buildBoundEvidence(input: BoundEvidenceInput): BoundEvidence {
  const reviewedCommit = bindReviewedCommit(input.expectedReviewedCommit, input.checkedOutCommit)

  if (input.cohortRecordIds.length === 0) {
    throw new EvidenceBindingRefused('cohort-identity-missing', 'The artifact must name the records it released, in order.')
  }
  if (new Set(input.cohortRecordIds).size !== input.cohortRecordIds.length) {
    throw new EvidenceBindingRefused('cohort-identity-missing', 'A record appears more than once in the cohort identity.')
  }

  const classified = new Set(input.lineageClassifications.map((entry) => entry.recordId))
  for (const recordId of input.cohortRecordIds) {
    if (!classified.has(recordId)) {
      throw new EvidenceBindingRefused('lineage-classification-mismatch', `${recordId} has no lineage classification.`)
    }
  }
  for (const entry of input.lineageClassifications) {
    if (entry.expected !== entry.observed) {
      throw new EvidenceBindingRefused('lineage-classification-mismatch',
        `${entry.recordId}: expected a ${entry.expected} release but observed ${entry.observed}.`)
    }
  }

  if (input.phaseOutcomes.length !== input.requiredPhaseCount) {
    throw new EvidenceBindingRefused('phase-outcomes-incomplete',
      `Expected ${input.requiredPhaseCount} phase outcomes, received ${input.phaseOutcomes.length}.`)
  }

  if (input.releaseIdentities.length === 0) {
    throw new EvidenceBindingRefused('release-identity-missing', 'The artifact must name the releases it issued.')
  }
  for (const release of input.releaseIdentities) {
    if (!release.releaseId || !release.targetSha256) {
      throw new EvidenceBindingRefused('release-identity-missing', `${release.recordId}: a release identity is incomplete.`)
    }
    if (release.releaseKind === 'superseding' && !release.supersedesReleaseId) {
      throw new EvidenceBindingRefused('release-identity-missing', `${release.recordId}: a superseding release must name its predecessor.`)
    }
    if (release.releaseKind === 'initial' && release.supersedesReleaseId) {
      throw new EvidenceBindingRefused('release-identity-missing', `${release.recordId}: an initial release must supersede nothing.`)
    }
  }

  const cleanup = input.cleanup
  if (typeof cleanup?.branchDestroyed !== 'boolean'
    || typeof cleanup?.deploymentDestroyed !== 'boolean'
    || typeof cleanup?.markerRemoved !== 'boolean') {
    throw new EvidenceBindingRefused('cleanup-status-missing', 'The artifact must state the cleanup status of every temporary resource.')
  }

  const base = {
    artifactSchema: BOUND_EVIDENCE_SCHEMA,
    reviewedCommit,
    workflowRunId: input.workflowRunId,
    planDigest: input.planDigest,
    cohortRecordIds: [...input.cohortRecordIds],
    lineageClassifications: [...input.lineageClassifications],
    phaseOutcomes: [...input.phaseOutcomes],
    releaseIdentities: [...input.releaseIdentities],
    releaseCounts: {
      total: input.releaseIdentities.length,
      initial: input.releaseIdentities.filter((entry) => entry.releaseKind === 'initial').length,
      superseding: input.releaseIdentities.filter((entry) => entry.releaseKind === 'superseding').length,
      replayed: input.replayedReleases,
    },
    // A digest, so the marker's identifiers can be attested without disclosure.
    deploymentMarkerDigest: input.deploymentMarker
      ? `sha256:${createHash('sha256').update(canonicalJson(input.deploymentMarker), 'utf8').digest('hex')}`
      : null,
    cleanup,
  } satisfies Omit<BoundEvidence, 'artifactDigest'>

  return { ...base, artifactDigest: boundEvidenceDigest(base) }
}
