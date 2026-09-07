import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const names = ['federation-readiness-tranche-27-cohort-v1.json', 'federation-readiness-tranche-27-source-inspections-v1.json', 'federation-readiness-tranche-27-decisions-v1.json', 'federation-readiness-tranche-27-page-specifications-v1.json', 'federation-readiness-tranche-27-ledger-delta-v1.json']

test('freezes the complete 12 by 3 Greek and Roman cohort', () => {
  const cohort = read(names[0])
  assert.deepEqual(cohort.counts, { candidates: 36, concepts: 12, rolesPerConcept: 3 })
  assert.equal(new Set(cohort.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 36)
  const byConcept = Map.groupBy(cohort.candidates, (row: { conceptId: string }) => row.conceptId)
  assert.equal(byConcept.size, 12)
  for (const rows of byConcept.values()) assert.deepEqual(new Set(rows.map((row: { routeRole: string }) => row.routeRole)), new Set(['source-identity', 'epithet-and-cult', 'reception-and-comparison']))
})

test('records twelve complete-entry inspections with exact printed and scan pages', () => {
  const sources = read(names[1])
  assert.deepEqual(sources.counts, { works: 1, entryInspections: 12 })
  assert.equal(new Set(sources.inspections.map((row: { topic: string }) => row.topic)).size, 12)
  for (const row of sources.inspections) {
    assert.equal(row.inspectedDepth, 'complete-entry')
    assert.equal(row.locatorVerified, true)
    assert.match(row.locator, /pp?\. \d+(?:–\d+)?; scan PDF pages \d+(?:–\d+)?/)
    assert.match(row.rightsBasis, /public-domain/)
    assert.match(row.boundary, /nineteenth-century/)
    assert.equal(row.passageStored, false)
  }
})

test('keeps all three roles semantically distinct and dependency complete', () => {
  const decisions = read(names[2])
  assert.deepEqual(decisions.counts, { candidates: 36, evidenceReady: 36, revise: 0, blocked: 0 })
  for (const row of decisions.decisions) {
    assert.equal(row.semanticAssessment.disposition, 'retain-distinct')
    assert.equal(row.dependencyAssessment.structurallyResolved, true)
    assert.equal(row.dependencyAssessment.methodAnchorsComplete, true)
    assert.equal(row.sourceAssessment.sourceIds.length, 1)
    assert.equal(row.activeBindingChanged, false)
  }
})

test('specifications disclose the historical frame and prohibit identity inference', () => {
  const specs = read(names[3])
  assert.deepEqual(specs.counts, { specifications: 36, boundedQuestions: 180 })
  for (const row of specs.specifications) {
    assert.match(row.requiredDisclosure, /Historical reference frame/)
    assert.match(row.requiredDisclosure, /does not.*modern consensus/i)
    assert.equal(row.publicRouteCreated, false)
    assert.equal(row.sourceBindings.length, 1)
    assert.equal(row.boundedQuestions.length, 5)
  }
})

test('projects exactly 36 additional ready candidates without applying the ledger', () => {
  const delta = read(names[4])
  assert.deepEqual(delta.priorMergedDeltas, { tranche26: 4, prerequisiteClosure: 1 })
  assert.deepEqual(delta.counts, { reviewed: 36, newlyImplementationReady: 36, remainUnresolvedInTranche: 0, projectedImplementationReady: 1467, projectedUnresolved: 161 })
  assert.equal(delta.readyCandidateIds.length, 36)
  assert.equal(delta.execution.unifiedLedgerApplied, false)
  assert.equal(delta.execution.buildRun, false)
})

test('regenerates deterministically and stores no passages or public output', () => {
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-27.ts'], { cwd: root })
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-27.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(read(names[0]).execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
})
