/**
 * Repairs the 19 dangling edges the v5 replacement pass left in dependency
 * graph v2.
 *
 * v5 removed four candidates and nothing updated the graph, so 19 edges name
 * ids that no longer exist. An edge to a node the verifier cannot see is worse
 * than a failing edge: it is skipped by every check rather than reported by one.
 *
 * The repair is not a rebind to the declared replacements. v5 records a
 * four-for-four mapping, but each successor is a different concept and none is
 * a definition:
 *
 *   editorial-review/definition        -> internal-review/exact-revision-binding
 *   machine-readable-article/definition -> correction-and-retraction/withdrawal-propagation
 *
 * Seven routes depend on a definition of machine-readable-article. Pointing
 * them at a withdrawal-propagation route would make them depend on a concept
 * that does not define what they need, which is the same defect as the dangle
 * with better cosmetics. Both concepts now hold seven routes and zero
 * definitions in v5: the canonical definition is simply gone.
 *
 * So each case is repaired as what it actually is:
 *
 * - 14 edges depend on a removed definition. Their targets become
 *   missing-owner definition nodes, exactly how the graph already models the 32
 *   other concepts whose owner definition is absent from the route map. The
 *   dependency survives and becomes honestly unsatisfied.
 * - 5 edges originate from a removed candidate. Their subject no longer exists,
 *   so there is no dependency left to express. They are dropped, each recorded.
 *
 * v2 is not modified. This emits v3 and a repair record naming all 19.
 *
 * Expect the evidence-inheritance count to rise. Dependents that were exempt
 * because their target was invisible now depend on a node that satisfies
 * nothing. The defect was always there; the repair makes it countable.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { digestOf } from '../lib/federation/dependency-cascade-contract.ts'

const OUT = 'content/federation'
const FROZEN_ON = '2026-09-07'
const read = (f: string) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8'))
const write = (name: string, body: Record<string, unknown>) =>
  writeFileSync(`${OUT}/${name}`, `${JSON.stringify({ ...body, provenanceDigest: digestOf(body) }, null, 2)}\n`)

const v2 = read('federation-dependency-graph-v2.json')
const v5 = read('federation-route-candidates-v5.json')
const v4 = read('federation-route-candidates-v4.json')

type Edge = { from: string; dependsOn: string; reason: string }
type Removed = { candidateId: string; path: string; conceptId: string; siteId: string; routeRole: string; topic: string }

const v5ById = new Map<string, Record<string, unknown>>(
  (v5.candidates as Record<string, unknown>[]).map((c) => [c.candidateId as string, c]))
const known = new Set<string>([
  ...v5ById.keys(),
  ...(v2.observedAnchorNodes as { nodeId: string }[]).map((n) => n.nodeId),
  ...(v2.observedTopicNodes as { nodeId: string }[]).map((n) => n.nodeId),
  ...(v2.missingOwnerTopicNodes as { nodeId: string }[]).map((n) => n.nodeId),
])

const removed = new Map<string, Removed>(
  (v4.candidates as Record<string, unknown>[])
    .filter((c) => !v5ById.has(c.candidateId as string))
    .map((c) => [c.candidateId as string, {
      candidateId: c.candidateId as string, path: c.path as string, conceptId: c.conceptId as string,
      siteId: c.siteId as string, routeRole: c.routeRole as string, topic: c.topic as string,
    }]))

/**
 * Deterministic id for a missing-owner definition node, matching the v2 shape.
 *
 * Keyed on conceptId. An earlier version keyed on siteId and topic, and `topic`
 * is undefined on both removed definitions — so both hashed to the same id and
 * all 14 edges collapsed onto one node, silently absorbing editorial-review's
 * seven dependencies into machine-readable-article's. conceptId is unique and
 * always present; the count guard below makes a recurrence fail loudly.
 */
const missingNodeId = (conceptId: string) =>
  `missing_${createHash('sha256').update(`${conceptId}|definition`, 'utf8').digest('hex').slice(0, 24)}`

/** Human-readable topic for a concept, since the removed rows carry none. */
const topicOf = (conceptId: string) => conceptId.split(':').pop() ?? conceptId

