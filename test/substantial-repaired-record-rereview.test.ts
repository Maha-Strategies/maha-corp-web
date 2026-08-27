import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash, evaluatePublicationGate } from '../lib/epistemic-publication.ts'
import { releaseReadiness } from '../lib/epistemic-release.ts'
import { BATCH_2_REMAINDER_APPROVED_IDS, remainderReview } from '../lib/substantial-internal-review-remainder.ts'
import { auditedRecord, revisionAudit } from '../lib/substantial-revision-alignment-audit.ts'
import {
  REPAIRED_REREVIEW_CHECKLIST_VERSION,
  REPAIRED_REREVIEW_LEDGERS,
  REREVIEW_DIMENSIONS,
  REREVIEW_STATES,
  decisionsStillBind,
  releasePreflightReports,
  rereviewLedger,
} from '../lib/substantial-repaired-record-rereview.ts'

const MCP = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const TBM = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'
const artifact = JSON.parse(readFileSync('content/substantial-pages/repaired-record-rereview-batch-2.json', 'utf8'))
const byId = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const digest = (value: unknown) => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`

test('[1] alignment-clear does not automatically create approval', () => {
  // Both audits are alignment-clear...
  for (const recordId of [MCP, TBM]) assert.equal(revisionAudit(recordId)!.outcome, 'alignment-clear-ready-for-internal-rereview')
  // ...yet only one record is internally approved. Clearance is a precondition, not a decision.
  assert.equal(rereviewLedger(MCP)!.state, 'internally-approved-ready-for-release-preflight')
  assert.equal(rereviewLedger(TBM)!.state, 'revise-again')
  assert.deepEqual([...rereviewLedger(TBM)!.blockingDimensions], ['source-fidelity'])
})

test('[2] a decision for the old digest cannot authorize the revised record', () => {
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    const audit = revisionAudit(ledger.recordId)!
    assert.equal(ledger.revisionSha256, audit.auditedRevision)
    assert.notEqual(ledger.revisionSha256, audit.supersededRevision)
    assert.notEqual(ledger.revisionSha256, audit.proposedRevision)
    // The superseded record does not satisfy the decision's revision binding.
    assert.equal(decisionsStillBind(ledger.recordId, byId.get(ledger.recordId)!), false)
    // And the audited record does.
    assert.equal(decisionsStillBind(ledger.recordId, auditedRecord(ledger.recordId)), true)
  }
})

test('[3] a decision for one repaired record cannot authorize the other', () => {
  const mcp = rereviewLedger(MCP)!
  const tbm = rereviewLedger(TBM)!
  assert.notEqual(mcp.revisionSha256, tbm.revisionSha256)
  for (const decision of mcp.decisions) assert.equal(decision.recordId, MCP)
  for (const decision of tbm.decisions) assert.equal(decision.recordId, TBM)
  // A decision carries its record id inside the digest, so swapping records breaks it.
  const { decisionDigest, ...unsigned } = mcp.decisions[0]
  assert.equal(digest(unsigned), decisionDigest, 'the decision digest recomputes as issued')
  assert.notEqual(digest({ ...unsigned, recordId: TBM }), decisionDigest, 'swapping the record id breaks the digest')
  // Cross-binding is also refused structurally.
  assert.equal(decisionsStillBind(MCP, auditedRecord(TBM)), false)
  assert.equal(decisionsStillBind(TBM, auditedRecord(MCP)), false)
})

test('[4] missing any checklist dimension blocks readiness', () => {
  assert.equal(REREVIEW_DIMENSIONS.length, 10)
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    assert.equal(ledger.decisions.length, 10)
    assert.deepEqual(ledger.decisions.map((decision) => decision.dimension).sort(), [...REREVIEW_DIMENSIONS].sort())
  }
  // A ledger missing a dimension cannot be complete, so readiness is unreachable.
  const partial = REPAIRED_REREVIEW_LEDGERS[0].decisions.slice(0, 9)
  const complete = REREVIEW_DIMENSIONS.every((dimension) => partial.some((decision) => decision.dimension === dimension))
  assert.equal(complete, false)
})

test('[5] any revise or withhold verdict blocks readiness', () => {
  const tbm = rereviewLedger(TBM)!
  assert.equal(tbm.verdictTotals.revise, 1)
  assert.notEqual(tbm.state, 'internally-approved-ready-for-release-preflight')
  // Approval requires every verdict to be an approval.
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    const approved = ledger.state === 'internally-approved-ready-for-release-preflight'
    assert.equal(approved, ledger.verdictTotals.revise === 0 && ledger.verdictTotals.withhold === 0)
  }
  assert.ok(REREVIEW_STATES.includes(rereviewLedger(MCP)!.state))
})

test('[6] generic or duplicated rationales fail validation', () => {
  const seen = new Set<string>()
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    for (const decision of ledger.decisions) {
      assert.ok(decision.rationale.trim().length >= 120, `${decision.dimension} rationale must be dimension-specific`)
      assert.equal(seen.has(decision.rationale.trim()), false, 'no rationale may be reused')
      seen.add(decision.rationale.trim())
      assert.ok(decision.disagreementsOrUncertainty.trim().length > 0)
    }
  }
  assert.equal(seen.size, 20)
})

test('[7] a reviewer cannot claim external or expert review', () => {
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    for (const decision of ledger.decisions) {
      assert.equal(decision.reviewerKind, 'internal-editorial')
      assert.match(decision.notExternalReview, /not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification/)
      assert.equal(decision.checklistVersion, REPAIRED_REREVIEW_CHECKLIST_VERSION)
      assert.ok(decision.reviewerRole.length > 10)
    }
  }
  assert.match(artifact.boundary, /AI-assisted internal editorial review performed by the publisher/)
})

test('[8] changed title, claim, source, locator, scope, or prohibited inference invalidates the decision', () => {
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    const record = auditedRecord(ledger.recordId)
    assert.equal(decisionsStillBind(ledger.recordId, record), true)
    const mutations = [
      { label: 'title', next: { ...record, title: 'Changed title' } },
      { label: 'slug', next: { ...record, slug: 'changed-slug' } },
      { label: 'claim', next: { ...record, claims: [{ ...record.claims[0], statement: 'A different claim entirely.' }] } },
      { label: 'scope', next: { ...record, claims: [{ ...record.claims[0], scope: 'A wider scope.' }] } },
      { label: 'source url', next: { ...record, sources: [{ ...record.sources[0], url: 'https://example.org/other' }] } },
      { label: 'locator', next: { ...record, sources: [{ ...record.sources[0], exactLocator: 'Somewhere else.' }] } },
      { label: 'prohibited inference', next: { ...record, prohibitedInferences: record.prohibitedInferences.slice(0, 1) } },
    ]
    for (const mutation of mutations) {
      assert.equal(decisionsStillBind(ledger.recordId, mutation.next), false, `${mutation.label} change must invalidate the decision`)
      assert.notEqual(epistemicReviewTargetHash(mutation.next), ledger.revisionSha256)
    }
  }
})

test('[9] approval does not itself create a canonical release', () => {
  for (const report of releasePreflightReports()) {
    assert.equal(report.canonicalReleaseCreated, false)
    assert.equal(report.releaseAuthorityUsed, false)
    const record = auditedRecord(report.recordId)
    // Even the internally approved record is not release-ready: no scoped release
    // decisions exist, and internal editorial approval is not one.
    const readiness = releaseReadiness(
      { recordId: report.recordId, targetSha256: epistemicReviewTargetHash(record), candidateSnapshot: record },
      [],
      new Date('2026-08-27T00:00:00Z'),
    )
    assert.equal(readiness.ready, false)
    assert.equal(readiness.approvals.length, 0)
  }
  assert.equal(artifact.summary.canonicalReleasesCreated, 0)
  assert.equal(artifact.summary.releaseAuthorityUsed, false)
})

test('[10] neither record enters sitemap, llms.txt, public routes or served bundles', () => {
  for (const recordId of [MCP, TBM]) {
    assert.equal(evaluatePublicationGate(byId.get(recordId)!).publicEligible, false)
    assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(recordId), false)
    assert.notEqual(remainderReview(recordId)!.disposition, 'approved')
  }
})

test('[11] Batch 1, Batch 2, canary and Q-BR invariants are untouched by this review', () => {
  const batch1 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-1.json', 'utf8'))
  assert.equal(batch1.pages.length, 20)
  assert.equal(batch1.pages.filter((page: { quality: { eligible: boolean } }) => page.quality.eligible).length, 20)
  const batch2 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-2.json', 'utf8'))
  assert.equal(batch2.pages.length, 30)
  // The canonical records are not edited by a review.
  assert.equal(byId.get(MCP)!.title, 'Tool deny by default')
  assert.equal(byId.get(MCP)!.recordKind, 'comparison')
  assert.equal(byId.get(TBM)!.recordKind, 'measurement')
})

test('[12] the frozen 20-record remainder cohort is not modified', () => {
  assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.length, 20)
  for (const recordId of [MCP, TBM]) assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(recordId), false)
  for (const report of releasePreflightReports()) assert.equal(report.inFrozenRemainderCohort, false)
  assert.equal(artifact.summary.frozenRemainderCohortModified, false)
  // The approved record is proposed for a separate later canary, not added here.
  const approved = releasePreflightReports().find((report) => report.internallyApproved)!
  assert.match(approved.proposedNextStep, /separate two-record repaired-revision canary/)
  assert.match(approved.proposedNextStep, /not created or dispatched here/)
})

test('decision and ledger digests are tamper-evident', () => {
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    for (const decision of ledger.decisions) {
      const { decisionDigest, ...unsigned } = decision
      assert.equal(decisionDigest, digest(unsigned), 'a decision digest must recompute')
      // Flipping a verdict without reissuing the digest is detectable.
      assert.notEqual(digest({ ...unsigned, verdict: 'approve' === unsigned.verdict ? 'revise' : 'approve' }), decisionDigest)
      // So is rewriting a rationale.
      assert.notEqual(digest({ ...unsigned, rationale: `${unsigned.rationale} (edited)` }), decisionDigest)
    }
    const { ledgerDigest, ...unsignedLedger } = ledger
    assert.equal(ledgerDigest, digest(unsignedLedger), 'a ledger digest must recompute')
  }
})

test('record-level requirements hold for the MCP revision', () => {
  const record = auditedRecord(MCP)
  assert.match(record.claims[0].statement, /normative SHOULD for implementors rather than a protocol mandate/)
  assert.equal(/\bMUST\b/.test(record.claims[0].statement), false, 'SHOULD must not become MUST')
  assert.match(record.claims[0].statement, /does not mandate any specific user interaction model/)
  assert.match(record.title, /^Human denial control for tool invocations$/)
  const asserting = [record.title, record.slug, record.description ?? '', record.claims[0].statement, record.sources[0].establishes].join(' ').toLowerCase()
  for (const forbidden of ['deny by default', 'default-deny', 'denied by default', 'mandatory allowlist']) {
    assert.equal(asserting.includes(forbidden), false, `${forbidden} must not be asserted`)
  }
  // Honest negations remain present rather than trimmed.
  const denials = [...record.boundaries, ...record.prohibitedInferences, record.claims[0].boundary, record.sources[0].boundary].join(' ')
  assert.match(denials, /does not prescribe an organisation’s allowlist/)
  assert.match(denials, /not a protocol requirement/)
})

test('record-level requirements hold for the TBM revision', () => {
  const record = auditedRecord(TBM)
  assert.equal(record.recordKind, 'concept')
  assert.match(record.claims[0].statement, /will be used to test/)
  assert.match(record.claims[0].statement, /further research is necessary to demonstrate/)
  assert.match(record.sources[0].exactLocator, /ITER Test Blanket Module \(TBM\) Program/)
  const audit = revisionAudit(TBM)!
  assert.equal(audit.evidence.versionRelationshipVerified, false, 'the unversioned living page is disclosed')
  assert.equal(audit.evidence.archivalSnapshotPinned, false)
  const asserting = [record.title, record.description ?? '', record.claims[0].statement, record.sources[0].establishes].join(' ').toLowerCase()
  for (const forbidden of ['demonstrated breeding', 'commercially ready', 'qualification complete', 'measured breeding']) {
    assert.equal(asserting.includes(forbidden), false)
  }
})

test('the deterministic artifact carries no timestamp or operational identifier', () => {
  const serialized = JSON.stringify(artifact)
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(serialized), false)
  assert.equal(/epirelease_/.test(serialized), false)
  assert.equal(artifact.summary.revisionsReviewed, 2)
  assert.equal(artifact.summary.dimensionDecisions, 20)
  assert.equal(artifact.reviewerPackets.length, 2)
  assert.equal(artifact.ledgers.length, 2)
  assert.equal(artifact.releasePreflight.length, 2)
})
