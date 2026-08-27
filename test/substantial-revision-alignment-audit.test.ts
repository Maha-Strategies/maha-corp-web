import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, evaluatePublicationGate } from '../lib/epistemic-publication.ts'
import { releaseReadiness } from '../lib/epistemic-release.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'
import { BATCH_2_REMAINDER_APPROVED_IDS, remainderReview } from '../lib/substantial-internal-review-remainder.ts'
import { repairPacket } from '../lib/substantial-withheld-evidence-repair.ts'
import {
  AUDIT_DIMENSIONS,
  REVISION_ALIGNMENT_AUDITS,
  REVISION_AUDIT_OUTCOMES,
  auditedRecord,
  buildRereviewPackets,
  forbiddenLanguageHits,
  revisionDenialText,
  revisionAudit,
} from '../lib/substantial-revision-alignment-audit.ts'

const TOOL_DENY = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const BLANKET = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'
const byId = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const artifact = JSON.parse(readFileSync('content/substantial-pages/revision-alignment-audit-batch-2.json', 'utf8'))

test('old audit decisions cannot clear the new revision', () => {
  for (const audit of REVISION_ALIGNMENT_AUDITS) {
    const prior = alignmentFor(audit.recordId)!
    // The prior audit judged the SUPERSEDED revision and is retained unedited.
    assert.equal(prior.evidence.subjectAligned, 'supported')
    assert.equal(isAlignmentClear(audit.recordId), true)
    // But it was recorded at abstract-only depth against a different revision,
    // so it says nothing about the audited one.
    assert.equal(prior.evidence.inspectionDepth, 'abstract-only')
    assert.notEqual(audit.auditedRevision, audit.supersededRevision)
    assert.equal(audit.evidence.inspectionDepth, 'specified-sections')
    // The new audit stands on its own inspection, not on the old clearance.
    assert.equal(audit.evidence.sourceContentInspected, true)
  }
})

test('old review decisions cannot authorize the new revision', () => {
  for (const audit of REVISION_ALIGNMENT_AUDITS) {
    const record = auditedRecord(audit.recordId)
    const readiness = releaseReadiness(
      { recordId: audit.recordId, targetSha256: epistemicReviewTargetHash(record), candidateSnapshot: record },
      [],
      new Date('2026-08-27T00:00:00Z'),
    )
    assert.equal(readiness.ready, false)
    assert.equal(readiness.approvals.length, 0)
    // A decision aimed at the superseded or the PR #241 revision cannot be retargeted.
    for (const stale of [audit.supersededRevision, audit.proposedRevision]) {
      if (stale === audit.auditedRevision) continue
      assert.throws(
        () => releaseReadiness({ recordId: audit.recordId, targetSha256: stale, candidateSnapshot: record }, []),
        /does not match its record or digest/,
      )
    }
    // The record is still withheld by the standing internal review.
    assert.notEqual(remainderReview(audit.recordId)!.disposition, 'approved')
  }
})

test('a changed title or slug changes the revision digest', () => {
  const audit = revisionAudit(TOOL_DENY)!
  assert.equal(Object.keys(audit.correction).length > 0, true)
  assert.equal(audit.correction.title, 'Human denial control for tool invocations')
  assert.equal(audit.correction.slug, 'agentic-systems-mcp-human-denial-control-for-tool-invocations')
  // Renaming moved the digest away from the PR #241 proposal.
  assert.notEqual(audit.auditedRevision, audit.proposedRevision)
  assert.notEqual(audit.auditedRevision, audit.supersededRevision)
  // And the canonical path moves with the slug and kind.
  const record = auditedRecord(TOOL_DENY)
  assert.equal(audit.auditedCanonicalPath, epistemicRecordPath(record))
  assert.match(audit.auditedCanonicalPath, /\/concepts\/agentic-systems-mcp-human-denial-control-for-tool-invocations$/)
  assert.notEqual(audit.auditedCanonicalPath, epistemicRecordPath(byId.get(TOOL_DENY)!))
  // A title-only change still moves the digest.
  const renamed = { ...record, title: 'Something else entirely' }
  assert.notEqual(epistemicReviewTargetHash(renamed), audit.auditedRevision)
})

test('the MCP record fails if deny-by-default, MUST, or protocol-enforced language returns', () => {
  const record = auditedRecord(TOOL_DENY)
  assert.deepEqual([...forbiddenLanguageHits(TOOL_DENY, record)], [])
  for (const regression of [
    { title: 'Tool deny by default' },
    { description: 'Tools are denied by default under MCP.' },
    { claims: [{ ...record.claims[0], statement: 'MCP requires that tools be denied by default.' }] },
    { sources: [{ ...record.sources[0], establishes: 'The protocol mandates a default-deny posture.' }] },
  ]) {
    const broken = { ...record, ...regression } as typeof record
    assert.ok(forbiddenLanguageHits(TOOL_DENY, broken).length > 0, `${JSON.stringify(regression).slice(0, 60)} must be caught`)
  }
  // The claim keeps SHOULD a recommendation and never converts it to MUST.
  assert.match(record.claims[0].statement, /normative SHOULD for implementors rather than a protocol mandate/)
  assert.equal(/\bMUST\b/.test(record.claims[0].statement), false)
  assert.match(record.claims[0].statement, /does not mandate any specific user interaction model/)
})

