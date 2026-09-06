import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationTrancheElevenMythology } from '../scripts/generate-federation-tranche-eleven-mythology.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
type Result = ReturnType<typeof generateFederationTrancheElevenMythology>

const cohort = readJson<Result['cohort']>('content/federation/federation-tranche-11-mythology-cohort-v1.json')
const semantic = readJson<Result['semanticValidation']>('content/federation/federation-tranche-11-mythology-semantic-validation-v1.json')
const dependencies = readJson<Result['dependencyValidation']>('content/federation/federation-tranche-11-mythology-dependency-validation-v1.json')
const sources = readJson<Result['sourceInspections']>('content/federation/federation-tranche-11-mythology-source-inspections-v1.json')
const decisions = readJson<Result['decisionManifest']>('content/federation/federation-tranche-11-mythology-decisions-v1.json')
const specifications = readJson<Result['pageSpecifications']>('content/federation/federation-tranche-11-mythology-page-specifications-v1.json')
const readiness = readJson<Result['readiness']>('content/federation/federation-tranche-11-mythology-readiness-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 11 freezes the approved one-hundred-route mythology mix', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-eleven-mythology-cohort/1.0')
  assert.deepEqual(cohort.counts, {
    selected: 100,
    byGroup: {
      'mythology-greek-roman': 28,
      'mythology-mesopotamian': 28,
      'mythology-sanskrit-vedic-epic-puranic': 20,
      'mythology-egyptian': 10,
      'mythology-norse-germanic': 6,
      'mythology-comparative-methodology': 6,
      'mythology-discovery-hub': 1,
      'mythology-machine-registry': 1,
    },
    publicRoutesCreated: 0,
    buildsRun: 0,
  })
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  assert.deepEqual(cohort.entries.map((entry) => entry.cohortOrder), Array.from({ length: 100 }, (_, index) => index + 1))
  assert.ok(cohort.entries.every((entry) => provenanceDigest(readJson<{ candidates: Array<{ candidateId: string }> }>('content/federation/federation-route-candidates-v2.json').candidates.find((candidate) => candidate.candidateId === entry.candidateId)!) === entry.candidateDigest))
})

test('manual semantic adjudication gives every route a specific boundary and non-overlap finding', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.equal(new Set(semantic.entries.map((entry) => entry.candidateId)).size, 100)
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct'))
  assert.ok(semantic.entries.every((entry) => entry.answerBoundary.length > 100 && entry.nonOverlapFinding.length > 80))
  assert.ok(semantic.entries.every((entry) => entry.manualReview.includes('URL similarity was not used')))
  const serialized = JSON.stringify(semantic)
  for (const boundary of ['timeless synonyms', 'later reception cannot retroactively define', 'iconography alone does not determine', 'modern use does not prove pre-Christian belief', 'resemblance is an observation']) assert.match(serialized, new RegExp(boundary, 'i'))
})

test('all application dependencies resolve to the hub and observed methodology anchors', () => {
  assert.deepEqual(dependencies.counts, { candidates: 100, structurallyResolved: 100, unresolved: 0, publicationDependencyGaps: 1 })
  const specialized = dependencies.entries.filter((entry) => !entry.url.endsWith('/knowledge/religion/mythology'))
  assert.ok(specialized.every((entry) => entry.hubDependencyCorrect))
  assert.ok(dependencies.entries.every((entry) => entry.methodAnchorsComplete && entry.structurallyResolved))
  for (const entry of dependencies.entries) {
    const urls = new Set(entry.dependencies.map((dependency) => dependency.url))
    assert.ok(urls.has('https://www.mahastrategies.com/knowledge/religion/textual-authority'))
    assert.ok(urls.has('https://www.mahastrategies.com/knowledge/religion/translation-and-semantic-range'))
  }
  const registry = dependencies.entries.find((entry) => entry.url.endsWith('/mythology/registry'))!
  assert.match(registry.publicationDependencyGap!, /publish\.mahastrategies\.com\/docs\/release-manifests/)
})

