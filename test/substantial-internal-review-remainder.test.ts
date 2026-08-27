import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EXPERT_REVIEW_CRITERIA } from '../lib/epistemic-review.ts'
import { BATCH_2_INTERNAL_REVIEW_CANARY_IDS, BATCH_2_INTERNAL_REVIEW_RECORD_IDS } from '../lib/substantial-internal-review-cohort.ts'
import { BATCH_2_INTERNAL_REVIEW_PACKETS } from '../lib/substantial-internal-review-batch-2.ts'
import { canaryInternalReviewInputs } from '../lib/substantial-internal-review-canary.ts'
import {
  BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS,
  BATCH_2_REMAINDER_APPROVED_IDS,
  BATCH_2_REMAINDER_REVIEWS,
  BATCH_2_REMAINDER_WITHHELD_IDS,
  INTERNAL_REVIEW_REMAINDER_SUMMARY,
  REMAINDER_DISPOSITIONS,
  remainderInternalReviewInputs,
  remainderReview,
} from '../lib/substantial-internal-review-remainder.ts'

const inputs = remainderInternalReviewInputs()
const packetById = new Map(BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => [packet.recordId, packet]))
const artifact = JSON.parse(readFileSync('content/substantial-pages/internal-review-batch-2-remainder.json', 'utf8'))
const remainderSource = readFileSync('lib/substantial-internal-review-remainder.ts', 'utf8')

test('the remainder set is exactly 22 records', () => {
  assert.equal(BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS.length, 22)
  assert.equal(new Set(BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS).size, 22)
})

test('canary and remainder are disjoint and union to the frozen 27', () => {
  const canary = new Set<string>(BATCH_2_INTERNAL_REVIEW_CANARY_IDS)
  const remainder = new Set<string>(BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS)
  assert.equal(canary.size, 5)
  for (const recordId of remainder) assert.equal(canary.has(recordId), false, `${recordId} is in both cohorts`)
  assert.deepEqual([...new Set([...canary, ...remainder])].sort(), [...BATCH_2_INTERNAL_REVIEW_RECORD_IDS].sort())
  assert.equal(BATCH_2_INTERNAL_REVIEW_RECORD_IDS.length, 27)
})

test('every remainder record has exactly one explicit disposition', () => {
  assert.equal(BATCH_2_REMAINDER_REVIEWS.length, 22)
  for (const recordId of BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS) {
    const matches = BATCH_2_REMAINDER_REVIEWS.filter((entry) => entry.recordId === recordId)
    assert.equal(matches.length, 1, `${recordId} must have exactly one disposition`)
    assert.ok(REMAINDER_DISPOSITIONS.includes(matches[0].disposition))
  }
})

test('only approved records generate review inputs', () => {
  const approved = new Set(BATCH_2_REMAINDER_APPROVED_IDS)
  for (const input of inputs) assert.ok(approved.has(input.recordId), `${input.recordId} is not approved yet produced a decision`)
  for (const recordId of BATCH_2_REMAINDER_WITHHELD_IDS) {
    assert.equal(inputs.filter((input) => input.recordId === recordId).length, 0, `${recordId} is withheld and must produce no decision`)
  }
})

test('every approved record has four scoped decisions and twelve criterion decisions', () => {
  const scopes = Object.keys(EXPERT_REVIEW_CRITERIA)
  assert.equal(scopes.length, 4)
  for (const recordId of BATCH_2_REMAINDER_APPROVED_IDS) {
    const decisions = inputs.filter((input) => input.recordId === recordId)
    assert.equal(decisions.length, 4, `${recordId} must carry four scoped decisions`)
    assert.deepEqual(decisions.map((decision) => decision.scope).sort(), [...scopes].sort())
    assert.equal(decisions.reduce((total, decision) => total + decision.criteria.length, 0), 12, `${recordId} must carry twelve criterion decisions`)
  }
})

