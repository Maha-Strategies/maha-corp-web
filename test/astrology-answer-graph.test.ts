import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import cohort from '../content/astrology/answer-graph/cohort-v1.json' with { type: 'json' }
import scaling from '../content/scaling/strong-domain-expansion-2026-09-04.json' with { type: 'json' }
import {
  ASTROLOGY_ANSWER_CATEGORIES,
  ASTROLOGY_ANSWER_PUBLIC_REGISTRY,
  ASTROLOGY_ANSWER_QUALITY,
  ASTROLOGY_ANSWER_REGISTRY_DIGEST,
  ASTROLOGY_ANSWERS,
  astrologyAnswerPath,
  getAstrologyAnswerAuthorities,
  getAstrologyAnswersForAuthority,
  searchAstrologyAnswers,
} from '../lib/astrology-answer-graph.ts'
import { ASTROLOGY_TRADITIONS, astrologyTraditionPath } from '../lib/astrology-traditions.ts'
import { CALCULATION_REFERENCES, calculationReferencePath } from '../lib/celestial-calculation-references.ts'
import { CELESTIAL_GUIDE_LIST } from '../lib/celestial-guides.ts'
import { TIMING_REFERENCES, timingReferencePath } from '../lib/celestial-timing-references.ts'
import { CORPORATE_MUNDANE_REFERENCES, corporateMundaneReferencePath } from '../lib/corporate-mundane-references.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { TROPICAL_SIDEREAL_COMPARISONS, tropicalSiderealComparisonPath } from '../lib/tropical-sidereal-comparisons.ts'

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8')

test('the frozen cohort produces thirty-six stable topic identities and 144 unique question variants', () => {
  assert.equal(ASTROLOGY_ANSWERS.length, 36)
  assert.deepEqual(ASTROLOGY_ANSWERS.map((answer) => answer.slug), cohort.topicSlugs)
  assert.equal(cohort.vercelBuildAuthorized, false)
  const variants = ASTROLOGY_ANSWERS.flatMap((answer) => answer.queryVariants.map((query) => query.toLowerCase()))
  assert.equal(variants.length, 144)
  assert.equal(new Set(variants).size, variants.length)
})

test('each answer clears the gate and synthesizes multiple authority families', () => {
  assert.equal(ASTROLOGY_ANSWER_QUALITY.length, ASTROLOGY_ANSWERS.length)
  assert.equal(ASTROLOGY_ANSWER_QUALITY.every((quality) => quality.eligible && quality.blockers.length === 0), true)
  for (const answer of ASTROLOGY_ANSWERS) {
    const authorities = getAstrologyAnswerAuthorities(answer)
    assert.equal(authorities.length, answer.authorityIds.length)
    assert.ok(authorities.length >= 3)
    assert.ok(new Set(authorities.map((authority) => authority.family)).size >= 2)
    assert.equal(answer.relatedSlugs.length, 3)
  }
})

test('authority resolution points only to the existing public calculation, timing, comparison, corporate, tradition and guide paths', () => {
  const existingPaths = new Set([
    ...CALCULATION_REFERENCES.map(calculationReferencePath),
    ...TIMING_REFERENCES.map(timingReferencePath),
    ...TROPICAL_SIDEREAL_COMPARISONS.map(tropicalSiderealComparisonPath),
    ...CORPORATE_MUNDANE_REFERENCES.map(corporateMundaneReferencePath),
    ...ASTROLOGY_TRADITIONS.map(astrologyTraditionPath),
    ...CELESTIAL_GUIDE_LIST.map((guide) => guide.path),
  ])
  const answerPaths = new Set(ASTROLOGY_ANSWERS.map(astrologyAnswerPath))
  assert.equal(answerPaths.size, ASTROLOGY_ANSWERS.length)
  for (const answer of ASTROLOGY_ANSWERS) {
    for (const authority of getAstrologyAnswerAuthorities(answer)) {
      assert.ok(existingPaths.has(authority.path), `${authority.path} is not an existing authority path`)
      assert.equal(answerPaths.has(authority.path), false)
      assert.ok(authority.establishes.length > 40)
      assert.ok(authority.boundary.length > 40)
    }
  }
})

test('every exact query variant deterministically resolves to its own answer', () => {
  for (const answer of ASTROLOGY_ANSWERS) {
    for (const query of answer.queryVariants) assert.equal(searchAstrologyAnswers(query, 1)[0]?.answer.slug, answer.slug)
  }
  assert.equal(searchAstrologyAnswers('Why is my sign different in Vedic astrology?', 1)[0]?.answer.slug, 'tropical-versus-sidereal-zodiac')
  assert.equal(searchAstrologyAnswers('Can astrology value a company?', 1)[0]?.answer.slug, 'what-a-corporate-chart-cannot-establish')
  assert.deepEqual(searchAstrologyAnswers('the and what', 5), [])
})

