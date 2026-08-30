import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { getLegacyEpistemicAdapter } from '../lib/epistemic-adapters.ts'
import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { parseEpistemicExpertReview } from '../lib/epistemic-review.ts'
import {
  PRIVATE_REVISION_RELEASE_CANARY,
  SOURCE_OVERRIDE_REVISED_RECORDS,
  sourceOverrideRevisionCanaryReviewInputs,
} from '../lib/source-override-revision-canary.ts'
import { evaluatePublicationQueueCandidate } from '../lib/substantial-publication-queue.ts'
import snapshot from '../content/epistemic/source-override-revision-ingestion-records.json' with { type: 'json' }
import { classifyExistingFrozenTargets } from '../scripts/run-source-override-preview-release-canary.ts'

function filesUnder(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

test('the dedicated adapter freezes exactly the five merged-main revisions', () => {
  const adapter = getLegacyEpistemicAdapter('source-override-revision-canary')
  assert.ok(adapter)
  const candidates = adapter.adapt()
  assert.equal(candidates.length, 5)
  assert.deepEqual(
    candidates.map((candidate) => candidate.reviewTargetSha256),
    SOURCE_OVERRIDE_REVISED_RECORDS.map(epistemicReviewTargetHash),
  )
  assert.equal(snapshot.records.length, 5)
  assert.deepEqual(snapshot.records.map((record) => record.id), SOURCE_OVERRIDE_REVISED_RECORDS.map((record) => record.id))
  for (const candidate of candidates) {
    assert.equal(candidate.record.publication.reviewState, 'draft')
    assert.equal(candidate.record.publication.requestedPublicPromotion, false)
    assert.equal(candidate.gateDecision.publicEligible, false)
  }
})

test('the dedicated ingestion batch carries only digest-bound inspected-source attestations', () => {
  const batch = buildEpistemicIngestionBatch({
    adapterId: 'source-override-revision-canary',
    idempotencyKey: 'source-override-revision-attestation-test',
  }, new Date('2026-08-30T00:00:00.000Z'))
  assert.equal(batch.records.length, 5)
  for (const record of batch.records) {
    assert.equal(record.alignmentDecision.contentInspectionState, 'internally-inspected-source-override')
    assert.equal(record.alignmentDecision.explanatoryEligible, true)
    assert.equal(record.alignmentDecision.canonicalEligible, true)
    assert.match(record.alignmentDecision.inspectionAttestationSha256 ?? '', /^sha256:[a-f0-9]{64}$/)
    assert.equal(record.gateDecision.reasons.some((reason) => reason.startsWith('source-content-inspection-missing:')), false)
    assert.equal(record.gateDecision.publicEligible, false)
  }
})

test('twenty scoped review inputs parse and bind the exact revisions', () => {
  const inputs = sourceOverrideRevisionCanaryReviewInputs()
  assert.equal(inputs.length, 20)
  const expectedDomains = [...new Set(SOURCE_OVERRIDE_REVISED_RECORDS.map((record) => record.domainSlug))].sort()
  for (const record of SOURCE_OVERRIDE_REVISED_RECORDS) {
    const scoped = inputs.filter((input) => input.recordId === record.id)
    assert.equal(scoped.length, 4)
    assert.equal(new Set(scoped.map((input) => input.scope)).size, 4)
    for (const input of scoped) {
      const parsed = parseEpistemicExpertReview(input)
      assert.equal(parsed.targetSha256, epistemicReviewTargetHash(record))
      assert.equal(parsed.reviewer.reviewerKind, 'internal-editorial')
      assert.ok(parsed.reviewer.reviewMethod)
      assert.match(parsed.reviewer.reviewMethod, /exact-revision/i)
      assert.equal(parsed.reviewer.reviewerId, 'expert_maha-internal-source-override-v2')
      assert.deepEqual(parsed.reviewer.domains, expectedDomains)
      assert.match(input.idempotencyKey, /^source-override-revision-v2:/)
    }
  }
})

test('one reviewer profile version cannot drift between canary domains', () => {
  const profiles = sourceOverrideRevisionCanaryReviewInputs().map((input) => input.reviewer)
  const first = profiles[0]
  assert.ok(first)
  for (const profile of profiles) assert.deepEqual(profile, first)
})

test('the remote canary resumes only from one complete exact frozen cohort', () => {
  const revisions = SOURCE_OVERRIDE_REVISED_RECORDS.map((record) => ({
    recordId: record.id,
    targetSha256: epistemicReviewTargetHash(record),
  }))
  const targets = revisions.map((revision) => ({
    recordId: revision.recordId,
    reviewTargetSha256: revision.targetSha256,
    gateDecision: { reasons: ['public-promotion-not-requested'] },
  }))
  assert.equal(classifyExistingFrozenTargets([], revisions), 'absent')
  assert.equal(classifyExistingFrozenTargets(targets, revisions), 'complete')
  assert.throws(
    () => classifyExistingFrozenTargets(targets.slice(1), revisions),
    /partial or duplicate exact-revision cohort/,
  )
  assert.throws(
    () => classifyExistingFrozenTargets([...targets, targets[0]!], revisions),
    /partial or duplicate exact-revision cohort/,
  )
  assert.equal(classifyExistingFrozenTargets(targets.map((target) => ({
    ...target,
    gateDecision: { reasons: ['source-content-inspection-missing:source'] },
  })), revisions), 'absent')
})

test('the three-gate queue admits each record only after an exact active release', () => {
  for (const record of SOURCE_OVERRIDE_REVISED_RECORDS) {
    const canary = PRIVATE_REVISION_RELEASE_CANARY.find((entry) => entry.recordId === record.id)
    assert.ok(canary)
    const before = evaluatePublicationQueueCandidate({
      record,
      release: undefined,
      inspectedAndAlignmentClear: true,
      exactRevisionReviewed: true,
      currentSubstantialPage: false,
    })
    assert.equal(before.eligible, false)
    assert.ok(before.blockerCodes.includes('active-canonical-release-missing'))

    const oldRelease = canary.priorReleaseId ? {
      recordId: record.id,
      releaseId: canary.priorReleaseId,
      targetSha256: canary.priorReleaseTargetSha256!,
      canonicalPath: epistemicRecordPath(record),
      approvalScopes: ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'],
    } : undefined
    if (oldRelease) {
      const stale = evaluatePublicationQueueCandidate({
        record,
        release: oldRelease,
        inspectedAndAlignmentClear: true,
        exactRevisionReviewed: true,
        currentSubstantialPage: false,
      })
      assert.equal(stale.eligible, false)
      assert.ok(stale.blockerCodes.includes('active-release-revision-stale'))
    }

    const exactRelease = {
      recordId: record.id,
      releaseId: `epirelease_${epistemicReviewTargetHash(record).slice(7, 39)}`,
      targetSha256: epistemicReviewTargetHash(record),
      canonicalPath: epistemicRecordPath(record),
      approvalScopes: ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'],
    }
    const after = evaluatePublicationQueueCandidate({
      record,
      release: exactRelease,
      inspectedAndAlignmentClear: true,
      exactRevisionReviewed: true,
      currentSubstantialPage: false,
    })
    assert.equal(after.eligible, true)
    assert.deepEqual(after.blockerCodes, [])

    const missingReview = evaluatePublicationQueueCandidate({
      record,
      release: exactRelease,
      inspectedAndAlignmentClear: true,
      exactRevisionReviewed: false,
      currentSubstantialPage: false,
    })
    assert.equal(missingReview.eligible, false)
    assert.ok(missingReview.blockerCodes.includes('exact-revision-review-incomplete'))
  }
})

test('the dedicated migration persists drafts only and cannot publish', () => {
  const migration = readFileSync('supabase/migrations/20260830173000_source_override_revision_preview_canary.sql', 'utf8')
  assert.match(migration, /record_source_override_revision_canary_targets/)
  assert.match(migration, /recordCount',''\) <> '5'/)
  assert.match(migration, /reviewState\}',''\) <> 'draft'/)
  assert.match(migration, /requestedPublicPromotion\}',''\) <> 'false'/)
  assert.doesNotMatch(migration, /record_epistemic_expert_review|record_epistemic_canonical_release/)
})

test('the additive adapter migration preserves prior adapters without widening release authority', () => {
  const migration = readFileSync(
    'supabase/migrations/20260830174500_source_override_revision_canary_adapter.sql',
    'utf8',
  )
  const preservedAdapters = [
    'semiconductor',
    'mathematics',
    'astronomy',
    'religion',
    'neuromorphic-biocomputing',
    'frontier-canary',
    'substantial-batch-2-internal-review',
    'repaired-revision-canary',
    'mcp-private-canary',
  ]
  assert.match(migration, /epistemic_ingestion_batches_adapter_id_check/)
  assert.match(migration, /epistemic_ingestion_records_adapter_id_check/)
  assert.equal((migration.match(/'source-override-revision-canary'/g) ?? []).length, 2)
  for (const adapter of preservedAdapters) {
    assert.equal((migration.match(new RegExp(`'${adapter}'`, 'g')) ?? []).length, 2)
  }
  assert.doesNotMatch(migration, /epistemic_(?:expert_)?reviews|epistemic_canonical_releases/)
  assert.doesNotMatch(migration, /grant\s|security\s+definer/i)
})

test('the remote workflow is exact-branch Preview-only and carries no Production path', () => {
  const workflow = readFileSync('.github/workflows/preview-source-override-release-canary.yml', 'utf8')
  const runner = readFileSync('scripts/run-source-override-preview-release-canary.ts', 'utf8')
  for (const source of [workflow, runner]) {
    assert.match(source, /codex\/corrected-revision-preview-release/)
    assert.match(source, /RELEASE_5_SOURCE_OVERRIDE_REVISIONS_IN_PREVIEW/)
    assert.match(source, /Production.*forbidden|Production hosts are forbidden/i)
    assert.doesNotMatch(source, /production-database/)
  }
  assert.match(workflow, /environment: Preview/)
  assert.match(workflow, /uhwuullakihgszxhiygz/)
  assert.match(workflow, /20260830173000_source_override_revision_preview_canary\.sql/)
  assert.match(workflow, /20260830174500_source_override_revision_canary_adapter\.sql/)
  assert.match(workflow, /\.release\.activeCount == 5/)
  assert.match(runner, /mkdirSync\(dirname\(evidencePath\)/)
  assert.match(runner, /active\?\.targetSha256 === entry\.targetSha256/)
  assert.match(runner, /sitemap\.text\.includes\(path\)/)
  assert.match(runner, /llms\.text\.includes\(path\)/)
  assert.match(workflow, /\.sitemapIncluded == true/)
  assert.match(workflow, /\.llmsIncluded == true/)
})

test('the Production plan is deterministic and deliberately non-executable', () => {
  const run = () => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-source-override-production-release-plan.ts'], {
    cwd: process.cwd(), encoding: 'utf8', env: process.env,
  })
  assert.equal(run().status, 0)
  const first = readFileSync('content/epistemic/source-override-production-release-plan.json', 'utf8')
  assert.equal(run().status, 0)
  const second = readFileSync('content/epistemic/source-override-production-release-plan.json', 'utf8')
  assert.equal(second, first)
  const plan = JSON.parse(first)
  assert.deepEqual(plan.counts, { total: 5, superseding: 2, initial: 3 })
  assert.equal(plan.controls.executable, false)
  assert.equal(plan.controls.productionMutationAuthorized, false)
  assert.equal(plan.controls.authorityCredentialIncluded, false)
  assert.equal(plan.controls.explicitFutureAuthorizationRequired, true)
  assert.equal(plan.targets.every((target: { state: string }) => target.state === 'prepared-not-authorized'), true)
})

test('private canary vocabulary stays outside public and client projection', () => {
  const publicSources = [
    'app/sitemap.ts',
    'app/llms.txt/route.ts',
    'lib/llms-manifest.ts',
    'lib/substantial-page-public.ts',
  ].map((path) => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(publicSources, /source-override-preview-release|Preview-Source-Override-Canary/)
  const client = filesUnder('.next/static').map((path) => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(client, /source-override-preview-release|active-canonical-release-missing/)
})
