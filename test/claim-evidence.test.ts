import assert from 'node:assert/strict'
import test from 'node:test'

import { ASTRONOMY_ARTICLES, ASTRONOMY_EVIDENCE_STATES } from '../lib/astronomy-knowledge.ts'
import { CLAIM_EMPIRICAL, CLAIM_EMPIRICAL_META, CLAIM_PROVENANCE, CLAIM_PROVENANCE_META, requiresBoundary, toMpsTag } from '../lib/claim-evidence.ts'
import { KNOWLEDGE_ARTICLES } from '../lib/knowledge-data.ts'

test('both axes are fully described', () => {
  for (const provenance of CLAIM_PROVENANCE) assert.ok(CLAIM_PROVENANCE_META[provenance].description.length > 20)
  for (const empirical of CLAIM_EMPIRICAL) assert.ok(CLAIM_EMPIRICAL_META[empirical].description.length > 20)
})

test('the axes are independent: sourcing fidelity does not imply empirical support', () => {
  // The case that a single axis cannot express, and the reason this primitive
  // exists: a faithful transcription of a source that is itself weak evidence.
  const vendor = { provenance: 'restates-source', empirical: 'interested-party' } as const
  const independent = { provenance: 'restates-source', empirical: 'established' } as const

  assert.equal(vendor.provenance, independent.provenance)
  assert.notEqual(vendor.empirical, independent.empirical)
  assert.ok(requiresBoundary(vendor), 'vendor-only support must carry a boundary')
  assert.ok(!requiresBoundary(independent))
})

test('astronomy evidence states stay a subset of the shared empirical axis', () => {
  // Guards against a knowledge layer quietly reintroducing a private vocabulary.
  for (const state of ASTRONOMY_EVIDENCE_STATES) {
    assert.ok(CLAIM_EMPIRICAL.includes(state), `${state} is not on the shared empirical axis`)
  }
})

test('every semiconductor claim carries both axes and a boundary where required', () => {
  for (const article of KNOWLEDGE_ARTICLES) {
    for (const claim of article.claims) {
      assert.ok(CLAIM_PROVENANCE.includes(claim.provenance), `${claim.id} provenance`)
      assert.ok(CLAIM_EMPIRICAL.includes(claim.empirical), `${claim.id} empirical`)
      if (requiresBoundary(claim)) assert.ok(claim.boundary, `${claim.id} needs a boundary`)
    }
  }
})

test('every astronomy claim carries both axes', () => {
  for (const article of ASTRONOMY_ARTICLES) {
    for (const claim of article.claims) {
      assert.ok(CLAIM_PROVENANCE.includes(claim.provenance), `${claim.id} provenance`)
      assert.ok(CLAIM_EMPIRICAL.includes(claim.evidenceState), `${claim.id} empirical`)
    }
  }
})

test('uncertainty claims are recorded as Maha framing, not source assertions', () => {
  const uncertainty = ASTRONOMY_ARTICLES.flatMap((article) => article.claims).filter((claim) => claim.id.endsWith('-uncertainty'))
  assert.ok(uncertainty.length > 0)
  for (const claim of uncertainty) assert.equal(claim.provenance, 'maha-inference')
})

test('MPS/0.1 tags derive from the pair', () => {
  assert.equal(toMpsTag({ provenance: 'restates-source', empirical: 'calibrated-measurement' }), 'VERIFIED')
  assert.equal(toMpsTag({ provenance: 'restates-source', empirical: 'established' }), 'SOURCED')
  assert.equal(toMpsTag({ provenance: 'maha-inference', empirical: 'bounded-inference' }), 'BOUNDARY')
  assert.equal(toMpsTag({ provenance: 'restates-source', empirical: 'interested-party' }), 'SOURCED')
})

test('the MPS/0.1 mapping is lossy in exactly the way that motivates 0.2', () => {
  // Well-sourced but empirically unsupported and well-sourced but merely
  // vendor-asserted are different claims. MPS/0.1 has one axis, so the
  // distinction cannot survive the mapping — this is the documented gap.
  const unsupported = { provenance: 'restates-source', empirical: 'interested-party' } as const
  const supported = { provenance: 'restates-source', empirical: 'established' } as const

  assert.equal(toMpsTag(unsupported), toMpsTag(supported))
  assert.notEqual(unsupported.empirical, supported.empirical)
})
