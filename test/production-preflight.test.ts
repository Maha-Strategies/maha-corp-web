import assert from 'node:assert/strict'
import test from 'node:test'

import preflight from '../content/source-cluster/production-preflight.json' with { type: 'json' }
import plan from '../content/source-cluster/production-operating-plan.json' with { type: 'json' }
import capacity from '../content/source-cluster/capacity-report.json' with { type: 'json' }
import proof from '../content/source-cluster/cascade-proof.json' with { type: 'json' }

test('the preflight is read-only and mutated nothing', () => {
  assert.equal(preflight.mode, 'read-only')
  assert.equal(preflight.mutationsPerformed, 0)
  assert.equal(preflight.repairsPerformed, 0)
  assert.equal(preflight.credentialsUsed, 'none')
  for (const record of preflight.records) assert.equal(record.repaired, false)
})

test('all 33 records classify as ready, with every attribute checked', () => {
  assert.equal(preflight.cohortSize, 33)
  assert.equal(preflight.classification['canary-ready'], 5)
  assert.equal(preflight.classification['remainder-ready'], 28)
  for (const record of preflight.records) {
    assert.equal(record.attributesChecked, 15)
    assert.deepEqual(record.failedAttributes, [])
  }
})

test('no record is stale, already released, undecided or in lineage conflict', () => {
  const seen: Record<string, number> = preflight.classification
  for (const failure of ['stale-revision', 'existing-release', 'missing-decision', 'lineage-conflict', 'blocked']) {
    assert.equal(seen[failure], undefined, `${failure} must be empty`)
  }
})

test('every record carries a five-axis decision bound to its exact revision', () => {
  for (const record of preflight.records) {
    assert.equal(record.reviewAxes.length, 5)
    assert.match(String(record.reviewBundleDigest), /^sha256:[0-9a-f]{64}$/)
    assert.match(String(record.revisionSha256), /^sha256:[0-9a-f]{64}$/)
    assert.match(String(record.operationId), /^release:[0-9a-f]{32}$/)
  }
})

test('the tier never claims human, expert, independent or external review', () => {
  const tier = preflight.reviewTier as Record<string, unknown>
  assert.equal(tier.reviewerKind, 'automated-internal-editorial')
  for (const claim of ['humanReviewed', 'externallyReviewed', 'expertEndorsement', 'independent']) {
    assert.equal(tier[claim], false)
  }
  assert.equal(tier.releaseAuthority, 'separate')
})

test('the plan is unauthorized and unexecuted', () => {
  assert.equal(plan.executed, false)
  assert.equal(plan.authorized, false)
  assert.equal(plan.sanitizedEvidenceContract.secretsIncluded, false)
})

test('phase A moves no source page and phase B moves exactly one', () => {
  const [a, b] = plan.phases
  assert.equal(a.records, 5)
  assert.equal(a.expectedSourceCascade, 0)
  assert.equal(b.records, 28)
  assert.equal(b.expectedSourceCascade, 1)
  assert.equal(b.publicTotalBefore, a.publicTotalAfter, 'phase B must start where phase A ended')
})

test('every cascade record is in phase B, none in phase A', () => {
  const inA = plan.phases[0].manifest.filter((m) => m.unlocksCascade)
  const inB = plan.phases[1].manifest.filter((m) => m.unlocksCascade)
  assert.equal(inA.length, 0)
  assert.equal(inB.length, 4)
  assert.deepEqual(inB.map((m) => m.recordId).sort(), [...proof.jointlyRequiredRemainderRecords].sort())
})

test('capacity never counts prepared releases as live', () => {
  assert.equal(capacity.accounting.preparedCountedAsLive, false)
  assert.match(capacity.prepared.status, /NOT LIVE/)
  assert.equal(capacity.live.baselineIsStale, true)
})

test('the observed deployment matches the corrected expectation, not the stale one', () => {
  const after = capacity.live.liveAfterSourcePageDeployment
  assert.equal(after.observed, 792)
  assert.equal(after.sourceRoutesAdded, 8)
  assert.equal(after.duplicateUrls, 0)
  assert.equal(after.matchesCorrectedExpectation, true)
  assert.notEqual(after.expectedFromStaleBaseline, after.observed)
  assert.equal(capacity.live.routesLandedBetweenBaselineAndThisSprint.total, 20)
})
