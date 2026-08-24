import assert from 'node:assert/strict'
import test from 'node:test'

import { ADAPTED_EPISTEMIC_CANDIDATES } from '../lib/epistemic-adapters.ts'
import { EPISTEMIC_PHASE4_SOURCE_PACKAGES } from '../lib/epistemic-phase4-source-packages.ts'
import { EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES } from '../lib/epistemic-phase5-alignment-packages.ts'
import { epistemicReviewTargetHash, evaluatePublicationGate, sha256Canonical } from '../lib/epistemic-publication.ts'
import { buildControlledReingestionCompilation, parseControlledReingestionRequest, type FrozenReingestionTarget } from '../lib/epistemic-reingestion.ts'
import { sourceAlignmentBlockers } from '../lib/epistemic-source-alignment.ts'
import { buildSourceCompletionEvent, parseSourceCompletionEvent, sourceCompletionReasons, type SourceCompletionEvent } from '../lib/epistemic-work-queue.ts'

function compiledPhase4Target(recordId: string): FrozenReingestionTarget {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES.find((entry) => entry.record.id === recordId)!
  const sourcePackage = EPISTEMIC_PHASE4_SOURCE_PACKAGES.find((entry) => entry.recordId === recordId)!
  const record = structuredClone(candidate.record)
  for (const correction of sourcePackage.corrections) {
    if (correction.blockerCode.startsWith('source-locator-missing:')) {
      record.sources.find((source) => source.id === correction.blockerCode.slice('source-locator-missing:'.length))!.exactLocator = correction.proposedValue
    } else if (correction.blockerCode.startsWith('source-publication-date-missing:')) {
      const source = record.sources.find((entry) => entry.id === correction.blockerCode.slice('source-publication-date-missing:'.length))!
      if (correction.proposedValue.startsWith('{')) {
        source.publishedAt = ''
        source.sourceChronology = JSON.parse(correction.proposedValue)
      } else source.publishedAt = correction.proposedValue
    } else if (correction.blockerCode.startsWith('claim-evidence-not-assessed:')) {
      record.claims.find((claim) => claim.id === correction.blockerCode.slice('claim-evidence-not-assessed:'.length))!.evidenceMaturity = correction.proposedValue as 'not-applicable'
    }
  }
  const gateDecision = evaluatePublicationGate(record)
  return {
    recordId,
    sourcePublicPath: candidate.sourcePublicPath,
    candidateSha256: sha256Canonical(record),
    reviewTargetSha256: epistemicReviewTargetHash(record),
    gateDecision,
    candidateSnapshot: record,
  }
}

function alignmentWorkflow(sourcePackage: typeof EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES[number]) {
  const target = compiledPhase4Target(sourcePackage.recordId)
  assert.deepEqual(sourceAlignmentBlockers(target.candidateSnapshot), [sourcePackage.blockerCode])
  const reasons = sourceCompletionReasons(target)
  const common = {
    recordId: target.recordId,
    targetSha256: target.reviewTargetSha256,
    blockerCodes: [sourcePackage.blockerCode],
    assigneeId: null,
    assigneeName: null,
    evidence: [],
    note: 'Test one evidence-bound Phase 5 source alignment package.',
  }
  const triage = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...common, action: 'triage', idempotencyKey: `phase5-test-triage-${target.recordId}` }), [], reasons, new Date('2026-08-24T16:00:00.000Z'))
  const start = buildSourceCompletionEvent(parseSourceCompletionEvent({ ...common, action: 'start', assigneeId: 'phase5_test', assigneeName: 'Phase 5 test operator', idempotencyKey: `phase5-test-start-${target.recordId}` }), [triage], reasons, new Date('2026-08-24T16:01:00.000Z'))
  const submit = buildSourceCompletionEvent(parseSourceCompletionEvent({
    ...common,
    action: 'submit-evidence',
    assigneeId: 'phase5_test',
    assigneeName: 'Phase 5 test operator',
    evidence: [{
      blockerCode: sourcePackage.blockerCode,
      sourceUrl: sourcePackage.sourceUrl,
      exactLocator: sourcePackage.exactLocator,
      proposedValue: sourcePackage.proposedValue,
      note: sourcePackage.note,
      rightsBasis: sourcePackage.rightsBasis,
    }],
    idempotencyKey: `phase5-test-evidence-${target.recordId}`,
  }), [triage, start], reasons, new Date('2026-08-24T16:02:00.000Z'))
  const request = parseControlledReingestionRequest({
    operation: 'compile',
    recordId: target.recordId,
    baseTargetSha256: target.reviewTargetSha256,
    corrections: [{ blockerCode: sourcePackage.blockerCode, evidenceEventId: submit.eventId, proposedValue: sourcePackage.proposedValue }],
    note: 'Compile the Phase 5 alignment package into a fresh noncanonical test target.',
    idempotencyKey: `phase5-test-compile-${target.recordId}`,
  })
  return buildControlledReingestionCompilation(request, target, [triage, start, submit] as SourceCompletionEvent[], new Date('2026-08-24T16:03:00.000Z'))
}

test('Phase 5 packages resolve the two remaining Phase 4 source mismatches as noncanonical revisions', () => {
  assert.equal(EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES.length, 2)
  for (const sourcePackage of EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES) {
    const compilation = alignmentWorkflow(sourcePackage)
    assert.deepEqual(compilation.resolvedBlockerCodes, [sourcePackage.blockerCode])
    assert.ok(!compilation.remainingSourceBlockerCodes.includes(sourcePackage.blockerCode))
    assert.equal(compilation.outputRecord.publication.reviewState, 'draft')
    assert.equal(compilation.outputRecord.publication.requestedPublicPromotion, false)
    assert.deepEqual(compilation.outputRecord.publication.reviewEvents, [])
  }
})

test('implantation and annealing sources are separated while forecast calibration receives a peer-reviewed replacement', () => {
  const implant = alignmentWorkflow(EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES[0]).outputRecord
  assert.ok(implant.sources.some((source) => source.id === 'legacy-semiconductor-applied-implant'))
  assert.ok(implant.sources.some((source) => source.id === 'legacy-semiconductor-applied-thermal-processing'))
  assert.deepEqual(implant.claims[0].sourceIds, ['legacy-semiconductor-applied-implant'])
  assert.deepEqual(implant.claims[1].sourceIds, ['legacy-semiconductor-applied-thermal-processing'])

  const calibration = alignmentWorkflow(EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES[1]).outputRecord
  assert.ok(!calibration.sources.some((source) => source.id === 'legacy-mathematics-nist-statistical-handbook'))
  assert.deepEqual(calibration.claims[0].sourceIds, ['legacy-mathematics-gneiting-resin-calibration'])
})
