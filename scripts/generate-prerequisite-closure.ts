/**
 * Prerequisite closure: cohort, source packets, decisions and specifications.
 *
 * The cohort is derived from repaired dependency graph v3 and unified readiness
 * ledger v7 — every definition candidate that is unresolved and carries
 * incoming dependency fan-out. Its size is computed, never assumed.
 *
 * Writes only its own artifacts. It creates no ledger, touches no Tranche 23,
 * 24 or 25 file, and changes no existing decision.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { digestOf } from '../lib/federation/dependency-cascade-contract.ts'
import { HEALTH_DATA_CONSENT_SOURCES, DEFINITION_SCOPE } from '../lib/federation/health-data-consent-sources.ts'
import {
  CLEARED_DISTINCTIONS, HEALTH_DATA_CONSENT_DECISION, PUBLIC_REASON_COLLISION_SOURCE,
  REJECTED_INTERPRETATIONS, REMAINING_PREREQUISITE_DECISIONS,
} from '../lib/federation/prerequisite-closure.ts'

const OUT = 'content/federation'
const FROZEN_ON = '2026-09-07'
const read = (f: string) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8'))
const write = (name: string, body: Record<string, unknown>) =>
  writeFileSync(`${OUT}/${name}`, `${JSON.stringify({ ...body, provenanceDigest: digestOf(body) }, null, 2)}\n`)

const graph = read('federation-dependency-graph-v3.json')
const ledger = read('federation-unified-readiness-ledger-v7.json')
const map = read('federation-route-candidates-v5.json')

const state = new Map<string, string>(
  (ledger.entries as { candidateId: string; state: string }[]).map((e) => [e.candidateId, e.state]))
const inbound = new Map<string, number>()
for (const e of graph.edges as { dependsOn: string }[]) inbound.set(e.dependsOn, (inbound.get(e.dependsOn) ?? 0) + 1)

/* -- part 1: derive the cohort --------------------------------------------- */

type Candidate = { candidateId: string; conceptId: string; path: string; siteId: string; routeRole: string }

const cohort = (map.candidates as Candidate[])
  .filter((c) => c.routeRole === 'definition')
  .filter((c) => { const s = state.get(c.candidateId); return s !== undefined && s !== 'evidence-ready' })
  .filter((c) => (inbound.get(c.candidateId) ?? 0) > 0)
  .map((c) => ({ ...c, fanIn: inbound.get(c.candidateId)!, priorState: state.get(c.candidateId)! }))
  .sort((a, b) => b.fanIn - a.fanIn || (a.conceptId < b.conceptId ? -1 : 1))

/** Prerequisites that carry fan-out but are not candidates at all. */
const nonCandidatePrerequisites = (graph.missingOwnerTopicNodes as
  { nodeId: string; siteId: string; topic?: string; conceptId?: string }[])
  .filter((n) => (inbound.get(n.nodeId) ?? 0) > 0)
  .map((n) => ({
    nodeId: n.nodeId, siteId: n.siteId,
    concept: n.topic ?? n.conceptId?.split(':').pop() ?? 'unknown',
    fanIn: inbound.get(n.nodeId)!,
  }))
  .sort((a, b) => b.fanIn - a.fanIn || (a.concept < b.concept ? -1 : 1))

write('federation-prerequisite-cohort-v1.json', {
  schemaVersion: 'maha-federation-prerequisite-cohort/1.0',
  frozenOn: FROZEN_ON,
  derivation:
    'Every definition candidate that is unresolved in unified readiness ledger v7 and carries at least one ' +
    'incoming dependency edge in repaired dependency graph v3. Computed at generation time; the cohort size is ' +
    'not written into the generator.',
  boundExactlyTo: {
    dependencyGraph: graph.provenanceDigest,
    unifiedReadinessLedger: ledger.provenanceDigest,
    candidateMap: map.provenanceDigest,
  },
  counts: {
    frozenDefinitionCandidates: cohort.length,
    totalIncomingEdges: cohort.reduce((t, c) => t + c.fanIn, 0),
    nonCandidatePrerequisites: nonCandidatePrerequisites.length,
    nonCandidateIncomingEdges: nonCandidatePrerequisites.reduce((t, c) => t + c.fanIn, 0),
  },
  frozenCandidates: cohort,
  nonCandidatePrerequisites: {
    note:
      'Concepts that something depends on but which are not route candidates: 32 held as canonical graph objects ' +
      'by the Tranche 19 Model A decision, and 2 whose definitions v5 deleted. They cannot be frozen or reviewed ' +
      'as candidates because they are not candidates. They are listed so the fan-out they carry is visible.',
    entries: nonCandidatePrerequisites,
  },
  boundary:
    'Freezing records that these definitions are the prerequisites under review. It changes no state, creates no ' +
    'route, and confers nothing on any dependent.',
})

/* -- part 2: source-inspection packets ------------------------------------- */

const decisions = [HEALTH_DATA_CONSENT_DECISION, ...REMAINING_PREREQUISITE_DECISIONS]
  .map((d) => {
    const candidate = cohort.find((c) => c.conceptId === d.conceptId)
    if (!candidate) throw new Error(`${d.conceptId} was reviewed but is not in the derived cohort.`)
    return { ...d, fanIn: candidate.fanIn, priorState: candidate.priorState, candidateId: candidate.candidateId }
  })
  .sort((a, b) => (a.conceptId < b.conceptId ? -1 : 1))

