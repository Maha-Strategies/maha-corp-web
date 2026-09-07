import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  ABSENT_DEFINITION, IDENTITY_RESOLVED, SATISFYING_STATES, categorize, classifyNonBlockingEdges,
  digestOf, projectUnlocks, verifyCanonicalOwnerDependencies, verifyCascade, verifyNoEvidenceInheritance,
  type CandidateNode, type DependencyEdge,
} from '../lib/federation/dependency-cascade-contract.ts'
import { DEFINITION_SCOPE, HEALTH_DATA_CONSENT_SOURCES } from '../lib/federation/health-data-consent-sources.ts'
import { PUBLISH_CONCEPT_FINDINGS } from '../lib/federation/publish-contract-findings.ts'

const F = 'content/federation'
const read = (n: string) => JSON.parse(readFileSync(`${F}/${n}`, 'utf8'))
const contract = read('federation-dependency-cascade-contract-v1.json')
const inspections = read('federation-prerequisite-source-inspections-v1.json')
const publish = read('federation-publish-contract-findings-v1.json')
const unlocks = read('federation-projected-unlock-report-v1.json')
const repair = read('federation-dependency-graph-repair-v1.json')
const graphV3 = read('federation-dependency-graph-v3.json')

/* -- bounded fixtures ------------------------------------------------------- */

const node = (over: Partial<CandidateNode> & { candidateId: string }): CandidateNode => ({
  conceptId: 'urn:maha:concept:x', siteId: 'owner', routeRole: 'definition',
  canonicalOwner: 'owner', state: 'evidence-ready', ...over,
})

/** An owner's definition, a ready application on it, and a live published one. */
const FIXTURE = {
  ownerDefinition: node({ candidateId: 'def-owner' }),
  offOwnerApplication: node({
    candidateId: 'app-offowner', siteId: 'other', canonicalOwner: 'owner', routeRole: 'commercial-use',
  }),
  offOwnerDefinition: node({ candidateId: 'def-offowner', siteId: 'other', canonicalOwner: 'owner' }),
  unresolvedDefinition: node({ candidateId: 'def-unresolved', state: 'revise' }),
  readyDependent: node({ candidateId: 'app-ready', routeRole: 'workflow', state: 'evidence-ready' }),
  blockedDependent: node({ candidateId: 'app-blocked', routeRole: 'workflow', state: 'blocked' }),
  livePublished: node({ candidateId: 'observed-live', canonicalOwner: null, state: 'live-published' }),
  identityResolved: node({ candidateId: 'def-graph-object', state: IDENTITY_RESOLVED }),
  absentDefinition: node({ candidateId: 'def-absent', state: ABSENT_DEFINITION }),
}
const edge = (from: string, dependsOn: string): DependencyEdge => ({ from, dependsOn, reason: 'fixture' })

/* -- category separation ---------------------------------------------------- */

test('every route role in the map resolves to one of the five categories', () => {
  const map = read('federation-route-candidates-v5.json')
  const valid = new Set(['definition', 'application', 'policy', 'implementation', 'commercial-offer'])
  for (const c of map.candidates as { routeRole: string }[]) {
    assert.ok(valid.has(categorize(c.routeRole)), `${c.routeRole} did not categorize`)
  }
  const totals = contract.verification.categories
  assert.equal(Object.values(totals).reduce((a: number, b) => a + Number(b), 0), contract.verification.inputs.nodeCount)
})

test('the five categories are distinguished, not collapsed', () => {
  assert.equal(categorize('definition'), 'definition')
  assert.equal(categorize('policy'), 'policy')
  assert.equal(categorize('implementation'), 'implementation')
  assert.equal(categorize('commercial-use'), 'commercial-offer')
  assert.equal(categorize('workflow'), 'application')
  assert.equal(categorize('a-role-invented-tomorrow'), 'application')
})

/* -- canonical owner -------------------------------------------------------- */

