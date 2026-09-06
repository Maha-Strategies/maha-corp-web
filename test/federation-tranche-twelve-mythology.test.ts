import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationTrancheTwelveMythology } from '../scripts/generate-federation-tranche-twelve-mythology.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
type Result = ReturnType<typeof generateFederationTrancheTwelveMythology>

const cohort = readJson<Result['cohort']>('content/federation/federation-tranche-12-mythology-cohort-v1.json')
const semantic = readJson<Result['semanticValidation']>('content/federation/federation-tranche-12-mythology-semantic-validation-v1.json')
const dependencies = readJson<Result['dependencyValidation']>('content/federation/federation-tranche-12-mythology-dependency-validation-v1.json')
const sources = readJson<Result['sourceInspections']>('content/federation/federation-tranche-12-mythology-source-inspections-v1.json')
const decisions = readJson<Result['decisionManifest']>('content/federation/federation-tranche-12-mythology-decisions-v1.json')
const specifications = readJson<Result['pageSpecifications']>('content/federation/federation-tranche-12-mythology-page-specifications-v1.json')
const readiness = readJson<Result['readiness']>('content/federation/federation-tranche-12-mythology-readiness-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 12 is the exact non-overlapping complement of Tranche 11', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-twelve-mythology-cohort/1.0')
  assert.deepEqual(cohort.counts, {
    selected: 100,
    byGroup: {
      'mythology-greek-roman': 8,
      'mythology-mesopotamian': 8,
      'mythology-sanskrit-vedic-epic-puranic': 12,
      'mythology-egyptian': 14,
      'mythology-norse-germanic': 14,
      'mythology-chinese': 16,
      'mythology-japanese': 12,
      'mythology-mesoamerican': 10,
      'mythology-african-source-rights-pilots': 4,
      'mythology-comparative-methodology': 2,
    },
    overlapWithTrancheEleven: 0,
    combinedMythologyCoverage: 200,
    publicRoutesCreated: 0,
    buildsRun: 0,
  })
  const prior = readJson<{ entries: Array<{ candidateId: string }> }>('content/federation/federation-tranche-11-mythology-cohort-v1.json')
  const candidateMap = readJson<{ candidates: Array<{ candidateId: string; conceptFamilyId: string }> }>('content/federation/federation-route-candidates-v2.json')
  const priorIds = new Set(prior.entries.map((entry) => entry.candidateId))
  const currentIds = new Set(cohort.entries.map((entry) => entry.candidateId))
  assert.ok([...currentIds].every((id) => !priorIds.has(id)))
  assert.deepEqual(new Set([...priorIds, ...currentIds]), new Set(candidateMap.candidates.filter((entry) => entry.conceptFamilyId === 'mythology').map((entry) => entry.candidateId)))
})

test('manual semantic adjudication preserves all distinct roles without URL-token shortcuts', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct'))
  assert.ok(semantic.entries.every((entry) => entry.answerBoundary.length > 110 && entry.nonOverlapFinding.length > 90))
  assert.ok(semantic.entries.every((entry) => entry.manualReview.includes('token and URL similarity were not used')))
  const serialized = JSON.stringify(semantic)
  for (const boundary of ['community-specific provenance', 'colonial translation', 'dictionary hit or late novel', 'modern use cannot prove pre-Christian belief', 'iconography or a modern overview alone']) assert.match(serialized, new RegExp(boundary, 'i'))
})

test('every Tranche 12 route resolves through the prior mythology hub and two live methods', () => {
  assert.deepEqual(dependencies.counts, { candidates: 100, structurallyResolved: 100, unresolved: 0, priorTrancheHubDependencies: 100 })
  for (const entry of dependencies.entries) {
    assert.equal(entry.structurallyResolved, true)
    assert.deepEqual(entry.missing, [])
    const urls = new Set(entry.dependencies.map((dependency) => dependency.url))
    assert.ok(urls.has('https://www.mahastrategies.com/knowledge/religion/mythology'))
    assert.ok(urls.has('https://www.mahastrategies.com/knowledge/religion/textual-authority'))
    assert.ok(urls.has('https://www.mahastrategies.com/knowledge/religion/translation-and-semantic-range'))
    assert.deepEqual(entry.canonicalDefinitionOwners, { methodology: 'maha-strategies', mythologyHub: 'maha-strategies' })
  }
})

