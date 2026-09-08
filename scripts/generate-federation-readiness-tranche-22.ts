import { readFileSync, writeFileSync } from 'node:fs'
import {
  CARRIED_APPLICATION_SOURCES, POLICY_SOURCES, PRODUCT_MAPPING_SOURCES,
  PUBLISH_APPLICATION_SOURCES, RESEARCH_APPLICATION_SOURCES,
  SCIENTIFIC_EVIDENCE_POLICY_SOURCES, canonical, digest,
  checkedIntegerArithmetic, compileAuditExport, randomizedMeanContrast,
  rotateCartesianQuarterTurns, verifyLocator, verifyVersionRelationship,
  type Tranche22Source,
} from '../lib/federation/readiness-tranche-22.ts'
import { APPLICATION_SOURCES as T21_APPLICATION_SOURCES } from '../lib/federation/readiness-tranche-21.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; rank: number; scores: Record<string, number>; conceptAuthority: { canonicalOwner: string; role: string; boundary: string }; typedRelationships: { type: string; target: string }[] }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v4.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t21 = read('federation-readiness-tranche-21-decisions-v1.json') as { provenanceDigest: string; decisions: { selectionOrder: number; candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; decision: string }[] }
const graph = read('federation-definition-graph-objects-v1.json') as { provenanceDigest: string; graphObjects: { graphObjectId: string; conceptId: string; disposition: string }[] }
const authorityReviews = read('federation-authority-definition-reviews-v1.json') as { provenanceDigest: string; reviews: { graphObjectId: string; conceptId: string; finalDecision: string; bindingState: string; sourceIds: string[] }[] }
const authorityInspections = read('federation-external-authority-source-inspections-v1.json') as { provenanceDigest: string; sources: { sourceId: string; title: string; locator: string; rightsBasis: string; scope: string; boundary: string }[] }