/**
 * The first version of this rule flagged every edge reaching an application
 * hosted off its concept's owner — 843 of them — because it read ownership as
 * constraining where a concept may be used. It constrains where a concept is
 * defined. maha-strategies hosting a commercial-use route for a maha-research
 * concept is the intended federation shape.
 */
test('an application hosted off its concept owner is not a violation', () => {
  const nodes = [FIXTURE.ownerDefinition, FIXTURE.offOwnerApplication]
  const violations = verifyCanonicalOwnerDependencies(nodes, [edge('app-offowner', 'def-owner')])
  assert.deepEqual(violations, [])
})

test('a definition hosted off its concept owner is a violation', () => {
  const nodes = [FIXTURE.offOwnerDefinition, FIXTURE.readyDependent]
  const violations = verifyCanonicalOwnerDependencies(nodes, [edge('app-ready', 'def-offowner')])
  const codes = violations.map((v) => v.code)
  assert.ok(codes.includes('definition-off-canonical-owner'))
  assert.ok(codes.includes('dependency-on-non-owner-definition'))
})

test('a dangling source and a dangling target are distinguished', () => {
  const nodes = [FIXTURE.ownerDefinition]
  const fromMissing = verifyCanonicalOwnerDependencies(nodes, [edge('ghost', 'def-owner')])
  const toMissing = verifyCanonicalOwnerDependencies(nodes, [edge('def-owner', 'ghost')])
  assert.deepEqual(fromMissing.map((v) => v.code), ['unknown-source-node'])
  assert.deepEqual(toMissing.map((v) => v.code), ['unknown-target-node'])
  assert.match(toMissing[0].detail, /no longer exists/)
})

/* -- evidence inheritance --------------------------------------------------- */

test('a ready candidate depending on an absent definition is a violation', () => {
  const nodes = [FIXTURE.readyDependent, FIXTURE.absentDefinition]
  const violations = verifyNoEvidenceInheritance(nodes, [edge('app-ready', 'def-absent')])
  assert.equal(violations.length, 1)
  assert.equal(violations[0].code, 'evidence-inherited-across-edge')
  assert.match(violations[0].detail, /exists in neither the route map nor the canonical graph objects/)
})

/**
 * The graph computes dependencyReadyNodes as candidates with no edge to a
 * missing-owner definition, so by its own rule only a missing definition
 * blocks. Its other edges say "-first" and "-precedes-": they order
 * publication. A page can be evidence-ready and not yet publishable.
 */
test('an ordering edge to an unresolved definition is not evidence inheritance', () => {
  const nodes = [FIXTURE.readyDependent, FIXTURE.unresolvedDefinition]
  const edges = [edge('app-ready', 'def-unresolved')]
  assert.deepEqual(verifyNoEvidenceInheritance(nodes, edges), [])
  assert.equal(classifyNonBlockingEdges(nodes, edges).orderingConstraints, 1)
})

/**
 * Tranche 19 moved 32 definitions into canonical graph objects on the stated
 * ground that a dependent needs the concept resolvable and a graph object
 * resolves it. Identity is resolved; evidence is not, and never was — 29 of
 * the 32 are blocked.
 */
test('a canonical graph object resolves identity and confers no evidence', () => {
  const nodes = [FIXTURE.readyDependent, FIXTURE.identityResolved]
  const edges = [edge('app-ready', 'def-graph-object')]
  assert.deepEqual(verifyNoEvidenceInheritance(nodes, edges), [])
  assert.equal(classifyNonBlockingEdges(nodes, edges).identityResolvedPrerequisites, 1)
  // Resolving identity must not make the prerequisite count as evidence-ready.
  assert.ok(!SATISFYING_STATES.includes(IDENTITY_RESOLVED))
})

test('an absent definition is never treated as identity-resolved', () => {
  const nodes = [FIXTURE.readyDependent, FIXTURE.absentDefinition]
  const edges = [edge('app-ready', 'def-absent')]
  assert.equal(classifyNonBlockingEdges(nodes, edges).identityResolvedPrerequisites, 0)
  assert.equal(classifyNonBlockingEdges(nodes, edges).orderingConstraints, 0)
  assert.equal(verifyNoEvidenceInheritance(nodes, edges).length, 1)
})

