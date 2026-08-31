import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { mayRenderSubstantialMaterial } from '../lib/substantial-render-guard.ts'
import { SUBSTANTIAL_BATCH_2_PAGES } from '../lib/substantial-page-publication-batch-2.ts'
import {
  SUBSTANTIAL_BATCH_3_PAGES,
  SUBSTANTIAL_BATCH_3_RELEASES,
  SUBSTANTIAL_BATCH_3_WITHHELD,
  SUBSTANTIAL_BATCH_3_WITHHELD_ACTIVE_RECORD_IDS,
} from '../lib/substantial-page-publication-batch-3.ts'
import { PUBLIC_SUBSTANTIAL_PAGES, getPublishedSubstantialPage } from '../lib/substantial-page-public.ts'

const releaseCandidateById = new Map([
  ...EPISTEMIC_RECORDS.map((record) => [record.id, record] as const),
  ...REPAIRED_REVISION_CANARY_RECORDS.map((record) => [record.id, record] as const),
])
const repairedIds = new Set(REPAIRED_REVISION_CANARY_RECORDS.map((record) => record.id))

test('Batch 3 selects only exact-revision active canonical releases', () => {
  assert.equal(SUBSTANTIAL_BATCH_3_PAGES.length, 7)
  assert.equal(SUBSTANTIAL_BATCH_3_RELEASES.length, 7)
  for (const release of SUBSTANTIAL_BATCH_3_RELEASES) {
    const record = releaseCandidateById.get(release.recordId)
    assert.ok(record)
    assert.equal(epistemicReviewTargetHash(record), release.targetSha256)
    assert.equal(epistemicRecordPath(record), release.canonicalPath)
    assert.equal(release.assuranceTier, 'internally-reviewed-canonical')
    const page = SUBSTANTIAL_BATCH_3_PAGES.find((entry) => entry.contract.recordId === release.recordId)
    assert.ok(page)
    assert.equal(page.contract.recordRevisionSha256, release.targetSha256)
    assert.equal(page.path, release.canonicalPath)
    assert.equal(page.quality.eligible, true)
  }
})

test('Batch 3 replaces stale Batch 2 contracts without rewriting them', () => {
  const repairedPages = SUBSTANTIAL_BATCH_3_PAGES.filter((page) => repairedIds.has(page.contract.recordId))
  assert.equal(repairedPages.length, 2)
  for (const page of repairedPages) {
    const prior = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === page.contract.recordId)
    assert.ok(prior)
    assert.notEqual(prior.contract.recordRevisionSha256, page.contract.recordRevisionSha256)
    assert.equal(page.replacesPublicationVersion, 'maha-substantial-publication/1.1')
    assert.ok(
      ['maha-substantial-publication/1.2', 'maha-substantial-publication/1.4'].includes(
        getPublishedSubstantialPage(page.contract.recordId)?.publicationVersion ?? '',
      ),
      'Batch 3 remains in append-only history even when a later exact-release depth upgrade replaces its public projection',
    )
  }
  assert.equal(PUBLIC_SUBSTANTIAL_PAGES.length, 103, 'all release-matched records must be added exactly once across later batches')
  assert.equal(new Set(PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.contract.recordId)).size, 103)
})

test('five previously withheld active releases become release-matched public references', () => {
  const newlyClear = SUBSTANTIAL_BATCH_3_PAGES.filter((page) => !repairedIds.has(page.contract.recordId))
  assert.equal(newlyClear.length, 5)
  for (const page of newlyClear) {
    const prior = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === page.contract.recordId)
    assert.equal(prior, undefined)
    assert.equal(page.replacesPublicationVersion, null)
    assert.equal(page.path, page.releaseEvidence.canonicalPath)
    assert.equal(page.quality.eligible, true)
  }
})

test('every novel active candidate remains withheld on explicit evidence blockers', () => {
  assert.equal(SUBSTANTIAL_BATCH_3_WITHHELD_ACTIVE_RECORD_IDS.length, 11)
  assert.equal(SUBSTANTIAL_BATCH_3_WITHHELD.length, 11)
  for (const entry of SUBSTANTIAL_BATCH_3_WITHHELD) {
    assert.ok(entry.blockers.length > 0, `${entry.recordId} has no blocker`)
    assert.ok(
      entry.blockers.some((blocker) => blocker.includes('source-') || blocker.includes('alignment')),
      `${entry.recordId} has no source-alignment blocker`,
    )
    assert.equal(getPublishedSubstantialPage(entry.recordId), undefined)
  }
})

test('release state alone can never make a blocked record explanatory', () => {
  const blocked = SUBSTANTIAL_BATCH_3_WITHHELD[0]!
  assert.equal(getPublishedSubstantialPage(blocked.recordId), undefined)
  assert.equal(
    mayRenderSubstantialMaterial({
      eligible: false,
      contractRecordRevision: blocked.currentRevisionSha256,
      liveRecordRevision: blocked.currentRevisionSha256,
    }),
    false,
  )
})

test('every Batch 3 paragraph remains claim- and source-bound', () => {
  for (const page of SUBSTANTIAL_BATCH_3_PAGES) {
    const record = releaseCandidateById.get(page.contract.recordId)!
    const claims = new Map(record.claims.map((claim) => [claim.id, new Set(claim.sourceIds)]))
    for (const section of page.contract.explanations) {
      assert.ok(section.claimIds.length > 0)
      assert.ok(section.sourceIds.length > 0)
      for (const claimId of section.claimIds) {
        const sourceIds = claims.get(claimId)
        assert.ok(sourceIds)
        assert.ok(section.sourceIds.some((sourceId) => sourceIds.has(sourceId)))
      }
    }
    assert.equal(page.quality.evidenceCoverage.unsupportedExplanationParagraphs, 0)
    assert.equal(page.quality.evidenceCoverage.claimsExplained, page.quality.evidenceCoverage.claimsTotal)
  }
})

test('Batch 3 generation is byte-identical and leaves Batches 1 and 2 untouched', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = [
    'content/substantial-pages/publication-batch-1.json',
    'content/substantial-pages/publication-batch-2.json',
    'content/substantial-pages/publication-batch-3.json',
    'docs/substantial-pages/publication-batch-3.md',
  ]
  const before = new Map(paths.map((path) => [path, readFileSync(join(root, path), 'utf8')]))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-substantial-publication-batch-3.ts')], { cwd: root })
  for (const path of paths) assert.equal(readFileSync(join(root, path), 'utf8'), before.get(path), `${path} drifted`)
})

test('Batch 3 artifacts remain internal inputs rather than separate public routes', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /publication-batch-3|SUBSTANTIAL_BATCH_3_WITHHELD|releaseEvidence/)
  }
  for (const page of SUBSTANTIAL_BATCH_3_PAGES) {
    assert.equal(getPublishedSubstantialPage(page.contract.recordId)?.path, page.releaseEvidence.canonicalPath)
  }
})
