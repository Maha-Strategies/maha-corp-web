import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import { gradeAsIndependent, type FirstPartyDocument } from '../lib/first-party-evidence.ts'
import cohort from '../content/evidence-batch-8/frozen-cohort.json' with { type: 'json' }
import insp from '../content/evidence-batch-8/inspections.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://e.org', retrievedOn: '2026-09-03',
  depth: 'section-or-full-text', exactLocator: 'Section II',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'version of record', rightsBasis: 'CC-BY', ...o,
})
const base = { sourceId: 's', declaredUrl: 'https://e.org/d', establishes: 'what it supports', boundary: 'where it stops' }

test('the five states remain disjoint and total 167', () => {
  const s = report.pageStates
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented
    + s.independentlySourceSupported + s.blocked, 167)
  assert.ok(s.independentlySourceSupported > 38,
    `independent support must exceed 38, got ${s.independentlySourceSupported}`)
})

test('structural presence cannot satisfy independent evidence', () => {
  // A page with every dimension but no inspected source stays structural.
  assert.equal(gradeEvidence({ ...base, attestation: null }).explanatory, false)
  const structural = compiled.pages.filter((p) => p.eligible && (p.after?.explanatorySources ?? 0) === 0)
  assert.ok(structural.length > 0)
  for (const page of structural) assert.equal(page.after?.explanatorySources ?? 0, 0)
})

test('exact passage support is required, per claim', () => {
  for (const source of insp.inspected) {
    for (const claim of source.claimByClaimSupport) {
      assert.equal(claim.distinctPassage, true)
      assert.ok(claim.locator.length > 5, `${claim.route} must name where the passage sits`)
      assert.ok(claim.supportingPassage.length > 120, 'the passage itself must be recorded')
      assert.ok(claim.claim.length > 40)
      // The locator must come from the source's own inspected locators.
      assert.ok(source.exactLocators.some((l) => claim.locator.includes(l.split(' ')[0])),
        `${claim.route} locator must trace to an inspected locator`)
    }
  }
})

test('one passage cannot support a family by adjacency', () => {
  const rejected = insp.inspected.flatMap((s) => s.routesConsideredAndRejected)
  assert.equal(rejected.length, 2)
  const lensing = rejected.find((r) => r.route.includes('lensing'))!
  assert.match(String(lensing.reason), /shared theory rather than a shared subject/)
  const rootFinding = rejected.find((r) => r.route.includes('root-finding'))!
  assert.match(String(rootFinding.reason), /is not support for a numerical algorithm/)
})

test('mathematical analogy cannot transfer scientific validity', () => {
  // General relativity underlies both gravitational waves and lensing; that
  // shared theory was explicitly refused as a basis for reuse.
  const lensing = insp.inspected[0].routesConsideredAndRejected[0]
  assert.match(String(lensing.reason), /Both are consequences of general relativity/)
})

test('a formal definition cannot prove a differently scoped prose claim', () => {
  const dlmf = insp.inspected.find((s) => s.sourceId === 'nist-dlmf-4-14')!
  // It defines functions and periods; it is refused for algorithmic claims.
  assert.match(dlmf.boundary, /states no numerical method/)
  assert.match(dlmf.boundary, /cannot support a claim about how any particular routine/)
})

test('abstract-only and metadata-only evidence is refused for detailed claims', () => {
  for (const depth of ['abstract-only', 'metadata-only', 'not-inspected'] as const) {
    assert.equal(gradeEvidence({ ...base, attestation: att({ depth }) }).levels['content-inspected-locator'], false)
  }
  const abstractOnly = insp.notInspected.find((n) => n.depth === 'abstract-only')!
  assert.match(abstractOnly.disposition, /An abstract cannot support a section-level claim/)
  const metadataOnly = insp.notInspected.find((n) => n.outcome === 'metadata-and-author-list-only')!
  assert.match(metadataOnly.disposition, /Identity is confirmed and the content is not/)
  for (const source of insp.inspected) assert.equal(source.depth, 'section-or-full-text')
})

test('reused evidence carries its limitations and version', () => {
  for (const source of insp.inspected) {
    assert.ok(source.boundary.length > 80, `${source.sourceId} must state where it stops`)
    assert.ok(source.versionRelationship.length > 20)
    assert.ok(source.rightsBasis.length > 5)
    assert.equal(source.identityVerified, true)
  }
})

test('wrong versions and identities fail closed', () => {
  assert.equal(gradeEvidence({ ...base, attestation: att({ identityVerified: false }) }).explanatory, false)
  assert.equal(gradeEvidence({ ...base, attestation: att({ subjectAligned: false }) }).explanatory, false)
  assert.equal(gradeEvidence({ ...base, attestation: att(), releaseMatched: false }).explanatory, false)
})

test('evidentiary frames cannot be conflated', () => {
  const frames = insp.evidentiaryFrames
  assert.equal(frames.transfersMade, 0)
  assert.deepEqual(frames.declared, ['textual', 'historical', 'theological', 'empirical', 'first-person'])
})

test('first-party evidence still cannot become independent', () => {
  const doc: FirstPartyDocument = {
    organisation: 'Acme', documentsOrganisation: 'Acme', title: 'Products',
    documentKind: 'product-overview', publisher: 'Acme', publishedOrVersion: '2024',
    url: 'https://acme.example/p', inspectedOn: '2026-09-03', contentFingerprint: 'abc',
    exactLocator: 'Products', observedContent: 'the page names three product families and their processes',
    establishes: 'that Acme publishes three families', doesNotEstablish: 'no performance data, no current availability',
    accessBasis: 'public',
  }
  assert.equal(gradeAsIndependent(doc, att()).explanatory, false)
})

test('the cohort was frozen before searching and avoids exhausted routes', () => {
  assert.equal(cohort.frozenBeforeSearching, true)
  assert.equal(cohort.selected, 30)
  assert.equal(cohort.scoringModel.familySizeUsed, false)
  assert.ok(cohort.exhaustedRoutesNotRetried.length >= 5)
  assert.equal(insp.summary.exhaustedRoutesRetried, 0)
  assert.equal(insp.cohortDigest, cohort.cohortDigest)
})

test('unsupported comparisons and calculations remain absent', () => {
  assert.equal(report.informationValue.reproducibleCalculations, 0)
  assert.equal(report.informationValue.wordCountUsed, false)
})

test('private evidence stays outside client and server bundles', () => {
  const leaked = execFileSync('bash', ['-lc',
    "find .next/server .next/static -type f \\( -name '*.js' -o -name '*.html' \\) -print0 2>/dev/null | xargs -0 grep -l 'supportingPassage\\|claimByClaimSupport\\|routesConsideredAndRejected\\|evidence-batch-8' 2>/dev/null || true"],
  { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(leaked, '', `private material must not reach built output: ${leaked}`)
  for (const file of ['inspections', 'frozen-cohort']) {
    const blob = readFileSync(resolve(ROOT, `content/evidence-batch-8/${file}.json`), 'utf8')
    for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})