test('a live published prerequisite satisfies a dependency', () => {
  const nodes = [FIXTURE.readyDependent, FIXTURE.livePublished]
  assert.deepEqual(verifyNoEvidenceInheritance(nodes, [edge('app-ready', 'observed-live')]), [])
  assert.ok(SATISFYING_STATES.includes('live-published'))
})

test('an unresolved candidate depending on an unresolved prerequisite is not an inheritance violation', () => {
  const nodes = [FIXTURE.blockedDependent, FIXTURE.unresolvedDefinition]
  assert.deepEqual(verifyNoEvidenceInheritance(nodes, [edge('app-blocked', 'def-unresolved')]), [])
})

/* -- order independence and digest binding ---------------------------------- */

test('results are order-independent', () => {
  const nodes = [FIXTURE.ownerDefinition, FIXTURE.readyDependent, FIXTURE.unresolvedDefinition, FIXTURE.livePublished]
  const edges = [edge('app-ready', 'def-unresolved'), edge('app-ready', 'def-owner'), edge('app-ready', 'observed-live')]
  const forward = verifyCascade(nodes, edges)
  const reversed = verifyCascade([...nodes].reverse(), [...edges].reverse())
  assert.equal(forward.inputs.inputsDigest, reversed.inputs.inputsDigest)
  assert.deepEqual(forward.violations, reversed.violations)
  assert.deepEqual(forward.crossCategoryEdges, reversed.crossCategoryEdges)
})

test('the digest is bound to the inputs, so a changed state changes it', () => {
  const nodes = [FIXTURE.ownerDefinition, FIXTURE.readyDependent]
  const edges = [edge('app-ready', 'def-owner')]
  const before = verifyCascade(nodes, edges).inputs.inputsDigest
  const after = verifyCascade([FIXTURE.ownerDefinition, { ...FIXTURE.readyDependent, state: 'blocked' }], edges)
    .inputs.inputsDigest
  assert.notEqual(before, after)
  assert.match(before, /^sha256:[a-f0-9]{64}$/)
})

test('the contract names the exact artifacts it was computed from', () => {
  for (const digest of Object.values(contract.boundExactlyTo)) {
    assert.match(String(digest), /^sha256:[a-f0-9]{64}$/)
  }
  assert.equal(contract.boundExactlyTo.candidateMap, read('federation-route-candidates-v5.json').provenanceDigest)
})

/* -- projected unlocks ------------------------------------------------------ */

test('accepting a prerequisite makes dependents assessable, never ready', () => {
  const nodes = [FIXTURE.unresolvedDefinition, FIXTURE.blockedDependent]
  const [projection] = projectUnlocks(nodes, [edge('app-blocked', 'def-unresolved')], ['def-unresolved'])
  assert.deepEqual(projection.wouldBecomeAssessable, ['app-blocked'])
  assert.match(projection.boundary, /Assessable, not ready/)
  assert.equal(digestOf(projection).startsWith('sha256:'), true)
})

test('a dependent held by a second prerequisite is not projected as unlocked', () => {
  const other = node({ candidateId: 'def-other', state: 'blocked' })
  const nodes = [FIXTURE.unresolvedDefinition, FIXTURE.blockedDependent, other]
  const edges = [edge('app-blocked', 'def-unresolved'), edge('app-blocked', 'def-other')]
  const [projection] = projectUnlocks(nodes, edges, ['def-unresolved'])
  assert.deepEqual(projection.wouldBecomeAssessable, [])
  assert.deepEqual(projection.stillHeldByOtherPrerequisites, ['app-blocked'])
})

