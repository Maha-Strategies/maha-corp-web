import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { SUBSTANTIAL_BATCH_5_PAGES } from '../lib/substantial-page-publication-batch-5.ts'
import { PUBLIC_SUBSTANTIAL_PAGES, getPublishedSubstantialPage } from '../lib/substantial-page-public.ts'
import {
  FROZEN_ACTIVE_RELEASES,
  SUBSTANTIAL_BATCH_5_SELECTED_RECORD_IDS,
  SUBSTANTIAL_PUBLICATION_QUEUE,
  publicationGateBlockers,
  type PublicationGateFacts,
} from '../lib/substantial-publication-queue.ts'

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const requiredScopes = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity']

test('the deterministic queue selects only three-gate exact-release records', () => {
  assert.equal(SUBSTANTIAL_PUBLICATION_QUEUE.length, 46)
  assert.equal(SUBSTANTIAL_BATCH_5_SELECTED_RECORD_IDS.length, 34)
  assert.equal(SUBSTANTIAL_PUBLICATION_QUEUE.filter((entry) => !entry.eligibleForBatch5).length, 12)
  for (const entry of SUBSTANTIAL_PUBLICATION_QUEUE) {
    const expected = entry.inspectedAndAlignmentClear
      && entry.exactRevisionReviewed
      && entry.activeCanonicalRelease
      && entry.releaseRevisionMatchesRecord
      && entry.releasePathMatchesRecord
    assert.equal(entry.eligibleForBatch5, expected, entry.recordId)
    assert.match(entry.queueDigest, /^sha256:[a-f0-9]{64}$/)
  }
})

test('each publication gate fails closed independently', () => {
  const passing: PublicationGateFacts = {
    recordFound: true,
    inspectedAndAlignmentClear: true,
    exactRevisionReviewed: true,
    activeCanonicalRelease: true,
    releaseRevisionMatchesRecord: true,
    releasePathMatchesRecord: true,
  }
  assert.deepEqual(publicationGateBlockers(passing), [])
  const cases: readonly [keyof PublicationGateFacts, string][] = [
    ['recordFound', 'record-missing'],
    ['inspectedAndAlignmentClear', 'source-not-inspected-or-alignment-blocked'],
    ['exactRevisionReviewed', 'exact-revision-review-incomplete'],
    ['activeCanonicalRelease', 'active-canonical-release-missing'],
    ['releaseRevisionMatchesRecord', 'active-release-revision-stale'],
    ['releasePathMatchesRecord', 'active-release-path-mismatch'],
  ]
  for (const [key, blocker] of cases) {
    assert.ok(publicationGateBlockers({ ...passing, [key]: false }).includes(blocker), key)
  }
})

test('every Batch 5 page binds an active release, exact revision, path, and complete review scopes', () => {
  const releaseByRecord = new Map(FROZEN_ACTIVE_RELEASES.map((release) => [release.recordId, release]))
  assert.equal(SUBSTANTIAL_BATCH_5_PAGES.length, 34)
  for (const page of SUBSTANTIAL_BATCH_5_PAGES) {
    const release = releaseByRecord.get(page.contract.recordId)
    assert.ok(release)
    assert.equal(page.releaseEvidence.releaseId, release.releaseId)
    assert.equal(page.contract.recordRevisionSha256, release.targetSha256)
    assert.equal(page.path, release.canonicalPath)
    for (const scope of requiredScopes) assert.ok(release.approvalScopes.includes(scope), `${page.contract.recordId}:${scope}`)
    assert.equal(page.quality.eligible, true)
  }
})