type RepairRow = {
  action: 'rebound-to-missing-owner-definition' | 'dropped-orphaned-source'
  from: string; dependsOn: string; reason: string
  removedCandidate: string
  newTarget?: string
  detail: string
}

const repairs: RepairRow[] = []
const newMissingNodes = new Map<string, { nodeId: string; siteId: string; topic: string; state: string; conceptId: string; absentSince: string }>()
const repairedEdges: Edge[] = []

for (const edge of v2.edges as Edge[]) {
  const sourceGone = !known.has(edge.from)
  const targetGone = !known.has(edge.dependsOn)

  if (sourceGone) {
    const r = removed.get(edge.from)
    repairs.push({
      action: 'dropped-orphaned-source', from: edge.from, dependsOn: edge.dependsOn, reason: edge.reason,
      removedCandidate: r?.path ?? edge.from,
      detail:
        `The route this edge belongs to (${r?.path ?? edge.from}) was removed in v5, so there is no dependent left ` +
        'to express a dependency. The edge is dropped rather than repointed: a dependency with no subject is not a ' +
        'dependency.',
    })
    continue
  }

  if (targetGone) {
    const r = removed.get(edge.dependsOn)
    if (!r) throw new Error(`${edge.dependsOn} is unknown and not among the removed candidates; repair would be a guess.`)
    if (r.routeRole !== 'definition') {
      throw new Error(`${r.path} is a ${r.routeRole}, not a definition; the missing-owner repair does not apply.`)
    }
    const nodeId = missingNodeId(r.conceptId)
    newMissingNodes.set(nodeId, {
      nodeId, siteId: r.siteId, topic: topicOf(r.conceptId), conceptId: r.conceptId,
      state: 'missing-owner-topic-definition', absentSince: 'federation-route-candidates-v5.json',
    })
    repairs.push({
      action: 'rebound-to-missing-owner-definition', from: edge.from, dependsOn: edge.dependsOn, reason: edge.reason,
      removedCandidate: r.path, newTarget: nodeId,
      detail:
        `${r.path} was the canonical definition for ${r.conceptId} and was removed in v5. No definition for that ` +
        'concept remains in the route map. The dependency is preserved against a missing-owner definition node, ' +
        'which is what the graph already uses for a concept whose owner definition is absent. It is not repointed ' +
        `at the declared v5 replacement, which is a different concept and not a definition.`,
    })
    repairedEdges.push({ from: edge.from, dependsOn: nodeId, reason: edge.reason })
    continue
  }

  repairedEdges.push(edge)
}

const stable = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// One missing-owner node per distinct removed definition. If two concepts ever
// hash to one id again, this fails rather than merging their dependencies.
const removedDefinitions = [...removed.values()].filter((r) => r.routeRole === 'definition')
const reboundConcepts = new Set(repairs
  .filter((r) => r.action === 'rebound-to-missing-owner-definition')
  .map((r) => removed.get(r.dependsOn)!.conceptId))
if (newMissingNodes.size !== reboundConcepts.size) {
  throw new Error(
    `${reboundConcepts.size} distinct concepts produced ${newMissingNodes.size} nodes; ids collided and ` +
    'dependencies would be merged.')
}
if (removedDefinitions.length !== reboundConcepts.size) {
  throw new Error(
    `${removedDefinitions.length} definitions were removed but only ${reboundConcepts.size} were rebound.`)
}
const missingNodes = [...v2.missingOwnerTopicNodes, ...[...newMissingNodes.values()]]
  .sort((a, b) => stable(a.nodeId, b.nodeId))

