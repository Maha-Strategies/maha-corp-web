import assert from 'node:assert/strict'
import test from 'node:test'

import evidence from '../content/source-cluster/release-halt-evidence.json' with { type: 'json' }

test('the evidence records a release that did not happen', () => {
  assert.equal(evidence.outcome, 'halted-before-any-release')
  assert.equal(evidence.phaseAExecuted, false)
  assert.equal(evidence.phaseBExecuted, false)
  assert.equal(evidence.productionMutations, 0)
  assert.equal(evidence.releaseRowsCreated, 0)
  assert.equal(evidence.recordsPromoted, 0)
  assert.equal(evidence.lineageAltered, false)
})

test('every read-only revalidation value matched before the halt', () => {
  const pre = evidence.preReleaseRevalidation
  assert.equal(pre.publicRouteCount, 792)
  assert.equal(pre.releaseRows, 115)
  assert.equal(pre.active, 114)
  assert.equal(pre.superseded, 1)
  assert.equal(pre.withdrawn, 0)
  assert.equal(pre.cohortSize, 33)
  assert.equal(pre.privateSourceFirstCandidatesInCohort, 0)
})

test('the halt has two independent causes, both read-only findings', () => {
  const ids = evidence.haltCause.blockers.map((b) => b.id)
  assert.deepEqual(ids, ['revision-not-offered', 'no-ready-candidates-workspace-wide'])
  const [revision, ready] = evidence.haltCause.blockers
  assert.equal(revision.presentAtExactRevision, 0)
  assert.equal(revision.phaseAInWorkspaceAtAnyRevision + revision.phaseBInWorkspaceAtAnyRevision, 33,
    'all 33 are present, just never at the reviewed revision')
  assert.equal(ready.readyCandidates, 0)
  assert.ok(ready.candidateCount > 33, 'zero-ready is workspace-wide, not cohort-specific')
})

test('no workaround loosened the gate that stopped the release', () => {
  const why = evidence.whyNotWorkedAround
  for (const key of ['reFreezeAgainstOfferedRevisions', 'submitReviewDecisions', 'releaseTheOfferedRevision']) {
    assert.match(String((why as Record<string, string>)[key]), /^Refused\./)
  }
})

test('the unrelated workflow failure is diagnosed, not claimed fixed', () => {
  assert.equal(evidence.unrelatedFinding.claimedFixed, false)
  assert.match(evidence.unrelatedFinding.status, /pre-existing/)
})

test('the evidence carries no token, reviewer identity, rationale or passage', () => {
  const blob = JSON.stringify(evidence)
  for (const pattern of [/bearer/i, /token["':\s]+[A-Za-z0-9_-]{16}/i, /reviewerId/i, /reviewerName/i,
    /packetDigest/i, /inspectedContentLocation/i, /passage/i]) {
    assert.ok(!pattern.test(blob), `evidence must not contain ${pattern}`)
  }
})
