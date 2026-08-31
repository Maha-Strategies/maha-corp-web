import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from './batch-11-mixed-lineage-release.ts'
import { BATCH_11_REVISION_AUDITS } from './batch-11-revision-canary.ts'

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

export const BOUND_EVIDENCE_SCHEMA = 'maha-batch-11-rehearsal-evidence/4.0' as const

export const TEMPORARY_PREVIEW_SECRET_NAMES = [
  'EPISTEMIC_OPERATIONS_TOKEN',
  'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_PROJECT_REF',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  'VERCEL_TOKEN',
] as const

export const TEARDOWN_HANDLE_KINDS = [
  'supabase-branch',
  'vercel-preview',
  'github-environment-secret',
  'database-release-rows',
] as const
export type TeardownHandleKind = (typeof TEARDOWN_HANDLE_KINDS)[number]

/** Private exact identifiers. This object is never part of public evidence. */
export interface ExactTeardownHandles {
  schemaVersion: 'maha-batch-11-private-teardown-handles/1.0'
  workflowRunId: string
  runMarker: string
  reviewedCommit: string
  supabaseBranch: { branchId: string; parentProjectRef: string }
  vercelPreview: { deploymentId: string; origin: string }
  githubEnvironmentSecrets: { environment: string; names: readonly string[] }
  databaseReleaseRows: { branchId: string; releaseIds: readonly string[] }
}

export type TeardownHandleDigests = Readonly<Record<TeardownHandleKind, string>>

