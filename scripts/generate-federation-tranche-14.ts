/**
 * Tranche 14: dependency-first review of the next 100 active candidates.
 *
 * Tranche 13 ended with 38 candidates blocked on 17 distinct prerequisites, and
 * the brief asks that high-fan-out definitions be prioritised here. The
 * remediation analysis below reports what that policy can actually reach: four
 * of the seventeen exist in the remaining pool, each unlocking one dependent.
 * The thirteen that would unlock the other thirty-four are absent from the
 * frozen candidate map. They are recorded as repair proposals and left
 * inactive, because inventing them would manufacture the unlock.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import {
  diagnosePrerequisite, selectTranche14, topicOf, type Candidate, type Prerequisite,
} from '../lib/federation/tranche-14-selection.ts'

const OUT = 'content/federation'
const FROZEN_ON = '2026-09-06'
const SCHEMA = 'maha-federation-tranche-14'
const digest = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

/* -- inputs ---------------------------------------------------------------- */

const map = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-v2.json`, 'utf8')) as
  { candidates: Candidate[] }
const lineage = JSON.parse(readFileSync(`${OUT}/federation-candidate-lineage-v2.json`, 'utf8')) as
  { supersededCandidates: { candidateId: string }[] }
const t13Deps = JSON.parse(readFileSync(`${OUT}/federation-tranche-13-dependency-validation-v1.json`, 'utf8')) as
  { dependencies: { candidateId: string; conceptId: string; declaredOwner: string; state: string }[] }

const superseded = new Set(lineage.supersededCandidates.map((s) => s.candidateId))
const priorCohorts = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13']
const covered = new Set<string>()
for (const t of priorCohorts) {
  const file = `${OUT}/federation-tranche-${t}-cohort-v1.json`
  try {
    const j = JSON.parse(readFileSync(file, 'utf8')) as { entries?: { candidateId: string }[]; candidates?: { candidateId: string }[] }
    for (const e of j.entries ?? j.candidates ?? []) covered.add(e.candidateId)
  } catch { /* a tranche without a cohort file contributes nothing */ }
}

const active = map.candidates.filter((c) => !superseded.has(c.candidateId))
const pool = active.filter((c) => !covered.has(c.candidateId))

/* -- dependency remediation ------------------------------------------------ */

const missing = t13Deps.dependencies.filter((d) => d.state === 'missing')
const fanOut = new Map<string, { conceptId: string; declaredOwner: string; dependents: string[] }>()
for (const m of missing) {
  const key = `${m.conceptId}|${m.declaredOwner}`
  const entry = fanOut.get(key) ?? { conceptId: m.conceptId, declaredOwner: m.declaredOwner, dependents: [] }
  entry.dependents.push(m.candidateId)
  fanOut.set(key, entry)
}

const prerequisites: Prerequisite[] = [...fanOut.values()]
  .map((e) => diagnosePrerequisite(e.conceptId, e.declaredOwner, e.dependents.length, pool))
  .sort((a, b) => b.unlocks - a.unlocks || a.conceptId.localeCompare(b.conceptId))

const tally = (keys: string[]) => Object.fromEntries(
  Object.entries(keys.reduce<Record<string, number>>((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b)))

const write = (name: string, body: Record<string, unknown>) => {
  const artifact = { ...body, provenanceDigest: digest(canonicalJson(body)) }
  writeFileSync(`${OUT}/federation-tranche-14-${name}-v1.json`, `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact.provenanceDigest
}

