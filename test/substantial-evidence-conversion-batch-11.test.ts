import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  BASIS_CONTRACT, EVIDENCE_BASES, FrameTransferError, assertBasisCanCarry,
  basisDigest, isExplanatoryBasis, publicStateFor, type EvidenceBasis,
} from '../lib/evidence-basis.ts'

const ledger = JSON.parse(readFileSync('content/evidence-batch-11/basis-ledger.json', 'utf8'))
const religion = JSON.parse(readFileSync('content/evidence-batch-11/religion-primary-text.json', 'utf8'))
const audit = JSON.parse(readFileSync('content/evidence-batch-9/depth-audit.json', 'utf8'))

test('every basis declares what it cannot establish', () => {
  for (const basis of EVIDENCE_BASES) {
    const contract = BASIS_CONTRACT[basis]
    assert.ok(contract.establishes.length > 0, `${basis} must say what it establishes`)
    if (basis !== 'inaccessible-or-unsupported') {
      assert.ok(contract.cannotEstablish.length > 0, `${basis} must say what it cannot establish`)
    }
  }
})

test('a primary text cannot carry a historical, empirical or theological claim', () => {
  assertBasisCanCarry('primary-textual', 'textual')
  for (const kind of ['historical', 'empirical', 'theological'] as const) {
    assert.throws(() => assertBasisCanCarry('primary-textual', kind), FrameTransferError)
  }
})

test('no basis at all carries a theological claim', () => {
  for (const basis of EVIDENCE_BASES) {
    assert.throws(() => assertBasisCanCarry(basis, 'theological'), FrameTransferError,
      `${basis} must not carry a theological claim`)
  }
})

test('first-party documentation carries only first-person claims', () => {
  assertBasisCanCarry('first-party-documentation', 'first-person')
  assert.throws(() => assertBasisCanCarry('first-party-documentation', 'empirical'), FrameTransferError)
  assert.equal(BASIS_CONTRACT['first-party-documentation'].countsAsIndependentSupport, false)
})

test('a theorem does not carry an empirical claim', () => {
  assertBasisCanCarry('formal-mathematical', 'formal')
  assert.throws(() => assertBasisCanCarry('formal-mathematical', 'empirical'), FrameTransferError)
})

test('metadata and inaccessible sources are never explanatory', () => {
  assert.equal(isExplanatoryBasis('metadata-only'), false)
  assert.equal(isExplanatoryBasis('inaccessible-or-unsupported'), false)
  for (const basis of EVIDENCE_BASES) {
    if (basis !== 'metadata-only' && basis !== 'inaccessible-or-unsupported') {
      assert.equal(isExplanatoryBasis(basis), true, `${basis} should be explanatory`)
    }
  }
})

test('textual and historical evidence get their own public state', () => {
  assert.equal(publicStateFor('primary-textual'), 'textually-source-supported')
  assert.equal(publicStateFor('secondary-historical-scholarship'), 'textually-source-supported')
  assert.notEqual(publicStateFor('primary-textual'), publicStateFor('independent-scientific-or-technical'))
})

test('the basis ledger is derived, and moves no page between states', () => {
  assert.equal(ledger.assignments.length, 15)
  assert.equal(ledger.migrationSafety.pagesChangingState, 0)
  assert.equal(ledger.writtenToProduction, false)
  for (const a of ledger.assignments as { sourceId: string; basis: EvidenceBasis; because: string; publicState: string; countsAsIndependentSupport: boolean }[]) {
    assert.ok(EVIDENCE_BASES.includes(a.basis), `${a.sourceId} has an unknown basis`)
    assert.ok(a.because.length > 40, `${a.sourceId} must say why, not just what`)
    assert.equal(a.publicState, publicStateFor(a.basis))
    assert.equal(a.countsAsIndependentSupport, BASIS_CONTRACT[a.basis].countsAsIndependentSupport)
  }
})

