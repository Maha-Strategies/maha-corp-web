import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import batchSixArtifact from '../content/substantial-pages/publication-batch-6.json' with { type: 'json' }
import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import {
  SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_PAGES,
  SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_READINESS,
  SUBSTANTIAL_BATCH_6_RECORD_IDS,
} from '../lib/substantial-page-publication-batch-6.ts'
import { PUBLIC_SUBSTANTIAL_PAGES, getPublishedSubstantialPage } from '../lib/substantial-page-public.ts'

const requiredScopes = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity']
const records = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))

test('Batch 6 reconciles 114 active releases into 103 eligible substantial pages', () => {
  assert.equal(SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS.length, 114)
  assert.equal(SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS.length, 55)
  assert.equal(SUBSTANTIAL_BATCH_6_PAGES.length, 48)
  assert.equal(SUBSTANTIAL_BATCH_6_RECORD_IDS.length, 48)
  assert.equal(SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS.length, 103)
  assert.equal(SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS.length, 11)
  assert.equal(
    SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS.length + SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS.length,
    SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS.length,
  )
  assert.equal(batchSixArtifact.totals.projectedLiveSubstantialPages, 103)
  assert.equal(batchSixArtifact.totals.unsupportedExplanationParagraphs, 0)
})

test('every Batch 6 page binds inspected evidence, four exact review scopes, and its active release', () => {
  for (const page of SUBSTANTIAL_BATCH_6_PAGES) {
    const record = records.get(page.contract.recordId)
    assert.ok(record, page.contract.recordId)
    assert.equal(page.contract.recordRevisionSha256, epistemicReviewTargetHash(record))
    assert.equal(page.path, epistemicRecordPath(record))
    assert.equal(page.releaseEvidence.targetSha256, page.contract.recordRevisionSha256)
    assert.equal(page.reviewEvidence.targetSha256, page.contract.recordRevisionSha256)
    assert.equal(page.releaseEvidence.canonicalPath, page.path)
    assert.equal(page.releaseEvidence.assuranceTier, 'internally-reviewed-canonical')
    assert.deepEqual(page.releaseEvidence.approvalScopes, requiredScopes)
    assert.deepEqual(page.releaseEvidence.approvals.map((approval) => approval.scope), requiredScopes)
    assert.ok(page.releaseEvidence.approvals.every((approval) => approval.reviewerKind === 'internal-editorial'))
    assert.equal(page.reviewEvidence.alignment.metadataVerified, true)
    assert.equal(page.reviewEvidence.alignment.sourceContentInspected, true)
    assert.equal(page.reviewEvidence.alignment.subjectSupported, true)
    assert.ok(page.reviewEvidence.alignment.exactInspectedLocator.trim().length > 0)
    assert.equal(page.quality.eligible, true)
    assert.equal(page.quality.evidenceCoverage.unsupportedExplanationParagraphs, 0)
  }
})

test('source identity additions remain claim-bound, source-bound, located, and rights-bounded', () => {
  for (const page of SUBSTANTIAL_BATCH_6_PAGES) {
    const record = records.get(page.contract.recordId)!
    const claims = new Map(record.claims.map((claim) => [claim.id, new Set(claim.sourceIds)]))
    const sources = new Map(record.sources.map((source) => [source.id, source]))
    const sections = page.contract.explanations.filter((section) =>
      section.heading.startsWith('Source identity, locator, and reuse boundary'),
    )
    assert.ok(sections.length > 0, record.id)
    for (const section of sections) {
      assert.ok(section.claimIds.length > 0)
      assert.ok(section.sourceIds.length > 0)
      for (const sourceId of section.sourceIds) {
        const source = sources.get(sourceId)
        assert.ok(source)
        assert.ok(source.exactLocator.trim().length > 0)
        assert.ok(source.rights?.basis)
        assert.ok(section.claimIds.some((claimId) => claims.get(claimId)?.has(sourceId)))
      }
    }
  }
})

test('metadata-only, stale, unreleased, and alignment-blocked records cannot enter Batch 6', () => {
  const selected = new Set(SUBSTANTIAL_BATCH_6_RECORD_IDS)
  for (const readiness of SUBSTANTIAL_BATCH_6_READINESS) {
    assert.equal(selected.has(readiness.recordId), readiness.readyForNewPackage, readiness.recordId)
    if (readiness.blockers.length > 0) assert.equal(readiness.readyForNewPackage, false)
  }
  for (const recordId of SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS) {
    assert.ok(!selected.has(recordId))
    assert.notEqual(getPublishedSubstantialPage(recordId)?.publicationVersion, 'maha-substantial-publication/1.5')
  }
})

test('Batch 6 adds 48 unique release-matched pages to the 103-page public projection', () => {
  assert.equal(PUBLIC_SUBSTANTIAL_PAGES.length, 103)
  assert.equal(new Set(PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.contract.recordId)).size, 103)
  assert.equal(new Set(PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.path)).size, 103)
  assert.equal(
    PUBLIC_SUBSTANTIAL_PAGES.filter((page) => String(page.publicationVersion) === 'maha-substantial-publication/1.5').length,
    48,
  )
  for (const page of SUBSTANTIAL_BATCH_6_PAGES) {
    assert.equal(getPublishedSubstantialPage(page.contract.recordId)?.publicationDigest, page.publicationDigest)
  }
})

test('Batch 6 increases information value without inventing comparisons or calculations', () => {
  for (const page of SUBSTANTIAL_BATCH_6_PAGES) {
    assert.ok(page.depth.characterDelta > 0)
    assert.ok(page.depth.after.informationCharacters > page.depth.before.informationCharacters)
    if (page.contract.comparison.status === 'not-applicable') assert.deepEqual(page.contract.comparison.axes, [])
    if (page.contract.calculation.status === 'not-applicable') assert.deepEqual(page.contract.calculation.inputs, [])
  }
  assert.equal(batchSixArtifact.totals.comparisonsIncluded, 0)
  assert.equal(batchSixArtifact.totals.calculationsIncluded, 0)
})

test('Batch 6 projection stays downstream of canonical routes and never exposes operational material', () => {
  const sources = [
    readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/substantial-page-public.ts', import.meta.url), 'utf8'),
  ].join('\n')
  assert.match(sources, /canonicalReleases|getPublishedSubstantialPage|publication-batch-6/)
  for (const marker of [
    'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
    'EPISTEMIC_OPERATIONS_TOKEN',
    'frontier-source-alignment',
    'source-recovery',
    'release-scale-review',
    'reviewerIdentity',
  ]) assert.doesNotMatch(sources, new RegExp(marker))
})

test('Batch 6 generated publication artifacts regenerate byte-identically', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = [
    'content/substantial-pages/publication-batch-6.json',
    'docs/substantial-pages/publication-batch-6.md',
  ]
  const before = new Map(paths.map((path) => [path, readFileSync(join(root, path), 'utf8')]))
  execFileSync(process.execPath, [
    '--experimental-strip-types',
    join(root, 'scripts/generate-substantial-publication-batch-6.ts'),
  ], { cwd: root })
  for (const path of paths) assert.equal(readFileSync(join(root, path), 'utf8'), before.get(path), `${path} drifted`)
})
