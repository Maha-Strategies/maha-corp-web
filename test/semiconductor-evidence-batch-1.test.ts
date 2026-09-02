import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import batch from '../content/semiconductor-evidence/batch-1.json' with { type: 'json' }
import deepening from '../content/semiconductor-evidence/deepening-assessment.json' with { type: 'json' }
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

test('an uninspected source cannot support explanatory prose', () => {
  assert.equal(gradeEvidence({ ...base, attestation: null }).explanatory, false)
  assert.equal(gradeEvidence({ ...base, attestation: att({ depth: 'metadata-only' }) }).explanatory, false)
})

test('a source boundary never implies its main claim was inspected', () => {
  // Boundary and establishes both present, still nothing read.
  const graded = gradeEvidence({ ...base, attestation: null })
  assert.equal(graded.levels['claim-supported-at-stated-scope'], true)
  assert.equal(graded.levels['content-inspected-locator'], false)
  assert.equal(graded.explanatory, false)
  assert.match(deepening.boundaryNotSubstituteForInspection, /never advances the content-inspected level/)
})

test('an abstract-only source stays non-explanatory', () => {
  const abstractOnly = batch.notInspected.find((n) => n.depth === 'abstract-only')
  assert.ok(abstractOnly, 'the abstract-only case must be recorded')
  assert.match(abstractOnly.disposition, /Non-explanatory/)
  assert.match(abstractOnly.disposition, /not an inspection/)
})

test('dead links and 403 responses stay blocked until a lawful copy is inspected', () => {
  const blockedRoutes = batch.notInspected.filter((n) => /404|bot-verification/.test(n.outcome))
  assert.ok(blockedRoutes.length >= 3)
  for (const entry of blockedRoutes) assert.equal(entry.depth, 'not-inspected')
  for (const stale of batch.staleSourceRemediation) {
    if (stale.replacementIdentified) assert.equal(stale.replacementIdentified.contentInspected, false)
    assert.notEqual(stale.proposedRevision.status, 'applied')
  }
})

test('a replacement source cannot alter an active binding before review', () => {
  const amkor = batch.staleSourceRemediation.find((s) => s.sourceId === 'amkor-rdl-pop')
  assert.ok(amkor?.replacementIdentified)
  assert.equal(amkor.replacementIdentified.identityVerified, true)
  assert.equal(amkor.replacementIdentified.contentInspected, false)
  assert.equal(amkor.proposedRevision.status, 'proposed, not applied')
  assert.equal(batch.summary.activeBindingsChanged, 0)
})

test('a guessed identifier resolving to the wrong work is rejected, not cited', () => {
  const mismatch = batch.notInspected.find((n) => n.outcome === 'identity-mismatch')
  assert.ok(mismatch, 'the mismatch must be recorded rather than quietly dropped')
  assert.match(mismatch.disposition, /Rejected/)
  assert.equal(batch.summary.identityMismatchRejected, 1)
})

test('no vendor source was used to establish an independent claim', () => {
  assert.equal(batch.summary.vendorSourcesUsedForIndependentClaims, 0)
  for (const entry of batch.inspected) {
    assert.notEqual(entry.tier, 'vendor-marketing')
    assert.ok(['government-publication', 'peer-reviewed-open-access', 'lawful-preprint'].includes(entry.tier))
  }
})

test('every inspected source records locators, what was read, and where it stops', () => {
  assert.equal(batch.summary.inspectedSectionOrFullText, batch.inspected.length)
  for (const entry of batch.inspected) {
    assert.equal(entry.depth, 'section-or-full-text')
    assert.ok(entry.exactLocators.length > 0)
    assert.ok(entry.observedContent.length > 100)
    assert.ok(entry.boundary.length > 60)
    assert.equal(entry.identityVerified, true)
    assert.ok(entry.supportsRoutes.length > 0, 'routes are named per source, never keyword-matched')
  }
})

test('the report separates structural enrichment from inspected evidence', () => {
  const quality = report.outcome.upgradeQuality
  assert.equal(quality.sourceSupported + quality.structuralOnly, report.outcome.eligibleAndUpgraded)
  assert.ok(quality.structuralOnly > quality.sourceSupported,
    'the honest picture is that most upgrades are structural, and the report must show it')
  assert.match(quality.note, /does not mean any source was independently inspected/)
})

test('deepening added no sections and padded no prose', () => {
  assert.equal(deepening.sectionsAdded, 0)
  assert.equal(deepening.prosePadded, 0)
  assert.equal(deepening.tenHighestValueWeakest.length, 10)
  for (const page of deepening.tenHighestValueWeakest) {
    assert.equal(page.explanatorySources, 0)
    assert.equal(page.verdict, 'structural')
  }
})

test('blocked pages remain unchanged and unrendered', () => {
  for (const page of compiled.pages) {
    if (page.eligible) continue
    assert.equal(page.after, null)
    assert.ok(page.refusals.length > 0)
  }
  assert.equal(report.outcome.eligibleAndUpgraded + report.outcome.blocked, report.inventory.pages)
})

test('no inspection material, passage or credential reaches served code', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'semiconductor-evidence|observedContent|staleSourceRemediation|notInspected', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '')
  const blob = readFileSync(resolve(ROOT, 'content/semiconductor-evidence/batch-1.json'), 'utf8')
  for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i, /packetDigest/i]) {
    assert.ok(!pattern.test(blob), `batch record must not contain ${pattern}`)
  }
})
