import { readFileSync, writeFileSync } from 'node:fs'
import { AUTHORITY_DECISIONS, AUTHORITY_SOURCES } from '../lib/federation/external-authority-recovery.ts'
import { FIRST_PARTY_DEFINITIONS } from '../lib/federation/first-party-definitions.ts'
import { HELD_CONCEPTS, LOCAL_APPLICATION_SOURCES, digest, type Tranche19State } from '../lib/federation/readiness-tranche-19.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })

type Candidate = { candidateId: string; candidateDigest?: string; conceptId: string; siteId: string; canonicalHost: string; routeRole: string; path: string; url: string; title: string; rank: number; scores: Record<string, number>; typedRelationships: unknown[] }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v1.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const graph = read('federation-definition-graph-objects-v1.json') as { provenanceDigest: string; graphObjects: { graphObjectId: string; conceptId: string; evidenceGroup: string; disposition: string }[] }
const tranche18Sources = read('federation-tranche-18-source-inspections-v1.json') as { provenanceDigest: string; inspections: Record<string, unknown>[] }

const candidateById = new Map(map.candidates.map((candidate) => [candidate.candidateId, candidate]))
const ledgerById = new Map(ledger.entries.map((candidate) => [candidate.candidateId, candidate]))
const unresolvedPriorities = priority.priorities.filter((row) => ledgerById.get(row.candidateId)?.implementationState === 'unresolved')
const selected = unresolvedPriorities.slice(0, 100).map((row, index) => {
  const candidate = candidateById.get(row.candidateId)
  if (!candidate) throw new Error(`tranche-19-candidate-missing:${row.candidateId}`)
  return { selectionOrder: index + 1, priorityScore: row.priorityScore, candidate, candidateDigest: digest(candidate) }
})
if (selected.length !== 100 || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('tranche-19-cohort-invalid')

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/19.0',
  frozenOn: '2026-09-07',
  sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest, sourceReadinessLedger: ledger.provenanceDigest },
  selectionRule: 'First 100 priority rows whose unified-readiness-v1 state is unresolved. Order is frozen before source inspection.',
  counts: { candidates: selected.length, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size },
  candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })),
  execution: { routeGenerated: false, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-19-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const externalByConcept = new Map(AUTHORITY_DECISIONS.map((decision) => [decision.conceptId, decision.sourceIds.map((id) => AUTHORITY_SOURCES.find((source) => source.sourceId === id)!).filter(Boolean)]))
const firstPartyByConcept = new Map(FIRST_PARTY_DEFINITIONS.map((definition) => [definition.conceptId, definition]))
const tranche18ByTopic = new Map(tranche18Sources.inspections.map((inspection) => [`urn:maha:concept:${inspection.topic === 'error-budgets' ? 'computation' : 'evidence'}:${inspection.topic}`, inspection]))
const graphByConcept = new Map(graph.graphObjects.map((object) => [object.conceptId, object]))

const localSourceRows = Object.entries(LOCAL_APPLICATION_SOURCES).flatMap(([conceptId, sources]) => sources.map((source) => ({
  ...source,
  conceptId,
  sourceIdentity: source.locator.split(' — ')[0],
  version: 'exact repository implementation at reviewed commit',
  inspectionDepth: 'symbol-and-surrounding-implementation',
  rightsBasis: 'project-owned-reference-only',
  independence: 'not-independent',
})))

const carriedExternalRows = [...new Set(selected.map((row) => row.candidate.conceptId))].flatMap((conceptId) => {
  const authority = externalByConcept.get(conceptId)
  if (authority) return authority.map((source) => ({ ...source, conceptId, carriedFrom: 'federation-external-authority-source-inspections-v1', passageStored: false }))
  const prior = tranche18ByTopic.get(conceptId)
  return prior ? [{ ...prior, conceptId, carriedFrom: 'federation-tranche-18-source-inspections-v1', passageStored: false }] : []
})

const sourceBody = {
  schemaVersion: 'maha-federation-readiness-tranche-19-sources/1.0', frozenOn: '2026-09-07',
  method: 'Each local source was read at the named symbol and surrounding implementation. External sources are carried only from prior section-level inspection artifacts with their original scope and boundary. No source passage or full document is stored.',
  counts: { localInspections: localSourceRows.length, carriedExternalInspections: carriedExternalRows.length },
  localInspections: localSourceRows,
  carriedExternalInspections: carriedExternalRows,
  privacyBoundary: 'Reference metadata, exact locators, scope, and boundaries only. No customer data, credentials, source passages, or reviewer identities.',
}
writeFileSync(`${F}/federation-readiness-tranche-19-source-inspections-v1.json`, `${JSON.stringify(signed(sourceBody), null, 2)}\n`)

function inspectedBasis(conceptId: string, role: string) {
  const allLocal = LOCAL_APPLICATION_SOURCES[conceptId] ?? []
  const local = allLocal.filter((source) => source.roles.includes(role))
  if (local.length) return { kind: 'local-application', sources: local, roleSupported: true }
  if (allLocal.length) return { kind: 'local-adjacent-only', sources: allLocal, roleSupported: false }
  const external = externalByConcept.get(conceptId) ?? (tranche18ByTopic.has(conceptId) ? [tranche18ByTopic.get(conceptId)] : [])
  const definition = firstPartyByConcept.get(conceptId)
  if (external.length) return { kind: 'external-definition-only', sources: external, roleSupported: false }
  if (definition) return { kind: 'first-party-definition-only', sources: [{ locator: definition.groundedIn.locator, scope: definition.establishes, boundary: definition.doesNotEstablish }], roleSupported: false }
  return { kind: 'none', sources: [], roleSupported: false }
}

const decisions = selected.map((row) => {
  const candidate = row.candidate
  const basis = inspectedBasis(candidate.conceptId, candidate.routeRole)
  const held = HELD_CONCEPTS[candidate.conceptId]
  let state: Tranche19State
  let finding: string
  if (basis.roleSupported) {
    state = 'evidence-ready'
    finding = `The exact inspected implementation supports the ${candidate.routeRole} role with its limitations carried into the page contract.`
  } else if (held) {
    state = held.state
    finding = held.finding
  } else if (candidate.conceptId.startsWith('urn:maha:concept:computation:')) {
    state = 'revise'
    finding = `The canonical definition is available, but no exact Maha implementation or fixture was inspected for the ${candidate.routeRole} application role.`
  } else {
    state = 'revise'
    finding = `The concept or adjacent implementation was inspected, but it does not establish this candidate's ${candidate.routeRole} claim.`
  }
  const graphObject = graphByConcept.get(candidate.conceptId)
  return {
    selectionOrder: row.selectionOrder,
    candidateId: candidate.candidateId,
    candidateDigest: row.candidateDigest,
    conceptId: candidate.conceptId,
    routeRole: candidate.routeRole,
    path: candidate.path,
    priorState: ledgerById.get(candidate.candidateId)?.state,
    dependency: graphObject ? { graphObjectId: graphObject.graphObjectId, evidenceGroup: graphObject.evidenceGroup, disposition: graphObject.disposition } : null,
    sourceAssessment: { kind: basis.kind, roleSupported: basis.roleSupported, sourceLocators: basis.sources.map((item: Record<string, unknown>) => item.locator ?? item.stableUrl).filter(Boolean) },
    axes: {
      sourceIdentity: basis.sources.length ? 'inspected' : 'missing',
      locator: basis.sources.length ? 'exact-or-carried-exact' : 'missing',
      rights: basis.sources.length ? 'recorded' : 'missing',
      scope: basis.roleSupported ? 'supports-route-role' : 'does-not-support-route-role',
      boundary: basis.sources.length ? 'recorded' : 'missing',
    },
    decision: state,
    finding,
    noInheritance: 'A definition, adjacent workflow, or sibling decision cannot make this application evidence-ready. The route role is assessed independently.',
    activeBindingChanged: false,
  }
})

const counts = { candidates: decisions.length, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
const decisionBody = { schemaVersion: 'maha-federation-readiness-tranche-19-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }
writeFileSync(`${F}/federation-readiness-tranche-19-decisions-v1.json`, `${JSON.stringify(signed(decisionBody), null, 2)}\n`)

const readyIds = new Set(decisions.filter((row) => row.decision === 'evidence-ready').map((row) => row.candidateId))
const specifications = selected.filter((row) => readyIds.has(row.candidate.candidateId)).map((row) => {
  const decision = decisions.find((item) => item.candidateId === row.candidate.candidateId)!
  const bindings = (LOCAL_APPLICATION_SOURCES[row.candidate.conceptId] ?? []).filter((source) => source.roles.includes(row.candidate.routeRole))
  return {
    candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole,
    directAnswer: `${row.candidate.title} describes the bounded Maha behavior established by the cited implementation and carries the implementation's explicit non-claims.`,
    requiredSections: ['Direct answer', 'Inputs and prerequisites', 'Ordered behavior', 'Verification or refusal states', 'What this does not establish', 'Related definition and applications'],
    boundedQuestions: ['What exact behavior is implemented?', 'Which inputs and identities are required?', 'Which exact symbol bears the explanation?', 'Which refusal or verification boundary applies?', 'What external outcome does this implementation not establish?'],
    sourceBindings: bindings.map((source) => ({ sourceId: source.sourceId, locator: source.locator, scope: source.scope, boundary: source.boundary, rightsBasis: 'project-owned-reference-only' })),
    decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false,
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
const specsBody = { schemaVersion: 'maha-federation-readiness-tranche-19-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }
writeFileSync(`${F}/federation-readiness-tranche-19-page-specifications-v1.json`, `${JSON.stringify(signed(specsBody), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const ledgerEntries = ledger.entries.map((entry) => {
  const decision = decisionById.get(entry.candidateId)
  if (!decision) return entry
  return { ...entry, state: decision.decision, origin: 'readiness-tranche-19', specification: decision.decision === 'evidence-ready', implementationState: decision.decision === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false }
})
const ledgerCounts = { routeCandidates: ledgerEntries.length, implementationReady: ledgerEntries.filter((entry) => entry.implementationState === 'implementation-ready').length, unresolved: ledgerEntries.filter((entry) => entry.implementationState === 'unresolved').length, newlyReadyThisTranche: counts.evidenceReady }
const ledgerBody = { schemaVersion: 'maha-federation-unified-readiness-ledger/2.0', frozenOn: '2026-09-07', previousLedger: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { provenanceDigest: map.provenanceDigest }, counts: ledgerCounts, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries: ledgerEntries }
if (ledgerCounts.routeCandidates !== 1628 || ledgerCounts.implementationReady + ledgerCounts.unresolved !== 1628) throw new Error('tranche-19-ledger-partition')
writeFileSync(`${F}/federation-unified-readiness-ledger-v2.json`, `${JSON.stringify(signed(ledgerBody), null, 2)}\n`)

const report = `# Federation readiness Tranche 19 — local report\n\n## Frozen cohort\n\nThe first 100 unresolved candidates from the v1 priority ledger were frozen before inspection. They cover ${cohortBody.counts.distinctConcepts} concepts.\n\n## Decisions\n\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- New substantial-page specifications: ${specifications.length}\n\nDefinitions and adjacent implementations were not inherited as application evidence. Local implementation sources were inspected at exact symbols; external authority was carried only from prior inspected-source artifacts.\n\n## Unified readiness\n\n- Implementation-ready: ${ledgerCounts.implementationReady}\n- Unresolved: ${ledgerCounts.unresolved}\n- Route candidates: ${ledgerCounts.routeCandidates}\n\n## Boundary\n\nNo public route was generated. No build, sitemap, llms, release, deployment, or Production mutation occurred.\n`
writeFileSync('docs/operations/federation-readiness-tranche-19-v1.md', report)

console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, specifications: specifications.length, ledger: ledgerCounts }))
