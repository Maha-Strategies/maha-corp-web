import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import cohort from '../content/religion/tamil-source-atlas/research-cohort-v1.json' with { type: 'json' }
import inspection from '../content/religion/tamil-source-atlas/inspection-record-v1.json' with { type: 'json' }
import scaling from '../content/scaling/strong-domain-expansion-2026-09-04.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { MAYON_TOPICS } from '../lib/mayon-topics.ts'
import { TAMIL_CLASSICAL_TOPICS } from '../lib/tamil-classical-traditions.ts'
import {
  TAMIL_SOURCE_ATLAS_ANSWERS,
  TAMIL_SOURCE_ATLAS_PATH,
  TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY,
  TAMIL_SOURCE_ATLAS_QUALITY,
  TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST,
  TAMIL_SOURCE_ATLAS_REGISTRY_PATH,
  TAMIL_SOURCE_ATLAS_TOPICS,
  tamilSourceAtlasTopicPath,
} from '../lib/tamil-source-atlas.ts'
import { TIRUVAYMOLI_ATLAS_TOPICS } from '../lib/tiruvaymoli-passage-atlas.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('the frozen Tamil source atlas implements exactly 48 nonduplicative topics', () => {
  assert.equal(cohort.frozen, true)
  assert.equal(TAMIL_SOURCE_ATLAS_TOPICS.length, 48)
  assert.deepEqual(TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => topic.slug), cohort.topicSlugs)
  assert.equal(new Set(TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => topic.slug)).size, 48)
  const existing = new Set([...MAYON_TOPICS, ...TAMIL_CLASSICAL_TOPICS, ...TIRUVAYMOLI_ATLAS_TOPICS].map((topic) => topic.slug))
  assert.deepEqual(TAMIL_SOURCE_ATLAS_TOPICS.filter((topic) => existing.has(topic.slug)), [])
  assert.deepEqual(
    Object.fromEntries(['paripatal-passage', 'landscape-relationship', 'divine-name-map', 'reception-lineage'].map((category) => [category, TAMIL_SOURCE_ATLAS_TOPICS.filter((topic) => topic.category === category).length])),
    cohort.categories,
  )
})

test('every topic passes the evidence and information-value gate', () => {
  assert.equal(TAMIL_SOURCE_ATLAS_QUALITY.length, 48)
  assert.equal(TAMIL_SOURCE_ATLAS_QUALITY.every((item) => item.eligible && item.informationDimensions === 9 && item.blockers.length === 0), true)
  for (const topic of TAMIL_SOURCE_ATLAS_TOPICS) {
    assert.ok(topic.directAnswer.length >= 220)
    assert.equal(topic.distinctions.length, 3)
    assert.equal(topic.limitations.length, 3)
    assert.equal(topic.unresolvedQuestions.length, 2)
    assert.equal(topic.relatedSlugs.length, 3)
    assert.ok(topic.bridgePaths.length >= 3)
    assert.ok(topic.evidence.length > 0)
    assert.ok(topic.evidence.every((item) => item.locator.length >= 8 && item.supports.length > 40 && item.boundary.length > 40))
    assert.ok(topic.evidence.every((item) => String(item.frame) !== 'bibliographic-record'))
  }
})

test('the atlas publishes four unique bounded answers per topic', () => {
  assert.equal(TAMIL_SOURCE_ATLAS_ANSWERS.length, 192)
  assert.equal(new Set(TAMIL_SOURCE_ATLAS_ANSWERS.map((answer) => answer.question.normalize('NFC').toLocaleLowerCase('en-US'))).size, 192)
  for (const topic of TAMIL_SOURCE_ATLAS_TOPICS) {
    assert.equal(TAMIL_SOURCE_ATLAS_ANSWERS.filter((answer) => answer.topicSlug === topic.slug).length, 4)
  }
})

test('the high-value Māyōṉ and mullai priority question is answered without claiming universal priority', () => {
  const topic = TAMIL_SOURCE_ATLAS_TOPICS.find((item) => item.slug === 'fourfold-landscape-sequence')
  assert.ok(topic)
  assert.equal(topic.question, 'Which inspected text first associates Māyōṉ with mullai?')
  assert.match(topic.directAnswer, /earliest direct anchor is Tolkāppiyam Akattiṇaiyiyal 5/)
  assert.match(topic.directAnswer, /“Earliest” is bounded to the inspected sources/)
})

