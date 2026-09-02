import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DIGEST_ROLES, DigestRoleError, attest, candidateTargetDigest, recordRevisionDigest,
  recordRevisionToCandidateTarget, rolesMayBeEqual,
} from '../lib/digest-roles.ts'
import { reconcile } from '../lib/digest-reconciliation.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import map from '../content/digest-reconciliation/digest-role-map.json' with { type: 'json' }
import readiness from '../content/digest-reconciliation/workspace-readiness-report.json' with { type: 'json' }
import cohortReport from '../content/digest-reconciliation/cohort-reconciliation.json' with { type: 'json' }
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const sample = records.get('urn:maha:record:agentic-systems-mcp-mcp-session-lifecycle')!
const cohortIds = [...pkg.canary.records, ...pkg.remainder.records].map((r) => r.recordId)

/* ---------------------------------------------------- the two quantities ---- */

test('candidate target is the record without its publication envelope', () => {
  const target = candidateTargetDigest(sample)
  assert.equal(target, epistemicReviewTargetHash(sample))
  assert.notEqual(target, recordRevisionDigest(sample),
    'the two roles must not coincide, or the bug that caused this sprint would be invisible')
})

test('both digests are reproducible from the same record for the whole cohort', () => {
  let reproduced = 0
  for (const id of cohortIds) {
    const record = records.get(id)
    if (!record) continue
    const conversion = recordRevisionToCandidateTarget(record, recordRevisionDigest(record))
    assert.equal(conversion.result, candidateTargetDigest(record))
    assert.equal(conversion.schemaVersion, 'maha-digest-conversion/1.0')
    reproduced++
  }
  assert.equal(reproduced, 33)
})

/* --------------------------------------------------- role substitution ------ */

test('a record revision digest supplied where a candidate target is expected is refused', () => {
  const revision = recordRevisionDigest(sample)
  const result = reconcile({
    record: sample, packageRevisionDigest: revision,
    // The workspace offering the revision digest is the substitution itself.
    candidate: { recordId: sample.id, targetSha256: revision as string, ready: false },
  })
  assert.equal(result.exactEquivalence, false)
  assert.equal(result.classification, 'B-different-revision')
  assert.ok(result.blockers.includes('revision-or-target-mismatch'))
})

test('a candidate target supplied where a review bundle is expected proves nothing about review', () => {
  const target = candidateTargetDigest(sample)
  const result = reconcile({
    record: sample, packageRevisionDigest: recordRevisionDigest(sample),
    candidate: { recordId: sample.id, targetSha256: target as string, ready: false, approvals: [] },
    reviewBundleDigest: target as string,
    requiredReviewScopes: ['source-fidelity'],
  })
  assert.ok(result.blockers.includes('required-review-missing'),
    'a bundle digest that happens to equal the target must not satisfy the review requirement')
})

test('attest refuses a digest that does not describe the object given', () => {
  assert.throws(() => attest('candidate-target', candidateTargetDigest(sample), () => recordRevisionDigest(sample)),
    (error: unknown) => error instanceof DigestRoleError && error.code === 'recomputation-mismatch')
})

test('attest refuses a malformed digest before recomputing anything', () => {
  assert.throws(() => attest('audit', 'not-a-digest', () => 'never reached'),
    (error: unknown) => error instanceof DigestRoleError && error.code === 'malformed-digest')
})

test('conversion refuses a record that does not reproduce the supplied revision', () => {
  const other = records.get(cohortIds.find((id) => id !== sample.id)!)!
  assert.throws(() => recordRevisionToCandidateTarget(other, recordRevisionDigest(sample)),
    (error: unknown) => error instanceof DigestRoleError && error.code === 'source-object-mismatch')
})

test('only candidate-target and release-target may ever be equal', () => {
  const permitted = DIGEST_ROLES.flatMap((l) => DIGEST_ROLES.map((r) => [l, r] as const))
    .filter(([l, r]) => l < r && rolesMayBeEqual(l, r))
  assert.deepEqual(permitted, [['candidate-target', 'release-target']])
})

/* -------------------------------------------------------- fail closed ------- */

test('the verifier fails closed without a record', () => {
  const result = reconcile({ record: null, packageRevisionDigest: null, candidate: { recordId: 'x', targetSha256: 'sha256:' + 'a'.repeat(64) } })
  assert.equal(result.exactEquivalence, false)
  assert.equal(result.classification, 'G-candidate-ingestion-incomplete')
  assert.equal(result.reingestionRequired, true)
})

