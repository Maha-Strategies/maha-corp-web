import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, evaluatePublicationGate } from '../lib/epistemic-publication.ts'
import { releaseReadiness } from '../lib/epistemic-release.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'
import { SUBSTANTIAL_BATCH_2_PAGES } from '../lib/substantial-page-publication-batch-2.ts'
import { BATCH_2_REMAINDER_APPROVED_IDS, BATCH_2_REMAINDER_WITHHELD_IDS, remainderReview } from '../lib/substantial-internal-review-remainder.ts'
import {
  EVIDENCE_FORCE,
  REPAIR_DISPOSITIONS,
  WITHHELD_REPAIR_PACKETS,
  candidateRecord,
  repairPacket,
} from '../lib/substantial-withheld-evidence-repair.ts'

const TOOL_DENY = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const BLANKET = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'
const artifact = JSON.parse(readFileSync('content/substantial-pages/withheld-evidence-repair-batch-2.json', 'utf8'))
const byId = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))

test('[1] the original revisions remain withheld and untouched', () => {
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const review = remainderReview(recordId)!
    assert.notEqual(review.disposition, 'approved', 'the submitted revision stays withheld')
    assert.ok(BATCH_2_REMAINDER_WITHHELD_IDS.includes(recordId))
    assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(recordId), false)
    // The canonical record is byte-for-byte what the packet reproduces as submitted.
    const packet = repairPacket(recordId)!
    assert.equal(packet.submitted.revisionSha256, epistemicReviewTargetHash(byId.get(recordId)!))
    assert.equal(packet.submitted.sourceUrl, byId.get(recordId)!.sources[0].url)
    assert.equal(packet.submitted.claimStatement, byId.get(recordId)!.claims[0].statement)
  }
})

test('[2] a replacement source cannot silently overwrite the submitted source', () => {
  const packet = repairPacket(BLANKET)!
  const live = byId.get(BLANKET)!
  // The proposal names a different page...
  assert.notEqual(packet.proposedRevision!.sourceUrl, packet.submitted.sourceUrl)
  // ...but the canonical record still binds the submitted one.
  assert.equal(live.sources[0].url, packet.submitted.sourceUrl)
  assert.equal(live.sources[0].exactLocator, packet.submitted.exactLocator)
  // And the packet reproduces the submitted binding unchanged alongside the proposal.
  assert.equal(packet.submitted.sourceUrl, 'https://www.iter.org/machine/supporting-systems')
  assert.equal(packet.recommendedDisposition, 'replace-source-pending-review')
})

test('[3] metadata-only verification cannot clear either record', () => {
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const audit = alignmentFor(recordId)!
    // Metadata was verified for both, yet both remain withheld by internal review.
    assert.equal(audit.evidence.metadataVerified, true)
    assert.notEqual(remainderReview(recordId)!.disposition, 'approved')
    // And every inspected passage in the repair carries a locator, not merely an identifier.
    for (const passage of repairPacket(recordId)!.inspectedPassages) {
      assert.ok(passage.exactLocator.trim().length > 0)
      assert.notEqual(passage.inspectionDepth, 'abstract-only', 'a repair may not rest on abstract-only depth')
    }
  }
})

test('[4] a source without an exact locator cannot clear either record', () => {
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const packet = repairPacket(recordId)!
    assert.ok(packet.proposedRevision!.sourceExactLocator.trim().length > 0)
    // A candidate whose locator is stripped fails the substantial gate's locator rule.
    const stripped = candidateRecord(recordId, { ...packet.proposedRevision!, sourceExactLocator: '' })
    assert.equal(stripped.sources[0].exactLocator, '')
    const page = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === recordId)!
    // The published gate reason vocabulary includes the locator rule, so an empty
    // locator is a declared failure rather than a silently accepted blank.
    assert.ok(page.quality.dimensions.length > 0)
    assert.equal(stripped.sources.some((source) => !source.exactLocator), true)
  }
})

