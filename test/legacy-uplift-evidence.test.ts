import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  EVIDENCE_LEVELS, FORBIDDEN_BOUNDARY_SOURCES, assertNotBoundarySubstitute,
  gradeEvidence, type InspectionAttestation,
} from '../lib/legacy-evidence-levels.ts'
import { boundaryDerivedNegativeSpace, compileUplift, type LegacyPageInput } from '../lib/legacy-knowledge-uplift.ts'
import { summariseFamily } from '../lib/legacy-index-summary.ts'
import { upliftFor } from '../lib/legacy-uplift-runtime.ts'
import attestations from '../content/legacy-uplift/inspection-attestations.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const attestation = (over: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's1', retrievedFrom: 'https://example.org/doc', retrievedOn: '2026-09-02',
  depth: 'section-or-full-text', exactLocator: 'Methods section',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'served from the cited host',
  subjectAligned: true, subjectBasis: 'about the record subject',
  versionRelationship: 'living page', rightsBasis: 'citation-with-paraphrase', ...over,
})
const base = { sourceId: 's1', declaredUrl: 'https://example.org/doc', establishes: 'what it supports here', boundary: 'where it stops here' }

/* ------------------------------- a URL is not an inspection ------------------- */

test('a declared locator alone never satisfies inspected-locator coverage', () => {
  const graded = gradeEvidence({ ...base, attestation: null })
  assert.equal(graded.levels['declared-locator'], true)
  assert.equal(graded.levels['content-inspected-locator'], false)
  assert.equal(graded.explanatory, false)
  assert.match(graded.reason, /content-inspected-locator/)
})

test('an attestation without observed content does not count as inspected', () => {
  const graded = gradeEvidence({ ...base, attestation: attestation({ observedContent: 'short' }) })
  assert.equal(graded.levels['content-inspected-locator'], false)
})

test('an abstract-only or metadata-only depth cannot support explanation', () => {
  for (const depth of ['metadata-only', 'abstract-only', 'not-inspected'] as const) {
    const graded = gradeEvidence({ ...base, attestation: attestation({ depth }) })
    assert.equal(graded.levels['content-inspected-locator'], false, `${depth} must not qualify`)
    assert.equal(graded.explanatory, false)
  }
})

test('the six levels are independent: none implies the next', () => {
  assert.equal(EVIDENCE_LEVELS.length, 6)
  const readButMismatched = gradeEvidence({ ...base, attestation: attestation({ subjectAligned: false }) })
  assert.equal(readButMismatched.levels['content-inspected-locator'], true)
  assert.equal(readButMismatched.levels['subject-aligned'], false)
  assert.equal(readButMismatched.explanatory, false, 'reading a source does not make it about the subject')

  const alignedButUnidentified = gradeEvidence({ ...base, attestation: attestation({ identityVerified: false }) })
  assert.equal(alignedButUnidentified.explanatory, false)
})

test('a stale revision blocks explanatory use however well inspected', () => {
  const graded = gradeEvidence({ ...base, attestation: attestation(), releaseMatched: false })
  assert.equal(graded.levels['release-revision-matched'], false)
  assert.equal(graded.explanatory, false)
})

/* ----------------------- boundaries cannot be manufactured -------------------- */

test('assumptions, controls and failure modes may not become boundaries', () => {
  for (const field of FORBIDDEN_BOUNDARY_SOURCES) {
    assert.throws(() => assertNotBoundarySubstitute(field), /may not be used as an evidence boundary/)
  }
  assert.doesNotThrow(() => assertNotBoundarySubstitute('boundary'))
})

test('derived negative space comes only from declared source boundaries, attributed', () => {
  const page: LegacyPageInput = {
    family: 't', slug: 'x', route: '/knowledge/t/x', title: 'X',
    definition: 'a definition long enough to serve as a direct answer for a reader',
    mechanism: ['m'], limitations: ['l'], doesNotEstablish: [],
    sources: [{ id: 's', title: 'A Source', url: 'https://e.org/d', establishes: 'what it supports', boundary: 'what it cannot support' }],
    bridges: [], comparisons: [], relatedRoutes: [], canonicalRelease: null,
  }
  const derived = boundaryDerivedNegativeSpace(page)
  assert.equal(derived.length, 1)
  assert.match(derived[0], /boundary declared by A Source/, 'the boundary must name whose limit it is')
  // A source without a boundary contributes nothing.
  assert.equal(boundaryDerivedNegativeSpace({ ...page, sources: [{ id: 's', title: 'T', url: 'https://e.org' }] }).length, 0)
})

