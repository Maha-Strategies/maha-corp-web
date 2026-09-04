import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import { compileUplift, type LegacyPageInput } from '../lib/legacy-knowledge-uplift.ts'
import canary from '../content/evidence-batch-3/canary-evidence.json' with { type: 'json' }
import cohort3 from '../content/evidence-batch-3/frozen-cohort.json' with { type: 'json' }
import insp3 from '../content/evidence-batch-3/inspections.json' with { type: 'json' }
import packets3 from '../content/evidence-batch-3/remediation-packets.json' with { type: 'json' }
import cohort2 from '../content/evidence-batch-2/frozen-cohort.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import { assertCalculationsAreReproducible } from './helpers/uplift-invariants.ts'

const ROOT = resolve(import.meta.dirname, '..')
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://e.org', retrievedOn: '2026-09-02',
  depth: 'section-or-full-text', exactLocator: 'Methods',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'v', rightsBasis: 'citation-with-paraphrase', ...o,
})
const base = { sourceId: 's', declaredUrl: 'https://e.org/d', establishes: 'what it supports', boundary: 'where it stops' }

/* ------------------------------------------------------------- the canary --- */

test('the canary applied only with a review bound to the exact revision', () => {
  assert.equal(canary.records, 5)
  for (const r of canary.perRecord) {
    assert.equal(r.gateSequence.noReview.applied, false)
    assert.ok(r.gateSequence.noReview.refusals.includes('no-review-for-exact-revision'))
    // A review for a different revision is not a review for this one.
    assert.equal(r.gateSequence.staleRevisionReview.applied, false)
    assert.equal(r.gateSequence.alignmentNotClear.applied, false)
    assert.equal(r.gateSequence.noActiveMatchingRelease.applied, false)
    assert.equal(r.gateSequence.allGatesSatisfied.applied, true)
  }
  for (const [name, held] of Object.entries(canary.invariants)) assert.equal(held, true, `${name} must hold`)
})

test('the predecessor survived every refusal', () => {
  assert.equal(canary.invariants.predecessorUnchangedUntilApplied, true)
  for (const r of canary.perRecord) assert.equal(r.predecessorUnchangedUntilApplied, true)
})

test('destroying the environment restored the original state', () => {
  assert.equal(canary.environment.createdForThisRun, true)
  assert.equal(canary.environment.productionReachable, false)
  assert.equal(canary.productionMutations, 0)
  assert.equal(canary.canonicalReleasesPublished, 0)
  assert.equal(canary.commercialValidationInferred, false)
  // The disposable database is gone; nothing it changed can persist.
  assert.equal(canary.bindingsChangedInDisposableDatabase, 5)
})

test('canary evidence carries fingerprints, never passages or rationale', () => {
  assert.match(canary.evidenceContract, /Fingerprints and digests only/)
  // Check the values, not the key names: a field called
  // inspectedPassageFingerprint is exactly what should be here.
  const values: string[] = []
  const walk = (node: unknown) => {
    if (typeof node === 'string') values.push(node)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') Object.values(node).forEach(walk)
  }
  walk(canary.perRecord)
  for (const value of values) {
    assert.ok(value.length < 200, `no long prose may appear in canary evidence: ${value.slice(0, 60)}`)
    for (const pattern of [/bearer/i, /reviewerId/i]) assert.ok(!pattern.test(value))
  }
  for (const r of canary.perRecord) {
    assert.match(r.inspectedPassageFingerprint, /^[0-9a-f]{16}$/)
    assert.match(r.claimScopeFingerprint, /^[0-9a-f]{16}$/)
    assert.notEqual(r.inspectedPassageFingerprint, r.claimScopeFingerprint)
  }
})

/* ---------------------------------------------------------- frozen cohorts --- */

test('frozen cohorts cannot be regenerated or silently changed', () => {
  assert.equal(cohort2.cohortDigest.startsWith('sha256:f470f91a'), true)
  assert.equal(cohort3.frozenBeforeSearching, true)
  assert.equal(insp3.cohortDigest, cohort3.cohortDigest, 'inspections must cite the frozen cohort')
  const script = readFileSync(resolve(ROOT, 'scripts/freeze-evidence-batch-3.ts'), 'utf8')
  assert.match(script, /existsSync/, 'the freeze must refuse to overwrite')
  assert.match(script, /already frozen/)
})