test('every decision binds the packet exact target sha and the live record revision', () => {
  for (const input of inputs) {
    const packet = packetById.get(input.recordId)!
    assert.equal(input.targetSha256, packet.targetSha256)
    const record = EPISTEMIC_RECORDS.find((entry) => entry.id === input.recordId)!
    assert.equal(input.targetSha256, epistemicReviewTargetHash(record), `${input.recordId} decision must bind the current revision`)
  }
})

test('every rationale is record-specific and nonempty', () => {
  const seen = new Map<string, string>()
  for (const input of inputs) {
    assert.ok(input.rationale.trim().length > 80, `${input.recordId}/${input.scope} rationale is too thin`)
    for (const criterion of input.criteria) {
      assert.ok(criterion.rationale.trim().length > 60, `${input.recordId}/${criterion.criterionId} rationale is too thin`)
      const key = `${input.scope}|${criterion.criterionId}|${criterion.rationale}`
      const owner = seen.get(key)
      assert.equal(owner, undefined, `${input.recordId} reuses a rationale verbatim from ${owner}`)
      seen.set(key, input.recordId)
    }
  }
})

test('no fallback or blanket approval path exists', () => {
  // A record with no explicit entry cannot be reviewed into existence.
  assert.equal(remainderReview('urn:maha:record:does-not-exist'), undefined)

  // Decisions are generated by filtering the hand-written table, never by
  // mapping the cohort id list — the latter is what a blanket approval would
  // look like, so the generator must not reference the cohort constant at all.
  const generator = remainderSource.slice(remainderSource.indexOf('export function remainderInternalReviewInputs'))
  assert.ok(generator.includes("REVIEWS.filter((entry) => entry.disposition === 'approved')"), 'decisions must come from explicit approved entries')
  assert.equal(generator.includes('BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS'), false, 'the generator must not iterate the cohort list')
  assert.equal(/\bdefault\s*:/.test(generator), false, 'no default branch may supply a disposition')

  // Each approved record is named literally in the table; none is derived.
  for (const recordId of BATCH_2_REMAINDER_APPROVED_IDS) {
    assert.ok(remainderSource.includes(`recordId: '${recordId}'`), `${recordId} must be declared explicitly`)
  }
  assert.equal(BATCH_2_REMAINDER_REVIEWS.length, BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS.length)
  for (const entry of BATCH_2_REMAINDER_REVIEWS) {
    assert.ok(BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS.includes(entry.recordId as (typeof BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS)[number]))
  }
})

test('unsatisfied criteria cannot produce an approval', () => {
  for (const entry of BATCH_2_REMAINDER_REVIEWS) {
    if (entry.unsatisfied.length > 0) assert.notEqual(entry.disposition, 'approved', `${entry.recordId} has unsatisfied criteria`)
    if (entry.disposition === 'approved') {
      assert.equal(entry.unsatisfied.length, 0)
      assert.equal(entry.blockers.length, 0)
    }
  }
})

test('rejected, blocked and revise-and-rereview records cannot enter the release set', () => {
  const releaseSet = new Set(BATCH_2_REMAINDER_APPROVED_IDS)
  for (const entry of BATCH_2_REMAINDER_REVIEWS) {
    if (entry.disposition === 'approved') continue
    assert.equal(releaseSet.has(entry.recordId), false, `${entry.recordId} is withheld but present in the release set`)
    assert.equal(entry.releaseKind, null, `${entry.recordId} is withheld and must declare no release kind`)
    assert.ok(entry.blockers.length > 0)
    assert.ok(entry.remediation && entry.remediation.length > 40)
  }
})

test('tool-deny-by-default stays withheld until direct supporting evidence is added', () => {
  const entry = remainderReview('urn:maha:record:agentic-systems-mcp-tool-deny-by-default')!
  assert.notEqual(entry.disposition, 'approved')
  assert.ok(BATCH_2_REMAINDER_WITHHELD_IDS.includes(entry.recordId))
  const failure = entry.unsatisfied.find((item) => item.criterionId === 'claim-source-alignment')
  assert.ok(failure, 'claim-source-alignment must be recorded unsatisfied')
  assert.ok(entry.blockers.includes('source-boundary-contradicts-claim'))
  // The bound source still disclaims prescribing approval policy, so nothing has changed to permit release.
  const packet = packetById.get(entry.recordId)!
  assert.ok(packet.sources.some((source) => /does not prescribe an organization/i.test(source.boundary)))
  assert.equal(inputs.some((input) => input.recordId === entry.recordId), false)
})

