import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { releaseReadiness } from '../lib/epistemic-release.ts'
import { SUBSTANTIAL_BATCH_2_PAGES } from '../lib/substantial-page-publication-batch-2.ts'
import { SUBSTANTIAL_PUBLICATION_PAGES } from '../lib/substantial-page-publication.ts'
import {
  RELEASE_RECONCILIATION_STATES,
  SUBSTANTIAL_COHORT_STATES,
  cohortCounts,
  deploymentReadiness,
  mayRenderSubstantialMaterial,
  reconcileBatch2Releases,
  reconciliationDigest,
  releasePreflightBlockers,
  validateCohortReleaseStrategy,
} from '../lib/substantial-release-reconciliation.ts'

const recordsById = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const batch2 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-2.json', 'utf8'))
const reconciliation = JSON.parse(readFileSync('content/substantial-pages/release-reconciliation-batch-2.json', 'utf8'))

function releaseObservation(recordId: string, overrides: Record<string, unknown> = {}) {
  const page = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === recordId)!
  return {
    recordId,
    releaseId: 'epirelease_00000000000000000000000000000001',
    status: 'active' as const,
    targetSha256: page.contract.recordRevisionSha256,
    canonicalPath: page.path,
    approvals: 4,
    gatePublicEligible: true,
    ...overrides,
  }
}

function routeObservation(recordId: string, overrides: Record<string, unknown> = {}) {
  return { recordId, httpStatus: 200, inSitemap: true, inLlmsSubstantialSection: true, substantiallyRendered: true, ...overrides }
}

test('the five cohort states are counted separately, never collapsed', () => {
  assert.deepEqual([...SUBSTANTIAL_COHORT_STATES], ['compiled', 'eligible', 'canonically-released', 'publicly-reachable', 'substantially-rendered'])
  const target = SUBSTANTIAL_BATCH_2_PAGES[0].contract.recordId
  // Compiled and eligible for all thirty; released for one; reachable for one; rendered for none.
  const entries = reconcileBatch2Releases([releaseObservation(target)], [routeObservation(target, { substantiallyRendered: false })])
  const counts = cohortCounts(entries)
  assert.equal(counts.compiled, 30)
  assert.equal(counts.eligible, 30)
  assert.equal(counts['canonically-released'], 1)
  assert.equal(counts['publicly-reachable'], 1)
  assert.equal(counts['substantially-rendered'], 0)
  // The whole point: these are four different numbers over the same cohort.
  assert.notEqual(counts.eligible, counts['canonically-released'])
})

test('a page count cannot treat an unreleased canonical record as released', () => {
  const entries = reconcileBatch2Releases([], [])
  assert.equal(cohortCounts(entries).eligible, 30)
  assert.equal(cohortCounts(entries)['canonically-released'], 0, 'no release observations means nothing may be counted as released')
  assert.equal(cohortCounts(entries)['publicly-reachable'], 0)
})

test('every batch two record is compiled and eligible yet almost none is releasable', () => {
  const entries = reconcileBatch2Releases()
  assert.equal(entries.length, 30)
  assert.ok(SUBSTANTIAL_BATCH_2_PAGES.every((page) => page.quality.eligible), 'all thirty pass the substantial gate')
  assert.ok(entries.filter((entry) => entry.releaseEligible).length < 30, 'eligibility must not imply release readiness')
})

test('release readiness is not inferred from an eligible substantial page', () => {
  for (const entry of reconcileBatch2Releases()) {
    if (entry.releaseEligible) continue
    const record = recordsById.get(entry.recordId)!
    const readiness = releaseReadiness(
      { recordId: record.id, targetSha256: epistemicReviewTargetHash(record), candidateSnapshot: record },
      [],
      new Date('2026-08-26T00:00:00Z'),
    )
    assert.equal(readiness.ready, false, `${entry.recordId} must not be release-ready without scoped decisions`)
  }
})

test('release decisions must be scoped to the exact record revision', () => {
  const page = SUBSTANTIAL_BATCH_2_PAGES[0]
  const record = recordsById.get(page.contract.recordId)!
  assert.throws(
    () => releaseReadiness({ recordId: record.id, targetSha256: 'sha256:' + 'f'.repeat(64), candidateSnapshot: record }, []),
    /does not match its record or digest/,
    'a decision aimed at a different revision cannot be reused',
  )
})

test('a forged active release cannot satisfy the preflight', () => {
  const target = SUBSTANTIAL_BATCH_2_PAGES.find((page) => !page.quality.reasons.length)!.contract.recordId
  const forged = releaseObservation(target, { approvals: 0, gatePublicEligible: false, targetSha256: 'sha256:' + '0'.repeat(64) })
  const entries = reconcileBatch2Releases([forged], [routeObservation(target)])
  const entry = entries.find((candidate) => candidate.recordId === target)!
  // Claiming an active release with the wrong target digest is drift, not readiness.
  assert.equal(entry.state, 'released-but-revision-drifted')
  // And the underlying blockers are recomputed, never taken from the observation.
  const record = recordsById.get(target)!
  assert.ok(releasePreflightBlockers(record, entry.auditedRecordRevision).length > 0)
})

test('a released but revision-drifted record cannot render stale substantial prose', () => {
  assert.equal(mayRenderSubstantialMaterial({ eligible: true, contractRecordRevision: 'sha256:a', liveRecordRevision: 'sha256:b' }), false)
  assert.equal(mayRenderSubstantialMaterial({ eligible: true, contractRecordRevision: 'sha256:a', liveRecordRevision: 'sha256:a' }), true)
  assert.equal(mayRenderSubstantialMaterial({ eligible: false, contractRecordRevision: 'sha256:a', liveRecordRevision: 'sha256:a' }), false)
  assert.equal(mayRenderSubstantialMaterial({ eligible: true, contractRecordRevision: '', liveRecordRevision: '' }), false, 'empty digests must never compare equal')
})

