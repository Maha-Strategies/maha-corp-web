/**
 * Dependency-cascade verifier.
 *
 * Prior work already computes the cascade. federation-dependency-graph-v2.json
 * holds 1,628 nodes and 3,122 edges with a topological order and no cycles;
 * federation-dependency-reconciliation-v2.json separates identity resolution
 * from evidence state across the 94 records that were missing a definition.
 * None of that is recomputed here. What was missing is a verifier: nothing in
 * the repository checks that the graph's own rules hold, and there is no test
 * covering dependencies at all.
 *
 * Four properties are checked.
 *
 * 1. Canonical-owner dependencies. A route that depends on a concept must
 *    depend on that concept's canonical owner, not on a sibling that happens to
 *    discuss it.
 * 2. Category separation. Definitions, applications, policies, implementations
 *    and commercial offers carry different burdens, and a dependency that
 *    crosses categories has to be legible as such.
 * 3. No evidence inheritance. A candidate may not be evidence-ready while a
 *    prerequisite it depends on is unresolved. Readiness is earned per route
 *    against that route's own sources; it never flows down an edge. This is the
 *    check that fails today.
 * 4. Projected unlocks. For each prerequisite that were accepted, which
 *    unresolved candidates would have every prerequisite satisfied. Those
 *    become assessable, never ready: the projection says what stops blocking
 *    them, not that anything about their own evidence changed.
 *
 * The verifier is order-independent — every output is sorted by a stable key,
 * and shuffling the inputs cannot change a digest — and digest-bound, so a
 * result names the exact graph and ledger it was computed from.
 */
import { createHash } from 'node:crypto'

export type RouteCategory = 'definition' | 'application' | 'policy' | 'implementation' | 'commercial-offer'

/**
 * Roles that carry a category other than application. Everything else is an
 * application: a route that applies a concept rather than defining, governing,
 * implementing or selling it. The default is stated rather than inferred, and
 * a test asserts every role in the map resolves through this table.
 */
const CATEGORY_BY_ROLE: Record<string, RouteCategory> = {
  definition: 'definition', identity: 'definition', 'source-identity': 'definition',
  'discovery-hub': 'definition', origin: 'definition', genealogy: 'definition',

  policy: 'policy', governance: 'policy', controls: 'policy', limits: 'policy',
  'current-law': 'policy', threats: 'policy', preparedness: 'policy',
  'source-and-rights-boundary': 'policy', 'comparison-boundary': 'policy',
  'reception-boundary': 'policy', 'colonial-reception-boundary': 'policy',

  implementation: 'implementation', architecture: 'implementation', protocol: 'implementation',
  fixture: 'implementation', 'machine-interface': 'implementation', 'machine-record': 'implementation',
  'machine-registry': 'implementation', 'machine-rule': 'implementation', 'input-contract': 'implementation',
  'source-contract': 'implementation', 'exact-revision-binding': 'implementation',
  'served-bundle-check': 'implementation', 'artifact-role-inventory': 'implementation',
  'withdrawal-propagation': 'implementation', template: 'implementation', calculation: 'implementation',
  reproducibility: 'implementation', verification: 'implementation', development: 'implementation',

  'commercial-use': 'commercial-offer', commercialization: 'commercial-offer',
}

export function categorize(routeRole: string): RouteCategory {
  return CATEGORY_BY_ROLE[routeRole] ?? 'application'
}

export type CandidateNode = {
  candidateId: string
  conceptId: string | null
  siteId: string
  routeRole: string
  /** The property that owns this route's concept, when the map declares one. */
  canonicalOwner: string | null
  /** The reviewed state, from the ledger. Never inferred here. */
  state: string
}

export type DependencyEdge = { from: string; dependsOn: string; reason: string }

export type Violation = {
  code: 'unknown-source-node' | 'unknown-target-node' | 'definition-off-canonical-owner'
    | 'dependency-on-non-owner-definition' | 'evidence-inherited-across-edge'
  from: string
  dependsOn: string
  detail: string
}

