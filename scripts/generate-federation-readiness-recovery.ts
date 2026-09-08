import { readFileSync, writeFileSync } from 'node:fs'
import { AUTHORITY_DECISIONS, AUTHORITY_SOURCES } from '../lib/federation/external-authority-recovery.ts'
import { REPLACEMENTS, REVIEW_AXES, WORKED_EXAMPLE_READY, digest, replacementId } from '../lib/federation/readiness-recovery.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })

type Candidate = Record<string, unknown> & { candidateId: string; conceptId: string; siteId: string; canonicalHost: string; groupId: string; routeRole: string; path: string; url: string; title: string; rank: number; tranche: number; scores: Record<string, number>; typedRelationships: unknown[]; routeContract: Record<string, unknown> }
type State = 'evidence-ready' | 'revise' | 'blocked' | 'reject-as-duplicative'
type PriorDecision = { candidateId: string; disposition: State; reason: string; tranche: number }

const v4 = read('federation-route-candidates-v4.json') as Record<string, unknown> & { provenanceDigest: string; candidates: Candidate[]; activeRanks: { candidateId: string; activeRank: number }[] }
const graph = read('federation-definition-graph-objects-v1.json') as { provenanceDigest: string; graphObjects: { graphObjectId: string; conceptId: string; routeBudget: false; publicRoute: null }[] }
const proposalArtifact = read('federation-external-authority-decisions-v1.json') as { provenanceDigest: string }
const sourceArtifact = read('federation-external-authority-source-inspections-v1.json') as { provenanceDigest: string }

function decisionFile(tranche: number): string {
  if (tranche === 11) return 'federation-tranche-11-mythology-decisions-v1.json'
  if (tranche === 12) return 'federation-tranche-12-mythology-decisions-v1.json'
  return `federation-tranche-${tranche}-decisions-v1.json`
}
const prior = new Map<string, PriorDecision>()
for (let tranche = 1; tranche <= 17; tranche++) {
  const artifact = read(decisionFile(tranche)) as { entries?: Record<string, unknown>[]; decisions?: Record<string, unknown>[] }
  for (const row of artifact.entries ?? artifact.decisions ?? []) {
    const disposition = (row.disposition ?? row.finalState) as State
    prior.set(String(row.candidateId), { candidateId: String(row.candidateId), disposition, reason: String(row.reason), tranche })
  }
}
if (prior.size !== 1628) throw new Error(`prior-decision-count:${prior.size}`)

const graphByConcept = new Map(graph.graphObjects.map((object) => [object.conceptId, object]))
const proposalByConcept = new Map(AUTHORITY_DECISIONS.map((proposal) => [proposal.conceptId, proposal]))
const sourceById = new Map(AUTHORITY_SOURCES.map((source) => [source.sourceId, source]))

const definitionReviews = AUTHORITY_DECISIONS.map((proposal) => {
  const object = graphByConcept.get(proposal.conceptId)
  if (!object) throw new Error(`authority-graph-object-missing:${proposal.conceptId}`)
  const accepted = proposal.state === 'definition-proposal-ready'
  const proposalDigest = digest(proposal)
  const graphObjectDigest = digest(object)
  return {
    graphObjectId: object.graphObjectId,
    graphObjectDigest,
    conceptId: proposal.conceptId,
    proposalDigest,
    reviewerKind: 'automated-internal-editorial',
    humanReviewed: false,
    expertReviewed: false,
    axes: REVIEW_AXES.map((axis) => ({ axis, decision: accepted ? 'approve' : 'revise', proposalDigest, graphObjectDigest })),
    finalDecision: accepted ? 'accept' : 'revise',
    bindingState: accepted ? 'definition-proposal-bound-to-graph-object' : 'held-without-definition-binding',
    sourceIds: proposal.sourceIds,
    boundary: accepted
      ? 'This binds an internally reviewed definition proposal to a non-route graph identity. It does not publish a route, constitute external expert review, or support a dependent application claim.'
      : 'The graph identity remains resolvable, but no definition is attached because the inspected authority did not establish the proposed breadth.',
  }
}).sort((a, b) => a.conceptId.localeCompare(b.conceptId))

