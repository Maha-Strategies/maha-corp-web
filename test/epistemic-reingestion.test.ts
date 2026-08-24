import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { ADAPTED_EPISTEMIC_CANDIDATES } from '../lib/epistemic-adapters.ts'
import {
  buildControlledReingestionCompilation,
  controlledCorrectionDescriptor,
  parseControlledReingestionRequest,
  type FrozenReingestionTarget,
} from '../lib/epistemic-reingestion.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import {
  buildSourceCompletionEvent,
  parseSourceCompletionEvent,
  type SourceCompletionEvent,
} from '../lib/epistemic-work-queue.ts'

const root = new URL('../', import.meta.url)

function fixture(sourceDateValue = '2025-01-15') {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES[0]
  const source = candidate.record.sources[0]
  const claim = candidate.record.claims[0]
  const blockers = [
    `source-locator-missing:${source.id}`,
    `source-publication-date-missing:${source.id}`,
    `claim-evidence-not-assessed:${claim.id}`,
  ]
  const base = {
    recordId: candidate.record.id,
    targetSha256: candidate.reviewTargetSha256,
    blockerCodes: blockers,
    assigneeId: null,
    assigneeName: null,
    evidence: [],
    note: 'This source-completion event prepares a controlled re-ingestion test target.',
  }
  const triage = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...base, action: 'triage', idempotencyKey: 'reingestion-triage-001' }), [], candidate.gateDecision.reasons, new Date('2026-08-24T13:30:00.000Z'))
  const start = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...base, action: 'start', assigneeId: 'researcher_maha', assigneeName: 'Maha Source Researcher', idempotencyKey: 'reingestion-start-001' }), [triage], candidate.gateDecision.reasons, new Date('2026-08-24T13:31:00.000Z'))
  const evidence = [
    { blockerCode: blockers[0], sourceUrl: source.url, exactLocator: 'Section 2, paragraph 4', proposedValue: 'Section 2, paragraph 4', note: 'The stable source section provides the exact locator retained for compilation.', rightsBasis: source.rights.basis },
    { blockerCode: blockers[1], sourceUrl: source.url, exactLocator: null, proposedValue: sourceDateValue, note: 'The source metadata records either a publication date or an explicit undated/living-document chronology.', rightsBasis: source.rights.basis },
    { blockerCode: blockers[2], sourceUrl: source.url, exactLocator: null, proposedValue: 'single-study', note: 'The bounded source record supports a single-study evidence maturity assessment.', rightsBasis: source.rights.basis },
  ]
  const submit = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...base, action: 'submit-evidence', assigneeId: 'researcher_maha', assigneeName: 'Maha Source Researcher', evidence, idempotencyKey: 'reingestion-submit-001' }), [triage, start], candidate.gateDecision.reasons, new Date('2026-08-24T13:32:00.000Z'))
  const target: FrozenReingestionTarget = {
    recordId: candidate.record.id,
    sourcePublicPath: candidate.sourcePublicPath,
    candidateSha256: candidate.candidateSha256,
    reviewTargetSha256: candidate.reviewTargetSha256,
    gateDecision: candidate.gateDecision,
    candidateSnapshot: candidate.record,
  }
  const request = parseControlledReingestionRequest({
    operation: 'compile',
    recordId: target.recordId,
    baseTargetSha256: target.reviewTargetSha256,
    corrections: blockers.map((blockerCode, index) => ({ blockerCode, evidenceEventId: submit.eventId, proposedValue: evidence[index].proposedValue })),
    note: 'Compile these three bounded corrections into a new frozen target for fresh review.',
    idempotencyKey: 'controlled-reingestion-001',
  })
  return { candidate, source, claim, blockers, target, request, events: [triage, start, submit] as SourceCompletionEvent[], submit }
}

test('controlled descriptors expose only server-derived fields in the current corpus', () => {
  const { candidate, blockers } = fixture()
  assert.deepEqual(blockers.map((blocker) => controlledCorrectionDescriptor(candidate.record, blocker)?.kind), [
    'source-exact-locator',
    'source-publication-date',
    'claim-evidence-maturity',
  ])
  assert.equal(controlledCorrectionDescriptor(candidate.record, 'public-promotion-not-requested'), null)
  assert.equal(controlledCorrectionDescriptor(candidate.record, 'source-rights-note-missing:invented'), null)
})

test('the compiler creates a new frozen target, exact diff, and fresh draft review state', () => {
  const { source, claim, blockers, target, request, events } = fixture()
  const compilation = buildControlledReingestionCompilation(request, target, events, new Date('2026-08-24T13:33:00.000Z'))
  const outputSource = compilation.outputRecord.sources.find((candidate) => candidate.id === source.id)!
  const outputClaim = compilation.outputRecord.claims.find((candidate) => candidate.id === claim.id)!
  assert.equal(outputSource.exactLocator, 'Section 2, paragraph 4')
  assert.equal(outputSource.publishedAt, '2025-01-15')
  assert.equal(outputClaim.evidenceMaturity, 'single-study')
  assert.equal(compilation.diff.length, 3)
  assert.deepEqual(compilation.resolvedBlockerCodes, [...blockers].sort())
  assert.notEqual(compilation.outputReviewTargetSha256, target.reviewTargetSha256)
  assert.equal(epistemicReviewTargetHash(compilation.outputRecord), compilation.outputReviewTargetSha256)
  assert.equal(compilation.outputRecord.publication.requestedPublicPromotion, false)
  assert.equal(compilation.outputRecord.publication.reviewState, 'draft')
  assert.equal(compilation.outputRecord.publication.publishedAt, undefined)
  assert.deepEqual(compilation.outputRecord.publication.reviewEvents, [])
  assert.equal(compilation.gateDecision.publicEligible, false)
  assert.ok(compilation.gateDecision.reasons.includes('public-promotion-not-requested'))
  assert.ok(compilation.gateDecision.reasons.includes('approval-review-missing'))
  assert.equal(target.candidateSnapshot.sources[0].exactLocator, '')
})

