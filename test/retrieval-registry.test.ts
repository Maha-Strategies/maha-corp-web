import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { permitRetrieval, registryDigest, type RetrievalAttempt } from '../lib/retrieval-registry.ts'
import { evaluateFirstParty, gradeAsIndependent, scanFirstPartyText, type FirstPartyDocument } from '../lib/first-party-evidence.ts'
import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import registryFile from '../content/evidence-batch-6/retrieval-registry.json' with { type: 'json' }
import insp6 from '../content/evidence-batch-6/inspections.json' with { type: 'json' }
import supplier from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }
import adoption from '../content/evidence-batch-5/adoption-manifest.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const registry = registryFile.attempts as RetrievalAttempt[]
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://e.org', retrievedOn: '2026-09-02',
  depth: 'section-or-full-text', exactLocator: 'Methods',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'v', rightsBasis: 'citation-with-paraphrase', ...o,
})
const doc = (o: Partial<FirstPartyDocument> = {}): FirstPartyDocument => ({
  organisation: 'Acme', documentsOrganisation: 'Acme', title: 'Products',
  documentKind: 'product-overview', publisher: 'Acme', publishedOrVersion: '2024',
  url: 'https://acme.example/products/', inspectedOn: '2026-09-02',
  contentFingerprint: 'abc', exactLocator: 'Products',
  observedContent: 'the page names three product families and the process each performs',
  establishes: 'that Acme publishes three product families',
  doesNotEstablish: 'no performance data and it cannot establish current availability',
  accessBasis: 'public', ...o,
})

test('an identical failed retrieval is refused', () => {
  const verdict = permitRetrieval(registry, {
    sourceIdentity: 'applied-product-portfolio', requestedVersion: 'current',
    url: 'https://www.appliedmaterials.com/il/en/semiconductor/semiconductor-products.html',
    retrievalMethod: 'direct-https',
  })
  assert.equal(verdict.permitted, false)
  assert.equal(verdict.refusal, 'identical-route-already-failed')
  assert.match(verdict.rationale, /Retrying the same address is not a new attempt/)
})

test('only a genuinely different attempt is exempt', () => {
  const base = {
    sourceIdentity: 'applied-product-portfolio', requestedVersion: 'current',
    url: 'https://www.appliedmaterials.com/il/en/semiconductor/semiconductor-products.html',
    retrievalMethod: 'direct-https' as const,
  }
  for (const exemption of ['newRepository', 'availabilityMateriallyChanged', 'authorizedInstitutionalAccess'] as const) {
    assert.equal(permitRetrieval(registry, { ...base, [exemption]: true }).permitted, true)
  }
  // A different URL is a different attempt.
  assert.equal(permitRetrieval(registry, { ...base, url: 'https://www.appliedmaterials.com/other' }).permitted, true)
})

test('an identity mismatch fails closed for that source on any route', () => {
  const verdict = permitRetrieval(registry, {
    sourceIdentity: 'arxiv-2404.05954', requestedVersion: 'v2',
    url: 'https://arxiv.org/pdf/2404.05954', retrievalMethod: 'direct-https', newRepository: true,
  })
  assert.equal(verdict.permitted, false)
  assert.equal(verdict.refusal, 'identity-mismatch-recorded')
  assert.match(verdict.rationale, /A similar title is not the same source/)
})

test('the registry digest excludes date buckets so it is stable across days', () => {
  const shifted = registry.map((entry) => ({ ...entry, dateBucket: '2027-01' }))
  assert.equal(registryDigest(registry), registryDigest(shifted))
  const changed = registry.map((entry, i) => i === 0 ? { ...entry, url: 'https://changed.example' } : entry)
  assert.notEqual(registryDigest(registry), registryDigest(changed))
})

test('the five evidence states remain disjoint and partition the corpus', () => {
  const s = report.pageStates
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented + s.independentlySourceSupported + s.blocked, s.total)
  assert.ok(s.independentlySourceSupported > 0)
  assert.ok(s.firstPartyDocumented > 0)
})