test('the unlock report projects assessability, never readiness', () => {
  assert.match(unlocks.boundary, /never be added to an evidence-ready total/)
  // The projection must not name any candidate as becoming ready. Counting
  // prerequisites whose dependents are already ready is the violation being
  // reported, not a readiness claim, so the check is against the outcome
  // vocabulary rather than the substring "ready".
  for (const key of Object.keys(unlocks.counts)) {
    assert.ok(!/becomesReady|nowReady|readyAfter|unlockedReady/i.test(key), `${key} claims readiness`)
  }
  for (const p of unlocks.projections as { wouldBecomeAssessable: unknown[]; boundary: string }[]) {
    assert.ok(Array.isArray(p.wouldBecomeAssessable))
    assert.match(p.boundary, /Assessable, not ready/)
  }
})

/* -- health-data-consent inspections ---------------------------------------- */

test('every inspected source carries identity, version, locator, rights, scope and boundary', () => {
  for (const s of HEALTH_DATA_CONSENT_SOURCES) {
    assert.ok(s.title.length > 5 && s.instrument.length > 5, `${s.sourceId} lacks identity`)
    assert.ok(s.version.length > 5, `${s.sourceId} lacks a version`)
    assert.ok(s.rights.length > 30, `${s.sourceId} lacks rights`)
    assert.ok(s.scope.length > 40, `${s.sourceId} lacks scope`)
    assert.ok(s.boundary.length > 40, `${s.sourceId} lacks a boundary`)
    assert.ok(s.findings.length > 0, `${s.sourceId} has no findings`)
    for (const f of s.findings) assert.ok(f.locator.length > 5 && f.states.length > 40)
  }
})

test('all seven consent distinctions are covered by an inspected source', () => {
  const required = ['consent', 'authorization', 'privacy-notice', 'lawful-basis', 'revocation', 'emergency-use', 'research-consent']
  const covered = new Set(HEALTH_DATA_CONSENT_SOURCES.flatMap((s) => s.distinctions))
  for (const d of required) assert.ok(covered.has(d as never), `${d} is not covered by any source`)
})

test('the definition may not claim universal law or a machine-executable rule', () => {
  const text = DEFINITION_SCOPE.mayNotEstablish.join(' ')
  assert.match(text, /universal or global law/)
  assert.match(text, /machine-executable consent rule/)
  assert.ok(DEFINITION_SCOPE.mayNotEstablish.length >= 4)
  for (const s of HEALTH_DATA_CONSENT_SOURCES) {
    assert.ok(s.jurisdiction !== 'Global', `${s.sourceId} claims global jurisdiction`)
  }
})

test('the clearance question is answered from the graph, not from the brief', () => {
  const c = inspections.clearanceQuestion
  assert.equal(c.mahaOsHeldCandidates.length, 1)
  assert.match(c.answer, /It does not, because there are none/)
  assert.match(c.whatResolvingItActuallyDoes, /unblocks nothing, because nothing was blocked/)
})

/* -- publish contract findings ---------------------------------------------- */

test('no Publish concept is upgraded by an adjacent implementation', () => {
  for (const f of PUBLISH_CONCEPT_FINDINGS) {
    if (f.implementationStatus !== 'exact-implementation') {
      assert.notEqual(f.role, 'evidence-ready', `${f.conceptId} was upgraded without an exact implementation`)
      assert.equal(f.fixturesCreated, false, `${f.conceptId} has fixtures but no exact implementation`)
    }
    if (f.nearestImplementation) {
      assert.ok(f.nearestImplementation.whyItIsNotThisConcept.length > 80,
        `${f.conceptId} cites a near-miss without saying why it misses`)
    }
    assert.ok(f.searched.length >= 2, `${f.conceptId} does not record what was searched`)
  }
  assert.equal(publish.counts.exactImplementations, 0)
  assert.equal(publish.counts.fixturesCreated, 0)
})

/* -- the real findings ------------------------------------------------------ */

test('the contract reports the violations found in the repaired graph', () => {
  assert.equal(contract.verification.counts.evidenceInheritanceViolations, 12)
  assert.deepEqual(contract.verification.violations.canonicalOwner, [],
    'no dangling edges should remain after the v3 repair')
  assert.equal(contract.verification.clean, false)
  assert.equal(contract.boundExactlyTo.dependencyGraph, graphV3.provenanceDigest)
  assert.equal(contract.boundExactlyTo.definitionGraphObjects,
    read('federation-definition-graph-objects-v1.json').provenanceDigest)
})

