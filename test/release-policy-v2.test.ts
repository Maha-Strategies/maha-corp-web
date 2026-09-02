import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASSURANCE_DISCLOSURE, EXPERT_SCOPES, MACHINE_AXES, REVIEW_POLICY_VERSION,
  evaluateReadinessV2, scanAssuranceText, type ReviewDecision,
} from '../lib/release-readiness-policy-v2.ts'
import { authorizeDispatch, consume, type DispatchAuthorization } from '../lib/dispatch-authorization.ts'
import drift from '../content/authorization/authorization-drift-record.json' with { type: 'json' }
import decisions from '../content/release-policy-v2/automated-editorial-decisions.json' with { type: 'json' }
import pkg from '../content/release-policy-v2/candidate-target-package.json' with { type: 'json' }
import simulation from '../content/release-policy-v2/simulated-readiness.json' with { type: 'json' }
import plan from '../content/release-policy-v2/release-plan.json' with { type: 'json' }
import preview from '../content/release-policy-v2/preview-rehearsal-plan.json' with { type: 'json' }
import pgEvidence from '../content/release-policy-v2/postgres-evidence.json' with { type: 'json' }

const TARGET = 'sha256:' + 'a'.repeat(64)
const machine = (scopes: readonly string[], over: Partial<ReviewDecision> = {}): ReviewDecision[] =>
  scopes.map((scope) => ({
    scope, decision: 'approve', reviewerKind: 'automated-internal-editorial',
    boundTarget: TARGET, policyVersion: 2, decidedAt: '2026-09-02',
    inspectedContent: true, exactLocator: 'p. 4', personAttribution: null, ...over,
  }))
const base = { alignmentAuditTarget: TARGET, alignmentClear: true, activeReleaseTarget: null, releaseAuthoritySeparate: true }

/* ------------------------------------------------------- the two paths ------ */

test('a complete automated bundle passes Path B with its own label', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES), ...base })
  assert.equal(v.ready, true)
  assert.equal(v.path, 'B')
  assert.equal(v.assuranceLabel, 'automated-internal-review-canonical')
})

test('a complete expert bundle passes Path A unchanged', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(EXPERT_SCOPES, { reviewerKind: 'expert' }), ...base })
  assert.equal(v.ready, true)
  assert.equal(v.path, 'A')
  assert.equal(v.assuranceLabel, 'expert-reviewed-canonical')
})

test('machine axes are never counted toward expert scopes', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(EXPERT_SCOPES), ...base })
  assert.equal(v.ready, false)
  assert.ok(v.refusals.includes('missing-axis'), 'expert scope names under a machine kind must not satisfy Path B')
})

test('a mixed bundle satisfies neither path', () => {
  const v = evaluateReadinessV2({
    target: TARGET,
    decisions: [...machine(MACHINE_AXES.slice(0, 2)), ...machine(EXPERT_SCOPES.slice(0, 2), { reviewerKind: 'expert' })],
    ...base,
  })
  assert.equal(v.ready, false)
  assert.equal(v.path, null)
  assert.ok(v.refusals.includes('mixed-policy-bundle'))
})

test('an unknown reviewer kind fails closed', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES, { reviewerKind: 'mystery' }), ...base })
  assert.ok(v.refusals.includes('unknown-reviewer-kind'))
})

test('a machine decision naming a person is refused', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES, { personAttribution: 'Dr Someone' }), ...base })
  assert.ok(v.refusals.includes('person-attribution-on-machine-decision'))
})

test('a decision bound to another target is stale', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES, { boundTarget: 'sha256:' + 'b'.repeat(64) }), ...base })
  assert.ok(v.refusals.includes('stale-target'))
})

test('four of five axes is not five', () => {
  const v = evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES.slice(0, 4)), ...base })
  assert.equal(v.ready, false)
  assert.ok(v.refusals.includes('missing-axis'))
})

test('an already-released target is refused, and release authority stays separate', () => {
  assert.ok(evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES), ...base, activeReleaseTarget: TARGET })
    .refusals.includes('already-released-at-target'))
  assert.ok(evaluateReadinessV2({ target: TARGET, decisions: machine(MACHINE_AXES), ...base, releaseAuthoritySeparate: false })
    .refusals.includes('release-authority-not-separate'))
})

/* ------------------------------------------------- the assurance boundary --- */

test('Path B discloses every absent assurance', () => {
  const d = ASSURANCE_DISCLOSURE['automated-internal-review-canonical']
  assert.equal(d.humanReviewed, false)
  assert.equal(d.externallyReviewed, false)
  assert.equal(d.independent, false)
  assert.equal(d.expertEndorsement, false)
  assert.equal(d.releaseAuthority, 'separate')
  assert.equal(d.discloses.length, 6)
  assert.ok(d.discloses.some((s) => /provenance and policy compliance, not scientific truth/.test(s)))
})

test('the prohibited renderings are actually detected', () => {
  for (const text of ['this is expert-reviewed', 'independently validated by us', 'human approved',
    'the scientific consensus', 'certified true', 'peer-reviewed work']) {
    assert.ok(scanAssuranceText(text).length > 0, `${text} must be caught`)
  }
  assert.deepEqual(scanAssuranceText('Reviewed by an automated internal editorial process.'), [])
})

/* ------------------------------------------------------ dispatch guard ------ */

const grant: DispatchAuthorization = {
  authorizationId: 'auth_test_0001', operation: 'source-cluster-release',
  reviewedCommit: 'a'.repeat(40), allowedPurposes: ['readiness'],
  expiresAt: '2026-09-03T00:00:00.000Z', maxInvocations: 1, invocationsUsed: 0,
  grantsReleaseAuthority: false,
}
const request = {
  authorizationId: 'auth_test_0001', operation: 'source-cluster-release',
  commit: 'a'.repeat(40), purpose: 'readiness' as const,
  at: '2026-09-02T12:00:00.000Z', requestsReleaseAuthority: false,
}

