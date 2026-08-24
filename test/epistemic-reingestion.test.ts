import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { ADAPTED_EPISTEMIC_CANDIDATES } from '../lib/epistemic-adapters.ts'
import { buildEpistemicCandidateAudit } from '../lib/epistemic-audit.ts'
import {
  buildControlledReingestionCompilation,
  controlledCorrectionDescriptor,
  parseControlledReingestionRequest,
  type FrozenReingestionTarget,
} from '../lib/epistemic-reingestion.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { sourceAlignmentBlockers } from '../lib/epistemic-source-alignment.ts'
import {
  buildSourceCompletionEvent,
  parseSourceCompletionEvent,
  sourceCompletionReasons,
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

function alignmentFixture(proposedValue: string, evidenceUrl?: string) {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES.find((entry) => sourceAlignmentBlockers(entry.record).length > 0)!
  const blocker = sourceAlignmentBlockers(candidate.record)[0]
  const sourceId = blocker.slice('source-claim-alignment-mismatch:'.length)
  const source = candidate.record.sources.find((entry) => entry.id === sourceId)!
  const reasons = sourceCompletionReasons({ gateDecision: candidate.gateDecision, candidateSnapshot: candidate.record })
  const base = {
    recordId: candidate.record.id,
    targetSha256: candidate.reviewTargetSha256,
    blockerCodes: [blocker],
    assigneeId: null,
    assigneeName: null,
    evidence: [],
    note: 'This workflow records evidence for one declared source-to-claim mismatch.',
  }
  const triage = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...base, action: 'triage', idempotencyKey: 'alignment-triage-001' }), [], reasons, new Date('2026-08-24T14:00:00.000Z'))
  const start = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...base, action: 'start', assigneeId: 'researcher_maha', assigneeName: 'Maha Source Researcher', idempotencyKey: 'alignment-start-001' }), [triage], reasons, new Date('2026-08-24T14:01:00.000Z'))
  const evidence = [{
    blockerCode: blocker,
    sourceUrl: evidenceUrl ?? source.url,
    exactLocator: source.exactLocator || 'Named section and bounded passage',
    proposedValue,
    note: 'The proposed alignment metadata is bound to this exact source and remains subject to source-fidelity review.',
    rightsBasis: source.rights.basis,
  }]
  const submit = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...base, action: 'submit-evidence', assigneeId: 'researcher_maha', assigneeName: 'Maha Source Researcher', evidence, idempotencyKey: 'alignment-submit-001' }), [triage, start], reasons, new Date('2026-08-24T14:02:00.000Z'))
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
    corrections: [{ blockerCode: blocker, evidenceEventId: submit.eventId, proposedValue }],
    note: 'Compile one evidence-bound alignment correction into a fresh noncanonical target.',
    idempotencyKey: 'alignment-compile-001',
  })
  return { candidate, blocker, source, target, request, events: [triage, start, submit] as SourceCompletionEvent[] }
}

test('the controlled compiler can refine declared source alignment without creating approval', () => {
  const proposedValue = JSON.stringify({
    mode: 'refine',
    establishes: 'The named official technical page describes the bounded process mechanism and tool role represented by the linked claim.',
    boundary: 'The source is an interested-party technical description limited to its named product context and is not an independent cross-vendor performance comparison.',
  })
  const { blocker, source, target, request, events } = alignmentFixture(proposedValue)
  assert.equal(controlledCorrectionDescriptor(target.candidateSnapshot, blocker)?.kind, 'source-claim-alignment')
  const compilation = buildControlledReingestionCompilation(request, target, events, new Date('2026-08-24T14:03:00.000Z'))
  const revised = compilation.outputRecord.sources.find((entry) => entry.id === source.id)!
  assert.match(revised.establishes, /bounded process mechanism/)
  assert.ok(!compilation.remainingSourceBlockerCodes.includes(blocker))
  assert.ok(!buildEpistemicCandidateAudit(compilation.outputRecord).findings.some((finding) => finding.code === 'source-to-claim-declared-mismatch' && finding.evidence.includes(source.id)))
  assert.equal(compilation.outputRecord.publication.reviewState, 'draft')
  assert.deepEqual(compilation.outputRecord.publication.reviewEvents, [])
})

