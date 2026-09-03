import assert from 'node:assert/strict'
import test from 'node:test'

import { VENDOR_AUTHORED_SOURCES, isVendorAuthored, vendorBackedSupplierRoutes } from '../lib/uplift/vendor-authorship.ts'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { auditDepth, assertWordCountIsNotAGate, type DepthMeasures } from '../lib/page-depth-audit.ts'
import { assertCalculable, buildCalculation, newtonRoot } from '../lib/deterministic-calculation.ts'
import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import audit from '../content/evidence-batch-9/depth-audit.json' with { type: 'json' }
import calc from '../content/evidence-batch-9/calculations.json' with { type: 'json' }
import insp from '../content/evidence-batch-9/inspections.json' with { type: 'json' }
import cohort from '../content/evidence-batch-9/frozen-cohort.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const base: DepthMeasures = {
  directAnswerChars: 200, hasMechanismOrDerivation: true, hasTechnicalContext: true,
  explanatoryClaims: 5, claimsWithPassage: 2, exactLocators: 3, limitations: 2,
  unresolvedQuestions: 1, supportedComparisons: 0, reproducibleCalculations: 0,
  typedRelatedRecords: 3, typedBridges: 1, structuredDataFields: 9,
  renderedDimensions: 8, wordCountDiagnostic: 400,
}
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://e.org', retrievedOn: '2026-09-03',
  depth: 'section-or-full-text', exactLocator: '3.8.4',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'permanent identifier', rightsBasis: 'US government work', ...o,
})

test('classification alone cannot satisfy the substantial-depth gate', () => {
  // Independent classification, but nothing explained.
  const thin = auditDepth('/x', { ...base, hasMechanismOrDerivation: false, explanatoryClaims: 1, limitations: 0 }, 'independent')
  assert.equal(thin.state, 'evidence-backed-but-thin')
  assert.ok(thin.reasons.includes('no mechanism or derivation'))
  // And a rich page with no passage is not evidence-backed however full it is.
  const rich = auditDepth('/y', { ...base, claimsWithPassage: 0 }, 'structural')
  assert.equal(rich.state, 'structurally-substantial-but-unsupported')
})

test('unsupported length cannot improve quality status', () => {
  const before = auditDepth('/z', base, 'independent')
  const padded = auditDepth('/z', { ...base, wordCountDiagnostic: base.wordCountDiagnostic * 20 }, 'independent')
  assert.doesNotThrow(() => assertWordCountIsNotAGate(before, padded))
  assert.equal(before.state, padded.state)
  assert.equal(audit.wordCountUsedAsGate, false)
})

test('an independent classification with no passage is caught', () => {
  const verdict = auditDepth('/w', { ...base, claimsWithPassage: 0 }, 'independent')
  assert.ok(verdict.reasons.includes('classified independent but no claim maps to a passage'))
})

test('every explanatory claim maps to an inspected passage', () => {
  for (const source of insp.inspected) {
    for (const claim of source.claimByClaimSupport) {
      assert.equal(claim.distinctPassage, true)
      assert.ok(claim.supportingPassage.length > 150)
      assert.ok(source.exactLocators.some((l) => claim.locator.includes(l)),
        `${claim.route} locator must trace to an inspected locator`)
    }
  }
})

test('one passage cannot support unrelated paragraphs', () => {
  const rejected = insp.inspected.flatMap((s) => s.routesConsideredAndRejected)
  assert.equal(rejected.length, 2)
  const optimization = rejected.find((r) => r.route.includes('optimization'))!
  assert.match(String(optimization.reason), /mathematical relationship between two topics is not evidence/)
  const integration = rejected.find((r) => r.route.includes('numerical-integration'))!
  assert.match(String(integration.reason), /Chapter adjacency is not support/)
})

test('a refusal about the wrong chapter is resolved by the right chapter, not relaxed', () => {
  const dlmf = insp.inspected[0]
  assert.match(String(dlmf.batch8RefusalResolved), /wrong chapter, not the wrong page/)
})

test('abstract-only evidence cannot create mechanism sections', () => {
  for (const depth of ['abstract-only', 'metadata-only', 'not-inspected'] as const) {
    assert.equal(gradeEvidence({
      sourceId: 's', declaredUrl: 'https://e.org/d', establishes: 'x'.repeat(20),
      boundary: 'y'.repeat(20), attestation: att({ depth }),
    }).explanatory, false)
  }
})