/**
 * The earlier count of 251 was not wrong about which edges exist — it was wrong
 * about what they mean. Every one of those edges is still accounted for, as a
 * violation, an ordering constraint or an identity-resolved prerequisite. If
 * this sum ever drops below 251, edges were discarded rather than reclassified.
 */
test('every edge from a ready dependent to an unsatisfied prerequisite is classified, none discarded', () => {
  // The invariant is derived, not pinned. An earlier version asserted 116, 123
  // and a total of 251, which were correct against ledger v5 and wrong against
  // v7 the moment two candidates changed state. Recomputing the population
  // from the artifacts keeps the guarantee — no edge is silently dropped —
  // without dating the test.
  const graph = read('federation-dependency-graph-v3.json')
  const ledger = read('federation-unified-readiness-ledger-v7.json')
  const objects = read('federation-definition-graph-objects-v1.json')
  const state = new Map((ledger.entries as { candidateId: string; state: string }[])
    .map((e) => [e.candidateId, e.state]))
  const resolved = new Set((objects.graphObjects as { conceptId: string }[])
    .map((o) => o.conceptId.split(':').pop()))
  const satisfying = new Set<string>()
  for (const n of [...graph.observedAnchorNodes, ...graph.observedTopicNodes] as { nodeId: string }[]) {
    satisfying.add(n.nodeId)
  }
  const missing = new Map((graph.missingOwnerTopicNodes as { nodeId: string; topic?: string; conceptId?: string }[])
    .map((n) => [n.nodeId, n.topic ?? n.conceptId?.split(':').pop() ?? '']))

  let population = 0
  for (const e of graph.edges as { from: string; dependsOn: string }[]) {
    if (state.get(e.from) !== 'evidence-ready') continue
    if (satisfying.has(e.dependsOn)) continue
    if (state.get(e.dependsOn) === 'evidence-ready') continue
    if (!state.has(e.dependsOn) && !missing.has(e.dependsOn)) continue
    population += 1
  }

  const { evidenceInheritanceViolations } = contract.verification.counts
  const { orderingConstraints, identityResolvedPrerequisites } = contract.verification.nonBlocking
  assert.equal(
    evidenceInheritanceViolations + orderingConstraints + identityResolvedPrerequisites, population,
    'every such edge must be a violation, an ordering constraint or an identity-resolved prerequisite')
  assert.ok(identityResolvedPrerequisites > 0 && resolved.size > 0)
})

test('the 12 remaining violations are the definitions v5 deleted', () => {
  const targets = new Set(contract.verification.violations.evidenceInheritance
    .map((v: { dependsOn: string }) => v.dependsOn))
  assert.equal(targets.size, 2, 'exactly two concepts have no definition anywhere')
  const missing = (graphV3.missingOwnerTopicNodes as { nodeId: string; topic: string }[])
    .filter((n) => targets.has(n.nodeId)).map((n) => n.topic).sort()
  assert.deepEqual(missing, ['editorial-review', 'machine-readable-article'])
})

/* -- the dangling-edge repair ---------------------------------------------- */

test('all 19 dangling edges are accounted for, none silently deleted', () => {
  assert.equal(repair.counts.danglingEdges, 19)
  assert.equal(repair.counts.reboundToMissingOwnerDefinition, 14)
  assert.equal(repair.counts.droppedOrphanedSource, 5)
  assert.equal(repair.repairs.length, 19)
  for (const r of repair.repairs as { detail: string; removedCandidate: string }[]) {
    assert.ok(r.detail.length > 80, 'every repair states why it was made')
    assert.ok(r.removedCandidate.length > 5)
  }
})

