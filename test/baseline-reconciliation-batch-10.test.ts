import assert from 'node:assert/strict'
import test from 'node:test'

import { isVendorAuthored, vendorBackedSupplierRoutes } from '../lib/uplift/vendor-authorship.ts'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { DEPTH_STATES, assertDenominatorEnumerated, auditDepth, type DepthMeasures } from '../lib/page-depth-audit.ts'
import { assertCalculable } from '../lib/deterministic-calculation.ts'
import audit from '../content/evidence-batch-9/depth-audit.json' with { type: 'json' }
import ledger from '../content/evidence-batch-10/vendor-correction-ledger.json' with { type: 'json' }
import deepening from '../content/evidence-batch-10/deepening.json' with { type: 'json' }
import religion from '../content/evidence-batch-10/religion-pilot.json' with { type: 'json' }
import calc from '../content/evidence-batch-9/calculations.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import { assertCalculationsAreReproducible, assertFirstPartyPartition } from './helpers/uplift-invariants.ts'

const ROOT = resolve(import.meta.dirname, '..')
const base: DepthMeasures = {
  directAnswerChars: 200, hasMechanismOrDerivation: true, hasTechnicalContext: true,
  explanatoryClaims: 5, claimsWithPassage: 2, exactLocators: 3, limitations: 2,
  unresolvedQuestions: 1, supportedComparisons: 0, reproducibleCalculations: 0,
  typedRelatedRecords: 3, typedBridges: 1, structuredDataFields: 9,
  renderedDimensions: 8, wordCountDiagnostic: 400,
}

test('every denominator is backed by an enumerated cohort', () => {
  assert.doesNotThrow(() => assertDenominatorEnumerated('x', 3, [1, 2, 3]))
  assert.throws(() => assertDenominatorEnumerated('depth audit', 167, [1, 2, 3]),
    /does not match the 3 records enumerated behind it/)
  // The audit itself must satisfy the invariant it introduced.
  assert.equal(audit.denominatorEqualsCorpus, true)
  assert.equal(audit.totalAudited, audit.corpusSize)
  assert.equal(audit.totalAudited, audit.corpusSize)
})

test('every page receives exactly one evidence state and one depth state', () => {
  assert.equal(audit.verdicts.length, audit.totalAudited)
  const routes = audit.verdicts.map((v) => v.route)
  assert.equal(new Set(routes).size, audit.totalAudited, 'no page may be audited twice')
  for (const verdict of audit.verdicts) {
    assert.ok((DEPTH_STATES as readonly string[]).includes(verdict.state))
  }
  assert.equal(Object.values(audit.depthDistribution).reduce((a, b) => a + b, 0), audit.totalAudited)
  const s = report.pageStates
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented
    + s.independentlySourceSupported + s.blocked, s.total)
})

test('evidence state and depth state are reported separately', () => {
  // First-party pages get their own depth pair rather than borrowing another.
  assert.ok((DEPTH_STATES as readonly string[]).includes('first-party-documented-and-substantial'))
  assert.ok((DEPTH_STATES as readonly string[]).includes('first-party-documented-but-thin'))
  const fp = auditDepth('/x', base, 'first-party')
  assert.ok(fp.state.startsWith('first-party-documented'))
  assertFirstPartyPartition(audit, report)
})

test('source-tier changes propagate automatically, with no route exclusion list', () => {
  assert.equal(ledger.mechanism.hardcodedRouteExclusions, 0)
  assert.equal(ledger.mechanism.scope, 'source-level')
  assert.match(ledger.mechanism.propagation, /without being listed anywhere/)
  // The exclusion lives at source level and propagates by derivation. Checked
  // behaviourally: an equipment page citing a vendor source is not captured by
  // the supplier derivation, and no hardcoded route list exists to consult.
  const script = execFileSync('cat', ['scripts/generate-legacy-uplift.ts'], { cwd: ROOT, encoding: 'utf8' })
  assert.ok(!/compiledRoutesFor/.test(script), 'the hardcoded source-to-route map is gone')
  assert.ok(isVendorAuthored('asml-lithography'))
  const derived = vendorBackedSupplierRoutes([
    { route: '/knowledge/suppliers/asml', sources: [{ id: 'asml-lithography' }] },
    { route: '/knowledge/equipment/scanner', sources: [{ id: 'asml-lithography' }] },
  ])
  assert.deepEqual([...derived], ['/knowledge/suppliers/asml'])
})