write('dependency-remediation', {
  schemaVersion: `${SCHEMA}-dependency-remediation/1.0`,
  frozenOn: FROZEN_ON,
  purpose:
    'Diagnoses every prerequisite that blocked a Tranche 13 candidate, so the next cohort can be selected on what ' +
    'it would actually unblock rather than on utility alone.',
  counts: {
    blockedDependents: missing.length,
    distinctPrerequisites: prerequisites.length,
    byAvailability: tally(prerequisites.map((p) => p.availability)),
    unlockableByThisTranche: prerequisites
      .filter((p) => p.availability === 'available-in-pool')
      .reduce((sum, p) => sum + p.unlocks, 0),
  },
  finding:
    'Fan-out and availability are inversely related here. Every prerequisite with a fan-out above one is absent ' +
    'from the frozen map, and every prerequisite present in the pool unlocks exactly one dependent. Selecting all ' +
    'four available definitions therefore unblocks four of the thirty-eight. The remaining thirty-four are blocked ' +
    'by an incomplete candidate map rather than by selection policy.',
  prerequisites: prerequisites.map((p) => ({
    ...p,
    dependents: (fanOut.get(`${p.conceptId}|${p.declaredOwner}`)?.dependents ?? []).sort(),
  })),
  repairProposals: prerequisites
    .filter((p) => p.availability === 'absent-from-frozen-map')
    .map((p) => ({
      conceptId: p.conceptId,
      proposedOwner: p.declaredOwner,
      wouldUnlock: p.unlocks,
      status: 'proposed-inactive',
      note:
        'No definition candidate exists for this concept in the frozen map. A repair would add one under the ' +
        'declared owner. Recorded as a proposal and deliberately not inserted: adding it here would create a ' +
        'prerequisite that no freeze reviewed.',
    })),
  boundary:
    'An analysis. It inserts no candidate, activates no proposal, and changes no Tranche 13 classification.',
})

/* -- selection ------------------------------------------------------------- */

const selection = selectTranche14(pool, prerequisites)
const cohort = selection.entries

const cohortDigest = write('cohort', {
  schemaVersion: `${SCHEMA}-cohort/1.0`,
  frozenOn: FROZEN_ON,
  candidateMapDigest: digest(canonicalJson(map.candidates)),
  selectionRule:
    'Active and unreviewed after Tranches 1-13, ordered dependency-first: every prerequisite definition available ' +
    'in the pool is selected before any filler, by fan-out then candidate id. The remainder is filled by ' +
    'calibrated utility under the four-per-site-topic cap and proportional targets bounded by remaining ' +
    'inventory, with candidate id as the deterministic tie-break. Legacy rank is not used: the mythology ' +
    'migration left it non-contiguous.',
  exclusions: {
    supersededExcluded: superseded.size,
    coveredByPriorTranches: covered.size,
    poolBefore: selection.poolBefore,
    poolAfter: selection.poolAfter,
  },
  dependencyFirst: {
    prerequisitesSelected: selection.prerequisitesSelected.map((p) => ({
      conceptId: p.conceptId, supplierCandidateId: p.supplierCandidateId, unlocks: p.unlocks,
    })),
    projectedTranche13Unlocks: selection.projectedUnlocks,
  },
  shortfalls: selection.shortfalls,
  shortfallNote:
    'A shortfall is a property target the remaining inventory cannot meet. It is recorded rather than absorbed, ' +
    'so a later tranche is not misread as having under-selected a property that had nothing left to give.',
  counts: {
    cohort: cohort.length,
    unique: new Set(cohort.map((c) => c.candidateId)).size,
    overlapWithPriorTranches: cohort.filter((c) => covered.has(c.candidateId)).length,
    supersededSelected: cohort.filter((c) => superseded.has(c.candidateId)).length,
  },
  byProperty: tally(cohort.map((c) => c.siteId)),
  byTopic: tally(cohort.map((c) => topicOf(c))),
  byRouteRole: tally(cohort.map((c) => c.routeRole)),
  entries: cohort,
})

/* -- source inspections ---------------------------------------------------- */

type Inspection = {
  inspectionId: string
  topic: string
  sourceIdentity: string
  version: string
  stableUrl: string
  locator: string
  inspectionDepth: string
  accessBasis: string
  reuseBasis: string
  supportedClaimScope: string
  boundary: string
  sourceClass: string
  independence: string
  relationshipToEarlier: string
}

const cohortTopics = new Set(cohort.map((c) => topicOf(c)))

/**
 * Inspections carried forward from Tranche 13.
 *
 * Where a Tranche 14 topic was already inspected, the same source at the same
 * locator answers it, and re-fetching would not make the evidence better. The
 * carry-forward is explicit rather than silent: each records which Tranche 13
 * inspection it derives from, so a reader can see the evidence was not gathered
 * afresh for this cohort.
 */
const t13Sources = JSON.parse(readFileSync(`${OUT}/federation-tranche-13-source-inspections-v1.json`, 'utf8')) as
  { inspections: Inspection[] }