test('the repaired graph has no dangling edge left', () => {
  const known = new Set<string>([
    ...(read('federation-route-candidates-v5.json').candidates as { candidateId: string }[]).map((c) => c.candidateId),
    ...(graphV3.observedAnchorNodes as { nodeId: string }[]).map((n) => n.nodeId),
    ...(graphV3.observedTopicNodes as { nodeId: string }[]).map((n) => n.nodeId),
    ...(graphV3.missingOwnerTopicNodes as { nodeId: string }[]).map((n) => n.nodeId),
  ])
  const dangling = (graphV3.edges as { from: string; dependsOn: string }[])
    .filter((e) => !known.has(e.from) || !known.has(e.dependsOn))
  assert.deepEqual(dangling, [])
  assert.equal(graphV3.counts.danglingEdgesRemaining, 0)
  assert.equal(graphV3.edges.length, 3117)
})

/**
 * The first repair keyed missing-owner node ids on siteId and topic, and topic
 * is undefined on both removed definitions — so both hashed to one id and all
 * 14 edges collapsed onto a single node, absorbing editorial-review's seven
 * dependencies into machine-readable-article's. Two concepts must never share
 * a node.
 */
test('each removed definition gets its own missing-owner node', () => {
  const added = repair.missingOwnerDefinitionNodesAdded as { nodeId: string; conceptId: string }[]
  assert.equal(added.length, 2)
  assert.equal(new Set(added.map((n) => n.nodeId)).size, 2)
  assert.equal(new Set(added.map((n) => n.conceptId)).size, 2)

  const perTarget: Record<string, number> = {}
  for (const r of repair.repairs as { newTarget?: string }[]) {
    if (r.newTarget) perTarget[r.newTarget] = (perTarget[r.newTarget] ?? 0) + 1
  }
  assert.deepEqual(Object.values(perTarget).sort(), [7, 7],
    'each removed definition should carry its own seven dependents')
})

test('a dependency is never repointed at the declared v5 replacement', () => {
  // The four declared successors are different concepts and none is a
  // definition, so rebinding to one would hide the missing definition behind a
  // route that defines something else.
  const replacements = new Set([
    '/clearing/evidence-workflows/runtime-witness-receipts/artifact-role-inventory',
    '/clearing/evidence-workflows/privacy-boundary/served-bundle-check',
    '/agentic-publishing/internal-review/exact-revision-binding',
    '/agentic-publishing/correction-and-retraction/withdrawal-propagation',
  ])
  const byId = new Map((read('federation-route-candidates-v5.json').candidates as { candidateId: string; path: string }[])
    .map((c) => [c.candidateId, c.path]))
  for (const r of repair.repairs as { newTarget?: string }[]) {
    if (!r.newTarget) continue
    assert.ok(r.newTarget.startsWith('missing_'), 'a rebound target must be a missing-owner node')
    assert.ok(!replacements.has(byId.get(r.newTarget) ?? ''), 'must not repoint at a declared replacement')
  }
  assert.match(repair.declaredReplacementsNotUsed.finding, /none is a\s+definition|none is a definition/)
})

test('dependency graph v2 is not modified by the repair', () => {
  const v2 = read('federation-dependency-graph-v2.json')
  assert.equal(v2.edges.length, 3122)
  assert.equal(v2.schemaVersion, 'maha-federation-dependency-graph/2.0')
  assert.equal(graphV3.previousDependencyGraphDigest, v2.provenanceDigest)
  assert.equal(graphV3.supersedes, 'federation-dependency-graph-v2.json')
})

test('the repair claims no readiness and resolves no dependency', () => {
  assert.match(repair.boundary, /creates no route, resolves no dependency/)
  assert.match(repair.boundary, /raise the\s+evidence-inheritance count|raise the evidence-inheritance count/)
})

test('artifacts regenerate byte-identically', () => {
  const names = ['federation-dependency-cascade-contract-v1.json', 'federation-prerequisite-source-inspections-v1.json',
    'federation-publish-contract-findings-v1.json', 'federation-projected-unlock-report-v1.json',
    'federation-dependency-graph-v3.json', 'federation-dependency-graph-repair-v1.json']
  const before = names.map((n) => readFileSync(`${F}/${n}`, 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-dependency-graph-v3.ts'], { stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-dependency-cascade-contract.ts'], { stdio: 'ignore' })
  assert.deepEqual(names.map((n) => readFileSync(`${F}/${n}`, 'utf8')), before)
})

