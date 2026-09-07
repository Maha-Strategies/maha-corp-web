import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const names = ['federation-route-candidates-v6.json', 'federation-readiness-deferred-research-v1.json', 'federation-readiness-closure-replacements-v1.json', 'federation-readiness-closure-page-specifications-v1.json', 'federation-readiness-tranche-28-decisions-v1.json', 'federation-unified-readiness-ledger-v8.json', 'federation-4000-readiness-report-v1.json']

test('preserves the 1,628-route budget with one-for-one same-property replacements', () => {
  const map = read(names[0])
  const deferred = read(names[1])
  const replacements = read(names[2])
  assert.equal(map.candidates.length, 1628)
  assert.equal(new Set(map.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 1628)
  assert.equal(new Set(map.candidates.map((row: { url: string }) => row.url)).size, 1628)
  assert.equal(deferred.counts.questions, 161)
  assert.equal(replacements.counts.replacements, 161)
  const deferredById = new Map<string, { candidateId: string; siteId: string }>(deferred.questions.map((row: { candidateId: string; siteId: string }) => [row.candidateId, row]))
  for (const row of replacements.bindings) {
    const prior = deferredById.get(row.displacedCandidateId)
    assert.ok(prior)
    assert.equal(prior.siteId, row.siteId)
    assert.equal(row.evidenceInherited, false)
  }
})

test('gives every replacement an exact inspected source contract and substantial specification', () => {
  const map = read(names[0])
  const specs = read(names[3])
  const replacements = map.candidates.filter((row: { replacementFor?: string }) => row.replacementFor)
  assert.deepEqual(specs.counts, { specifications: 161, boundedQuestions: 805 })
  assert.equal(replacements.length, 161)
  const specById = new Map<string, { requiredSections: unknown[]; boundedQuestions: unknown[]; sourceBindings: { locator: string; rightsBasis: string; scope: string; boundary: string }[]; publicRouteCreated: boolean }>(specs.specifications.map((row: { candidateId: string; requiredSections: unknown[]; boundedQuestions: unknown[]; sourceBindings: { locator: string; rightsBasis: string; scope: string; boundary: string }[]; publicRouteCreated: boolean }) => [row.candidateId, row]))
  for (const candidate of replacements) {
    const spec = specById.get(candidate.candidateId)
    assert.ok(spec)
    assert.equal(spec.requiredSections.length, 7)
    assert.equal(spec.boundedQuestions.length, 5)
    assert.equal(spec.sourceBindings.length, 1)
    assert.ok(spec.sourceBindings[0].locator)
    assert.ok(spec.sourceBindings[0].rightsBasis)
    assert.ok(spec.sourceBindings[0].scope)
    assert.ok(spec.sourceBindings[0].boundary)
    assert.equal(spec.publicRouteCreated, false)
    assert.equal(candidate.demandEvidence.basis, 'unknown')
  }
})

test('keeps all five property allocations and paths distinct', () => {
  const replacements = read(names[0]).candidates.filter((row: { replacementFor?: string }) => row.replacementFor)
  const counts = Object.fromEntries([...Map.groupBy(replacements, (row: { siteId: string }) => row.siteId)].map(([key, rows]) => [key, rows.length]))
  assert.deepEqual(counts, { 'agentic-publishing': 11, 'maha-policy': 11, 'maha-strategies': 127, 'mayon-rajan': 1, 'mayone-maharajan': 11 })
  for (const row of replacements) {
    assert.equal(row.typedRelationships.length, 3)
    assert.equal(row.duplicateScreen.status, 'exact-url-and-source-lens-reviewed-distinct')
    assert.equal(row.publication.crawlable, false)
  }
})

test('closes the local readiness ledger without claiming publication', () => {
  const decisions = read(names[4])
  const ledger = read(names[5])
  const report = read(names[6])
  assert.deepEqual(decisions.counts, { candidates: 162, evidenceReady: 162, replacements: 161, carriedPrerequisite: 1 })
  assert.deepEqual(ledger.counts, { routeCandidates: 1628, implementationReady: 1628, unresolved: 0, retainedReady: 1467, sourceCenteredReplacements: 161 })
  assert.equal(ledger.entries.length, 1628)
  assert.ok(ledger.entries.every((row: { implementationState: string; specification: boolean; publicRouteCreated: boolean }) => row.implementationState === 'implementation-ready' && row.specification && !row.publicRouteCreated))
  assert.deepEqual(report.readiness, { implementationReadyCandidates: 1628, unresolvedCandidatesInFreeze: 0, projectedFederationRoutesAfterImplementation: 4000, target: 4000 })
  assert.deepEqual(report.execution, { publicRoutesGenerated: 0, buildRun: false, released: false, deployed: false })
})

test('does not collide with observed routes or retained candidates', () => {
  const baseline = read('federation-route-baseline-v1.json')
  const oldMap = read('federation-route-candidates-v5.json')
  const replacements = read(names[0]).candidates.filter((row: { replacementFor?: string }) => row.replacementFor)
  const observed = new Set(baseline.observedProperties.flatMap((property: { routes: string[] }) => property.routes))
  const oldUrls = new Set(oldMap.candidates.map((row: { url: string }) => row.url))
  for (const row of replacements) {
    assert.equal(observed.has(row.url), false, row.url)
    assert.equal(oldUrls.has(row.url), false, row.url)
  }
})

test('regenerates byte-identically and keeps private material and builds out', () => {
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-4000-readiness-closure.ts'], { cwd: root })
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/', 'buildRun":true']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-4000-readiness-closure.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
})
