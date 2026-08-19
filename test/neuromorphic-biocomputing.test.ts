import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { MATHEMATICAL_CONCEPTS } from '../lib/mathematics-knowledge.ts'
import { NEUROMORPHIC_CATEGORIES, NEUROMORPHIC_COMPARISONS, NEUROMORPHIC_CONCEPTS, NEUROMORPHIC_MATHEMATICS_BRIDGES, NEUROMORPHIC_REGISTRY, NEUROMORPHIC_SOURCES, neuromorphicComparisonPath, neuromorphicConceptPath } from '../lib/neuromorphic-biocomputing.ts'

const root = new URL('../', import.meta.url)
test('the opening collection contains 20 substrate-aware concepts', () => {
  assert.equal(NEUROMORPHIC_CONCEPTS.length, 20); assert.equal(new Set(NEUROMORPHIC_CONCEPTS.map((item) => item.id)).size, 20); assert.equal(new Set(NEUROMORPHIC_CONCEPTS.map((item) => item.slug)).size, 20)
  const sources = new Set(NEUROMORPHIC_SOURCES.map((item) => item.id)); const slugs = new Set(NEUROMORPHIC_CONCEPTS.map((item) => item.slug)); const mathematics = new Set(MATHEMATICAL_CONCEPTS.map((item) => item.id))
  for (const category of NEUROMORPHIC_CATEGORIES) assert.ok(NEUROMORPHIC_CONCEPTS.some((item) => item.category === category))
  for (const item of NEUROMORPHIC_CONCEPTS) { assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/); assert.ok(item.definition.length >= 180); assert.ok(item.mechanism.length >= 3); assert.ok(item.measurements.length >= 3); assert.ok(item.reproducibilityControls.length >= 3); assert.ok(item.limitations.length >= 2); assert.ok(item.sourceIds.every((id) => sources.has(id))); assert.ok(item.relatedSlugs.every((slug) => slugs.has(slug))); assert.ok(item.mathematicalConceptIds.every((id) => mathematics.has(`mathematics-${id}`))); assert.equal(neuromorphicConceptPath(item), `/knowledge/neuromorphic-biocomputing/${item.slug}`) }
})
test('eight comparisons preserve substrate non-equivalence', () => {
  assert.equal(NEUROMORPHIC_COMPARISONS.length, 8); const slugs = new Set(NEUROMORPHIC_CONCEPTS.map((item) => item.slug))
  for (const item of NEUROMORPHIC_COMPARISONS) { assert.ok(item.sides.length >= 2); assert.ok(item.comparableAxes.length >= 3); assert.ok(item.nonEquivalences.length >= 2); assert.ok(item.procedure.length >= 3); assert.ok(item.prohibitedInference.length >= 100); assert.ok(item.relatedConceptSlugs.every((slug) => slugs.has(slug))); assert.equal(neuromorphicComparisonPath(item), `/knowledge/neuromorphic-biocomputing/comparisons/${item.slug}`) }
  const payload = JSON.stringify(NEUROMORPHIC_REGISTRY).toLowerCase(); assert.match(payload, /consciousness/); assert.match(payload, /sentience/); assert.match(payload, /system boundary/); assert.match(payload, /deployment evidence/)
})
test('fourteen mathematical bridges retain evidence limits', () => {
  assert.equal(NEUROMORPHIC_MATHEMATICS_BRIDGES.length, 14); const concepts = new Set(NEUROMORPHIC_CONCEPTS.map((item) => item.id)); const mathematics = new Set(MATHEMATICAL_CONCEPTS.map((item) => item.id))
  for (const item of NEUROMORPHIC_MATHEMATICS_BRIDGES) { assert.ok(concepts.has(item.neuromorphicConceptId)); assert.ok(mathematics.has(`mathematics-${item.mathematicalConceptId}`)); assert.ok(item.inputs.length >= 3); assert.ok(item.outputs.length >= 3); assert.ok(item.limitations.length >= 90) }
})
test('sources state both evidence and boundary', () => { assert.ok(NEUROMORPHIC_SOURCES.length >= 10); for (const source of NEUROMORPHIC_SOURCES) { assert.match(source.url, /^https:\/\//); assert.ok(source.establishes.length >= 120); assert.ok(source.boundary.length >= 120) } })
test('routes are static, canonical, linked, registered, and discoverable', async () => {
  const [concept, comparison, index, comparisons, registry, hub, mathematics, sitemap] = await Promise.all(['app/knowledge/neuromorphic-biocomputing/[slug]/page.tsx', 'app/knowledge/neuromorphic-biocomputing/comparisons/[slug]/page.tsx', 'app/knowledge/neuromorphic-biocomputing/page.tsx', 'app/knowledge/neuromorphic-biocomputing/comparisons/page.tsx', 'app/knowledge/neuromorphic-biocomputing/registry/route.ts', 'app/knowledge/page.tsx', 'app/knowledge/mathematics/page.tsx', 'app/sitemap.ts'].map((path) => readFile(new URL(path, root), 'utf8')))
  for (const route of [concept, comparison]) { assert.match(route, /generateStaticParams/); assert.match(route, /dynamicParams = false/); assert.match(route, /alternates: \{ canonical: path \}/) }
  assert.match(index, /Compare computation without pretending every substrate is the same/); assert.match(comparisons, /Compare measurements without erasing/); assert.match(registry, /NEUROMORPHIC_REGISTRY/); assert.match(hub, /Neuromorphic and biocomputing/); assert.match(mathematics, /New connected technical domain/); assert.match(sitemap, /NEUROMORPHIC_CONCEPTS/)
})
