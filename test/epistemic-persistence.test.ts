import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  ADAPTED_EPISTEMIC_CANDIDATES,
  EPISTEMIC_MIGRATION_INVENTORY,
  LEGACY_EPISTEMIC_ADAPTERS,
} from '../lib/epistemic-adapters.ts'
import {
  buildEpistemicIngestionBatch,
  ingestionBatchSnapshot,
  parseEpistemicIngestionRequest,
} from '../lib/epistemic-ingestion.ts'
import {
  EXPERT_REVIEW_CRITERIA,
  applyExpertReviews,
  authorizeEpistemicOperations,
  buildEpistemicExpertReview,
  parseEpistemicExpertReview,
} from '../lib/epistemic-review.ts'
import { EXPERT_REVIEW_SCOPES, type EpistemicRecord } from '../lib/epistemic-schema.ts'
import { epistemicReviewTargetHash, evaluatePublicationGate, sha256Canonical } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_OPERATIONAL_EVIDENCE } from '../lib/epistemic-operational-evidence.ts'

const root = new URL('../', import.meta.url)

test('five adapters preserve every core legacy record and fail closed', () => {
  assert.equal(LEGACY_EPISTEMIC_ADAPTERS.length, 5)
  assert.deepEqual(EPISTEMIC_MIGRATION_INVENTORY.counts, {
    adapters: 5,
    sourceRecords: 110,
    publicEligible: 0,
    withheld: 110,
  })
  assert.deepEqual(
    EPISTEMIC_MIGRATION_INVENTORY.adapters.map((adapter) => [adapter.id, adapter.counts.sourceRecords]),
    [['semiconductor', 25], ['mathematics', 24], ['astronomy', 23], ['religion', 18], ['neuromorphic-biocomputing', 20]],
  )
  for (const candidate of ADAPTED_EPISTEMIC_CANDIDATES) {
    assert.equal(candidate.gateDecision.publicEligible, false)
    assert.equal(candidate.record.publication.requestedPublicPromotion, false)
    assert.deepEqual(candidate.record.publication.requiredReviewScopes, EXPERT_REVIEW_SCOPES)
    assert.match(candidate.sourceRecordSha256, /^sha256:[a-f0-9]{64}$/)
    assert.match(candidate.reviewTargetSha256, /^sha256:[a-f0-9]{64}$/)
    assert.ok(!candidate.gateDecision.reasons.some((reason) => reason.startsWith('claim-source-unresolved')))
  }
})

test('adapter output hashes are deterministic while ingestion batches remain append-only events', () => {
  const adapter = LEGACY_EPISTEMIC_ADAPTERS[0]
  assert.equal(adapter.sourceDatasetSha256, LEGACY_EPISTEMIC_ADAPTERS[0].sourceDatasetSha256)
  assert.deepEqual(adapter.adapt().map((record) => record.candidateSha256), adapter.adapt().map((record) => record.candidateSha256))

  const parsed = parseEpistemicIngestionRequest({ adapterId: 'semiconductor', idempotencyKey: 'semiconductor-import-001' })
  const first = buildEpistemicIngestionBatch(parsed, new Date('2026-08-24T05:00:00.000Z'))
  const second = buildEpistemicIngestionBatch(parsed, new Date('2026-08-24T05:00:00.000Z'))
  assert.equal(first.recordCount, 25)
  assert.notEqual(first.batchId, second.batchId)
  assert.notEqual(first.batchSha256, second.batchSha256)
  assert.equal(first.records[0].candidateSha256, second.records[0].candidateSha256)
  assert.equal(ingestionBatchSnapshot(first).records.length, 25)
  assert.throws(() => parseEpistemicIngestionRequest({ adapterId: 'unknown', idempotencyKey: 'long-enough' }), /unsupported/)
})

