/**
 * Emits the dependency-cascade contract, prerequisite source inspections,
 * Publish contract findings and projected unlock report.
 *
 * Reads the candidate map, dependency graph and unified ledger. Writes only its
 * own four artifacts. It changes no candidate decision, no ledger, and nothing
 * owned by another track.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import {
  ABSENT_DEFINITION, IDENTITY_RESOLVED, digestOf, projectUnlocks, verifyCascade,
  type CandidateNode, type DependencyEdge,
} from '../lib/federation/dependency-cascade-contract.ts'
import { DEFINITION_SCOPE, HEALTH_DATA_CONSENT_SOURCES } from '../lib/federation/health-data-consent-sources.ts'
import { AUDIT_BOUNDARY, PUBLISH_CONCEPT_FINDINGS } from '../lib/federation/publish-contract-findings.ts'

const OUT = 'content/federation'
const FROZEN_ON = '2026-09-07'
const read = (f: string) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8'))
const write = (name: string, body: Record<string, unknown>) =>
  writeFileSync(`${OUT}/${name}`, `${JSON.stringify({ ...body, provenanceDigest: digestOf(body) }, null, 2)}\n`)

const map = read('federation-route-candidates-v5.json')
const graph = read('federation-dependency-graph-v3.json')
const ledger = read('federation-unified-readiness-ledger-v7.json')
const graphObjects = read('federation-definition-graph-objects-v1.json')

// A concept held as a canonical graph object is resolvable without a route,
// which is the basis of the Tranche 19 Model A decision. The dependency graph
// is built from the candidate map alone and reports those concepts as missing.
const resolvedConcepts = new Set<string>(
  (graphObjects.graphObjects as { conceptId: string }[]).map((o) => o.conceptId.split(':').pop() as string))

const state = new Map<string, string>(
  (ledger.entries as { candidateId: string; state: string }[]).map((e) => [e.candidateId, e.state]))
const pathOf = new Map<string, string>(
  (map.candidates as { candidateId: string; path: string }[]).map((c) => [c.candidateId, c.path]))

const nodes: CandidateNode[] = (map.candidates as Record<string, unknown>[]).map((c) => ({
  candidateId: c.candidateId as string,
  conceptId: (c.conceptId as string) ?? null,
  siteId: c.siteId as string,
  routeRole: c.routeRole as string,
  canonicalOwner: ((c.conceptAuthority as { canonicalOwner?: string } | undefined)?.canonicalOwner) ?? null,
  state: state.get(c.candidateId as string) ?? 'not-in-ledger',
}))
// The graph's node universe is wider than the candidate array. Sixteen observed
// nodes are live published routes, which satisfy a dependency; thirty-two
// missing-owner topic nodes are definitions that do not yet exist as routes and
// satisfy nothing. Omitting either leaves edges pointing at nodes the verifier
// cannot see, and an invisible node is exempt from every check rather than
// failing one.
for (const observed of [...graph.observedAnchorNodes, ...graph.observedTopicNodes] as
  { nodeId: string; url?: string }[]) {
  nodes.push({
    candidateId: observed.nodeId, conceptId: null, siteId: 'observed', routeRole: 'definition',
    canonicalOwner: null, state: 'live-published',
  })
  if (observed.url) pathOf.set(observed.nodeId, observed.url)
}
for (const missing of graph.missingOwnerTopicNodes as
  { nodeId: string; siteId: string; topic: string; conceptId?: string }[]) {
  const slug = missing.topic ?? missing.conceptId?.split(':').pop() ?? ''
  const resolved = resolvedConcepts.has(slug)
  nodes.push({
    candidateId: missing.nodeId, conceptId: missing.conceptId ?? null, siteId: missing.siteId,
    routeRole: 'definition', canonicalOwner: missing.siteId,
    state: resolved ? IDENTITY_RESOLVED : ABSENT_DEFINITION,
  })
  pathOf.set(missing.nodeId, resolved
    ? `${missing.siteId}:${slug} (canonical graph object, no route)`
    : `${missing.siteId}:${slug} (definition exists in neither the route map nor the graph objects)`)
}

const edges: DependencyEdge[] = (graph.edges as DependencyEdge[]).map((e) => ({
  from: e.from, dependsOn: e.dependsOn, reason: e.reason,
}))

/* -- the contract ---------------------------------------------------------- */

const verification = verifyCascade(nodes, edges)