if (decisions.length !== cohort.length) {
  throw new Error(`${cohort.length} candidates were frozen but ${decisions.length} were reviewed.`)
}

write('federation-prerequisite-source-packets-v1.json', {
  schemaVersion: 'maha-federation-prerequisite-source-packets/1.0',
  frozenOn: FROZEN_ON,
  purpose:
    'One packet per frozen prerequisite, recording what was inspected for it. A packet with no sources is a ' +
    'finding, not an omission: it records that the requirements were applied and not met.',
  requirements: ['sourceIdentity', 'locator', 'rights', 'scope', 'boundary'],
  packets: decisions.map((d) => ({
    conceptId: d.conceptId,
    path: d.path,
    sourcesInspected: d.conceptId === HEALTH_DATA_CONSENT_DECISION.conceptId
      ? HEALTH_DATA_CONSENT_SOURCES
      : d.conceptId === 'urn:maha:concept:autonomy:public-reason'
        ? [PUBLIC_REASON_COLLISION_SOURCE]
        : [],
    sourceCount: d.conceptId === HEALTH_DATA_CONSENT_DECISION.conceptId
      ? HEALTH_DATA_CONSENT_SOURCES.length
      : d.conceptId === 'urn:maha:concept:autonomy:public-reason' ? 1 : 0,
    requirementsMet: d.requirements,
    note: d.conceptId === 'urn:maha:concept:autonomy:public-reason'
      ? 'The single source establishes that the term is established in political philosophy. It does not define ' +
        'the authorial sense and cannot be cited as one, so the packet does not satisfy the requirements.'
      : undefined,
  })),
})

/* -- part 3: append-only decisions ----------------------------------------- */

const cleared = decisions.filter((d) => d.decision === 'evidence-ready')

write('federation-prerequisite-decisions-v1.json', {
  schemaVersion: 'maha-federation-prerequisite-decisions/1.0',
  frozenOn: FROZEN_ON,
  appendOnly: true,
  rule:
    'One decision per frozen candidate, each made on that candidate\'s own inspected sources. A decision binds the ' +
    'candidate it names and never travels along a dependency edge.',
  counts: {
    reviewed: decisions.length,
    evidenceReady: decisions.filter((d) => d.decision === 'evidence-ready').length,
    revise: decisions.filter((d) => d.decision === 'revise').length,
    blocked: decisions.filter((d) => d.decision === 'blocked').length,
    dependentsOfClearedDefinitions: cleared.reduce((t, d) => t + d.fanIn, 0),
    dependentsMadeEvidenceReady: 0,
  },
  noInheritance:
    `The cleared definitions carry ${cleared.reduce((t, d) => t + d.fanIn, 0)} dependents between them, and none ` +
    'of those dependents becomes evidence-ready. A definition establishes what a term means. It is not evidence ' +
    'for any claim a page makes using the term, and no dependent\'s state is changed by this artifact.',
  clearedDistinctions: CLEARED_DISTINCTIONS,
  rejectedInterpretations: REJECTED_INTERPRETATIONS,
  decisions,
})

/* -- part 4: specifications, only for evidence-ready definitions ----------- */

write('federation-prerequisite-page-specifications-v1.json', {
  schemaVersion: 'maha-federation-prerequisite-page-specifications/1.0',
  frozenOn: FROZEN_ON,
  rule: 'A specification is prepared only for a definition that reached evidence-ready. Nothing else gets one.',
  counts: { specifications: cleared.length, candidatesReviewed: decisions.length },
  specifications: cleared.map((d) => ({
    candidateId: d.candidateId,
    conceptId: d.conceptId,
    canonicalUrl: `https://os.mahastrategies.com${d.path}`,
    owningProperty: d.siteId,
    routeRole: 'definition',
    directAnswer:
      'Health-data consent, as this organisation uses the term, is the permission a person gives for their health ' +
      'data to be processed — distinct from an authorization document, from a privacy notice, and from the lawful ' +
      'basis that makes processing permissible at all.',
    evidenceSections: HEALTH_DATA_CONSENT_SOURCES.map((s) => ({
      instrument: s.instrument,
      locators: s.findings.map((f) => f.locator),
      jurisdiction: s.jurisdiction,
    })),
    limitationsAndNegativeSpace: [...REJECTED_INTERPRETATIONS, ...DEFINITION_SCOPE.mayNotEstablish],
    boundedQuestions: [
      'What is the difference between consent and authorization for health data?',
      'Does receiving a privacy notice mean permission was given?',
      'Is consent the only lawful basis for processing health data?',
      'Can consent be withdrawn, and does withdrawal undo prior processing?',
      'What happens when the person cannot consent in an emergency?',
      'Is research consent the same as product consent?',
    ],
    expectedCanonicalDependencies: [],
    boundary:
      'This specification describes one definition page. It is not a compliance claim, not legal advice, and not ' +
      'a specification for any of the routes that depend on this definition.',
  })),
})

console.log(
  `cohort ${cohort.length} frozen (+${nonCandidatePrerequisites.length} non-candidate prerequisites) | ` +
  `decisions ${decisions.length}: ${decisions.filter((d) => d.decision === 'evidence-ready').length} ready, ` +
  `${decisions.filter((d) => d.decision === 'revise').length} revise | ` +
  `specifications ${cleared.length} | dependents made ready 0`)
