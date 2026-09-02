import assert from 'node:assert/strict'
import test from 'node:test'

import { INFORMATION_DIMENSIONS, evaluateSourcePage } from '../lib/source-evidence-reference.ts'
import graph from '../content/source-cluster/deficit-graph.json' with { type: 'json' }
import cohort from '../content/source-cluster/batch-1-cohort.json' with { type: 'json' }
import inspections from '../content/source-cluster/batch-1-inspections.json' with { type: 'json' }
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }
import capacity from '../content/source-cluster/capacity-reconciliation.json' with { type: 'json' }
import canary from '../content/source-cluster/cluster-release-canary.json' with { type: 'json' }

test('the deficit graph covers every unique source', () => {
  assert.equal(graph.uniqueSources, 48)
  assert.equal(graph.eligibleNow + graph.blocked, graph.uniqueSources)
})

test('the cohort was frozen before research and excludes the largest cluster', () => {
  assert.equal(cohort.frozenBeforeResearch, true)
  assert.equal(cohort.clusters.length, 5)
  assert.equal(cohort.largestClusterExcluded.unreleasedRecords, 20)
  const selected = cohort.clusters.map((cluster) => cluster.minimumGovernedActions)
  assert.ok(selected.every((actions) => actions < cohort.largestClusterExcluded.minimumGovernedActions),
    'every selected cluster must be nearer than the one excluded for size')
})

test('no record was narrowed to make a cluster close', () => {
  assert.equal(inspections.summary.narrowedToFitCluster, 0)
  for (const entry of inspections.inspections) {
    if (entry.verdict !== 'supported') assert.equal(entry.clusterDisposition, 'removed')
  }
})

test('every inspection records a real retrieval outcome', () => {
  for (const entry of inspections.inspections) {
    assert.equal(entry.retrieval.outcome, 'success', `${entry.recordId} must record how the source was actually read`)
    assert.ok(entry.evidence.length > 80, 'evidence must describe what the content said')
  }
})

test('a publisher block is resolved through an open-access copy, with identity reconfirmed', () => {
  const blocked = inspections.inspections.find((entry) => 'publisherOutcome' in entry.retrieval)
  assert.ok(blocked && 'identityConfirmed' in blocked, 'the Wiley 403 must be recorded, not silently dropped')
  assert.match(String((blocked.retrieval as { resolvedVia?: string }).resolvedVia), /PMC/)
  assert.match(String(blocked.identityConfirmed), /10\.1111\/acel\.12344/)
})

test('the frozen package reverifies all thirteen attributes for every record', () => {
  assert.equal(pkg.attributeContract.count, 13)
  assert.equal(pkg.cohort.proposed, 33)
  for (const record of [...pkg.canary.records, ...pkg.remainder.records]) {
    assert.equal(record.attributesChecked, 13)
    assert.equal(record.attributesPassed, 13)
    assert.deepEqual(record.failedAttributes, [])
  }
})

test('the package is frozen, not executed, and never claims human review', () => {
  assert.equal(pkg.released, false)
  assert.equal(pkg.executed, false)
  const tier: Record<string, unknown> = pkg.reviewTier
  for (const claim of ['independent', 'expertEndorsement', 'externallyReviewed', 'humanReviewed']) {
    assert.equal(tier[claim], false, `the tier must not assert ${claim}`)
  }
  assert.equal(pkg.reviewTier.releaseAuthority, 'separate')
})

test('operation ids are replay-safe and unique per record revision', () => {
  const all = [...pkg.canary.records, ...pkg.remainder.records]
  assert.equal(new Set(all.map((r) => r.operationId)).size, all.length)
  assert.equal(all.length, 33)
})

test('the canary spans five distinct domains', () => {
  assert.equal(pkg.canary.size, 5)
  assert.equal(new Set(pkg.canary.records.map((r) => r.domainSlug)).size, 5)
  assert.equal(pkg.remainder.size, 28)
})

test('the corrected source-page count comes from the gate, not from relaxing it', () => {
  const correction = pkg.expectedPublicEffect.correctsRecordedCascadeValue
  assert.equal(correction.recordedSourcePagesUnlocked, 0)
  assert.equal(correction.measuredSourcePagesUnlocked, 1)
  // The gate must still refuse a source holding any unreleased claim.
  const candidate = {
    sourceId: 'test', identityVerified: true, inspectionDepth: 'section-or-full-text' as const,
    exactLocators: ['p. 1'], rightsBasis: 'citation-with-paraphrase',
    claims: [
      { recordId: 'a', revisionSha256: 'sha256:a', activeRelease: true, locator: 'p1', statement: 's' },
      { recordId: 'b', revisionSha256: 'sha256:b', activeRelease: false, locator: 'p2', statement: 's' },
    ],
    satisfies: [...INFORMATION_DIMENSIONS], route: '/knowledge/sources/test',
    searchIntent: 'test intent', alignmentMismatch: false,
  }
  const verdict = evaluateSourcePage(candidate, new Set(), new Set(), new Set())
  assert.equal(verdict.eligible, false)
  assert.ok(verdict.refusals.includes('unreleased-claim-present'),
    'one unreleased claim must still refuse the whole page')
})

test('capacity keeps live and prepared surfaces apart', () => {
  assert.equal(capacity.currentlyReachable.sourceReferencePages, 0)
  assert.match(capacity.reachableAfterPreparedButUnexecutedOperations.status, /NOT LIVE/)
  for (const operation of capacity.reachableAfterPreparedButUnexecutedOperations.operations) {
    assert.equal(operation.executed, false)
    assert.equal(operation.authorization, 'not-granted')
  }
})

test('batch 1 is not double-counted against the package it overlaps', () => {
  assert.equal(capacity.batch1Reconciliation.marginalPagesBeyondExistingPlans, 0)
  assert.equal(capacity.doubleCountingAvoided.difference, 1)
  assert.equal(canary.separateCanaryAvailable, false)
  assert.equal(canary.coveringOperation.clusterRecordsCoveredInCanary, 0)
})
