import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { CANDIDATE_COUNT, CONCEPT_FAMILIES, FEDERATION_TARGET, generateFederationPlan, RELATIONSHIP_TYPES, SITE_CONTRACTS, type FrozenBaseline } from '../lib/federation-4000-plan.ts'
import { writeFrozenBaseline } from '../scripts/freeze-federation-route-baseline.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = (path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'))
const baseline = readJson('content/federation/federation-route-baseline-v1.json') as FrozenBaseline & Record<string, unknown>
type FederationPlan = ReturnType<typeof generateFederationPlan>
const architecture = readJson('content/federation/federation-architecture-v1.json') as FederationPlan['architecture']
const map = readJson('content/federation/federation-route-candidates-v1.json') as FederationPlan['candidateMap']

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name)
    return entry.isDirectory() ? filesUnder(target) : [target]
  })
}

test('the measured federation baseline freezes 2,372 unique public sitemap routes', () => {
  assert.equal(provenanceDigest(baseline), baseline.provenanceDigest)
  assert.deepEqual(
    baseline.observedProperties.map((property) => [property.siteId, property.routeCount]),
    [['maha-os', 13], ['maha-strategies', 2_003], ['agentic-publishing', 30], ['maha-research', 291], ['mayone-maharajan', 18], ['mayon-rajan', 17]],
  )
  const routes = baseline.observedProperties.flatMap((property) => property.routes)
  assert.equal(routes.length, 2_372)
  assert.equal(new Set(routes).size, routes.length)
  assert.equal(baseline.proposedProperties.length, 1)
  assert.deepEqual(baseline.proposedProperties[0], {
    siteId: 'maha-policy', canonicalHost: 'policy.mahastrategies.com', state: 'proposed-dns-unresolved', sitemapUrl: null, sitemapSha256: null, routeCount: 0, routes: [],
  })
})

test('the architecture and candidate map are digest-bound to the measured baseline', () => {
  assert.equal(provenanceDigest(architecture), architecture.provenanceDigest)
  assert.equal(provenanceDigest(map), map.provenanceDigest)
  assert.equal(architecture.baselineDigest, baseline.provenanceDigest)
  assert.equal(map.baselineDigest, baseline.provenanceDigest)
  assert.equal(map.architectureDigest, architecture.provenanceDigest)
})

test('the freeze contains exactly 1,628 unique non-colliding candidates and projects exactly 4,000 routes', () => {
  assert.equal(map.candidates.length, CANDIDATE_COUNT)
  assert.deepEqual(map.summary, { observedCanonicalRoutes: 2_372, frozenCandidates: 1_628, projectedCanonicalRoutes: FEDERATION_TARGET })
  assert.equal(new Set(map.candidates.map((candidate) => candidate.url)).size, CANDIDATE_COUNT)
  assert.equal(new Set(map.candidates.map((candidate) => candidate.candidateId)).size, CANDIDATE_COUNT)
  assert.equal(new Set(map.candidates.map((candidate) => `${candidate.siteId}:${candidate.searchIntent}`)).size, CANDIDATE_COUNT)
  const observed = new Set(baseline.observedProperties.flatMap((property) => property.routes))
  assert.equal(map.candidates.filter((candidate) => observed.has(candidate.url)).length, 0)
  assert.deepEqual(map.allocation, SITE_CONTRACTS.map((contract) => ({ siteId: contract.siteId, observed: contract.current, candidates: contract.candidates, projected: contract.projected })))
  assert.equal(map.allocation.reduce((sum, row) => sum + row.projected, 0), FEDERATION_TARGET)
})

test('ranking is deterministic, exhaustive and uses declared priors rather than invented query observations', () => {
  assert.deepEqual(map.candidates.map((candidate) => candidate.rank), Array.from({ length: CANDIDATE_COUNT }, (_, index) => index + 1))
  assert.deepEqual(map.tranches.map((tranche) => tranche.candidateCount), [400, 400, 400, 428])
  assert.equal(Object.values(map.scoring.weights).reduce((sum: number, value) => sum + Number(value), 0), 1)
  assert.ok(map.candidates.every((candidate) => candidate.demandEvidence.basis === 'category-prior-not-observed'))
  assert.ok(map.candidates.every((candidate) => candidate.demandEvidence.observedQueries === 0 && candidate.demandEvidence.observedImpressions === null))
  for (let index = 1; index < map.candidates.length; index += 1) {
    assert.ok(map.candidates[index - 1].scores.weighted >= map.candidates[index].scores.weighted)
  }
})