function cleanCandidate(): EpistemicRecord {
  const imported = ADAPTED_EPISTEMIC_CANDIDATES.find((candidate) => candidate.adapterId === 'mathematics')!.record
  return {
    ...imported,
    claims: imported.claims.map((claim) => ({ ...claim, evidenceMaturity: 'single-study' })),
    sources: imported.sources.map((source) => ({ ...source, publishedAt: '2026-01-01', exactLocator: 'Reviewed source section and stable URL anchor.' })),
    publication: {
      ...imported.publication,
      requestedPublicPromotion: true,
      reviewState: 'published-canonical',
      publishedAt: '2026-08-24',
      reviewEvents: [],
    },
  }
}

function reviewInput(record: EpistemicRecord, scope: (typeof EXPERT_REVIEW_SCOPES)[number]) {
  return parseEpistemicExpertReview({
    recordId: record.id,
    domainSlug: record.domainSlug,
    targetSha256: epistemicReviewTargetHash(record),
    scope,
    reviewer: {
      reviewerId: 'expert_mathematics-reviewer',
      profileVersion: 1,
      displayName: 'Mathematics Reviewer',
      qualifications: ['Graduate training and publication experience in the reviewed mathematical method.'],
      affiliation: null,
      identityUrl: 'https://example.org/reviewers/mathematics-reviewer',
      domains: [record.domainSlug],
      conflicts: [],
    },
    criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({ criterionId: criterion.id, verdict: 'satisfied', rationale: 'The frozen candidate satisfies this published criterion.' })),
    disagreements: [],
    rationale: 'The decision is limited to this scope and the exact frozen review-target digest.',
    supersedesReviewId: null,
    idempotencyKey: `review-${scope}-001`,
  })
}

test('all required expert scopes can pass one frozen target and become stale after a content change', () => {
  const record = cleanCandidate()
  const reviews = EXPERT_REVIEW_SCOPES.map((scope, index) => buildEpistemicExpertReview(reviewInput(record, scope), new Date(`2026-08-24T05:0${index}:00.000Z`)))
  const reviewed = applyExpertReviews(record, reviews)
  const decision = evaluatePublicationGate(reviewed)
  assert.equal(decision.publicEligible, true, decision.reasons.join(', '))
  assert.equal(new Set(reviewed.publication.reviewEvents.map((event) => event.reviewerProfileVersion)).size, 1)

  const changed = { ...reviewed, summary: `${reviewed.summary} Material change.` }
  const stale = evaluatePublicationGate(changed)
  assert.equal(stale.publicEligible, false)
  assert.equal(stale.reasons.filter((reason) => reason.startsWith('expert-review-stale:')).length, 4)
})

test('reservations and unqualified reviews cannot silently become approvals', () => {
  const record = cleanCandidate()
  const scope = 'source-fidelity' as const
  const input = reviewInput(record, scope)
  input.criteria[0] = { ...input.criteria[0], verdict: 'reservation' }
  const reserved = buildEpistemicExpertReview(input, new Date('2026-08-24T05:00:00.000Z'))
  assert.equal(reserved.decision, 'approve-with-reservations')
  assert.equal(applyExpertReviews(record, [reserved]).publication.reviewEvents[0].verdict, 'request-changes')

  const abstaining = reviewInput(record, scope)
  abstaining.criteria[0] = { ...abstaining.criteria[0], verdict: 'not-qualified' }
  assert.equal(buildEpistemicExpertReview(abstaining).decision, 'abstain')
})

test('epistemic operations use one dedicated constant-time bearer boundary', () => {
  const previous = process.env.EPISTEMIC_OPERATIONS_TOKEN
  try {
    delete process.env.EPISTEMIC_OPERATIONS_TOKEN
    assert.equal(authorizeEpistemicOperations(new Request('https://example.test')).authorized, false)
    process.env.EPISTEMIC_OPERATIONS_TOKEN = 'x'.repeat(32)
    assert.equal(authorizeEpistemicOperations(new Request('https://example.test', { headers: { authorization: `Bearer ${'x'.repeat(32)}` } })).authorized, true)
    assert.equal(authorizeEpistemicOperations(new Request('https://example.test', { headers: { authorization: `Bearer ${'y'.repeat(32)}` } })).authorized, false)
  } finally {
    if (previous === undefined) delete process.env.EPISTEMIC_OPERATIONS_TOKEN
    else process.env.EPISTEMIC_OPERATIONS_TOKEN = previous
  }
})

