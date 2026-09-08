import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { digest, type Tranche22Source, CARRIED_APPLICATION_SOURCES, RESEARCH_APPLICATION_SOURCES, SCIENTIFIC_EVIDENCE_POLICY_SOURCES } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; conceptAuthority: { canonicalOwner: string; role: string; boundary: string }; typedRelationships: { type: string; target: string }[] }
type PriorSource = { sourceId: string; title: string; responsibleBody: string; versionOrDate: string; url: string; locator: string; rightsBasis: string; scope: string; boundary: string }
type PriorPacket = { topicKey: string; disposition: string; reason: string; sources: PriorSource[] }
const local = (id: string, locator: string, roles: string[], scope: string, boundary: string): Tranche22Source => ({ sourceId: id, identity: locator.split(' — ')[0], locator, roles, scope, boundary, rightsBasis: 'project-owned-reference-only', kind: 'local-implementation' })

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v5.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t22 = read('federation-readiness-tranche-22-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string }[] }
const byId = new Map(map.candidates.map((row) => [row.candidateId, row]))
const priorIds = new Set(t22.decisions.map((row) => row.candidateId))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const carried = t22.decisions.filter((row) => row.decision === 'revise').map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'tranche-22-revision-requirement' }))
const next = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !priorIds.has(row.candidateId)).slice(0, 76).map((row) => ({ ...row, selectionBasis: 'next-untouched-unresolved-priority' }))
const selected = [...carried, ...next].map((selection, index) => {
  const candidate = byId.get(selection.candidateId)
  if (!candidate) throw new Error(`t23-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (carried.length !== 24 || next.length !== 76 || selected.length !== 100 || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('t23-cohort-invalid')

const cohortBody = { schemaVersion: 'maha-federation-readiness-tranche/23.0', frozenOn: '2026-09-07', sourceLedger: { provenanceDigest: ledger.provenanceDigest }, sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest }, sourceTranche22: { provenanceDigest: t22.provenanceDigest }, selectionRule: 'All 24 Tranche 22 revise decisions, then the first 76 unresolved priority rows absent from Tranche 22. Frozen before packet reuse and role review.', counts: { candidates: 100, priorRevisionRequirements: 24, newUnreviewed: 76, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size }, candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })), execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false } }
writeFileSync(`${F}/federation-readiness-tranche-23-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const packetIndex = new Map<string, PriorPacket>()
for (const name of readdirSync(F).filter((name) => /^federation-tranche-\d+-evidence-packets-v1\.json$/.test(name)).sort()) {
  const artifact = read(name) as { packets?: PriorPacket[] }
  for (const packet of artifact.packets ?? []) if (packet.disposition === 'evidence-ready') packetIndex.set(packet.topicKey, packet)
}
const packetSources = (topicKey: string): Tranche22Source[] => (packetIndex.get(topicKey)?.sources ?? []).map((row) => ({ sourceId: row.sourceId, identity: `${row.title} — ${row.responsibleBody}`, locator: `${row.url} — ${row.versionOrDate}; ${row.locator}`, rightsBasis: row.rightsBasis, scope: row.scope, boundary: row.boundary, roles: ['*'], kind: row.url.startsWith('repo:') || row.url.startsWith('lib/') ? 'local-implementation' : 'official-authority' }))
const suffix = (conceptId: string) => conceptId.split(':').at(-1)!
const exactLocal: Record<string, Tranche22Source[]> = {
  'claim-extraction': [local('t23-claim-extraction', 'lib/claim-evidence.ts — assertClaimEvidence', ['*'], 'Validates claim provenance and empirical-evidence axes independently under a typed contract.', 'The contract records supplied assertions; it does not establish truth, source support, completeness, or semantic entailment.')],
  'slurm-job': [local('t23-slurm-contract', 'packages/maha-witness/src/maha_witness/adapters.py — slurm_metadata', ['*'], 'Normalizes a bounded allowlist of caller-supplied SLURM metadata without executing a scheduler.', 'Metadata capture does not prove workload correctness, scheduler truth, or reproducibility.')],
  'qiskit-circuit': [local('t23-qiskit-contract', 'packages/maha-witness/src/maha_witness/adapters.py — qiskit_metadata', ['*'], 'Normalizes bounded circuit and backend metadata with digest and positive-shot checks.', 'Metadata capture does not establish quantum advantage, hardware fidelity, or scientific validity.')],
  'scope-matching': [local('t23-scope-preflight', 'lib/evidence-preflight.ts — compileEvidencePreflight', ['*'], 'Computes deterministic bounded-language and lexical-coverage review signals.', 'Lexical overlap is routing evidence only, not semantic support.')],
  'passage-locator': [local('t23-locator-contract', 'lib/federation/readiness-tranche-22.ts — verifyLocator', ['*'], 'Binds source, source revision, locator kind, and locator value and refuses substitution.', 'A matching declaration does not prove passage existence or claim support.')],
  'contradiction-search': [local('t23-contradiction-contract', 'lib/federation/readiness-tranche-21.ts — classifyLiterature', ['*'], 'Compares located observations only at matching claim, population, and outcome scope.', 'Directional conflict does not adjudicate study quality or truth.')],
  'formal-definition': [local('t23-formal-definition', 'packages/maha-lean-bridge/src/verifier.ts — verifyAttachments', ['*'], 'Verifies formal-proof attachments against pinned source, manifest, claim, and toolchain identities.', 'Formal verification does not establish empirical premises or source truth.')],
  'reproducibility': [local('t23-reproducibility-registry', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_PUBLIC_REGISTRY', ['*'], 'Publishes digest-bound synthetic workflows, refusals, and checks.', 'Synthetic conformance is not independent reproduction.')],
  'abstract-only-evidence': [local('t23-abstract-boundary', 'lib/source-recovery.ts — validateObservation', ['*'], 'Preserves abstract-only inspection as a shallower state than section or full-text inspection.', 'An abstract cannot support section-specific detail.')],
  'full-text-evidence': [local('t23-fulltext-contract', 'lib/source-recovery.ts — compileRecoveryPackets', ['*'], 'Keeps access, inspection, locator, identity, and version states separate.', 'Full-text access alone does not establish relevance, rights, or support.')],
  'government-mirror': [local('t23-government-recovery', 'lib/source-recovery.ts — recoveryRequests', ['*'], 'Represents government-host recovery as one bounded route while preserving identity and version checks.', 'Government hosting does not make a source authoritative for every claim.')],
}
const astrology = local('t23-astrology-workflows', 'lib/astrology-workflow-protocols.ts — ASTROLOGY_WORKFLOW_PROTOCOLS', ['input-contract', 'workflow', 'calculation'], 'Defines bounded reference-frame inputs, deterministic operations, receipts, uncertainty, and refusal conditions.', 'Reproducible arithmetic does not validate astrology, select a true tradition, or justify interpretive claims.')

function sourcesFor(candidate: Candidate): Tranche22Source[] {
  const concept = suffix(candidate.conceptId)
  if (candidate.conceptId === 'urn:maha:concept:governance:scientific-evidence-policy') return candidate.routeRole === 'machine-rule' ? [] : [...SCIENTIFIC_EVIDENCE_POLICY_SOURCES]
  if (candidate.conceptId.startsWith('urn:maha:concept:interpretation:')) return astrology.roles.includes(candidate.routeRole) && (concept === 'coordinate-frames' || (concept === 'interpretation-boundaries' && candidate.routeRole === 'input-contract')) ? [astrology] : []
  if (candidate.conceptId.startsWith('urn:maha:concept:autonomy:')) return packetSources(`${candidate.siteId}:${concept}`)
  if (candidate.conceptId === 'urn:maha:concept:authority:epistemic-clearance') return packetSources('maha-strategies:epistemic-clearance')
  const direct = [...(exactLocal[concept] ?? []), ...(RESEARCH_APPLICATION_SOURCES[candidate.conceptId] ?? []), ...(CARRIED_APPLICATION_SOURCES[candidate.conceptId] ?? [])]
  const roleDirect = direct.filter((source) => source.roles.includes('*') || source.roles.includes(candidate.routeRole))
  const prior = packetSources(`${candidate.siteId}:${concept}`)
  return [...roleDirect, ...prior].filter((source, index, rows) => rows.findIndex((item) => item.sourceId === source.sourceId) === index)
}

const decisions = selected.map((row) => {
  const candidate = row.candidate
  const sources = sourcesFor(candidate)
  let decision: 'evidence-ready' | 'revise' | 'blocked' = sources.length ? 'evidence-ready' : 'revise'
  let finding = sources.length ? `Exact inspected authority or executable contract supports the bounded ${candidate.routeRole} role.` : `No exact source or executable contract supports ${candidate.routeRole}; adjacent concepts are not inherited.`
  if (candidate.siteId === 'maha-policy' && !sources.length) { decision = 'blocked'; finding = 'No inspected authority creates this current-law or machine-rule claim.' }
  if (candidate.conceptId.includes(':deterministic-arithmetic')) { decision = 'revise'; finding = 'The fixture is executable, but its broad external definition remains unaccepted; application cannot manufacture authority.' }
  if (candidate.conceptId.includes(':error-budgets')) { decision = 'revise'; finding = 'No exact uncertainty interpretation is bound to the existing error-budget fixture.' }
  if (candidate.routeRole === 'commercialization') { decision = 'revise'; finding = 'No exact current product offer maps to this role; no offer is manufactured.' }
  if (candidate.conceptId.includes(':agentic-query-letter') || candidate.conceptId.includes(':machine-readable-article') || candidate.conceptId.includes(':publishing-observability')) { decision = 'revise'; finding = 'The owner concept remains unpublished or uninspected; adjacent publishing standards cannot define it.' }
  if (candidate.conceptId.includes(':health-data-consent')) { decision = 'revise'; finding = 'The high-fan-out consent definition is reserved for the separately reviewed dependency-cascade track.' }
  const dependencyValid = candidate.typedRelationships.length >= 3 && candidate.typedRelationships.some((item) => item.target === candidate.conceptId)
  if (!dependencyValid && decision === 'evidence-ready') { decision = 'revise'; finding = 'The source is usable, but the exact canonical-owner dependency is incomplete.' }
  return { selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, candidateId: candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path, dependency: { canonicalOwner: candidate.conceptAuthority.canonicalOwner, authorityRole: candidate.conceptAuthority.role, authorityBoundary: candidate.conceptAuthority.boundary, typedRelationships: candidate.typedRelationships, valid: dependencyValid }, sourceAssessment: { sourceIds: sources.map((source) => source.sourceId), locators: sources.map((source) => source.locator), roleSupported: decision === 'evidence-ready' }, axes: { sourceIdentity: sources.length ? 'inspected-or-code-resolved' : 'missing', locator: sources.length ? 'exact' : 'missing', rights: sources.length ? 'recorded' : 'missing', scope: decision === 'evidence-ready' ? 'supports-route-role' : 'not-established', boundary: sources.length ? 'recorded' : 'missing', dependency: dependencyValid ? 'validated' : 'incomplete' }, decision, finding, noInheritance: 'No source, definition, sibling role, product, tradition, or authorial claim transfers authority to another route role.', activeBindingChanged: false }
})
const counts = { candidates: 100, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
if (counts.evidenceReady + counts.revise + counts.blocked !== 100) throw new Error('t23-partition')
writeFileSync(`${F}/federation-readiness-tranche-23-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-23-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const sourceRows = new Map<string, Tranche22Source>()
for (const row of selected) for (const source of sourcesFor(row.candidate)) sourceRows.set(source.sourceId, source)
const inspections = [...sourceRows.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map((row) => ({ ...row, passageStored: false }))
writeFileSync(`${F}/federation-readiness-tranche-23-source-inspections-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-23-sources/1.0', inspectedOn: '2026-09-07', counts: { inspections: inspections.length }, inspections, privacyBoundary: 'Only source identity, locator, rights, scope, and boundary metadata are retained.' }), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const specifications = selected.filter((row) => decisionById.get(row.candidate.candidateId)?.decision === 'evidence-ready').map((row) => { const decision = decisionById.get(row.candidate.candidateId)!; return { candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole, requiredSections: ['Direct answer', 'Source or implementation', 'Method', 'Limits and uncertainty', 'Dependencies'], boundedQuestions: ['What is established?', 'Which exact source establishes it?', 'What dependency remains separate?', 'What uncertainty remains?', 'What must not be inferred?'], sourceBindings: sourcesFor(row.candidate).map((source) => ({ sourceId: source.sourceId, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary })), decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false } }).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
writeFileSync(`${F}/federation-readiness-tranche-23-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-23-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const entries = ledger.entries.map((entry) => { const decision = decisionById.get(entry.candidateId); if (!decision) return entry; return { ...entry, state: decision.decision, origin: 'readiness-tranche-23', specification: decision.decision === 'evidence-ready', implementationState: decision.decision === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false } })
const ledgerCounts = { routeCandidates: entries.length, implementationReady: entries.filter((row) => row.implementationState === 'implementation-ready').length, unresolved: entries.filter((row) => row.implementationState === 'unresolved').length, newlyReadyThisTranche: counts.evidenceReady }
if (ledgerCounts.routeCandidates !== 1628 || ledgerCounts.unresolved !== 282 - counts.evidenceReady) throw new Error('t23-ledger')
writeFileSync(`${F}/federation-unified-readiness-ledger-v6.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-unified-readiness-ledger/6.0', frozenOn: '2026-09-07', previousLedger: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { provenanceDigest: map.provenanceDigest }, counts: ledgerCounts, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries }), null, 2)}\n`)
const carriedClosed = decisions.filter((row) => row.selectionBasis === 'tranche-22-revision-requirement' && row.decision === 'evidence-ready').length
writeFileSync('docs/operations/federation-readiness-tranche-23-v1.md', `# Federation readiness Tranche 23 — local report\n\n- Carried revisions: 24\n- Next untouched candidates: 76\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Carried revisions closed: ${carriedClosed}\n- Specifications: ${specifications.length}\n- Ledger v6 implementation-ready: ${ledgerCounts.implementationReady}\n- Ledger v6 unresolved: ${ledgerCounts.unresolved}\n\nHealth-data consent remains reserved for the separate dependency-cascade review. Scientific-evidence machine rules, unaccepted deterministic-arithmetic authority, unsupported commercialization, and unpublished Publish owner concepts remain blocked or revise.\n\nNo public route, build, sitemap, llms, release, checkout mutation, deployment, or Production mutation occurred.\n`)
console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, carriedClosed, specifications: specifications.length, ledger: ledgerCounts }))