test('a mismatched source can be replaced only when every linked claim is explicitly remapped', () => {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES.find((entry) => sourceAlignmentBlockers(entry.record).length > 0)!
  const sourceId = sourceAlignmentBlockers(candidate.record)[0].slice('source-claim-alignment-mismatch:'.length)
  const claimIds = candidate.record.claims.filter((claim) => claim.sourceIds.includes(sourceId)).map((claim) => claim.id)
  const replacementUrl = 'https://example.org/stable-replacement-source'
  const proposedValue = JSON.stringify({
    mode: 'replace',
    replacement: {
      id: 'replacement-authority-source',
      title: 'Stable replacement authority source',
      authors: ['Example Standards Body'],
      publisher: 'Example Standards Body',
      publishedAt: '2026-01-15',
      url: replacementUrl,
      identifiers: [{ scheme: 'url', value: replacementUrl }],
      exactLocator: 'Section 2, paragraphs 3–5',
      rights: { basis: 'citation-with-paraphrase', quotationUsed: false, note: 'The test fixture retains only a citation and original paraphrase.' },
      establishes: 'The identified section directly describes the bounded mechanism represented by each explicitly remapped test claim.',
      boundary: 'The source is limited to the stated mechanism, conditions, and document version; broader performance and deployment claims require separate evidence.',
    },
    claimIds,
  })
  const { blocker, target, request, events } = alignmentFixture(proposedValue, replacementUrl)
  const compilation = buildControlledReingestionCompilation(request, target, events, new Date('2026-08-24T14:03:00.000Z'))
  assert.ok(!compilation.outputRecord.sources.some((source) => source.id === sourceId))
  assert.ok(compilation.outputRecord.sources.some((source) => source.id === 'replacement-authority-source'))
  for (const claimId of claimIds) assert.ok(compilation.outputRecord.claims.find((claim) => claim.id === claimId)?.sourceIds.includes('replacement-authority-source'))
  assert.ok(!compilation.remainingSourceBlockerCodes.includes(blocker))

  const incomplete = JSON.stringify({ ...JSON.parse(proposedValue), claimIds: claimIds.slice(0, -1) })
  assert.throws(() => buildControlledReingestionCompilation({ ...request, corrections: [{ ...request.corrections[0], proposedValue: incomplete }] }, target, events), /proposed value recorded|remap every claim/)
})

test('a mismatched multi-claim source can be split without silently moving unrelated claims', () => {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES.find((entry) => sourceAlignmentBlockers(entry.record).some((blocker) => {
    const sourceId = blocker.slice('source-claim-alignment-mismatch:'.length)
    return entry.record.claims.filter((claim) => claim.sourceIds.includes(sourceId)).length > 1
  }))!
  const blocker = sourceAlignmentBlockers(candidate.record).find((code) => {
    const sourceId = code.slice('source-claim-alignment-mismatch:'.length)
    return candidate.record.claims.filter((claim) => claim.sourceIds.includes(sourceId)).length > 1
  })!
  const sourceId = blocker.slice('source-claim-alignment-mismatch:'.length)
  const linkedClaimIds = candidate.record.claims.filter((claim) => claim.sourceIds.includes(sourceId)).map((claim) => claim.id)
  const additionUrl = 'https://example.org/bounded-additional-source'
  const proposedValue = JSON.stringify({
    mode: 'split',
    retained: {
      establishes: 'The original source directly supports the bounded mechanism represented by the claim retained on that source.',
      boundary: 'The original source is limited to that retained mechanism; the separately remapped proposition is outside its stated scope.',
    },
    addition: {
      id: 'bounded-additional-source',
      title: 'Bounded additional source',
      authors: ['Example Standards Body'],
      publisher: 'Example Standards Body',
      publishedAt: '2026-01-16',
      url: additionUrl,
      identifiers: [{ scheme: 'url', value: additionUrl }],
      exactLocator: 'Section 4, paragraphs 2–4',
      rights: { basis: 'citation-with-paraphrase', quotationUsed: false, note: 'The test fixture retains only a citation and original paraphrase.' },
      establishes: 'The identified section directly establishes the separate proposition represented by the explicitly remapped claim.',
      boundary: 'The added source is limited to the named proposition and does not transfer performance across products or operating conditions.',
    },
    claimIds: [linkedClaimIds[1]],
  })
  const fixture = alignmentFixture(proposedValue, additionUrl)
  const compilation = buildControlledReingestionCompilation(fixture.request, fixture.target, fixture.events, new Date('2026-08-24T14:03:00.000Z'))
  const retainedClaim = compilation.outputRecord.claims.find((claim) => claim.id === linkedClaimIds[0])!
  const remappedClaim = compilation.outputRecord.claims.find((claim) => claim.id === linkedClaimIds[1])!
  assert.ok(retainedClaim.sourceIds.includes(sourceId))
  assert.ok(!retainedClaim.sourceIds.includes('bounded-additional-source'))
  assert.ok(!remappedClaim.sourceIds.includes(sourceId))
  assert.ok(remappedClaim.sourceIds.includes('bounded-additional-source'))
  assert.ok(compilation.outputRecord.sources.some((source) => source.id === sourceId))
  assert.ok(compilation.outputRecord.sources.some((source) => source.id === 'bounded-additional-source'))
  assert.ok(!compilation.remainingSourceBlockerCodes.includes(blocker))
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
  const [sql, chronologySql, alignmentSql, route, page, queuePage, store, docs, publicMethod, openApiTest] = await Promise.all([
    'supabase/migrations/20260824133000_epistemic_controlled_reingestion.sql',
    'supabase/migrations/20260824233000_epistemic_source_chronology.sql',
    'supabase/migrations/20260825160000_epistemic_source_alignment_remediation.sql',
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
  assert.match(alignmentSql, /source-claim-alignment-mismatch:/)
  assert.match(alignmentSql, /mode.*refine.*replace.*split/)
  assert.match(alignmentSql, /remapping every linked claim/i)
  assert.match(alignmentSql, /noncanonical draft/i)
  assert.doesNotMatch(alignmentSql, /requestedPublicPromotion.*true|published-canonical/)
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
  assert.match(docs, /alignment correction/)
  assert.match(publicMethod, /Arbitrary JSON patches and automatic promotion are not supported/)
  assert.match(openApiTest, /\/api\/admin\/epistemic-reingestion/)
})