export type UnlockProjection = {
  prerequisiteId: string
  prerequisitePath: string | null
  /** Unresolved candidates whose every prerequisite would then be satisfied. */
  wouldBecomeAssessable: readonly string[]
  /** Unresolved candidates still held by some other prerequisite. */
  stillHeldByOtherPrerequisites: readonly string[]
  boundary: string
}

/**
 * States that satisfy a dependency.
 *
 * A live published route satisfies one as fully as a reviewed candidate does —
 * it is already serving. The graph carries 16 such observed nodes alongside the
 * 1,628 candidates. Loading only the candidates leaves 843 edges pointing at
 * nodes the verifier cannot see, which silently exempts them from every check.
 */
export const SATISFYING_STATES: readonly string[] = ['evidence-ready', 'live-published']

/**
 * A prerequisite whose concept exists as a canonical graph object.
 *
 * Tranche 19 moved 32 definitions out of the route budget and kept them as
 * canonical graph objects, on the stated ground that a dependent needs the
 * concept resolvable and a graph object resolves it. The dependency graph is
 * built from the candidate map alone and has never seen that artifact, so it
 * reports those concepts as missing owner definitions.
 *
 * They are not missing. Their identity is resolved and their evidence is not:
 * 29 of the 32 are blocked, 3 are evidence-ready. That is the same split
 * federation-dependency-reconciliation-v2.json already draws between
 * identityResolved and definitionEvidenceReady.
 *
 * This state satisfies the dependency's identity requirement and confers no
 * evidence. It never could: readiness is earned per route against that route's
 * own sources, so a dependent was never entitled to inherit anything here.
 */
export const IDENTITY_RESOLVED = 'identity-resolved-evidence-pending'

/** A prerequisite that exists nowhere — no route, no graph object. */
export const ABSENT_DEFINITION = 'absent-definition'

