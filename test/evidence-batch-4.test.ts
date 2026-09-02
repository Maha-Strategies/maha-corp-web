import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import cohort4 from '../content/evidence-batch-4/frozen-cohort.json' with { type: 'json' }
import insp4 from '../content/evidence-batch-4/inspections.json' with { type: 'json' }
import packets4 from '../content/evidence-batch-4/remediation-packets.json' with { type: 'json' }
import canary from '../content/evidence-batch-4/cross-batch-canary-evidence.json' with { type: 'json' }
import inventory from '../content/evidence-batch-4/source-acquisition-inventory.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://e.org', retrievedOn: '2026-09-02',
  depth: 'section-or-full-text', exactLocator: 'Methods',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'v', rightsBasis: 'citation-with-paraphrase', ...o,
})
const base = { sourceId: 's', declaredUrl: 'https://e.org/d', establishes: 'what it supports', boundary: 'where it stops' }

test('source-first selection cannot pick pages for sharing a family', () => {
  assert.equal(cohort4.scoringModel.familySizeUsed, false)
  assert.equal(cohort4.scoringModel.positionalSiblingsUsed, false)
  const script = readFileSync(resolve(ROOT, 'scripts/freeze-evidence-batch-4.ts'), 'utf8')
  const scoring = script.slice(script.indexOf('score: Number'), script.indexOf('}).sort'))
  for (const banned of ['sibling', 'family.length', 'familySize']) {
    assert.ok(!scoring.includes(banned), `${banned} must not appear in the scoring expression`)
  }
})

test('every supported page maps to its own inspected passage', () => {
  for (const source of insp4.inspected) {
    for (const claim of source.claimByClaimSupport) {
      assert.equal(claim.distinctPassage, true, `${claim.route} needs its own passage`)
      assert.ok(claim.locator.length > 0)
      assert.ok(claim.claim.length > 40)
      assert.ok(source.exactLocators.some((l) => claim.locator.includes(l.split(',')[0].trim())),
        `${claim.route} locator must come from the inspected locators`)
    }
  }
  const routes = insp4.inspected.flatMap((s) => s.claimByClaimSupport.map((c) => c.route))
  assert.equal(routes.length, insp4.summary.distinctClaimPassages)
})

test('a source reaching two pages does so through two distinct claims', () => {
  const perSource = insp4.inspected.map((s) => s.claimByClaimSupport.map((c) => c.claim))
  for (const claims of perSource) {
    assert.equal(new Set(claims).size, claims.length, 'a claim may not be reused across pages')
  }
})

test('adjacent subjects were refused rather than absorbed', () => {
  const rejected = insp4.inspected.flatMap((s) => s.routesConsideredAndRejected)
  assert.equal(rejected.length, 4)
  for (const entry of rejected) assert.ok(String(entry.reason).length > 40)
  assert.equal(insp4.summary.routesConsideredAndRejectedForDrift, 4)
})

test('evidence is classified, and no vendor source carries an independent claim', () => {
  const c = insp4.evidenceClassification
  assert.equal(c.vendorAuthoredProductDescriptions.length, 0)
  assert.equal(c.metadataOnlyReferences.length, 0)
  assert.equal(c.governmentOrStandardsGuidance.length + c.independentScientificOrTechnical.length, insp4.inspected.length)
  assert.equal(insp4.summary.vendorSourcesUsedForIndependentClaims, 0)
  // With no vendor-only page, no first-party disclosure is owed.
  assert.deepEqual(insp4.firstPartyDisclosureRequired, [])
})

test('abstract-only evidence cannot support section-level assertions', () => {
  for (const depth of ['abstract-only', 'metadata-only', 'not-inspected'] as const) {
    assert.equal(gradeEvidence({ ...base, attestation: att({ depth }) }).levels['content-inspected-locator'], false)
  }
  for (const source of insp4.inspected) assert.equal(source.depth, 'section-or-full-text')
  assert.equal(insp4.summary.abstractOnly, 0)
})

test('patents and snippets remain non-explanatory, and blockers are preserved', () => {
  assert.match(inventory.exclusions.patents, /excluded as explanatory evidence/)
  assert.match(inventory.exclusions.searchSnippets, /never treated as inspected/)
  assert.match(inventory.exclusions.knownFailedUrls, /not retried/)
  for (const entry of insp4.notInspected) {
    assert.equal(entry.depth, 'not-inspected')
    assert.match(entry.disposition, /Blocker preserved/)
  }
})

test('proposals cannot mutate active bindings', () => {
  assert.equal(packets4.activeBindingsChanged, 0)
  for (const entry of packets4.ledgerEntries) {
    assert.equal(entry.appliedToActiveBinding, false)
    assert.equal(entry.dispositionIsAdvisoryOnly, true)
    assert.match(entry.provenanceDigest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('cross-batch canary membership requires five valid distinct records', () => {
  assert.equal(canary.records, 5)
  assert.deepEqual(canary.batchesSpanned, ['evidence-recovery-3', 'source-acquisition-4'])
  const routes = canary.perRecord.map((r) => r.route)
  assert.equal(new Set(routes).size, 5, 'each record joins once')
  assert.match(canary.membershipRule, /Fewer than five refuses rather than shrinking/)
})

test('stale decisions and substituted sources cannot pass the canary', () => {
  for (const r of canary.perRecord) {
    assert.equal(r.gateSequence.noReview.applied, false)
    assert.equal(r.gateSequence.staleRevisionReview.applied, false)
    assert.equal(r.gateSequence.alignmentNotClear.applied, false)
    assert.equal(r.gateSequence.noActiveMatchingRelease.applied, false)
    assert.equal(r.gateSequence.allGatesSatisfied.applied, true)
    assert.equal(r.predecessorUnchangedUntilApplied, true)
  }
  assert.equal(canary.productionMutations, 0)
  assert.equal(canary.canonicalReleasesPublished, 0)
})

test('unsupported comparisons and calculations remain absent', () => {
  assert.equal(report.informationValue.reproducibleCalculations, 0)
  assert.equal(report.informationValue.wordCountUsed, false)
})

test('the shortfall is stated rather than smoothed', () => {
  assert.equal(cohort4.selected, 20)
  assert.equal(insp4.summary.blockedPagesSupported, 2)
  assert.match(insp4.summary.honestShortfall, /the gate was not adjusted/)
  const s = report.pageStates
  assert.ok(s.blocked > 17, 'the primary target was not met and the report must show it')
  assert.ok(s.structurallyUplifted + s.sourceSupportedUplift < 150)
})

test('private evidence stays outside public bundles', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'evidence-batch-4|cross-batch-canary|source-acquisition-inventory|claimByClaimSupport', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '')
  for (const file of ['inspections', 'remediation-packets', 'frozen-cohort', 'cross-batch-canary-evidence', 'source-acquisition-inventory']) {
    const blob = readFileSync(resolve(ROOT, `content/evidence-batch-4/${file}.json`), 'utf8')
    for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})