test('the compiler records undated living-source chronology without inventing a publication date', () => {
  const chronology = JSON.stringify({ status: 'living-document', accessedAt: '2026-08-24', sourceVersion: 'P5 4.12.0' })
  const { source, target, request, events } = fixture(chronology)
  const compilation = buildControlledReingestionCompilation(request, target, events, new Date('2026-08-24T13:33:00.000Z'))
  const outputSource = compilation.outputRecord.sources.find((candidate) => candidate.id === source.id)!
  assert.equal(outputSource.publishedAt, '')
  assert.deepEqual(outputSource.sourceChronology, { status: 'living-document', accessedAt: '2026-08-24', sourceVersion: 'P5 4.12.0' })
  assert.ok(!compilation.remainingSourceBlockerCodes.includes(`source-publication-date-missing:${source.id}`))
})

test('output content and target hashes are deterministic for identical frozen inputs', () => {
  const { target, request, events } = fixture()
  const at = new Date('2026-08-24T13:33:00.000Z')
  const first = buildControlledReingestionCompilation(request, target, events, at)
  const second = buildControlledReingestionCompilation(request, target, events, at)
  assert.notEqual(first.compilationId, second.compilationId)
  assert.equal(first.outputCandidateSha256, second.outputCandidateSha256)
  assert.equal(first.outputReviewTargetSha256, second.outputReviewTargetSha256)
  assert.deepEqual(first.diff, second.diff)
})

test('the compiler rejects unsupported patches, unbound evidence, and post-evidence value drift', () => {
  const { target, request, events, submit, blockers } = fixture()
  assert.throws(() => buildControlledReingestionCompilation({ ...request, corrections: [{ blockerCode: 'public-promotion-not-requested', evidenceEventId: submit.eventId, proposedValue: 'true' }] }, target, events), /not supported|not a blocker/)
  assert.throws(() => buildControlledReingestionCompilation({ ...request, corrections: [{ ...request.corrections[0], evidenceEventId: `epiwork_${'f'.repeat(32)}` }] }, target, events), /must bind a submit-evidence event/)
  assert.throws(() => buildControlledReingestionCompilation({ ...request, corrections: [{ ...request.corrections[0], proposedValue: 'A different locator' }] }, target, events), /exact locator recorded/)
  assert.throws(() => buildControlledReingestionCompilation(request, target, events.slice(0, 2)), /not ready/)
  assert.throws(() => parseControlledReingestionRequest({ ...request, corrections: [request.corrections[0], request.corrections[0]] }), /only once/)
  assert.throws(() => buildControlledReingestionCompilation({ ...request, corrections: [{ ...request.corrections[1], proposedValue: '{"status":"undated"}' }] }, target, events), /proposed value recorded|valid undated/)
  assert.ok(blockers.every((blocker) => target.gateDecision.reasons.includes(blocker)))
})

test('persistence, API, UI, and target projection remain append-only and non-publishing', async () => {
  const [sql, chronologySql, route, page, queuePage, store, docs, publicMethod, openApiTest] = await Promise.all([
    'supabase/migrations/20260824133000_epistemic_controlled_reingestion.sql',
    'supabase/migrations/20260824233000_epistemic_source_chronology.sql',
    'app/api/admin/epistemic-reingestion/route.ts',
    'app/admin/epistemic-reingestion/page.tsx',
    'app/admin/epistemic-work-queue/page.tsx',
    'lib/epistemic-store.ts',
    'docs/epistemic-ingestion-and-review.md',
    'app/knowledge/epistemic-system/page.tsx',
    'test/openapi-docs.test.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')))
  assert.match(sql, /epistemic_reingestion_compilations/)
  assert.match(sql, /record_epistemic_reingestion_compilation/)
  assert.match(sql, /reject_epistemic_ledger_mutation/)
  assert.match(sql, /requestedPublicPromotion[\s\S]*false/)
  assert.match(sql, /reviewState[\s\S]*draft/)
  assert.match(sql, /revoke insert, update, delete, truncate/)
  assert.doesNotMatch(sql, /publish_epistemic|auto_publish|published_canonical/)
  assert.match(chronologySql, /undated.*living-document/)
  assert.match(chronologySql, /coalesce\(item->>'publishedAt',''\) = ''/)
  assert.doesNotMatch(chronologySql, /requestedPublicPromotion.*true|published-canonical/)
  assert.match(route, /authorizeEpistemicOperations/)
  assert.match(route, /autoPublicationSupported: false/)
  assert.match(route, /Cache-Control': 'no-store/)
  assert.match(page, /Compile without silent mutation/)
  assert.match(page, /never written to browser storage/)
  assert.match(page, /Machine-generated before \/ after/)
  assert.match(queuePage, /Open controlled compiler/)
  assert.match(store, /epistemic_reingestion_compilations/)
  assert.match(store, /origin: 'reingestion'/)
  assert.match(docs, /Controlled re-ingestion compiler/)
  assert.match(publicMethod, /Arbitrary JSON patches and automatic promotion are not supported/)
  assert.match(openApiTest, /\/api\/admin\/epistemic-reingestion/)
})
