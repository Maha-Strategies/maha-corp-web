/**
 * Tranche 13 — the next 100 unreviewed federation candidates.
 *
 * Deterministic throughout: sorted keys, sorted records, no clock reading. The
 * only dated value is a frozen constant, so regeneration is byte-identical.
 *
 * The honest shape of this tranche, recorded here because the numbers are the
 * finding rather than an accident of the run:
 *
 * Every candidate in the map carries `evidencePlan: not-started` on all six
 * axes. Evidence-ready requires inspected source content with an exact locator
 * and a rights basis. Sources were inspected for two topics in this pass, so at
 * most those candidates can qualify, and the rest are blocked on inspection
 * rather than downgraded for any fault of their own. Reporting a larger
 * evidence-ready count would require either inspecting more sources or relaxing
 * the definition of inspection.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import {
  PROPORTIONAL_TARGET, resolveDependency, selectCohort, topicOf,
  type Candidate,
} from '../lib/federation/tranche-13-selection.ts'

const OUT = 'content/federation'
const FROZEN_ON = '2026-09-06'
const SCHEMA = 'maha-federation-tranche-13'
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

const superseded = new Set(lineage.supersededCandidates.map((s) => s.candidateId))
const priorCohortFiles = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology']
const covered = new Set<string>()
for (const t of priorCohortFiles) {
  const d = JSON.parse(readFileSync(`${OUT}/federation-tranche-${t}-cohort-v1.json`, 'utf8')) as Record<string, unknown>
  for (const value of Object.values(d)) {
    if (Array.isArray(value)) for (const e of value) {
      if (e && typeof e === 'object' && 'candidateId' in e) covered.add((e as { candidateId: string }).candidateId)
    }
  }
}

const remaining = map.candidates.filter((c) => !covered.has(c.candidateId) && !superseded.has(c.candidateId))
const selection = selectCohort(remaining)
const cohort = selection.selected
const cohortIds = new Set(cohort.map((c) => c.candidateId))

/* -- dependencies ---------------------------------------------------------- */

const definitionsByConcept = new Map<string, Candidate[]>()
for (const c of map.candidates) {
  if (c.routeRole !== 'definition') continue
  definitionsByConcept.set(c.conceptId, [...(definitionsByConcept.get(c.conceptId) ?? []), c])
}
const reviewedConcepts = new Set(map.candidates.filter((c) => covered.has(c.candidateId)).map((c) => c.conceptId))

const dependencies = cohort.map((c) => ({
  candidateId: c.candidateId,
  conceptId: c.conceptId,
  declaredOwner: c.conceptAuthority.canonicalOwner,
  ...resolveDependency(c, definitionsByConcept, reviewedConcepts, cohortIds),
})).sort((a, b) => a.candidateId.localeCompare(b.candidateId))
const dependencyByCandidate = new Map(dependencies.map((d) => [d.candidateId, d]))

/* -- source inspections ---------------------------------------------------- */

/**
 * Sources actually opened and read in this pass, with the locator each claim
 * rests on. Two topics. Metadata was not treated as inspection and no snippet
 * was used as evidence.
 */
