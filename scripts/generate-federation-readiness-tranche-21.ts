import { readFileSync, writeFileSync } from 'node:fs'
import {
  ADDITIONAL_DEFINITION_SOURCES, APPLICATION_SOURCES, OFFER_BOUNDARY, OFFER_LAYERS, POLICY_SOURCES,
  cancellationFixture, canonical, classifyLiterature, combineDimensions, commercialSources,
  digest, errorBudget, linearInterpolate, boundedMinimum, trapezoidIntegral,
  type Tranche21Source, type Tranche21State,
} from '../lib/federation/readiness-tranche-21.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; rank: number; scores: Record<string, number> }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v3.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t20 = read('federation-readiness-tranche-20-decisions-v1.json') as { provenanceDigest: string; decisions: { selectionOrder: number; candidateId: string; candidateDigest: string; conceptId: string; siteId: string; routeRole: string; path: string; decision: string }[] }
const graph = read('federation-definition-graph-objects-v1.json') as { provenanceDigest: string; graphObjects: { graphObjectId: string; conceptId: string; disposition: string }[] }
const authorityReviews = read('federation-authority-definition-reviews-v1.json') as { provenanceDigest: string; reviews: { graphObjectId: string; conceptId: string; finalDecision: string; bindingState: string; sourceIds: string[] }[] }
const authorityInspections = read('federation-external-authority-source-inspections-v1.json') as { provenanceDigest: string; sources: { sourceId: string; title: string; locator: string; rightsBasis: string; scope: string; boundary: string }[] }

