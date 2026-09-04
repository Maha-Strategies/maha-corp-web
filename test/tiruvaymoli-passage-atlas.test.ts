import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import cohort from '../content/religion/tiruvaymoli-passage-atlas/research-cohort-v1.json' with { type: 'json' }
import continuation from '../content/religion/tiruvaymoli-passage-atlas/continuation-cohort-v2.json' with { type: 'json' }
import continuationInspection from '../content/religion/tiruvaymoli-passage-atlas/continuation-inspection-v2.json' with { type: 'json' }
import inspection from '../content/religion/tiruvaymoli-passage-atlas/inspection-record-v1.json' with { type: 'json' }
import reconciliation from '../content/scaling/tiruvaymoli-continuation-route-reconciliation-2026-09-04.json' with { type: 'json' }
import scaling from '../content/scaling/strong-domain-expansion-2026-09-04.json' with { type: 'json' }
import { MAYON_TOPICS } from '../lib/mayon-topics.ts'
import { TAMIL_CLASSICAL_TOPICS } from '../lib/tamil-classical-traditions.ts'
import {
  TIRUVAYMOLI_ATLAS_ANSWERS,
  TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY,
  TIRUVAYMOLI_ATLAS_QUALITY,
  TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST,
  TIRUVAYMOLI_ATLAS_SOURCES,
  TIRUVAYMOLI_ATLAS_TOPICS,
  getTiruvaymoliAtlasAnswers,
} from '../lib/tiruvaymoli-passage-atlas.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8')

test('the original twenty-unit freeze remains byte-for-byte ordered', () => {
  assert.equal(cohort.topicSlugs.length, 20)
  assert.deepEqual(TIRUVAYMOLI_ATLAS_TOPICS.slice(0, 20).map((item) => item.slug), cohort.topicSlugs)
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS[0].range, '2791–2801')
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS[19].range, '3002–3012')
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS.some((item) => item.range === '2967–2979'), true)
  assert.match(cohort.selectionBasis, /exceptional 2967-2979 unit/)
})

test('the continuation contains exactly twenty-six consecutive complete printed units', () => {
  const topics = TIRUVAYMOLI_ATLAS_TOPICS.slice(20)
  assert.equal(topics.length, 26)
  assert.deepEqual(topics.map((item) => item.slug), continuation.topicSlugs)
  assert.equal(topics[0].range, '3013–3023')
  assert.equal(topics.at(-1)?.range, '3288–3298')
  topics.forEach((topic, index) => {
    const [start, end] = topic.range.split('–').map(Number)
    assert.equal(end - start + 1, 11, `${topic.slug} must contain eleven printed pāsurams`)
    assert.equal(start, 3013 + index * 11, `${topic.slug} must remain in source order`)
    assert.equal(end, 3023 + index * 11, `${topic.slug} must end at its printed boundary`)
  })
  assert.match(continuation.selectionBasis, /twenty-six consecutive complete printed/)
})

test('all source roles are inspected and keep translation separate from scholarship', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_SOURCES.length, 2)
  assert.deepEqual(TIRUVAYMOLI_ATLAS_SOURCES.map((source) => source.frame), ['primary-text-in-translation', 'attributed-scholarship'])
  assert.equal(TIRUVAYMOLI_ATLAS_SOURCES.every((source) => source.contentInspected), true)
  assert.equal(inspection.inspections.every((item) => item.locator.length > 30 && item.boundary.length > 80), true)
  assert.equal(continuationInspection.coverage.completeUnits, 26)
  assert.equal(continuationInspection.coverage.boundedQuestions, 130)
  assert.equal(continuationInspection.inspections.every((item) => item.locator.length > 30 && item.boundary.length > 80), true)
  assert.match(TIRUVAYMOLI_ATLAS_SOURCES[0].boundary, /not the untranslated Tamil/)
})

test('230 unique questions remain passage-bound and fully cited', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_ANSWERS.length, 230)
  assert.equal(new Set(TIRUVAYMOLI_ATLAS_ANSWERS.map((item) => item.question.toLowerCase())).size, 230)
  assert.equal(TIRUVAYMOLI_ATLAS_ANSWERS.filter((item) => Number(item.passageRange.split('–')[0]) >= 3013).length, 130)
  for (const topic of TIRUVAYMOLI_ATLAS_TOPICS) {
    const answers = getTiruvaymoliAtlasAnswers(topic.slug)
    assert.equal(answers.length, 5)
    assert.equal(answers.every((answer) => answer.passageRange === topic.range), true)
    assert.equal(answers.every((answer) => answer.citations.length === 2), true)
    assert.equal(answers.every((answer) => answer.citations[0].role === 'passage-source' && answer.citations[1].role === 'context-only'), true)
    assert.equal(answers.every((answer) => /not the wording or detailed interpretation/.test(answer.citations[1].supports)), true)
    assert.equal(answers.every((answer) => answer.evidenceFrame === 'primary-text-in-translation'), true)
  }
})