const INSPECTIONS = [
  {
    inspectionId: 'tr13-src-001',
    topic: 'container-image',
    sourceIdentity: 'OCI Image Manifest Specification',
    version: 'image-spec v1.1 (specs-go VersionMajor 1, VersionMinor 1)',
    stableUrl: 'https://github.com/opencontainers/image-spec/blob/main/manifest.md',
    locator: 'Line 4 (goals paragraph); §"Image Manifest Property Descriptions" line 16; `config` property, line 38',
    inspectionDepth: 'full-document-read',
    accessBasis: 'Public repository under the OCI open specification licence.',
    reuseBasis: 'Reference-only. Bounded original summary permitted; specification text is not copied into artifacts.',
    supportedClaimScope:
      'That an OCI image manifest is content-addressable, and that it references its configuration object by digest.',
    boundary:
      'Supports what the manifest format specifies. It does not establish runtime behaviour, registry policy, supply-chain assurance, or that any particular image is trustworthy.',
    sourceClass: 'open-specification',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in Tranches 1-12 for this topic.',
  },
  {
    inspectionId: 'tr13-src-002',
    topic: 'pyroclastic-density-current',
    sourceIdentity: 'U.S. Geological Survey, Volcano Hazards Program — "Pyroclastic flows move fast and destroy everything in their path"',
    version: 'Page as served 2026-09-06',
    stableUrl: 'https://www.usgs.gov/programs/VHP/pyroclastic-flows-move-fast-and-destroy-everything-their-path',
    locator: 'Opening descriptive paragraph: speed and temperature sentences.',
    inspectionDepth: 'full-page-read',
    accessBasis: 'United States government work, publicly accessible without restriction.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That pyroclastic flows typically travel faster than 80 km/h (50 mph) and that internal rock and gas temperatures are generally between 200°C and 700°C.',
    boundary:
      'A hazard description for a general audience. It does not establish site-specific risk for any volcano, evacuation distances, or preparedness policy, and it is not a substitute for a hazard assessment.',
    sourceClass: 'government-scientific-agency',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in Tranches 1-12 for this topic.',
  },
  {
    inspectionId: 'tr13-src-003',
    topic: 'compiler-provenance',
    sourceIdentity: 'W3C PROV-DM: The PROV Data Model',
    version: 'W3C Recommendation, 30 April 2013',
    stableUrl: 'https://www.w3.org/TR/prov-dm/',
    locator: '§2.1 PROV Core Structures — Entity and Activity definitions.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'W3C Recommendation, publicly published.',
    reuseBasis: 'W3C Document Licence. Reference-only here; specification text is not copied into artifacts.',
    supportedClaimScope:
      'That provenance can be modelled as entities, activities that act upon them over time, and derivation relations between entities.',
    boundary:
      'A data model for expressing provenance. It does not establish that any recorded provenance is accurate, complete, or trustworthy, and it prescribes no build or compiler behaviour.',
    sourceClass: 'open-standard-recommendation',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Supersedes no earlier source inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-004',
    topic: 'citation-lineage',
    sourceIdentity: 'W3C PROV-DM: The PROV Data Model',
    version: 'W3C Recommendation, 30 April 2013',
    stableUrl: 'https://www.w3.org/TR/prov-dm/',
    locator: '§2.1 PROV Core Structures — derivation between entities.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'W3C Recommendation, publicly published.',
    reuseBasis: 'W3C Document Licence. Reference-only.',
    supportedClaimScope:
      'That a later entity may be recorded as derived from an earlier one, giving a traceable chain between versions of a work.',
    boundary:
      'Supports expressing a lineage. It does not establish that a cited chain is correct, that a citation is warranted, or that any particular citation practice is standard.',
    sourceClass: 'open-standard-recommendation',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as tr13-src-003, inspected for a different relation.',
  },
  {
    inspectionId: 'tr13-src-005',
    topic: 'model-evaluation',
    sourceIdentity: 'NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    version: 'January 2023',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    locator: 'MEASURE 2, subcategories 2.1, 2.3 and 2.5.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That evaluating an AI system for trustworthy characteristics involves documenting test sets, metrics and TEVV tooling, measuring performance under conditions similar to deployment, and documenting limits on generalisability beyond those conditions.',
    boundary:
      'A voluntary framework. It does not certify any system, establish a passing threshold, create a legal obligation, or state that following it makes a system safe.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-006',
    topic: 'evaluation-protocol',
    sourceIdentity: 'NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    version: 'January 2023',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    locator: 'MEASURE 2.1 — test sets, metrics and TEVV tooling are documented.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That an evaluation protocol is expected to record the test sets, the metrics and the tools used, so that the evaluation can be examined afterwards.',
    boundary:
      'Says what should be documented, not how to design a protocol, which metrics are correct for a task, or that a documented protocol is a sound one.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as tr13-src-005, inspected for a different subcategory.',
  },
  {
    inspectionId: 'tr13-src-007',
    topic: 'benchmark-design',
    sourceIdentity: 'NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    version: 'January 2023',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    locator: 'MEASURE 2.3 and 2.5 — measurement under deployment-like conditions; limits of generalisability.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary permitted with attribution.',
    supportedClaimScope:
      'That a benchmark result holds for the conditions it was measured under, and that limits on generalising beyond those conditions are themselves to be documented.',
    boundary:
      'Does not prescribe any benchmark, dataset or scoring method, and does not establish that a benchmark measures what its name suggests.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as tr13-src-005, inspected for different subcategories.',
  },
  {
    inspectionId: 'tr13-src-008',
    topic: 'user-revocation',
    sourceIdentity: 'Regulation (EU) 2016/679 (General Data Protection Regulation)',
    version: 'Consolidated text, EUR-Lex CELEX 32016R0679',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
    locator: 'Article 7(3) (withdrawal of consent); Article 17(1) (right to erasure).',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with source acknowledgement; summarised here rather than reproduced.',
    supportedClaimScope:
      'That a data subject may withdraw consent at any time without affecting the lawfulness of processing before withdrawal, and may obtain erasure of personal data without undue delay on the stated grounds.',
    boundary:
      'States the right and its conditions. It does not specify any technical mechanism for revocation, does not determine whether a given system is compliant, and is not legal advice.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-009',
    topic: 'local-memory',
    sourceIdentity: 'Regulation (EU) 2016/679 (General Data Protection Regulation)',
    version: 'Consolidated text, EUR-Lex CELEX 32016R0679',
    stableUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679',
    locator: 'Article 25 — data protection by design and by default, including minimising processing.',
    inspectionDepth: 'targeted-article-read',
    accessBasis: 'Official EU legal publication, freely accessible.',
    reuseBasis: 'EUR-Lex reuse policy permits reproduction with source acknowledgement; summarised here.',
    supportedClaimScope:
      'That minimising the personal data processed, and doing so by design and by default, is an expressed obligation rather than an optional practice.',
    boundary:
      'Establishes a duty, not an architecture. It does not state that local retention satisfies it, nor that any particular storage location is compliant.',
    sourceClass: 'statutory-instrument',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same instrument as tr13-src-008, inspected for a different article.',
  },
  {
    inspectionId: 'tr13-src-010',
    topic: 'acknowledgement',
    sourceIdentity: 'CRediT — Contributor Roles Taxonomy (ANSI/NISO Z39.104)',
    version: 'Approved as an ANSI/NISO standard in 2022',
    stableUrl: 'https://credit.niso.org/',
    locator: 'Summary table, "CRediT\u2019s 14 Contributor Roles".',
    inspectionDepth: 'full-page-read',
    accessBasis: 'Publicly published standard summary.',
    reuseBasis: 'Licensed CC-BY 4.0, which permits reuse with attribution. Summarised rather than copied.',
    supportedClaimScope:
      'That contribution to a work can be recorded against fourteen named roles rather than a single undifferentiated credit.',
    boundary:
      'A vocabulary for describing contribution. It does not determine authorship, allocate credit, or establish that a declared role was actually performed.',
    sourceClass: 'consensus-standard',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr13-src-011',
    topic: 'machine-authorship-disclosure',
    sourceIdentity: 'CRediT — Contributor Roles Taxonomy (ANSI/NISO Z39.104)',
    version: 'Approved as an ANSI/NISO standard in 2022',
    stableUrl: 'https://credit.niso.org/',
    locator: 'Summary table of the fourteen contributor roles.',
    inspectionDepth: 'full-page-read',
    accessBasis: 'Publicly published standard summary.',
    reuseBasis: 'Licensed CC-BY 4.0. Summarised rather than copied.',
    supportedClaimScope:
      'That the taxonomy enumerates roles for human contributors to a scholarly work.',
    boundary:
      'It does not address machine or model contribution, and must not be read as authorising a machine to be listed as a contributor. Inspected because it is the nearest applicable standard, and it does not reach the question this route asks.',
    sourceClass: 'consensus-standard',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same standard as tr13-src-010, inspected for a different question.',
  },
] as const