const candidateById = new Map(map.candidates.map((row) => [row.candidateId, row]))
const ledgerById = new Map(ledger.entries.map((row) => [row.candidateId, row]))
const t20Ids = new Set(t20.decisions.map((row) => row.candidateId))
const carried = t20.decisions.filter((row) => row.decision === 'revise').map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'tranche-20-revision-requirement' }))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const next = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !t20Ids.has(row.candidateId)).slice(0, 29).map((row) => ({ ...row, selectionBasis: 'next-untouched-unresolved-priority' }))
const selected = [...carried, ...next].map((selection, index) => {
  const candidate = candidateById.get(selection.candidateId)
  if (!candidate) throw new Error(`tranche-21-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (carried.length !== 71 || next.length !== 29 || selected.length !== 100 || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('tranche-21-cohort-invalid')

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/21.0', frozenOn: '2026-09-07',
  sourceLedger: { provenanceDigest: ledger.provenanceDigest }, sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest }, sourceTranche20: { provenanceDigest: t20.provenanceDigest },
  selectionRule: 'All 71 Tranche 20 revise decisions in prior review order, followed by the first 29 unresolved priority rows absent from every Tranche 20 decision. Frozen before offer reconciliation or fixture execution.',
  counts: { candidates: 100, priorRevisionRequirements: carried.length, newUnreviewed: next.length, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size },
  candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })),
  execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-21-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const fixtureExecutions = [
  { fixtureId: 'linear-interpolation-exact-rational', result: linearInterpolate(BigInt(0), BigInt(10), BigInt(4), BigInt(18), BigInt(1)), expected: { numerator: BigInt(12), denominator: BigInt(1) }, refusals: ['nodes-not-distinct', 'extrapolation-refused'] },
  { fixtureId: 'composite-trapezoid-exact-rational', result: trapezoidIntegral(BigInt(1), [BigInt(0), BigInt(1), BigInt(4)]), expected: { numerator: BigInt(3), denominator: BigInt(1) }, refusals: ['spacing-not-positive', 'insufficient-ordinates'] },
  { fixtureId: 'bounded-enumeration-minimum', result: boundedMinimum([BigInt(9), BigInt(4), BigInt(4), BigInt(7)]), expected: { index: 1, value: BigInt(4) }, refusals: ['empty-domain'] },
  { fixtureId: 'si-dimension-vector-composition', result: combineDimensions([1, 0, -1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], 'multiply'), expected: [1, 0, 0, 0, 0, 0, 0], refusals: ['unknown-operation'] },
  { fixtureId: 'sum-of-squares-budget', result: errorBudget([BigInt(3), BigInt(4)]), expected: { sumOfSquares: BigInt(25) }, refusals: ['invalid-error-budget'] },
  { fixtureId: 'binary64-cancellation', result: cancellationFixture(), expected: { floating: 0, exactInteger: BigInt(1), precisionLost: true }, refusals: [] },
  { fixtureId: 'scope-preserving-literature-conflict', result: classifyLiterature([
    { observationId: 'obs-a', normalizedClaimId: 'claim-a', direction: 'supports', population: 'p1', outcome: 'o1', sourceId: 'src-a', exactLocator: 'Section 2' },
    { observationId: 'obs-b', normalizedClaimId: 'claim-a', direction: 'opposes', population: 'p1', outcome: 'o1', sourceId: 'src-b', exactLocator: 'Table 3' },
    { observationId: 'obs-c', normalizedClaimId: 'claim-a', direction: 'opposes', population: 'p2', outcome: 'o1', sourceId: 'src-c', exactLocator: 'Figure 1' },
  ]), expected: { state: 'conflict-observed', observationIds: ['obs-a', 'obs-b'] }, refusals: ['at-least-two-observations-required', 'duplicate-observation', 'unlocated-observation', 'claim-substitution'] },
]
for (const row of fixtureExecutions) if (canonical(row.result) !== canonical(row.expected)) throw new Error(`tranche-21-fixture-mismatch:${row.fixtureId}`)
const conflictGraph = graph.graphObjects.find((row) => row.conceptId === 'urn:maha:concept:evidence:conflicting-literature')
if (!conflictGraph) throw new Error('conflicting-literature-graph-object-missing')
const fixturesBody = {
  schemaVersion: 'maha-federation-gap-closure-fixtures/2.0', frozenOn: '2026-09-07', syntheticOnly: true,
  graphRevision: { graphObjectId: conflictGraph.graphObjectId, conceptId: conflictGraph.conceptId, priorDisposition: conflictGraph.disposition, proposedDisposition: 'non-route-graph-object', reviewDecision: 'accept-for-local-readiness', canonicalBindingChanged: false },
  executions: fixtureExecutions,
  boundary: 'Every fixture is an exact bounded application of an accepted authority definition or a local protocol. It establishes only the named application roles and never transfers authority from a definition to an implementation.',
}
writeFileSync(`${F}/federation-readiness-tranche-21-gap-closure-fixtures-v1.json`, `${JSON.stringify(signed(fixturesBody), (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`)

const offerBody = {
  schemaVersion: 'maha-commercial-offer-role-reconciliation/1.0', frozenOn: '2026-09-07',
  layers: OFFER_LAYERS, commonBoundary: OFFER_BOUNDARY,
  finding: 'The declarations are compatible only when treated as four distinct scopes and acquisition states. The $250 offer remains disabled; the $5,000 package remains a separately contracted pilot.',
  mutation: { checkoutChanged: false, availabilityChanged: false, priceChanged: false, refundTermsChanged: false, privacyTermsChanged: false, deliveryTermsChanged: false },
}
writeFileSync(`${F}/federation-readiness-tranche-21-offer-reconciliation-v1.json`, `${JSON.stringify(signed(offerBody), null, 2)}\n`)

const acceptedAuthority = new Map(authorityReviews.reviews.filter((row) => row.finalDecision === 'accept' && row.bindingState === 'definition-proposal-bound-to-graph-object').map((row) => [row.conceptId, row]))
const inspectionById = new Map(authorityInspections.sources.map((row) => [row.sourceId, row]))
const graphByConcept = new Map(graph.graphObjects.map((row) => [row.conceptId, row]))

function authorityPrerequisite(conceptId: string): Tranche21Source[] {
  const review = acceptedAuthority.get(conceptId)
  if (!review) return [...(ADDITIONAL_DEFINITION_SOURCES[conceptId] ?? [])]
  return review.sourceIds.map((sourceId) => {
    const row = inspectionById.get(sourceId)
    if (!row) throw new Error(`authority-source-missing:${sourceId}`)
    return { sourceId, identity: row.title, locator: row.locator, rightsBasis: row.rightsBasis, scope: row.scope, boundary: row.boundary, roles: ['definition'], kind: 'official-authority' as const }
  })
}

function sourcesFor(conceptId: string, role: string): { application: readonly Tranche21Source[]; prerequisite: readonly Tranche21Source[] } {
  const direct = [...(APPLICATION_SOURCES[conceptId] ?? []), ...(POLICY_SOURCES[conceptId] ?? []), ...commercialSources(conceptId, role)]
  return { application: direct.filter((row) => row.roles.includes(role)), prerequisite: authorityPrerequisite(conceptId) }
}

const decisions = selected.map((row) => {
  const candidate = row.candidate
  const sources = sourcesFor(candidate.conceptId, candidate.routeRole)
  let decision: Tranche21State = 'revise'
  let finding = `No role-specific inspected authority or bounded implementation establishes ${candidate.routeRole}.`
  if (sources.application.length) {
    const needsAuthorityDefinition = candidate.conceptId.startsWith('urn:maha:concept:computation:')
    if (!needsAuthorityDefinition || sources.prerequisite.length) {
      decision = 'evidence-ready'
      finding = `The exact ${sources.application[0].kind} supports ${candidate.routeRole}${needsAuthorityDefinition ? ' and the accepted external definition remains a separate prerequisite' : ''}.`
    } else finding = 'A bounded implementation exists, but its external definition prerequisite is not accepted and bound.'
  } else if (candidate.siteId === 'maha-policy' && !POLICY_SOURCES[candidate.conceptId]?.length) {
    decision = 'blocked'
    finding = `No authoritative source was inspected for ${candidate.routeRole}; adjacent policy topics cannot supply it.`
  }
  const dependency = graphByConcept.get(candidate.conceptId)
  return {
    selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, candidateId: candidate.candidateId, candidateDigest: row.candidateDigest,
    conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path,
    priorState: ledgerById.get(candidate.candidateId)?.state,
    dependency: dependency ? { graphObjectId: dependency.graphObjectId, recordedDisposition: dependency.disposition, acceptedAuthorityBinding: sources.prerequisite.length ? dependency.graphObjectId : null, localRevision: candidate.conceptId === conflictGraph.conceptId ? 't21-conflicting-literature-definition' : null } : null,
    sourceAssessment: { roleSupported: decision === 'evidence-ready', applicationSourceIds: sources.application.map((item) => item.sourceId), prerequisiteSourceIds: sources.prerequisite.map((item) => item.sourceId), locators: [...sources.application, ...sources.prerequisite].map((item) => item.locator) },
    axes: { sourceIdentity: sources.application.length ? 'inspected' : 'missing', locator: sources.application.length ? 'exact' : 'missing', rights: sources.application.length ? 'recorded' : 'missing', scope: decision === 'evidence-ready' ? 'supports-route-role' : 'does-not-support-route-role', boundary: sources.application.length ? 'recorded' : 'missing' },
    decision, finding, noInheritance: 'A definition, sibling role, product capability, price, or adjacent policy source cannot be inherited as application evidence.', activeBindingChanged: false,
  }
})
const counts = { candidates: decisions.length, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
writeFileSync(`${F}/federation-readiness-tranche-21-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-21-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const sourceRows = new Map<string, Tranche21Source>()
for (const row of decisions.filter((item) => item.decision === 'evidence-ready')) {
  const sources = sourcesFor(row.conceptId, row.routeRole)
  for (const source of [...sources.application, ...sources.prerequisite]) sourceRows.set(source.sourceId, source)
}
const sourceBody = {
  schemaVersion: 'maha-federation-readiness-tranche-21-sources/1.0', inspectedOn: '2026-09-07',
  inspections: [...sourceRows.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map((row) => ({ ...row, passageStored: false })),
  privacyBoundary: 'Only source identities, exact locators, rights bases, scopes, and boundaries are retained. No passages, submissions, credentials, or reviewer identities are stored.',
}
writeFileSync(`${F}/federation-readiness-tranche-21-source-inspections-v1.json`, `${JSON.stringify(signed({ ...sourceBody, counts: { inspections: sourceBody.inspections.length } }), null, 2)}\n`)

const ready = new Set(decisions.filter((row) => row.decision === 'evidence-ready').map((row) => row.candidateId))
const specifications = selected.filter((row) => ready.has(row.candidate.candidateId)).map((row) => {
  const decision = decisions.find((item) => item.candidateId === row.candidate.candidateId)!
  const sources = sourcesFor(row.candidate.conceptId, row.candidate.routeRole)
  return {
    candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, title: row.candidate.title, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole,
    directAnswer: `${row.candidate.title} is limited to the bound authority, implementation, or commercial acquisition state and carries its exclusions explicitly.`,
    requiredSections: ['Direct answer', 'Authority or implementation', 'Mechanism or acquisition state', 'Verification and uncertainty', 'What this does not establish', 'Dependencies and related concepts'],
    boundedQuestions: ['What is established?', 'Which source or symbol establishes it?', 'What prerequisite remains separate?', 'What remains unavailable or uncertain?', 'What must not be inferred?'],
    sourceBindings: [...sources.application, ...sources.prerequisite].map((source) => ({ sourceId: source.sourceId, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary })),
    decisionDigest: digest(decision), implementationState: 'specification-only', publicRouteCreated: false,
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
writeFileSync(`${F}/federation-readiness-tranche-21-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-21-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const decisionById = new Map(decisions.map((row) => [row.candidateId, row]))
const entries = ledger.entries.map((entry) => {
  const decision = decisionById.get(entry.candidateId)
  if (!decision) return entry
  return { ...entry, state: decision.decision, origin: 'readiness-tranche-21', specification: decision.decision === 'evidence-ready', implementationState: decision.decision === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false }
})
const ledgerCounts = { routeCandidates: entries.length, implementationReady: entries.filter((row) => row.implementationState === 'implementation-ready').length, unresolved: entries.filter((row) => row.implementationState === 'unresolved').length, newlyReadyThisTranche: decisions.filter((row) => row.decision === 'evidence-ready' && ledgerById.get(row.candidateId)?.implementationState !== 'implementation-ready').length }
if (ledgerCounts.routeCandidates !== 1628 || ledgerCounts.implementationReady + ledgerCounts.unresolved !== 1628) throw new Error('tranche-21-ledger-partition')
writeFileSync(`${F}/federation-unified-readiness-ledger-v4.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-unified-readiness-ledger/4.0', frozenOn: '2026-09-07', previousLedger: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { provenanceDigest: map.provenanceDigest }, counts: ledgerCounts, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries }), null, 2)}\n`)

const byBasis = {
  priorRevisionRequirements: decisions.filter((row) => row.selectionBasis === 'tranche-20-revision-requirement' && row.decision === 'evidence-ready').length,
  newUnreviewed: decisions.filter((row) => row.selectionBasis === 'next-untouched-unresolved-priority' && row.decision === 'evidence-ready').length,
}
writeFileSync('docs/operations/federation-readiness-tranche-21-v1.md', `# Federation readiness Tranche 21 — local report\n\n## Frozen cohort\n\n- Carried Tranche 20 revisions: 71\n- Next untouched unresolved candidates: 29\n- Total: 100\n\n## Review\n\n- Evidence-ready: ${counts.evidenceReady}\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Carried revisions closed: ${byBasis.priorRevisionRequirements}\n- New candidates ready: ${byBasis.newUnreviewed}\n- Substantial-page specifications: ${specifications.length}\n\nCommercial declarations are reconciled as four distinct offer scopes; no purchase state changed. Synthetic application fixtures remain separate from accepted external definitions. Policy authority is role-specific and cannot create a machine rule.\n\n## Unified ledger v4\n\n- Implementation-ready: ${ledgerCounts.implementationReady}\n- Unresolved: ${ledgerCounts.unresolved}\n- Total: ${ledgerCounts.routeCandidates}\n\n## Boundary\n\nNo public route was generated. No Next or Vercel build, sitemap, llms, release, deployment, checkout mutation, or Production mutation occurred.\n`)

console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, byBasis, specifications: specifications.length, ledger: ledgerCounts }))
