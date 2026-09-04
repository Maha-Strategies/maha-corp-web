import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import cohort from '../content/religion/tiruvaymoli-passage-atlas/research-cohort-v1.json' with { type: 'json' }
import inspection from '../content/religion/tiruvaymoli-passage-atlas/inspection-record-v1.json' with { type: 'json' }
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

test('the frozen cohort contains twenty complete, ordered units and one explicit exception', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS.length, 20)
  assert.deepEqual(TIRUVAYMOLI_ATLAS_TOPICS.map((item) => item.slug), cohort.topicSlugs)
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS[0].range, '2791–2801')
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS.at(-1)?.range, '3002–3012')
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS.some((item) => item.range === '2967–2979'), true)
  assert.match(cohort.selectionBasis, /exceptional 2967-2979 unit/)
})

test('all source roles are inspected and keep translation separate from scholarship', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_SOURCES.length, 2)
  assert.deepEqual(TIRUVAYMOLI_ATLAS_SOURCES.map((source) => source.frame), ['primary-text-in-translation', 'attributed-scholarship'])
  assert.equal(TIRUVAYMOLI_ATLAS_SOURCES.every((source) => source.contentInspected), true)
  assert.equal(inspection.inspections.every((item) => item.locator.length > 30 && item.boundary.length > 80), true)
  assert.match(TIRUVAYMOLI_ATLAS_SOURCES[0].boundary, /not the untranslated Tamil/)
})

test('one hundred unique questions remain passage-bound and fully cited', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_ANSWERS.length, 100)
  assert.equal(new Set(TIRUVAYMOLI_ATLAS_ANSWERS.map((item) => item.question.toLowerCase())).size, 100)
  for (const topic of TIRUVAYMOLI_ATLAS_TOPICS) {
    const answers = getTiruvaymoliAtlasAnswers(topic.slug)
    assert.equal(answers.length, 5)
    assert.equal(answers.every((answer) => answer.passageRange === topic.range), true)
    assert.equal(answers.every((answer) => answer.citations.length === 2), true)
    assert.equal(answers.every((answer) => answer.evidenceFrame === 'primary-text-in-translation'), true)
  }
})

test('every passage page clears the ten-dimension quality gate without word-count padding', () => {
  assert.equal(TIRUVAYMOLI_ATLAS_QUALITY.length, 20)
  assert.equal(TIRUVAYMOLI_ATLAS_QUALITY.every((item) => item.eligible && item.informationDimensions === 10 && item.blockers.length === 0), true)
  assert.equal(TIRUVAYMOLI_ATLAS_TOPICS.every((item) => item.observations.length === 3 && item.limitations.length === 3 && item.relatedSlugs.length === 3), true)
})

test('related routes resolve and no topic duplicates either existing Tamil cluster', () => {
  const atlasSlugs = new Set(TIRUVAYMOLI_ATLAS_TOPICS.map((item) => item.slug))
  const existing = new Set([...MAYON_TOPICS, ...TAMIL_CLASSICAL_TOPICS].map((item) => item.slug))
  assert.equal([...atlasSlugs].some((slug) => existing.has(slug)), false)
  for (const topic of TIRUVAYMOLI_ATLAS_TOPICS) {
    assert.equal(topic.relatedSlugs.every((slug) => atlasSlugs.has(slug)), true)
  }
})

test('the public registry is digest-bound and carries no inspection narrative', () => {
  assert.equal(provenanceDigest(TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY), TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST)
  const publicRegistry = JSON.stringify(TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY)
  for (const forbidden of ['reviewerId', 'observedContent', 'supportingPassage', 'authorizationBasis', 'service_role']) assert.doesNotMatch(publicRegistry, new RegExp(forbidden, 'i'))
})

test('route generation, canonical metadata and public sections are explicit', () => {
  const source = read('app/knowledge/religion/tiruvaymoli/[slug]/page.tsx')
  assert.match(source, /dynamicParams = false/)
  assert.match(source, /generateStaticParams/)
  assert.match(source, /alternates: \{ canonical: path \}/)
  for (const section of ['Direct answer', 'Passage map', 'Poetic voice', 'Indexed names', 'Does not establish', 'Questions this passage guide answers', 'Limits', 'Still unresolved', 'Related passage guides']) assert.match(source, new RegExp(section))
})

test('sitemap and llms include exactly the reviewed atlas arrays', () => {
  const sitemap = read('app/sitemap.ts')
  const llms = read('lib/llms-manifest.ts')
  assert.match(sitemap, /TIRUVAYMOLI_ATLAS_TOPICS\.map/)
  assert.match(sitemap, /TIRUVAYMOLI_ATLAS_REGISTRY_PATH/)
  assert.match(llms, /TIRUVAYMOLI_ATLAS_TOPICS\.map/)
  assert.match(llms, /Tiruvāymoḻi machine-readable answer registry/)
})

test('the local scaling tranche keeps observations separate from projections', () => {
  assert.equal(scaling.baseline.derivedNotObserved, true)
  const religionTopics = MAYON_TOPICS.length + TAMIL_CLASSICAL_TOPICS.length + TIRUVAYMOLI_ATLAS_TOPICS.length
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
