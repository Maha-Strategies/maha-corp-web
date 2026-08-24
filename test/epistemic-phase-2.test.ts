import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { ADAPTED_EPISTEMIC_CANDIDATES } from '../lib/epistemic-adapters.ts'
import {
  buildExpertReviewQueue,
  buildQueueSummary,
  buildSourceCompletionEvent,
  buildSourceCompletionQueue,
  nextSourceCompletionState,
  parseSourceCompletionEvent,
  queueLaneForReason,
  type EpistemicQueueTarget,
  type SourceCompletionEvent,
} from '../lib/epistemic-work-queue.ts'

const root = new URL('../', import.meta.url)

function target(index = 0): EpistemicQueueTarget {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES[index]
  return {
    recordId: candidate.record.id,
    domainSlug: candidate.record.domainSlug,
    title: candidate.record.title,
    reviewTargetSha256: candidate.reviewTargetSha256,
    sourcePublicPath: candidate.sourcePublicPath,
    gateDecision: candidate.gateDecision,
  }
}

test('gate reasons route into separate source, review, and release-control lanes', () => {
  assert.equal(queueLaneForReason('source-locator-missing:source-1'), 'source-completion')
  assert.equal(queueLaneForReason('claim-evidence-not-assessed:claim-1'), 'source-completion')
  assert.equal(queueLaneForReason('expert-review-stale:source-fidelity'), 'expert-review')
  assert.equal(queueLaneForReason('approval-review-missing'), 'expert-review')
  assert.equal(queueLaneForReason('public-promotion-not-requested'), 'release-control')
  assert.equal(queueLaneForReason('review-state-not-canonical'), 'release-control')
})

test('source-completion projection preserves exact blockers and excludes release state', () => {
  const queue = buildSourceCompletionQueue(ADAPTED_EPISTEMIC_CANDIDATES.map((candidate): EpistemicQueueTarget => ({
    recordId: candidate.record.id,
    domainSlug: candidate.record.domainSlug,
    title: candidate.record.title,
    reviewTargetSha256: candidate.reviewTargetSha256,
    sourcePublicPath: candidate.sourcePublicPath,
    gateDecision: candidate.gateDecision,
  })), [])
  assert.equal(queue.length, 110)
  assert.ok(queue.every((item) => item.state === 'untriaged'))
  assert.ok(queue.every((item) => item.blockers.length > 0))
  assert.ok(queue.every((item) => !item.blockers.some((blocker) => queueLaneForReason(blocker.code) !== 'source-completion')))
  assert.ok(queue.some((item) => item.blockers.some((blocker) => blocker.code.startsWith('source-locator-missing:'))))
})

test('append-only source workflow enforces transitions and evidence coverage', () => {
  const frozen = target()
  const blocker = frozen.gateDecision.reasons.find((reason) => queueLaneForReason(reason) === 'source-completion')!
  const base = {
    recordId: frozen.recordId,
    targetSha256: frozen.reviewTargetSha256,
    blockerCodes: [blocker],
    assigneeId: null,
    assigneeName: null,
    evidence: [],
    note: 'The imported target needs bounded source-completion work before re-ingestion.',
  }
  const triageInput = parseSourceCompletionEvent({ ...base, action: 'triage', idempotencyKey: 'phase2-triage-0001' })
  const triage = buildSourceCompletionEvent(triageInput, [], frozen.gateDecision.reasons, new Date('2026-08-24T07:30:00.000Z'))
  assert.equal(triage.previousState, 'untriaged')
  assert.equal(triage.nextState, 'queued')
  assert.match(triage.eventSha256, /^sha256:[a-f0-9]{64}$/)

  const startInput = parseSourceCompletionEvent({ ...base, action: 'start', assigneeId: 'researcher_maha', assigneeName: 'Maha Source Researcher', idempotencyKey: 'phase2-start-0001' })
  const start = buildSourceCompletionEvent(startInput, [triage], frozen.gateDecision.reasons, new Date('2026-08-24T07:31:00.000Z'))
  assert.equal(start.nextState, 'in-progress')

  const evidence = [{ blockerCode: blocker, sourceUrl: 'https://example.org/stable-source', exactLocator: 'Page 14, paragraph 2', note: 'This stable location supplies the missing field without changing the original target.', rightsBasis: 'citation-with-paraphrase' }]
  const submitInput = parseSourceCompletionEvent({ ...base, action: 'submit-evidence', assigneeId: 'researcher_maha', assigneeName: 'Maha Source Researcher', evidence, idempotencyKey: 'phase2-submit-0001' })
  const submit = buildSourceCompletionEvent(submitInput, [triage, start], frozen.gateDecision.reasons, new Date('2026-08-24T07:32:00.000Z'))
  assert.equal(submit.nextState, 'ready-for-reingestion')
  assert.throws(() => nextSourceCompletionState('closed', 'start'), /not allowed/)
  assert.throws(() => buildSourceCompletionEvent({ ...submitInput, evidence: [] }, [triage, start], frozen.gateDecision.reasons), /requires at least one evidence item/)
  assert.throws(() => buildSourceCompletionEvent({ ...triageInput, blockerCodes: ['public-promotion-not-requested'] }, [], frozen.gateDecision.reasons), /not present on this frozen target/)
})

