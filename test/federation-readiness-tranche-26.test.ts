import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-26-cohort-v1.json')
const decisions = read('federation-readiness-tranche-26-decisions-v1.json')
const sources = read('federation-readiness-tranche-26-source-inspections-v1.json')
const specs = read('federation-readiness-tranche-26-page-specifications-v1.json')
const delta = read('federation-readiness-tranche-26-ledger-delta-v1.json')
const ledger = read('federation-unified-readiness-ledger-v7.json')
const t25 = read('federation-readiness-tranche-25-decisions-v1.json')

test('freezes 96 untouched plus four carried ordinary candidates', () => {
  assert.deepEqual(cohort.counts, { candidates: 100, untouched: 96, indexedUntouched: 92, unindexedReplacementRecovery: 4, carriedRevisions: 4, excludedConcepts: 8, distinctConcepts: 64 })
  assert.equal(new Set(cohort.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 100)
  assert.ok(cohort.candidates.slice(0, 92).every((row: { selectionBasis: string }) => row.selectionBasis === 'all-remaining-untouched-unresolved-ordinary'))
  assert.ok(cohort.candidates.slice(92, 96).every((row: { selectionBasis: string }) => row.selectionBasis === 'unindexed-v5-replacement-recovery'))
  assert.ok(cohort.candidates.slice(96).every((row: { selectionBasis: string }) => row.selectionBasis === 'highest-order-tranche-25-revision'))
  const t25Ids = new Set(t25.decisions.map((row: { candidateId: string }) => row.candidateId))
  assert.ok(cohort.candidates.slice(0, 96).every((row: { candidateId: string }) => !t25Ids.has(row.candidateId)))
})

test('excludes definitions and every Claude-owned prerequisite concept', () => {
  const excluded = new Set(cohort.exclusion.conceptIds)
  assert.equal(excluded.size, 8)
  for (const row of cohort.candidates) {
    assert.notEqual(row.routeRole, 'definition')
    assert.equal(excluded.has(row.conceptId), false, row.path)
  }
})

test('gives all four corrected replacements exact independent reviews', () => {
  const ids = ['cand_d43767b90b272ddead9ab56c', 'cand_4080575bad7a1bfd45b42d3a', 'cand_1981169ef4336a655069490c', 'cand_9d7f62fef0254f8faa993456']
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 4, revise: 74, blocked: 22 })
  for (const id of ids) {
    const row = decisions.decisions.find((item: { candidateId: string }) => item.candidateId === id)
    assert.equal(row.decision, 'evidence-ready')
    assert.equal(row.sourceAssessment.sourceIds.length, 1)
    assert.equal(row.axes.locator, 'exact')
    assert.match(row.finding, /own review rather than inheriting/)
  }
  assert.deepEqual(delta.readyCandidateIds, [...ids].sort())
})

test('local implementation locators and declared symbols resolve', () => {
  for (const row of sources.inspections) {
    const parts = row.locator.split('; ')
    for (const part of parts) {
      const [path, symbols = ''] = part.split(' — ')
      assert.equal(existsSync(resolve(root, path)), true, path)
      const source = readFileSync(resolve(root, path), 'utf8')
      for (const symbol of symbols.split(/, | and /).filter(Boolean)) assert.ok(source.includes(symbol), `${path}:${symbol}`)
    }
  }
})

test('specifies only ready candidates and leaves the ledger unapplied', () => {
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specs.counts, { specifications: 4, boundedQuestions: 20 })
  assert.deepEqual(specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort(), ready)
  assert.ok(specs.specifications.every((row: { publicRouteCreated: boolean; sourceBindings: unknown[] }) => !row.publicRouteCreated && row.sourceBindings.length === 1))
  assert.deepEqual(delta.counts, { reviewed: 100, newlyImplementationReady: 4, remainUnresolved: 96, projectedBaseImplementationReady: 1430, projectedBaseUnresolved: 198 })
  assert.equal(delta.execution.ledgerApplied, false)
  assert.equal(delta.baseLedger.provenanceDigest, ledger.provenanceDigest)
})

test('artifacts regenerate byte-identically and stay private and build-free', () => {
  const names = ['federation-readiness-tranche-26-cohort-v1.json', 'federation-readiness-tranche-26-source-inspections-v1.json', 'federation-readiness-tranche-26-decisions-v1.json', 'federation-readiness-tranche-26-page-specifications-v1.json', 'federation-readiness-tranche-26-ledger-delta-v1.json']
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-26.ts'], { cwd: root })
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-26.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.equal(delta.execution.buildRun, false)
})