test('every passage page clears the thirteen-dimension quality gate without word-count padding', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_QUALITY.length, 46)
  assert.equal(TIRUVAYMOLI_ATLAS_QUALITY.every((item) => item.eligible && item.informationDimensions === 13 && item.blockers.length === 0), true)
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS.every((item) => item.observations.length === 3 && item.limitations.length === 3 && item.relatedSlugs.length === 3), true)
})

test('related routes resolve and no topic duplicates either existing Tamil cluster', () => {
  const atlasSlugs = new Set(TIRUVAYMOLI_ATLAS_TOPICS.map((item) => item.slug))
  const existing = new Set([...MAYON_TOPICS, ...TAMIL_CLASSICAL_TOPICS].map((item) => item.slug))
  assert.equal([...atlasSlugs].some((slug) => existing.has(slug)), false)
  for (const topic of TIRUVAYMOLI_ATLAS_TOPICS) {
    assert.equal(topic.relatedSlugs.every((slug) => atlasSlugs.has(slug)), true)
    assert.equal(topic.relatedSlugs.includes(topic.slug), false)
    assert.equal(topic.mayonSlugs.every((slug) => MAYON_TOPICS.some((item) => item.slug === slug)), true)
    assert.equal(topic.classicalSlugs.every((slug) => TAMIL_CLASSICAL_TOPICS.some((item) => item.slug === slug)), true)
  }
})

test('every continuation route links the core Mayon identity field and Alvar context', () => {
  const continuationTopics = TIRUVAYMOLI_ATLAS_TOPICS.slice(20)
  for (const topic of continuationTopics) {
    assert.deepEqual(['who-is-mayon', 'mayon-and-tirumal', 'mayon-and-krishna', 'mayon-and-vishnu'].every((slug) => topic.mayonSlugs.includes(slug)), true)
    assert.deepEqual(['who-are-the-alvars', 'nammalvar-and-the-tiruvaymoli'].every((slug) => topic.classicalSlugs.includes(slug)), true)
    assert.ok(topic.place.length > 70)
    assert.ok(topic.devotionalContext.length > 100)
    assert.match(topic.identityRelationship, /Co-occurrence does not make them context-free synonyms/)
  }
})

test('sensitive poetic frames cannot become medical, historical, or comparative claims', () => {
  const requiredBoundaries = {
    'anangu-ritual-and-the-friends-counsel-3178-3188': /does not diagnose illness|medical care|prove a ritual ineffective/,
    'worldly-suffering-and-release-3211-3221': /does not quantify suffering|authorize self-harm|replace medical/,
    'thirukkuruhur-and-religious-polemic-3222-3232': /does not objectively disprove|authorize hostility/,
    'collective-devotion-and-yuga-renewal-3244-3254': /does not date a yuga|authorize discrimination/,
    'the-daughters-divine-first-person-3288-3298': /does not diagnose possession|prove literal creation/,
  } as const
  for (const [slug, boundary] of Object.entries(requiredBoundaries)) {
    const topic = TIRUVAYMOLI_ATLAS_TOPICS.find((item) => item.slug === slug)
    assert.ok(topic)
    assert.match(topic.notEstablished, boundary)
  }
})

test('the public registry is digest-bound and carries no inspection narrative', () => {
  assert.equal(provenanceDigest(TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY), TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST)
  assert.deepEqual(TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY.cohortDigests, {
    original: provenanceDigest(cohort),
    continuation: provenanceDigest(continuation),
  })
  const publicRegistry = JSON.stringify(TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY)
  for (const forbidden of ['reviewerId', 'observedContent', 'supportingPassage', 'authorizationBasis', 'service_role']) assert.doesNotMatch(publicRegistry, new RegExp(forbidden, 'i'))
})