test('mixed-source pages classify claims individually', () => {
  assert.equal(ledger.pagesCitingVendorSources, 15)
  assert.equal(ledger.correctedToStructural, 14)
  assert.equal(ledger.retainedIndependentViaOtherSource, 1)
  const retained = ledger.pages.find((p) => !p.changed)!
  assert.ok(retained.otherSourcesCited > 0, 'it keeps status through a different source')
  assert.match(retained.reason, /Mixed-source page/)
  for (const page of ledger.pages) {
    assert.equal(page.before, 'independently-source-supported')
    assert.ok(['independently-source-supported', 'structurally-uplifted'].includes(page.after))
  }
})

test('first-party sources cannot satisfy independent support anywhere', () => {
  const corrected = ledger.pages.filter((p) => p.changed).map((p) => p.route)
  assert.equal(corrected.length, 14)
  for (const route of corrected) {
    const page = compiled.pages.find((p) => p.route === route)!
    assert.equal(page.after?.explanatorySources ?? 0, 0, `${route} must not count vendor evidence as independent`)
  }
})

test('thinness cannot be hidden by repeating one supported claim', () => {
  assert.equal(deepening.summary.remainThinBecauseEvidenceIsNarrow, 11)
  for (const entry of deepening.remainThin) {
    assert.ok(String(entry.reason).length > 60)
  }
  const restating = deepening.remainThin.find((r) => /restating it/.test(String(r.reason)))
  assert.ok(restating, 'at least one page must be left thin rather than restated')
  assert.match(deepening.rule, /Restating the same narrow passage in more words is refused/)
})

test('new paragraphs require passages that were actually read', () => {
  assert.equal(deepening.summary.sourcesReopened, 0)
  for (const entry of deepening.deepened) {
    for (const passage of entry.additionalPassages) {
      assert.ok(passage.supportingPassage.length > 120)
      assert.ok(passage.locator.length > 4)
      assert.ok(passage.limitationsCarried.length > 40, 'limits travel with the new passage')
    }
    assert.match(entry.passageOrigin, /already inspected/)
  }
  assert.equal(deepening.summary.paragraphsRefused, 3)
})

test('primary textual evidence cannot become historical or empirical proof', () => {
  const frames = religion.evidentiaryFrames
  assert.match(frames.textual, /establishes this and only this/)
  assert.match(frames.transferRule, /historical evidence of nothing/)
  assert.match(frames.empirical, /Requires a study/)
  assert.match(frames['first-person'], /establishes the report rather than its content/)
})

test('the religion pilot is frozen and reports an honest zero', () => {
  assert.equal(religion.frozenBeforeInspection, true)
  assert.equal(religion.cohortSize, 6)
  assert.equal(religion.cohort.length, 6)
  assert.equal(religion.outcome.sourcesInspected, 0)
  assert.equal(religion.outcome.pagesConverted, 0)
  assert.deepEqual(religion.inspected, [])
  assert.match(religion.outcome.reason, /would misstate it/)
})

test('calculations fail without complete inputs and assumptions', () => {
  assert.throws(() => assertCalculable({ inputs: [] }), /missing/)
  assert.equal(calc.emitted, 1)
  assert.equal(calc.refused.length, 4)
})

test('unsupported passages remain absent', () => {
  assertCalculationsAreReproducible(report, compiled)
  assert.equal(report.informationValue.wordCountUsed, false)
  assert.equal(audit.wordCountUsedAsGate, false)
})

test('private audit data remains outside served bundles', () => {
  const leaked = execFileSync('bash', ['-lc',
    "find .next/server .next/static -type f \\( -name '*.js' -o -name '*.html' \\) -print0 2>/dev/null | xargs -0 grep -l 'depth-audit\\|vendor-correction-ledger\\|supportingPassage\\|paragraphsRefused' 2>/dev/null || true"],
  { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(leaked, '')
})
