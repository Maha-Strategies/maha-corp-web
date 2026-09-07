import { readFileSync, writeFileSync } from 'node:fs'
import { GAP_CLOSURE_SOURCES, POLICY_SOURCES, PRODUCT_CONTRACT_FINDING, digest, type Tranche20Source, type Tranche20State } from '../lib/federation/readiness-tranche-20.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; rank: number; scores: Record<string, number> }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v2.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t19 = read('federation-readiness-tranche-19-decisions-v1.json') as { provenanceDigest: string; decisions: { selectionOrder: number; candidateId: string; candidateDigest: string; conceptId: string; routeRole: string; path: string; decision: string }[] }
const graph = read('federation-definition-graph-objects-v1.json') as { provenanceDigest: string; graphObjects: { graphObjectId: string; conceptId: string; evidenceGroup: string; disposition: string; reason: string }[] }

const candidateById = new Map(map.candidates.map((row) => [row.candidateId, row]))
const ledgerById = new Map(ledger.entries.map((row) => [row.candidateId, row]))
const t19Ids = new Set(t19.decisions.map((row) => row.candidateId))
const priorRevisions = t19.decisions.filter((row) => row.decision === 'revise').map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'tranche-19-revision-requirement' }))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const nextUnreviewed = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !t19Ids.has(row.candidateId)).slice(0, 51).map((row) => ({ ...row, selectionBasis: 'next-unreviewed-unresolved-priority' }))
const selected = [...priorRevisions, ...nextUnreviewed].map((selection, index) => {
  const candidate = candidateById.get(selection.candidateId)
  if (!candidate) throw new Error(`tranche-20-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (priorRevisions.length !== 49 || nextUnreviewed.length !== 51 || selected.length !== 100 || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('tranche-20-cohort-invalid')

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/20.0', frozenOn: '2026-09-07',
  sourceLedger: { provenanceDigest: ledger.provenanceDigest }, sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest }, sourceTranche19: { provenanceDigest: t19.provenanceDigest },
  selectionRule: 'All 49 Tranche 19 revise decisions in their prior review order, followed by the first 51 unresolved priority rows absent from every Tranche 19 decision. Frozen before gap-closure assessment.',
  counts: { candidates: 100, priorRevisionRequirements: priorRevisions.length, newUnreviewed: nextUnreviewed.length, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size },
  candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })),
  execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-20-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const sourceRecoveryGraph = graph.graphObjects.find((row) => row.conceptId === 'urn:maha:concept:evidence:source-recovery')
if (!sourceRecoveryGraph) throw new Error('source-recovery-graph-object-missing')
const graphRevision = {
  schemaVersion: 'maha-federation-definition-revision/1.0', revisionId: 't20-source-recovery-definition', graphObjectId: sourceRecoveryGraph.graphObjectId,
  conceptId: sourceRecoveryGraph.conceptId, priorDisposition: sourceRecoveryGraph.disposition, proposedDisposition: 'non-route-graph-object', proposedEvidenceGroup: 'first-party',
  exactImplementationLocators: GAP_CLOSURE_SOURCES['urn:maha:concept:evidence:source-recovery'].map((row) => row.locator),
  reviewDecision: 'accept-for-local-readiness', canonicalBindingChanged: false,
  boundary: 'This revision establishes the implemented Maha recovery protocol only. It does not establish successful recovery, source inspection, substitution, or external consensus.',
}

const fixtureBody = {
  schemaVersion: 'maha-federation-gap-closure-fixtures/1.0', frozenOn: '2026-09-07', syntheticOnly: true,
  definitionRevision: graphRevision,
  fixtures: [
    { fixtureId: 'interval-add-i64', conceptId: 'urn:maha:concept:computation:interval-bounds', operation: 'interval-add', input: { left: ['10', '14'], right: ['3', '5'], unit: 'nm' }, expected: { interval: '[13,19]', unit: 'nm' }, refusals: ['mixed-unit', 'lower-above-upper', 'noncanonical-integer', 'i64-overflow'], claimsIndependentReproduction: false },
    { fixtureId: 'newton-fixed-iteration', conceptId: 'urn:maha:concept:computation:root-finding', operation: 'newtonRoot', input: { function: 'x^2-2', derivative: '2x', x0: 1, iterations: 5 }, expected: { precisionDigits: 12, methodLocator: 'DLMF 3.8.4', receiptRecomputable: true }, refusals: ['zero-derivative', 'missing-units', 'missing-assumptions', 'missing-uncertainty-treatment'], claimsGeneralConvergence: false },
    { fixtureId: 'canonical-sha256-commitment', conceptId: 'urn:maha:concept:computation:cryptographic-commitments', operation: 'provenanceDigest', input: { z: 2, a: 1 }, expected: { keyOrderIndependent: true, nonEmptyRequired: true }, refusals: ['empty-payload', 'unsupported-value'], claimsSignatureOrTruth: false },
    { fixtureId: 'public-workflow-registry', conceptId: 'urn:maha:concept:computation:reproducibility-fixtures', operation: 'EVIDENCE_WORKFLOW_REGISTRY_DIGEST', input: { syntheticOnly: true }, expected: { digestBound: true, purchaseEnabled: false, deployed: false }, refusals: ['digest-mismatch', 'non-synthetic-input'], claimsIndependentReproduction: false },
    { fixtureId: 'source-recovery-state-machine', conceptId: 'urn:maha:concept:evidence:source-recovery', operation: 'compileRecoveryPackets', input: { contentInspected: false, exactLocator: null }, expected: { identityAndVersionStatesDistinct: true, canonicalMutationAuthorized: false }, refusals: ['inspection-claimed-by-recovery', 'unknown-state', 'identity-verdict-disagrees'], claimsRecoveredSourceCanonical: false },
  ],
  boundary: 'Fixtures close only the named local application role. They contain synthetic inputs and cannot confer readiness on sibling roles.',
}
writeFileSync(`${F}/federation-readiness-tranche-20-gap-closure-fixtures-v1.json`, `${JSON.stringify(signed(fixtureBody), null, 2)}\n`)

const allSources = [...Object.entries(GAP_CLOSURE_SOURCES), ...Object.entries(POLICY_SOURCES)].flatMap(([conceptId, rows]) => rows.map((row) => ({ ...row, conceptId, inspectionDepth: row.kind === 'local-implementation' ? 'symbol-and-surrounding-implementation' : 'section-level-public-authority', passageStored: false })))
const sourceBody = {
  schemaVersion: 'maha-federation-readiness-tranche-20-sources/1.0', inspectedOn: '2026-09-07',
  method: 'Local symbols were inspected in repository context. Official public authorities were inspected at the exact named sections. Metadata, locators, scope, and boundaries are retained; passages are not.',
  counts: { inspections: allSources.length, localImplementation: allSources.filter((row) => row.kind === 'local-implementation').length, officialAuthority: allSources.filter((row) => row.kind === 'official-authority').length },
  inspections: allSources,
  privacyBoundary: 'No source passage, customer material, credential, reviewer identity, or private corpus content is stored.',
}
writeFileSync(`${F}/federation-readiness-tranche-20-source-inspections-v1.json`, `${JSON.stringify(signed(sourceBody), null, 2)}\n`)

const graphByConcept = new Map(graph.graphObjects.map((row) => [row.conceptId, row]))
const commercialRole = (role: string) => role === 'commercial-use' || role === 'commercialization'
function basis(conceptId: string, role: string): { sources: readonly Tranche20Source[]; supported: boolean; kind: string } {
  const rows = [...(GAP_CLOSURE_SOURCES[conceptId] ?? []), ...(POLICY_SOURCES[conceptId] ?? [])]
  const exact = rows.filter((row) => row.roles.includes(role))
  return { sources: exact.length ? exact : rows, supported: exact.length > 0, kind: exact[0]?.kind ?? (rows[0]?.kind ?? 'none') }
}

const decisions = selected.map((row) => {
  const candidate = row.candidate
  const assessed = basis(candidate.conceptId, candidate.routeRole)
  let decision: Tranche20State = 'revise'
  let finding = `No inspected source or bounded fixture establishes the ${candidate.routeRole} role at the required scope.`
  if (commercialRole(candidate.routeRole)) finding = PRODUCT_CONTRACT_FINDING
  else if (assessed.supported) {
    decision = 'evidence-ready'
    finding = `The exact ${assessed.kind} source supports the bounded ${candidate.routeRole} role and its non-claims are carried forward.`
  } else if (!assessed.sources.length && candidate.siteId === 'maha-policy') {
    decision = 'blocked'
    finding = `No authoritative source was inspected for the ${candidate.routeRole} policy claim; current-law and policy assertions cannot be inferred from adjacent topics.`
  }
  const dependency = graphByConcept.get(candidate.conceptId)
  return {
    selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, candidateId: candidate.candidateId, candidateDigest: row.candidateDigest,
    conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path,
    priorState: ledgerById.get(candidate.candidateId)?.state,
    dependency: dependency ? { graphObjectId: dependency.graphObjectId, priorDisposition: dependency.disposition, localRevision: candidate.conceptId === graphRevision.conceptId ? graphRevision.revisionId : null } : null,
    sourceAssessment: { kind: assessed.kind, roleSupported: assessed.supported, sourceIds: assessed.sources.map((source) => source.sourceId), locators: assessed.sources.map((source) => source.locator) },
    axes: { sourceIdentity: assessed.sources.length ? 'inspected' : 'missing', locator: assessed.sources.length ? 'exact' : 'missing', rights: assessed.sources.length ? 'recorded' : 'missing', scope: assessed.supported ? 'supports-route-role' : 'does-not-support-route-role', boundary: assessed.sources.length ? 'recorded' : 'missing' },
    decision, finding,
    noInheritance: 'Readiness is role-specific. A definition, sibling route, commercial plan, or adjacent implementation cannot be inherited as evidence.', activeBindingChanged: false,
  }
})
const counts = { candidates: decisions.length, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
writeFileSync(`${F}/federation-readiness-tranche-20-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-20-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const ready = new Set(decisions.filter((row) => row.decision === 'evidence-ready').map((row) => row.candidateId))
const specifications = selected.filter((row) => ready.has(row.candidate.candidateId)).map((row) => {
  const decision = decisions.find((item) => item.candidateId === row.candidate.candidateId)!
  const sources = basis(row.candidate.conceptId, row.candidate.routeRole).sources.filter((source) => source.roles.includes(row.candidate.routeRole))
  return {
    candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole,
    directAnswer: `${row.candidate.title} is limited to the behavior or authority established by the bound source and explicitly excludes the source's non-claims.`,
    requiredSections: ['Direct answer', 'Authority or implementation', 'Mechanism or procedure', 'Verification and uncertainty', 'What this does not establish', 'Dependencies and related concepts'],
    boundedQuestions: ['What is established?', 'Which exact source or symbol establishes it?', 'Which jurisdiction or implementation boundary applies?', 'What remains uncertain?', 'What must not be inferred?'],
    sourceBindings: sources.map((source) => ({ sourceId: source.sourceId, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary })),
    decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false,
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
writeFileSync(`${F}/federation-readiness-tranche-20-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-20-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const entries = ledger.entries.map((entry) => {
  const decision = decisionById.get(entry.candidateId)
  if (!decision) return entry
  return { ...entry, state: decision.decision, origin: 'readiness-tranche-20', specification: decision.decision === 'evidence-ready', implementationState: decision.decision === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false }
})
const ledgerCounts = { routeCandidates: entries.length, implementationReady: entries.filter((row) => row.implementationState === 'implementation-ready').length, unresolved: entries.filter((row) => row.implementationState === 'unresolved').length, newlyReadyThisTranche: decisions.filter((row) => row.decision === 'evidence-ready' && ledgerById.get(row.candidateId)?.implementationState !== 'implementation-ready').length }
if (ledgerCounts.routeCandidates !== 1628 || ledgerCounts.implementationReady + ledgerCounts.unresolved !== 1628) throw new Error('tranche-20-ledger-partition')
writeFileSync(`${F}/federation-unified-readiness-ledger-v3.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-unified-readiness-ledger/3.0', frozenOn: '2026-09-07', previousLedger: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { provenanceDigest: map.provenanceDigest }, counts: ledgerCounts, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries }), null, 2)}\n`)

const byBasis = {
  priorRevisionRequirements: decisions.filter((row) => row.selectionBasis === 'tranche-19-revision-requirement' && row.decision === 'evidence-ready').length,
  newUnreviewed: decisions.filter((row) => row.selectionBasis === 'next-unreviewed-unresolved-priority' && row.decision === 'evidence-ready').length,
}
writeFileSync('docs/operations/federation-readiness-tranche-20-v1.md', `# Federation readiness Tranche 20 — local report\n\n## Frozen cohort\n\n- Prior Tranche 19 revision requirements: 49\n- Next untouched unresolved candidates: 51\n- Total: 100\n\n## Review\n\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Prior revision requirements closed: ${byBasis.priorRevisionRequirements}\n- New candidates made ready: ${byBasis.newUnreviewed}\n- Substantial-page specifications: ${specifications.length}\n\nFive bounded fixture families were inspected. Commercial candidates remain revise because the repository's $250 and $5,000 dossier declarations are not one coherent offer contract. Policy candidates use only role-specific official authority; no authority is inherited into a machine rule.\n\n## Unified ledger v3\n\n- Implementation-ready: ${ledgerCounts.implementationReady}\n- Unresolved: ${ledgerCounts.unresolved}\n- Total: ${ledgerCounts.routeCandidates}\n\n## Boundary\n\nNo public route was generated. No build, sitemap, llms, release, deployment, or Production mutation occurred.\n`)

console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, byBasis, specifications: specifications.length, ledger: ledgerCounts }))
