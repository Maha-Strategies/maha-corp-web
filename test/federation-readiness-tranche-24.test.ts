import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const cohort = read('federation-readiness-tranche-24-cohort-v1.json')
const decisions = read('federation-readiness-tranche-24-decisions-v1.json')
const sources = read('federation-readiness-tranche-24-source-inspections-v1.json')
const specs = read('federation-readiness-tranche-24-page-specifications-v1.json')
const ledgerV6 = read('federation-unified-readiness-ledger-v6.json')
const ledgerV7 = read('federation-unified-readiness-ledger-v7.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const t23 = read('federation-readiness-tranche-23-decisions-v1.json')

test('freezes 42 carried revisions before 58 untouched unresolved candidates', () => {
  const carried = t23.decisions.filter((row: { decision: string }) => row.decision === 'revise').map((row: { candidateId: string }) => row.candidateId)
  const prior = new Set(t23.decisions.map((row: { candidateId: string }) => row.candidateId))
  const unresolved = new Set(ledgerV6.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').map((row: { candidateId: string }) => row.candidateId))
  const next = priority.priorities.filter((row: { candidateId: string }) => unresolved.has(row.candidateId) && !prior.has(row.candidateId)).slice(0, 58).map((row: { candidateId: string }) => row.candidateId)
  assert.deepEqual(cohort.counts, { candidates: 100, priorRevisionRequirements: 42, newUnreviewed: 58, distinctConcepts: 47 })
  assert.deepEqual(cohort.candidates.map((row: { candidateId: string }) => row.candidateId), [...carried, ...next])
})

test('reviews all 100 candidates across six independent axes', () => {
  assert.deepEqual(decisions.counts, { candidates: 100, evidenceReady: 27, revise: 55, blocked: 18 })
  assert.equal(new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId)).size, 100)
  for (const row of decisions.decisions) {
    assert.deepEqual(Object.keys(row.axes).sort(), ['boundary', 'dependency', 'locator', 'rights', 'scope', 'sourceIdentity'].sort())
    assert.equal(row.dependency.valid, true)
    assert.ok(row.dependency.typedRelationships.some((item: { target: string }) => item.target === row.conceptId))
    assert.equal(row.sourceAssessment.roleSupported, row.decision === 'evidence-ready')
    assert.equal(row.activeBindingChanged, false)
  }
})

test('closes all six primary-source roles with bounded authority', () => {
  const rows = decisions.decisions.filter((row: { conceptId: string }) => row.conceptId.endsWith(':primary-source'))
  assert.equal(rows.length, 6)
  assert.ok(rows.every((row: { decision: string; sourceAssessment: { sourceIds: string[] } }) => row.decision === 'evidence-ready' && row.sourceAssessment.sourceIds.includes('t24-loc-primary-sources') && row.sourceAssessment.sourceIds.includes('t24-primary-source-contract')))
  const loc = sources.inspections.find((row: { sourceId: string }) => row.sourceId === 't24-loc-primary-sources')
  assert.match(loc.locator, /What are primary sources/)
  assert.match(loc.boundary, /does not establish truth/)
})

test('reuses Tamil evidence only within exact topic boundaries', () => {
  const tamil = decisions.decisions.filter((row: { conceptId: string }) => /:(marutam|divine-epithets|primary-text-boundaries|alvar-reception|kurinji|mullai)$/.test(row.conceptId))
  assert.equal(tamil.length, 17)
  assert.ok(tamil.every((row: { decision: string }) => row.decision === 'evidence-ready'))
  for (const row of tamil) {
    assert.ok(row.sourceAssessment.sourceIds.length > 0)
    assert.match(row.noInheritance, /transfers authority to another route role/)
  }
})

test('preserves prior mythology decisions and fail-closed boundaries', () => {
  const mythology = decisions.decisions.filter((row: { conceptId: string }) => /:(cult-title-versus-personal-name|primary-text-versus-later-commentary|translation-versus-identity|colonial-syncretism-records|soma|agni|devi|krishna|varuna|indra|vishnu|rudra-shiva|mythology)$/.test(row.conceptId))
  assert.ok(mythology.length >= 20)
  assert.ok(mythology.every((row: { decision: string }) => row.decision !== 'evidence-ready'))
  const policy = decisions.decisions.filter((row: { siteId: string }) => row.siteId === 'maha-policy')
  assert.ok(policy.every((row: { decision: string }) => row.decision === 'blocked'))
  const commercial = decisions.decisions.filter((row: { routeRole: string }) => row.routeRole === 'commercialization')
  assert.ok(commercial.every((row: { decision: string; finding: string }) => row.decision === 'revise' && /no offer is manufactured/i.test(row.finding)))
})

test('keeps health-data consent reserved for the parallel dependency track', () => {
  const consent = decisions.decisions.find((row: { conceptId: string }) => row.conceptId.endsWith(':health-data-consent'))
  assert.equal(consent.decision, 'revise')
  assert.match(consent.finding, /separate dependency-cascade review/)
})

test('specifies exactly the evidence-ready candidates', () => {
  assert.deepEqual(specs.counts, { specifications: 27, boundedQuestions: 135 })
  const ready = decisions.decisions.filter((row: { decision: string }) => row.decision === 'evidence-ready').map((row: { candidateId: string }) => row.candidateId).sort()
  assert.deepEqual(specs.specifications.map((row: { candidateId: string }) => row.candidateId).sort(), ready)
  assert.ok(specs.specifications.every((row: { publicRouteCreated: boolean; sourceBindings: unknown[] }) => !row.publicRouteCreated && row.sourceBindings.length > 0))
})

test('local implementation locators resolve', () => {
  for (const row of sources.inspections.filter((item: { sourceId: string }) => item.sourceId === 't24-primary-source-contract')) {
    const [path, symbols] = row.locator.split(' — ')
    assert.equal(existsSync(resolve(root, path)), true)
    for (const symbol of symbols.split(' and ')) assert.ok(readFileSync(resolve(root, path), 'utf8').includes(symbol), symbol)
  }
})

test('ledger v7 closes 27 routes and corrects four unreviewed replacement claims', () => {
  assert.deepEqual(ledgerV7.counts, { routeCandidates: 1628, implementationReady: 1426, unresolved: 202, newlyReadyThisTranche: 27 })
  const reviewed = new Set(decisions.decisions.map((row: { candidateId: string }) => row.candidateId))
  const corrected = new Set(['cand_d43767b90b272ddead9ab56c', 'cand_4080575bad7a1bfd45b42d3a', 'cand_1981169ef4336a655069490c', 'cand_9d7f62fef0254f8faa993456'])
  for (const entry of ledgerV7.entries) {
    const prior = ledgerV6.entries.find((row: { candidateId: string }) => row.candidateId === entry.candidateId)
    assert.ok(prior)
    if (!reviewed.has(entry.candidateId) && !corrected.has(entry.candidateId)) assert.deepEqual(entry, prior)
    if (corrected.has(entry.candidateId)) assert.equal(entry.implementationState, 'unresolved')
  }
})

test('artifacts are deterministic, digest-bound, private, and build-free', () => {
  const names = ['federation-readiness-tranche-24-cohort-v1.json', 'federation-readiness-tranche-24-source-inspections-v1.json', 'federation-readiness-tranche-24-decisions-v1.json', 'federation-readiness-tranche-24-page-specifications-v1.json', 'federation-unified-readiness-ledger-v7.json']
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-tranche-24.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
  assert.deepEqual(cohort.execution, { publicRoutesGenerated: 0, buildRun: false, deployed: false })
  assert.deepEqual(ledgerV7.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
})