write('federation-dependency-graph-v3.json', {
  schemaVersion: 'maha-federation-dependency-graph/3.0',
  frozenOn: FROZEN_ON,
  previousDependencyGraphDigest: v2.provenanceDigest,
  candidateMapDigest: v5.provenanceDigest,
  semanticAdjudicationDigest: v2.semanticAdjudicationDigest,
  repairPurpose:
    'Rebinds dependency graph v2 to candidate map v5. v2 was built against an earlier map and carried 19 edges ' +
    'naming four candidates v5 removed. No dependency is invented and none is silently deleted: 14 are preserved ' +
    'against missing-owner definition nodes, and 5 whose dependent no longer exists are dropped and recorded.',
  appendOnly: true,
  rules: [
    'Dependency graph v2 is not modified and remains the record of what was computed against the earlier map.',
    'A dependency on a removed definition is preserved as a missing-owner definition, never repointed at an ' +
      'unrelated successor.',
    'An edge whose dependent was removed is dropped, because a dependency with no subject is not a dependency.',
    'No candidate decision, ledger or readiness state is changed.',
  ],
  relationshipVocabulary: v2.relationshipVocabulary,
  anchors: v2.anchors,
  counts: {
    nodes: (v2.nodes as unknown[]).length + (v2.observedAnchorNodes as unknown[]).length
      + (v2.observedTopicNodes as unknown[]).length + missingNodes.length,
    candidateNodes: (v2.nodes as unknown[]).length,
    observedAnchorNodes: (v2.observedAnchorNodes as unknown[]).length,
    observedTopicNodes: (v2.observedTopicNodes as unknown[]).length,
    missingOwnerTopicNodes: missingNodes.length,
    missingOwnerTopicNodesAddedByRepair: newMissingNodes.size,
    edges: repairedEdges.length,
    edgesRepaired: repairs.filter((r) => r.action === 'rebound-to-missing-owner-definition').length,
    edgesDropped: repairs.filter((r) => r.action === 'dropped-orphaned-source').length,
    danglingEdgesRemaining: 0,
  },
  nodes: v2.nodes,
  observedAnchorNodes: v2.observedAnchorNodes,
  observedTopicNodes: v2.observedTopicNodes,
  missingOwnerTopicNodes: missingNodes,
  edges: repairedEdges,
  supersedes: 'federation-dependency-graph-v2.json',
})

write('federation-dependency-graph-repair-v1.json', {
  schemaVersion: 'maha-federation-dependency-graph-repair/1.0',
  frozenOn: FROZEN_ON,
  defect:
    'The v5 replacement pass removed four candidates without updating dependency graph v2, leaving 19 edges that ' +
    'name ids no longer in the map. An edge to an invisible node is exempt from every verifier check rather than ' +
    'reported by one, so the dangle concealed the dependencies it broke.',
  removedCandidates: [...removed.values()].sort((a, b) => stable(a.candidateId, b.candidateId)),
  declaredReplacementsNotUsed: {
    finding:
      'v5 declares a four-for-four replacement, but each successor is a different concept and none is a ' +
      'definition. machine-readable-article and editorial-review each now hold seven routes and zero definitions.',
    consequence:
      'Fourteen routes depend on a definition that no longer exists anywhere in the route map. Repointing them at ' +
      'a successor that defines something else would hide that, so the dependency is preserved as unsatisfied.',
  },
  counts: {
    danglingEdges: repairs.length,
    reboundToMissingOwnerDefinition: repairs.filter((r) => r.action === 'rebound-to-missing-owner-definition').length,
    droppedOrphanedSource: repairs.filter((r) => r.action === 'dropped-orphaned-source').length,
    missingOwnerDefinitionNodesAdded: newMissingNodes.size,
  },
  missingOwnerDefinitionNodesAdded: [...newMissingNodes.values()].sort((a, b) => stable(a.nodeId, b.nodeId)),
  repairs: repairs.sort((a, b) => stable(a.from, b.from) || stable(a.dependsOn, b.dependsOn)),
  boundary:
    'A graph repair. It creates no route, resolves no dependency and changes no readiness state. Fourteen ' +
    'dependencies that were invisible are now visible and unsatisfied, which is expected to raise the ' +
    'evidence-inheritance count rather than lower it.',
})

console.log(
  `repaired ${repairs.length} dangling edges: ` +
  `${repairs.filter((r) => r.action === 'rebound-to-missing-owner-definition').length} rebound, ` +
  `${repairs.filter((r) => r.action === 'dropped-orphaned-source').length} dropped | ` +
  `+${newMissingNodes.size} missing-owner nodes | edges ${(v2.edges as unknown[]).length} -> ${repairedEdges.length}`)
