import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import cohort from '../content/religion/tamil-classical-traditions/research-cohort-v1.json' with { type: 'json' }
import inspection from '../content/religion/tamil-classical-traditions/inspection-record-v1.json' with { type: 'json' }
import { buildLlmsManifest } from '../lib/llms-manifest.ts'
import { MAYON_TOPICS } from '../lib/mayon-topics.ts'
import {
  TAMIL_CLASSICAL_ANSWERS,
  TAMIL_CLASSICAL_CLAIMS,
  TAMIL_CLASSICAL_PATH,
  TAMIL_CLASSICAL_PUBLIC_REGISTRY,
  TAMIL_CLASSICAL_QUALITY,
  TAMIL_CLASSICAL_REGISTRY_DIGEST,
  TAMIL_CLASSICAL_REGISTRY_PATH,
  TAMIL_CLASSICAL_SOURCES,
  TAMIL_CLASSICAL_TOPICS,
  answerTamilClassicalQuestion,
  tamilClassicalTopicPath,
} from '../lib/tamil-classical-traditions.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const root = new URL('../', import.meta.url)

test('the second religion cohort is frozen at 16 eligible topics and 80 deterministic answers', () => {
  assert.equal(cohort.frozen, true)
  assert.equal(cohort.topicSlugs.length, 16)
  assert.equal(cohort.queries.length, 80)
  assert.equal(TAMIL_CLASSICAL_TOPICS.length, 16)
  assert.equal(TAMIL_CLASSICAL_ANSWERS.length, 80)
  assert.equal(TAMIL_CLASSICAL_QUALITY.length, 16)
  assert.ok(TAMIL_CLASSICAL_QUALITY.every((item) => item.eligible))
  assert.ok(TAMIL_CLASSICAL_QUALITY.every((item) => item.informationDimensions === 9))
  assert.equal(new Set(TAMIL_CLASSICAL_TOPICS.map((item) => item.slug)).size, 16)
  assert.equal(new Set(TAMIL_CLASSICAL_ANSWERS.map((item) => item.question.normalize('NFC').toLocaleLowerCase('en-US'))).size, 80)
  assert.deepEqual(TAMIL_CLASSICAL_TOPICS.map((item) => item.slug), cohort.topicSlugs)
})

test('every claim is bound to inspected sources through source-specific locators and a limitation', () => {
  const sourceIds = new Set(TAMIL_CLASSICAL_SOURCES.map((source) => source.id))
  assert.equal(new Set(TAMIL_CLASSICAL_CLAIMS.map((item) => item.id)).size, TAMIL_CLASSICAL_CLAIMS.length)
  for (const item of TAMIL_CLASSICAL_CLAIMS) {
    assert.ok(item.statement.length >= 120, `${item.id} needs a substantive statement`)
    assert.ok(item.limitation.length >= 100, `${item.id} needs a substantive boundary`)
    assert.ok(item.sourceIds.length > 0)
    assert.ok(item.sourceIds.every((id) => sourceIds.has(id)))
    assert.deepEqual(Object.keys(item.sourceLocators).sort(), [...item.sourceIds].sort())
    assert.ok(Object.values(item.sourceLocators).every((locator) => locator.length >= 25))
  }
})

