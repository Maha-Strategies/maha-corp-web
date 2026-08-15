import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASTRONOMY_ARTICLES,
  ASTRONOMY_EVIDENCE_STATES,
  ASTRONOMY_FACT_FIELDS,
  ASTRONOMY_KNOWLEDGE_REGISTRY,
  ASTRONOMY_KNOWLEDGE_SCHEMA,
  ASTRONOMY_SOURCES,
  ASTRONOMY_TRACKS,
  astronomyArticlePath,
} from '../lib/astronomy-knowledge.ts'
import { buildLlmsManifest } from '../lib/llms-manifest.ts'

test('Astronomy publishes broad foundational coverage', () => {
  assert.ok(ASTRONOMY_ARTICLES.length >= 20)
  for (const track of ASTRONOMY_TRACKS) assert.ok(ASTRONOMY_ARTICLES.some((article) => article.track === track), `${track} needs coverage`)
})

test('every explainer preserves observation, inference, assumptions, and limits', () => {
  const sources = new Set(ASTRONOMY_SOURCES.map((source) => source.id))
  const articles = new Set(ASTRONOMY_ARTICLES.map((article) => article.id))
  for (const article of ASTRONOMY_ARTICLES) {
    assert.ok(article.definition.length >= 120, `${article.id} needs a substantive definition`)
    assert.ok(article.measured.length >= 3)
    assert.ok(article.inferred.length >= 3)
    assert.ok(article.assumptions.length >= 3)
    assert.ok(article.limitations.length >= 3)
    assert.ok(article.factDependencies.length > 0)
    for (const field of article.factDependencies) assert.ok(ASTRONOMY_FACT_FIELDS.includes(field))
    for (const relatedId of article.relatedArticleIds) assert.ok(articles.has(relatedId), `${article.id} has missing relation ${relatedId}`)
    for (const claim of article.claims) {
      assert.ok(ASTRONOMY_EVIDENCE_STATES.includes(claim.evidenceState))
      assert.ok(claim.boundary.length >= 30)
      for (const sourceId of claim.sourceIds) assert.ok(sources.has(sourceId), `${claim.id} has missing source ${sourceId}`)
    }
  }
})

test('sources have explicit authority and boundaries', () => {
  assert.ok(ASTRONOMY_SOURCES.length >= 10)
  for (const source of ASTRONOMY_SOURCES) {
    assert.match(source.url, /^https:\/\//)
    assert.ok(source.establishes.length >= 80)
    assert.ok(source.boundary.length >= 80)
  }
})

test('routes, identifiers, and slugs are unique', () => {
  assert.equal(new Set(ASTRONOMY_ARTICLES.map((article) => article.id)).size, ASTRONOMY_ARTICLES.length)
  assert.equal(new Set(ASTRONOMY_ARTICLES.map(astronomyArticlePath)).size, ASTRONOMY_ARTICLES.length)
  assert.equal(new Set(ASTRONOMY_SOURCES.map((source) => source.id)).size, ASTRONOMY_SOURCES.length)
})

test('registry and schema preserve the hard layer boundary', () => {
  assert.equal(ASTRONOMY_KNOWLEDGE_REGISTRY.articles.length, ASTRONOMY_ARTICLES.length)
  assert.equal(ASTRONOMY_KNOWLEDGE_SCHEMA.properties.articles.minItems, 20)
  assert.equal(ASTRONOMY_KNOWLEDGE_SCHEMA.$defs.article.additionalProperties, false)
  assert.equal(ASTRONOMY_KNOWLEDGE_SCHEMA.$defs.source.additionalProperties, false)
  assert.ok('factLayer' in ASTRONOMY_KNOWLEDGE_SCHEMA.properties)
  const schema = JSON.stringify(ASTRONOMY_KNOWLEDGE_SCHEMA).toLowerCase()
  assert.match(schema, /excluding interpretive traditions/)
  assert.ok(!schema.includes('horoscope'))
  assert.ok(!schema.includes('zodiac'))
})

test('machine readers can discover the fact and Astronomy registries', () => {
  const manifest = buildLlmsManifest([])
  assert.match(manifest, /\/knowledge\/celestial\/schema/)
  assert.match(manifest, /\/knowledge\/astronomy\/registry/)
  assert.match(manifest, /\/knowledge\/astronomy\/schema/)
})
