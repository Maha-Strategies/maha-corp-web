import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-25-cohort-v1.json')
const decisions = read('federation-readiness-tranche-25-decisions-v1.json')
const sources = read('federation-readiness-tranche-25-source-inspections-v1.json')
const specs = read('federation-readiness-tranche-25-page-specifications-v1.json')
const delta = read('federation-readiness-tranche-25-ledger-delta-v1.json')
const ledger = read('federation-unified-readiness-ledger-v7.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const t24 = read('federation-readiness-tranche-24-decisions-v1.json')

test('freezes the ordinary lane and excludes every unresolved definition', () => {
  const byId = new Map(ledger.entries.map((row: { candidateId: string }) => [row.candidateId, row]))
  const unresolved = new Set(ledger.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const prior = new Set(t24.decisions.map((row: { candidateId: string }) => row.candidateId))
  const carried = t24.decisions.filter((row: { decision: string; candidateId: string }) => row.decision === 'revise' && (byId.get(row.candidateId) as { routeRole: string }).routeRole !== 'definition').map((row: { candidateId: string }) => row.candidateId)
  const next = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId) && !prior.has(row.candidateId) && (byId.get(row.candidateId) as { routeRole: string }).routeRole !== 'definition').slice(0, 49).map((row: { candidateId: string }) => row.candidateId)
  assert.deepEqual(cohort.counts, { candidates: 100, priorRevisionRequirements: 51, newUnreviewed: 49, excludedDefinitions: 6, distinctConcepts: 44 })
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), [...carried, ...next])
  assert.ok(cohort.candidates.every((row: { routeRole: string }) => row.routeRole !== 'definition'))
})

test('reviews all candidates without weakening prior blocks', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 0, revise: 86, blocked: 14 })
  assert.equal(new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId)).size, 100)
  for (const row of decisions.decisions) {
    assert.deepEqual(Object.keys(row.axes).sort(), ['boundary', 'dependency', 'locator', 'rights', 'scope', 'sourceIdentity'].sort())
    assert.equal(row.dependency.valid, true)
    assert.equal(row.sourceAssessment.roleSupported, false)
    assert.equal(row.activeBindingChanged, false)
    assert.match(row.noInheritance, /No source.*transfers authority/)
  }
  const selected = new Set(cohort.candidates.map((row: { candidateId: string }) => row.candidateId))
  const priorBlocked = ledger.entries.filter((row: { candidateId: string; state: string }) => selected.has(row.candidateId) && row.state === 'blocked').map((row: { candidateId: string }) => row.candidateId).sort()
  const stillBlocked = decisions.decisions.filter((row: { decision: string }) => row.decision === 'blocked').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.ok(priorBlocked.every((id: string) => stillBlocked.includes(id)))
})

test('records partial Greek Roman evidence but refuses promotion or sibling transfer', () => {
  for (const id of ['cand_c12add199249649d20ce777c', 'cand_d16bd0aeeef4d38b1bfb0f2d']) {
    const row = decisions.decisions.find((item: { candidateId: string }) => item.candidateId === id)
    assert.equal(row.decision, 'revise')
    assert.equal(row.sourceAssessment.evidenceState, 'partial-inspected')
    assert.equal(row.sourceAssessment.sourceIds.length, 3)
    assert.match(row.finding, /primary passages plus current scholarship remains unmet/)
  }
  const sibling = decisions.decisions.find((row: { candidateId: string }) => row.candidateId === 'cand_295ca72c9e7c282beace722f')
  assert.equal(sibling.sourceAssessment.sourceIds.some((id: string) => id.startsWith('t25-smith-')), false)
  assert.equal(sibling.sourceAssessment.roleSupported, false)
  assert.equal(sibling.decision, 'revise')
  assert.equal(sources.inspections.length, 5)
  assert.ok(sources.inspections.every((row: { passageStored: boolean; boundary: string }) => !row.passageStored && row.boundary.length > 40))
})

test('emits no specification and does not compete with the unified ledger', () => {
  assert.deepEqual(specs.counts, { specifications: 0, boundedQuestions: 0 })
  assert.deepEqual(delta.counts, { reviewed: 100, newlyImplementationReady: 0, remainUnresolved: 100, excludedDefinitions: 6 })
  assert.equal(delta.execution.ledgerApplied, false)
  assert.match(delta.ownershipBoundary, /not a unified ledger/)
  assert.deepEqual(delta.baseLedger, { provenanceDigest: ledger.provenanceDigest, implementationReady: 1426, unresolved: 202 })
})

test('artifacts regenerate byte-identically and remain private and build-free', () => {
  const names = ['federation-readiness-tranche-25-cohort-v1.json', 'federation-readiness-tranche-25-source-inspections-v1.json', 'federation-readiness-tranche-25-decisions-v1.json', 'federation-readiness-tranche-25-page-specifications-v1.json', 'federation-readiness-tranche-25-ledger-delta-v1.json']
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-25.ts'], { cwd: root })
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-25.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.equal(delta.execution.buildRun, false)
})
