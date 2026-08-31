import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { BATCH_11_MIXED_LINEAGE_REHEARSAL_ADAPTER } from '../lib/batch-11-ingestion-adapter.ts'
import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import { buildEpistemicCanonicalRelease } from '../lib/epistemic-release.ts'
import { buildEpistemicExpertReview, parseEpistemicExpertReview } from '../lib/epistemic-review.ts'
import {
  BATCH_11_CANARY_RECORD_IDS,
  BATCH_11_REVISED_RECORDS,
  BATCH_11_REVISION_AUDITS,
  batch11RevisionReviewInputs,
} from '../lib/batch-11-revision-canary.ts'

const ROOT = resolve(import.meta.dirname, '..')
const MIGRATION = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260831120000_batch_11_mixed_lineage_rehearsal.sql'),
  'utf8',
)
const SCRIPT = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml'), 'utf8')

test('the dedicated adapter freezes exactly the five audited Batch 11 revisions', () => {
  const candidates = BATCH_11_MIXED_LINEAGE_REHEARSAL_ADAPTER.adapt()
  assert.equal(candidates.length, 5)
  assert.deepEqual(candidates.map((candidate) => candidate.record.id).sort(), [...BATCH_11_CANARY_RECORD_IDS].sort())
  for (const candidate of candidates) {
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === candidate.record.id)
    assert.ok(audit)
    assert.equal(candidate.reviewTargetSha256, audit.revisedRecordRevisionSha256)
    assert.equal(audit.outcome, 'alignment-clear-ready-for-revision-scoped-review')
    assert.equal(audit.checks.length, 8)
  }
})

test('ingestion clearance is derived from the exact immutable revision audit', () => {
  const batch = buildEpistemicIngestionBatch(
    { adapterId: 'batch-11-mixed-lineage-rehearsal', idempotencyKey: 'batch-11-preview-integration-test' },
    new Date('2026-08-31T00:00:00.000Z'),
  )
  assert.equal(batch.records.length, 5)
  for (const record of batch.records) {
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === record.candidateRecordId)
    assert.ok(audit)
    assert.equal(record.reviewTargetSha256, audit.revisedRecordRevisionSha256)
    assert.equal(record.alignmentDecision.contentInspectionState, 'internally-inspected-batch-11-revision')
    assert.equal(record.alignmentDecision.inspectionAttestationSha256, audit.auditSha256)
    assert.equal(record.alignmentDecision.canonicalEligible, true)
    assert.equal(record.gateDecision.publicEligible, false, 'ingestion is never publication')
    assert.ok(
      MIGRATION.includes(`('${record.candidateRecordId}', '${record.reviewTargetSha256}')`),
      `${record.candidateRecordId}: the dedicated database allowlist must bind the same revised target`,
    )
  }
})

test('all twenty persisted review requests parse as internal exact-revision decisions', () => {
  const inputs = batch11RevisionReviewInputs()
  assert.equal(inputs.length, 20)
  for (const input of inputs) {
    const parsed = parseEpistemicExpertReview(input)
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === parsed.recordId)
    assert.ok(audit)
    assert.equal(parsed.targetSha256, audit.revisedRecordRevisionSha256)
    assert.equal(parsed.reviewer.reviewerKind, 'internal-editorial')
    assert.match(parsed.reviewer.reviewMethod ?? '', /No external endorsement or independent reproduction is claimed/)
  }
})

test('the normal release compiler accepts all five requests with external witnesses used only as predecessor identity', () => {
  const reviewedAt = new Date('2026-08-31T00:00:00.000Z')
  const reviews = batch11RevisionReviewInputs().map((input) => buildEpistemicExpertReview(input, reviewedAt))
  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
    const record = BATCH_11_REVISED_RECORDS.find((entry) => entry.id === declaration.recordId)
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === declaration.recordId)
    assert.ok(record && audit)
    const release = buildEpistemicCanonicalRelease({
      operation: 'publish',
      recordId: declaration.recordId,
      targetSha256: audit.revisedRecordRevisionSha256,
      canonicalVersion: declaration.declaredReleaseKind === 'superseding' ? 'batch-11-preview-1.1.0' : 'batch-11-preview-1.0.0',
      supersedesReleaseId: declaration.declaredPriorReleaseId,
      authority: {
        authorityId: 'authority_batch-11-preview',
        displayName: 'Maha Batch 11 Preview Release Authority',
        role: 'Internal Preview-only canonical release authority',
        authorizationBasis: 'The owner authorized this exact isolated Preview rehearsal after exact-revision review and lineage reconciliation passed.',
        publicAttribution: false,
      },
      publicChangeSummary: 'Preview-only release binds the inspected Batch 11 source replacement and exact revised record.',
      rationale: 'The exact revision has inspected evidence, an exact locator, an eight-dimension audit and four scoped internal-editorial approvals.',
      idempotencyKey: `batch-11-preview-test:${audit.revisedRecordRevisionSha256}`,
    }, {
      recordId: record.id,
      targetSha256: audit.revisedRecordRevisionSha256,
      candidateSnapshot: record,
    }, reviews, declaration.declaredPriorReleaseId
      ? {
          recordId: declaration.recordId,
          releaseId: declaration.declaredPriorReleaseId,
          targetSha256: declaration.declaredPriorTargetSha256!,
        }
      : null, reviewedAt)
    assert.equal(release.releaseKind, declaration.declaredReleaseKind)
    assert.equal(release.supersedesReleaseId, declaration.declaredPriorReleaseId)
    assert.equal(release.targetSha256, audit.revisedRecordRevisionSha256)
    assert.equal(release.approvals.length, 4)
    assert.equal(release.gateDecision.publicEligible, true)
  }
})