test('batch 3 selection does not reward positional sibling count', () => {
  assert.equal(cohort3.scoringModel.siblingCountUsed, false)
  assert.equal(cohort3.selected, 30)
  assert.match(cohort3.scoringModel.siblingCountNote, /earn each page record by record/)
  const script = readFileSync(resolve(ROOT, 'scripts/freeze-evidence-batch-3.ts'), 'utf8')
  assert.ok(!/siblings/.test(script.split('const frozen')[0].replace(/\/\*[\s\S]*?\*\//g, '')),
    'no sibling term may appear in the scoring expression')
})

/* -------------------------------------------------------------- evidence --- */

test('one inspected source cannot support unrelated positional siblings', () => {
  // Both batch 3 sources named a sibling they refused rather than absorbed.
  const rejected = insp3.inspected.flatMap((s) => s.routesConsideredAndRejected ?? [])
  assert.equal(rejected.length, 2)
  for (const entry of rejected) assert.ok(String(entry.reason).length > 30)
  const mea = insp3.inspected.find((s) => s.sourceId === 'obien-2015-mea-recordings')!
  const neuro = compiled.pages.filter((p) => p.route.startsWith('/knowledge/neuromorphic-biocomputing/'))
  assert.ok(mea.supportsRoutes.length < neuro.length)
})

test('abstract-only inspection cannot support section-level claims', () => {
  for (const depth of ['abstract-only', 'metadata-only', 'not-inspected'] as const) {
    assert.equal(gradeEvidence({ ...base, attestation: att({ depth }) }).levels['content-inspected-locator'], false)
  }
  for (const source of insp3.inspected) assert.equal(source.depth, 'section-or-full-text')
})

test('patents and search snippets are never treated as inspected evidence', () => {
  const cmp = insp3.notInspected.find((n) => n.sourceId === 'cmp-mechanism-institutional-repository')!
  assert.equal(cmp.depth, 'not-inspected')
  assert.match(cmp.disposition, /Patents are excluded as evidence/)
  assert.ok(cmp.routesAttempted.length >= 2, 'every attempted route is recorded')
})

test('a guessed identifier that does not resolve is recorded as a failure', () => {
  const guessed = insp3.notInspected.find((n) => n.outcome === 'identifier-does-not-resolve')!
  assert.match(String(guessed.note), /A guessed identifier is not a discovery route/)
  assert.equal(guessed.depth, 'not-inspected')
})

test('known blockers are preserved rather than routed around', () => {
  for (const entry of insp3.paywallAndDeadSourceStatus) {
    assert.equal(entry.stillBlocked, true)
    assert.ok('newRouteTried' in entry && 'newOutcome' in entry)
  }
  assert.equal(insp3.summary.vendorSourcesUsedForIndependentClaims, 0)
})

/* ------------------------------------------------------------ governance --- */

test('an accept proposal still cannot mutate an active binding', () => {
  assert.equal(packets3.activeBindingsChanged, 0)
  for (const entry of packets3.ledgerEntries) {
    assert.equal(entry.appliedToActiveBinding, false)
    assert.equal(entry.dispositionIsAdvisoryOnly, true)
    assert.match(entry.provenanceDigest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('a smaller canary is refused rather than called complete', () => {
  // Batch 3 produced three packets, so five distinct records are unavailable.
  assert.equal(packets3.canary.fiveRecordCanaryReachable, false)
  assert.equal(packets3.canary.constructed, false)
  assert.equal(packets3.canary.records.length, 0)
  assert.match(packets3.canary.note, /No smaller canary was constructed/)
})

test('a stale revision cannot inherit uplift prose', () => {
  const page: LegacyPageInput = {
    family: 't', slug: 'x', route: '/knowledge/t/x', title: 'X',
    definition: 'a definition long enough to serve as a direct answer for a reader',
    mechanism: ['m'], limitations: ['l'], doesNotEstablish: ['n'],
    sources: [{ id: 's', title: 'T', url: 'https://e.org/d', establishes: 'supports', boundary: 'stops' }],
    bridges: [], comparisons: [], relatedRoutes: [],
    canonicalRelease: { released: true, revisionMatches: false },
    attestations: { s: att({ sourceId: 's' }) },
  }
  const result = compileUplift(page)
  assert.equal(result.eligible, false)
  assert.ok(result.refusals.includes('stale-revision'))
  assert.deepEqual(result.sections, [])
})

test('unsupported comparisons and calculations remain absent', () => {
  assertCalculationsAreReproducible(report, compiled)
  assert.equal(report.informationValue.wordCountUsed, false)
})

test('the four states are reported apart and the metric moved honestly', () => {
  const s = report.pageStates
  // Five states since Batch 5 introduced first-party documentation.
  assert.equal(s.structurallyUplifted + s.firstPartyDocumented + s.independentlySourceSupported + s.blocked + s.legacyUnchanged, s.total)
  // The 32 this batch reported counted pages backed only by vendor
  // self-documentation. Batch 9 removed that status at the source level, so
  // the ratchet is against the corrected history rather than the inflated
  // figure: what this batch actually added was three conversions.
  assert.ok(s.independentlySourceSupported > 0)
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented
    + s.independentlySourceSupported + s.blocked, s.total)
  // The secondary target is not met, and the report must not pretend otherwise.
  assert.ok(s.structurallyUplifted + s.sourceSupportedUplift < 150)
})

test('private packets, passages and decisions never enter public bundles', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'evidence-batch-3|canary-evidence|inspectedPassage|remediation-packets', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '')
  for (const file of ['inspections', 'remediation-packets', 'frozen-cohort', 'canary-evidence']) {
    const blob = readFileSync(resolve(ROOT, `content/evidence-batch-3/${file}.json`), 'utf8')
    for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})
