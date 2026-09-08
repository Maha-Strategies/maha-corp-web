import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PRIVATE_CORPUS_MARKERS } from '../lib/batch-11-rehearsal-phases.ts'
import { digestOf } from '../lib/federation/dependency-cascade-contract.ts'
import {
  HEALTH_DATA_CONSENT_DECISION, REJECTED_INTERPRETATIONS, REMAINING_PREREQUISITE_DECISIONS, allDecisions,
} from '../lib/federation/prerequisite-closure.ts'
import { PUBLISH_CONCEPT_FINDINGS } from '../lib/federation/publish-contract-findings.ts'

const F = 'content/federation'
const read = (n: string) => JSON.parse(readFileSync(`${F}/${n}`, 'utf8'))
const cohort = read('federation-prerequisite-cohort-v1.json')
const packets = read('federation-prerequisite-source-packets-v1.json')
const decisions = read('federation-prerequisite-decisions-v1.json')
const specs = read('federation-prerequisite-page-specifications-v1.json')
const unlocks = read('federation-projected-unlock-report-v1.json')
const graph = read('federation-dependency-graph-v3.json')
const ledger = read('federation-unified-readiness-ledger-v7.json')

/* -- the cohort is derived, not assumed ------------------------------------ */

test('the frozen cohort is exactly the unresolved definitions with fan-out', () => {
  const map = read('federation-route-candidates-v5.json')
  const state = new Map((ledger.entries as { candidateId: string; state: string }[])
    .map((e) => [e.candidateId, e.state]))
  const inbound = new Map<string, number>()
  for (const e of graph.edges as { dependsOn: string }[]) {
    inbound.set(e.dependsOn, (inbound.get(e.dependsOn) ?? 0) + 1)
  }
  const expected = (map.candidates as { candidateId: string; routeRole: string }[])
    .filter((c) => c.routeRole === 'definition')
    .filter((c) => state.get(c.candidateId) !== undefined && state.get(c.candidateId) !== 'evidence-ready')
    .filter((c) => (inbound.get(c.candidateId) ?? 0) > 0)
    .map((c) => c.candidateId).sort()

  assert.deepEqual(
    (cohort.frozenCandidates as { candidateId: string }[]).map((c) => c.candidateId).sort(), expected)
  assert.equal(cohort.counts.frozenDefinitionCandidates, expected.length)
  // Every fan-in figure must match the graph, not a written-down number.
  for (const c of cohort.frozenCandidates as { candidateId: string; fanIn: number }[]) {
    assert.equal(c.fanIn, inbound.get(c.candidateId))
  }
})

test('every frozen candidate has exactly one decision', () => {
  const frozen = (cohort.frozenCandidates as { conceptId: string }[]).map((c) => c.conceptId).sort()
  const decided = (decisions.decisions as { conceptId: string }[]).map((d) => d.conceptId).sort()
  assert.deepEqual(decided, frozen)
  assert.equal(decisions.counts.reviewed, cohort.counts.frozenDefinitionCandidates)
  assert.equal(new Set(decided).size, decided.length, 'a candidate is decided at most once')
})

/* -- health-data consent clears only its exact definition ------------------ */

test('clearing health-data-consent clears one candidate and no dependent', () => {
  assert.equal(HEALTH_DATA_CONSENT_DECISION.decision, 'evidence-ready')
  assert.equal(decisions.counts.evidenceReady, 1)
  assert.equal(decisions.counts.dependentsMadeEvidenceReady, 0)

  const cleared = (decisions.decisions as { conceptId: string; decision: string; fanIn: number }[])
    .filter((d) => d.decision === 'evidence-ready')
  assert.equal(cleared.length, 1)
  assert.ok(cleared[0].fanIn > 60, 'the cleared definition should carry its real fan-out')
  assert.equal(decisions.counts.dependentsOfClearedDefinitions, cleared[0].fanIn)
  assert.match(decisions.noInheritance, /none\s+of those dependents becomes evidence-ready|none of those dependents becomes evidence-ready/)
  assert.match(HEALTH_DATA_CONSENT_DECISION.clearanceBoundary, /confers nothing on the 65 routes/)
})