test('source identity sections remain claim-bound, source-bound, located, and rights-bounded', () => {
  for (const page of SUBSTANTIAL_BATCH_5_PAGES) {
    const record = records.get(page.contract.recordId)
    assert.ok(record)
    const claimById = new Map(record.claims.map((claim) => [claim.id, new Set(claim.sourceIds)]))
    const sourceById = new Map(record.sources.map((source) => [source.id, source]))
    const identitySections = page.contract.explanations.filter((section) => section.heading.startsWith('Source identity, locator, and reuse boundary'))
    assert.equal(identitySections.length, record.sources.filter((source) => record.claims.some((claim) => claim.sourceIds.includes(source.id))).length)
    for (const section of identitySections) {
      assert.ok(section.claimIds.length > 0)
      assert.ok(section.sourceIds.length > 0)
      for (const sourceId of section.sourceIds) {
        const source = sourceById.get(sourceId)
        assert.ok(source)
        assert.ok(source.exactLocator.trim().length > 0)
        assert.ok(source.rights?.basis)
        assert.ok(section.claimIds.some((claimId) => claimById.get(claimId)?.has(sourceId)))
      }
    }
    assert.equal(page.quality.evidenceCoverage.unsupportedExplanationParagraphs, 0)
  }
})

test('depth increases on every page without inventing comparisons or calculations', () => {
  let totalDelta = 0
  for (const page of SUBSTANTIAL_BATCH_5_PAGES) {
    assert.ok(page.depthUpgrade.characterDelta >= 606)
    assert.ok(page.depthUpgrade.sectionDelta > 0)
    assert.equal(page.contract.comparison.status, 'not-applicable')
    assert.equal(page.contract.calculation.status, 'not-applicable')
    assert.deepEqual(page.contract.comparison.axes, [])
    assert.deepEqual(page.contract.calculation.inputs, [])
    totalDelta += page.depthUpgrade.characterDelta
  }
  assert.equal(totalDelta, 46_609)
})

test('Batch 5 replaces 34 existing projections and creates no duplicate or 404-prone draft route', () => {
  assert.equal(PUBLIC_SUBSTANTIAL_PAGES.length, 55)
  assert.equal(new Set(PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.path)).size, 55)
  assert.equal(PUBLIC_SUBSTANTIAL_PAGES.filter((page) => String(page.publicationVersion) === 'maha-substantial-publication/1.4').length, 34)
  for (const page of SUBSTANTIAL_BATCH_5_PAGES) {
    assert.equal(getPublishedSubstantialPage(page.contract.recordId)?.publicationVersion, 'maha-substantial-publication/1.4')
    assert.ok(FROZEN_ACTIVE_RELEASES.some((release) => release.recordId === page.contract.recordId && release.canonicalPath === page.path))
  }
  for (const blocked of SUBSTANTIAL_PUBLICATION_QUEUE.filter((entry) => !entry.eligibleForBatch5)) {
    assert.notEqual(getPublishedSubstantialPage(blocked.recordId)?.publicationVersion, 'maha-substantial-publication/1.4')
  }
})

test('sitemap and llms projection remain downstream of the active release set and exact revision guard', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx', import.meta.url), 'utf8')
  assert.match(sitemap, /canonicalReleases/)
  assert.match(sitemap, /getPublishedSubstantialPage\(release\.recordId\)\?\.quality\.eligible/)
  assert.match(llms, /canonicalEpistemicRecords\.flatMap/)
  assert.match(route, /contractRecordRevision: page\.contract\.recordRevisionSha256/)
  assert.match(route, /liveRecordRevision: epistemicReviewTargetHash\(record\)/)
  for (const source of [sitemap, llms, route]) assert.doesNotMatch(source, /publication-batch-5-queue|SUBSTANTIAL_PUBLICATION_QUEUE/)
})

test('Batch 5 artifacts regenerate byte-identically', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = [
    'content/substantial-pages/publication-batch-5-queue.json',
    'content/substantial-pages/publication-batch-5.json',
    'docs/substantial-pages/publication-batch-5.md',
  ]
  const before = new Map(paths.map((path) => [path, readFileSync(join(root, path), 'utf8')]))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-substantial-publication-batch-5.ts')], { cwd: root })
  for (const path of paths) assert.equal(readFileSync(join(root, path), 'utf8'), before.get(path), `${path} drifted`)
})
