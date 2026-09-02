import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import {
  DIGEST_ROLES, DigestRoleError, candidateTargetDigest, recordRevisionDigest,
  recordRevisionToCandidateTarget, rolesMayBeEqual,
  type DigestRole,
} from './digest-roles.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

/**
 * Reconciles one local record against one workspace candidate.
 *
 * The verifier fails closed: an unknown role or a missing canonical input
 * produces a refusal, never a default of "equivalent". The distinction it
 * exists to protect is that equal content under two digest roles is not the
 * same thing as a review that binds to the right one.
 */

export type ReconciliationClass =
  | 'A-same-content-different-role'
  | 'B-different-revision'
  | 'C-deterministic-envelope-difference'
  | 'D-stale-local-inventory'
  | 'E-stale-production-candidate'
  | 'F-review-bound-to-wrong-quantity'
  | 'G-candidate-ingestion-incomplete'
  | 'H-unknown'

export type BlockerCode =
  | 'revision-or-target-mismatch' | 'required-review-missing' | 'stale-review'
  | 'audit-digest-mismatch' | 'source-alignment-blocked' | 'malformed-candidate'
  | 'unsupported-record-class' | 'active-release-already-present' | 'lineage-conflict'
  | 'withdrawn-or-superseded-predecessor' | 'policy-tier-mismatch' | 'unknown-or-unobservable'

export interface WorkspaceCandidate {
  recordId: string
  targetSha256: string
  ready?: boolean
  blockers?: readonly unknown[] | null
  approvals?: readonly unknown[] | null
  activeRelease?: { releaseId: string; targetSha256: string; status?: string } | null
}

export interface ReconciliationInput {
  record: EpistemicRecord | null
  packageRevisionDigest: string | null
  candidate: WorkspaceCandidate | null
  auditDigest?: string | null
  reviewBundleDigest?: string | null
  requiredReviewScopes?: readonly string[]
}

export interface RoleComparison {
  role: DigestRole
  local: string | null
  production: string | null
  equal: boolean
  mayBeEqual: boolean
}

export interface ReconciliationResult {
  recordId: string
  comparisons: readonly RoleComparison[]
  exactEquivalence: boolean
  equivalenceProof: string | null
  classification: ReconciliationClass
  ready: boolean
  blockers: readonly BlockerCode[]
  rereviewRequired: boolean
  reingestionRequired: boolean
  releaseAlreadyPresent: boolean
  reconciliationDigest: string
}

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

export function reconcile(input: ReconciliationInput): ReconciliationResult {
  const recordId = input.record?.id ?? input.candidate?.recordId ?? 'unknown'
  const blockers: BlockerCode[] = []

  // Fail closed. Without the record there is no canonical input to recompute
  // from, so nothing downstream may claim equivalence.
  if (!input.record) {
    return finish(recordId, [], false, null, 'G-candidate-ingestion-incomplete',
      false, ['malformed-candidate'], false, true, false)
  }
  if (!input.candidate) {
    return finish(recordId, [], false, null, 'G-candidate-ingestion-incomplete',
      false, ['unknown-or-unobservable'], false, true, false)
  }

  const localRevision = recordRevisionDigest(input.record)
  const localTarget = candidateTargetDigest(input.record)
  const productionTarget = input.candidate.targetSha256

  const comparisons: RoleComparison[] = [
    { role: 'record-revision', local: localRevision, production: null, equal: false, mayBeEqual: false },
    { role: 'candidate-target', local: localTarget, production: productionTarget,
      equal: localTarget === productionTarget, mayBeEqual: true },
    { role: 'audit', local: input.auditDigest ?? null, production: null, equal: false, mayBeEqual: false },
    { role: 'review-bundle', local: input.reviewBundleDigest ?? null, production: null, equal: false, mayBeEqual: false },
    { role: 'release-target', local: localTarget,
      production: input.candidate.activeRelease?.targetSha256 ?? null,
      equal: input.candidate.activeRelease?.targetSha256 === localTarget, mayBeEqual: true },
  ]

  // Any digest role we do not recognise stops the reconciliation.
  for (const comparison of comparisons) {
    if (!DIGEST_ROLES.includes(comparison.role)) {
      throw new DigestRoleError('unknown-role', `${comparison.role} is not a declared digest role.`)
    }
  }

  const targetMatches = localTarget === productionTarget
  let classification: ReconciliationClass = 'H-unknown'
  let proof: string | null = null
  let exactEquivalence = false

  if (targetMatches) {
    // Byte-level proof, not judgement: the same record object reproduces the
    // package's revision digest and Production's target through two documented
    // windows over the same content.
    const packageMatches = input.packageRevisionDigest === localRevision
    if (packageMatches) {
      const conversion = recordRevisionToCandidateTarget(input.record, localRevision)
      if (conversion.result === productionTarget) {
        exactEquivalence = true
        classification = 'A-same-content-different-role'
        proof = `recordRevisionDigest(record)=${localRevision} equals the package value; the same record without its publication key hashes to ${conversion.result}, which equals Production's targetSha256. Both recomputed under ${conversion.schemaVersion}.`
      }
    } else {
      classification = 'D-stale-local-inventory'
      proof = 'Production offers the target this record produces, but the package froze a revision this record does not reproduce.'
      blockers.push('revision-or-target-mismatch')
    }
  } else {
    classification = 'B-different-revision'
    blockers.push('revision-or-target-mismatch')
  }

  const active = input.candidate.activeRelease ?? null
  const releaseAlreadyPresent = Boolean(active) && active?.status !== 'superseded'
  if (releaseAlreadyPresent && active?.targetSha256 === localTarget) blockers.push('active-release-already-present')

  // Reviews must bind to the candidate target. A bundle digest alone proves a
  // bundle exists locally, never that Production holds approvals for it.
  const approvals = input.candidate.approvals ?? []
  const required = input.requiredReviewScopes ?? input.record.publication?.requiredReviewScopes ?? []
  if (approvals.length === 0 && required.length > 0) blockers.push('required-review-missing')
  if (input.candidate.ready === false && blockers.length === 0) blockers.push('unknown-or-unobservable')

  const rereviewRequired = classification === 'B-different-revision' || blockers.includes('stale-review')
  const reingestionRequired = !targetMatches && classification !== 'B-different-revision'
  const ready = input.candidate.ready === true && blockers.length === 0

  if (exactEquivalence && blockers.includes('required-review-missing')) {
    // Content is provably the same object; what is absent is the decision.
    classification = 'F-review-bound-to-wrong-quantity'
  }

  return finish(recordId, comparisons, exactEquivalence, proof, classification,
    ready, blockers, rereviewRequired, reingestionRequired, releaseAlreadyPresent)
}

function finish(
  recordId: string, comparisons: readonly RoleComparison[], exactEquivalence: boolean,
  equivalenceProof: string | null, classification: ReconciliationClass, ready: boolean,
  blockers: readonly BlockerCode[], rereviewRequired: boolean,
  reingestionRequired: boolean, releaseAlreadyPresent: boolean,
): ReconciliationResult {
  const body = {
    recordId, comparisons, exactEquivalence, equivalenceProof, classification,
    ready, blockers, rereviewRequired, reingestionRequired, releaseAlreadyPresent,
  }
  return { ...body, reconciliationDigest: sha(body) }
}

/** Two roles compared as raw strings is the defect this whole module exists for. */
export function refuseStringComparison(left: DigestRole, right: DigestRole): void {
  if (!rolesMayBeEqual(left, right)) {
    throw new DigestRoleError('role-conflation', `${left} may never be compared to ${right}.`)
  }
}