test('route generation, canonical metadata and public sections are explicit', () => {
  const source = read('app/knowledge/religion/tiruvaymoli/[slug]/page.tsx')
  assert.match(source, /dynamicParams = false/)
  assert.match(source, /generateStaticParams/)
  assert.match(source, /alternates: \{ canonical: path \}/)
  assert.match(source, /narayana-occurrence-map/)
  assert.match(source, /narayana-in-the-later-tamil-corpus/)
  for (const section of ['Direct answer', 'Passage map', 'Place and poetic voice', 'Divine names and identity relationships', 'Devotional context', 'Evidence layers', 'Primary text', 'Named translation', 'Scholarship', 'Historical inference', 'Theology', 'Does not establish', 'Questions this passage guide answers', 'Limits', 'Still unresolved', 'Related passage guides']) assert.match(source, new RegExp(section))
})

test('sitemap and llms include exactly the reviewed atlas arrays', () => {
  const sitemap = read('app/sitemap.ts')
  const llms = read('lib/llms-manifest.ts')
  assert.match(sitemap, /TIRUVAYMOLI_ATLAS_TOPICS\.map/)
  assert.match(sitemap, /TIRUVAYMOLI_ATLAS_REGISTRY_PATH/)
  assert.match(llms, /TIRUVAYMOLI_ATLAS_TOPICS\.map/)
  assert.match(llms, /Tiruvāymoḻi machine-readable answer registry/)
})

test('the historical scaling tranche stays internally consistent after the immutable continuation', () => {
  assert.equal(scaling.baseline.derivedNotObserved, true)
  const religionTopics = MAYON_TOPICS.length + TAMIL_CLASSICAL_TOPICS.length + cohort.topicSlugs.length
  const religionAnswers = scaling.localUnpublishedTranche.mayon.boundedAnswers
    + scaling.localUnpublishedTranche.classicalTamil.boundedAnswers
    + scaling.localUnpublishedTranche.tiruvaymoliAtlas.boundedAnswers
  const religionSurfaces = scaling.localUnpublishedTranche.mayon.crawlableSurfaces
    + scaling.localUnpublishedTranche.classicalTamil.crawlableSurfaces
    + scaling.localUnpublishedTranche.tiruvaymoliAtlas.crawlableSurfaces
  assert.equal(religionTopics, 51)
  assert.equal(religionAnswers, 255)
  assert.equal(religionSurfaces, 57)
  assert.ok(scaling.localUnpublishedTranche.totalTopicPages >= religionTopics)
  assert.ok(scaling.localUnpublishedTranche.totalBoundedAnswers >= religionAnswers)
  assert.ok(scaling.localUnpublishedTranche.totalCrawlableSurfaces >= religionSurfaces)
  assert.equal(
    scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment,
    scaling.baseline.derivedCurrentRoutes + scaling.localUnpublishedTranche.totalCrawlableSurfaces,
  )
  assert.equal(scaling.localUnpublishedTranche.publicNow, false)
})

test('the operator-reported 974-route baseline plus this batch projects exactly 1,000', () => {
  assert.equal(reconciliation.reportedAvailableRoutesBeforeBatch, 974)
  assert.equal(reconciliation.continuation.topicPages, 26)
  assert.equal(reconciliation.continuation.boundedAnswers, 130)
  assert.equal(reconciliation.continuation.newCrawlableRoutes, 26)
  assert.equal(reconciliation.reportedAvailableRoutesBeforeBatch + reconciliation.continuation.newCrawlableRoutes, 1000)
  assert.equal(reconciliation.projectedAvailableRoutesAfterApprovedBuildAndDeployment, 1000)
  assert.equal(reconciliation.continuation.publicNow, false)
  assert.equal(reconciliation.buildAuthorized, false)
  assert.equal(reconciliation.deploymentAuthorized, false)
})

test('astrology is a bounded demand-led lane rather than an empirical or predictive claim', () => {
  const astrology = scaling.rankedExpansionAreas.find((area) => area.area === 'Astrology traditions and celestial interpretation')
  assert.ok(astrology)
  assert.equal(astrology.rank, 3)
  assert.deepEqual(astrology.existingFootprint, {
    traditions: 4,
    celestialGuides: 5,
    calculationReferences: 42,
    timingReferences: 36,
    corporateMundaneReferences: 30,
    tropicalSiderealComparisons: 12,
    totalModeledItems: 129,
  })
  assert.match(astrology.nextCapacity, /only uncovered question-led guides/)
  assert.match(astrology.risk, /no personalized prediction or scientific validation is implied/i)
})

test('no Vercel action is authorized by the scaling report', () => {
  assert.match(scaling.releaseRule, /explicit approval/)
  assert.match(read('docs/operations/strong-domain-scaling-2026-09-04.md'), /no Vercel build or deployment is\s+authorized/i)
})
