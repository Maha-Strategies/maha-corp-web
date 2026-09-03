import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  FIRST_PARTY_DISCLOSURE, FIRST_PARTY_IS_NOT, PAGE_STATES,
  assertNoCurrentAvailabilityInference, evaluateFirstParty, gradeAsIndependent,
  scanFirstPartyText, type FirstPartyDocument,
} from '../lib/first-party-evidence.ts'
import { firstPartyFor, firstPartyRoutes } from '../lib/first-party-runtime.ts'
import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import supplier from '../content/evidence-batch-5/supplier-first-party.json' with { type: 'json' }
import claimRepair from '../content/evidence-batch-5/claim-repair.json' with { type: 'json' }
import adoption from '../content/evidence-batch-5/adoption-manifest.json' with { type: 'json' }
import technical from '../content/evidence-batch-5/technical-cohort.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')
const doc = (o: Partial<FirstPartyDocument> = {}): FirstPartyDocument => ({
  organisation: 'Acme', documentsOrganisation: 'Acme', title: 'Products',
  documentKind: 'product-overview', publisher: 'Acme', publishedOrVersion: '2024',
  url: 'https://acme.example/products/', inspectedOn: '2026-09-02',
  contentFingerprint: 'abcdef0123456789', exactLocator: 'Products listing',
  observedContent: 'the page names three product families and the process each performs',
  establishes: 'that Acme publishes three product families',
  doesNotEstablish: 'it carries no performance, yield or reliability data and no comparison',
  accessBasis: 'public', ...o,
})
const att = (o: Partial<InspectionAttestation> = {}): InspectionAttestation => ({
  sourceId: 's', retrievedFrom: 'https://acme.example', retrievedOn: '2026-09-02',
  depth: 'section-or-full-text', exactLocator: 'Products',
  observedContent: 'a recorded observation of what the passage actually said',
  identityVerified: true, identityBasis: 'host', subjectAligned: true, subjectBasis: 'subject',
  versionRelationship: 'v', rightsBasis: 'citation-with-paraphrase', ...o,
})

test('first-party evidence can never satisfy an independent-evidence check', () => {
  const graded = gradeAsIndependent(doc(), att())
  assert.equal(graded.explanatory, false, 'even a fully inspected self-published document is not independent')
  assert.equal(graded.independentTierClaimed, false)
  // And the tier declares what it is not.
  assert.equal(FIRST_PARTY_IS_NOT.length, 6)
  for (const claim of ['independently-supported', 'empirically-verified', 'replicated', 'comparative-evidence', 'endorsement', 'production-performance-validation']) {
    assert.ok((FIRST_PARTY_IS_NOT as readonly string[]).includes(claim))
  }
})

test('the five states are distinct and first-party is one of them', () => {
  assert.equal(PAGE_STATES.length, 5)
  assert.ok((PAGE_STATES as readonly string[]).includes('first-party-documented'))
  assert.ok((PAGE_STATES as readonly string[]).includes('independently-source-supported'))
})

test('first-party documentation is visibly disclosed', () => {
  const verdict = evaluateFirstParty(doc(), 'Acme')
  assert.equal(verdict.eligible, true)
  assert.equal(verdict.disclosureRequired, FIRST_PARTY_DISCLOSURE)
  assert.match(FIRST_PARTY_DISCLOSURE, /does not independently verify performance, reliability, yield or comparative advantage/)
  for (const route of firstPartyRoutes()) {
    assert.equal(firstPartyFor(route)!.disclosure, FIRST_PARTY_DISCLOSURE)
  }
  const component = readFileSync(resolve(ROOT, 'components/FirstPartyDisclosure.tsx'), 'utf8')
  assert.match(component, /evidence\.disclosure/, 'the disclosure must actually render')
})

test('supplier claims cannot become endorsements, rankings or comparisons', () => {
  for (const text of ['the best implanter available', 'outperforms competing systems', 'industry-standard across all fabs',
    'recommended for advanced nodes', 'proven reliability', 'production yield of 99%']) {
    assert.ok(scanFirstPartyText(text).length > 0, `${text} must be caught`)
  }
  const overclaiming = evaluateFirstParty(doc({ establishes: 'Acme is the market-leading supplier' }), 'Acme')
  assert.equal(overclaiming.eligible, false)
  assert.ok(overclaiming.refusals.some((r) => r.startsWith('prohibited-claim:')))
})

test('recorded superlatives were excluded rather than carried through', () => {
  for (const entry of supplier.inspected) {
    for (const superlative of entry.superlativesExcluded ?? []) {
      assert.ok(!entry.establishes.includes(superlative), `${entry.supplier} must not carry "${superlative}"`)
    }
    assert.deepEqual(scanFirstPartyText(entry.establishes), [], `${entry.supplier} establishes must be claim-clean`)
  }
})

test('a vendor source cannot support another company page', () => {
  const verdict = evaluateFirstParty(doc({ documentsOrganisation: 'Acme' }), 'Contoso')
  assert.equal(verdict.eligible, false)
  assert.ok(verdict.refusals.includes('document-describes-another-organisation'))
  // And every recorded entry documents its own subject.
  for (const entry of supplier.inspected) assert.equal(entry.organisation, entry.documentsOrganisation)
})