test('a deployment readiness report fails when a selected URL would return 404', () => {
  const [first, second] = SUBSTANTIAL_BATCH_2_PAGES
  const routes = [routeObservation(first.contract.recordId), routeObservation(second.contract.recordId, { httpStatus: 404, substantiallyRendered: false })]
  const readiness = deploymentReadiness(reconcileBatch2Releases([], routes))
  assert.equal(readiness.ready, false)
  assert.ok(readiness.unreachable.includes(second.contract.recordId))
})

test('sitemap and llms.txt membership is never accepted as reachability', () => {
  const target = SUBSTANTIAL_BATCH_2_PAGES[0].contract.recordId
  // Present in both surfaces, but the route 404s: readiness must still fail.
  const routes = [routeObservation(target, { httpStatus: 404, inSitemap: true, inLlmsSubstantialSection: true, substantiallyRendered: false })]
  const readiness = deploymentReadiness(reconcileBatch2Releases([], routes))
  assert.equal(readiness.ready, false)
  assert.ok(readiness.unreachable.includes(target))
})

test('a future cohort must declare an explicit release strategy for every record', () => {
  const selected = SUBSTANTIAL_BATCH_2_PAGES.slice(0, 3).map((page) => page.contract.recordId)
  assert.equal(validateCohortReleaseStrategy(selected, []).valid, false, 'no strategy at all must fail')
  const partial = validateCohortReleaseStrategy(selected, [{ recordId: selected[0], strategy: 'already-released' }])
  assert.equal(partial.valid, false)
  assert.deepEqual([...partial.missing], selected.slice(1))
  const unnamedCohort = validateCohortReleaseStrategy([selected[0]], [{ recordId: selected[0], strategy: 'authorised-release-cohort' }])
  assert.equal(unnamedCohort.valid, false, 'an authorised cohort must name the cohort')
  const complete = validateCohortReleaseStrategy(selected, selected.map((recordId) => ({ recordId, strategy: 'already-released' as const })))
  assert.equal(complete.valid, true)
})

test('batch one stays twenty of twenty and byte-identical', () => {
  const batch1 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-1.json', 'utf8'))
  assert.equal(batch1.pages.length, 20)
  assert.equal(batch1.pages.filter((page: { quality: { eligible: boolean } }) => page.quality.eligible).length, 20)
  assert.equal(SUBSTANTIAL_PUBLICATION_PAGES.length, 20)
  for (const page of batch1.pages) {
    const published = SUBSTANTIAL_PUBLICATION_PAGES.find((candidate) => candidate.contract.recordId === page.contract.recordId)!
    assert.equal(published.contractDigest, page.contractDigest, 'batch one contract digests are frozen')
    assert.equal(published.publicationDigest, page.publicationDigest, 'batch one publication digests are frozen')
  }
})

test('reconciliation never rewrites the historical batch two deployment baseline', () => {
  const baseline = JSON.parse(readFileSync('docs/substantial-pages/publication-batch-2-search-baseline.json', 'utf8'))
  // The original deployment result is a historical fact and stays as recorded.
  assert.equal(baseline.totals.live, 3)
  assert.equal(baseline.totals.revisionGuardWithheld, 2)
  assert.equal(baseline.totals.awaitingCanonicalRelease, 25)
  assert.equal(baseline.mergeSha, 'bce74b62bc0d6b56d6664d8f37447d023524129c')
  assert.equal(baseline.records.filter((record: { initialHttpStatus: number }) => record.initialHttpStatus === 200).length, 5)
})

test('the deterministic artifact carries no operational observation', () => {
  assert.equal(reconciliation.records.length, 30)
  for (const record of reconciliation.records) {
    assert.ok(!('productionRouteStatus' in record), 'route status is an observation and must not be frozen')
    assert.ok(!('activeReleaseId' in record), 'release ids are observations and must not be frozen')
    assert.ok(!('inSitemap' in record))
  }
  assert.equal(reconciliation.digest, reconciliationDigest(reconcileBatch2Releases()))
})

test('every reconciliation state is a declared member of the vocabulary', () => {
  for (const entry of reconcileBatch2Releases()) assert.ok(RELEASE_RECONCILIATION_STATES.includes(entry.state), `${entry.state} is undeclared`)
  assert.equal(new Set(RELEASE_RECONCILIATION_STATES).size, RELEASE_RECONCILIATION_STATES.length)
})

test('the batch two cohort is exactly the thirty compiled records', () => {
  const entries = reconcileBatch2Releases()
  assert.equal(new Set(entries.map((entry) => entry.recordId)).size, 30)
  assert.deepEqual(entries.map((entry) => entry.recordId).sort(), batch2.pages.map((page: { contract: { recordId: string } }) => page.contract.recordId).sort())
})

test('the render guard stays a dependency-free leaf module', () => {
  const source = readFileSync('lib/substantial-render-guard.ts', 'utf8')
  assert.equal(/^\s*import\s/m.test(source), false, 'the guard must import nothing')
  // The record page asks the guard, and must not reach the audit or preflight modules to do it.
  const page = readFileSync('app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx', 'utf8')
  assert.ok(page.includes("from '@/lib/substantial-render-guard'"))
  for (const forbidden of ['substantial-release-reconciliation', 'frontier-source-alignment', 'pilot-source-alignment', 'substantial-page-publication-batch-2']) {
    assert.equal(page.includes(forbidden), false, `the record page must not import ${forbidden}: it drags the audit corpus into the page bundle`)
  }
})