test('[5] general security guidance cannot be labelled an MCP protocol requirement', () => {
  const packet = repairPacket(TOOL_DENY)!
  const index = packet.inspectedPassages.find((passage) => passage.exactLocator.includes('Security and Trust & Safety'))!
  // The index principle is recorded as a general security principle, on a lowercase must.
  assert.equal(index.force, 'general-security-principle')
  assert.equal(index.normativeKeyword, 'lowercase-must')
  // The human-in-the-loop language is a recommendation, not a mandate.
  const warning = packet.inspectedPassages.find((passage) => passage.exactLocator.includes('User Interaction Model" warning'))!
  assert.equal(warning.force, 'implementation-recommendation')
  assert.equal(warning.normativeKeyword, 'SHOULD')
  // The proposed claim says so in terms, and forecloses the mandate reading.
  assert.match(packet.proposedRevision!.claimStatement, /normative SHOULD for implementors rather than a protocol mandate/)
  assert.match(packet.proposedRevision!.claimStatement, /does not mandate any specific user interaction model/)
  assert.ok(packet.prohibitedInferences.some((item) => /general least-privilege or zero-trust principle as something the Model Context Protocol mandates/.test(item)))
  assert.ok(packet.proposedRevision!.unsupportedExtensions.some((item) => /MCP requires tools to be denied by default/.test(item)))
  // The vocabulary itself keeps the four forces distinct.
  assert.deepEqual([...EVIDENCE_FORCE], ['protocol-requirement', 'implementation-recommendation', 'general-security-principle', 'maha-authored-synthesis'])
})

test('[6] planned ITER testing cannot be labelled demonstrated commercial performance', () => {
  const packet = repairPacket(BLANKET)!
  assert.match(packet.proposedRevision!.claimStatement, /will be used to test/)
  assert.match(packet.proposedRevision!.claimStatement, /further research is necessary to demonstrate/)
  assert.match(packet.proposedRevision!.claimBoundary, /planned test programme is not a measurement/)
  for (const forbidden of [/demonstrated tritium breeding or self-sufficiency/, /breeding ratio/, /materials qualification/, /commercial blanket readiness/]) {
    assert.ok(packet.prohibitedInferences.some((item) => forbidden.test(item)), `${forbidden} must be prohibited`)
  }
  // The claimed subjects are separated rather than pooled.
  assert.equal(packet.proposedRevision!.recordKind, 'concept', 'a planned programme is not a measurement')
  assert.notEqual(packet.proposedRevision!.recordKind, byId.get(BLANKET)!.recordKind)
})

test('[7] any proposed revision receives a new revision digest', () => {
  for (const packet of WITHHELD_REPAIR_PACKETS) {
    assert.ok(packet.proposedRevision, 'both records carry a proposal')
    assert.equal(packet.revisionDigests.changed, true)
    assert.notEqual(packet.revisionDigests.after, packet.revisionDigests.before)
    const recomputed = epistemicReviewTargetHash(candidateRecord(packet.recordId, packet.proposedRevision!))
    assert.equal(packet.revisionDigests.after, recomputed, 'the after digest must be recomputable')
    assert.equal(packet.revisionDigests.before, epistemicReviewTargetHash(byId.get(packet.recordId)!))
  }
})

test('[8] existing release decisions cannot authorize the new revision', () => {
  for (const packet of WITHHELD_REPAIR_PACKETS) {
    const candidate = candidateRecord(packet.recordId, packet.proposedRevision!)
    // No scoped decisions exist for either revision, old or new.
    const readiness = releaseReadiness(
      { recordId: packet.recordId, targetSha256: epistemicReviewTargetHash(candidate), candidateSnapshot: candidate },
      [],
      new Date('2026-08-27T00:00:00Z'),
    )
    assert.equal(readiness.ready, false)
    assert.equal(readiness.approvals.length, 0)
    // A decision aimed at the submitted revision cannot be pointed at the new one.
    assert.throws(
      () => releaseReadiness({ recordId: packet.recordId, targetSha256: packet.revisionDigests.before, candidateSnapshot: candidate }, []),
      /does not match its record or digest/,
    )
  }
})

