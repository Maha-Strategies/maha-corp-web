import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { MATHEMATICAL_CONCEPTS, MATHEMATICS_SOURCES } from '../lib/mathematics-knowledge.ts'
import { ASTRONOMY_ARTICLES, ASTRONOMY_SOURCES } from '../lib/astronomy-knowledge.ts'

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const insp = read('content/evidence-batch-14/inspections.json')
const audit = read('content/evidence-batch-9/depth-audit.json')
const status = read('content/legacy-uplift/evidence-status-public.json')
const compiled = read('content/legacy-uplift/uplift-compiled.json')

const NEW_PAGES = [
  '/knowledge/mathematics/gamma-function',
  '/knowledge/mathematics/error-function-and-related-integrals',
  '/knowledge/mathematics/bessel-functions',
  '/knowledge/mathematics/bernoulli-and-euler-numbers',
  '/knowledge/astronomy/asteroseismology-and-stellar-interiors',
]

test('new pages are born supported, not added to the unsupported pile', () => {
  for (const route of NEW_PAGES) {
    const verdict = audit.verdicts.find((v: { route: string }) => v.route === route)
    assert.ok(verdict, `${route} is not in the audit`)
    assert.equal(verdict.state, 'substantial-and-evidence-backed',
      `${route} was added without evidence; a new page must arrive supported`)
  }
})

test('growth improved the evidence-backed share rather than diluting it', () => {
  // The point of expanding here rather than elsewhere. Adding pages that cite
  // nobody would have made the ratio worse, which is the failure mode.
  const supported = status.counts['independently-supported']
  const uninspected = status.counts['cited-but-uninspected']
  assert.ok(supported >= 36, `supported fell to ${supported}`)
  assert.ok(uninspected <= 98, `uninspected rose to ${uninspected}; expansion added unsupported pages`)
})

test('every claim on a new page is bound to an inspected passage', () => {
  const supportedRoutes = new Set<string>(
    insp.inspected.flatMap((s: { claimByClaimSupport?: { route: string }[] }) =>
      (s.claimByClaimSupport ?? []).map((c) => c.route)))
  for (const route of NEW_PAGES) {
    assert.ok(supportedRoutes.has(route), `${route} has no claim-level passage`)
  }
  for (const source of insp.inspected) {
    for (const claim of source.claimByClaimSupport ?? []) {
      assert.ok(claim.supportingPassage.length > 80, `${claim.route}: passage too short to be one`)
      assert.ok(claim.locator.length > 0, `${claim.route}: no locator`)
      assert.equal(claim.distinctPassage, true)
    }
  }
})

test('sources were identity-verified before inspection, and carry a boundary', () => {
  for (const s of insp.inspected) {
    assert.equal(s.identityVerified, true, `${s.sourceId} was read without verifying identity`)
    assert.ok(s.identityBasis.length > 30, `${s.sourceId} does not say how identity was checked`)
    assert.ok(s.boundary.length > 60, `${s.sourceId} does not state what it cannot establish`)
    assert.equal(s.depth, 'section-or-full-text')
    assert.match(s.rightsBasis, /without circumventing/)
  }
})

test('an inspected source is held back rather than moving a frozen digest', () => {
  // The astronomy source is ready and unattached. Its route is a Phase 4 pilot
  // record whose manifest carries a frozen sha256 recomputed from live data, so
  // attaching any source to it moves that digest. Updating a release-governance
  // freeze to fit a content addition is a decision for a person.
  const held = insp.heldBack.find((s: { sourceId: string }) => s.sourceId === 'nasa-exoplanet-methods')
  assert.ok(held, 'the held-back source must be recorded, not silently dropped')
  assert.equal(held.depth, 'section-or-full-text')
  assert.equal(held.claimByClaimSupport.length, 0, 'a held-back source supports nothing')
  assert.match(held.notAttachedReason, /frozen/i)
  assert.ok(!JSON.stringify(compiled.pages).includes('nasa-exoplanet-methods'),
    'a held-back source must not appear on any page')
})

test('abstract-level reading is not recorded as inspection', () => {
  // The asteroseismology review was identified but only its abstract was read.
  const deferred = insp.notInspected.find((n: { sourceId: string }) => n.sourceId === 'aerts-2020-asteroseismology')
  assert.ok(deferred, 'the deferred source must be recorded')
  assert.match(deferred.reason, /abstract/i)
  const inspectedIds = new Set(insp.inspected.map((s: { sourceId: string }) => s.sourceId))
  assert.ok(!inspectedIds.has('aerts-2020-asteroseismology'))
  assert.ok(!JSON.stringify(compiled.pages).includes('aerts-2020-asteroseismology'),
    'a source read only at abstract level must not appear on any page')
})