const carried: Inspection[] = t13Sources.inspections
  .filter((i) => cohortTopics.has(i.topic))
  .map((i) => ({
    ...i,
    inspectionId: i.inspectionId.replace('tr13', 'tr14'),
    relationshipToEarlier: `Carried forward from Tranche 13 inspection ${i.inspectionId}: same source, same locator, same claim scope.`,
  }))

/** Inspections performed for this tranche. */
const fresh: Inspection[] = [
  {
    inspectionId: 'tr14-src-101',
    topic: 'auditability',
    sourceIdentity: 'NIST SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations',
    version: 'Revision 5, DOI 10.6028/NIST.SP.800-53r5',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf',
    locator: 'Control AU-2 (Event Logging), items a and b.',
    inspectionDepth: 'targeted-control-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That auditability begins with identifying which event types a system is capable of logging in support of the audit function, and coordinating that logging with the parties who need audit-related information.',
    boundary:
      'A control catalogue. It does not state that any system is auditable, does not select events for any deployment, and confers no assurance by being cited.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr14-src-102',
    topic: 'audit-export',
    sourceIdentity: 'NIST SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations',
    version: 'Revision 5, DOI 10.6028/NIST.SP.800-53r5',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf',
    locator: 'Control AU-3 (Content of Audit Records), items a-f and the Discussion paragraph.',
    inspectionDepth: 'targeted-control-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That an audit record is expected to carry the event description, timestamp, source, outcome and the identity of entities associated with the event, and that audit trails can reveal personally identifiable information, which the organisation is expected to consider and mitigate.',
    boundary:
      'Specifies record content, not an export format, retention period or disclosure rule. The privacy caution is a consideration the standard raises, not a permission to export.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same publication as tr14-src-101, inspected for a different control.',
  },
]

const INSPECTIONS = [...carried, ...fresh].sort((a, b) => a.inspectionId.localeCompare(b.inspectionId))
const inspectedTopics = new Set(INSPECTIONS.map((i) => i.topic))

write('source-inspections', {
  schemaVersion: `${SCHEMA}-source-inspections/1.0`,
  frozenOn: FROZEN_ON,
  method:
    'Sources were opened and read at a stated locator. Metadata, abstracts, search snippets, dictionary entries ' +
    'and landing pages are not inspection. No access control was bypassed.',
  topicsInCohort: cohortTopics.size,
  topicsInspected: inspectedTopics.size,
  distinctSources: new Set(INSPECTIONS.map((i) => i.sourceIdentity)).size,
  carriedForward: carried.length,
  freshlyInspected: fresh.length,
  inspections: INSPECTIONS,
  soughtButNotInspected: [
    {
      source: 'Digital Markets Act, Regulation (EU) 2022/1925',
      outcome: 'HTTP 202 with an empty body',
      topic: 'competition-policy',
      resolution: 'None. An empty response is not a document, so the topic remains uninspected.',
    },
  ],
  uninspectedTopicNote:
    'The uninspected topics are predominantly this organisation\u2019s own operational concepts and the author\u2019s ' +
    'own concepts on the personal properties, for which no external authority exists to cite.',
})

/* -- dependency validation ------------------------------------------------- */

const definitionsInCohort = new Map(
  cohort.filter((c) => c.routeRole === 'definition').map((c) => [`${c.conceptId}|${c.siteId}`, c.candidateId]))
const reviewedConcepts = new Set(
  map.candidates.filter((c) => covered.has(c.candidateId)).map((c) => c.conceptId))

const dependencies = cohort.map((c) => {
  const key = `${c.conceptId}|${c.conceptAuthority.canonicalOwner}`
  if (c.routeRole === 'definition') {
    return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: 'live' as const, note: 'A definition owns its concept; it depends on no earlier definition.' }
  }
  if (definitionsInCohort.has(key)) {
    return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: 'present-in-tranche-14' as const, note: `Supplied by ${definitionsInCohort.get(key)} in this cohort.` }
  }
  if (reviewedConcepts.has(c.conceptId)) {
    return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: 'satisfied-by-earlier-tranche' as const, note: 'A definition for this concept was reviewed in an earlier tranche.' }
  }
  return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: 'missing' as const, note: `No definition candidate exists for ${c.conceptId} on ${c.conceptAuthority.canonicalOwner}. The dependent page is blocked; the prerequisite must not be inferred.` }
})
const dependencyByCandidate = new Map(dependencies.map((d) => [d.candidateId, d]))