test('source records keep rights, access, source scope, and community authority independent', () => {
  assert.deepEqual(sources.counts, { sources: 38, carriedAndRevalidated: 7, reusableWithTerms: 14, referenceOnly: 24, exactPassageOrFullText: 17, sourceTextRedistributable: 6 })
  const byId = new Map(sources.sources.map((entry) => [entry.sourceId, entry]))
  assert.equal(byId.get('rigveda-rudra-2-33')!.rightsStatus, 'public-domain-work')
  assert.equal(byId.get('bellows-lokasenna-loki')!.sourceTextMayBeRedistributed, false)
  assert.equal(byId.get('uee-thoth')!.rightsStatus, 'reference-only')
  assert.equal(byId.get('eos-tsukuyomi')!.rightsStatus, 'reference-only')
  assert.equal(byId.get('oracc-tiamat')!.rightsStatus, 'cc-by-sa-3.0')
  assert.match(byId.get('local-contexts-tk-labels')!.boundary, /cannot determine Yoruba, Asante, Dahomey, or Kush-specific/i)
  assert.match(byId.get('florentine-colonial-polemic-34r')!.boundary, /colonial witness/i)
  for (const item of sources.sources) {
    assert.ok(item.url.startsWith('https://'))
    assert.ok(item.locator.length > 25)
    assert.ok(item.rightsBasis.length > 30)
    assert.ok(item.scope.length > 45)
    assert.ok(item.boundary.length > 55)
  }
})

test('all one hundred routes receive a differentiated evidence decision', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 33, revise: 58, blocked: 9, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 33, revise: 58, blocked: 9, duplicative: 0, pageSpecifications: 33, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(new Set(decisions.entries.map((entry) => entry.candidateId)).size, 100)
  const ready = decisions.entries.filter((entry) => entry.disposition === 'evidence-ready')
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-norse-germanic' && entry.routeRole === 'eddic-source').length, 7)
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-japanese').length, 11)
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-mesoamerican').length, 7)
  assert.equal(ready.filter((entry) => entry.groupId === 'mythology-comparative-methodology').length, 2)
  assert.ok(decisions.entries.filter((entry) => entry.groupId === 'mythology-chinese').every((entry) => entry.disposition === 'revise'))
  assert.ok(decisions.entries.filter((entry) => entry.groupId === 'mythology-african-source-rights-pilots').every((entry) => entry.disposition === 'blocked'))
  assert.ok(decisions.entries.filter((entry) => entry.topic === 'maya-maize-god').every((entry) => entry.disposition === 'blocked'))
  assert.ok(ready.every((entry) => entry.rightsReviewed && entry.sourceIds.length >= 2))
})

test('substantial-page specifications exist only for the thirty-three ready routes', () => {
  assert.deepEqual(specifications.counts, { specifications: 33, boundedQuestions: 165, excludedNonReady: 67 })
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), new Set(decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId)))
  for (const specification of specifications.specifications) {
    assert.equal(specification.implementationState, 'specification-only')
    assert.equal(specification.boundedQuestions.length, 5)
    assert.ok(specification.sourceBindings.length >= 2)
    assert.ok(specification.sourceBindings.every((binding) => binding.locator.length > 25 && binding.scope.length > 45 && binding.boundary.length > 55))
    assert.equal(specification.machineContract.communityAuthorityRequiredWhereApplicable, true)
    assert.equal(specification.machineContract.exactRevisionReviewRequired, true)
    assert.equal(specification.machineContract.canonicalReleaseRequiredBeforePublication, true)
  }
})

test('Tranche 12 artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t12-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t12-b-'))
  try {
    const one = generateFederationTrancheTwelveMythology(first)
    const two = generateFederationTrancheTwelveMythology(second)
    assert.deepEqual(one.artifacts, two.artifacts)
    for (const path of one.artifacts) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('all artifacts verify and no private research packet reaches served source', () => {
  for (const value of [cohort, semantic, dependencies, sources, decisions, specifications, readiness]) assert.equal(provenanceDigest(value), value.provenanceDigest)
  const serialized = JSON.stringify({ sources, decisions, specifications })
  assert.doesNotMatch(serialized, /sourceExcerpt|fullTextContent|credentialValue|secretValue|customerData|natalData|paymentIntent/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))].filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path)).map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-twelve', 'tranche-12-mythology', 'oracc-ashur-temple-inventory', 'local-contexts-tk-labels']) assert.doesNotMatch(served, new RegExp(marker))
})
