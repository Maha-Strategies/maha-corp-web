import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  MATHEMATICAL_BRIDGES,
  MATHEMATICAL_CONCEPTS,
  MATHEMATICS_CATEGORIES,
  MATHEMATICS_DOMAINS,
  MATHEMATICS_KNOWLEDGE_REGISTRY,
  MATHEMATICS_SOURCES,
  getDomainBridges,
  mathematicsConceptPath,
} from '../lib/mathematics-knowledge.ts'
import { KNOWLEDGE_ARTICLES, knowledgeArticlePath } from '../lib/knowledge-data.ts'
import { ASTRONOMY_ARTICLES, astronomyArticlePath } from '../lib/astronomy-knowledge.ts'
import { CALCULATION_REFERENCES, calculationReferencePath } from '../lib/celestial-calculation-references.ts'
import { TIMING_REFERENCES, timingReferencePath } from '../lib/celestial-timing-references.ts'
import { CORPORATE_MUNDANE_REFERENCES, corporateMundaneReferencePath } from '../lib/corporate-mundane-references.ts'
import { TROPICAL_SIDEREAL_COMPARISONS, tropicalSiderealComparisonPath } from '../lib/tropical-sidereal-comparisons.ts'

const root = new URL('../', import.meta.url)

test('the opening mathematics collection contains exactly 24 substantive concepts', () => {
  assert.equal(MATHEMATICAL_CONCEPTS.length, 24)
  assert.equal(new Set(MATHEMATICAL_CONCEPTS.map((concept) => concept.id)).size, 24)
  assert.equal(new Set(MATHEMATICAL_CONCEPTS.map((concept) => concept.slug)).size, 24)
  for (const category of MATHEMATICS_CATEGORIES) assert.ok(MATHEMATICAL_CONCEPTS.some((concept) => concept.category === category), `${category} needs coverage`)

  const sources = new Set(MATHEMATICS_SOURCES.map((source) => source.id))
  const slugs = new Set(MATHEMATICAL_CONCEPTS.map((concept) => concept.slug))
  for (const concept of MATHEMATICAL_CONCEPTS) {
    assert.match(concept.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(concept.definition.length >= 180, `${concept.slug} needs a substantive definition`)
    assert.ok(concept.notation.length >= 2)
    assert.ok(concept.assumptions.length >= 3)
    assert.ok(concept.invariants.length >= 3)
    assert.ok(concept.procedure.length >= 3)
    assert.ok(concept.errorBounds.length >= 3)
    assert.ok(concept.doesNotEstablish.length >= 80)
    assert.ok(concept.sourceIds.every((id) => sources.has(id)), `${concept.slug} has an unknown source`)
    assert.ok(concept.relatedSlugs.every((slug) => slugs.has(slug)), `${concept.slug} has an unknown relation`)
    assert.equal(mathematicsConceptPath(concept), `/knowledge/mathematics/${concept.slug}`)
  }
})

test('the registry publishes 42 typed bridges with balanced domain coverage', () => {
  assert.equal(MATHEMATICAL_BRIDGES.length, 42)
  assert.equal(new Set(MATHEMATICAL_BRIDGES.map((bridge) => bridge.id)).size, 42)
  const conceptIds = new Set(MATHEMATICAL_CONCEPTS.map((concept) => concept.id))
  for (const domain of MATHEMATICS_DOMAINS) assert.equal(getDomainBridges(domain).length, 7, `${domain} should have seven bridges`)
  for (const bridge of MATHEMATICAL_BRIDGES) {
    assert.ok(conceptIds.has(bridge.conceptId), `${bridge.id} has an unknown concept`)
    assert.ok(bridge.inputs.length >= 3)
    assert.ok(bridge.outputs.length >= 3)
    assert.ok(bridge.transformation.length >= 50)
    assert.match(bridge.targetPath, /^\/knowledge\//)
    assert.ok(bridge.limitations.length >= 50)
  }
})

test('every bridge resolves to a published internal knowledge route', () => {
  const published = new Set([
    '/knowledge/astrology', '/knowledge/astrology/registry', '/knowledge/astrology/corporate-mundane',
    '/knowledge/astrology/tropical-vs-sidereal', '/knowledge/maps/semiconductor-manufacturing-process-map',
    '/knowledge/muhurta', '/knowledge/panchanga',
    ...KNOWLEDGE_ARTICLES.map(knowledgeArticlePath),
    ...ASTRONOMY_ARTICLES.map(astronomyArticlePath),
    ...CALCULATION_REFERENCES.map(calculationReferencePath),
    ...TIMING_REFERENCES.map(timingReferencePath),
    ...CORPORATE_MUNDANE_REFERENCES.map(corporateMundaneReferencePath),
    ...TROPICAL_SIDEREAL_COMPARISONS.map(tropicalSiderealComparisonPath),
  ])
  for (const bridge of MATHEMATICAL_BRIDGES) assert.ok(published.has(bridge.targetPath), `${bridge.id} points to unpublished route ${bridge.targetPath}`)
})

test('mathematics is explicitly prevented from laundering validity across domains', () => {
  const payload = JSON.stringify(MATHEMATICS_KNOWLEDGE_REGISTRY).toLowerCase()
  assert.match(payload, /does not transfer scientific validity/)
  assert.match(payload, /formalization-only/)
  assert.match(payload, /predictive validity/)
  assert.match(payload, /causation/)
  assert.ok(MATHEMATICAL_BRIDGES.some((bridge) => bridge.domain === 'astrology-traditions' && bridge.evidenceRole === 'formalization-only'))
  assert.ok(MATHEMATICAL_BRIDGES.some((bridge) => bridge.domain === 'empirical-validation' && bridge.evidenceRole === 'empirical-test'))
})

test('sources declare both authority and boundary', () => {
  assert.ok(MATHEMATICS_SOURCES.length >= 8)
  for (const source of MATHEMATICS_SOURCES) {
    assert.match(source.url, /^https:\/\//)
    assert.ok(source.establishes.length >= 100)
    assert.ok(source.boundary.length >= 100)
  }
})

test('mathematics routes are static, canonical, linked, registered, and in the sitemap', async () => {
  const [route, index, registry, hub, sitemap] = await Promise.all([
    readFile(new URL('app/knowledge/mathematics/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/mathematics/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/mathematics/registry/route.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/page.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
  ])
  assert.match(route, /generateStaticParams/)
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /alternates: \{ canonical: path \}/)
  assert.match(route, /What this does not establish/)
  assert.match(index, /Cross-domain bridge matrix/)
  assert.match(index, /No validity transfer/)
  assert.match(registry, /MATHEMATICS_KNOWLEDGE_REGISTRY/)
  assert.match(hub, /Mathematics knowledge/)
  assert.match(sitemap, /MATHEMATICAL_CONCEPTS/)
})