test('[9] neither record reaches sitemap or llms.txt through this work', () => {
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const page = SUBSTANTIAL_BATCH_2_PAGES.find((entry) => entry.contract.recordId === recordId)!
    // The substantial prose exists but the record is not in the approved release set,
    // so nothing here can place it in a public projection.
    assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(recordId), false)
    assert.ok(epistemicRecordPath(byId.get(recordId)!).startsWith('/knowledge/'))
    // The publication gate still refuses the record outright.
    assert.equal(evaluatePublicationGate(byId.get(recordId)!).publicEligible, false)
    assert.ok(page.quality.eligible, 'the page compiles, which is precisely why the release gate must be the thing that holds')
  }
})

test('[10] no production mutation or release-authority token is used', () => {
  const sources = [
    readFileSync('lib/substantial-withheld-evidence-repair.ts', 'utf8'),
    readFileSync('scripts/generate-withheld-evidence-repair.ts', 'utf8'),
  ].join('\n')
  for (const forbidden of ['EPISTEMIC_RELEASE_AUTHORITY_TOKEN', 'EPISTEMIC_OPERATIONS_TOKEN', 'fetch(', 'epistemic-releases', 'epistemic-reviews', 'authority_']) {
    assert.equal(sources.includes(forbidden), false, `${forbidden} must not appear in repair code`)
  }
})

test('the repair is additive: no canonical record or decision history is edited', () => {
  // The alignment audit entries the repair disagrees with are still present verbatim.
  for (const recordId of [TOOL_DENY, BLANKET]) {
    const audit = alignmentFor(recordId)!
    assert.equal(audit.evidence.subjectAligned, 'supported', 'the prior audit judgement is retained, not rewritten')
    assert.equal(isAlignmentClear(recordId), true, 'the prior clearance is retained; the repair records disagreement instead')
    const packet = repairPacket(recordId)!
    assert.ok(packet.disagreements.some((item) => /retained; neither is edited/.test(item)))
  }
  // The internal-review blockers are unchanged.
  assert.deepEqual([...remainderReview(TOOL_DENY)!.blockers].sort(), ['claim-not-supported-by-cited-source', 'comparison-kind-without-comparative-evidence', 'source-boundary-contradicts-claim'])
  assert.deepEqual([...remainderReview(BLANKET)!.blockers].sort(), ['locator-does-not-name-claimed-subject', 'measurement-kind-without-measured-quantity'])
})

test('a repair never presents itself as approval, validation, or publication', () => {
  for (const packet of WITHHELD_REPAIR_PACKETS) {
    assert.ok(REPAIR_DISPOSITIONS.includes(packet.recommendedDisposition))
    assert.notEqual(packet.recommendedDisposition, 'evidence-ready-for-internal-rereview', 'neither record reached readiness in this pass')
    assert.match(packet.assuranceStatement, /not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification/)
    assert.match(packet.assuranceStatement, /is not approval, validation, or publication/)
  }
})

test('the deterministic artifact carries no timestamp or operational identifier', () => {
  const serialized = JSON.stringify(artifact)
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(serialized), false)
  assert.equal(/epirelease_/.test(serialized), false)
  assert.equal(artifact.counts.records, 2)
  assert.equal(artifact.counts.withProposedRevision, 2)
  assert.equal(artifact.counts.inspectedPassages, 6)
})

test('every inspected passage declares force, depth and version relationship', () => {
  for (const packet of WITHHELD_REPAIR_PACKETS) {
    for (const passage of packet.inspectedPassages) {
      assert.ok(EVIDENCE_FORCE.includes(passage.force))
      assert.ok(passage.versionRelationship.trim().length > 20)
      assert.ok(passage.reading.trim().length > 40)
      assert.ok(passage.sourceUrl.startsWith('https://'))
    }
  }
})