test('each concept family has one owner and every property participates in governance through typed links', () => {
  const ownerEntries = architecture.conceptFamilies.map((family) => [family.conceptFamilyId, family.canonicalOwner] as const)
  assert.deepEqual(ownerEntries, CONCEPT_FAMILIES.map(([family, owner]) => [family, owner]))
  assert.equal(new Set(ownerEntries.map(([family]) => family)).size, ownerEntries.length)
  const owners = new Map(ownerEntries)
  const vocabulary = new Set(RELATIONSHIP_TYPES)
  assert.ok(map.candidates.every((candidate) => candidate.typedRelationships.every((relationship) => vocabulary.has(relationship.type as typeof RELATIONSHIP_TYPES[number]))))
  assert.ok(map.candidates.every((candidate) => candidate.conceptAuthority.canonicalOwner === owners.get(candidate.conceptFamilyId)))
  for (const contract of SITE_CONTRACTS) {
    const siteCandidates = map.candidates.filter((candidate) => candidate.siteId === contract.siteId)
    assert.ok(siteCandidates.length > 0)
    assert.ok(siteCandidates.some((candidate) => candidate.conceptFamilyId === 'governance' || candidate.typedRelationships.some((relationship) => relationship.target === 'urn:maha:concept:governance')))
  }
})

test('all candidates remain private, uninspected, unreviewed, unreleased, uncompiled and uncrawlable', () => {
  assert.deepEqual(map.executionState, { researchStarted: false, reviewsCreated: false, releasesCreated: false, routesCompiled: false, buildRun: false, previewCreated: false, deployed: false, dnsChanged: false })
  assert.ok(map.candidates.every((candidate) => candidate.publication.state === 'candidate-only'))
  assert.ok(map.candidates.every((candidate) => !candidate.publication.inspected && !candidate.publication.reviewed && !candidate.publication.canonicallyReleased && !candidate.publication.compiled && !candidate.publication.crawlable))
  assert.ok(map.candidates.every((candidate) => Object.values(candidate.evidencePlan).every((value) => value === 'not-started')))
  assert.equal(map.candidates.filter((candidate) => candidate.siteId === 'maha-policy' && candidate.publication.crawlable).length, 0)
  assert.equal(architecture.releaseProtocol.vercelBuildRequiresOperatorApproval, true)
  assert.ok(Object.entries(architecture.releaseProtocol).filter(([key]) => key.endsWith('Authorized')).every(([, value]) => value === false))
})

test('candidate regeneration is byte-identical and the reviewed baseline refuses an accidental overwrite', () => {
  const generated = generateFederationPlan(baseline)
  assert.equal(`${JSON.stringify(generated.architecture, null, 2)}\n`, readFileSync(resolve(ROOT, 'content/federation/federation-architecture-v1.json'), 'utf8'))
  assert.equal(`${JSON.stringify(generated.candidateMap, null, 2)}\n`, readFileSync(resolve(ROOT, 'content/federation/federation-route-candidates-v1.json'), 'utf8'))
  const directory = mkdtempSync(join(tmpdir(), 'maha-federation-freeze-'))
  const target = join(directory, 'baseline.json')
  writeFileSync(target, 'reviewed\n')
  assert.throws(() => writeFrozenBaseline(target, baseline as never), /Refusing to overwrite frozen baseline/)
  assert.equal(readFileSync(target, 'utf8'), 'reviewed\n')
  rmSync(directory, { recursive: true })
})

test('private federation planning artifacts have no served-code or workflow dependency', () => {
  const servedFiles = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
  const servedSource = servedFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-route-candidates-v1', 'federation-architecture-v1', 'federation-route-baseline-v1', 'candidate-freeze-only']) {
    assert.doesNotMatch(servedSource, new RegExp(marker))
  }
  const workflows = filesUnder(resolve(ROOT, '.github/workflows')).map((path) => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(workflows, /federation-4000|candidate-freeze-only/)
  const privateArtifacts = JSON.stringify({ baseline, architecture, map })
  for (const secretShape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/, /service_role\s*[:=]\s*[A-Za-z0-9._-]{12,}/i]) {
    assert.doesNotMatch(privateArtifacts, secretShape)
  }
  for (const privateField of ['submittedClaimContent', 'reviewerEmail', 'credentialValue', 'secretValue', 'privatePassageText']) {
    assert.equal(privateArtifacts.includes(privateField), false)
  }
})