/**
 * This track may revise its own artifacts. It may not touch anyone else's —
 * candidate decisions, ledgers, Tranche 23 files, or the dependency graph v2 it
 * supersedes.
 */
const OWNED_BY_THIS_TRACK = [
  'content/federation/federation-dependency-cascade-contract-v1.json',
  'content/federation/federation-prerequisite-source-inspections-v1.json',
  'content/federation/federation-publish-contract-findings-v1.json',
  'content/federation/federation-projected-unlock-report-v1.json',
  'content/federation/federation-dependency-graph-v3.json',
  'content/federation/federation-dependency-graph-repair-v1.json',
  'lib/federation/dependency-cascade-contract.ts',
  'lib/federation/health-data-consent-sources.ts',
  'lib/federation/publish-contract-findings.ts',
  'scripts/generate-dependency-cascade-contract.ts',
  'scripts/generate-dependency-graph-v3.ts',
  'test/federation-dependency-cascade-contract.test.ts',
  'docs/operations/dependency-cascade-publish-contract.md',
]

/**
 * One file outside this track is touched: the tranche-13 no-mutation guard.
 * That guard treats every artifact without a tranche number as frozen, so it
 * flags this track regenerating its own outputs. Its `ownedByCurrentWork`
 * allowlist exists to be extended by each track, which is what was done — but
 * extending someone else's guard is not the same as owning their file, so the
 * exception is verified rather than assumed: the diff must touch nothing but
 * the allowlist, and must not remove an existing entry.
 */
const SHARED_GUARD = 'test/federation-tranche-13.test.ts'

test('no artifact owned by another track was modified', () => {
  const changed = execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
    .split('\n').filter((l) => /^\s*[MD]/.test(l)).map((l) => l.slice(3).trim()).filter(Boolean)
    .filter((f) => !OWNED_BY_THIS_TRACK.includes(f) && f !== SHARED_GUARD)
  assert.deepEqual(changed, [], `files owned by another track were modified: ${changed.join(', ')}`)
})

test('the shared tranche-13 guard is extended, not rewritten', () => {
  const diff = execFileSync('git', ['diff', '--', SHARED_GUARD], { encoding: 'utf8' })
  if (diff.trim() === '') return // already committed

  const removed = diff.split('\n')
    .filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1).trim())
  const added = diff.split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim())

  for (const line of [...removed, ...added]) {
    assert.ok(
      line === '' || line === ']' || line.startsWith('//') || line.startsWith('const ownedByCurrentWork')
      || line.startsWith("'content/federation/") || line.startsWith('ownedByCurrentWork'),
      `the diff touches something other than the allowlist: ${line}`,
    )
  }
  // Every entry the guard protected before must still be listed.
  const previouslyListed = removed.filter((l) => l.includes('content/federation/'))
    .flatMap((l) => l.match(/'[^']+'/g) ?? [])
  for (const entry of previouslyListed) {
    assert.ok(added.some((l) => l.includes(entry)), `${entry} was dropped from the allowlist`)
  }
})

test('the ledger, candidate map and graph v2 are never written', () => {
  const forbidden = ['federation-unified-readiness-ledger-v7.json', 'federation-route-candidates-v5.json',
    'federation-dependency-graph-v2.json']
  const generators = ['scripts/generate-dependency-cascade-contract.ts', 'scripts/generate-dependency-graph-v3.ts']
    .map((f) => readFileSync(f, 'utf8'))
  for (const name of forbidden) {
    for (const src of generators) {
      assert.ok(!new RegExp(`write\\(\\s*'${name.replace(/[.]/g, '\\.')}'`).test(src),
        `a generator writes ${name}`)
    }
  }
})