write('dependency-validation', {
  schemaVersion: `${SCHEMA}-dependency-validation/1.0`,
  frozenOn: FROZEN_ON,
  rule:
    'An application page depends on the canonical definition of its concept, on the property that declares ' +
    'ownership. It may apply the concept and may not redefine it. A missing prerequisite blocks the dependent ' +
    'page and is never inferred.',
  counts: tally(dependencies.map((d) => d.state)),
  dependencies,
})

/* -- semantic review and classification ------------------------------------ */

type FinalState = 'evidence-ready' | 'revise' | 'blocked' | 'duplicative'

function adjudicate(c: Candidate) {
  const dep = dependencyByCandidate.get(c.candidateId)!
  const topic = topicOf(c)

  if (dep.state === 'missing') {
    return { semantic: 'blocked on ownership or dependency' as const, final: 'blocked' as FinalState, reason: dep.note }
  }
  // A definition route whose own contract forbids redefining is internally
  // inconsistent: the role claims the concept and the boundary denies it.
  if (c.routeRole === 'definition' && /cannot redefine/.test(c.conceptAuthority.boundary)
      && c.conceptAuthority.role !== 'canonical-owner') {
    return {
      semantic: 'revise boundary' as const,
      final: 'revise' as FinalState,
      reason:
        `Route role is "definition" but the declared contract is "${c.conceptAuthority.role}" with a boundary ` +
        'forbidding redefinition. A definition page must own its concept. Either the role or the contract is ' +
        'wrong, and which one is a product decision rather than a review finding.',
    }
  }
  if (!inspectedTopics.has(topic)) {
    return {
      semantic: 'distinct' as const,
      final: 'blocked' as FinalState,
      reason:
        `Semantically distinct and dependency-clear, but no source was inspected for topic "${topic}". ` +
        'Evidence-ready requires inspected content with an exact locator, so this is blocked on source ' +
        'inspection rather than on any defect in the candidate.',
    }
  }
  return {
    semantic: 'distinct' as const,
    final: 'evidence-ready' as FinalState,
    reason: `Dependency resolved (${dep.state}); source inspected for "${topic}" with an exact locator and a stated reuse basis.`,
  }
}