test('the TBM record fails if demonstrated performance or commercial-readiness language appears', () => {
  const record = auditedRecord(BLANKET)
  assert.deepEqual([...forbiddenLanguageHits(BLANKET, record)], [])
  for (const regression of [
    { title: 'Demonstrated breeding in ITER blankets' },
    { description: 'A commercially ready breeding blanket.' },
    { claims: [{ ...record.claims[0], statement: 'ITER achieved a measured breeding ratio of 1.1.' }] },
    { sources: [{ ...record.sources[0], establishes: 'Materials qualification complete for power reactors.' }] },
  ]) {
    const broken = { ...record, ...regression } as typeof record
    assert.ok(forbiddenLanguageHits(BLANKET, broken).length > 0, `${JSON.stringify(regression).slice(0, 60)} must be caught`)
  }
  assert.match(record.claims[0].statement, /will be used to test/)
  assert.match(record.claims[0].statement, /further research is necessary to demonstrate/)
})

test('the forbidden-language scan reads asserting fields, never the denying ones', () => {
  // Boundaries and prohibitions exist to name what is excluded. Scanning them
  // would flag the honest disclaimer and reward deleting it.
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const record = auditedRecord(recordId)
    const denial = revisionDenialText(record)
    assert.ok(/commercial readiness|allowlist|demonstrated/i.test(denial), 'the denying fields do name the excluded claims')
    assert.deepEqual([...forbiddenLanguageHits(recordId, record)], [], 'yet the record passes, because denials are not assertions')
  }
})

test('exact locators remain mandatory', () => {
  for (const audit of REVISION_ALIGNMENT_AUDITS) {
    const record = auditedRecord(audit.recordId)
    assert.ok(record.sources[0].exactLocator.trim().length > 20)
    const dimension = audit.dimensions.find((entry) => entry.dimension === 'exact-locator-fidelity')!
    assert.notEqual(dimension.verdict, 'unsatisfied')
    // The locator names a heading that the inspected page actually carries.
    assert.ok(audit.evidence.inspectedContentLocation.length > 20)
  }
  const mcp = auditedRecord(TOOL_DENY)
  assert.match(mcp.sources[0].exactLocator, /User Interaction Model/)
  assert.match(mcp.sources[0].exactLocator, /Security Considerations/)
  const tbm = auditedRecord(BLANKET)
  assert.match(tbm.sources[0].exactLocator, /ITER Test Blanket Module \(TBM\) Program/)
})

test('metadata verification alone remains insufficient', () => {
  for (const audit of REVISION_ALIGNMENT_AUDITS) {
    assert.equal(audit.evidence.metadataVerified, true)
    // Metadata alone never produces the outcome: content inspection at section
    // depth is required, and both flags are recorded separately.
    assert.equal(audit.evidence.sourceContentInspected, true)
    assert.equal(audit.evidence.inspectionDepth, 'specified-sections')
    assert.equal(audit.evidence.independentlyReproduced, false)
    assert.equal(audit.evidence.externallyReviewed, false)
  }
})

test('neither record becomes public through this work', () => {
  for (const recordId of [TOOL_DENY, BLANKET]) {
    assert.equal(evaluatePublicationGate(byId.get(recordId)!).publicEligible, false)
    assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(recordId), false)
    assert.notEqual(remainderReview(recordId)!.disposition, 'approved')
  }
  // The audit records zero review decisions, by construction.
  assert.equal(artifact.counts.reviewDecisionsRecorded, 0)
})

test('an alignment-clear audit produces a packet but never a decision', async () => {
  const packets = await buildRereviewPackets()
  assert.equal(packets.length, 2)
  for (const packet of packets) {
    assert.equal(packet.decisionStatus, 'pending')
    const criteria = Object.values(packet.checklist).flat()
    assert.equal(criteria.length, 12)
    for (const criterion of criteria) assert.equal(criterion.status, 'pending-record-specific-review')
    assert.match(packet.boundary, /is not the internal review decision and it is not a release/i)
    // The packet binds the audited revision, not the superseded one.
    const audit = revisionAudit(packet.recordId)!
    assert.equal(packet.auditedRevision, audit.auditedRevision)
    assert.notEqual(packet.auditedRevision, audit.supersededRevision)
  }
})

test('every audit judges all eight dimensions and lands in the declared vocabulary', () => {
  assert.equal(AUDIT_DIMENSIONS.length, 8)
  for (const audit of REVISION_ALIGNMENT_AUDITS) {
    assert.equal(audit.dimensions.length, 8)
    assert.deepEqual(audit.dimensions.map((entry) => entry.dimension).sort(), [...AUDIT_DIMENSIONS].sort())
    for (const dimension of audit.dimensions) assert.ok(dimension.finding.trim().length > 60, `${dimension.dimension} needs a real finding`)
    assert.ok(REVISION_AUDIT_OUTCOMES.includes(audit.outcome))
  }
})

test('the PR #241 packets and the canonical records are untouched by this audit', () => {
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const packet = repairPacket(recordId)!
    // The repair packet still reproduces the submitted binding.
    assert.equal(packet.submitted.revisionSha256, epistemicReviewTargetHash(byId.get(recordId)!))
    // The canonical record still carries the original title, slug and kind.
    const live = byId.get(recordId)!
    if (recordId === TOOL_DENY) {
      assert.equal(live.title, 'Tool deny by default')
      assert.equal(live.recordKind, 'comparison')
    } else {
      assert.equal(live.recordKind, 'measurement')
    }
  }
})

test('the deterministic audit artifact carries no timestamp or operational identifier', () => {
  const serialized = JSON.stringify(artifact)
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(serialized), false)
  assert.equal(/epirelease_/.test(serialized), false)
  assert.equal(artifact.counts.revisionsAudited, 2)
  assert.equal(artifact.counts.rereviewPacketsGenerated, 2)
})