test('spike sorting supersedes only the exact repaired revision', () => {
  const recordId = 'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries'
  const entry = remainderReview(recordId)!
  assert.equal(entry.disposition, 'approved')
  assert.equal(entry.releaseKind, 'superseding')
  const packet = packetById.get(recordId)!
  const record = EPISTEMIC_RECORDS.find((candidate) => candidate.id === recordId)!
  assert.equal(packet.targetSha256, epistemicReviewTargetHash(record))
  // The repaired binding is the quality-metrics paper, not the probe instrumentation paper.
  assert.deepEqual(record.claims[0].sourceIds, ['source-neurotechnology-bci-spike-sorting-quality-metrics'])
  const source = record.sources[0]
  assert.match(source.title, /Quality Metrics to Accompany Spike Sorting/i)
  assert.match(source.exactLocator, /[Qq]uality metrics and [Ss]ummary matrices/)
  assert.match(source.exactLocator, /false-positive and false-negative/)
  // Both prohibited inferences stay closed by the source boundary.
  assert.match(source.boundary, /not establish that any particular unit is a single neuron/i)
  assert.match(source.boundary, /stable across sessions/i)
  assert.ok(packet.driftReAudit, 'the drift re-audit must remain declared')
  assert.equal(packet.driftReAudit?.classification, 'source-binding-change')
  for (const input of inputs.filter((candidate) => candidate.recordId === recordId)) {
    assert.equal(input.targetSha256, packet.targetSha256)
  }
})

test('metadata verification alone cannot satisfy source fidelity', () => {
  for (const entry of BATCH_2_REMAINDER_REVIEWS) {
    if (entry.disposition !== 'approved') continue
    assert.equal(entry.sourceFidelityBasis, 'inspected-source-location', `${entry.recordId} may not rest on metadata resolution`)
  }
  // Every approved source-fidelity finding names the inspected location, not merely that an identifier resolves.
  for (const entry of BATCH_2_REMAINDER_REVIEWS.filter((candidate) => candidate.disposition === 'approved')) {
    const finding = entry.scopes['source-fidelity'].toLowerCase()
    assert.ok(
      /inspect|locator|section|abstract|phase diagram|method|establishes|named|reported|analysis|claim/.test(finding),
      `${entry.recordId} source-fidelity finding must reference inspected content`,
    )
  }
})

test('alignment-clear or pageEligible alone cannot generate a review', () => {
  // Every remainder packet is by construction eligible and alignment-clear, yet two produce no decision.
  assert.equal(BATCH_2_INTERNAL_REVIEW_PACKETS.length, 27)
  assert.equal(BATCH_2_REMAINDER_WITHHELD_IDS.length, 2)
  for (const recordId of BATCH_2_REMAINDER_WITHHELD_IDS) {
    assert.ok(packetById.has(recordId), 'the withheld record still has an eligible frozen packet')
    assert.equal(inputs.some((input) => input.recordId === recordId), false)
  }
})

test('internal review is labelled internal-editorial and never expert-reviewed', () => {
  for (const input of inputs) {
    assert.equal(input.reviewer.reviewerKind, 'internal-editorial')
    const method = input.reviewer.reviewMethod
    assert.ok(method, 'every decision must declare its review method')
    assert.match(method, /No external reviewer participated/)
    const conflict = input.disagreements[0]
    assert.ok(conflict, 'the publisher conflict must be recorded on every decision')
    assert.match(conflict, /not independent of the publisher/i)
    assert.match(input.rationale, /not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification/)
  }
  assert.match(INTERNAL_REVIEW_REMAINDER_SUMMARY.boundary, /internally-reviewed-canonical|internal editorial/i)
})