write('federation-dependency-cascade-contract-v1.json', {
  schemaVersion: 'maha-federation-dependency-cascade-contract/1.0',
  frozenOn: FROZEN_ON,
  purpose:
    'Verifies the properties the dependency graph is supposed to hold. The graph and the reconciliation already ' +
    'compute the cascade; nothing here recomputes them. What was missing was any check that their rules hold, and ' +
    'any test covering dependencies at all. Computed against dependency graph v3, in which the 19 edges v5 left ' +
    'dangling are repaired: 14 preserved against missing-owner definitions and 5 dropped with their removed ' +
    'dependent. The inheritance count is higher than against v2 because those 14 are now visible to the check ' +
    'rather than skipped as unknown nodes.',
  boundExactlyTo: {
    candidateMap: map.provenanceDigest,
    dependencyGraph: graph.provenanceDigest,
    unifiedReadinessLedger: ledger.provenanceDigest,
    definitionGraphObjects: graphObjects.provenanceDigest,
  },
  properties: [
    'A dependency points at the canonical owner of the concept it needs.',
    'Definitions, applications, policies, implementations and commercial offers are distinguished, and edges ' +
      'crossing categories are counted.',
    'No candidate is evidence-ready while a prerequisite it depends on is unresolved.',
    'Results are order-independent and bound to input digests.',
  ],
  verification,
  finding:
    verification.counts.evidenceInheritanceViolations > 0
      ? `${verification.counts.evidenceInheritanceViolations} edges carry evidence inheritance: a candidate is ` +
        'evidence-ready while the definition it depends on exists in neither the route map nor the canonical ' +
        'graph objects. An earlier version of this check reported 251 by counting two things that are not ' +
        `violations: ${verification.nonBlocking.orderingConstraints} publication-ordering edges, which the graph ` +
        'itself excludes from dependencyReadyNodes, and ' +
        `${verification.nonBlocking.identityResolvedPrerequisites} prerequisites resolved by a canonical graph ` +
        'object, which is exactly what the Tranche 19 Model A decision intended. Those are reported under ' +
        'nonBlocking and confer no evidence.'
      : 'No evidence inheritance detected.',
  boundary:
    'A verifier. It changes no decision, resolves nothing, and does not itself make any candidate ready or ' +
    'unready. It reports what the graph and ledger already say about each other.',
})

/* -- prerequisite source inspections --------------------------------------- */

const HEALTH_DATA_CONSENT = 'urn:maha:concept:consent:health-data-consent'
const hdcDefinition = (map.candidates as Record<string, unknown>[])
  .find((c) => c.conceptId === HEALTH_DATA_CONSENT && c.routeRole === 'definition')!
const hdcId = hdcDefinition.candidateId as string
const hdcDependents = [...new Set(edges.filter((e) => e.dependsOn === hdcId).map((e) => e.from))]
const mahaOsCandidates = nodes.filter((n) => n.siteId === 'maha-os')
const mahaOsHeld = mahaOsCandidates.filter((n) => n.state !== 'evidence-ready')

write('federation-prerequisite-source-inspections-v1.json', {
  schemaVersion: 'maha-federation-prerequisite-source-inspections/1.0',
  frozenOn: FROZEN_ON,
  prerequisite: {
    conceptId: HEALTH_DATA_CONSENT,
    candidateId: hdcId,
    path: hdcDefinition.path,
    stateAtInspection: state.get(hdcId),
  },
  purpose:
    'Inspect authoritative sources so the health-data-consent definition can distinguish seven instruments that ' +
    'ordinary usage runs together, each against a source that says so at a locator a reader can follow.',
  distinctionsCovered: [
    'consent', 'authorization', 'privacy-notice', 'lawful-basis', 'revocation', 'emergency-use', 'research-consent',
  ],
  counts: {
    sourcesInspected: HEALTH_DATA_CONSENT_SOURCES.length,
    findings: HEALTH_DATA_CONSENT_SOURCES.reduce((t, s) => t + s.findings.length, 0),
    jurisdictions: [...new Set(HEALTH_DATA_CONSENT_SOURCES.map((s) => s.jurisdiction))].sort().length,
  },
  sources: HEALTH_DATA_CONSENT_SOURCES,
  definitionScope: DEFINITION_SCOPE,
  clearanceQuestion: {
    asked: 'Does this definition clear the 11 held Maha OS applications?',
    answer:
      `It does not, because there are none. maha-os holds ${mahaOsCandidates.length} route candidates, of which ` +
      `${mahaOsHeld.length} is not evidence-ready — the health-data-consent definition itself. All ` +
      `${hdcDependents.length} candidates that depend on it are already evidence-ready. There are no held ` +
      'applications waiting on this prerequisite.',
    whatResolvingItActuallyDoes:
      `It clears ${hdcDependents.length} evidence-inheritance violations. Those dependents were marked ready while ` +
      'their prerequisite was unresolved, which is the defect — not a queue of blocked work. Accepting the ' +
      'definition removes the contradiction; it unblocks nothing, because nothing was blocked.',
    mahaOsHeldCandidates: mahaOsHeld.map((n) => ({ candidateId: n.candidateId, path: pathOf.get(n.candidateId), state: n.state })),
  },
  boundary:
    'Inspections, not a definition. They record what each instrument states and what it does not license. Writing ' +
    'the definition, and reviewing it, remain to be done, and neither is performed here.',
})

/* -- publish contract findings --------------------------------------------- */