test('no dependent of the cleared definition changed state', () => {
  const cleared = (decisions.decisions as { conceptId: string; decision: string; candidateId: string }[])
    .find((d) => d.decision === 'evidence-ready')!
  const state = new Map((ledger.entries as { candidateId: string; state: string }[])
    .map((e) => [e.candidateId, e.state]))
  const dependents = (graph.edges as { from: string; dependsOn: string }[])
    .filter((e) => e.dependsOn === cleared.candidateId).map((e) => e.from)
  // The ledger is not written by this track, so every dependent must still read
  // exactly as v7 left it.
  for (const id of dependents) assert.ok(state.has(id))
  assert.equal(ledger.counts.implementationReady, 1426, 'ledger v7 must be unchanged')
})

test('the consent review keeps its distinctions, boundaries and rejections', () => {
  assert.deepEqual([...decisions.clearedDistinctions].sort(), [
    'authorization', 'consent', 'emergency-use', 'lawful-basis', 'privacy-notice', 'research-consent', 'revocation',
  ])
  const rejected = REJECTED_INTERPRETATIONS.join(' ')
  assert.match(rejected, /universal or global law/)
  assert.match(rejected, /executable machine rule/)
  const packet = (packets.packets as { conceptId: string; sourcesInspected: { jurisdiction: string }[] }[])
    .find((p) => p.conceptId === HEALTH_DATA_CONSENT_DECISION.conceptId)!
  assert.equal(packet.sourcesInspected.length, 8)
  assert.equal(new Set(packet.sourcesInspected.map((s) => s.jurisdiction)).size, 2,
    'both jurisdictions must remain distinguishable')
  for (const s of packet.sourcesInspected) assert.notEqual(s.jurisdiction, 'Global')
})

/* -- the unresolved stay unresolved ---------------------------------------- */

test('the three unreviewed prerequisites remain unresolved', () => {
  assert.equal(REMAINING_PREREQUISITE_DECISIONS.length, 3)
  for (const d of REMAINING_PREREQUISITE_DECISIONS) {
    assert.notEqual(d.decision, 'evidence-ready')
    assert.equal(d.basis, 'no-inspected-source')
    assert.ok(Object.values(d.requirements).every((met) => met === false),
      `${d.conceptId} claims a requirement it did not meet`)
  }
})

test('the Publish concepts stay revise, and adjacency never clears one', () => {
  for (const f of PUBLISH_CONCEPT_FINDINGS) {
    assert.equal(f.role, 'revise')
    assert.notEqual(f.implementationStatus, 'exact-implementation')
  }
  const queryLetter = REMAINING_PREREQUISITE_DECISIONS
    .find((d) => d.conceptId.endsWith('agentic-query-letter'))!
  assert.equal(queryLetter.decision, 'revise')
  assert.match(queryLetter.reason, /adjacent implementation is not an implementation/)
})

test('missing-owner nodes for the deleted definitions stay explicit and unresolved', () => {
  const topics = (graph.missingOwnerTopicNodes as { topic?: string }[]).map((n) => n.topic)
  assert.ok(topics.includes('editorial-review'))
  assert.ok(topics.includes('machine-readable-article'))
  const repair = read('federation-dependency-graph-repair-v1.json')
  for (const r of repair.repairs as { newTarget?: string }[]) {
    if (r.newTarget) assert.ok(r.newTarget.startsWith('missing_'))
  }
})

/* -- specifications only for cleared definitions --------------------------- */

test('a specification exists only for a definition that reached evidence-ready', () => {
  assert.equal(specs.counts.specifications, decisions.counts.evidenceReady)
  const cleared = new Set((decisions.decisions as { conceptId: string; decision: string }[])
    .filter((d) => d.decision === 'evidence-ready').map((d) => d.conceptId))
  for (const s of specs.specifications as { conceptId: string }[]) {
    assert.ok(cleared.has(s.conceptId), `${s.conceptId} has a specification without being evidence-ready`)
  }
})

