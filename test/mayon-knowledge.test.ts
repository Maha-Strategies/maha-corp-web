import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import cohort from '../content/religion/mayon/research-cohort-v1.json' with { type: 'json' }
import inspection from '../content/religion/mayon/inspection-record-v1.json' with { type: 'json' }

import {
  MAYON_CLAIMS,
  MAYON_CONNECTIONS,
  MAYON_GOVERNANCE,
  MAYON_KNOWLEDGE_PATH,
  MAYON_MODERN_BRIDGES,
  MAYON_SOURCES,
} from '../lib/mayon-knowledge.ts'
import {
  MAYON_ANSWER_ENTRIES,
  MAYON_ANSWER_REGISTRY_PATH,
  MAYON_CORPUS_DEPTH,
  MAYON_PUBLIC_REGISTRY,
  MAYON_PUBLIC_REGISTRY_DIGEST,
  MAYON_TOPICS,
  MAYON_TOPIC_QUALITY,
  answerMayonQuestion,
  mayonTopicPath,
} from '../lib/mayon-topics.ts'
import { buildLlmsManifest } from '../lib/llms-manifest.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const root = new URL('../', import.meta.url)

test('every Mayon claim is source-bound at an inspected locator with a limitation', () => {
  const sourceIds = new Set(MAYON_SOURCES.map((source) => source.id))
  assert.equal(new Set(MAYON_CLAIMS.map((claim) => claim.id)).size, MAYON_CLAIMS.length)
  assert.equal(MAYON_GOVERNANCE.claimsWithExactLocators, MAYON_CLAIMS.length)
  assert.equal(MAYON_GOVERNANCE.claimsWithBoundaries, MAYON_CLAIMS.length)

  for (const claim of MAYON_CLAIMS) {
    assert.ok(claim.statement.length >= 120, `${claim.id} needs a substantive statement`)
    assert.ok(claim.locator.length >= 30, `${claim.id} needs an exact locator`)
    assert.ok(claim.limitation.length >= 100, `${claim.id} needs a bounded limitation`)
    assert.ok(claim.sourceIds.length > 0, `${claim.id} needs a source`)
    assert.ok(claim.sourceIds.every((id) => sourceIds.has(id)), `${claim.id} cites an unknown source`)
    assert.deepEqual(Object.keys(claim.sourceLocators).sort(), [...claim.sourceIds].sort(), `${claim.id} needs one locator per cited source`)
    assert.ok(Object.values(claim.sourceLocators).every((locator) => locator.length >= 30), `${claim.id} has an incomplete source locator`)
  }
})

