import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { SUBSTANTIAL_SCALE_REVIEW_PACKETS } from '../lib/substantial-scale-internal-review.ts'

test('all 64 substantial-scale targets carry their exact inspected review attestation', () => {
  const batch = buildEpistemicIngestionBatch({
    adapterId: 'substantial-scale-release',
    idempotencyKey: 'test-substantial-scale-inspected-targets',
  }, new Date('2026-08-30T00:00:00.000Z'))

  assert.equal(batch.records.length, 64)
  for (const record of batch.records) {
    const packet = SUBSTANTIAL_SCALE_REVIEW_PACKETS.find((entry) => entry.recordId === record.candidateRecordId)
    assert.ok(packet)
    assert.equal(record.reviewTargetSha256, packet.targetSha256)
    assert.equal(record.alignmentDecision.contentInspectionState, 'internally-inspected-substantial-scale')
    assert.equal(record.alignmentDecision.inspectionAttestationSha256, packet.packetDigest)
    assert.equal(record.alignmentDecision.explanatoryEligible, true)
    assert.equal(record.alignmentDecision.canonicalEligible, true)
    assert.deepEqual(record.alignmentDecision.blockerCodes, [])
    assert.equal(record.gateDecision.reasons.some((reason) => reason.startsWith('source-content-inspection-missing:')), false)
  }
})

test('the runner writes a new request lineage rather than replaying the blocked envelope', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../scripts/run-substantial-scale-release.ts', import.meta.url), 'utf8'))
  assert.match(source, /substantial-scale-inspected-targets:/)
  assert.doesNotMatch(source, /idempotencyKey: `substantial-scale-targets:/)
})