test('primary text, translation, scholarship, and prohibited shortcuts remain explicit', () => {
  assert.match(inspection.newInspection.finding, /Tamil primary text, not as an English translation/)
  assert.equal(inspection.reusedCommittedInspections.length, 5)
  assert.match(inspection.failedReinspection.result, /HTTP 429/)
  assert.match(JSON.stringify(inspection.prohibitedShortcuts), /Translate unrendered Tamil silently/)
  const paripatal = TAMIL_SOURCE_ATLAS_TOPICS.filter((topic) => topic.category === 'paripatal-passage')
  assert.equal(paripatal.length, 20)
  assert.ok(paripatal.every((topic) => /not a silent translation|not as an English translation|not a complete translation/.test(topic.directAnswer)))
  assert.doesNotMatch(JSON.stringify(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY), /expert-approved|externally verified|independent expert review completed/i)
})

test('the public registry is deterministic and carries no private operational material', () => {
  assert.equal(provenanceDigest(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY), TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST)
  assert.equal(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY.topics.length, 48)
  assert.equal(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY.answers.length, 192)
  assert.equal(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY.independentExpertReview, false)
  assert.doesNotMatch(JSON.stringify(TAMIL_SOURCE_ATLAS_PUBLIC_REGISTRY), /reviewerEmail|service_role|release.authority|access.token|retrievalFailures/i)
})

test('the route, hub, and registry expose canonical source-bound surfaces', () => {
  const topicPage = read('app/knowledge/religion/tamil-source-atlas/[slug]/page.tsx')
  const hub = read('app/knowledge/religion/tamil-source-atlas/page.tsx')
  const registry = read('app/knowledge/religion/tamil-source-atlas/registry/route.ts')
  assert.match(topicPage, /generateStaticParams/)
  assert.match(topicPage, /alternates: \{ canonical: path \}/)
  assert.match(topicPage, /ScholarlyArticle/)
  assert.match(topicPage, /FAQPage/)
  assert.match(topicPage, /Exact locator/)
  assert.match(hub, /alternates: \{ canonical: TAMIL_SOURCE_ATLAS_PATH \}/)
  assert.match(registry, /TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST/)
})

test('sitemap and llms index exactly fifty Tamil source-atlas surfaces', () => {
  const sitemap = read('app/sitemap.ts')
  const llms = read('lib/llms-manifest.ts')
  assert.match(sitemap, /TAMIL_SOURCE_ATLAS_TOPICS\.map/)
  assert.match(sitemap, /TAMIL_SOURCE_ATLAS_REGISTRY_PATH/)
  assert.match(llms, /TAMIL_SOURCE_ATLAS_TOPICS\.map/)
  assert.match(llms, /TAMIL_SOURCE_ATLAS_REGISTRY_PATH/)
  assert.equal(new Set(TAMIL_SOURCE_ATLAS_TOPICS.map(tamilSourceAtlasTopicPath)).size + 2, 50)
})

test('the existing religion discovery surfaces link into the atlas', () => {
  for (const path of [
    'app/knowledge/religion/page.tsx',
    'app/knowledge/religion/[slug]/page.tsx',
    'app/knowledge/religion/comparisons/[slug]/page.tsx',
    'app/knowledge/religion/mayon/page.tsx',
    'app/knowledge/religion/tamil-classical-traditions/page.tsx',
    'app/knowledge/religion/tiruvaymoli/page.tsx',
  ]) assert.match(read(path), /TAMIL_SOURCE_ATLAS_PATH/, path)
})

test('the scaling ledger counts the atlas as prepared, not public', () => {
  assert.deepEqual(scaling.localUnpublishedTranche.tamilSourceAtlas, {
    topics: 48,
    roots: 1,
    registries: 1,
    crawlableSurfaces: 50,
    boundedAnswers: 192,
    categories: { paripatalPassages: 20, landscapeRelationships: 12, divineNameMaps: 8, receptionLineages: 8 },
  })
  assert.ok(scaling.localUnpublishedTranche.totalCrawlableSurfaces >= scaling.localUnpublishedTranche.tamilSourceAtlas.crawlableSurfaces)
  assert.equal(scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment, scaling.baseline.derivedCurrentRoutes + scaling.localUnpublishedTranche.totalCrawlableSurfaces)
  assert.equal(scaling.localUnpublishedTranche.projectedGapToTarget, scaling.target - scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment)
  assert.equal(scaling.localUnpublishedTranche.publicNow, false)
  assert.equal(cohort.publicNow, false)
  assert.equal(cohort.vercelBuildAuthorized, false)
  assert.equal(TAMIL_SOURCE_ATLAS_PATH, '/knowledge/religion/tamil-source-atlas')
  assert.equal(TAMIL_SOURCE_ATLAS_REGISTRY_PATH, '/knowledge/religion/tamil-source-atlas/registry')
})