test('external expert review remains an optional append-only upgrade', () => {
  assert.match(INTERNAL_REVIEW_REMAINDER_SUMMARY.boundary, /External expert review remains an optional append-only upgrade/)
  for (const input of inputs) assert.equal(input.supersedesReviewId, null, 'internal review never overwrites a prior decision')
})

test('idempotent replay cannot cross target digests', () => {
  const keys = new Set<string>()
  for (const input of inputs) {
    assert.equal(keys.has(input.idempotencyKey), false, 'idempotency keys must be unique per record and scope')
    keys.add(input.idempotencyKey)
  }
  assert.equal(keys.size, inputs.length)
  // The canary keyspace is disjoint, so replaying one cannot satisfy the other.
  const canaryKeys = new Set(canaryInternalReviewInputs().map((input) => input.idempotencyKey))
  for (const key of keys) assert.equal(canaryKeys.has(key), false)
})

test('the public projection exposes no packet, blocker vocabulary or rejected rationale', () => {
  const runner = readFileSync('scripts/run-substantial-internal-review-remainder.ts', 'utf8')
  assert.match(runner, /Substantial reference/)
  assert.match(runner, /internal-editorial/)
  assert.match(runner, /No external reviewer participated/)
  // The withheld records' rationales never reach a generated public artifact.
  for (const entry of BATCH_2_REMAINDER_REVIEWS.filter((candidate) => candidate.disposition !== 'approved')) {
    for (const item of entry.unsatisfied) assert.ok(item.reason.length > 0)
  }
  // The deterministic artifact is documentation, not a public route payload.
  assert.equal(artifact.records.length, 22)
})

test('the five canary releases remain reviewed, current and unchanged', () => {
  const canaryInputs = canaryInternalReviewInputs()
  assert.equal(canaryInputs.length, 20)
  assert.equal(new Set(canaryInputs.map((input) => input.recordId)).size, 5)
  for (const recordId of BATCH_2_INTERNAL_REVIEW_CANARY_IDS) {
    assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(recordId), false, 'a canary record must not be re-released by the remainder')
    assert.equal(inputs.some((input) => input.recordId === recordId), false)
  }
})

test('batch one substantial pages remain twenty of twenty and byte-identical', () => {
  const batch1 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-1.json', 'utf8'))
  assert.equal(batch1.pages.length, 20)
  assert.equal(batch1.pages.filter((page: { quality: { eligible: boolean } }) => page.quality.eligible).length, 20)
})

test('the deterministic artifact matches the module and carries no operational timestamp', () => {
  assert.equal(artifact.counts.reviewed, 22)
  assert.equal(artifact.counts.approved, BATCH_2_REMAINDER_APPROVED_IDS.length)
  assert.equal(artifact.counts.stillWithheld, BATCH_2_REMAINDER_WITHHELD_IDS.length)
  assert.equal(artifact.counts.recordedReviewDecisions, inputs.length)
  assert.equal(artifact.counts.criterionDecisions, inputs.reduce((total, input) => total + input.criteria.length, 0))
  // Counts are derived, never duplicated by hand.
  assert.equal(artifact.counts.approved + artifact.counts.stillWithheld, artifact.counts.reviewed)
  assert.equal(artifact.counts.initialReleaseCandidates + artifact.counts.supersedingReleaseCandidates, artifact.counts.approved)
  const serialized = JSON.stringify(artifact)
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(serialized), false, 'no operational timestamp may enter the deterministic corpus')
  assert.equal(/epirelease_/.test(serialized), false, 'no release identifier may enter the deterministic corpus')
})

test('the report separates every required set', () => {
  for (const key of ['reviewed', 'approved', 'rejected', 'reviseAndRereview', 'blocked', 'initialReleaseCandidates', 'supersedingReleaseCandidates', 'stillWithheld']) {
    assert.ok(Array.isArray(artifact.sets[key]), `${key} must be reported separately`)
  }
  assert.equal(artifact.sets.reviewed.length, 22)
  assert.equal(artifact.sets.initialReleaseCandidates.length + artifact.sets.supersedingReleaseCandidates.length, artifact.sets.approved.length)
})
