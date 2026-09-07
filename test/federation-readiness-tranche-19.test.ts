import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { HELD_CONCEPTS, LOCAL_APPLICATION_SOURCES, digest } from '../lib/federation/readiness-tranche-19.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-19-cohort-v1.json')
const sources = read('federation-readiness-tranche-19-source-inspections-v1.json')
const decisions = read('federation-readiness-tranche-19-decisions-v1.json')
const specs = read('federation-readiness-tranche-19-page-specifications-v1.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const priorLedger = read('federation-unified-readiness-ledger-v1.json')
const ledger = read('federation-unified-readiness-ledger-v2.json')

test('freezes exactly the first 100 unresolved priority candidates before inspection', () => {
  const unresolved = new Set(priorLedger.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const expected = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId)).slice(0, 100).map((row: { candidateId: string }) => row.candidateId)
  assert.equal(cohort.counts.candidates, 100)
  assert.equal(cohort.counts.distinctConcepts, 30)
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), expected)
  assert.deepEqual(cohort.candidates.map((row: { selectionOrder: number }) => row.selectionOrder), Array.from({ length: 100 }, (_, index) => index + 1))
})

test('issues an exact and exhaustive 47/49/4 decision partition', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 47, revise: 49, blocked: 4 })
  assert.equal(decisions.decisions.length, 100)
  assert.equal(new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId)).size, 100)
  assert.deepEqual(new Set(decisions.decisions.map((row: { decision: string }) => row.decision)), new Set(['evidence-ready', 'revise', 'blocked']))
})

test('evidence readiness always has a role-specific inspected implementation source', () => {
  for (const decision of decisions.decisions) {
    const matching = (LOCAL_APPLICATION_SOURCES[decision.conceptId] ?? []).filter((source) => source.roles.includes(decision.routeRole))
    if (decision.decision === 'evidence-ready') {
      assert.ok(matching.length > 0, `${decision.candidateId}:${decision.routeRole}`)
      assert.equal(decision.sourceAssessment.kind, 'local-application')
      assert.equal(decision.sourceAssessment.roleSupported, true)
      assert.equal(decision.axes.scope, 'supports-route-role')
    } else {
      assert.equal(matching.length, 0, `${decision.candidateId} was held despite matching application evidence`)
      assert.equal(decision.sourceAssessment.roleSupported, false)
      assert.equal(decision.axes.scope, 'does-not-support-route-role')
    }
    assert.match(decision.noInheritance, /cannot make this application evidence-ready/)
    assert.equal(decision.activeBindingChanged, false)
  }
})

test('deferred conflicting-literature applications remain blocked rather than inferred', () => {
  const rows = decisions.decisions.filter((row: { conceptId: string }) => row.conceptId.endsWith(':conflicting-literature'))
  assert.equal(rows.length, 4)
  assert.ok(rows.every((row: { decision: string }) => row.decision === 'blocked'))
  assert.equal(HELD_CONCEPTS['urn:maha:concept:evidence:conflicting-literature'].state, 'blocked')
})

test('definition-only computation evidence does not become a machine interface or replay fixture', () => {
  const computation = decisions.decisions.filter((row: { conceptId: string }) => row.conceptId.startsWith('urn:maha:concept:computation:') && !row.conceptId.endsWith(':reproducibility-fixtures'))
  assert.ok(computation.length > 0)
  assert.ok(computation.every((row: { decision: string }) => row.decision === 'revise'))
  assert.ok(computation.every((row: { sourceAssessment: { roleSupported: boolean } }) => row.sourceAssessment.roleSupported === false))
})

test('all local source locators resolve to the exact named symbols', () => {
  for (const inspection of sources.localInspections) {
    const [path, names] = inspection.locator.split(' — ')
    const absolute = resolve(root, path)
    assert.equal(existsSync(absolute), true, path)
    const implementation = readFileSync(absolute, 'utf8')
    for (const name of names.split(' and ')) {
      assert.match(implementation, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), inspection.locator)
    }
    assert.equal(inspection.inspectionDepth, 'symbol-and-surrounding-implementation')
    assert.equal(inspection.independence, 'not-independent')
  }
})

test('carried external inspections preserve provenance and never independently promote an application', () => {
  assert.ok(sources.carriedExternalInspections.length > 0)
  assert.ok(sources.carriedExternalInspections.every((row: { passageStored: boolean; carriedFrom: string }) => row.passageStored === false && /^federation-/.test(row.carriedFrom)))
  for (const decision of decisions.decisions.filter((row: { sourceAssessment: { kind: string } }) => row.sourceAssessment.kind === 'external-definition-only')) {
    assert.notEqual(decision.decision, 'evidence-ready')
  }
})

test('specifications exist for all and only the 47 newly evidence-ready candidates', () => {
  assert.deepEqual(specs.counts, { specifications: 47, boundedQuestions: 235 })
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  const specified = specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specified, ready)
  for (const specification of specs.specifications) {
    assert.equal(specification.implementationState, 'specification-only')
    assert.equal(specification.publicRouteCreated, false)
    assert.equal(specification.boundedQuestions.length, 5)
    assert.ok(specification.sourceBindings.length > 0)
  }
})

test('the v2 ledger advances only the reviewed cohort and still partitions 1,628 routes', () => {
  assert.deepEqual(ledger.counts, { routeCandidates: 1628, implementationReady: 1182, unresolved: 446, newlyReadyThisTranche: 47 })
  assert.equal(ledger.entries.length, 1628)
  assert.equal(ledger.entries.filter((row: { implementationState: string }) => row.implementationState === 'implementation-ready').length, 1182)
  assert.equal(ledger.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').length, 446)
  const reviewed = new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId))
  for (const entry of ledger.entries) {
    const prior = priorLedger.entries.find((row: { candidateId: string }) => row.candidateId === entry.candidateId)
    assert.ok(prior)
    if (!reviewed.has(entry.candidateId)) assert.deepEqual(entry, prior)
  }
})

test('every generated artifact authenticates its whole body and contains no private payload', () => {
  const names = [
    'federation-readiness-tranche-19-cohort-v1.json',
    'federation-readiness-tranche-19-source-inspections-v1.json',
    'federation-readiness-tranche-19-decisions-v1.json',
    'federation-readiness-tranche-19-page-specifications-v1.json',
    'federation-unified-readiness-ledger-v2.json',
  ]
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'reviewerIdentity', 'customerSubmission']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
})

test('regeneration is deterministic and records no route generation or build', () => {
  const names = [
    'federation-readiness-tranche-19-cohort-v1.json',
    'federation-readiness-tranche-19-source-inspections-v1.json',
    'federation-readiness-tranche-19-decisions-v1.json',
    'federation-readiness-tranche-19-page-specifications-v1.json',
    'federation-unified-readiness-ledger-v2.json',
  ]
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-19.ts'], { cwd: root })
  const after = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  assert.deepEqual(after, before)
  assert.deepEqual(cohort.execution, { routeGenerated: false, buildRun: false, deployed: false })
  assert.deepEqual(ledger.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
})
