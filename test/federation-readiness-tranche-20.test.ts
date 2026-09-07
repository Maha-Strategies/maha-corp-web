import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { GAP_CLOSURE_SOURCES, POLICY_SOURCES, PRODUCT_CONTRACT_FINDING, digest } from '../lib/federation/readiness-tranche-20.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-20-cohort-v1.json')
const fixtures = read('federation-readiness-tranche-20-gap-closure-fixtures-v1.json')
const sources = read('federation-readiness-tranche-20-source-inspections-v1.json')
const decisions = read('federation-readiness-tranche-20-decisions-v1.json')
const specs = read('federation-readiness-tranche-20-page-specifications-v1.json')
const ledgerV2 = read('federation-unified-readiness-ledger-v2.json')
const ledgerV3 = read('federation-unified-readiness-ledger-v3.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const tranche19 = read('federation-readiness-tranche-19-decisions-v1.json')

test('freezes all 49 revision requirements before 51 untouched unresolved candidates', () => {
  const revisions = tranche19.decisions.filter((row: { decision: string }) => row.decision === 'revise').map((row: { candidateId: string }) => row.candidateId)
  const priorIds = new Set(tranche19.decisions.map((row: { candidateId: string }) => row.candidateId))
  const unresolved = new Set(ledgerV2.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const next = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId) && !priorIds.has(row.candidateId)).slice(0, 51).map((row: { candidateId: string }) => row.candidateId)
  assert.deepEqual(cohort.counts, { candidates: 100, priorRevisionRequirements: 49, newUnreviewed: 51, distinctConcepts: 56 })
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), [...revisions, ...next])
  assert.equal(new Set(cohort.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 100)
})

test('issues an exhaustive role-specific 28/71/1 partition', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 28, revise: 71, blocked: 1 })
  assert.equal(decisions.decisions.length, 100)
  assert.equal(decisions.decisions.filter((row: { decision: string; selectionBasis: string }) => row.decision === 'evidence-ready' && row.selectionBasis === 'tranche-19-revision-requirement').length, 10)
  for (const row of decisions.decisions) {
    assert.equal(row.activeBindingChanged, false)
    assert.match(row.noInheritance, /cannot be inherited/)
    assert.equal(row.decision === 'evidence-ready', row.sourceAssessment.roleSupported)
  }
})

test('bounded fixtures close only the exact implementation roles', () => {
  assert.equal(fixtures.syntheticOnly, true)
  assert.equal(fixtures.fixtures.length, 5)
  assert.equal(fixtures.definitionRevision.conceptId, 'urn:maha:concept:evidence:source-recovery')
  assert.equal(fixtures.definitionRevision.canonicalBindingChanged, false)
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready')
  for (const row of ready.filter((item: { sourceAssessment: { kind: string } }) => item.sourceAssessment.kind === 'local-implementation')) {
    const exact = (GAP_CLOSURE_SOURCES[row.conceptId] ?? []).filter((source) => source.roles.includes(row.routeRole))
    assert.ok(exact.length > 0, `${row.candidateId}:${row.routeRole}`)
  }
  const interval = ready.filter((row: { conceptId: string }) => row.conceptId.endsWith(':interval-bounds'))
  assert.deepEqual(interval.map((row: { routeRole: string }) => row.routeRole).sort(), ['machine-interface', 'reproducibility'])
})

test('all local implementation locators resolve to every named symbol', () => {
  for (const rows of Object.values(GAP_CLOSURE_SOURCES)) for (const inspection of rows) {
    const [path, names] = inspection.locator.split(' — ')
    assert.equal(existsSync(resolve(root, path)), true, path)
    const text = readFileSync(resolve(root, path), 'utf8')
    for (const name of names.split(' and ')) assert.ok(text.includes(name), inspection.locator)
  }
})

test('official policy authority is scoped by route role and never inherited into a machine rule', () => {
  assert.equal(Object.keys(POLICY_SOURCES).length, 8)
  const policy = decisions.decisions.filter((row: { siteId: string }) => row.siteId === 'maha-policy')
  assert.equal(policy.filter((row: { decision: string }) => row.decision === 'evidence-ready').length, 18)
  const machineRule = policy.find((row: { path: string }) => row.path === '/policy/competition-policy/machine-rule')
  assert.equal(machineRule.decision, 'revise')
  assert.equal(machineRule.sourceAssessment.roleSupported, false)
  assert.ok(sources.inspections.filter((row: { kind: string }) => row.kind === 'official-authority').every((row: { passageStored: boolean; boundary: string }) => row.passageStored === false && row.boundary.length > 20))
})

test('commercial candidates remain revise while offer contracts conflict', () => {
  assert.match(PRODUCT_CONTRACT_FINDING, /\$49/)
  assert.match(PRODUCT_CONTRACT_FINDING, /\$250/)
  assert.match(PRODUCT_CONTRACT_FINDING, /\$5,000/)
  const commercial = decisions.decisions.filter((row: { routeRole: string }) => row.routeRole === 'commercial-use' || row.routeRole === 'commercialization')
  assert.ok(commercial.length > 20)
  assert.ok(commercial.every((row: { decision: string; finding: string }) => row.decision === 'revise' && row.finding === PRODUCT_CONTRACT_FINDING))
})

test('specifications exist for all and only newly evidence-ready candidates', () => {
  assert.deepEqual(specs.counts, { specifications: 28, boundedQuestions: 140 })
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort(), ready)
  for (const spec of specs.specifications) {
    assert.equal(spec.publicRouteCreated, false)
    assert.equal(spec.implementationState, 'specification-only')
    assert.equal(spec.boundedQuestions.length, 5)
    assert.ok(spec.sourceBindings.length > 0)
  }
})

test('ledger v3 advances only the exact reviewed cohort and preserves the route budget', () => {
  assert.deepEqual(ledgerV3.counts, { routeCandidates: 1628, implementationReady: 1210, unresolved: 418, newlyReadyThisTranche: 28 })
  const reviewed = new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId))
  for (const entry of ledgerV3.entries) {
    const prior = ledgerV2.entries.find((row: { candidateId: string }) => row.candidateId === entry.candidateId)
    assert.ok(prior)
    if (!reviewed.has(entry.candidateId)) assert.deepEqual(entry, prior)
  }
})

test('artifacts authenticate their bodies and contain no private payload', () => {
  for (const name of ['federation-readiness-tranche-20-cohort-v1.json', 'federation-readiness-tranche-20-gap-closure-fixtures-v1.json', 'federation-readiness-tranche-20-source-inspections-v1.json', 'federation-readiness-tranche-20-decisions-v1.json', 'federation-readiness-tranche-20-page-specifications-v1.json', 'federation-unified-readiness-ledger-v3.json']) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
})

test('regeneration is deterministic and cannot generate or build public routes', () => {
  const names = ['federation-readiness-tranche-20-cohort-v1.json', 'federation-readiness-tranche-20-gap-closure-fixtures-v1.json', 'federation-readiness-tranche-20-source-inspections-v1.json', 'federation-readiness-tranche-20-decisions-v1.json', 'federation-readiness-tranche-20-page-specifications-v1.json', 'federation-unified-readiness-ledger-v3.json']
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-20.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.deepEqual(ledgerV3.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
})