test('source inspection keeps access, reuse, noncommercial and public-domain states separate', () => {
  assert.deepEqual(sources.counts, { sources: 25, reusableWithTerms: 17, referenceOnly: 8, exactPassageOrFullText: 9, sourceTextRedistributable: 16 })
  const byId = new Map(sources.sources.map((source) => [source.sourceId, source]))
  assert.equal(byId.get('oracc-reuse-policy')!.rightsStatus, 'cc-by-sa-3.0')
  assert.equal(byId.get('rigveda-griffith-indra-1-32')!.rightsStatus, 'public-domain-work')
  assert.equal(byId.get('obp-poetic-edda-pettit')!.rightsStatus, 'noncommercial-reference-only')
  assert.equal(byId.get('uee-osiris-deceased')!.rightsStatus, 'reference-only')
  assert.equal(byId.get('etcsl-inanna-descent')!.sourceTextMayBeRedistributed, false)
  assert.equal(byId.get('freiberger-comparison-method')!.rightsStatus, 'cc-by-4.0')
  for (const source of sources.sources) {
    assert.ok(source.url.startsWith('https://'))
    assert.ok(source.locator.length > 20)
    assert.ok(source.rightsBasis.length > 40)
    assert.ok(source.scope.length > 40)
    assert.ok(source.boundary.length > 40)
  }
})

test('route decisions are differentiated and only sixteen exact scopes are evidence-ready', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 16, revise: 77, blocked: 7, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 16, revise: 77, blocked: 7, duplicative: 0, pageSpecifications: 16, publicRoutesCreated: 0, buildsRun: 0 })
  const ready = decisions.entries.filter((entry) => entry.disposition === 'evidence-ready')
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-mesopotamian' && entry.routeRole === 'city-and-cult').length, 8)
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-sanskrit-vedic-epic-puranic' && entry.routeRole === 'vedic-text').length, 5)
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-egyptian' && entry.topic === 'osiris').length, 1)
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-comparative-methodology').length, 2)
  assert.equal(decisions.entries.filter((entry) => entry.groupId === 'mythology-sanskrit-vedic-epic-puranic' && entry.routeRole === 'epic-puranic-reception' && entry.disposition === 'blocked').length, 5)
  assert.ok(decisions.entries.filter((entry) => entry.groupId === 'mythology-greek-roman').every((entry) => entry.disposition === 'revise'))
  assert.ok(ready.every((entry) => entry.rightsReviewed && entry.sourceIds.length > 0))
})

test('specifications exist only for evidence-ready candidates and preserve source limits', () => {
  assert.deepEqual(specifications.counts, { specifications: 16, boundedQuestions: 80, excludedNonReady: 84 })
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), new Set(decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId)))
  for (const specification of specifications.specifications) {
    assert.equal(specification.implementationState, 'specification-only')
    assert.equal(specification.boundedQuestions.length, 5)
    assert.ok(specification.sourceBindings.length > 0)
    assert.ok(specification.sourceBindings.every((binding) => binding.locator.length > 20 && binding.boundary.length > 40))
    assert.equal(specification.machineContract.exactRevisionReviewRequired, true)
    assert.equal(specification.machineContract.canonicalReleaseRequiredBeforePublication, true)
  }
})

test('Tranche 11 artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t11-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t11-b-'))
  try {
    const one = generateFederationTrancheElevenMythology(first)
    const two = generateFederationTrancheElevenMythology(second)
    assert.deepEqual(one.artifacts, two.artifacts)
    for (const path of one.artifacts) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('all digests verify and no private artifact reaches served source', () => {
  for (const value of [cohort, semantic, dependencies, sources, decisions, specifications, readiness]) assert.equal(provenanceDigest(value), value.provenanceDigest)
  const serialized = JSON.stringify({ sources, decisions, specifications })
  assert.doesNotMatch(serialized, /sourceExcerpt|fullText|credentialValue|secretValue|customerData|natalData|paymentIntent/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-eleven', 'tranche-11-mythology', 'oracc-inanna-ishtar', 'uee-osiris-deceased']) assert.doesNotMatch(served, new RegExp(marker))
})