test('the new sources declare what they establish and what they do not', () => {
  const added = [
    ...MATHEMATICS_SOURCES.filter((s) => ['nist-dlmf-gamma', 'nist-dlmf-error-function'].includes(s.id)),
    ...ASTRONOMY_SOURCES.filter((s) => s.id === 'nasa-exoplanet-methods'),
  ]
  assert.ok(added.length >= 3)
  for (const s of added) {
    assert.ok(s.establishes.length > 60, `${s.id} does not say what it establishes`)
    assert.ok(s.boundary.length > 60, `${s.id} does not say what it cannot establish`)
  }
})

test('the new concepts carry their conditions, not just their formulas', () => {
  const added = MATHEMATICAL_CONCEPTS.filter((c) => ['gamma-function',
    'error-function-and-related-integrals', 'bessel-functions', 'bernoulli-and-euler-numbers'].includes(c.slug))
  assert.equal(added.length, 4)
  for (const c of added) {
    assert.ok(c.assumptions.length > 0, `${c.slug} states no conditions`)
    assert.ok(c.errorBounds.length > 0, `${c.slug} states no error behaviour`)
    assert.ok(c.doesNotEstablish.length > 60, `${c.slug} does not say what it cannot establish`)
    // Every invariant names the equation it comes from.
    for (const inv of c.invariants) {
      assert.match(inv, /DLMF \d+\.\d+\.\d+/, `${c.slug}: an invariant with no equation number: ${inv}`)
    }
  }
})

test('the gamma page states that Stirling is asymptotic, not convergent', () => {
  // The most load-bearing limitation in the chapter, and the one a reader is
  // most likely to get wrong.
  const gamma = MATHEMATICAL_CONCEPTS.find((c) => c.slug === 'gamma-function')!
  assert.match(gamma.errorBounds.join(' '), /asymptotic expansion, not a convergent series/i)
})

test('the registry guard allows growth but still catches loss', () => {
  const src = readFileSync('lib/mathematics-knowledge.ts', 'utf8')
  assert.match(src, /MATHEMATICAL_CONCEPTS\.length < 24/,
    'the concept count must be a floor, so the corpus can grow')
  assert.ok(!/MATHEMATICAL_CONCEPTS\.length !== \d+/.test(src),
    'an exact concept count blocks legitimate growth')
  assert.ok(MATHEMATICAL_CONCEPTS.length >= 26)
})

test('every declared astronomy relationship reaches the page', () => {
  // The generator read relatedSlugs, which astronomy does not have. All 71
  // declared relationships across all 24 articles were silently dropped, and
  // the family fell back on co-citation.
  const declared = ASTRONOMY_ARTICLES.reduce((n, a) => n + a.relatedArticleIds.length, 0)
  const rendered = compiled.pages
    .filter((p: { route: string }) => p.route.startsWith('/knowledge/astronomy/'))
    .reduce((n: number, p: { after?: { relatedRoutes?: string[] } }) => n + (p.after?.relatedRoutes ?? []).length, 0)
  assert.equal(rendered, declared, `${declared} relationships are declared but ${rendered} render`)
  assert.ok(declared > 60, 'the astronomy family must actually declare relationships')
})

test('the Bernoulli page explains a gap on the gamma page, both sides sourced', () => {
  // Stirling at 5.11.1 is indexed by even numbers because the odd Bernoulli
  // coefficients vanish by 24.2.2. Neither half is asserted without a passage.
  const bernoulli = insp.inspected.find((s: { sourceId: string }) => s.sourceId === 'nist-dlmf-bernoulli')
  assert.ok(bernoulli.crossPageNote, 'the connection must be recorded')
  assert.match(bernoulli.crossPageNote, /5\.11\.1/)
  assert.match(bernoulli.crossPageNote, /24\.2\.2/)
})

test('the astronomy page does not claim what its source declines to explain', () => {
  const nasa = insp.inspected.find((s: { sourceId: string }) => s.sourceId === 'nasa-asteroseismology')
  assert.match(nasa.notCovered, /does not explain why the oscillations occur/)
  const page = compiled.pages.find((p: { route: string }) =>
    p.route === '/knowledge/astronomy/asteroseismology-and-stellar-interiors')
  const text = JSON.stringify(page.sections)
  assert.match(text, /driving mechanism is not established/,
    'the page must say the mechanism is unestablished rather than quietly omitting it')
})