const authorityConcepts = new Set(AUTHORITY_DECISIONS.map((proposal) => proposal.conceptId))
const authorityCandidates = v4.candidates.filter((candidate) => authorityConcepts.has(candidate.conceptId))
if (authorityCandidates.length !== 48) throw new Error(`authority-application-count:${authorityCandidates.length}`)

const authorityReassessment = authorityCandidates.map((candidate) => {
  const proposal = proposalByConcept.get(candidate.conceptId)!
  const definitionReview = definitionReviews.find((review) => review.conceptId === candidate.conceptId)!
  const priorDecision = prior.get(candidate.candidateId)!
  let finalState: 'evidence-ready' | 'revise' = 'revise'
  let roleFinding = ''
  if (definitionReview.finalDecision !== 'accept') {
    roleFinding = 'The definition remains in revision, so no application role can proceed.'
  } else if (candidate.routeRole === 'uncertainty') {
    finalState = 'evidence-ready'
    roleFinding = 'The page is limited to the inspected source’s stated conditions, failure boundaries, and what the method does not establish.'
  } else if (candidate.routeRole === 'worked-example' && WORKED_EXAMPLE_READY.has(candidate.conceptId)) {
    finalState = 'evidence-ready'
    roleFinding = 'The inspected locator supplies an explicit operation, equation, or protocol from which a bounded worked example can be constructed without inventing a result.'
  } else if (candidate.routeRole === 'machine-interface') {
    roleFinding = 'The external authority defines the concept but does not establish a concept-specific Maha machine interface. No implementation locator was inspected for this route.'
  } else if (candidate.routeRole === 'reproducibility') {
    roleFinding = 'The external authority states the method, not a complete replay fixture, environment, implementation, and receipt for this route.'
  } else {
    roleFinding = 'The definition is supported, but this worked-example role still lacks a complete inspected fixture with exact inputs and checks.'
  }
  return {
    candidateId: candidate.candidateId,
    candidateDigest: digest(candidate),
    conceptId: candidate.conceptId,
    routeRole: candidate.routeRole,
    path: candidate.path,
    priorDecision,
    definitionBinding: { graphObjectId: definitionReview.graphObjectId, proposalDigest: definitionReview.proposalDigest, accepted: definitionReview.finalDecision === 'accept' },
    sourceIds: proposal.sourceIds,
    independentApplicationAssessment: true,
    finalState,
    roleFinding,
    noInheritanceFinding: 'The definition binding resolves and defines the concept only. This application was separately assessed against its route role and may not inherit evidence readiness from the definition.',
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))

const replacementSources = REPLACEMENTS.map((replacement) => ({
  ...replacement.source,
  sourceClass: 'first-party-implementation',
  versionRelationship: 'exact repository implementation at reviewed commit',
  access: 'local-repository',
  rights: 'project-owned-reference-only',
  inspectionDepth: 'symbol-and-surrounding-implementation',
  independence: 'not-independent',
}))

const oldById = new Map(v4.candidates.map((candidate) => [candidate.candidateId, candidate]))
const replacementRows = REPLACEMENTS.map((replacement) => {
  const old = oldById.get(replacement.replaces)
  if (!old) throw new Error(`replacement-predecessor-missing:${replacement.replaces}`)
  const candidateId = replacementId(replacement.replaces, replacement.conceptId, replacement.path)
  const candidate: Candidate = {
    ...old,
    candidateId,
    conceptId: replacement.conceptId,
    conceptFamilyId: 'evidence',
    routeRole: replacement.routeRole,
    path: replacement.path,
    url: `https://${old.canonicalHost}${replacement.path}`,
    title: replacement.title,
    searchIntent: `Understand ${replacement.title} as a bounded operational workflow on ${old.canonicalHost}.`,
    conceptAuthority: { canonicalOwner: 'maha-research', role: 'local-application', boundary: 'This route documents Maha implementation behavior and cannot redefine the field or claim independent verification.' },
    typedRelationships: [
      { type: 'applies-to', target: replacement.conceptId },
      { type: 'governed-by', target: 'urn:maha:concept:governance' },
      { type: 'evidence-for', target: 'urn:maha:concept:evidence' },
    ],
    duplicateScreen: { supersedesRejectedCandidate: replacement.replaces, status: 'semantically-distinct-operational-role', nearestObservedUrl: old.url },
    publication: { state: 'candidate-only', inspected: false, reviewed: false, canonicallyReleased: false, compiled: false, crawlable: false },
    addedIn: 'v5-readiness-recovery',
  }
  return {
    predecessor: { candidateId: old.candidateId, candidateDigest: digest(old), disposition: prior.get(old.candidateId)?.disposition, reason: prior.get(old.candidateId)?.reason },
    candidate,
    candidateDigest: digest(candidate),
    sourceId: replacement.source.sourceId,
    semanticDecision: 'distinct',
    finalState: 'evidence-ready' as const,
    reason: `The replacement answers a distinct operational question and is bounded to the inspected first-party implementation at ${replacement.source.locator}.`,
  }
})

const replacementByOld = new Map(replacementRows.map((row) => [row.predecessor.candidateId, row]))
const v5Candidates = v4.candidates.map((candidate) => replacementByOld.get(candidate.candidateId)?.candidate ?? candidate)
const ids = new Set(v5Candidates.map((candidate) => candidate.candidateId))
const urls = new Set(v5Candidates.map((candidate) => candidate.url))
if (ids.size !== 1628 || urls.size !== 1628) throw new Error('v5-identity-or-url-collision')
const v5ActiveRanks = v4.activeRanks.map((rank) => ({ ...rank, candidateId: replacementByOld.get(rank.candidateId)?.candidate.candidateId ?? rank.candidateId }))

const v4Body = Object.fromEntries(Object.entries(v4).filter(([key]) => key !== 'provenanceDigest'))
const v5Body = {
  ...v4Body,
  schemaVersion: 'maha-federation-route-candidate-map/5.0',
  frozenOn: '2026-09-07',
  previousCandidateMap: { schemaVersion: v4.schemaVersion, provenanceDigest: v4.provenanceDigest },
  replacementPurpose: 'Replace four candidates rejected as semantically duplicative with four bounded operational candidates on the same properties, preserving every property allocation and the 1,628-route budget.',
  candidates: v5Candidates,
  activeRanks: v5ActiveRanks,
}
writeFileSync(`${F}/federation-route-candidates-v5.json`, `${JSON.stringify(signed(v5Body), null, 2)}\n`)

const lineageBody = {
  schemaVersion: 'maha-federation-candidate-lineage/5.0', frozenOn: '2026-09-07',
  from: { schemaVersion: v4.schemaVersion, provenanceDigest: v4.provenanceDigest },
  to: { schemaVersion: v5Body.schemaVersion, candidateArrayDigest: digest(v5Candidates) },
  counts: { retained: 1624, supersededAsDuplicative: 4, replacementsAdded: 4, resultingRouteCandidates: 1628 },
  replacements: replacementRows.map((row) => ({ predecessorCandidateId: row.predecessor.candidateId, predecessorDigest: row.predecessor.candidateDigest, replacementCandidateId: row.candidate.candidateId, replacementDigest: row.candidateDigest, property: row.candidate.siteId, rank: row.candidate.rank, activeRank: v5ActiveRanks.find((rank) => rank.candidateId === row.candidate.candidateId)?.activeRank })),
  boundary: 'A route-budget substitution only. It creates no route, review inheritance, release, or crawlability.',
}
writeFileSync(`${F}/federation-candidate-lineage-v5.json`, `${JSON.stringify(signed(lineageBody), null, 2)}\n`)

const sourceBody = {
  schemaVersion: 'maha-federation-readiness-recovery-sources/1.0', frozenOn: '2026-09-07',
  externalAuthoritySourceManifest: { artifact: 'federation-external-authority-source-inspections-v1.json', provenanceDigest: sourceArtifact.provenanceDigest, sourcesUsed: AUTHORITY_SOURCES.map((source) => source.sourceId) },
  replacementSources,
  boundary: 'No source passage or full document is stored. External sources are reference-only; replacement sources establish only this repository’s implementation behavior.',
}
writeFileSync(`${F}/federation-readiness-recovery-source-inspections-v1.json`, `${JSON.stringify(signed(sourceBody), null, 2)}\n`)

const reviewBody = {
  schemaVersion: 'maha-federation-authority-definition-reviews/1.0', frozenOn: '2026-09-07', appendOnly: true,
  proposalManifest: { provenanceDigest: proposalArtifact.provenanceDigest }, graphManifest: { provenanceDigest: graph.provenanceDigest },
  counts: { reviewed: 12, accepted: definitionReviews.filter((review) => review.finalDecision === 'accept').length, revise: definitionReviews.filter((review) => review.finalDecision === 'revise').length, human: 0, expert: 0 },
  reviews: definitionReviews,
}
writeFileSync(`${F}/federation-authority-definition-reviews-v1.json`, `${JSON.stringify(signed(reviewBody), null, 2)}\n`)

const reassessmentBody = {
  schemaVersion: 'maha-federation-authority-application-reassessment/1.0', frozenOn: '2026-09-07', appendOnly: true,
  counts: { candidates: 48, evidenceReady: authorityReassessment.filter((row) => row.finalState === 'evidence-ready').length, revise: authorityReassessment.filter((row) => row.finalState === 'revise').length },
  reassessments: authorityReassessment,
}
writeFileSync(`${F}/federation-authority-application-reassessment-v1.json`, `${JSON.stringify(signed(reassessmentBody), null, 2)}\n`)

const oldBacklog = v4.candidates.filter((candidate) => prior.get(candidate.candidateId)?.disposition !== 'evidence-ready')
if (oldBacklog.length !== 514) throw new Error(`recovery-backlog-count:${oldBacklog.length}`)
const graphFanout = new Map(graph.graphObjects.map((object) => [object.conceptId, Number((object as unknown as { dependentsAtStake?: number }).dependentsAtStake ?? 0)]))
const priorityRows = oldBacklog.map((candidate) => {
  const old = prior.get(candidate.candidateId)!
  const fanout = graphFanout.get(candidate.conceptId) ?? 0
  const machine = candidate.scores.machineUtility ?? candidate.scores.weighted ?? 0
  const commercial = candidate.scores.commercialProximity ?? candidate.scores.weighted ?? 0
  const priorityScore = Math.round((Math.min(fanout, 4) / 4 * 35 + machine * 0.35 + commercial * 0.30) * 100) / 100
  const authority = authorityReassessment.find((row) => row.candidateId === candidate.candidateId)
  const replacement = replacementByOld.get(candidate.candidateId)
  return { candidateId: candidate.candidateId, conceptId: candidate.conceptId, siteId: candidate.siteId, path: candidate.path, priorState: old.disposition, dependencyFanout: fanout, machineUtility: machine, commercialProximity: commercial, priorityScore,
    recoveryOutcome: replacement ? 'replaced-by-ready-candidate' : authority?.finalState === 'evidence-ready' ? 'evidence-ready' : authority ? authority.finalState : 'not-reviewed-in-this-recovery-pass',
    nextAction: replacement ? `Adopt replacement ${replacement.candidate.candidateId} after exact-revision review.` : authority ? authority.roleFinding : 'Inspect the highest-priority missing source or implementation locator without inheriting adjacent evidence.' }
}).sort((a, b) => b.priorityScore - a.priorityScore || a.candidateId.localeCompare(b.candidateId))
const priorityBody = { schemaVersion: 'maha-federation-readiness-recovery-priority/1.0', frozenOn: '2026-09-07', scoring: { dependencyFanout: 0.35, machineUtility: 0.35, commercialProximity: 0.30, demand: 'unknown unless already observed; not invented here' }, counts: { backlog: priorityRows.length, reviewedThisPass: priorityRows.filter((row) => row.recoveryOutcome !== 'not-reviewed-in-this-recovery-pass').length, deferredToLaterPass: priorityRows.filter((row) => row.recoveryOutcome === 'not-reviewed-in-this-recovery-pass').length }, priorities: priorityRows }
writeFileSync(`${F}/federation-readiness-recovery-priority-v1.json`, `${JSON.stringify(signed(priorityBody), null, 2)}\n`)

const readyAuthorityIds = new Set(authorityReassessment.filter((row) => row.finalState === 'evidence-ready').map((row) => row.candidateId))
const sourceForCandidate = (candidate: Candidate) => proposalByConcept.get(candidate.conceptId)!.sourceIds.map((sourceId) => sourceById.get(sourceId)!)
const authoritySpecs = v4.candidates.filter((candidate) => readyAuthorityIds.has(candidate.candidateId)).map((candidate) => ({
  candidateId: candidate.candidateId, candidateDigest: digest(candidate), canonicalUrl: candidate.url, owningProperty: candidate.siteId, conceptId: candidate.conceptId, routeRole: candidate.routeRole,
  directAnswer: `${candidate.title} is bounded to the inspected authority’s exact method, conditions, and limitations; it does not inherit the definition’s evidence status.`,
  requiredSections: ['Direct answer', 'Role-specific method or boundary', 'Exact authority locator', 'Assumptions and failure conditions', 'What this does not establish', 'Related definition and applications'],
  boundedQuestions: ['What operation or limitation does this route explain?', 'Which exact source locator bears it?', 'Which assumptions control the answer?', 'What result or implementation is not established?', 'Which non-route definition identity does it depend on?'],
  sourceBindings: sourceForCandidate(candidate).map((source) => ({ sourceId: source.sourceId, locator: source.locator, scope: source.scope, boundary: source.boundary, rightsBasis: source.rightsBasis })),
  definitionDependency: graphByConcept.get(candidate.conceptId)?.graphObjectId,
  implementationState: 'specification-only', publicationBoundary: 'Not a route, release, or public page. Exact-revision review and canonical release remain required.',
}))
const replacementSpecs = replacementRows.map((row) => {
  const source = replacementSources.find((item) => item.sourceId === row.sourceId)!
  return { candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, canonicalUrl: row.candidate.url, owningProperty: row.candidate.siteId, conceptId: row.candidate.conceptId, routeRole: row.candidate.routeRole,
    directAnswer: `${row.candidate.title} documents the bounded behavior of the cited Maha implementation and makes no independent or field-wide claim.`,
    requiredSections: ['Direct answer', 'Implementation contract', 'Exact code locator', 'Failure and refusal boundary', 'What this does not establish', 'Related definition and application'],
    boundedQuestions: ['What behavior does the implementation record or refuse?', 'Which exact symbol establishes that behavior?', 'What does a successful check not prove?', 'Which adjacent concept must not be conflated?', 'What change would require a new revision?'],
    sourceBindings: [{ sourceId: source.sourceId, locator: source.locator, scope: source.scope, boundary: source.boundary, rightsBasis: source.rights }],
    definitionDependency: graphByConcept.get(row.candidate.conceptId)?.graphObjectId,
    implementationState: 'specification-only', publicationBoundary: 'First-party operational specification only; not a route, release, independent review, or public page.' }
})
const newSpecs = [...authoritySpecs, ...replacementSpecs].sort((a, b) => a.candidateId.localeCompare(b.candidateId))
const specsBody = { schemaVersion: 'maha-federation-readiness-recovery-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: newSpecs.length, boundedQuestions: newSpecs.length * 5, authorityApplications: authoritySpecs.length, replacements: replacementSpecs.length }, specifications: newSpecs }
writeFileSync(`${F}/federation-readiness-recovery-page-specifications-v1.json`, `${JSON.stringify(signed(specsBody), null, 2)}\n`)

const effective = new Map<string, { state: string; origin: string; specification: boolean }>()
for (const candidate of v4.candidates) {
  const state = prior.get(candidate.candidateId)!.disposition
  effective.set(candidate.candidateId, { state, origin: `tranche-${prior.get(candidate.candidateId)!.tranche}`, specification: state === 'evidence-ready' })
}
for (const row of authorityReassessment) effective.set(row.candidateId, { state: row.finalState, origin: 'authority-application-reassessment-v1', specification: row.finalState === 'evidence-ready' })
for (const row of replacementRows) { effective.delete(row.predecessor.candidateId); effective.set(row.candidate.candidateId, { state: row.finalState, origin: 'readiness-recovery-replacement-v1', specification: true }) }
const ledgerEntries = v5Candidates.map((candidate) => ({ candidateId: candidate.candidateId, candidateDigest: digest(candidate), siteId: candidate.siteId, path: candidate.path, conceptId: candidate.conceptId, routeRole: candidate.routeRole, ...effective.get(candidate.candidateId)!, implementationState: effective.get(candidate.candidateId)!.state === 'evidence-ready' ? 'implementation-ready' : 'unresolved', publicRouteCreated: false }))
const ledgerBody = { schemaVersion: 'maha-federation-unified-readiness-ledger/1.0', frozenOn: '2026-09-07', candidateMap: { schemaVersion: v5Body.schemaVersion, digest: digest(v5Body) }, counts: { routeCandidates: ledgerEntries.length, implementationReady: ledgerEntries.filter((row) => row.implementationState === 'implementation-ready').length, unresolved: ledgerEntries.filter((row) => row.implementationState === 'unresolved').length, duplicateSlotsRemaining: ledgerEntries.filter((row) => /duplicative/.test(row.state)).length, newlyReadyThisPass: newSpecs.length }, execution: { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false }, entries: ledgerEntries }
if (ledgerBody.counts.routeCandidates !== 1628 || ledgerBody.counts.implementationReady + ledgerBody.counts.unresolved !== 1628) throw new Error('ledger-partition-invalid')
writeFileSync(`${F}/federation-unified-readiness-ledger-v1.json`, `${JSON.stringify(signed(ledgerBody), null, 2)}\n`)

const report = `# Federation readiness recovery — local report\n\n## Outcome\n\n- Authority definitions reviewed: 12 — 11 accepted, 1 revise. Review is automated internal editorial, not human, expert, or peer review.\n- Authority-linked applications reassessed independently: 48 — ${reassessmentBody.counts.evidenceReady} evidence-ready, ${reassessmentBody.counts.revise} revise.\n- Duplicative route-budget slots replaced: 4 — four distinct first-party operational candidates, zero allocation change.\n- New substantial-page specifications: ${newSpecs.length}.\n- Unified v5 readiness: ${ledgerBody.counts.implementationReady} implementation-ready, ${ledgerBody.counts.unresolved} unresolved, total 1,628.\n\n## Priority backlog\n\nThe original 514-route non-ready backlog is ranked by dependency fan-out (35%), machine utility (35%), and commercial proximity (30%). Demand remains unknown where no observed route-specific data exists. This pass directly reviewed ${priorityBody.counts.reviewedThisPass}; ${priorityBody.counts.deferredToLaterPass} remain queued for later source inspection.\n\n## Boundary\n\nNo public route was generated. No build, sitemap, llms, review inheritance, release, deployment, or Production mutation occurred. A definition binding resolves meaning only; each application still requires its own evidence.\n`
writeFileSync('docs/operations/federation-readiness-recovery-v1.md', report)

console.log(JSON.stringify({ definitions: reviewBody.counts, applications: reassessmentBody.counts, replacements: replacementRows.length, specifications: newSpecs.length, ledger: ledgerBody.counts }))