test('a matching request is permitted exactly once', () => {
  assert.equal(authorizeDispatch(grant, request).permitted, true)
  const used = consume(grant)
  assert.equal(authorizeDispatch(used, request).permitted, false)
  assert.ok(authorizeDispatch(used, request).refusals.includes('invocations-exhausted'))
})

test('an authorization for one purpose does not authorize another', () => {
  const verdict = authorizeDispatch(grant, { ...request, purpose: 'canary' })
  assert.equal(verdict.permitted, false)
  assert.ok(verdict.refusals.includes('purpose-not-authorized'))
})

test('a different commit is not the reviewed commit', () => {
  assert.ok(authorizeDispatch(grant, { ...request, commit: 'b'.repeat(40) }).refusals.includes('commit-mismatch'))
  assert.ok(authorizeDispatch(grant, { ...request, commit: 'short' }).refusals.includes('malformed-commit'))
})

test('an expired grant refuses', () => {
  assert.ok(authorizeDispatch(grant, { ...request, at: '2026-09-04T00:00:00.000Z' }).refusals.includes('authorization-expired'))
})

test('a read-only purpose may not draw release authority', () => {
  assert.ok(authorizeDispatch(grant, { ...request, requestsReleaseAuthority: true })
    .refusals.includes('release-authority-not-granted'))
})

test('an unknown authorization refuses without explaining itself', () => {
  const verdict = authorizeDispatch(null, request)
  assert.equal(verdict.permitted, false)
  assert.deepEqual(verdict.refusals, ['unknown-authorization'])
})

/* -------------------------------------------------------- the artifacts ----- */

test('the drift record is honest about what exceeded the grant', () => {
  assert.equal(drift.originallyAuthorized.count, 3)
  assert.equal(drift.actuallyDispatched.length, 5)
  assert.equal(drift.gatesApprovedOutsideOriginalGrant, 3)
  assert.equal(drift.mutationCapableStepsExecuted, 0)
  assert.equal(drift.canaryExecuted, false)
  assert.equal(drift.remainderExecuted, false)
  assert.equal(drift.stillWaiting.state, 'waiting')
})

test('the corrected package binds candidate targets and supersedes the old digests', () => {
  assert.equal(pkg.digestRole, 'candidate-target')
  assert.equal(pkg.producedBy, 'epistemicReviewTargetHash')
  assert.equal(pkg.canary.length, 5)
  assert.equal(pkg.remainder.length, 28)
  for (const entry of [...pkg.canary, ...pkg.remainder]) {
    assert.match(entry.candidateTargetDigest, /^sha256:[0-9a-f]{64}$/)
    assert.notEqual(entry.candidateTargetDigest, entry.supersededRecordRevisionDigest)
    assert.equal(entry.policyVersion, REVIEW_POLICY_VERSION)
    assert.equal(entry.assuranceLabel, 'automated-internal-review-canonical')
  }
})

test('new decisions were produced by re-evaluation, not by rewriting a digest field', () => {
  assert.equal(decisions.appendOnly, true)
  assert.equal(decisions.writtenToProduction, false)
  assert.equal(decisions.expertDecisionsCreated, 0)
  assert.match(decisions.method, /No prior decision was edited/)
  assert.equal(decisions.supersededDecisions.disposition.includes('never presented as binding'), true)
  for (const record of decisions.records) {
    if (record.status !== 'path-b-ready') continue
    assert.equal(record.digestLineage.contentByteEquivalent, true)
    assert.notEqual(record.newDecisionBundleDigest, record.supersededDecisionBundleDigest)
    for (const d of record.decisions) assert.equal(d.boundTarget, record.digestLineage.correctCandidateTargetDigest)
  }
})

test('the simulation never calls Production and moves only the 33', () => {
  assert.equal(simulation.calledProductionRpc, false)
  assert.equal(simulation.cohort.total, 33)
  assert.equal(simulation.cohort.pathBReady, 33)
  assert.equal(simulation.restOfWorkspace.assumedMachineReviewed, 0)
})

test('public counts are labelled projections, and only the live figure is observed', () => {
  assert.equal(plan.projectedPublicCounts.observedLiveToday, 792)
  assert.equal(plan.projectedPublicCounts.afterCanary, 797)
  assert.equal(plan.projectedPublicCounts.afterRemainderAndCascade, 826)
  assert.equal(plan.projectedPublicCounts.remainingGapToOneThousand, 174)
  assert.match(plan.projectedPublicCounts.status, /^PROJECTED/)
  assert.equal(plan.authorized, false)
  assert.equal(plan.dispatched, false)
})

test('the Preview rehearsal is schema-only and does not imply a Production release', () => {
  assert.equal(preview.dispatched, false)
  assert.equal(preview.database.seededFromProduction, false)
  assert.equal(preview.scope.productionWrites, 0)
  assert.match(preview.productionRelationship, /separately authorized/)
  assert.ok(preview.closureEvidence.excludes.includes('credential values'))
})

test('the migration is forward-only, unapplied, and its defect was caught before it shipped', () => {
  assert.equal(pgEvidence.migrationAppliedToProduction, false)
  assert.equal(pgEvidence.forwardOnly, true)
  assert.equal(pgEvidence.priorMigrationsEdited, 0)
  assert.equal(pgEvidence.results.passed, 16)
  assert.equal(pgEvidence.results.failed, 0)
  assert.equal(pgEvidence.mutationCheck.allCaught, true)
  assert.match(pgEvidence.defectFoundByThisTesting.defect, /malformed array literal/)
})