test('metadata-only sources never become explanatory fact', () => {
  const graded = gradeEvidence({ sourceId: 'm', declaredUrl: 'https://e.org', attestation: null })
  assert.equal(graded.explanatory, false)
  assert.equal(graded.depth, 'not-inspected')
})

/* ---------------------------------- the real inspections ---------------------- */

test('every recorded attestation carries what was read and where it stops', () => {
  for (const a of attestations.attestations) {
    assert.equal(a.depth, 'section-or-full-text')
    assert.ok(a.observedContent.length > 40, `${a.sourceId} must record what was seen`)
    assert.ok(a.exactLocator.length > 0)
    assert.ok(a.establishes.length > 20 && a.boundary.length > 20)
    assert.equal(a.identityVerified, true)
    assert.equal(a.subjectAligned, true)
  }
})

test('unreachable sources are recorded as failures and stay non-explanatory', () => {
  assert.equal(attestations.retrievalFailures.length, 4)
  for (const f of attestations.retrievalFailures) {
    assert.match(f.outcome, /HTTP (403|404)/)
    assert.match(f.disposition, /non-explanatory/)
  }
  assert.equal(attestations.summary.inspected + attestations.summary.unreachable, attestations.summary.attempted)
})

/* -------------------------------------- indexes ------------------------------- */

test('an index counts only verified children and discloses the rest', () => {
  const eligible = compiled.pages.filter((p) => p.eligible).map((p) => p.route)
  const blocked = compiled.pages.filter((p) => !p.eligible).map((p) => p.route)
  const summary = summariseFamily('/knowledge/test', [eligible[0], blocked[0]])
  assert.equal(summary.verifiedChildren, 1)
  assert.equal(summary.unverifiedChildren, 1)
  assert.deepEqual(summary.verifiedRoutes, [eligible[0]])
  assert.match(summary.disclosure, /not evidence-verified/)
})

test('a family of only blocked children makes no verified claim', () => {
  const blocked = compiled.pages.filter((p) => !p.eligible).map((p) => p.route).slice(0, 3)
  const summary = summariseFamily('/knowledge/test', blocked)
  assert.equal(summary.verifiedChildren, 0)
  assert.deepEqual(summary.verifiedRoutes, [])
})

/* --------------------------------- honest reporting --------------------------- */

test('declared and inspected locators are reported as different measures', () => {
  assert.ok('declaredLocators' in report.depth.after)
  assert.ok('contentInspectedLocators' in report.depth.after)
  assert.ok(report.depth.after.declaredLocators > report.depth.after.contentInspectedLocators,
    'most locators are declared, not inspected, and the report must show that')
  assert.match(report.depth.locatorNote, /A declared locator is a URL/)
})

test('blocked pages remain unchanged and unrendered', () => {
  for (const page of compiled.pages) {
    if (page.eligible) continue
    assert.equal(upliftFor(page.route), null)
    assert.equal(page.after, null)
  }
})

test('the upgraded count is not inflated to the inventory size', () => {
  assert.equal(report.outcome.eligibleAndUpgraded + report.outcome.blocked, report.inventory.pages)
  assert.ok(report.outcome.blocked > 0, 'a claim that everything passed would be the warning sign')
})

test('no audit packet, rejected passage, credential or rationale reaches served code', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'inspection-attestations|uplift-report|retrievalFailures|observedContent', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '', 'inspection material must stay out of served code')
  const blob = readFileSync(resolve(ROOT, 'content/legacy-uplift/inspection-attestations.json'), 'utf8')
  for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i, /packetDigest/i]) {
    assert.ok(!pattern.test(blob), `attestations must not contain ${pattern}`)
  }
})
