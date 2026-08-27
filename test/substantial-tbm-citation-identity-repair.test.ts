import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash, evaluatePublicationGate } from '../lib/epistemic-publication.ts'
import { releaseReadiness } from '../lib/epistemic-release.ts'
import { BATCH_2_REMAINDER_APPROVED_IDS, remainderReview } from '../lib/substantial-internal-review-remainder.ts'
import { auditedRecord, revisionAudit } from '../lib/substantial-revision-alignment-audit.ts'
import { REREVIEW_DIMENSIONS, rereviewLedger } from '../lib/substantial-repaired-record-rereview.ts'
import {
  TBM_FRESH_ALIGNMENT,
  TBM_FRESH_DECISIONS,
  TBM_FRESH_LEDGER,
  TBM_IDENTITY_AFTER,
  TBM_IDENTITY_BEFORE,
  TBM_LINEAGE,
  TBM_NEW_REVISION,
  TBM_RECORD_ID,
  TBM_RELEASE_PREFLIGHT,
  TBM_SUPERSEDED_REPAIRED_REVISION,
  citationIdentityClear,
  freshDecisionsStillBind,
  tbmRepairedRecord,
  verifyCitationIdentity,
} from '../lib/substantial-tbm-citation-identity-repair.ts'

const MCP = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const artifact = JSON.parse(readFileSync('content/substantial-pages/tbm-citation-identity-repair.json', 'utf8'))
const byId = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
const digest = (value: unknown) => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`

test('[1] the old revise-again revision remains immutable', () => {
  assert.equal(revisionAudit(TBM_RECORD_ID)!.auditedRevision, TBM_SUPERSEDED_REPAIRED_REVISION)
  assert.equal(epistemicReviewTargetHash(auditedRecord(TBM_RECORD_ID)), TBM_SUPERSEDED_REPAIRED_REVISION)
  assert.notEqual(TBM_NEW_REVISION, TBM_SUPERSEDED_REPAIRED_REVISION)
})

test('[2] the old nine approve decisions cannot authorize the new digest', () => {
  const prior = rereviewLedger(TBM_RECORD_ID)!
  assert.equal(prior.verdictTotals.approve, 9)
  for (const decision of prior.decisions) {
    assert.equal(decision.revisionSha256, TBM_SUPERSEDED_REPAIRED_REVISION)
    assert.notEqual(decision.revisionSha256, TBM_NEW_REVISION)
  }
  // The new revision has its own ten decisions; none is reused.
  const priorRationales = new Set(prior.decisions.map((decision) => decision.rationale.trim()))
  for (const decision of TBM_FRESH_DECISIONS) assert.equal(priorRationales.has(decision.rationale.trim()), false)
})

test('[3] the previous source-fidelity revise decision remains visible', () => {
  const prior = rereviewLedger(TBM_RECORD_ID)!
  assert.equal(prior.state, 'revise-again')
  assert.deepEqual([...prior.blockingDimensions], ['source-fidelity'])
  const revise = prior.decisions.find((decision) => decision.dimension === 'source-fidelity')!
  assert.equal(revise.verdict, 'revise')
  assert.equal(artifact.supersededDecision.state, 'revise-again')
  assert.deepEqual(artifact.supersededDecision.blockingDimensions, ['source-fidelity'])
})

test('[4] url, stable identifier and source title resolve to one coherent identity', () => {
  assert.equal(TBM_IDENTITY_AFTER.stableIdentifier, TBM_IDENTITY_AFTER.url)
  assert.match(TBM_IDENTITY_AFTER.title.toLowerCase(), /tritium breeding/)
  assert.equal(citationIdentityClear(TBM_IDENTITY_AFTER), true)
  const record = tbmRepairedRecord()
  assert.equal(record.sources[0].url, TBM_IDENTITY_AFTER.url)
  assert.deepEqual(record.sources[0].identifiers, [{ scheme: 'url', value: TBM_IDENTITY_AFTER.url }])
  assert.equal(record.sources[0].title, TBM_IDENTITY_AFTER.title)
})

test('[5] a mismatched title, URL or identifier fails the citation gate', () => {
  assert.equal(citationIdentityClear(TBM_IDENTITY_BEFORE), false)
  const failing = verifyCitationIdentity(TBM_IDENTITY_BEFORE).filter((check) => !check.passed).map((check) => check.check)
  assert.ok(failing.includes('identifier-resolves-to-cited-document'))
  assert.ok(failing.includes('title-names-the-cited-document'))
  for (const mutation of [
    { ...TBM_IDENTITY_AFTER, stableIdentifier: 'https://www.iter.org/machine/supporting-systems' },
    { ...TBM_IDENTITY_AFTER, title: 'Supporting systems' },
    { ...TBM_IDENTITY_AFTER, url: 'https://www.iter.org/machine/blanket' },
    { ...TBM_IDENTITY_AFTER, exactLocator: 'Somewhere on the page.' },
  ]) {
    assert.equal(citationIdentityClear(mutation), false)
  }
})

test('[6] metadata verification alone cannot clear claim alignment', () => {
  assert.equal(TBM_FRESH_ALIGNMENT.metadataVerified, true)
  // Content inspection is recorded separately and is what carries the alignment.
  assert.equal(TBM_FRESH_ALIGNMENT.sourceContentInspected, true)
  assert.equal(TBM_FRESH_ALIGNMENT.inspectionDepth, 'specified-sections')
  assert.equal(TBM_FRESH_ALIGNMENT.independentlyReproduced, false)
  assert.equal(TBM_FRESH_ALIGNMENT.externallyReviewed, false)
  // The superseded identity had verified metadata too, and still failed.
  assert.equal(citationIdentityClear(TBM_IDENTITY_BEFORE), false)
})

test('[7] the exact inspected locator remains mandatory', () => {
  assert.match(TBM_IDENTITY_AFTER.exactLocator, /ITER Test Blanket Module \(TBM\) Program/)
  assert.match(tbmRepairedRecord().sources[0].exactLocator, /ITER Test Blanket Module \(TBM\) Program/)
  assert.equal(citationIdentityClear({ ...TBM_IDENTITY_AFTER, exactLocator: '' }), false)
})

test('[8] changing any source-identity field changes the revision digest', () => {
  const record = tbmRepairedRecord()
  assert.equal(freshDecisionsStillBind(record), true)
  const source = record.sources[0]
  const mutations = [
    { label: 'title', next: { ...record, sources: [{ ...source, title: 'Something else' }] } },
    { label: 'url', next: { ...record, sources: [{ ...source, url: 'https://www.iter.org/machine/blanket' }] } },
    { label: 'identifier', next: { ...record, sources: [{ ...source, identifiers: [{ scheme: 'url' as const, value: 'https://example.org' }] }] } },
    { label: 'publisher', next: { ...record, sources: [{ ...source, publisher: 'Someone else' }] } },
    { label: 'publishedAt', next: { ...record, sources: [{ ...source, publishedAt: '2020-01-01' }] } },
    { label: 'locator', next: { ...record, sources: [{ ...source, exactLocator: 'Elsewhere.' }] } },
    { label: 'rights', next: { ...record, sources: [{ ...source, rights: { ...source.rights, basis: 'public-domain' as const } }] } },
  ]
  for (const mutation of mutations) {
    assert.notEqual(epistemicReviewTargetHash(mutation.next), TBM_NEW_REVISION, `${mutation.label} must move the digest`)
    assert.equal(freshDecisionsStillBind(mutation.next), false)
  }
})

test('[9] all ten rereview dimensions are required again', () => {
  assert.equal(TBM_FRESH_DECISIONS.length, 10)
  assert.deepEqual(TBM_FRESH_DECISIONS.map((decision) => decision.dimension).sort(), [...REREVIEW_DIMENSIONS].sort())
  for (const decision of TBM_FRESH_DECISIONS) assert.equal(decision.revisionSha256, TBM_NEW_REVISION)
})

test('[10] generic or copied rationales fail validation', () => {
  const seen = new Set<string>()
  for (const decision of TBM_FRESH_DECISIONS) {
    assert.ok(decision.rationale.trim().length >= 120)
    assert.equal(seen.has(decision.rationale.trim()), false)
    seen.add(decision.rationale.trim())
    assert.ok(decision.disagreementsOrUncertainty.trim().length > 0)
  }
  assert.equal(seen.size, 10)
})

test('[11] planned testing cannot become demonstrated performance', () => {
  const record = tbmRepairedRecord()
  assert.equal(record.recordKind, 'concept')
  assert.match(record.claims[0].statement, /will be used to test/)
  assert.match(record.claims[0].statement, /further research is necessary to demonstrate/)
  const asserting = [record.title, record.description ?? '', record.claims[0].statement, record.sources[0].establishes].join(' ').toLowerCase()
  for (const forbidden of ['demonstrated breeding', 'commercially ready', 'commercial readiness', 'qualification complete', 'measured breeding', 'operational deployment']) {
    assert.equal(asserting.includes(forbidden), false, `${forbidden} must not be asserted`)
  }
  assert.match(record.claims[0].boundary, /planned test programme is not a measurement/)
})

test('[12] internal approval creates no canonical release', () => {
  assert.equal(TBM_RELEASE_PREFLIGHT.canonicalReleaseCreated, false)
  assert.equal(TBM_RELEASE_PREFLIGHT.releaseAuthorityUsed, false)
  const readiness = releaseReadiness(
    { recordId: TBM_RECORD_ID, targetSha256: TBM_NEW_REVISION, candidateSnapshot: tbmRepairedRecord() },
    [],
    new Date('2026-08-27T00:00:00Z'),
  )
  assert.equal(readiness.ready, false)
  assert.equal(readiness.approvals.length, 0)
  assert.equal(artifact.summary.canonicalReleasesCreated, 0)
})

test('[13] the MCP repaired revision is unchanged', () => {
  const mcpAudit = revisionAudit(MCP)!
  assert.equal(mcpAudit.auditedRevision, 'sha256:bc3682ef4b4613b4cff9c468953c218fb20ebad8786ab8c6cc4bbcc8dccb1a66')
  const mcpLedger = rereviewLedger(MCP)!
  assert.equal(mcpLedger.state, 'internally-approved-ready-for-release-preflight')
  assert.equal(mcpLedger.verdictTotals.approve, 10)
  assert.equal(auditedRecord(MCP).title, 'Human denial control for tool invocations')
})

test('[14] the frozen 20-record production cohort is unchanged', () => {
  assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.length, 20)
  assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(TBM_RECORD_ID), false)
  assert.equal(BATCH_2_REMAINDER_APPROVED_IDS.includes(MCP), false)
  assert.equal(TBM_RELEASE_PREFLIGHT.inFrozenRemainderCohort, false)
  assert.equal(artifact.summary.frozenRemainderCohortModified, false)
  assert.match(TBM_RELEASE_PREFLIGHT.proposedNextStep, /not created or dispatched here/)
})

test('[15] no repaired record enters public routes, sitemap, llms.txt or client bundles', () => {
  for (const recordId of [TBM_RECORD_ID, MCP]) {
    assert.equal(evaluatePublicationGate(byId.get(recordId)!).publicEligible, false)
    assert.notEqual(remainderReview(recordId)!.disposition, 'approved')
  }
})

test('[16] Batch 1, Batch 2, canary and Q-BR invariants remain unchanged', () => {
  const batch1 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-1.json', 'utf8'))
  assert.equal(batch1.pages.length, 20)
  assert.equal(batch1.pages.filter((page: { quality: { eligible: boolean } }) => page.quality.eligible).length, 20)
  const batch2 = JSON.parse(readFileSync('content/substantial-pages/publication-batch-2.json', 'utf8'))
  assert.equal(batch2.pages.length, 30)
  // Canonical records are never edited by a repair.
  assert.equal(byId.get(TBM_RECORD_ID)!.recordKind, 'measurement')
  assert.equal(byId.get(TBM_RECORD_ID)!.sources[0].url, 'https://www.iter.org/machine/supporting-systems')
})

test('the lineage records every revision and why it changed', () => {
  assert.equal(TBM_LINEAGE.length, 4)
  const digests = TBM_LINEAGE.map((entry) => entry.revisionSha256)
  assert.equal(new Set(digests).size, 4, 'every lineage entry is a distinct revision')
  assert.equal(digests.at(-1), TBM_NEW_REVISION)
  assert.ok(digests.includes(TBM_SUPERSEDED_REPAIRED_REVISION))
  for (const entry of TBM_LINEAGE) {
    assert.ok(entry.whyItChanged.length > 60)
    assert.ok(entry.standingDecision.length > 20)
  }
})

test('decision and ledger digests are tamper-evident', () => {
  for (const decision of TBM_FRESH_DECISIONS) {
    const { decisionDigest, ...unsigned } = decision
    assert.equal(decisionDigest, digest(unsigned))
    assert.notEqual(digest({ ...unsigned, verdict: 'revise' }), decisionDigest)
    assert.notEqual(digest({ ...unsigned, revisionSha256: TBM_SUPERSEDED_REPAIRED_REVISION }), decisionDigest)
  }
  const { ledgerDigest, ...unsignedLedger } = TBM_FRESH_LEDGER
  assert.equal(ledgerDigest, digest(unsignedLedger))
})

test('the rights position is recorded rather than resolved', () => {
  assert.equal(TBM_IDENTITY_AFTER.rightsBasis, 'citation-with-paraphrase', 'the closed vocabulary member is kept rather than a new one invented')
  assert.match(TBM_IDENTITY_AFTER.metadataProvenance, /personal non-commercial purposes, prohibiting derivative works/)
  const rights = TBM_FRESH_DECISIONS.find((decision) => decision.dimension === 'rights-basis')!
  assert.match(rights.rationale, /personal and non-commercial/)
  assert.match(rights.rationale, /prohibit derivative works/)
  assert.match(rights.disagreementsOrUncertainty, /rights vocabulary itself has a gap/)
  assert.match(rights.disagreementsOrUncertainty, /legal question internal editorial review does not resolve/)
  assert.match(artifact.boundary, /asserts no legal, regulatory, scientific, or commercial clearance/)
})