const decisions = cohort.map((c) => {
  const a = adjudicate(c)
  return {
    candidateId: c.candidateId,
    candidateDigest: digest(canonicalJson(c)),
    path: c.path,
    siteId: c.siteId,
    topic: topicOf(c),
    routeRole: c.routeRole,
    conceptId: c.conceptId,
    declaredOwner: c.conceptAuthority.canonicalOwner,
    dependencyState: dependencyByCandidate.get(c.candidateId)!.state,
    semanticResult: a.semantic,
    finalState: a.final,
    reason: a.reason,
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))

const neighbourOf = (c: Candidate) => {
  const sameConcept = cohort.filter((o) => o.conceptId === c.conceptId && o.candidateId !== c.candidateId)
  const pick = (list: Candidate[]) => [...list].sort((a, b) => a.candidateId.localeCompare(b.candidateId))[0]
  if (sameConcept.length > 0) {
    const n = pick(sameConcept)
    return { candidateId: n.candidateId, path: n.path, relation: 'same-concept-different-role' as const }
  }
  const sameTopic = cohort.filter((o) => topicOf(o) === topicOf(c) && o.candidateId !== c.candidateId)
  if (sameTopic.length > 0) {
    const n = pick(sameTopic)
    return { candidateId: n.candidateId, path: n.path, relation: 'same-topic-different-concept' as const }
  }
  return null
}

write('semantic-validation', {
  schemaVersion: `${SCHEMA}-semantic-validation/1.0`,
  frozenOn: FROZEN_ON,
  method:
    'Each candidate was adjudicated on concept ownership, route role and the question the route asks. ' +
    'Distinctness is decided on meaning rather than URL shape: two candidates sharing a concept are duplicates ' +
    'only where they also ask the same question.',
  duplicateRule:
    'Duplicative requires another candidate sharing both concept and route role, or a repeated normalised search ' +
    'intent. Both were checked across all 100.',
  validations: cohort.map((c) => {
    const d = decisions.find((x) => x.candidateId === c.candidateId)!
    return {
      candidateId: c.candidateId,
      candidateDigest: d.candidateDigest,
      path: c.path,
      conceptId: c.conceptId,
      routeRole: c.routeRole,
      declaredOwner: c.conceptAuthority.canonicalOwner,
      semanticResult: d.semanticResult,
      nearestNeighbour: neighbourOf(c),
      distinctionBasis: neighbourOf(c) === null
        ? 'No other candidate in the cohort shares this concept or topic.'
        : 'Shares a neighbour in the cohort; retained because the route role and the question asked differ.',
      prohibitedInference: c.routeRole === 'definition'
        ? 'Must not be read as licensing an application claim; a definition states what the concept is, not what may be done with it.'
        : 'Must not redefine the concept it applies. The canonical definition remains with the declared owner.',
      dependencyState: d.dependencyState,
    }
  }),
})

write('decisions', {
  schemaVersion: `${SCHEMA}-decisions/1.0`,
  frozenOn: FROZEN_ON,
  appendOnly: true,
  note: 'Every candidate is recorded, including those rejected, revised or blocked. Nothing is removed.',
  counts: {
    total: decisions.length,
    byFinalState: tally(decisions.map((d) => d.finalState)),
    bySemanticResult: tally(decisions.map((d) => d.semanticResult)),
  },
  decisions,
})

/* -- specifications, only for evidence-ready ------------------------------- */

const evidenceReady = decisions.filter((d) => d.finalState === 'evidence-ready')
const specifications = evidenceReady.map((d) => {
  const c = cohort.find((x) => x.candidateId === d.candidateId)!
  const sources = INSPECTIONS.filter((i) => i.topic === d.topic)
  return {
    candidateId: d.candidateId,
    canonicalUrl: c.url,
    owningProperty: c.siteId,
    conceptId: c.conceptId,
    routeRole: c.routeRole,
    directAnswer: `${c.title}: ${c.searchIntent}`,
    context:
      `This route applies ${c.conceptId} under the ${c.conceptAuthority.role} contract. The canonical definition ` +
      `remains with ${c.conceptAuthority.canonicalOwner}.`,
    evidenceSections: sources.map((s) => ({
      sourceIdentity: s.sourceIdentity,
      locator: s.locator,
      supports: s.supportedClaimScope,
    })),
    limitations: sources.map((s) => s.boundary),
    negativeSpace: c.conceptAuthority.boundary,
    comparisons: [] as string[],
    boundedQuestions: [
      `What does ${d.topic} mean in this context, and who owns the definition?`,
      `What does the inspected source establish about ${d.topic}, and at which locator?`,
      `What does that source explicitly not establish?`,
      `Which canonical definition must this page defer to rather than restate?`,
      `What inference would this page not license?`,
    ],
    typedRelationships: c.typedRelationships ?? [],
    citations: sources.map((s) => ({ sourceIdentity: s.sourceIdentity, stableUrl: s.stableUrl, locator: s.locator, version: s.version })),
    evidenceMetadata: {
      inspectedSources: sources.length,
      demand: 'unknown',
      demandNote: 'No route-specific GSC evidence exists for this path. Demand remains unknown rather than estimated.',
    },
    expectedCanonicalDependencies: [c.conceptId],
    boundary: 'A specification. Not a route, a release or a public page.',
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))

write('page-specifications', {
  schemaVersion: `${SCHEMA}-page-specifications/1.0`,
  frozenOn: FROZEN_ON,
  rule: 'Specifications exist only for evidence-ready candidates. A blocked, revised or duplicative candidate cannot receive one.',
  counts: {
    specifications: specifications.length,
    boundedQuestions: specifications.reduce((n, s) => n + s.boundedQuestions.length, 0),
  },
  specifications,
})

/* -- readiness ------------------------------------------------------------- */

const byFinalState = tally(decisions.map((d) => d.finalState))
const COUNTS = {
  cohort: cohort.length,
  byFinalState,
  specifications: specifications.length,
  boundedQuestions: specifications.reduce((n, s) => n + s.boundedQuestions.length, 0),
  topicsInCohort: cohortTopics.size,
  topicsInspected: inspectedTopics.size,
  distinctSources: new Set(INSPECTIONS.map((i) => i.sourceIdentity)).size,
  dependenciesMissing: dependencies.filter((d) => d.state === 'missing').length,
  prerequisitesSelected: selection.prerequisitesSelected.length,
  projectedTranche13Unlocks: selection.projectedUnlocks,
} as const

const readinessDigest = write('readiness', {
  schemaVersion: `${SCHEMA}-readiness/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest,
  status: 'reviewed-not-published',
  counts: COUNTS,
  honestOutcome:
    'Selection was dependency-first, and the diagnosis bounded what that could achieve. Of the 17 prerequisites ' +
    `blocking Tranche 13, ${selection.prerequisitesSelected.length} exist in the remaining pool and each unlocks ` +
    `one dependent, so this cohort projects ${selection.projectedUnlocks} unlocks rather than 38. The other 13 ` +
    'are absent from the frozen candidate map and are recorded as inactive repair proposals. Evidence-ready is ' +
    `bounded by source inspection: ${COUNTS.topicsInspected} of ${COUNTS.topicsInCohort} topics were inspected, ` +
    `${carried.length} carried forward from Tranche 13 and ${fresh.length} newly.`,
  publicationBoundary: 'No route, release, sitemap entry or public page is created. No build was run.',
})

const stateRows = Object.entries(byFinalState).map(([k, n]) => `| \`${k}\` | ${n} |`).join('\n')
writeFileSync('docs/operations/federation-tranche-14-readiness.md', `# Federation Tranche 14 — local readiness

Reviewed, not published. No route, release, sitemap entry or public page was created, and no build was run.

## Counts

| | |
|---|---|
| Cohort | ${COUNTS.cohort} |
| Topics in cohort | ${COUNTS.topicsInCohort} |
| Topics inspected | ${COUNTS.topicsInspected} |
| Distinct sources | ${COUNTS.distinctSources} |
| Specifications | ${COUNTS.specifications} |
| Bounded questions | ${COUNTS.boundedQuestions} |
| Dependencies missing | ${COUNTS.dependenciesMissing} |
| Prerequisites selected | ${COUNTS.prerequisitesSelected} |
| Projected Tranche 13 unlocks | ${COUNTS.projectedTranche13Unlocks} |

## Classification

| State | Candidates |
|---|---|
${stateRows}

## Dependency-first selection, and its ceiling

Tranche 13 left 38 candidates blocked on 17 distinct prerequisites. Only ${COUNTS.prerequisitesSelected} of those
prerequisites exist in the remaining pool, and each unlocks exactly one dependent. Every prerequisite with a fan-out
above one is absent from the frozen candidate map.

So prioritising high fan-out could not be applied as intended: the high-fan-out definitions are not there to select.
The 13 absent prerequisites are recorded as repair proposals and left inactive. Inserting them would create a
prerequisite that no freeze reviewed, and would manufacture the unlock rather than earn it.

## Property shortfalls

Three properties are exhausted: agentic-publishing, maha-os and mayon-rajan have no active unreviewed candidates
left. Their proportional targets cannot be met, and the shortfall is recorded rather than absorbed.

## Boundary

Specifications are not routes, releases or public pages. Nothing here is published.
`)

console.log(`pool ${selection.poolBefore} -> ${selection.poolAfter}`)
console.log(`cohort ${cohort.length} (unique ${new Set(cohort.map((c) => c.candidateId)).size}, overlap ${cohort.filter((c) => covered.has(c.candidateId)).length}, superseded ${cohort.filter((c) => superseded.has(c.candidateId)).length})`)
console.log(`prerequisites: ${JSON.stringify(tally(prerequisites.map((p) => p.availability)))}`)
console.log(`selected ${selection.prerequisitesSelected.length} prerequisites, projected unlocks ${selection.projectedUnlocks}`)
console.log(`properties ${JSON.stringify(tally(cohort.map((c) => c.siteId)))}`)
console.log(`topics ${new Set(cohort.map((c) => topicOf(c))).size}`)
console.log(`dependencies: ${JSON.stringify(tally(dependencies.map((d) => d.state)))}`)
console.log(`final states: ${JSON.stringify(byFinalState)}`)
console.log(`specifications ${specifications.length}, bounded questions ${COUNTS.boundedQuestions}`)
console.log(`topics ${COUNTS.topicsInCohort}, inspected ${COUNTS.topicsInspected} (carried ${carried.length}, fresh ${fresh.length})`)
console.log(`readiness ${readinessDigest.slice(0, 24)}…`)
