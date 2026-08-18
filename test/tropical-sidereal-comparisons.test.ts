import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  TROPICAL_SIDEREAL_COMPARISON_CATEGORIES,
  TROPICAL_SIDEREAL_COMPARISON_PATH,
  TROPICAL_SIDEREAL_COMPARISONS,
  TROPICAL_SIDEREAL_COMPARISON_SOURCES,
  getTropicalSiderealComparison,
  tropicalSiderealComparisonPath,
} from '../lib/tropical-sidereal-comparisons.ts'

const root = new URL('../', import.meta.url)

test('the frame-comparison collection is deliberately small, unique, and balanced', () => {
  assert.equal(TROPICAL_SIDEREAL_COMPARISONS.length, 12)
  assert.ok(TROPICAL_SIDEREAL_COMPARISONS.length < 20)
  assert.equal(new Set(TROPICAL_SIDEREAL_COMPARISONS.map((entry) => entry.slug)).size, 12)
  assert.deepEqual(new Set(TROPICAL_SIDEREAL_COMPARISONS.map((entry) => entry.category)), new Set(TROPICAL_SIDEREAL_COMPARISON_CATEGORIES))
  for (const category of TROPICAL_SIDEREAL_COMPARISON_CATEGORIES) {
    assert.equal(TROPICAL_SIDEREAL_COMPARISONS.filter((entry) => entry.category === category).length, 3)
  }
})

test('every comparison exposes both models and preserves the exact disagreement', () => {
  const sourceIds = new Set(TROPICAL_SIDEREAL_COMPARISON_SOURCES.map((source) => source.id))
  for (const entry of TROPICAL_SIDEREAL_COMPARISONS) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(entry.description.length >= 100, `${entry.slug} needs a substantive description`)
    assert.ok(entry.sharedInputs.length >= 5, `${entry.slug} needs five shared inputs`)
    assert.ok(entry.sharedFacts.length >= 140, `${entry.slug} needs a shared fact substrate`)
    assert.ok(entry.tropicalView.length >= 120, `${entry.slug} needs a tropical view`)
    assert.ok(entry.siderealView.length >= 120, `${entry.slug} needs a sidereal view`)
    assert.ok(entry.agreement.length >= 110, `${entry.slug} needs explicit agreement`)
    assert.ok(entry.disagreement.length >= 120, `${entry.slug} needs explicit disagreement`)
    assert.ok(entry.preservationPolicy.length >= 110, `${entry.slug} needs a preservation policy`)
    assert.ok(entry.prohibitedSynthesis.length >= 110, `${entry.slug} needs a prohibited synthesis`)
    assert.match(entry.evaluationRequirement, /preregistered/)
    assert.equal(entry.empiricalStatus, 'parallel-unvalidated-models')
    assert.ok(entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.slug} cites an unknown source`)
    assert.ok(entry.relatedSlugs.every((slug) => getTropicalSiderealComparison(slug)), `${entry.slug} has an unknown related comparison`)
    assert.equal(tropicalSiderealComparisonPath(entry), `${TROPICAL_SIDEREAL_COMPARISON_PATH}/${entry.slug}`)
  }
})

test('the collection forbids post-hoc blending and keeps performance empirical', () => {
  const combined = TROPICAL_SIDEREAL_COMPARISONS.map((entry) => `${entry.preservationPolicy} ${entry.prohibitedSynthesis} ${entry.evaluationRequirement}`).join(' ')
  assert.match(combined, /Do not average/)
  assert.match(combined, /after the fact/)
  assert.match(combined, /prospective scoring/)
  assert.match(combined, /multiplicity control/)
  assert.match(getTropicalSiderealComparison('prospective-model-scoring')?.disagreement ?? '', /remain explicit/)
})

test('comparison pages are static, canonical, linked, registered, and in the sitemap', async () => {
  const [route, index, component, parentGuide, birthOutput, sitemap, registry] = await Promise.all([
    readFile(new URL('app/knowledge/astrology/tropical-vs-sidereal/comparisons/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/tropical-vs-sidereal/comparisons/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/tropical-vs-sidereal/comparisons/TropicalSiderealComparisonPage.tsx', root), 'utf8'),
    readFile(new URL('lib/celestial-guides.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/birth/BirthForm.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/tropical-vs-sidereal/comparisons/registry/route.ts', root), 'utf8'),
  ])
  assert.match(route, /generateStaticParams/)
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /alternates: \{ canonical: path \}/)
  assert.match(index, /Preserve the disagreement/)
  assert.match(component, /Where they disagree/)
  assert.match(component, /Prohibited synthesis/)
  assert.match(component, /TechArticle/)
  assert.match(parentGuide, /tropical-vs-sidereal\/comparisons/)
  assert.match(birthOutput, /Frame disagreements/)
  assert.match(sitemap, /TROPICAL_SIDEREAL_COMPARISONS/)
  assert.match(registry, /tropical-sidereal-comparisons\/1\.0/)
})