test('the single independence label was hiding three distinct bases', () => {
  const independent = ledger.assignments.filter((a: { countsAsIndependentSupport: boolean }) => a.countsAsIndependentSupport)
  const bases = new Set(independent.map((a: { basis: string }) => a.basis))
  assert.ok(bases.size >= 3, 'expected at least three bases under the old single label')
  assert.ok(bases.has('formal-mathematical'))
  assert.ok(bases.has('government-or-standards-authority'))
})

test('the vendor sources are classified as first-party, not independent', () => {
  const vendors = ledger.assignments.filter((a: { sourceId: string }) =>
    ['asml-lithography', 'tel-process-equipment', 'amkor-3d-stack'].includes(a.sourceId))
  assert.equal(vendors.length, 3)
  for (const v of vendors) assert.equal(v.basis, 'first-party-documentation')
})

test('basis digests separate a basis from a locator', () => {
  assert.notEqual(basisDigest('primary-textual', 'Genesis 1:1'), basisDigest('secondary-historical-scholarship', 'Genesis 1:1'))
  assert.equal(basisDigest('primary-textual', 'Genesis 1:1'), basisDigest('primary-textual', 'Genesis 1:1'))
})

test('the religion pilot records real divergences between two named editions', () => {
  const c = religion.textualComparison
  assert.equal(c.divergences.length, 3)
  for (const d of c.divergences) {
    assert.notEqual(d.douayRheims, d.kingJames, `${d.locator} must actually differ`)
    assert.ok(d.doesNotEstablish.length > 20, `${d.locator} must state its limit`)
  }
  for (const s of religion.inspected) {
    assert.ok(s.translator.length > 0)
    assert.ok(s.edition.length > 0)
    assert.ok(/public domain/i.test(s.rightsBasis))
  }
})

test('the religion pilot reports one page, not six', () => {
  assert.equal(religion.pilotOutcome.cohortSize, 6)
  assert.equal(religion.pilotOutcome.pagesNowTextuallySupported, 1)
  assert.equal(religion.pilotOutcome.uninspectedRoutes.length, 5)
  assert.ok(religion.refusedCertifications.length >= 4)
  assert.equal(religion.cohortUnchanged, true)
})

test('the depth audit still enumerates every page behind its denominator', () => {
  assert.equal(audit.totalAudited, 167)
  assert.equal(audit.verdicts.length, 167)
  assert.equal(audit.denominatorEqualsCorpus, true)
  const sum = Object.values(audit.depthDistribution as Record<string, number>).reduce((a, b) => a + b, 0)
  assert.equal(sum, 167)
})

test('substantial pages meet every floor, not most of them', () => {
  for (const v of audit.verdicts.filter((x: { state: string }) => x.state === 'substantial-and-evidence-backed')) {
    const m = v.measures
    assert.ok(m.directAnswerChars >= 120, `${v.route} answer too short`)
    assert.ok(m.hasMechanismOrDerivation, `${v.route} has no mechanism`)
    assert.ok(m.explanatoryClaims >= 3, `${v.route} has too few claims`)
    assert.ok(m.limitations >= 1, `${v.route} states no limitation`)
    assert.ok(m.typedRelatedRecords + m.typedBridges >= 2, `${v.route} has too few typed links`)
    assert.ok(m.renderedDimensions >= 6, `${v.route} renders too few dimensions`)
  }
})

test('typed links point at routes that exist', () => {
  const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
  const routes = new Set(compiled.pages.map((p: { route: string }) => p.route))
  let checked = 0
  for (const page of compiled.pages) {
    for (const related of page.after?.relatedRoutes ?? []) {
      checked += 1
      assert.ok(routes.has(related), `${page.route} links to ${related}, which does not exist`)
    }
  }
  assert.ok(checked > 0, 'expected at least some typed links to check')
})

test('a page never lists itself as a related record', () => {
  const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
  for (const page of compiled.pages) {
    assert.ok(!(page.after?.relatedRoutes ?? []).includes(page.route), `${page.route} links to itself`)
  }
})