test('the graph preserves methodology, tradition, comparison and evaluation as distinct frames', () => {
  assert.deepEqual(new Set(ASTROLOGY_ANSWERS.map((answer) => answer.category)), new Set(ASTROLOGY_ANSWER_CATEGORIES))
  const statuses = new Set(ASTROLOGY_ANSWERS.map((answer) => answer.empiricalStatus))
  assert.deepEqual(statuses, new Set(['methodological-not-predictive', 'documented-unvalidated-tradition', 'parallel-unvalidated-models']))
  assert.equal(ASTROLOGY_ANSWERS.filter((answer) => answer.frame === 'tradition-description').every((answer) => answer.empiricalStatus === 'documented-unvalidated-tradition'), true)
  assert.equal(ASTROLOGY_ANSWERS.filter((answer) => answer.frame === 'frame-comparison').every((answer) => answer.empiricalStatus === 'parallel-unvalidated-models'), true)
})

test('the answer registry is digest-bound and includes only its public projection', () => {
  assert.equal(provenanceDigest(ASTROLOGY_ANSWER_PUBLIC_REGISTRY), ASTROLOGY_ANSWER_REGISTRY_DIGEST)
  assert.deepEqual(ASTROLOGY_ANSWER_PUBLIC_REGISTRY.counts, { topics: 36, boundedQuestions: 144, authorityLinks: 115 })
  const serialized = JSON.stringify(ASTROLOGY_ANSWER_PUBLIC_REGISTRY)
  for (const forbidden of ['reviewerId', 'authorizationBasis', 'service_role', 'credential', 'submittedContent', 'privateCorpus']) assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'))
})

test('authority pages gain deterministic reverse links without hard-coded route lists', () => {
  assert.ok(getAstrologyAnswersForAuthority('calculation:civil-time-to-utc').length >= 2)
  assert.ok(getAstrologyAnswersForAuthority('comparison:prospective-model-scoring').length >= 3)
  const component = read('app/knowledge/astrology/questions/AuthorityAnswerLinks.tsx')
  assert.match(component, /getAstrologyAnswersForAuthority/)
  for (const path of [
    'app/knowledge/astrology/calculations/CalculationReferencePage.tsx',
    'app/knowledge/astrology/timing/TimingReferencePage.tsx',
    'app/knowledge/astrology/corporate-mundane/CorporateMundaneReferencePage.tsx',
    'app/knowledge/astrology/tropical-vs-sidereal/comparisons/TropicalSiderealComparisonPage.tsx',
    'app/knowledge/astrology/[slug]/page.tsx',
  ]) assert.match(read(path), /<AuthorityAnswerLinks authorityId=/)
})

test('static routing, metadata, registry, sitemap and llms projections share the reviewed arrays', () => {
  const route = read('app/knowledge/astrology/questions/[slug]/page.tsx')
  const registry = read('app/knowledge/astrology/questions/registry/route.ts')
  const sitemap = read('app/sitemap.ts')
  const llms = read('lib/llms-manifest.ts')
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /ASTROLOGY_ANSWERS\.map/)
  assert.match(route, /alternates: \{ canonical: path \}/)
  assert.match(registry, /dynamic = 'force-static'/)
  assert.match(registry, /ASTROLOGY_ANSWER_REGISTRY_DIGEST/)
  assert.match(sitemap, /ASTROLOGY_ANSWERS\.map/)
  assert.match(sitemap, /ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH/)
  assert.match(llms, /ASTROLOGY_ANSWERS\.map/)
  assert.match(llms, /Astrology machine-readable answer registry/)
})

test('the route projection includes astrology without claiming that the full tranche is observed or public', () => {
  assert.deepEqual(scaling.localUnpublishedTranche.astrologyAnswerGraph, { topics: 36, roots: 1, registries: 1, crawlableSurfaces: 38, boundedAnswers: 144, authorityLinks: 115 })
  assert.ok(scaling.localUnpublishedTranche.totalCrawlableSurfaces >= scaling.localUnpublishedTranche.astrologyAnswerGraph.crawlableSurfaces)
  assert.ok(scaling.localUnpublishedTranche.totalTopicPages >= scaling.localUnpublishedTranche.astrologyAnswerGraph.topics)
  assert.ok(scaling.localUnpublishedTranche.totalBoundedAnswers >= scaling.localUnpublishedTranche.astrologyAnswerGraph.boundedAnswers)
  assert.equal(scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment, scaling.baseline.derivedCurrentRoutes + scaling.localUnpublishedTranche.totalCrawlableSurfaces)
  assert.equal(scaling.localUnpublishedTranche.projectedGapToTarget, scaling.target - scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment)
  assert.equal(scaling.localUnpublishedTranche.publicNow, false)
})
