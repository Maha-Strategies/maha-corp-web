import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; conceptAuthority: { canonicalOwner: string; role: string; boundary: string }; typedRelationships: { type: string; target: string }[] }
type Source = { sourceId: string; identity: string; locator: string; rightsBasis: string; scope: string; boundary: string; roles: string[]; kind: 'local-implementation'; passageStored: false }
type Prior = { state: string; reason: string; sourceIds: string[] }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v7.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t25 = read('federation-readiness-tranche-25-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string; finding: string; conceptId: string; routeRole: string }[] }
const byId = new Map(map.candidates.map((row) => [row.candidateId, row]))
const ledgerById = new Map(ledger.entries.map((row) => [row.candidateId, row]))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const t25Ids = new Set(t25.decisions.map((row) => row.candidateId))

const CLAUDE_OWNED_CONCEPTS = new Set([
  'urn:maha:concept:consent:health-data-consent',
  'urn:maha:concept:release:agentic-query-letter',
  'urn:maha:concept:release:publishing-observability',
  'urn:maha:concept:risk:rainfall-triggered-hazards',
  'urn:maha:concept:autonomy:public-reason',
  'urn:maha:concept:autonomy:machine-civilization',
  'urn:maha:concept:release:editorial-review',
  'urn:maha:concept:release:machine-readable-article',
])
const ordinary = (candidate: Candidate | undefined) => Boolean(candidate && candidate.routeRole !== 'definition' && !CLAUDE_OWNED_CONCEPTS.has(candidate.conceptId))
const untouched = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !t25Ids.has(row.candidateId) && ordinary(ledgerById.get(row.candidateId))).map((row) => ({ ...row, selectionBasis: 'all-remaining-untouched-unresolved-ordinary' }))
const recoveryIds = ['cand_d43767b90b272ddead9ab56c', 'cand_4080575bad7a1bfd45b42d3a', 'cand_1981169ef4336a655069490c', 'cand_9d7f62fef0254f8faa993456']
const recovery = recoveryIds.map((candidateId) => ({ candidateId, priorityScore: null, selectionBasis: 'unindexed-v5-replacement-recovery' }))
const carried = t25.decisions.filter((row) => row.decision === 'revise' && ordinary(ledgerById.get(row.candidateId))).slice(0, 4).map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'highest-order-tranche-25-revision' }))
const selected = [...untouched, ...recovery, ...carried].map((selection, index) => {
  const candidate = byId.get(selection.candidateId)
  if (!candidate) throw new Error(`t26-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (untouched.length !== 92 || recovery.length !== 4 || carried.length !== 4 || selected.length !== 100 || selected.some((row) => !ordinary(row.candidate)) || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('t26-cohort-invalid')

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/26.0', frozenOn: '2026-09-07',
  sourceLedger: { provenanceDigest: ledger.provenanceDigest }, sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest }, sourceTranche25: { provenanceDigest: t25.provenanceDigest },
  selectionRule: 'All 92 unresolved indexed candidates absent from Tranche 25 after excluding definition roles and Claude-owned prerequisite concepts; four unresolved v5 replacements omitted from the priority index; then the first four eligible Tranche 25 revise decisions in frozen order.',
  exclusion: { routeRoles: ['definition'], conceptIds: [...CLAUDE_OWNED_CONCEPTS].sort(), reason: 'Claude owns the prerequisite definitions and their same-concept dependents. Tranche 26 may not assess or count them.' },
  counts: { candidates: 100, untouched: 96, indexedUntouched: 92, unindexedReplacementRecovery: 4, carriedRevisions: 4, excludedConcepts: CLAUDE_OWNED_CONCEPTS.size, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size },
  candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })),
  execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-26-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const sources: Source[] = [
  { sourceId: 't26-runtime-witness-artifact-roles', identity: 'Computational witness receipt artifact-role verifier', locator: 'lib/evidence-dossier/runtime-witness.ts — artifacts: and verifyComputationalWitnessReceipt', rightsBasis: 'project-owned-reference-only', scope: 'Defines input, output, and code artifact roles; validates deterministic ordering, uniqueness, byte counts, and SHA-256 commitments.', boundary: 'An artifact inventory proves receipt structure and commitments, not scientific validity, independent reproduction, or completeness of the execution environment.', roles: ['artifact-role-inventory'], kind: 'local-implementation', passageStored: false },
  { sourceId: 't26-served-bundle-scanner', identity: 'Digest-gated served-bundle privacy scanner and adversarial fixture', locator: 'lib/batch-11-evidence-verifier.ts — scanForProhibitedContent; test/batch-11-scanner-path-awareness.test.ts — the exemption is a single exact literal at a single exact path', rightsBasis: 'project-owned-reference-only', scope: 'Scans a digest-verified output for credential shapes and named private-data classes while allowing one exact static policy literal at one exact path.', boundary: 'A passing scan covers the implemented patterns and inspected bundle; it does not prove absence of every possible confidential datum or authorize publication.', roles: ['served-bundle-check'], kind: 'local-implementation', passageStored: false },
  { sourceId: 't26-withdrawal-propagation', identity: 'Source-reference withdrawal propagation contract', locator: 'lib/source-evidence-reference.ts — GOVERNANCE_MODEL and evaluateSourcePage; test/source-first-engine.test.ts — must trace to an active released revision', rightsBasis: 'project-owned-reference-only', scope: 'Makes source-reference pages projections of active released claims and removes eligibility when an underlying record is withdrawn or no active released claim remains.', boundary: 'The projection does not retract external copies, prove the underlying claim false, or replace canonical release governance.', roles: ['withdrawal-propagation'], kind: 'local-implementation', passageStored: false },
  { sourceId: 't26-exact-revision-review', identity: 'Exact-revision internal-review projection contract', locator: 'lib/exact-revision-review.ts — projectReviewState and classifyForRelease and releaseAuthorized; test/exact-revision-review.test.ts — decisions are append-only and bind the exact revision', rightsBasis: 'project-owned-reference-only', scope: 'Binds review decisions to an exact target digest and requires the complete review projection before release authorization.', boundary: 'Internal exact-revision review is not external expert review, peer review, scientific validation, or authority to publish without the remaining release gates.', roles: ['exact-revision-binding'], kind: 'local-implementation', passageStored: false },
]
writeFileSync(`${F}/federation-readiness-tranche-26-source-inspections-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-26-sources/1.0', inspectedOn: '2026-09-07', counts: { inspections: sources.length }, inspections: sources, privacyBoundary: 'Only implementation identity, locator, rights, scope, and boundary metadata are retained.' }), null, 2)}\n`)

const prior = new Map<string, Prior>()
for (const name of readdirSync(F).filter((name) => /(?:tranche|readiness-tranche)-\d+.*decisions.*\.json$/.test(name) && name !== 'federation-readiness-tranche-26-decisions-v1.json').sort()) {
  const artifact = read(name) as { entries?: { candidateId: string; disposition: string; reason: string; sourceIds?: string[] }[]; decisions?: { candidateId: string; decision?: string; finalState?: string; finding?: string; reason?: string; sourceAssessment?: { sourceIds?: string[] } }[] }
  for (const row of artifact.entries ?? []) prior.set(row.candidateId, { state: row.disposition, reason: row.reason, sourceIds: row.sourceIds ?? [] })
  for (const row of artifact.decisions ?? []) prior.set(row.candidateId, { state: row.decision ?? row.finalState ?? 'revise', reason: row.finding ?? row.reason ?? 'Prior exact-candidate review remains unresolved.', sourceIds: row.sourceAssessment?.sourceIds ?? [] })
}
const resolved = new Map([
  ['cand_d43767b90b272ddead9ab56c', 't26-runtime-witness-artifact-roles'],
  ['cand_4080575bad7a1bfd45b42d3a', 't26-served-bundle-scanner'],
  ['cand_1981169ef4336a655069490c', 't26-withdrawal-propagation'],
  ['cand_9d7f62fef0254f8faa993456', 't26-exact-revision-review'],
])
const decisions = selected.map((row) => {
  const candidate = row.candidate
  const previous = prior.get(candidate.candidateId)
  const sourceId = resolved.get(candidate.candidateId)
  const exactSources = sourceId ? sources.filter((source) => source.sourceId === sourceId) : []
  const dependencyValid = candidate.typedRelationships.length >= 3 && candidate.typedRelationships.some((item) => item.target === candidate.conceptId)
  let decision: 'evidence-ready' | 'revise' | 'blocked' = sourceId && dependencyValid ? 'evidence-ready' : previous?.state === 'blocked' || ledgerById.get(candidate.candidateId)?.state === 'blocked' ? 'blocked' : 'revise'
  let finding = decision === 'evidence-ready' ? `The exact ${candidate.routeRole} implementation and adversarial contract are inspected at named local locators; the replacement now has its own review rather than inheriting its predecessor’s readiness.` : previous ? `Prior exact-candidate decision remains controlling: ${previous.reason}` : `No inspected source or executable contract establishes the exact ${candidate.routeRole} role.`
  if (!dependencyValid && decision === 'evidence-ready') { decision = 'revise'; finding = 'The implementation is exact, but the canonical-owner dependency is incomplete.' }
  return { selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, candidateId: candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path, dependency: { canonicalOwner: candidate.conceptAuthority.canonicalOwner, authorityRole: candidate.conceptAuthority.role, authorityBoundary: candidate.conceptAuthority.boundary, typedRelationships: candidate.typedRelationships, valid: dependencyValid }, sourceAssessment: { sourceIds: exactSources.map((source) => source.sourceId), locators: exactSources.map((source) => source.locator), roleSupported: decision === 'evidence-ready' }, axes: { sourceIdentity: exactSources.length ? 'code-resolved' : 'missing-or-prior-only', locator: exactSources.length ? 'exact' : 'missing-or-prior-only', rights: exactSources.length ? 'recorded' : 'missing-or-prior-only', scope: decision === 'evidence-ready' ? 'supports-exact-route-role' : 'not-established-for-exact-role', boundary: exactSources.length ? 'recorded' : 'missing-or-prior-only', dependency: dependencyValid ? 'validated' : 'incomplete' }, decision, finding, noInheritance: 'No predecessor, replacement declaration, sibling role, definition, source, or product transfers evidence to this exact candidate.', activeBindingChanged: false }
})
const counts = { candidates: 100, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
if (counts.evidenceReady + counts.revise + counts.blocked !== 100) throw new Error('t26-partition')
writeFileSync(`${F}/federation-readiness-tranche-26-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-26-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const specifications = selected.filter((row) => decisionById.get(row.candidate.candidateId)?.decision === 'evidence-ready').map((row) => { const decision = decisionById.get(row.candidate.candidateId)!; return { candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole, requiredSections: ['Direct answer', 'Executable contract', 'Verification evidence', 'Failure boundaries', 'Dependencies'], boundedQuestions: ['What is implemented?', 'Which exact locator proves it?', 'What fails closed?', 'What does the implementation not establish?', 'Which release gates remain?'], sourceBindings: sources.filter((source) => decision.sourceAssessment.sourceIds.includes(source.sourceId)).map((source) => ({ sourceId: source.sourceId, identity: source.identity, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary, roles: source.roles, kind: source.kind })), decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false } }).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
writeFileSync(`${F}/federation-readiness-tranche-26-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-26-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const deltaBody = { schemaVersion: 'maha-federation-readiness-ledger-delta/26.0', frozenOn: '2026-09-07', baseLedger: { provenanceDigest: ledger.provenanceDigest, implementationReady: 1426, unresolved: 202 }, priorOrdinaryDelta: { provenanceDigest: t25.provenanceDigest }, ownershipBoundary: 'Ordinary non-definition lane only. Claude-owned prerequisite concepts and their same-concept dependents are excluded. This is not a unified ledger.', counts: { reviewed: 100, newlyImplementationReady: counts.evidenceReady, remainUnresolved: 100 - counts.evidenceReady, projectedBaseImplementationReady: 1426 + counts.evidenceReady, projectedBaseUnresolved: 202 - counts.evidenceReady }, readyCandidateIds: decisions.filter((row) => row.decision === 'evidence-ready').map((row) => row.candidateId).sort(), execution: { ledgerApplied: false, publicRoutesGenerated: 0, buildRun: false, deployed: false } }
writeFileSync(`${F}/federation-readiness-tranche-26-ledger-delta-v1.json`, `${JSON.stringify(signed(deltaBody), null, 2)}\n`)
writeFileSync('docs/operations/federation-readiness-tranche-26-v1.md', `# Federation readiness Tranche 26 — ordinary lane\n\n- Untouched ordinary candidates: 96 (92 indexed + 4 unindexed v5 replacement recoveries)\n- Carried Tranche 25 revisions: 4\n- Claude-owned prerequisite concepts excluded: ${CLAUDE_OWNED_CONCEPTS.size}\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Specifications: ${specifications.length}\n\nFour v5 replacement candidates now have their own exact reviews against executable local contracts: runtime-witness artifact roles, served-bundle privacy scanning, withdrawal propagation, and exact-revision review binding. Their predecessor decisions are not inherited. Every other decision remains unresolved at its exact prior boundary.\n\nThis tranche emits a delta only. It does not modify Claude’s prerequisite work or the unified ledger, generate a route, run a build, alter a release, or deploy.\n`)
console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, specifications: specifications.length, delta: deltaBody.counts }))