write('federation-publish-contract-findings-v1.json', {
  schemaVersion: 'maha-federation-publish-contract-findings/1.0',
  frozenOn: FROZEN_ON,
  auditBoundary: AUDIT_BOUNDARY,
  counts: {
    conceptsAudited: PUBLISH_CONCEPT_FINDINGS.length,
    exactImplementations: PUBLISH_CONCEPT_FINDINGS.filter((f) => f.implementationStatus === 'exact-implementation').length,
    adjacentPatternOnly: PUBLISH_CONCEPT_FINDINGS.filter((f) => f.implementationStatus === 'adjacent-pattern-only').length,
    noneFound: PUBLISH_CONCEPT_FINDINGS.filter((f) => f.implementationStatus === 'none-found').length,
    fixturesCreated: PUBLISH_CONCEPT_FINDINGS.filter((f) => f.fixturesCreated).length,
    rolesUnchanged: PUBLISH_CONCEPT_FINDINGS.filter((f) => f.role !== 'evidence-ready').length,
  },
  findings: PUBLISH_CONCEPT_FINDINGS,
  routeCandidateStates: PUBLISH_CONCEPT_FINDINGS.map((f) => ({
    conceptId: f.conceptId,
    candidates: nodes.filter((n) => n.conceptId === f.conceptId)
      .map((n) => ({ path: pathOf.get(n.candidateId), routeRole: n.routeRole, state: n.state }))
      .sort((a, b) => (a.path ?? '') < (b.path ?? '') ? -1 : 1),
  })),
})

/* -- projected unlocks ------------------------------------------------------ */

// Seeded from every unresolved prerequisite that something actually depends on,
// derived from the graph and the ledger. An earlier version seeded from the
// inheritance violations, so correcting the violation rule silently changed the
// projection's meaning and left the report stale against its own numbers. No
// count here is written down anywhere; all of them fall out of the artifacts.
const inboundCount = new Map<string, number>()
for (const e of edges) inboundCount.set(e.dependsOn, (inboundCount.get(e.dependsOn) ?? 0) + 1)
const heldPrerequisites = nodes
  .filter((n) => (inboundCount.get(n.candidateId) ?? 0) > 0)
  .filter((n) => !['evidence-ready', 'live-published'].includes(n.state))
  .map((n) => n.candidateId)
  .sort()
const projections = projectUnlocks(nodes, edges, heldPrerequisites, (id) => pathOf.get(id) ?? null)

write('federation-projected-unlock-report-v1.json', {
  schemaVersion: 'maha-federation-projected-unlock-report/1.0',
  frozenOn: FROZEN_ON,
  boundExactlyTo: { dependencyGraph: graph.provenanceDigest, unifiedReadinessLedger: ledger.provenanceDigest },
  question: 'If each unresolved prerequisite were accepted, which unresolved candidates would stop being held?',
  derivation:
    'The prerequisite cohort is every node with at least one incoming edge whose state is neither evidence-ready ' +
    'nor live-published, computed from the graph and the ledger at generation time. No figure in this artifact is ' +
    'written into the generator, so a changed graph or ledger changes the report rather than dating it.',
  counts: {
    unresolvedPrerequisitesWithDependents: heldPrerequisites.length,
    totalWouldBecomeAssessable: projections.reduce((t, p) => t + p.wouldBecomeAssessable.length, 0),
    totalStillHeld: projections.reduce((t, p) => t + p.stillHeldByOtherPrerequisites.length, 0),
    // Reported beside the projection so the two are never read as one number.
    evidenceReadyInLedger: nodes.filter((n) => n.state === 'evidence-ready').length,
  },
  assessableIsNotReady:
    'Assessable and evidence-ready are different measures and are reported separately. A candidate becomes ' +
    'assessable when nothing blocks it from being reviewed; it becomes evidence-ready only when its own sources ' +
    'have been inspected and a decision recorded. No sum of these two numbers is meaningful.',
  projections: projections.map((p) => ({
    ...p,
    wouldBecomeAssessable: p.wouldBecomeAssessable.map((id) => pathOf.get(id) ?? id),
    stillHeldByOtherPrerequisites: p.stillHeldByOtherPrerequisites.map((id) => pathOf.get(id) ?? id),
  })),
  boundary:
    'Nothing here is a readiness claim. A candidate that would become assessable still needs its own sources ' +
    'inspected and its own review recorded. These counts must never be added to an evidence-ready total.',
})

console.log(
  `cascade: ${verification.counts.evidenceInheritanceViolations} inheritance, ` +
  `${verification.counts.canonicalOwnerViolations} canonical-owner | ` +
  `hdc dependents ${hdcDependents.length}, maha-os held ${mahaOsHeld.length} | ` +
  `sources ${HEALTH_DATA_CONSENT_SOURCES.length} | publish exact ${PUBLISH_CONCEPT_FINDINGS.filter((f) => f.implementationStatus === 'exact-implementation').length}/3`)