const sha256Canonical = (value: unknown) =>
  `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

/** Derives the public, non-reversible identity of every exact teardown target. */
export function teardownHandleDigests(handles: ExactTeardownHandles): TeardownHandleDigests {
  return {
    'supabase-branch': sha256Canonical({
      branchId: handles.supabaseBranch.branchId,
      parentProjectRef: handles.supabaseBranch.parentProjectRef,
      workflowRunId: handles.workflowRunId,
      reviewedCommit: handles.reviewedCommit,
    }),
    'vercel-preview': sha256Canonical({
      deploymentId: handles.vercelPreview.deploymentId,
      origin: handles.vercelPreview.origin,
      workflowRunId: handles.workflowRunId,
      reviewedCommit: handles.reviewedCommit,
    }),
    'github-environment-secret': sha256Canonical({
      environment: handles.githubEnvironmentSecrets.environment,
      names: [...handles.githubEnvironmentSecrets.names].sort(),
      workflowRunId: handles.workflowRunId,
      reviewedCommit: handles.reviewedCommit,
    }),
    'database-release-rows': sha256Canonical({
      branchId: handles.databaseReleaseRows.branchId,
      releaseIds: [...handles.databaseReleaseRows.releaseIds].sort(),
      workflowRunId: handles.workflowRunId,
      reviewedCommit: handles.reviewedCommit,
    }),
  }
}

/** The run marker every temporary resource is named after. */
export const RUN_MARKER_PREFIX = 'batch-11-mixed-lineage-rehearsal' as const

/**
 * Derives the run marker from the workflow run id.
 *
 * One derivation, used by the rehearsal, the producer and the verifier, so a
 * marker cannot be asserted independently of the run it claims to belong to.
 */
export function runMarkerFor(workflowRunId: string): string {
  return `${RUN_MARKER_PREFIX}-${workflowRunId}`
}

export type BindingRefusal =
  | 'reviewed-commit-malformed'
  | 'reviewed-commit-mismatch'
  | 'cohort-identity-missing'
  | 'lineage-classification-mismatch'
  | 'phase-outcomes-incomplete'
  | 'release-identity-missing'
  | 'cleanup-status-missing'
  | 'workflow-run-id-missing'
  | 'workflow-run-id-malformed'
  | 'run-marker-mismatch'
  | 'release-target-not-contract-derived'
  | 'release-predecessor-mismatch'
  | 'teardown-handle-missing'
  | 'teardown-handle-release-mismatch'

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

/**
 * What each record must release, derived from the committed manifests.
 *
 * The target digest comes from the record's own revision audit, so a
 * well-formed but arbitrary hash cannot stand in for it. The predecessor comes
 * from the lineage declaration: a superseding release must name exactly the
 * declared prior release, and an initial release must name nothing.
 */
export function contractReleaseIdentities(): readonly ReleaseIdentity[] {
  return BATCH_11_LINEAGE_DECLARATIONS.map((declaration) => {
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === declaration.recordId)
    if (!audit) {
      throw new EvidenceBindingRefused('release-target-not-contract-derived', `${declaration.recordId}: no revision audit declares a target digest.`)
    }
    return {
      recordId: declaration.recordId,
      // The release id is issued at run time and is not derivable here.
      releaseId: '',
      targetSha256: audit.revisedRecordRevisionSha256,
      releaseKind: declaration.declaredReleaseKind,
      supersedesReleaseId: declaration.declaredPriorReleaseId,
    }
  })
}

/**
 * Compares issued releases against the contract, field by field.
 *
 * Returns the failures rather than throwing on the first, so a caller can
 * report everything wrong with a cohort at once.
 */
export function compareReleasesToContract(
  issued: readonly ReleaseIdentity[],
  contract: readonly ReleaseIdentity[] = contractReleaseIdentities(),
): string[] {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const release of issued) {
    if (seen.has(release.recordId)) {
      problems.push(`${release.recordId}: released twice in one run.`)
      continue
    }
    seen.add(release.recordId)
    const expected = contract.find((entry) => entry.recordId === release.recordId)
    if (!expected) {
      problems.push(`${release.recordId}: not a declared cohort record.`)
      continue
    }
    if (release.targetSha256 !== expected.targetSha256) {
      problems.push(`${release.recordId}: target digest is not the one the revision audit declares.`)
    }
    if (release.releaseKind !== expected.releaseKind) {
      problems.push(`${release.recordId}: released as ${release.releaseKind} but declared ${expected.releaseKind}.`)
    }
    if (expected.releaseKind === 'superseding' && release.supersedesReleaseId !== expected.supersedesReleaseId) {
      problems.push(`${release.recordId}: superseded ${release.supersedesReleaseId ?? 'nothing'} rather than the declared predecessor ${expected.supersedesReleaseId}.`)
    }
    if (expected.releaseKind === 'initial' && release.supersedesReleaseId !== null) {
      problems.push(`${release.recordId}: an initial release must supersede nothing.`)
    }
  }
  for (const expected of contract) {
    if (!seen.has(expected.recordId)) problems.push(`${expected.recordId}: declared but never released.`)
  }
  return problems
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
  /** Mandatory for executed evidence. Numeric, as GitHub issues it. */
  workflowRunId: string
  planDigest: string
  /** Ordered. Order is part of the identity and part of the digest. */
  cohortRecordIds: readonly string[]
  lineageClassifications: readonly LineageClassification[]
  phaseOutcomes: readonly PhaseOutcome[]
  releaseIdentities: readonly ReleaseIdentity[]
  replayedReleases: number
  /** The marker this run wrote, or null when no deployment was created. */
  deploymentMarker: Readonly<Record<string, unknown>> | null
  /** Exact private targets. Only their digests enter the public artifact. */
  teardownHandles: ExactTeardownHandles
  cleanup: CleanupStatus
  requiredPhaseCount: number
}

export interface BoundEvidence {
  artifactSchema: typeof BOUND_EVIDENCE_SCHEMA
  reviewedCommit: string
  workflowRunId: string
  /** Derived, never supplied. Binds every resource name to this run. */
  runMarker: string
  planDigest: string
  cohortRecordIds: readonly string[]
  lineageClassifications: readonly LineageClassification[]
  phaseOutcomes: readonly PhaseOutcome[]
  releaseIdentities: readonly ReleaseIdentity[]
  releaseCounts: { total: number; initial: number; superseding: number; replayed: number }
  deploymentMarkerDigest: string | null
  teardownHandleDigests: TeardownHandleDigests
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
    workflowRunId: evidence.workflowRunId,
    runMarker: evidence.runMarker,
    planDigest: evidence.planDigest,
    cohortRecordIds: evidence.cohortRecordIds,
    lineageClassifications: evidence.lineageClassifications,
    phaseOutcomes: evidence.phaseOutcomes.map((entry) => ({ phase: entry.phase, status: entry.status })),
    releaseIdentities: evidence.releaseIdentities,
    deploymentMarkerDigest: evidence.deploymentMarkerDigest,
    teardownHandleDigests: evidence.teardownHandleDigests,
    cleanup: evidence.cleanup,
  }
  return `sha256:${createHash('sha256').update(canonicalJson(identity), 'utf8').digest('hex')}`
}

/** Builds the bound block, refusing anything that would leave it unverifiable. */
export function buildBoundEvidence(input: BoundEvidenceInput): BoundEvidence {
  const reviewedCommit = bindReviewedCommit(input.expectedReviewedCommit, input.checkedOutCommit)

  // Evidence that cannot name the run it came from cannot be told apart from
  // evidence of a different run with the same commit and cohort.
  if (!input.workflowRunId) {
    throw new EvidenceBindingRefused('workflow-run-id-missing', 'Executed evidence must carry the workflow run id.')
  }
  if (!/^[0-9]{1,20}$/.test(input.workflowRunId)) {
    throw new EvidenceBindingRefused('workflow-run-id-malformed', `The workflow run id ${JSON.stringify(input.workflowRunId)} is not numeric.`)
  }

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

  // Checked before the generic shape rules below, so a release that disagrees
  // with the repository is reported as a contract violation rather than as a
  // vaguely malformed identity.
  const contractProblems = compareReleasesToContract(input.releaseIdentities)
  if (contractProblems.length > 0) {
    throw new EvidenceBindingRefused(
      contractProblems.some((entry) => entry.includes('predecessor') || entry.includes('supersede'))
        ? 'release-predecessor-mismatch'
        : 'release-target-not-contract-derived',
      contractProblems.join(' '),
    )
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

  const handles = input.teardownHandles
  if (!handles?.supabaseBranch?.branchId || !handles?.vercelPreview?.deploymentId
    || !handles?.databaseReleaseRows?.branchId || handles.databaseReleaseRows.releaseIds.length === 0
    || handles.githubEnvironmentSecrets.names.length === 0) {
    throw new EvidenceBindingRefused('teardown-handle-missing', 'Every temporary resource must have an exact private teardown handle.')
  }
  if (handles.workflowRunId !== input.workflowRunId || handles.reviewedCommit !== reviewedCommit
    || handles.runMarker !== runMarkerFor(input.workflowRunId)) {
    throw new EvidenceBindingRefused('teardown-handle-missing', 'Private teardown handles do not belong to this run and reviewed commit.')
  }
  const issuedReleaseIds = input.releaseIdentities.map((entry) => entry.releaseId).sort()
  const handledReleaseIds = [...handles.databaseReleaseRows.releaseIds].sort()
  if (issuedReleaseIds.join('\u0000') !== handledReleaseIds.join('\u0000')) {
    throw new EvidenceBindingRefused('teardown-handle-release-mismatch', 'The database teardown handle does not name exactly the releases issued by this run.')
  }

  const base = {
    artifactSchema: BOUND_EVIDENCE_SCHEMA,
    reviewedCommit,
    workflowRunId: input.workflowRunId,
    runMarker: runMarkerFor(input.workflowRunId),
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
    teardownHandleDigests: teardownHandleDigests(handles),
    cleanup,
  } satisfies Omit<BoundEvidence, 'artifactDigest'>

  return { ...base, artifactDigest: boundEvidenceDigest(base) }
}