/* -- assessable is never readiness ----------------------------------------- */

test('assessable and evidence-ready are reported separately and never summed', () => {
  assert.ok(unlocks.counts.unresolvedPrerequisitesWithDependents > 0)
  assert.ok(unlocks.counts.totalWouldBecomeAssessable > 0)
  assert.ok(typeof unlocks.counts.evidenceReadyInLedger === 'number')
  assert.match(unlocks.assessableIsNotReady, /No sum of these two numbers is meaningful/)
  for (const p of unlocks.projections as { boundary: string }[]) {
    assert.match(p.boundary, /Assessable, not ready/)
  }
})

test('no count in the unlock report is hard-coded', () => {
  // 34/151 and 36/153 were reported by earlier runs. They must not reappear as
  // literals in the generator: every figure has to fall out of the artifacts.
  const generator = readFileSync('scripts/generate-dependency-cascade-contract.ts', 'utf8')
  for (const stale of ['34', '151', '36', '153']) {
    assert.ok(!new RegExp(`[^0-9]${stale}[^0-9]`).test(generator.replace(/\/\/.*$/gm, '')),
      `the generator contains the literal ${stale}`)
  }
  const derived = read('federation-dependency-graph-v3.json')
  assert.equal(unlocks.boundExactlyTo.dependencyGraph, derived.provenanceDigest)
})

/* -- determinism, identity, privacy ---------------------------------------- */

test('graph identities are deterministic', () => {
  const recomputed = digestOf({ ...graph, provenanceDigest: undefined })
  assert.match(graph.provenanceDigest, /^sha256:[a-f0-9]{64}$/)
  assert.equal(typeof recomputed, 'string')
  for (const n of graph.missingOwnerTopicNodes as { nodeId: string }[]) {
    assert.match(n.nodeId, /^missing_[a-f0-9]{24}$/)
  }
  assert.equal(new Set((graph.missingOwnerTopicNodes as { nodeId: string }[]).map((n) => n.nodeId)).size,
    graph.missingOwnerTopicNodes.length, 'node ids must not collide')
})

test('closure artifacts regenerate byte-identically', () => {
  const names = ['federation-prerequisite-cohort-v1.json', 'federation-prerequisite-source-packets-v1.json',
    'federation-prerequisite-decisions-v1.json', 'federation-prerequisite-page-specifications-v1.json']
  const before = names.map((n) => readFileSync(`${F}/${n}`, 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-prerequisite-closure.ts'], { stdio: 'ignore' })
  assert.deepEqual(names.map((n) => readFileSync(`${F}/${n}`, 'utf8')), before)
})

test('no private material appears in any closure artifact', () => {
  const names = ['federation-prerequisite-cohort-v1.json', 'federation-prerequisite-source-packets-v1.json',
    'federation-prerequisite-decisions-v1.json', 'federation-prerequisite-page-specifications-v1.json',
    'federation-projected-unlock-report-v1.json', 'federation-dependency-graph-v3.json']
  for (const n of names) {
    const body = readFileSync(`${F}/${n}`, 'utf8').toLowerCase()
    for (const marker of PRIVATE_CORPUS_MARKERS) {
      assert.ok(!body.includes(marker.toLowerCase()), `${n} contains private material (${marker})`)
    }
  }
})

test('no ledger is created or updated, and Tranche 23-25 files are untouched', () => {
  const changed = execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
    .split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
  for (const f of changed) {
    assert.ok(!/unified-readiness-ledger/.test(f), `a ledger was written: ${f}`)
    assert.ok(!/tranche-2[345]/.test(f), `a Tranche 23-25 file was written: ${f}`)
  }
  const generators = ['scripts/generate-prerequisite-closure.ts', 'scripts/generate-dependency-cascade-contract.ts']
    .map((f) => readFileSync(f, 'utf8'))
  for (const src of generators) {
    assert.ok(!/write\(\s*'federation-unified-readiness-ledger/.test(src))
  }
  assert.equal(allDecisions().length, 4)
})
