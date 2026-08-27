import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import {
  ITER_TBM_URL,
  TBM_CITATION_REPAIR_PACKAGE,
  TBM_CORRECTED_RECORD,
  TBM_CORRECTED_REVISION,
  TBM_FRESH_DECISIONS,
  TBM_PRIOR_REVISION,
  TBM_SOURCE_IDENTITY_VERIFICATION,
  tbmRepairStillBinds,
} from '../lib/tbm-citation-identity-repair.ts'
import { rereviewLedger } from '../lib/substantial-repaired-record-rereview.ts'

test('preserves the prior revise-again revision and creates an additive digest', () => {
  const old = rereviewLedger(TBM_CITATION_REPAIR_PACKAGE.recordId)!
  assert.equal(old.revisionSha256, TBM_PRIOR_REVISION)
  assert.equal(old.state, 'revise-again')
  assert.notEqual(TBM_CORRECTED_REVISION, TBM_PRIOR_REVISION)
  assert.equal(TBM_CITATION_REPAIR_PACKAGE.lineage.priorRevisionPreserved, true)
})

test('source title, publisher, URL and stable identifier describe one artifact', () => {
  const source = TBM_CORRECTED_RECORD.sources[0]!
  assert.equal(source.title, 'Tritium Breeding | ITER is First Fusion Device to Test')
  assert.equal(source.publisher, 'ITER Organization')
  assert.equal(source.url, ITER_TBM_URL)
  assert.deepEqual(source.identifiers, [{ scheme: 'url', value: ITER_TBM_URL }])
  assert.doesNotMatch(JSON.stringify(source), /"Supporting systems"|\/machine\/supporting-systems"/)
})

test('fails closed when a single-page URL and identifier diverge', () => {
  const forged = structuredClone(TBM_CORRECTED_RECORD)
  forged.sources[0]!.identifiers[0]!.value = 'https://www.iter.org/machine/supporting-systems'
  assert.equal(tbmRepairStillBinds(forged), false)
})

test('records only source chronology that the page exposes', () => {
  assert.equal(TBM_SOURCE_IDENTITY_VERIFICATION.publicationDate, null)
  assert.equal(TBM_SOURCE_IDENTITY_VERIFICATION.lastUpdatedDate, null)
  assert.equal(TBM_SOURCE_IDENTITY_VERIFICATION.sourceVersion, null)
  assert.equal(TBM_SOURCE_IDENTITY_VERIFICATION.archivalSnapshotPinned, false)
  assert.equal(TBM_CORRECTED_RECORD.sources[0]!.sourceChronology?.status, 'living-document')
})

test('binds every claim to the corrected source and exact inspected locator', () => {
  const source = TBM_CORRECTED_RECORD.sources[0]!
  assert.deepEqual(TBM_CORRECTED_RECORD.claims[0]!.sourceIds, [source.id])
  assert.match(source.exactLocator, /Test Blanket Module/)
  assert.equal(TBM_CITATION_REPAIR_PACKAGE.alignmentAudit.sourceContentInspected, true)
  assert.equal(TBM_CITATION_REPAIR_PACKAGE.alignmentAudit.exactLocatorVerified, true)
})

test('keeps the record a bounded concept and excludes result claims', () => {
  const text = JSON.stringify(TBM_CORRECTED_RECORD)
  assert.equal(TBM_CORRECTED_RECORD.recordKind, 'concept')
  assert.match(text, /planned Test Blanket Module programme/)
  for (const phrase of ['measured breeding ratio', 'materials qualification', 'commercial readiness']) assert.match(text, new RegExp(phrase))
  assert.doesNotMatch(TBM_CORRECTED_RECORD.claims[0]!.statement, /achieved|demonstrated|qualified|commercially ready/i)
})

test('fresh alignment audit judges all eight dimensions on the new digest', () => {
  const audit = TBM_CITATION_REPAIR_PACKAGE.alignmentAudit
  assert.equal(audit.auditedRevision, TBM_CORRECTED_REVISION)
  assert.equal(audit.dimensions.length, 8)
  assert.equal(new Set(audit.dimensions.map((d) => d.dimension)).size, 8)
  assert.equal(audit.dimensions.every((d) => d.verdict === 'satisfied'), true)
  assert.equal(audit.outcome, 'alignment-clear-ready-for-internal-rereview')
})

test('substantial page decision requires inspected claim and locator coverage', () => {
  const gate = TBM_CITATION_REPAIR_PACKAGE.substantialPageDecision
  assert.equal(gate.revisionSha256, TBM_CORRECTED_REVISION)
  assert.deepEqual(gate.evidenceCoverage, { claims: 1, claimsWithInspectedSourceAndExactLocator: 1 })
  assert.equal(gate.unsupportedMaterialIncluded, false)
  assert.equal(gate.pageEligible, true)
})

test('creates ten fresh, unique decisions bound only to the corrected revision', () => {
  assert.equal(TBM_FRESH_DECISIONS.length, 10)
  assert.equal(new Set(TBM_FRESH_DECISIONS.map((d) => d.dimension)).size, 10)
  assert.equal(new Set(TBM_FRESH_DECISIONS.map((d) => d.decisionDigest)).size, 10)
  assert.equal(TBM_FRESH_DECISIONS.every((d) => d.revisionSha256 === TBM_CORRECTED_REVISION && d.verdict === 'approve'), true)
})

test('stale or tampered records cannot reuse decisions or eligibility', () => {
  const stale = structuredClone(TBM_CORRECTED_RECORD)
  stale.sources[0]!.title = 'Supporting systems'
  assert.equal(tbmRepairStillBinds(stale), false)
  assert.notEqual(epistemicReviewTargetHash(stale), TBM_CITATION_REPAIR_PACKAGE.decisionLedger.revisionSha256)
})

test('readiness is editorial only and creates no release or production mutation', () => {
  const preflight = TBM_CITATION_REPAIR_PACKAGE.releasePreflight
  assert.equal(preflight.readyForSeparateRepairedRevisionCanary, true)
  assert.equal(preflight.canonicalReleaseCreated, false)
  assert.equal(preflight.releaseAuthorityUsed, false)
  assert.equal(preflight.productionMutation, false)
  assert.equal(preflight.inFrozenRemainderCohort, false)
})

test('generated artifact stays private and out of public projection sources', () => {
  for (const file of ['app/sitemap.ts', 'lib/llms-manifest.ts', 'lib/substantial-page-public.ts']) {
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /tbm-citation-identity-repair|TBM_CITATION_REPAIR_PACKAGE/)
  }
})