test('database persistence is append-only and cannot publish an imported record', async () => {
  const sql = await readFile(new URL('supabase/migrations/20260824050000_epistemic_ingestion_and_expert_review.sql', root), 'utf8')
  assert.match(sql, /epistemic_ingestion_batches/)
  assert.match(sql, /epistemic_expert_reviewer_profiles/)
  assert.match(sql, /epistemic_expert_review_decisions/)
  assert.match(sql, /reject_epistemic_ledger_mutation/)
  assert.match(sql, /revoke insert, update, delete, truncate on table/)
  assert.match(sql, /public_eligible boolean not null check \(public_eligible = false\)/)
  assert.match(sql, /No row represents product approval or empirical validation/)
  assert.doesNotMatch(sql, /publish_epistemic|auto_publish|published_canonical/)
})

test('aggregate production evidence proves execution without exposing operational data', () => {
  const evidence = EPISTEMIC_OPERATIONAL_EVIDENCE
  assert.equal(evidence.environment, 'production')
  assert.equal(evidence.verification.schemaConverged, true)
  assert.equal(evidence.verification.applicationHealthPassed, true)
  assert.deepEqual(evidence.adapterResults.map((adapter) => adapter.recordCount), [25, 24, 23, 18, 20])
  assert.equal(evidence.totals.persistedBatches, 5)
  assert.equal(evidence.totals.persistedReviewTargets, 110)
  assert.equal(evidence.totals.publicEligibleTargets, 0)
  assert.equal(evidence.totals.reviewerProfiles, 0)
  assert.equal(evidence.totals.reviewDecisions, 0)
  assert.equal(evidence.verification.autoPublicationSupported, false)
  assert.equal(evidence.verification.productApprovalSupported, false)
  assert.equal(evidence.exclusions.participantDataIncluded, false)
  assert.equal(evidence.exclusions.natalDataIncluded, false)
  assert.equal(evidence.exclusions.sourceTextIncluded, false)
  assert.equal(evidence.exclusions.credentialsIncluded, false)
  assert.equal(evidence.exclusions.internalIdentifiersIncluded, false)
  assert.match(evidence.evidenceSha256, /^sha256:[a-f0-9]{64}$/)
})

test('protected APIs, Cyber-light ledger, sitemap, and machine discovery expose the workflow honestly', async () => {
  const [ingestionRoute, reviewRoute, page, registry, method, sitemap, llms, admin, store] = await Promise.all([
    'app/api/admin/epistemic-ingestion/route.ts',
    'app/api/admin/epistemic-reviews/route.ts',
    'app/knowledge/epistemic-system/migrations/page.tsx',
    'app/knowledge/epistemic-system/migration-registry/route.ts',
    'app/knowledge/epistemic-system/page.tsx',
    'app/sitemap.ts',
    'lib/llms-manifest.ts',
    'app/admin/epistemic-ingestion/page.tsx',
    'lib/epistemic-store.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')))
  for (const route of [ingestionRoute, reviewRoute]) {
    assert.match(route, /authorizeEpistemicOperations/)
    assert.match(route, /autoPublicationSupported: false/)
    assert.match(route, /Cache-Control': 'no-store/)
  }
  assert.match(page, /Existing knowledge enters as evidence to review/)
  assert.match(page, /evidence-page/)
  assert.match(registry, /EPISTEMIC_MIGRATION_INVENTORY/)
  assert.match(registry, /EPISTEMIC_OPERATIONAL_EVIDENCE/)
  assert.match(method, /Five legacy systems now meet the same gate/)
  assert.match(sitemap, /EPISTEMIC_SYSTEM_PATH\}\/migrations/)
  assert.match(llms, /Epistemic machine-readable migration registry/)
  assert.match(admin, /Knowledge ingestion and expert review/)
  assert.match(store, /record_epistemic_ingestion_batch/)
  assert.match(store, /record_epistemic_expert_review/)
  assert.equal(sha256Canonical(EPISTEMIC_MIGRATION_INVENTORY), sha256Canonical(EPISTEMIC_MIGRATION_INVENTORY))
})