test('the external predecessor table accepts only the two exact public witness tuples', () => {
  for (const exact of [
    [
      'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
      'epirelease_8e947374097d4695815dbf9ab653177b',
      'sha256:cb41216cd3cf8fdc36decedf66f8e768a25b450969b763e83c3d2b756ae57052',
    ],
    [
      'urn:maha:record:mechanistic-interpretability-representation-probing-boundary',
      'epirelease_93c92eb7a317465b83fabf8d3e6962da',
      'sha256:83339b28fdea2a81504e0bf44f9229fe06b24e444c774c0a0d513cf1b0bc8b3f',
    ],
  ]) {
    for (const value of exact) assert.match(MIGRATION, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(MIGRATION, /batch_11_rehearsal_imported_lineage_allowlist_check/)
  assert.match(MIGRATION, /revoke insert, update, delete, truncate[^;]+service_role/)
})

test('the dedicated release RPC preserves the normal canonical release controls', () => {
  for (const required of [
    "recordSnapshot,publication,requestedPublicPromotion}' <> 'true'",
    "recordSnapshot,publication,reviewState}' <> 'published-canonical'",
    "recordSnapshot,publication,canonicalVersion}' <> p_release->>'canonicalVersion'",
    "recordSnapshot,publication,publishedAt",
    "recordSnapshot,publication,reviewEvents",
    'Released identity differs from the frozen Batch 11 target',
    'Batch 11 canonical publication controls or path are invalid',
    'Batch 11 canonical record does not embed the exact',
  ]) assert.ok(MIGRATION.includes(required), required)
})

test('invalid Preview credentials and commit identity are refused before branch creation', () => {
  const preflight = SCRIPT.indexOf('Buffer.byteLength(operationsToken) < 32')
  const commitCheck = SCRIPT.indexOf("checkedOutCommit !== expectedReviewedCommit")
  const run = SCRIPT.indexOf('runRehearsal(driver, gates)')
  assert.ok(preflight > 0 && commitCheck > preflight && run > commitCheck)
  assert.match(WORKFLOW, /\$\{#EPISTEMIC_OPERATIONS_TOKEN\}.*-ge 32/)
  assert.match(WORKFLOW, /\$\{#EPISTEMIC_RELEASE_AUTHORITY_TOKEN\}.*-ge 32/)
  assert.match(WORKFLOW, /test\/batch-11-preview-binding\.test\.ts/)
})

test('the external-lineage release path is Preview-flagged and absent by default', () => {
  const store = readFileSync(resolve(ROOT, 'lib/epistemic-store.ts'), 'utf8')
  assert.match(store, /EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL === 'batch-11-preview'/)
  assert.match(store, /EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL !== 'batch-11-preview'\) return \[\]/)
  assert.match(SCRIPT, /EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL: 'batch-11-preview'/)
  assert.doesNotMatch(WORKFLOW, /EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL:/, 'the flag belongs only inside the branch-bound deployment')
})

test('private ingestion adapters are absent from the public release-ledger store graph', () => {
  const publicStore = readFileSync(resolve(ROOT, 'lib/epistemic-store.ts'), 'utf8')
  const publicAdapters = readFileSync(resolve(ROOT, 'lib/epistemic-adapters.ts'), 'utf8')
  const writeStore = readFileSync(resolve(ROOT, 'lib/epistemic-ingestion-store.ts'), 'utf8')
  const privateAdapter = readFileSync(resolve(ROOT, 'lib/batch-11-ingestion-adapter.ts'), 'utf8')
  const adminRoute = readFileSync(resolve(ROOT, 'app/api/admin/epistemic-ingestion/route.ts'), 'utf8')
  assert.doesNotMatch(publicStore, /from '\.\/epistemic-ingestion\.ts'/)
  assert.doesNotMatch(publicStore, /record_batch_11_rehearsal_targets/)
  assert.doesNotMatch(publicAdapters, /batch-11-revision-canary/)
  assert.match(writeStore, /record_batch_11_rehearsal_targets/)
  assert.match(privateAdapter, /batch-11-revision-canary/)
  assert.match(adminRoute, /@\/lib\/epistemic-ingestion-store/)
})
