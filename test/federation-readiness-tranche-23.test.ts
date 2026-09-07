import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-23-cohort-v1.json')
const decisions = read('federation-readiness-tranche-23-decisions-v1.json')
const sources = read('federation-readiness-tranche-23-source-inspections-v1.json')
const specs = read('federation-readiness-tranche-23-page-specifications-v1.json')
const ledgerV5 = read('federation-unified-readiness-ledger-v5.json')
const ledgerV6 = read('federation-unified-readiness-ledger-v6.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const t22 = read('federation-readiness-tranche-22-decisions-v1.json')

test('freezes 24 carried revisions before 76 untouched unresolved candidates', () => {
  const carried = t22.decisions.filter((row: { decision: string }) => row.decision === 'revise').map((row: { candidateId: string }) => row.candidateId)
  const prior = new Set(t22.decisions.map((row: { candidateId: string }) => row.candidateId))
  const unresolved = new Set(ledgerV5.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const next = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId) && !prior.has(row.candidateId)).slice(0, 76).map((row: { candidateId: string }) => row.candidateId)
  assert.deepEqual(cohort.counts, { candidates: 100, priorRevisionRequirements: 24, newUnreviewed: 76, distinctConcepts: 40 })
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), [...carried, ...next])
})

test('reviews every candidate on six axes and exact dependency identity', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 57, revise: 42, blocked: 1 })
  assert.equal(new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId)).size, 100)
  for (const row of decisions.decisions) {
    assert.deepEqual(Object.keys(row.axes).sort(), ['boundary', 'dependency', 'locator', 'rights', 'scope', 'sourceIdentity'].sort())
    assert.equal(row.dependency.valid, true)
    assert.ok(row.dependency.typedRelationships.some((item: { target: string }) => item.target === row.conceptId))
    assert.equal(row.sourceAssessment.roleSupported, row.decision === 'evidence-ready')
    assert.equal(row.activeBindingChanged, false)
  }
})

test('keeps broad authority and commercial claims fail closed', () => {
  const deterministic = decisions.decisions.filter((row: { conceptId: string }) => row.conceptId.endsWith(':deterministic-arithmetic'))
  assert.equal(deterministic.length, 4)
  assert.ok(deterministic.every((row: { decision: string }) => row.decision === 'revise'))
  const commercial = decisions.decisions.filter((row: { routeRole: string }) => row.routeRole === 'commercialization')
  assert.equal(commercial.length, 4)
  assert.ok(commercial.every((row: { decision: string; finding: string }) => row.decision === 'revise' && /no offer is manufactured/i.test(row.finding)))
  const machineRule = decisions.decisions.find((row: { conceptId: string; routeRole: string }) => row.conceptId.endsWith(':scientific-evidence-policy') && row.routeRole === 'machine-rule')
  assert.equal(machineRule.decision, 'blocked')
})

test('preserves the separate health-consent dependency boundary', () => {
  const consent = decisions.decisions.find((row: { conceptId: string }) => row.conceptId.endsWith(':health-data-consent'))
  assert.equal(consent.decision, 'revise')
  assert.match(consent.finding, /separately reviewed dependency-cascade track/)
})

test('specifies only evidence-ready candidates', () => {
  assert.deepEqual(specs.counts, { specifications: 57, boundedQuestions: 285 })
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort(), ready)
  for (const row of specs.specifications) {
    assert.equal(row.publicRouteCreated, false)
    assert.equal(row.implementationState, 'specification-only')
    assert.ok(row.sourceBindings.length > 0)
  }
})

test('all new local implementation locators resolve', () => {
  for (const row of sources.inspections.filter((item: { sourceId: string }) => item.sourceId.startsWith('t23-'))) {
    const [path, symbol] = row.locator.split(' — ')
    assert.equal(existsSync(resolve(root, path)), true, path)
    assert.ok(readFileSync(resolve(root, path), 'utf8').includes(symbol), row.locator)
  }
})

test('ledger v6 closes 57 routes without changing unreviewed entries', () => {
  assert.deepEqual(ledgerV6.counts, { routeCandidates: 1628, implementationReady: 1403, unresolved: 225, newlyReadyThisTranche: 57 })
  const reviewed = new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId))
  for (const entry of ledgerV6.entries) {
    const prior = ledgerV5.entries.find((row: { candidateId: string }) => row.candidateId === entry.candidateId)
    assert.ok(prior)
    if (!reviewed.has(entry.candidateId)) assert.deepEqual(entry, prior)
  }
})

test('artifacts verify, regenerate identically, and remain private and local', () => {
  const names = ['federation-readiness-tranche-23-cohort-v1.json', 'federation-readiness-tranche-23-source-inspections-v1.json', 'federation-readiness-tranche-23-decisions-v1.json', 'federation-readiness-tranche-23-page-specifications-v1.json', 'federation-unified-readiness-ledger-v6.json']
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-23.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.deepEqual(ledgerV6.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
})
