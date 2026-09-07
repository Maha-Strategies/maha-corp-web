import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { digest, type Tranche22Source } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; conceptAuthority: { canonicalOwner: string; role: string; boundary: string }; typedRelationships: { type: string; target: string }[] }
type PriorSource = { sourceId: string; title: string; responsibleBody: string; versionOrDate: string; url: string; locator: string; rightsBasis: string; scope: string; boundary: string }
type PriorPacket = { topicKey: string; disposition: string; reason: string; sources: PriorSource[] }
type PriorDecision = { candidateId: string; state: string; reason: string; sourceIds: string[] }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v6.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t23 = read('federation-readiness-tranche-23-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string }[] }
const byId = new Map(map.candidates.map((row) => [row.candidateId, row]))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const t23Ids = new Set(t23.decisions.map((row) => row.candidateId))
const carried = t23.decisions.filter((row) => row.decision === 'revise').map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'tranche-23-revision-requirement' }))
const next = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !t23Ids.has(row.candidateId)).slice(0, 58).map((row) => ({ ...row, selectionBasis: 'next-untouched-unresolved-priority' }))
const selected = [...carried, ...next].map((selection, index) => {
  const candidate = byId.get(selection.candidateId)
  if (!candidate) throw new Error(`t24-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (carried.length !== 42 || next.length !== 58 || selected.length !== 100 || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('t24-cohort-invalid')

const cohortBody = { schemaVersion: 'maha-federation-readiness-tranche/24.0', frozenOn: '2026-09-07', sourceLedger: { provenanceDigest: ledger.provenanceDigest }, sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest }, sourceTranche23: { provenanceDigest: t23.provenanceDigest }, selectionRule: 'All 42 Tranche 23 revise decisions, then the first 58 unresolved priority rows absent from Tranche 23. Frozen before evidence reuse and adjudication.', counts: { candidates: 100, priorRevisionRequirements: 42, newUnreviewed: 58, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size }, candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })), execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false } }
writeFileSync(`${F}/federation-readiness-tranche-24-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const packetIndex = new Map<string, PriorPacket>()
for (const name of readdirSync(F).filter((name) => /^federation-tranche-\d+-evidence-packets-v1\.json$/.test(name)).sort()) {
  const artifact = read(name) as { packets?: PriorPacket[] }
  for (const packet of artifact.packets ?? []) if (packet.disposition === 'evidence-ready') packetIndex.set(packet.topicKey, packet)
}
const packetSources = (key: string): Tranche22Source[] => {
  const packet = packetIndex.get(key)
  if (!packet || packet.disposition !== 'evidence-ready') return []
  return packet.sources.map((row) => ({ sourceId: row.sourceId, identity: `${row.title} — ${row.responsibleBody}`, locator: `${row.url} — ${row.versionOrDate}; ${row.locator}`, rightsBasis: row.rightsBasis, scope: row.scope, boundary: row.boundary, roles: ['*'], kind: row.url.startsWith('repo:') || row.url.startsWith('lib/') ? 'local-implementation' : 'official-authority' }))
}
const priorDecisions = new Map<string, PriorDecision>()
for (const name of ['federation-tranche-11-mythology-decisions-v1.json', 'federation-tranche-13-decisions-v1.json', 'federation-tranche-16-decisions-v1.json']) {
  const artifact = read(name) as { entries?: { candidateId: string; disposition: string; reason: string; sourceIds?: string[] }[]; decisions?: { candidateId: string; finalState: string; reason: string }[] }
  for (const row of artifact.entries ?? []) priorDecisions.set(row.candidateId, { candidateId: row.candidateId, state: row.disposition, reason: row.reason, sourceIds: row.sourceIds ?? [] })
  for (const row of artifact.decisions ?? []) priorDecisions.set(row.candidateId, { candidateId: row.candidateId, state: row.finalState, reason: row.reason, sourceIds: [] })
}
const mythologyInspections = read('federation-tranche-11-mythology-source-inspections-v1.json') as { sources: (PriorSource & { rightsStatus: string })[] }
const mythologySources = new Map(mythologyInspections.sources.map((row) => [row.sourceId, { sourceId: row.sourceId, identity: `${row.title} — ${row.responsibleBody}`, locator: `${row.url} — ${row.versionOrDate}; ${row.locator}`, rightsBasis: row.rightsBasis, scope: row.scope, boundary: row.boundary, roles: ['*'], kind: 'official-authority' } satisfies Tranche22Source]))
const primarySources: Tranche22Source[] = [
  { sourceId: 't24-loc-primary-sources', identity: 'Getting Started with Primary Sources — Library of Congress', locator: 'https://www.loc.gov/programs/teachers/getting-started-with-primary-sources/ — “What are primary sources?” and “Why teach with primary sources?”', rightsBasis: 'official-public-reference; bounded paraphrase only', roles: ['definition', 'method', 'protocol', 'source-contract', 'relationships', 'fixture'], scope: 'Defines primary sources as original documents and objects created at the time under study and distinguishes observation from inference during analysis.', boundary: 'Whether something is primary depends on the research question and use; primary status does not establish truth, completeness, neutrality, or sufficient context.', kind: 'official-authority' },
  { sourceId: 't24-primary-source-contract', identity: 'Maha source-recovery contract', locator: 'lib/source-recovery.ts — validateObservation and compileRecoveryPackets', rightsBasis: 'project-owned-reference-only', roles: ['definition', 'method', 'protocol', 'source-contract', 'relationships', 'fixture'], scope: 'Separates source identity, access, inspection depth, locator, version relationship, and claim support.', boundary: 'A typed recovery packet records supplied evidence state; it does not prove that a source is truthful or sufficient for a claim.', kind: 'local-implementation' },
]
const suffix = (value: string) => value.split(':').at(-1)!
const tamilTopics = new Set(['marutam', 'divine-epithets', 'primary-text-boundaries', 'alvar-reception', 'kurinji', 'mullai'])
const authorialTopics = new Set(['mental-sovereignty', 'epistemic-infrastructure', 'governed-autonomy', 'recursive-institutions'])

function sourcesFor(candidate: Candidate): Tranche22Source[] {
  const topic = suffix(candidate.conceptId)
  if (candidate.siteId === 'maha-research' && topic === 'primary-source') return primarySources.filter((source) => source.roles.includes(candidate.routeRole))
  if (candidate.siteId === 'mayone-maharajan' && authorialTopics.has(topic)) return packetSources(`${candidate.siteId}:${topic}`)
  if (candidate.siteId === 'maha-strategies' && tamilTopics.has(topic)) return packetSources(`${candidate.siteId}:${topic}`)
  const prior = priorDecisions.get(candidate.candidateId)
  if (prior?.state === 'evidence-ready') return prior.sourceIds.map((id) => mythologySources.get(id)).filter((row): row is Tranche22Source => Boolean(row))
  return []
}

const decisions = selected.map((row) => {
  const candidate = row.candidate
  const topic = suffix(candidate.conceptId)
  const sources = sourcesFor(candidate)
  const dependencyValid = candidate.typedRelationships.length >= 3 && candidate.typedRelationships.some((item) => item.target === candidate.conceptId)
  let decision: 'evidence-ready' | 'revise' | 'blocked' = sources.length && dependencyValid ? 'evidence-ready' : 'revise'
  let finding = decision === 'evidence-ready' ? `Exact inspected authority supports the bounded ${candidate.routeRole} role without transferring authority across evidence frames.` : `No exact source or executable contract supports ${candidate.routeRole}; adjacent concepts are not inherited.`
  const prior = priorDecisions.get(candidate.candidateId)
  const newlyResolvedSourceAbsence = Boolean(prior && /no source was inspected/i.test(prior.reason) && sources.length)
  if (prior && prior.state !== 'evidence-ready' && !newlyResolvedSourceAbsence) { decision = prior.state === 'blocked' ? 'blocked' : 'revise'; finding = `Prior exact-candidate decision preserved: ${prior.reason}` }
  if (newlyResolvedSourceAbsence) finding = `The prior source-absence blocker is closed by an exact inspected topic packet or authority; the bounded ${candidate.routeRole} role is re-evaluated without inheriting adjacent claims.`
  if (candidate.siteId === 'maha-policy') { decision = 'blocked'; finding = 'No inspected authority establishes this exact current-law, comparison, or executable machine-rule claim.' }
  if (topic === 'deterministic-arithmetic' || topic === 'error-budgets') { decision = 'revise'; finding = 'Executable arithmetic exists, but the broad authority or uncertainty interpretation for this exact role remains unaccepted.' }
  if (candidate.routeRole === 'commercialization') { decision = 'revise'; finding = 'No exact current product offer maps to this role; no offer is manufactured.' }
  if (topic === 'agentic-query-letter' || topic === 'machine-readable-article' || topic === 'publishing-observability') { decision = prior?.state === 'blocked' ? 'blocked' : 'revise'; finding = prior ? `Prior exact-candidate decision preserved: ${prior.reason}` : 'The owner concept remains unpublished or uninspected; adjacent publishing standards cannot define it.' }
  if (topic === 'health-data-consent') { decision = 'revise'; finding = 'The high-fan-out consent definition remains reserved for the separate dependency-cascade review.' }
  if (topic === 'public-reason' || topic === 'machine-civilization') { decision = 'revise'; finding = 'No inspected Mayone manuscript passage establishes this exact authorial role; neighboring authorial concepts do not transfer.' }
  if (topic === 'tradition-comparison' || topic === 'house-system-selection' || (topic === 'interpretation-boundaries' && candidate.routeRole === 'calculation')) { decision = 'revise'; finding = 'The workflow contract does not supply evidence that would validate or privilege an astrological interpretation.' }
  if (topic === 'mythology' && !prior) { decision = 'blocked'; finding = 'No evidence-ready mythology aggregate may be assembled from unresolved child topics.' }
  if (topic === 'rainfall-triggered-hazards') { decision = 'blocked'; finding = prior ? `Prior exact-candidate decision preserved: ${prior.reason}` : 'No inspected source supports the exact definition.' }
  if (!dependencyValid && decision === 'evidence-ready') { decision = 'revise'; finding = 'The evidence is usable, but the exact canonical-owner dependency is incomplete.' }
  return { selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, candidateId: candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path, dependency: { canonicalOwner: candidate.conceptAuthority.canonicalOwner, authorityRole: candidate.conceptAuthority.role, authorityBoundary: candidate.conceptAuthority.boundary, typedRelationships: candidate.typedRelationships, valid: dependencyValid }, sourceAssessment: { sourceIds: sources.map((source) => source.sourceId), locators: sources.map((source) => source.locator), roleSupported: decision === 'evidence-ready' }, axes: { sourceIdentity: sources.length ? 'inspected-or-code-resolved' : 'missing', locator: sources.length ? 'exact' : 'missing', rights: sources.length ? 'recorded' : 'missing', scope: decision === 'evidence-ready' ? 'supports-route-role' : 'not-established', boundary: sources.length ? 'recorded' : 'missing', dependency: dependencyValid ? 'validated' : 'incomplete' }, decision, finding, noInheritance: 'No source, sibling role, identity, tradition, law, product, or authorial concept transfers authority to another route role.', activeBindingChanged: false }
})
const counts = { candidates: 100, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
if (counts.evidenceReady + counts.revise + counts.blocked !== 100) throw new Error('t24-partition')
writeFileSync(`${F}/federation-readiness-tranche-24-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-24-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const sourceRows = new Map<string, Tranche22Source>()
for (const row of selected) for (const source of sourcesFor(row.candidate)) sourceRows.set(source.sourceId, source)
const inspections = [...sourceRows.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map((row) => ({ ...row, passageStored: false }))
writeFileSync(`${F}/federation-readiness-tranche-24-source-inspections-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-24-sources/1.0', inspectedOn: '2026-09-07', counts: { inspections: inspections.length }, inspections, privacyBoundary: 'Only source identity, locator, rights, scope, and boundary metadata are retained.' }), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const specifications = selected.filter((row) => decisionById.get(row.candidate.candidateId)?.decision === 'evidence-ready').map((row) => { const decision = decisionById.get(row.candidate.candidateId)!; return { candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole, requiredSections: ['Direct answer', 'Authority and locator', 'Context or method', 'Limits and uncertainty', 'Dependencies'], boundedQuestions: ['What is established?', 'Which exact authority establishes it?', 'What dependency remains separate?', 'What uncertainty remains?', 'What must not be inferred?'], sourceBindings: sourcesFor(row.candidate).map((source) => ({ sourceId: source.sourceId, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary })), decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false } }).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
writeFileSync(`${F}/federation-readiness-tranche-24-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-24-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const unreviewedReplacementIds = new Set(['cand_d43767b90b272ddead9ab56c', 'cand_4080575bad7a1bfd45b42d3a', 'cand_1981169ef4336a655069490c', 'cand_9d7f62fef0254f8faa993456'])
const entries = ledger.entries.map((entry) => {
  const decision = decisionById.get(entry.candidateId)
  if (decision) return { ...entry, state: decision.decision, origin: 'readiness-tranche-24', specification: decision.decision === 'evidence-ready', implementationState: decision.decision === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false }
  if (unreviewedReplacementIds.has(entry.candidateId)) return { ...entry, state: 'revise', origin: 'readiness-review-coverage-correction-v1', specification: false, implementationState: 'unresolved', publicRouteCreated: false }
  return entry
})
const ledgerCounts = { routeCandidates: entries.length, implementationReady: entries.filter((row) => row.implementationState === 'implementation-ready').length, unresolved: entries.filter((row) => row.implementationState === 'unresolved').length, newlyReadyThisTranche: counts.evidenceReady }
if (ledgerCounts.routeCandidates !== 1628 || ledgerCounts.unresolved !== 225 - counts.evidenceReady + unreviewedReplacementIds.size) throw new Error('t24-ledger')
writeFileSync(`${F}/federation-unified-readiness-ledger-v7.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-unified-readiness-ledger/7.0', frozenOn: '2026-09-07', previousLedger: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { provenanceDigest: map.provenanceDigest }, counts: ledgerCounts, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries }), null, 2)}\n`)
const carriedClosed = decisions.filter((row) => row.selectionBasis === 'tranche-23-revision-requirement' && row.decision === 'evidence-ready').length
writeFileSync('docs/operations/federation-readiness-tranche-24-v1.md', `# Federation readiness Tranche 24 — local report\n\n- Carried revisions: 42\n- Next untouched candidates: 58\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Carried revisions closed: ${carriedClosed}\n- Specifications: ${specifications.length}\n- Ledger v7 implementation-ready: ${ledgerCounts.implementationReady}\n- Ledger v7 unresolved: ${ledgerCounts.unresolved}\n\nPrimary-source roles are now grounded in the Library of Congress definition plus Maha's fail-closed source-recovery contract. Existing Tamil packets are reused only at their recorded topic boundaries. Prior mythology decisions remain controlling. Health-data consent remains reserved for the separate dependency-cascade review. Four v5 replacement candidates previously counted ready without a recorded exact-revision review are returned to unresolved.\n\nNo public route, build, sitemap, llms, release, checkout mutation, deployment, or Production mutation occurred.\n`)
console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, carriedClosed, specifications: specifications.length, ledger: ledgerCounts }))