test('first-party documentation cannot satisfy independent support', () => {
  assert.equal(gradeAsIndependent(doc(), att()).explanatory, false)
  assert.equal(evaluateFirstParty(doc(), 'Acme').independentlyExplanatory, false)
})

test('adjectives alone cannot make a supplier page eligible', () => {
  assert.equal(evaluateFirstParty(doc({ documentKind: 'marketing-landing-page' }), 'Acme').eligible, false)
  const refused = supplier.inspected.find((e) => !e.eligible)!
  assert.match(refused.establishes, /Nothing specific/)
})

test('company-stated numbers are visibly attributed', () => {
  const axcelis = supplier.inspected.find((e) => e.supplier === 'axcelis-technologies')!
  assert.match(axcelis.establishes, /Axcelis states a throughput figure/)
  assert.match(axcelis.doesNotEstablish, /own published number, not a measured or independently verified one/)
})

test('stale product documentation cannot establish current availability', () => {
  for (const entry of supplier.inspected) {
    if (!entry.eligible) continue
    assert.match(entry.doesNotEstablish, /current(ly)? (product )?availab/i)
  }
})

test('a general overview cannot support an equipment-level claim', () => {
  const source = insp6.inspected[0]
  assert.equal(source.pagesUnlocked, 0)
  assert.equal(source.claimByClaimSupport.length, 0)
  const equipmentRefusals = source.routesConsideredAndRejected.filter((r) => r.route.includes('/equipment/'))
  assert.equal(equipmentRefusals.length, 2)
  for (const refusal of equipmentRefusals) {
    assert.match(String(refusal.reason), /general process overview|not equipment-level/i)
  }
})

test('patents were never used as support', () => {
  assert.equal(insp6.summary.patentsUsedAsSupport, 0)
  const blob = JSON.stringify(insp6)
  assert.ok(!/uspto|patent number|US\d{7}/i.test(blob))
})

test('accepted proposals remain inactive and the manifest cannot release itself', () => {
  assert.equal(adoption.executed, false)
  assert.equal(adoption.migrationApplied, false)
  assert.equal(adoption.productionReleasePerformed, false)
  for (const entry of adoption.entries) assert.equal(entry.adopted, false)
  assert.match(adoption.staleDecisionCannotAuthorize, /predecessor digest cannot authorize/)
  assert.equal(adoption.firstPartyProposals.partitionedSeparately, true)
})

test('abstract-only evidence cannot support detailed claims', () => {
  for (const depth of ['abstract-only', 'metadata-only'] as const) {
    assert.equal(gradeEvidence({ sourceId: 's', declaredUrl: 'https://e.org/d', establishes: 'x'.repeat(20), boundary: 'y'.repeat(20), attestation: att({ depth }) }).explanatory, false)
  }
  assert.equal(insp6.summary.abstractOnly, 0)
})

test('the zero result is stated rather than smoothed', () => {
  assert.equal(insp6.summary.pagesUnlocked, 0)
  assert.equal(insp6.summary.structuralConversions, 0)
  assert.equal(insp6.summary.newlyFirstPartyDocumented, 0)
  assert.match(insp6.summary.finding, /open-access ceiling/)
  assert.match(String(insp6.inspected[0].honestNote), /unlocks nothing/)
})

test('private passages and refusal reasons do not enter built output', () => {
  const leaked = execFileSync('bash', ['-lc',
    "find .next/server .next/static -type f \\( -name '*.js' -o -name '*.html' \\) -print0 2>/dev/null | xargs -0 grep -l 'observedContent\\|refusalReason\\|superlativesExcluded\\|routesConsideredAndRejected\\|honestNote' 2>/dev/null || true"],
  { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(leaked, '', `private fields must not reach built output: ${leaked}`)
  for (const file of ['inspections', 'retrieval-registry']) {
    const blob = readFileSync(resolve(ROOT, `content/evidence-batch-6/${file}.json`), 'utf8')
    for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})