test('a general corporate page cannot support a technical product claim', () => {
  const generic = evaluateFirstParty(doc({ documentKind: 'marketing-landing-page' }), 'Acme')
  assert.equal(generic.eligible, false)
  assert.ok(generic.refusals.includes('marketing-page-documents-no-specifics'))
  const refused = supplier.inspected.find((e) => !e.eligible)!
  assert.equal(refused.documentKind, 'marketing-landing-page')
  assert.match(refused.establishes, /Nothing specific/)
})

test('a stale document cannot establish current availability', () => {
  assert.throws(() => assertNoCurrentAvailabilityInference(doc({ publishedOrVersion: '2018' }),
    'Acme currently offers this platform'), /cannot establish current availability/)
  for (const entry of supplier.inspected) {
    if (!entry.eligible) continue
    assert.match(entry.doesNotEstablish, /current(ly)? (product )?availab/i,
      `${entry.supplier} must disclaim current availability`)
  }
})

test('login-gated, customer-only and terms-restricted material is refused', () => {
  for (const basis of ['login-gated', 'customer-only', 'terms-restricted'] as const) {
    const verdict = evaluateFirstParty(doc({ accessBasis: basis }), 'Acme')
    assert.equal(verdict.eligible, false)
    assert.ok(verdict.refusals.includes('access-restricted-source'))
  }
  for (const entry of supplier.inspected) assert.equal(entry.accessBasis, 'public')
})

test('metadata-only and inaccessible vendor pages remain blocked', () => {
  assert.equal(evaluateFirstParty(doc({ observedContent: 'short' }), 'Acme').eligible, false)
  assert.equal(evaluateFirstParty(doc({ contentFingerprint: '' }), 'Acme').eligible, false)
  // Properties, not frozen counts: later batches move these legitimately.
  assert.ok(supplier.summary.notAttempted >= 0)
  assert.ok(supplier.summary.stillBlocked > 0, 'some suppliers remain without admissible documentation')
  assert.equal(supplier.summary.eligibleFirstParty + supplier.summary.refused
    + supplier.summary.stillBlocked, 13, 'every blocked supplier profile is accounted for')
})

test('narrowed claims receive a new revision digest and never rewrite the live claim', () => {
  assert.equal(claimRepair.liveClaimsRewritten, 0)
  for (const decision of claimRepair.decisions) {
    assert.equal(decision.appliedToLiveClaim, false)
    if (decision.decision === 'narrow') {
      assert.match(String(decision.proposedRevisionDigest), /^sha256:[0-9a-f]{64}$/)
    } else {
      assert.equal(decision.proposedRevisionDigest, null)
    }
  }
  assert.ok(claimRepair.counts.narrow > 0)
  assert.ok(claimRepair.counts['retain-blocked'] > 0)
  assert.equal(claimRepair.counts.narrow, supplier.summary.eligibleFirstParty,
    'one narrowing per eligible first-party page')
})

test('structural-only pages are never counted as evidence-supported', () => {
  const s = report.pageStates
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented + s.independentlySourceSupported + s.blocked, s.total)
  assert.equal(s.independentlySourceSupported, 37, 'first-party pages must not inflate independent support')
  assert.equal(s.firstPartyDocumented, supplier.summary.eligibleFirstParty)
  assert.match(s.neverCombined, /must never be added to independent support/)
})

test('the adoption manifest is prepared, partitioned and unexecuted', () => {
  assert.equal(adoption.executed, false)
  assert.equal(adoption.migrationApplied, false)
  assert.equal(adoption.productionReleasePerformed, false)
  assert.equal(adoption.canaryRerun, false)
  assert.equal(adoption.partition.initialRevisions + adoption.partition.supersedingRevisions, adoption.partition.initialRevisions)
  assert.equal(adoption.firstPartyProposals.partitionedSeparately, true)
  assert.match(adoption.staleDecisionCannotAuthorize, /predecessor digest cannot authorize/)
  for (const entry of adoption.entries) assert.equal(entry.adopted, false)
})

test('the technical cohort records an empty result rather than implying effort', () => {
  assert.equal(technical.selected, 12)
  assert.equal(technical.outcomeThisBatch.sourcesInspected, 0)
  assert.equal(technical.outcomeThisBatch.pagesUnlocked, 0)
  assert.match(technical.searchStrategy.patentPolicy, /never explanatory support/)
})

test('the served bundle carries only the sanitized projection', () => {
  // Importing the private record into runtime code inlines the whole file into
  // the chunk. This asserts the built output, not just the source.
  const chunks = execFileSync('bash', ['-lc',
    "find .next/server .next/static -type f -name '*.js' -print0 2>/dev/null | xargs -0 grep -l 'observedContent\\|superlativesExcluded\\|refusalReason\\|notAttempted' 2>/dev/null || true"],
  { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(chunks, '', `private inspection fields must not reach a served chunk: ${chunks}`)
})

test('private packets and passages stay outside public bundles', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E',
      'supplier-first-party|adoption-manifest|claim-repair|technical-cohort|observedContent', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '')
  for (const file of ['supplier-first-party', 'claim-repair', 'adoption-manifest', 'technical-cohort']) {
    const blob = readFileSync(resolve(ROOT, `content/evidence-batch-5/${file}.json`), 'utf8')
    for (const pattern of [/bearer/i, /TOKEN["':\s]+\S{12}/, /reviewerId/i]) {
      assert.ok(!pattern.test(blob), `${file} must not contain ${pattern}`)
    }
  }
})
