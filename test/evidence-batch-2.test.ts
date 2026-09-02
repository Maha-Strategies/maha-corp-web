import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import { compileUplift, type LegacyPageInput } from '../lib/legacy-knowledge-uplift.ts'
import { upliftFor } from '../lib/legacy-uplift-runtime.ts'
import cohort from '../content/evidence-batch-2/frozen-cohort.json' with { type: 'json' }
import inspections from '../content/evidence-batch-2/inspections.json' with { type: 'json' }
import packets from '../content/evidence-batch-2/remediation-packets.json' with { type: 'json' }
import batch1 from '../content/semiconductor-evidence/batch-1.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://e.org', retrievedOn: '2026-09-02',
  depth: 'section-or-full-text', exactLocator: 'Methods',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'v', rightsBasis: 'citation-with-paraphrase', ...o,
})
const base = { sourceId: 's', declaredUrl: 'https://e.org/d', establishes: 'what it supports', boundary: 'where it stops' }

test('metadata and abstracts cannot masquerade as section inspection', () => {
  for (const depth of ['metadata-only', 'abstract-only'] as const) {
    assert.equal(gradeEvidence({ ...base, attestation: att({ depth }) }).levels['content-inspected-locator'], false)
  }
  const rejected = inspections.notInspected.find((n) => n.depth === 'abstract-only')
  assert.ok(rejected, 'the abstract that was rejected must be recorded')
  assert.match(rejected.disposition, /Insufficient/)
})

test('an inspected source cannot support records it was not checked against', () => {
  for (const source of inspections.inspected) {
    assert.ok(source.supportsRoutes.length > 0)
    for (const route of source.supportsRoutes) {
      assert.ok(compiled.pages.some((p) => p.route === route), `${route} must be a real route`)
    }
  }
  // Every supported route is named per source, so no keyword match can widen it.
  const all = inspections.inspected.flatMap((s) => s.supportsRoutes)
  const uplifted = all.filter((r) => upliftFor(r) !== null)
  assert.equal(uplifted.length, all.length, 'each named route resolved; none was inferred')
})

test('one source cannot mechanically support every record in a positional block', () => {
  const neuro = compiled.pages.filter((p) => p.route.startsWith('/knowledge/neuromorphic-biocomputing/'))
  const supported = neuro.filter((p) => (p.after?.explanatorySources ?? 0) > 0)
  // The property, not a frozen number: later batches may legitimately add more
  // neuromorphic sources, but no source may absorb the whole family.
  assert.ok(supported.length < neuro.length,
    'sources cover only the routes they were checked against, never the whole family')
  assert.ok(supported.length > 0)
})

test('vendor claims cannot become independent validation', () => {
  assert.equal(batch1.summary.vendorSourcesUsedForIndependentClaims, 0)
  assert.equal(inspections.summary.vendorSourcesUsedForIndependentClaims, 0)
  for (const source of inspections.inspected) {
    assert.ok(['government-publication', 'peer-reviewed-open-access', 'accepted-manuscript', 'lawful-preprint'].includes(source.tier))
  }
  // The one vendor-derived boundary in batch 1 forbids exactly these elevations.
  const vendor = JSON.parse(readFileSync(resolve(ROOT, 'content/legacy-uplift/inspection-attestations.json'), 'utf8'))
  for (const a of vendor.attestations) {
    assert.match(a.boundary, /cannot support|no measured|no reliability|no yield/i,
      `${a.sourceId} must state it cannot carry an independent performance claim`)
  }
})

test('inaccessible and wrong-document sources remain blocked', () => {
  const blockedOutcomes = [...batch1.notInspected, ...inspections.notInspected]
  assert.ok(blockedOutcomes.length >= 6)
  for (const entry of blockedOutcomes) assert.notEqual(entry.depth, 'section-or-full-text')
  const wrongDoc = batch1.notInspected.find((n) => n.outcome === 'identity-mismatch')
  assert.ok(wrongDoc)
  assert.match(wrongDoc.disposition, /Rejected/)
})

test('a proposed replacement cannot change an active binding by itself', () => {
  assert.equal(packets.activeBindingsChanged, 0)
  assert.equal(packets.immutable, true)
  for (const entry of packets.ledgerEntries) {
    assert.equal(entry.appliedToActiveBinding, false)
    assert.equal(entry.activeBindingUnchanged, true)
    assert.equal(entry.dispositionIsAdvisoryOnly, true)
    assert.match(entry.provenanceDigest, /^sha256:[0-9a-f]{64}$/)
  }
  // No code path turns a disposition into a mutation.
  let readsDisposition = ''
  try {
    readsDisposition = execFileSync('git', ['grep', '-l', 'proposedDisposition', '--', 'lib', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(readsDisposition, '', 'nothing in lib, app or components reads a packet disposition')
})

test('a five-record canary was only claimed if five records were available', () => {
  const canary = packets.canary
  if (canary.fiveRecordCanaryReachable) {
    assert.equal(canary.records.length, 5, 'a canary is five records or it is not one')
    assert.equal(canary.executed, false)
    assert.equal(canary.authorized, false)
  } else {
    assert.equal(canary.constructed, false)
    assert.equal(canary.records.length, 0)
  }
})

test('a stale revision cannot inherit new evidence', () => {
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
  assert.equal(result.requiresGovernedRevision, true)
  assert.equal(gradeEvidence({ ...base, attestation: att(), releaseMatched: false }).explanatory, false)
})

test('unsupported comparisons and calculations remain absent', () => {
  assert.equal(report.informationValue.reproducibleCalculations, 0,
    'no calculation was fabricated where inputs and assumptions do not exist')
  for (const page of compiled.pages) {
    if (page.eligible) continue
    assert.equal(page.after, null)
  }
})

test('the cohort was frozen before searching', () => {
  assert.equal(cohort.frozenBeforeSearching, true)
  assert.equal(cohort.selected, 25)
  assert.equal(cohort.byState.blocked + cohort.byState.structuralOnly, 25)
  assert.equal(inspections.cohortDigest, cohort.cohortDigest, 'inspections must cite the frozen cohort')
  assert.equal(cohort.scoringModel.searchRelevance.includes('not used'), true)
})

test('the four page states are reported apart and never summed', () => {
  const s = report.pageStates
  assert.equal(s.structurallyUplifted + s.sourceSupportedUplift + s.blocked + s.legacyUnchanged, s.total)
  assert.ok(s.sourceSupportedUplift > 24, `the primary metric must exceed 24, got ${s.sourceSupportedUplift}`)
  assert.match(s.neverCombined, /must not be added into a single quality figure/)
  assert.equal(report.informationValue.wordCountUsed, false)
})

test('private passages and packets never enter served bundles', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'evidence-batch-2|remediation-packets|inspectedPassage|observedContent|frozen-cohort', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '')
  for (const file of ['inspections', 'remediation-packets', 'frozen-cohort']) {
    const blob = readFileSync(resolve(ROOT, `content/evidence-batch-2/${file}.json`), 'utf8')
    for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})