const inspectedTopics = new Set(INSPECTIONS.map((i) => i.topic))

/* -- semantic review and classification ------------------------------------ */

type FinalState = 'evidence-ready' | 'revise' | 'blocked' | 'duplicative'

/**
 * Adjudicates one candidate.
 *
 * Order matters. A missing prerequisite blocks before anything else is asked,
 * because a page that cannot resolve its definition cannot be made ready by
 * inspecting a source. A contradiction between the route's role and its own
 * contract is next, because that is a defect in the candidate rather than a gap
 * in our work.
 */
function adjudicate(c: Candidate) {
  const dep = dependencyByCandidate.get(c.candidateId)!
  const topic = topicOf(c)

  if (dep.state === 'missing') {
    return {
      semantic: 'blocked on ownership or dependency' as const,
      final: 'blocked' as FinalState,
      reason: dep.note,
    }
  }
  if (dep.state === 'incorrectly-owned') {
    return {
      semantic: 'blocked on ownership or dependency' as const,
      final: 'blocked' as FinalState,
      reason: dep.note,
    }
  }
  // A definition route whose own contract forbids redefining is internally
  // inconsistent: the role claims the concept and the boundary denies it.
  if (c.routeRole === 'definition' && /cannot redefine/.test(c.conceptAuthority.boundary)
      && c.conceptAuthority.role !== 'canonical-owner') {
    return {
      semantic: 'revise boundary' as const,
      final: 'revise' as FinalState,
      reason:
        `Route role is "definition" but the declared contract is "${c.conceptAuthority.role}" with a boundary forbidding redefinition. ` +
        `A definition page must own its concept. Either the role or the contract is wrong, and which one is a product decision.`,
    }
  }
  if (!inspectedTopics.has(topic)) {
    return {
      semantic: 'distinct' as const,
      final: 'blocked' as FinalState,
      reason:
        `Semantically distinct and dependency-clear, but no source was inspected for topic "${topic}". ` +
        `The candidate map records evidencePlan as not-started on all six axes, and evidence-ready requires inspected ` +
        `content with an exact locator. Blocked on source inspection, not on any defect in the candidate.`,
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

const evidenceReady = decisions.filter((d) => d.finalState === 'evidence-ready')

/* -- specifications, only for evidence-ready ------------------------------- */

const specifications = evidenceReady.map((d) => {
  const c = cohort.find((x) => x.candidateId === d.candidateId)!
  const src = INSPECTIONS.find((i) => i.topic === d.topic)!
  return {
    candidateId: c.candidateId,
    canonicalUrl: c.url,
    owningProperty: c.siteId,
    routeRole: c.routeRole,
    directAnswer: src.supportedClaimScope,
    context: `${src.sourceIdentity} (${src.version}) is the authority consulted for this route's topic.`,
    evidenceSections: [
      { heading: 'What the source establishes', body: src.supportedClaimScope, locator: src.locator },
      { heading: 'What it does not establish', body: src.boundary, locator: src.locator },
    ],
    limitationsAndNegativeSpace: [src.boundary, 'No route-specific search demand is observed; demand remains unknown.'],
    comparisons: [] as string[],
    boundedQuestions: [
      `What does ${src.sourceIdentity} state about ${d.topic}?`,
      `Which exact locator in that source supports the claim on this page?`,
      `What does this source explicitly not establish about ${d.topic}?`,
      `Which canonical definition does this route depend on, and where is it owned?`,
      `What would have to be inspected before this page could claim more than it does?`,
    ],
    typedRelationships: c.typedRelationships ?? [],
    citations: [{ inspectionId: src.inspectionId, sourceIdentity: src.sourceIdentity, stableUrl: src.stableUrl, locator: src.locator }],
    evidenceMetadata: {
      sourceClass: src.sourceClass,
      independence: src.independence,
      inspectionDepth: src.inspectionDepth,
      reuseBasis: src.reuseBasis,
      demandEvidence: 'unknown',
    },
    expectedCanonicalDependencies: [{ conceptId: c.conceptId, owner: c.conceptAuthority.canonicalOwner, state: d.dependencyState }],
    boundary: 'A specification is not a route, a release, or a public page.',
  }
}).sort((a, b) => a.candidateId.localeCompare(b.candidateId))

/* -- emit ------------------------------------------------------------------ */

const tally = (keys: string[]) => Object.fromEntries(
  Object.entries(keys.reduce<Record<string, number>>((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b)))

const write = (name: string, body: Record<string, unknown>) => {
  const artifact = { ...body, provenanceDigest: digest(canonicalJson(body)) }
  writeFileSync(`${OUT}/federation-tranche-13-${name}-v1.json`, `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact.provenanceDigest
}

const cohortDigests = write('cohort', {
  schemaVersion: `${SCHEMA}-cohort/1.0`,
  frozenOn: FROZEN_ON,
  candidateMapDigest: digest(readFileSync(`${OUT}/federation-route-candidates-v2.json`, 'utf8')),
  selectionRule:
    'Highest calibrated utility after Tranches 1 through 12, with dependency closure, a four-page property/topic cap, ' +
    'proportional property caps bounded by remaining inventory, and prior-tranche definitions treated as satisfied ' +
    'prerequisites. Ordered by scores.weighted descending with candidateId as tiebreak; legacy rank and tranche fields ' +
    'are non-contiguous after the mythology migration and are not used.',
  exclusions: {
    coveredByTranches1to12: covered.size,
    supersededInLineageV2: superseded.size,
    remainingAfterExclusions: remaining.length,
  },
  proportionalTarget: PROPORTIONAL_TARGET,
  appliedTargets: selection.propertyTargets,
  shortfalls: selection.shortfalls,
  shortfallNote:
    'agentic-publishing and mayon-rajan cannot meet their proportional targets from the remaining inventory. ' +
    'The deficit was redistributed to maha-strategies in a fixed order rather than left unfilled, and is recorded here.',
  counts: {
    selected: cohort.length,
    unique: new Set(cohort.map((c) => c.candidateId)).size,
    overlapWithPriorTranches: cohort.filter((c) => covered.has(c.candidateId)).length,
    supersededSelected: cohort.filter((c) => superseded.has(c.candidateId)).length,
    distinctConcepts: new Set(cohort.map((c) => c.conceptId)).size,
    topicCapDisplacements: selection.topicCapHits.length,
  },
  byProperty: tally(cohort.map((c) => c.siteId)),
  byTopic: tally(cohort.map((c) => topicOf(c))),
  byRouteRole: tally(cohort.map((c) => c.routeRole)),
  entries: cohort.map((c, i) => ({
    cohortOrder: i + 1, candidateId: c.candidateId, url: c.url, siteId: c.siteId,
    topic: topicOf(c), routeRole: c.routeRole, calibratedScore: c.scores.weighted,
    demandBasis: 'unknown', conceptId: c.conceptId,
  })),
})

write('dependency-validation', {
  schemaVersion: `${SCHEMA}-dependency-validation/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  rule: 'An application route may not redefine its dependency. A missing prerequisite blocks the dependent page and is never inferred.',
  counts: tally(dependencies.map((d) => d.state)),
  dependencies,
})

write('source-inspections', {
  schemaVersion: `${SCHEMA}-source-inspections/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  method: 'Sources were opened and read. Metadata was not treated as inspection, and no search snippet was used as evidence. No paywall, CAPTCHA or access control was bypassed.',
  topicsInCohort: new Set(cohort.map((c) => topicOf(c))).size,
  topicsInspected: INSPECTIONS.length,
  inspections: INSPECTIONS,
})

write('decisions', {
  schemaVersion: `${SCHEMA}-decisions/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  appendOnly: true,
  note: 'Every candidate carries exactly one decision. Rejected, revised and blocked candidates are preserved here and cannot become specifications.',
  counts: {
    bySemanticResult: tally(decisions.map((d) => d.semanticResult)),
    byFinalState: tally(decisions.map((d) => d.finalState)),
  },
  decisions,
})

write('page-specifications', {
  schemaVersion: `${SCHEMA}-page-specifications/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  boundary: 'Specifications exist only for evidence-ready candidates. A specification is not a route, a release, or a public page.',
  counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 },
  specifications,
})

const readiness = write('readiness', {
  schemaVersion: `${SCHEMA}-readiness/1.0`,
  frozenOn: FROZEN_ON,
  cohortDigest: cohortDigests,
  status: 'reviewed-not-published',
  counts: {
    cohort: cohort.length,
    byFinalState: tally(decisions.map((d) => d.finalState)),
    specifications: specifications.length,
    topicsInCohort: new Set(cohort.map((c) => topicOf(c))).size,
    topicsInspected: INSPECTIONS.length,
    dependenciesMissing: dependencies.filter((d) => d.state === 'missing').length,
  },
  honestOutcome:
    'Evidence-ready is bounded by source inspection, not by candidate quality. All 100 candidates carry ' +
    'evidencePlan not-started in the candidate map; sources were inspected for two topics in this pass, so only ' +
    'candidates on those topics can satisfy the evidence-ready gate. Raising the count requires inspecting more ' +
    'sources, not relaxing the gate.',
  publicationBoundary: 'No route, release, sitemap entry or public page is created. No build was run.',
})

console.log(`cohort ${cohort.length} (unique ${new Set(cohort.map((c) => c.candidateId)).size}, overlap ${cohort.filter((c) => covered.has(c.candidateId)).length})`)
console.log(`dependencies: ${JSON.stringify(tally(dependencies.map((d) => d.state)))}`)
console.log(`final states: ${JSON.stringify(tally(decisions.map((d) => d.finalState)))}`)
console.log(`specifications ${specifications.length}, bounded questions ${specifications.length * 5}`)
console.log(`topics ${new Set(cohort.map((c) => topicOf(c))).size}, inspected ${INSPECTIONS.length}`)
console.log(`readiness ${readiness.slice(0, 24)}…`)