const satisfies = (state: string) => SATISFYING_STATES.includes(state) || state === IDENTITY_RESOLVED
const READY = 'evidence-ready'
const stable = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => stable(a, b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export const digestOf = (value: unknown) =>
  `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

/**
 * A concept's definition must sit on the property that owns the concept, and a
 * route depending on a definition must depend on that owner's.
 *
 * What this deliberately does not flag: an application hosted off its concept's
 * owner. 146 candidates are in exactly that position — maha-strategies hosting
 * a commercial-use or verification route for a concept maha-research owns — and
 * that is the intended federation shape, not a defect. An earlier version of
 * this rule flagged all 843 edges reaching those nodes. Ownership constrains
 * where a concept is *defined*, not where it may be applied.
 */
export function verifyCanonicalOwnerDependencies(
  nodes: readonly CandidateNode[], edges: readonly DependencyEdge[],
): Violation[] {
  const byId = new Map(nodes.map((n) => [n.candidateId, n]))
  const violations: Violation[] = []
  const offOwnerDefinition = (n: CandidateNode) =>
    categorize(n.routeRole) === 'definition' && n.canonicalOwner !== null && n.siteId !== n.canonicalOwner

  for (const node of nodes) {
    if (offOwnerDefinition(node)) {
      violations.push({
        code: 'definition-off-canonical-owner', from: node.candidateId, dependsOn: node.candidateId,
        detail: `${node.routeRole} for ${node.conceptId ?? 'a concept'} sits on ${node.siteId}, but the concept is owned by ${node.canonicalOwner}.`,
      })
    }
  }

  for (const edge of edges) {
    const from = byId.get(edge.from)
    const target = byId.get(edge.dependsOn)
    // Which side dangles matters. A dangling source is an orphaned edge; a
    // dangling target is a live route depending on something that no longer
    // exists, which is the more serious of the two.
    if (!from) {
      violations.push({
        code: 'unknown-source-node', from: edge.from, dependsOn: edge.dependsOn,
        detail: `An edge originates from ${edge.from}, which is not in the candidate map. The edge is orphaned.`,
      })
    }
    if (!target) {
      violations.push({
        code: 'unknown-target-node', from: edge.from, dependsOn: edge.dependsOn,
        detail: `${edge.from} depends on ${edge.dependsOn}, which is not in the candidate map. A route depends on something that no longer exists.`,
      })
    }
    if (!from || !target) continue
    if (offOwnerDefinition(target)) {
      violations.push({
        code: 'dependency-on-non-owner-definition', from: edge.from, dependsOn: edge.dependsOn,
        detail: `${edge.from} depends on a definition hosted on ${target.siteId}, but ${target.conceptId ?? 'that concept'} is owned by ${target.canonicalOwner}.`,
      })
    }
  }
  return violations.sort((a, b) => stable(a.from, b.from) || stable(a.dependsOn, b.dependsOn) || stable(a.code, b.code))
}

/**
 * Readiness is earned per route, against that route's own sources. A candidate
 * reported evidence-ready while a prerequisite is genuinely absent has been
 * built on something that does not exist.
 *
 * Two distinctions decide what counts, and both come from the repository rather
 * than from this module.
 *
 * Blocking versus ordering. The graph computes dependencyReadyNodes as
 * candidates with no edge to a missing-owner definition — so by its own rule,
 * only a missing owner definition blocks. Its other edges say "-first" and
 * "-precedes-": canonical-family-owner-definition-first orders publication, it
 * does not make one page's evidence depend on another's. A page can be
 * evidence-ready and not yet publishable; conflating the two reported 116
 * ordering constraints as evidence inheritance.
 *
 * Absent versus identity-resolved. A concept held as a canonical graph object
 * is resolvable even though it has no route, which is the whole basis of the
 * Tranche 19 Model A decision. Treating those as missing reported a further
 * 123.
 *
 * What remains is a dependent that is evidence-ready while the definition it
 * needs exists nowhere at all.
 */
export function verifyNoEvidenceInheritance(
  nodes: readonly CandidateNode[], edges: readonly DependencyEdge[],
): Violation[] {
  const byId = new Map(nodes.map((n) => [n.candidateId, n]))
  const violations: Violation[] = []

  for (const edge of edges) {
    const from = byId.get(edge.from)
    const target = byId.get(edge.dependsOn)
    if (!from || !target) continue
    if (from.state !== READY) continue
    if (target.state !== ABSENT_DEFINITION) continue

    violations.push({
      code: 'evidence-inherited-across-edge', from: edge.from, dependsOn: edge.dependsOn,
      detail: `${from.routeRole} is evidence-ready, but the definition it depends on exists in neither the route map nor the canonical graph objects.`,
    })
  }
  return violations.sort((a, b) => stable(a.from, b.from) || stable(a.dependsOn, b.dependsOn))
}

/** Edges that are not violations, reported so the difference stays visible. */
export function classifyNonBlockingEdges(
  nodes: readonly CandidateNode[], edges: readonly DependencyEdge[],
): { orderingConstraints: number; identityResolvedPrerequisites: number } {
  const byId = new Map(nodes.map((n) => [n.candidateId, n]))
  let orderingConstraints = 0
  let identityResolvedPrerequisites = 0

  for (const edge of edges) {
    const from = byId.get(edge.from)
    const target = byId.get(edge.dependsOn)
    if (!from || !target || from.state !== READY) continue
    if (target.state === IDENTITY_RESOLVED) identityResolvedPrerequisites += 1
    else if (target.state !== ABSENT_DEFINITION && !SATISFYING_STATES.includes(target.state)) orderingConstraints += 1
  }
  return { orderingConstraints, identityResolvedPrerequisites }
}

/**
 * What accepting a prerequisite would unblock — and nothing more. A candidate
 * whose prerequisites are all satisfied still has to be assessed against its
 * own sources before it is ready.
 */
export function projectUnlocks(
  nodes: readonly CandidateNode[], edges: readonly DependencyEdge[],
  accepted: readonly string[],
  pathOf: (candidateId: string) => string | null = () => null,
): UnlockProjection[] {
  const byId = new Map(nodes.map((n) => [n.candidateId, n]))
  const acceptedSet = new Set(accepted)
  const satisfied = (id: string) => acceptedSet.has(id) || satisfies(byId.get(id)?.state ?? '')

  const prerequisitesOf = new Map<string, string[]>()
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.dependsOn)) continue
    prerequisitesOf.set(edge.from, [...(prerequisitesOf.get(edge.from) ?? []), edge.dependsOn])
  }

  return [...acceptedSet].sort(stable).map((prerequisiteId) => {
    const dependents = edges
      .filter((e) => e.dependsOn === prerequisiteId)
      .map((e) => e.from)
      .filter((id) => byId.get(id) && !satisfies(byId.get(id)!.state))

    const assessable: string[] = []
    const held: string[] = []
    for (const id of new Set(dependents)) {
      const outstanding = (prerequisitesOf.get(id) ?? []).filter((p) => !satisfied(p))
      ;(outstanding.length === 0 ? assessable : held).push(id)
    }

    return {
      prerequisiteId,
      prerequisitePath: pathOf(prerequisiteId),
      wouldBecomeAssessable: assessable.sort(stable),
      stillHeldByOtherPrerequisites: held.sort(stable),
      boundary:
        'Assessable, not ready. Every prerequisite being satisfied removes the dependency hold; the candidate ' +
        'still needs its own sources inspected before any readiness claim.',
    }
  })
}

export type CascadeVerification = {
  inputs: { nodeCount: number; edgeCount: number; inputsDigest: string }
  categories: Record<RouteCategory, number>
  crossCategoryEdges: Record<string, number>
  violations: {
    canonicalOwner: readonly Violation[]
    evidenceInheritance: readonly Violation[]
  }
  counts: { canonicalOwnerViolations: number; evidenceInheritanceViolations: number }
  /** Edges that are deliberately not violations. */
  nonBlocking: { orderingConstraints: number; identityResolvedPrerequisites: number }
  clean: boolean
}

export function verifyCascade(
  nodes: readonly CandidateNode[], edges: readonly DependencyEdge[],
): CascadeVerification {
  const sortedNodes = [...nodes].sort((a, b) => stable(a.candidateId, b.candidateId))
  const sortedEdges = [...edges].sort((a, b) => stable(a.from, b.from) || stable(a.dependsOn, b.dependsOn))
  const byId = new Map(sortedNodes.map((n) => [n.candidateId, n]))

  const categories = { definition: 0, application: 0, policy: 0, implementation: 0, 'commercial-offer': 0 }
  for (const n of sortedNodes) categories[categorize(n.routeRole)] += 1

  const crossCategoryEdges: Record<string, number> = {}
  for (const e of sortedEdges) {
    const from = byId.get(e.from); const to = byId.get(e.dependsOn)
    if (!from || !to) continue
    const key = `${categorize(from.routeRole)} -> ${categorize(to.routeRole)}`
    crossCategoryEdges[key] = (crossCategoryEdges[key] ?? 0) + 1
  }

  const canonicalOwner = verifyCanonicalOwnerDependencies(sortedNodes, sortedEdges)
  const evidenceInheritance = verifyNoEvidenceInheritance(sortedNodes, sortedEdges)

  return {
    inputs: {
      nodeCount: sortedNodes.length,
      edgeCount: sortedEdges.length,
      inputsDigest: digestOf({ nodes: sortedNodes, edges: sortedEdges }),
    },
    categories,
    crossCategoryEdges: Object.fromEntries(Object.entries(crossCategoryEdges).sort(([a], [b]) => stable(a, b))),
    violations: { canonicalOwner, evidenceInheritance },
    nonBlocking: classifyNonBlockingEdges(sortedNodes, sortedEdges),
    counts: {
      canonicalOwnerViolations: canonicalOwner.length,
      evidenceInheritanceViolations: evidenceInheritance.length,
    },
    clean: canonicalOwner.length === 0 && evidenceInheritance.length === 0,
  }
}