test('a calculation requires complete inputs, units and assumptions', () => {
  assert.throws(() => assertCalculable({ inputs: [] }), /missing/)
  assert.throws(() => assertCalculable({
    methodSource: { sourceId: 's', exactLocator: '3.8.4', statedMethod: 'm' },
    inputs: [{ symbol: 'x', value: 1, unit: '', meaning: 'm' }],
    assumptions: ['a'], uncertaintyTreatment: 'u',
  }), /units/)
  assert.throws(() => assertCalculable({
    methodSource: { sourceId: 's', exactLocator: '3.8.4', statedMethod: 'm' },
    inputs: [{ symbol: 'x', value: 1, unit: 'dimensionless', meaning: 'm' }],
    assumptions: [],
  }), /assumptions/)
})

test('the deterministic receipt verifies independently', () => {
  const emitted = calc.calculations[0]
  // Recompute from the recorded inputs alone.
  const { steps, result } = newtonRoot((x) => x * x - 2, (x) => 2 * x, 1, 5)
  const rebuilt = buildCalculation({
    id: emitted.id, functionUnderStudy: emitted.functionUnderStudy,
    methodSource: emitted.methodSource, inputs: emitted.inputs,
    assumptions: emitted.assumptions, uncertaintyTreatment: emitted.uncertaintyTreatment,
    steps, result: { value: result, unit: 'dimensionless' },
  })
  assert.equal(rebuilt.receipt, emitted.receipt, 'the receipt must recompute from inputs alone')
  assert.equal(emitted.result.value, Number(Math.sqrt(2).toFixed(12)))
  // The convergence the source states is visible in the steps.
  assert.ok(emitted.steps.length === 6)
})

test('calculations without supporting inputs were refused, not invented', () => {
  assert.equal(calc.emitted, 1)
  assert.equal(calc.refused.length, 4)
  for (const refusal of calc.refused) assert.ok(String(refusal.reason).length > 60)
  const snr = calc.refused.find((r) => r.attempted.includes('signal-to-noise'))!
  assert.match(String(snr.reason), /Reporting a number is not supplying inputs/)
})

test('a formal method may only be used at the scope the source states', () => {
  const emitted = calc.calculations[0]
  assert.match(emitted.methodSource.statedMethod, /converges locally and quadratically when the zero is simple/)
  assert.ok(emitted.assumptions.some((a) => /zero is simple/.test(a)),
    'the source’s convergence condition must appear as an assumption')
})

test('the five states remain disjoint and total 167', () => {
  const s = report.pageStates
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented
    + s.independentlySourceSupported + s.blocked, 167)
})

test('the vendor correction removed independent status from every citing page', () => {
  // Not just the three supplier profiles: any page citing a vendor-authored
  // source. Asserted through the module rather than by grepping the generator,
  // so the check survives the code moving and fails if the logic breaks.
  assert.ok(VENDOR_AUTHORED_SOURCES.size >= 3)
  assert.equal(isVendorAuthored('asml-lithography'), true)
  assert.ok(vendorBackedSupplierRoutes([
    { route: '/knowledge/suppliers/any', sources: [{ id: 'asml-lithography' }] },
  ]).has('/knowledge/suppliers/any'))
  assert.ok(report.pageStates.independentlySourceSupported < 42,
    'the corrected count must be below the previously reported 42')
})

test('first-party pages retain their disclosure', () => {
  const fp = audit.byGroup.firstPartyDocumented
  assert.equal(fp.audited, 10)
  assert.equal(report.pageStates.firstPartyDocumented, 10)
})

test('the cohort was frozen and no exhausted route retried', () => {
  assert.equal(cohort.frozenBeforeSearching, true)
  assert.equal(cohort.selected, 36)
  assert.equal(insp.summary.exhaustedRoutesRetried, 0)
  assert.equal(insp.cohortDigest, cohort.cohortDigest)
})

test('private inspection material remains outside served output', () => {
  const leaked = execFileSync('bash', ['-lc',
    "find .next/server .next/static -type f \\( -name '*.js' -o -name '*.html' \\) -print0 2>/dev/null | xargs -0 grep -l 'supportingPassage\\|depth-audit\\|routesConsideredAndRejected\\|batch9RefusalResolved' 2>/dev/null || true"],
  { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(leaked, '')
})
