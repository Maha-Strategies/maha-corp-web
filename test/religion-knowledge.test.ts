import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { MATHEMATICAL_CONCEPTS } from '../lib/mathematics-knowledge.ts'
import {
  RELIGION_CATEGORIES,
  RELIGION_COMPARISONS,
  RELIGION_CONCEPTS,
  RELIGION_KNOWLEDGE_REGISTRY,
  RELIGION_MATHEMATICS_BRIDGES,
  RELIGION_SOURCES,
  religionComparisonPath,
  religionConceptPath,
} from '../lib/religion-knowledge.ts'

const root = new URL('../', import.meta.url)

test('the opening religion collection contains exactly 18 methodology-first concepts', () => {
  assert.equal(RELIGION_CONCEPTS.length, 18)
  assert.equal(new Set(RELIGION_CONCEPTS.map((item) => item.id)).size, 18)
  assert.equal(new Set(RELIGION_CONCEPTS.map((item) => item.slug)).size, 18)
  const sources = new Set(RELIGION_SOURCES.map((item) => item.id))
  const slugs = new Set(RELIGION_CONCEPTS.map((item) => item.slug))
  const mathematics = new Set(MATHEMATICAL_CONCEPTS.map((item) => item.id))
  for (const category of RELIGION_CATEGORIES) assert.ok(RELIGION_CONCEPTS.some((item) => item.category === category), `${category} needs coverage`)
  for (const item of RELIGION_CONCEPTS) {
    assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(item.definition.length >= 180, `${item.slug} needs a substantive definition`)
    assert.ok(item.questions.length >= 3)
    assert.ok(item.evidenceInputs.length >= 3)
    assert.ok(item.method.length >= 3)
    assert.ok(item.establishes.length >= 2)
    assert.ok(item.doesNotEstablish.length >= 2)
    assert.ok(item.interpretiveRisks.length >= 2)
    assert.ok(item.sourceIds.every((id) => sources.has(id)))
    assert.ok(item.relatedSlugs.every((slug) => slugs.has(slug)))
    assert.ok(item.mathematicalConceptIds.every((id) => mathematics.has(`mathematics-${id}`)))
    assert.equal(religionConceptPath(item), `/knowledge/religion/${item.slug}`)
  }
})

test('the comparison corpus preserves asymmetry and prohibits validity transfer', () => {
  assert.equal(RELIGION_COMPARISONS.length, 8)
  assert.equal(new Set(RELIGION_COMPARISONS.map((item) => item.id)).size, 8)
  const slugs = new Set(RELIGION_CONCEPTS.map((item) => item.slug))
  for (const item of RELIGION_COMPARISONS) {
    assert.ok(item.perspectives.length >= 2)
    assert.ok(item.sharedAxes.length >= 3)
    assert.ok(item.nonEquivalences.length >= 2)
    assert.ok(item.comparisonMethod.length >= 3)
    assert.ok(item.prohibitedInference.length >= 70)
    assert.ok(item.relatedConceptSlugs.every((slug) => slugs.has(slug)))
    assert.equal(religionComparisonPath(item), `/knowledge/religion/comparisons/${item.slug}`)
  }
  const payload = JSON.stringify(RELIGION_KNOWLEDGE_REGISTRY).toLowerCase()
  assert.match(payload, /does not rank traditions/)
  assert.match(payload, /metaphysical/)
  assert.match(payload, /divine agency/)
  assert.match(payload, /first-person/)
  assert.match(payload, /empirical/)
})

test('mathematical bridges are explicit and cannot certify spiritual claims', () => {
  assert.equal(RELIGION_MATHEMATICS_BRIDGES.length, 12)
  const concepts = new Set(RELIGION_CONCEPTS.map((item) => item.id))
  const mathematics = new Set(MATHEMATICAL_CONCEPTS.map((item) => item.id))
  for (const item of RELIGION_MATHEMATICS_BRIDGES) {
    assert.ok(concepts.has(item.religionConceptId))
    assert.ok(mathematics.has(`mathematics-${item.mathematicalConceptId}`))
    assert.ok(item.inputs.length >= 3)
    assert.ok(item.outputs.length >= 3)
    assert.ok(item.limitations.length >= 80)
  }
  assert.ok(RELIGION_MATHEMATICS_BRIDGES.some((item) => item.relation === 'empirical-method'))
  assert.ok(RELIGION_MATHEMATICS_BRIDGES.some((item) => item.relation === 'formal-analogy'))
  assert.ok(RELIGION_MATHEMATICS_BRIDGES.some((item) => item.relation === 'ritual-calculation'))
})

test('institutional methodology sources declare authority and boundary', () => {
  assert.ok(RELIGION_SOURCES.length >= 8)
  for (const source of RELIGION_SOURCES) {
    assert.match(source.url, /^https:\/\//)
    assert.ok(source.establishes.length >= 120)
    assert.ok(source.boundary.length >= 120)
  }
})

test('religion routes are static, canonical, linked, registered, and in the sitemap', async () => {
  const [concept, comparison, index, comparisons, registry, hub, mathematics, sitemap] = await Promise.all([
    readFile(new URL('app/knowledge/religion/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/comparisons/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/comparisons/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/registry/route.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/mathematics/page.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
  ])
  for (const route of [concept, comparison]) {
    assert.match(route, /generateStaticParams/)
    assert.match(route, /dynamicParams = false/)
    assert.match(route, /alternates: \{ canonical: path \}/)
  }
  assert.match(index, /Study authority, practice, and experience/)
  assert.match(index, /No metaphysical certification/)
  assert.match(comparisons, /Compare claims without making them equivalent/)
  assert.match(registry, /RELIGION_KNOWLEDGE_REGISTRY/)
  assert.match(hub, /Religion and contemplative traditions/)
  assert.match(mathematics, /New connected domain/)
  assert.match(sitemap, /RELIGION_CONCEPTS/)
  assert.match(sitemap, /RELIGION_COMPARISONS/)
})