test('expert-review queue expands every frozen target into four independently actionable scopes', () => {
  const targets = [target(0), target(1)]
  const expert = buildExpertReviewQueue(targets, [])
  assert.equal(expert.length, 8)
  assert.ok(expert.every((item) => item.status === 'missing'))
  assert.equal(new Set(expert.map((item) => item.scope)).size, 4)
  const source = buildSourceCompletionQueue(targets, [])
  assert.deepEqual(buildQueueSummary(source, expert), {
    sourceRecords: 2,
    untriaged: 2,
    active: 0,
    readyForReingestion: 0,
    expertScopes: 8,
    expertChangesRequested: 0,
    expertStale: 0,
  })
})

test('latest append-only event drives projection without mutating the target', () => {
  const frozen = target()
  const blocker = frozen.gateDecision.reasons.find((reason) => queueLaneForReason(reason) === 'source-completion')!
  const event: SourceCompletionEvent = {
    schemaVersion: 'maha-epistemic-workflow/1.0',
    eventId: `epiwork_${'a'.repeat(32)}`,
    recordId: frozen.recordId,
    targetSha256: frozen.reviewTargetSha256,
    action: 'assign',
    previousState: 'queued',
    nextState: 'assigned',
    blockerCodes: [blocker],
    assigneeId: 'researcher_maha',
    assigneeName: 'Maha Source Researcher',
    evidence: [],
    note: 'Assignment is limited to source completion for the unchanged frozen target.',
    occurredAt: '2026-08-24T07:31:00.000Z',
    eventSha256: `sha256:${'b'.repeat(64)}`,
  }
  const [projected] = buildSourceCompletionQueue([frozen], [event])
  assert.equal(projected.state, 'assigned')
  assert.deepEqual(projected.assignee, { id: 'researcher_maha', name: 'Maha Source Researcher' })
  assert.equal(projected.targetSha256, frozen.reviewTargetSha256)
})

test('Phase 2 persistence and UI remain private, append-only, and non-publishing', async () => {
  const [sql, route, page, reviewPage, docs, publicMethod, store] = await Promise.all([
    'supabase/migrations/20260824073000_epistemic_source_completion_queue.sql',
    'app/api/admin/epistemic-work-queue/route.ts',
    'app/admin/epistemic-work-queue/page.tsx',
    'app/admin/epistemic-ingestion/page.tsx',
    'docs/epistemic-ingestion-and-review.md',
    'app/knowledge/epistemic-system/page.tsx',
    'lib/epistemic-store.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')))
  assert.match(sql, /epistemic_source_completion_events/)
  assert.match(sql, /record_epistemic_source_completion_event/)
  assert.match(sql, /reject_epistemic_ledger_mutation/)
  assert.match(sql, /revoke insert, update, delete, truncate/)
  assert.doesNotMatch(sql, /publish_epistemic|auto_publish/)
  assert.match(route, /authorizeEpistemicOperations/)
  assert.match(route, /autoPublicationSupported: false/)
  assert.match(route, /Cache-Control': 'no-store/)
  assert.match(page, /Turn withheld records into reviewable evidence/)
  assert.match(page, /never written to browser storage/)
  assert.match(page, /Open scoped review workspace/)
  assert.match(reviewPage, /Open Phase 2 queue/)
  assert.match(docs, /ready-for-reingestion/)
  assert.match(publicMethod, /Withheld no longer means invisible or unstructured/)
  assert.match(store, /record_epistemic_source_completion_event/)
})