test('the verifier fails closed without a candidate', () => {
  const result = reconcile({ record: sample, packageRevisionDigest: recordRevisionDigest(sample), candidate: null })
  assert.equal(result.exactEquivalence, false)
  assert.equal(result.ready, false)
})

/* ------------------------------------------------------ workspace state ----- */

test('an already-released target is recognised, not re-released', () => {
  const target = candidateTargetDigest(sample) as string
  const result = reconcile({
    record: sample, packageRevisionDigest: recordRevisionDigest(sample),
    candidate: { recordId: sample.id, targetSha256: target, ready: false,
      activeRelease: { releaseId: 'rel_1', targetSha256: target, status: 'active' } },
  })
  assert.equal(result.releaseAlreadyPresent, true)
  assert.ok(result.blockers.includes('active-release-already-present'))
})

test('a superseded predecessor is not counted as an active release', () => {
  const target = candidateTargetDigest(sample) as string
  const result = reconcile({
    record: sample, packageRevisionDigest: recordRevisionDigest(sample),
    candidate: { recordId: sample.id, targetSha256: target, ready: false,
      activeRelease: { releaseId: 'rel_0', targetSha256: target, status: 'superseded' } },
  })
  assert.equal(result.releaseAlreadyPresent, false)
})

/* ---------------------------------------------- the measured workspace ------ */

test('all 423 candidates are explained by exactly two predicates', () => {
  assert.equal(readiness.totals.candidates, 423)
  assert.equal(readiness.totals.ready, 0)
  assert.equal(readiness.partition.exhaustive, true)
  assert.equal(readiness.partition['awaiting-expert-review'], 310)
  assert.equal(readiness.partition['already-released-at-this-target'], 113)
  assert.equal(readiness.partition.sum, readiness.totals.candidates)
})

test('the workspace is not described as merely unready', () => {
  assert.equal(readiness.categories['required-review-missing'], 310)
  assert.equal(readiness.theActualFailedPredicate.requiredScopes.length, 4)
  assert.equal(readiness.theActualFailedPredicate.eachScopeMissingOn, 310)
})

test('every comparable candidate reproduces its workspace target', () => {
  assert.equal(readiness.digestRoleFinding.localRecordsPresent, 288)
  assert.equal(readiness.digestRoleFinding.localTargetMatches, 288)
})

/* ------------------------------------------------ the cohort verdict -------- */

test('all 33 prove content equivalence and none is cleared for release', () => {
  assert.equal(cohortReport.cohortSize, 33)
  assert.equal(cohortReport.contentEquivalenceProven, 33)
  assert.equal(cohortReport.remediations['remain-blocked'], 33)
  assert.equal(cohortReport.classifications['F-review-bound-to-wrong-quantity'], 33)
})

test('proven content equivalence does not by itself authorise a release', () => {
  for (const record of cohortReport.records) {
    assert.equal(record.contentEquivalenceProven, true)
    assert.equal(record.remediation, 'remain-blocked')
    assert.match(record.remediationReason, /different review vocabulary/)
  }
})

test('the review vocabularies are recorded as different, not reconciled', () => {
  const mismatch = cohortReport.reviewVocabularyMismatch
  assert.equal(mismatch.packageCarries.axes, 5)
  assert.equal(mismatch.readinessRequires.count, 4)
  assert.match(mismatch.refused, /Transferring the internal-editorial decisions/)
})

test('inferred fields are labelled as inferred', () => {
  for (const record of cohortReport.records) {
    assert.match(record.readinessBlockerEvidence, /^inferred:/)
    assert.match(record.activeReleaseEvidence, /^measured:/)
  }
})

/* ------------------------------------------------------- the role map ------- */

test('the role map documents six roles and one permitted equality', () => {
  assert.equal(map.roles.length, 6)
  assert.equal(map.permittedEqualities.length, 1)
  assert.equal(map.forbiddenEqualities.length, 14)
  assert.equal(map.conversions[0].provenOverCohort.reproduced, 33)
  assert.equal(map.conversions[0].provenOverCohort.failed, 0)
})

test('the role map names the anti-pattern that caused the halt', () => {
  assert.match(map.antiPattern.observed, /froze record-revision digests/)
  assert.match(map.antiPattern.consequence, /Zero of 33/)
})