test('primary Tamil text, named translation, and scholarship remain independent evidence frames', () => {
  assert.deepEqual(new Set(TAMIL_CLASSICAL_SOURCES.map((source) => source.frame)), new Set(['primary-text', 'primary-text-in-translation', 'scholarly-interpretation']))
  assert.equal(inspection.inspections.length, 5)
  assert.deepEqual(inspection.inspections.map((item) => item.sourceId), cohort.sourceCohort.map((item) => item.id))
  assert.ok(inspection.inspections.every((item) => item.disposition === 'explanatory-eligible'))
  assert.equal(inspection.independentExpertReview, false)
  for (const source of TAMIL_CLASSICAL_SOURCES) {
    assert.match(source.url, /^https:\/\//)
    assert.ok(source.inspectedLocator.length >= 50)
    assert.ok(source.rightsBasis.length >= 45)
    assert.ok(source.establishes.length >= 140)
    assert.ok(source.boundary.length >= 140)
  }
})

test('all question variants resolve to bounded source-bearing answers', () => {
  for (const entry of TAMIL_CLASSICAL_ANSWERS) {
    assert.deepEqual(answerTamilClassicalQuestion(entry.question), entry)
    assert.deepEqual(answerTamilClassicalQuestion(` ${entry.question.toLocaleUpperCase('en-US')}! `), entry)
    assert.ok(entry.answer.length >= 220)
    assert.ok(entry.claimIds.length >= 2)
    assert.ok(entry.citations.length >= 2)
    assert.ok(entry.citations.every((citation) => citation.locator.length >= 25))
    assert.equal(entry.limitations.length, 3)
    assert.ok(entry.notEstablished.length >= 75)
    assert.equal(entry.relatedPaths.length, 3)
  }
  assert.equal(answerTamilClassicalQuestion('Invent an unchanged Tamil pantheon'), undefined)
})

test('high-demand questions have explicit bounded entries', () => {
  for (const question of [
    'What is tinai in classical Tamil poetry?',
    'Who is Ceyon in the Tolkappiyam?',
    'What is the Paripatal?',
    'How should Mal, Tirumal, Mayan, and Kannan be indexed?',
    'Who are the Alvars?',
    'What is the Nalayira Divya Prabandham?',
    'Who is Nammalvar?',
    'How does Alvar bhakti relate to Sangam poetics?',
  ]) assert.ok(answerTamilClassicalQuestion(question), question)
})

test('the second cluster is reciprocal with the Mayon cluster and contains no duplicate route', () => {
  const mayonSlugs = new Set(MAYON_TOPICS.map((item) => item.slug))
  const secondPaths = new Set(TAMIL_CLASSICAL_TOPICS.map(tamilClassicalTopicPath))
  assert.equal(secondPaths.size, 16)
  assert.ok([...secondPaths].every((path) => !path.startsWith('/knowledge/religion/mayon/')))
  for (const item of TAMIL_CLASSICAL_TOPICS) {
    assert.ok(item.mayonSlugs.length > 0)
    assert.ok(item.mayonSlugs.every((slug) => mayonSlugs.has(slug)))
    assert.ok(item.relatedSlugs.every((slug) => TAMIL_CLASSICAL_TOPICS.some((candidate) => candidate.slug === slug)))
  }
})

test('the registry is digest-bound and never promotes translation or tradition into external verification', () => {
  assert.equal(TAMIL_CLASSICAL_REGISTRY_DIGEST, provenanceDigest(TAMIL_CLASSICAL_PUBLIC_REGISTRY))
  assert.equal(TAMIL_CLASSICAL_PUBLIC_REGISTRY.answers.length, 80)
  assert.equal(TAMIL_CLASSICAL_PUBLIC_REGISTRY.topics.length, 16)
  assert.equal(TAMIL_CLASSICAL_PUBLIC_REGISTRY.claims.length, TAMIL_CLASSICAL_CLAIMS.length)
  assert.match(JSON.stringify(TAMIL_CLASSICAL_PUBLIC_REGISTRY.prohibitedInferences), /Traditional compilation history/)
  assert.doesNotMatch(JSON.stringify(TAMIL_CLASSICAL_PUBLIC_REGISTRY), /expert-approved|externally verified|historical fact confirmed/i)
})

test('topic pages publish canonical, citation, FAQ, limitations, and cross-cluster links', async () => {
  const [rootPage, topicPage, registryRoute] = await Promise.all([
    readFile(new URL('app/knowledge/religion/tamil-classical-traditions/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/tamil-classical-traditions/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/tamil-classical-traditions/registry/route.ts', root), 'utf8'),
  ])
  assert.match(rootPage, /alternates: \{ canonical: TAMIL_CLASSICAL_PATH \}/)
  assert.match(rootPage, /CollectionPage/)
  assert.match(topicPage, /ScholarlyArticle/)
  assert.match(topicPage, /FAQPage/)
  assert.match(topicPage, /Claim-to-source map/)
  assert.match(topicPage, /Do not infer/)
  assert.match(topicPage, /MAYON_KNOWLEDGE_PATH/)
  assert.match(registryRoute, /TAMIL_CLASSICAL_REGISTRY_DIGEST/)
})

test('performing religion pages and hubs provide contextual links into the new cluster', async () => {
  const paths = [
    'app/knowledge/religion/page.tsx',
    'app/knowledge/religion/[slug]/page.tsx',
    'app/knowledge/religion/comparisons/page.tsx',
    'app/knowledge/religion/comparisons/[slug]/page.tsx',
    'app/knowledge/religion/mayon/page.tsx',
    'app/knowledge/religion/mayon/[slug]/page.tsx',
  ]
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, root), 'utf8')))
  assert.ok(sources.every((source) => source.includes('TAMIL_CLASSICAL_PATH')))
  assert.match(sources[1], /textual-authority/)
  assert.match(sources[3], /source-text-and-translation/)
})

test('sitemap and llms manifest include every new route exactly once', async () => {
  const sitemap = await readFile(new URL('app/sitemap.ts', root), 'utf8')
  const llms = buildLlmsManifest([])
  assert.match(sitemap, /TAMIL_CLASSICAL_TOPICS\.map/)
  assert.match(sitemap, /TAMIL_CLASSICAL_REGISTRY_PATH/)
  assert.match(llms, new RegExp(TAMIL_CLASSICAL_PATH))
  assert.match(llms, new RegExp(TAMIL_CLASSICAL_REGISTRY_PATH))
  for (const item of TAMIL_CLASSICAL_TOPICS) assert.equal(llms.split(tamilClassicalTopicPath(item)).length - 1, 1)
})

test('research and inspection artifacts remain private while public code is free of credentials', async () => {
  const publicFiles = [
    'lib/tamil-classical-traditions.ts',
    'app/knowledge/religion/tamil-classical-traditions/page.tsx',
    'app/knowledge/religion/tamil-classical-traditions/[slug]/page.tsx',
    'app/knowledge/religion/tamil-classical-traditions/registry/route.ts',
  ]
  const publicText = (await Promise.all(publicFiles.map((path) => readFile(new URL(path, root), 'utf8')))).join('\n')
  for (const forbidden of [/service[_-]?role/i, /release[_-]?authority/i, /reviewer rationale/i, /source-recovery packet/i, /production database/i]) assert.doesNotMatch(publicText, forbidden)
  const sitemap = await readFile(new URL('app/sitemap.ts', root), 'utf8')
  assert.doesNotMatch(sitemap, /research-cohort-v1|inspection-record-v1/)
})