const candidateById = new Map(map.candidates.map((row) => [row.candidateId, row]))
const ledgerById = new Map(ledger.entries.map((row) => [row.candidateId, row]))
const priorIds = new Set(t21.decisions.map((row) => row.candidateId))
const carried = t21.decisions.filter((row) => row.decision === 'revise').map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'tranche-21-revision-requirement' }))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const next = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !priorIds.has(row.candidateId)).slice(0, 73).map((row) => ({ ...row, selectionBasis: 'next-untouched-unresolved-priority' }))
const selected = [...carried, ...next].map((selection, index) => {
  const candidate = candidateById.get(selection.candidateId)
  if (!candidate) throw new Error(`t22-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (carried.length !== 27 || next.length !== 73 || selected.length !== 100 || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('t22-cohort-invalid')

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/22.0', frozenOn: '2026-09-07',
  sourceLedger: { provenanceDigest: ledger.provenanceDigest }, sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest }, sourceTranche21: { provenanceDigest: t21.provenanceDigest },
  selectionRule: 'All 27 Tranche 21 revise decisions in prior order, followed by the first 73 unresolved priority rows absent from every Tranche 21 decision. Frozen before fixture execution and source adjudication.',
  counts: { candidates: 100, priorRevisionRequirements: carried.length, newUnreviewed: next.length, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size },
  candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })),
  execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-22-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const fixtureExecutions = [
  { fixtureId: 'checked-integer-arithmetic', result: checkedIntegerArithmetic('multiply', 7n, 6n, 100n), expected: { result: 42n, exact: true }, refusalCases: ['invalid-limit', 'input-out-of-range', 'result-out-of-range'] },
  { fixtureId: 'quarter-turn-reference-frame', result: rotateCartesianQuarterTurns(3n, 4n, 1), expected: { x: -4n, y: 3n, normalizedQuarterTurns: 1 }, refusalCases: ['quarter-turn-not-integer'] },
  { fixtureId: 'randomized-mean-contrast', result: randomizedMeanContrast([1n, 3n], [4n, 6n], true), expected: { numerator: 12n, denominator: 4n, interpretation: 'randomized-sample-mean-contrast' }, refusalCases: ['random-assignment-not-declared', 'empty-arm'] },
  { fixtureId: 'locator-verification', result: verifyLocator({ sourceId: 's', sourceRevision: 'r1', kind: 'section', value: '§2' }, { sourceId: 's', sourceRevision: 'r1', kind: 'section', value: '§2' }), expected: { verified: true }, refusalCases: ['sourceId', 'sourceRevision', 'kind', 'value', 'empty'] },
  { fixtureId: 'version-relationship', result: verifyVersionRelationship({ objectId: 'o', revisionDigest: 'sha256:a', predecessorDigest: null, relation: 'initial' }, { objectId: 'o', revisionDigest: 'sha256:b', predecessorDigest: 'sha256:a', relation: 'supersedes' }), expected: { verified: true, transition: 'supersedes' }, refusalCases: ['initial-has-predecessor', 'predecessor-object-mismatch', 'predecessor-digest-mismatch', 'revision-unchanged'] },
  { fixtureId: 'audit-export', result: compileAuditExport([{ eventId: 'e2', eventType: 'acknowledged', subjectDigest: `sha256:${'b'.repeat(64)}`, occurredAt: '2026-09-07T00:00:02Z' }, { eventId: 'e1', eventType: 'delivered', subjectDigest: `sha256:${'a'.repeat(64)}`, occurredAt: '2026-09-07T00:00:01Z' }]), expected: { eventIds: ['e1', 'e2'], containsSubmittedContent: false }, refusalCases: ['duplicate-event', 'subject-digest-invalid', 'occurred-at-invalid'] },
]
if (canonical(fixtureExecutions[0].result) !== canonical(fixtureExecutions[0].expected)) throw new Error('arithmetic-fixture-failed')
if (canonical(fixtureExecutions[1].result) !== canonical(fixtureExecutions[1].expected)) throw new Error('frame-fixture-failed')
if (canonical(fixtureExecutions[2].result) !== canonical(fixtureExecutions[2].expected)) throw new Error('causal-fixture-failed')
if (!(fixtureExecutions[3].result as { verified: boolean }).verified) throw new Error('locator-fixture-failed')
if (canonical(fixtureExecutions[4].result) !== canonical(fixtureExecutions[4].expected)) throw new Error('version-fixture-failed')
const exportResult = fixtureExecutions[5].result as { entries: { eventId: string }[]; containsSubmittedContent: false }
if (canonical({ eventIds: exportResult.entries.map((row) => row.eventId), containsSubmittedContent: exportResult.containsSubmittedContent }) !== canonical(fixtureExecutions[5].expected)) throw new Error('audit-fixture-failed')
const fixturesBody = { schemaVersion: 'maha-federation-gap-closure-fixtures/3.0', frozenOn: '2026-09-07', syntheticOnly: true, executions: fixtureExecutions, boundary: 'Fixtures prove only exact bounded mechanics. They do not create empirical authority, transfer review, or establish a machine rule outside their executable input contract.' }
writeFileSync(`${F}/federation-readiness-tranche-22-gap-closure-fixtures-v1.json`, `${JSON.stringify(signed(fixturesBody), (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`)

const policyFoundationBody = {
  schemaVersion: 'maha-scientific-evidence-policy-foundation/1.0', inspectedOn: '2026-09-07',
  sources: SCIENTIFIC_EVIDENCE_POLICY_SOURCES.map((row) => ({ ...row, passageStored: false })),
  established: ['Evidence-building is a governed lifecycle rather than one undifferentiated evidence score.', 'Reproducibility and replicability are distinct and neither automatically adjudicates policy relevance.', 'Legal duties, scientific method, evaluation practice, data access, and confidentiality must remain separate frames.'],
  machineRule: { state: 'blocked', reason: 'No inspected authority supplies a universal executable rule that can decide arbitrary scientific claims or policy choices.' },
}
writeFileSync(`${F}/federation-scientific-evidence-policy-foundation-v1.json`, `${JSON.stringify(signed(policyFoundationBody), null, 2)}\n`)

const productRows = ['agent-memory-governance', 'context-budgeting', 'durable-task-state', 'cross-agent-delegation', 'failure-recovery'].map((suffix) => {
  const conceptId = `urn:maha:concept:authority:${suffix}`
  const sources = PRODUCT_MAPPING_SOURCES[conceptId] ?? []
  return { conceptId, role: 'commercialization', mapping: sources.length ? 'real-product-capability' : 'no-current-product-mapping', sourceIds: sources.map((row) => row.sourceId), offerManufactured: false, boundary: sources[0]?.boundary ?? 'No exact current product, endpoint, acquisition state, and bounded delivery contract jointly establish this commercialization role.' }
})
writeFileSync(`${F}/federation-agent-governance-product-mapping-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-agent-governance-product-mapping/1.0', inspectedOn: '2026-09-07', counts: { roles: 5, mapped: productRows.filter((row) => row.mapping === 'real-product-capability').length, unsupported: productRows.filter((row) => row.mapping !== 'real-product-capability').length }, mappings: productRows }), null, 2)}\n`)

const acceptedAuthority = new Map(authorityReviews.reviews.filter((row) => row.finalDecision === 'accept' && row.bindingState === 'definition-proposal-bound-to-graph-object').map((row) => [row.conceptId, row]))
const inspectionById = new Map(authorityInspections.sources.map((row) => [row.sourceId, row]))
const graphByConcept = new Map(graph.graphObjects.map((row) => [row.conceptId, row]))
function prerequisite(conceptId: string): Tranche22Source[] {
  const review = acceptedAuthority.get(conceptId)
  if (!review) return []
  return review.sourceIds.map((sourceId) => {
    const row = inspectionById.get(sourceId)
    if (!row) throw new Error(`t22-authority-source-missing:${sourceId}`)
    return { sourceId, identity: row.title, locator: row.locator, rightsBasis: row.rightsBasis, scope: row.scope, boundary: row.boundary, roles: ['definition'], kind: 'official-authority' }
  }) as Tranche22Source[]
}
function applications(candidate: Candidate): readonly Tranche22Source[] {
  const maps = [CARRIED_APPLICATION_SOURCES, POLICY_SOURCES, PRODUCT_MAPPING_SOURCES, PUBLISH_APPLICATION_SOURCES, RESEARCH_APPLICATION_SOURCES]
  const direct = maps.flatMap((sourceMap) => sourceMap[candidate.conceptId] ?? []).filter((row) => row.roles.includes(candidate.routeRole))
  const t21 = (T21_APPLICATION_SOURCES[candidate.conceptId] ?? []).filter((row) => row.roles.includes(candidate.routeRole))
  return [...direct, ...t21]
}

const decisions = selected.map((row) => {
  const candidate = row.candidate
  const application = applications(candidate)
  const authority = prerequisite(candidate.conceptId)
  const requiresDefinition = candidate.conceptId.startsWith('urn:maha:concept:computation:')
  let decision: 'evidence-ready' | 'revise' | 'blocked' = 'revise'
  let finding = `The reviewed material does not establish the exact ${candidate.routeRole} role.`
  if (application.length && (!requiresDefinition || authority.length)) {
    decision = 'evidence-ready'
    finding = `An exact bounded ${application[0].kind} establishes ${candidate.routeRole}${requiresDefinition ? ' while the accepted external definition remains separately bound' : ''}.`
  } else if (!application.length && !authority.length && candidate.siteId === 'maha-policy') {
    decision = 'blocked'
    finding = `No inspected authoritative foundation or executable implementation establishes ${candidate.routeRole}.`
  } else if (application.length && requiresDefinition && !authority.length) {
    finding = 'The executable fixture exists, but the external definition prerequisite remains unaccepted; implementation cannot manufacture its authority.'
  }
  const dependency = graphByConcept.get(candidate.conceptId)
  const inspected = [...application, ...authority]
  return {
    selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, candidateId: candidate.candidateId, candidateDigest: row.candidateDigest,
    conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path, priorState: ledgerById.get(candidate.candidateId)?.state,
    dependency: { graphObjectId: dependency?.graphObjectId ?? null, recordedDisposition: dependency?.disposition ?? null, acceptedAuthorityBinding: dependency && authority.length ? dependency.graphObjectId : null, canonicalOwner: candidate.conceptAuthority.canonicalOwner, authorityRole: candidate.conceptAuthority.role, authorityBoundary: candidate.conceptAuthority.boundary, typedRelationships: candidate.typedRelationships },
    sourceAssessment: { roleSupported: decision === 'evidence-ready', applicationSourceIds: application.map((item) => item.sourceId), prerequisiteSourceIds: authority.map((item) => item.sourceId), locators: inspected.map((item) => item.locator) },
    axes: { sourceIdentity: application.length ? 'inspected-or-code-resolved' : 'missing', locator: application.length ? 'exact' : 'missing', rights: application.length ? 'recorded' : 'missing', scope: decision === 'evidence-ready' ? 'supports-route-role' : 'does-not-yet-support-route-role', boundary: application.length ? 'recorded' : 'missing', dependency: candidate.typedRelationships.length >= 3 ? 'validated-canonical-owner-and-typed-relationships' : 'missing' },
    decision, finding, noInheritance: 'Definitions, sibling roles, adjacent sources, and product capabilities cannot be inherited as evidence for this route role.', activeBindingChanged: false,
  }
})
const counts = { candidates: 100, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
if (counts.evidenceReady + counts.revise + counts.blocked !== 100) throw new Error('t22-decision-partition')
writeFileSync(`${F}/federation-readiness-tranche-22-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-22-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const sourceRows = new Map<string, Tranche22Source>()
for (const row of selected) for (const source of [...applications(row.candidate), ...prerequisite(row.candidate.conceptId)]) sourceRows.set(source.sourceId, source)
for (const source of SCIENTIFIC_EVIDENCE_POLICY_SOURCES) sourceRows.set(source.sourceId, source)
const inspections = [...sourceRows.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map((row) => ({ ...row, passageStored: false }))
writeFileSync(`${F}/federation-readiness-tranche-22-source-inspections-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-22-sources/1.0', inspectedOn: '2026-09-07', counts: { inspections: inspections.length }, inspections, privacyBoundary: 'Only identity, locator, rights, scope, and boundary metadata are retained; no passages, submissions, credentials, or reviewer identities.' }), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const specifications = selected.filter((row) => decisionById.get(row.candidate.candidateId)?.decision === 'evidence-ready').map((row) => {
  const decision = decisionById.get(row.candidate.candidateId)!
  return { candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole, requiredSections: ['Direct answer', 'Authority or implementation', 'Method or mechanism', 'Verification and uncertainty', 'What this does not establish', 'Dependencies'], boundedQuestions: ['What is established?', 'What exact source or implementation establishes it?', 'What dependency remains separate?', 'What uncertainty remains?', 'What must not be inferred?'], sourceBindings: [...applications(row.candidate), ...prerequisite(row.candidate.conceptId)].map((source) => ({ sourceId: source.sourceId, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary })), decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
writeFileSync(`${F}/federation-readiness-tranche-22-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-22-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const entries = ledger.entries.map((entry) => {
  const decision = decisionById.get(entry.candidateId)
  if (!decision) return entry
  return { ...entry, state: decision.decision, origin: 'readiness-tranche-22', specification: decision.decision === 'evidence-ready', implementationState: decision.decision === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false }
})
const ledgerCounts = { routeCandidates: entries.length, implementationReady: entries.filter((row) => row.implementationState === 'implementation-ready').length, unresolved: entries.filter((row) => row.implementationState === 'unresolved').length, newlyReadyThisTranche: decisions.filter((row) => row.decision === 'evidence-ready').length }
if (ledgerCounts.routeCandidates !== 1628 || ledgerCounts.implementationReady + ledgerCounts.unresolved !== 1628 || ledgerCounts.unresolved !== 348 - ledgerCounts.newlyReadyThisTranche) throw new Error('t22-ledger-partition')
writeFileSync(`${F}/federation-unified-readiness-ledger-v5.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-unified-readiness-ledger/5.0', frozenOn: '2026-09-07', previousLedger: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { provenanceDigest: map.provenanceDigest }, counts: ledgerCounts, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries }), null, 2)}\n`)

const carriedClosed = decisions.filter((row) => row.selectionBasis === 'tranche-21-revision-requirement' && row.decision === 'evidence-ready').length
const newReady = counts.evidenceReady - carriedClosed
writeFileSync('docs/operations/federation-readiness-tranche-22-v1.md', `# Federation readiness Tranche 22 — local report\n\n## Frozen cohort\n\n- Carried Tranche 21 revisions: 27\n- Next untouched unresolved candidates: 73\n- Total independently reviewed: 100\n\n## Decisions\n\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Carried revisions closed: ${carriedClosed}\n- Newly selected candidates ready: ${newReady}\n- Substantial-page specifications: ${specifications.length}\n\nScientific-evidence policy now has GAO, statutory, and National Academies foundations, but its machine rule remains blocked. Of five unsupported agent-governance commercialization roles, ${productRows.filter((row) => row.mapping === 'real-product-capability').length} maps to an exact current product capability; no offer was manufactured for the others.\n\n## Ledger v5\n\n- Implementation-ready: ${ledgerCounts.implementationReady}\n- Unresolved: ${ledgerCounts.unresolved}\n- Gap closed from prior 348: ${ledgerCounts.newlyReadyThisTranche}\n\n## Boundary\n\nEverything remains local and specification-only. No public route, Next or Vercel build, sitemap, llms, release, checkout mutation, deployment, or Production mutation occurred.\n`)
console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, carriedClosed, newReady, specifications: specifications.length, products: { mapped: productRows.filter((row) => row.mapping === 'real-product-capability').length }, ledger: ledgerCounts }))