test('Mayon sources keep primary text and scholarly interpretation distinct', () => {
  assert.ok(MAYON_SOURCES.some((source) => source.frame === 'primary-text'))
  assert.ok(MAYON_SOURCES.some((source) => source.frame === 'scholarly-interpretation'))
  for (const source of MAYON_SOURCES) {
    assert.match(source.url, /^https:\/\//)
    assert.ok(source.inspectedLocator.length >= 40)
    assert.ok(source.rightsBasis.length >= 40)
    assert.ok(source.establishes.length >= 100)
    assert.ok(source.boundary.length >= 120)
  }
  const bibliographic = MAYON_SOURCES.filter((source) => source.frame === 'bibliographic-record')
  assert.ok(bibliographic.length > 0)
  assert.ok(bibliographic.every((source) => !source.contentInspected && !source.explanatoryEligible))
  const claimSourceIds = new Set(MAYON_CLAIMS.flatMap((claim) => claim.sourceIds))
  assert.ok(bibliographic.every((source) => !claimSourceIds.has(source.id)), 'bibliographic metadata cannot carry an explanatory claim')
})

test('historical deity connections are typed and cannot silently become identity', () => {
  const sourceIds = new Set(MAYON_SOURCES.map((source) => source.id))
  const relationshipTypes = new Set(MAYON_CONNECTIONS.map((connection) => connection.relationship))
  assert.ok(relationshipTypes.has('traditional-identification'))
  assert.ok(relationshipTypes.has('mythic-parallel'))
  assert.ok(relationshipTypes.has('contrastive-co-attestation'))
  assert.ok(!relationshipTypes.has('identity' as never))
  for (const connection of MAYON_CONNECTIONS) {
    assert.ok(connection.sourceIds.length > 0)
    assert.ok(connection.sourceIds.every((id) => sourceIds.has(id)))
    assert.ok(connection.boundary.length >= 70)
  }
})

test('volcano links live only in the modern bridge layer with explicit disambiguation', () => {
  const historical = JSON.stringify(MAYON_CONNECTIONS).toLowerCase()
  const modern = JSON.stringify(MAYON_MODERN_BRIDGES).toLowerCase()
  assert.doesNotMatch(historical, /volcano|volcanic/)
  assert.match(modern, /mayon volcano/)
  assert.match(modern, /the volcanic engine/)
  assert.match(modern, /do not establish an etymological/)
  assert.match(modern, /not evidence about the tamil deity/)
  assert.ok(MAYON_MODERN_BRIDGES.every((bridge) => bridge.path.startsWith('/')))
  assert.equal(new Set(MAYON_MODERN_BRIDGES.map((bridge) => bridge.path)).size, MAYON_MODERN_BRIDGES.length)
  assert.ok(MAYON_GOVERNANCE.prohibitedInferences.some((item) => /shared spelling.*volcano/i.test(item)))
})

test('the Mayon dossier is canonical, reciprocal, crawlable and machine-discoverable', async () => {
  const [page, religionHub, volcanoApp, volcanoProject, sitemap] = await Promise.all([
    readFile(new URL('app/knowledge/religion/mayon/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/page.tsx', root), 'utf8'),
    readFile(new URL('app/apps/mayon/page.tsx', root), 'utf8'),
    readFile(new URL('app/projects/mayon/page.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
  ])
  assert.match(page, /alternates: \{ canonical: MAYON_KNOWLEDGE_PATH \}/)
  assert.match(page, /ScholarlyArticle/)
  assert.match(page, /Modern Maha concept bridges/)
  assert.match(religionHub, /MAYON_KNOWLEDGE_PATH/)
  assert.match(volcanoApp, /knowledge\/religion\/mayon/)
  assert.match(volcanoProject, /knowledge\/religion\/mayon/)
  assert.match(sitemap, /MAYON_KNOWLEDGE_PATH/)
  assert.match(buildLlmsManifest([]), new RegExp(MAYON_KNOWLEDGE_PATH))
  assert.match(buildLlmsManifest([]), new RegExp(MAYON_ANSWER_REGISTRY_PATH))
  for (const topic of MAYON_TOPICS) {
    assert.match(sitemap, /MAYON_TOPICS\.map/)
    assert.match(buildLlmsManifest([]), new RegExp(mayonTopicPath(topic)))
  }
})

test('the public dossier contains no private governance or credential material', async () => {
  const sources = await Promise.all([
    readFile(new URL('lib/mayon-knowledge.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/mayon/page.tsx', root), 'utf8'),
  ])
  const publicText = sources.join('\n')
  for (const forbidden of [
    /service[_-]?role/i,
    /release[_-]?authority[_-]?token/i,
    /reviewer rationale/i,
    /audit corpus/i,
    /source-recovery packet/i,
  ]) assert.doesNotMatch(publicText, forbidden)
})

test('the frozen corpus produces 15 eligible topics and 75 answer contracts', () => {
  assert.equal(cohort.frozen, true)
  assert.equal(cohort.topicSlugs.length, 15)
  assert.equal(cohort.queries.length, 75)
  assert.equal(MAYON_TOPICS.length, 15)
  assert.equal(MAYON_ANSWER_ENTRIES.length, 75)
  assert.equal(MAYON_TOPIC_QUALITY.length, MAYON_TOPICS.length)
  assert.ok(MAYON_TOPIC_QUALITY.every((quality) => quality.eligible))
  assert.ok(MAYON_TOPIC_QUALITY.every((quality) => quality.informationDimensions === 9))
  assert.equal(new Set(MAYON_TOPICS.map((topic) => topic.slug)).size, 15)
  assert.equal(new Set(MAYON_ANSWER_ENTRIES.map((entry) => entry.question.normalize('NFC').toLocaleLowerCase('en-US'))).size, 75)
  assert.ok(MAYON_TOPICS.every((topic) => topic.claimIds.length >= 2))
  assert.ok(MAYON_TOPICS.every((topic) => topic.limitations.length >= 3 && topic.unresolvedQuestions.length >= 2 && topic.relatedSlugs.length >= 3))
  assert.deepEqual(MAYON_CORPUS_DEPTH.before, {
    indexPages: 1,
    topicPages: 0,
    sourceBoundClaims: 5,
    explanatorySources: 3,
    generativeQuestions: 0,
    typedHistoricalConnections: 7,
    modernDisambiguationBridges: 3,
  })
  assert.equal(MAYON_CORPUS_DEPTH.after.topicPages, 15)
  assert.equal(MAYON_CORPUS_DEPTH.after.eligibleTopicPages, 15)
  assert.equal(MAYON_CORPUS_DEPTH.after.sourceBoundClaims, MAYON_CLAIMS.length)
  assert.equal(MAYON_CORPUS_DEPTH.after.generativeQuestions, 75)
  assert.equal(MAYON_CORPUS_DEPTH.after.informationDimensionsPerTopic, 9)
  assert.ok(MAYON_CORPUS_DEPTH.after.claimUsesAcrossTopics > MAYON_CLAIMS.length)
})

test('the inspection ledger keeps failed and metadata-only routes non-explanatory', () => {
  assert.equal(inspection.inspections.length, 5)
  assert.deepEqual(inspection.inspections.map((entry) => entry.sourceId), cohort.sourceCohort.map((entry) => entry.id))
  assert.equal(inspection.inspections.filter((entry) => entry.disposition === 'explanatory-eligible').length, 4)
  assert.equal(inspection.inspections.filter((entry) => entry.disposition === 'bibliographic-only').length, 1)
  assert.equal(inspection.supplementalRoutes.length, 3)
  assert.ok(inspection.supplementalRoutes.every((route) => route.disposition !== 'explanatory-eligible'))
  const explanatoryUrls = new Set(MAYON_SOURCES.filter((source) => source.explanatoryEligible).map((source) => source.url))
  assert.ok(inspection.supplementalRoutes.every((route) => !explanatoryUrls.has(route.url)))
})

test('all 75 frozen generative questions resolve deterministically to inspected evidence', () => {
  const explanatorySourceIds = new Set(MAYON_SOURCES.filter((source) => source.contentInspected && source.explanatoryEligible).map((source) => source.id))
  for (const entry of MAYON_ANSWER_ENTRIES) {
    assert.deepEqual(answerMayonQuestion(entry.question), entry)
    assert.deepEqual(answerMayonQuestion(`  ${entry.question.toLocaleUpperCase('en-US')}  `), entry)
    assert.ok(entry.answer.length >= 220)
    assert.ok(entry.citations.length > 0)
    assert.ok(entry.citations.every((citation) => explanatorySourceIds.has(citation.sourceId)))
    assert.ok(entry.citations.every((citation) => citation.locator.length >= 30))
    assert.ok(entry.citations.every((citation) => !/Yamashita.*Project Madurai|Project Madurai.*Yamashita/.test(citation.locator)), 'one citation cannot inherit another source’s locator')
    assert.ok(entry.notEstablished.length >= 60)
  }
  assert.equal(answerMayonQuestion('Invent an unsupported Māyōṉ genealogy'), undefined)
})

test('the public registry digest is reproducible and load-bearing', () => {
  assert.equal(provenanceDigest(MAYON_PUBLIC_REGISTRY), MAYON_PUBLIC_REGISTRY_DIGEST)
  assert.notEqual(provenanceDigest({ ...MAYON_PUBLIC_REGISTRY, name: `${MAYON_PUBLIC_REGISTRY.name} changed` }), MAYON_PUBLIC_REGISTRY_DIGEST)
  assert.match(MAYON_PUBLIC_REGISTRY_DIGEST, /^sha256:[a-f0-9]{64}$/)
})

test('adversarial identity questions preserve the evidence boundary', () => {
  const krishna = answerMayonQuestion('Is Māyōṉ Krishna?')
  assert.equal(krishna?.answerClass, 'source-bound-interpretation')
  assert.match(krishna?.answer ?? '', /does not support replacing every occurrence/i)
  assert.match(krishna?.notEstablished ?? '', /particular poem|passage|modern name/i)

  const dravidian = answerMayonQuestion('Can Māyōṉ be described as a purely Dravidian deity?')
  assert.equal(dravidian?.answerClass, 'disputed-or-ambiguous')
  assert.match(dravidian?.answer ?? '', /not accurate.*pure|not accurate.*isolated/i)
  assert.match(dravidian?.notEstablished ?? '', /contact|adaptation|continuity/i)

  const volcano = answerMayonQuestion('Was Mayon Volcano named after Māyōṉ?')
  assert.equal(volcano?.answerClass, 'modern-disambiguation')
  assert.match(volcano?.answer ?? '', /No inspected source establishes/i)
  assert.match(volcano?.answer ?? '', /editorial, not historical evidence/i)
  assert.doesNotMatch(JSON.stringify(volcano?.citations ?? []), /volcano|volcanic/i)
})

test('primary texts cannot silently certify history, metaphysics or universal practice', () => {
  const primaryClaims = MAYON_CLAIMS.filter((claim) => claim.frame === 'primary-text')
  assert.ok(primaryClaims.length > 0)
  for (const claim of primaryClaims) {
    assert.match(claim.limitation, /not|does not/i)
    assert.doesNotMatch(claim.statement, /proved|certainly|universally true|historical fact/i)
  }
  assert.ok(MAYON_GOVERNANCE.prohibitedInferences.some((item) => /historical or supernatural event/i.test(item)))
})

test('topic and registry routes expose public answer data without private evidence material', async () => {
  const [topicPage, registryRoute, topics] = await Promise.all([
    readFile(new URL('app/knowledge/religion/mayon/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/religion/mayon/registry/route.ts', root), 'utf8'),
    readFile(new URL('lib/mayon-topics.ts', root), 'utf8'),
  ])
  assert.match(topicPage, /dynamicParams = false/)
  assert.match(topicPage, /generateStaticParams/)
  assert.match(topicPage, /Claim-level provenance/)
  assert.match(topicPage, /FAQPage/)
  assert.match(topicPage, /Questions this guide answers/)
  assert.match(topicPage, /Bibliographic controls · not explanatory evidence/)
  assert.match(registryRoute, /force-static/)
  assert.match(registryRoute, /MAYON_PUBLIC_REGISTRY_DIGEST/)
  const publicText = [topicPage, registryRoute, topics, JSON.stringify(MAYON_PUBLIC_REGISTRY)].join('\n')
  for (const forbidden of [/service[_-]?role/i, /release[_-]?authority[_-]?token/i, /reviewer rationale/i, /audit corpus/i, /private passage/i]) {
    assert.doesNotMatch(publicText, forbidden)
  }
})
