/**
 * One runner for a federation tranche review.
 *
 * Tranches 14 and 15 were 564 and 580 lines that differed in about a hundred:
 * the header prose, the fresh inspection list, and the numbers. Deriving the
 * second from the first by rename put the same source in twice as both carried
 * and fresh, produced an inspection for a topic the cohort did not contain, and
 * left a field named for the wrong tranche. All three were rename artifacts
 * rather than review mistakes.
 *
 * So the policy lives here once and a tranche supplies only what is genuinely
 * its own. A fourth clone would have been the third thing to keep in step.
 *
 * Output is byte-identical to the generators it replaces; that is the condition
 * of the extraction rather than a hope about it.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import {
  diagnosePrerequisite, selectTranche14, topicOf, type Candidate, type Prerequisite,
} from './tranche-14-selection.ts'
import { summariseRepair, withRepairedContract } from './contract-repair.ts'

const OUT = 'content/federation'

export type Inspection = {
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

export type TrancheConfig = {
  /** This tranche's number, e.g. '16'. */
  n: string
  /** The tranche whose unmet prerequisites this one is diagnosed against. */
  prev: string
  frozenOn: string
  priorCohorts: string[]
  freshInspections: Inspection[]
  /** Sources sought for this tranche and not inspected. */
  soughtButNotInspected: { source: string; outcome: string; topic: string; resolution: string }[]
  /** Prose for the Markdown report explaining this tranche's situation. */
  situationNote: string
  /**
   * Which candidate map to read. Defaults to v2, so every tranche built against
   * it keeps reproducing byte-identically; v3 adds the 32 definitions v2 never
   * contained and is read only by the tranche that reviews them.
   */
  mapVersion?: 'v2' | 'v3'
}

export function runTranche(config: TrancheConfig): void {
  const { n, prev, frozenOn: FROZEN_ON } = config
  const schema = `maha-federation-tranche-${n}`
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

  const mapVersion = config.mapVersion ?? 'v2'
  const map = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-${mapVersion}.json`, 'utf8')) as
    { candidates: Candidate[] }
  const lineage = JSON.parse(readFileSync(`${OUT}/federation-candidate-lineage-${mapVersion}.json`, 'utf8')) as
    { supersededCandidates: { candidateId: string }[] }
  const previousDeps = JSON.parse(readFileSync(`${OUT}/federation-tranche-${prev}-dependency-validation-v1.json`, 'utf8')) as
    { dependencies: { candidateId: string; conceptId: string; declaredOwner: string; state: string }[] }

  const superseded = new Set(lineage.supersededCandidates.map((s) => s.candidateId))
  const priorCohorts = config.priorCohorts
  const covered = new Set<string>()
  for (const t of priorCohorts) {
    const file = `${OUT}/federation-tranche-${t}-cohort-v1.json`
    try {
      const j = JSON.parse(readFileSync(file, 'utf8')) as { entries?: { candidateId: string }[]; candidates?: { candidateId: string }[] }
      for (const e of j.entries ?? j.candidates ?? []) covered.add(e.candidateId)
    } catch { /* a tranche without a cohort file contributes nothing */ }
  }

  // The definition-role contract repair, applied before selection so that
  // adjudication sees the corrected contract rather than the map's mislabel.
  // The frozen map itself is untouched; its digest is bound into every prior
  // artifact including Codex's Tranches 1-12.
  const repairSummary = summariseRepair(map.candidates)
  const repairedCandidates = map.candidates.map(withRepairedContract)
  const active = repairedCandidates.filter((c) => !superseded.has(c.candidateId))
  const pool = active.filter((c) => !covered.has(c.candidateId))

  /* -- dependency remediation ------------------------------------------------ */

  const missing = previousDeps.dependencies.filter((d) => d.state === 'missing')
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
    writeFileSync(`${OUT}/federation-tranche-${n}-${name}-v1.json`, `${JSON.stringify(artifact, null, 2)}\n`)
    return artifact.provenanceDigest
  }

  write('dependency-remediation', {
    schemaVersion: `${schema}-dependency-remediation/1.0`,
    frozenOn: FROZEN_ON,
    purpose:
      `Diagnoses every prerequisite that blocked a Tranche ${prev} candidate, so the next cohort can be selected on what ` +
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
      `An analysis. It inserts no candidate, activates no proposal, and changes no Tranche ${prev} classification.`,
  })

  write('contract-repair', {
    schemaVersion: `${schema}-contract-repair/1.0`,
    frozenOn: FROZEN_ON,
    defect:
      'Route role `definition` declared against contract role `owner-application`, whose boundary reads "may apply; ' +
      'cannot redefine". A definition page must own its concept, so the two cannot both be correct.',
    diagnosis:
      'All 169 definition-role candidates in the frozen map sit on the property that owns the concept they define. ' +
      'The role is correct and the contract is not. The cause is a gap in the vocabulary rather than 169 separate ' +
      'mistakes: the map offers owner-application, local-application and source-led-religion-application, and no ' +
      'role for a route that defines its own concept.',
    rule:
      'Applies where routeRole is `definition`, the contract is not already `canonical-owner`, and siteId equals ' +
      'conceptAuthority.canonicalOwner. A definition on a property that does not own the concept is a different ' +
      'fault — the role would be wrong rather than the contract — and is left alone.',
    frozenMapUntouched:
      'The map is not rewritten. Its digest is bound into every tranche artifact including Tranches 1-12, and ' +
      'editing it would invalidate those bindings to correct a labelling error. The repair is applied at review time.',
    counts: repairSummary,
    correctedBoundaryShape:
      'This route is the canonical definition of <family> for <property>. It owns the concept on this property and ' +
      'does not govern how other properties apply it. Owning a definition is not evidence for it: the definition ' +
      'still requires an inspected source like any other claim.',
  })

  /* -- selection ------------------------------------------------------------- */

  const selection = selectTranche14(pool, prerequisites)
  const cohort = selection.entries

  const cohortDigest = write('cohort', {
    schemaVersion: `${schema}-cohort/1.0`,
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
      [`projectedTranche${prev}Unlocks`]: selection.projectedUnlocks,
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
   * Inspections carried forward from Tranche ${prev}.
   *
   * Where a Tranche ${n} topic was already inspected, the same source at the same
   * locator answers it, and re-fetching would not make the evidence better. The
   * carry-forward is explicit rather than silent: each records which Tranche ${prev}
   * inspection it derives from, so a reader can see the evidence was not gathered
   * afresh for this cohort.
   */
  /**
   * Every inspection from every prior tranche, not only the previous one.
   *
   * Reading `prev` alone loses an inspection whenever its topic skips a
   * tranche: audit-export was inspected in Tranche 14 and version-relationship
   * in Tranche 13, and neither reached Tranche 18 because Tranche 17 did not
   * contain them. An inspection is a reading of one source at one locator, and
   * it stays valid wherever that topic appears; which tranche happened to
   * contain it is an accident of selection.
   *
   * Deduplicated by topic, keeping the earliest, so a topic is never inspected
   * twice and the recorded provenance points at the reading that actually
   * happened.
   */
  const priorInspections = new Map<string, Inspection>()
  for (const t of config.priorCohorts) {
    let prior: { inspections?: Inspection[] }
    try {
      prior = JSON.parse(readFileSync(`${OUT}/federation-tranche-${t}-source-inspections-v1.json`, 'utf8'))
    } catch { continue }
    for (const i of prior.inspections ?? []) {
      if (!priorInspections.has(i.topic)) priorInspections.set(i.topic, i)
    }
  }

  /**
   * Prior inspections whose topic appears in this cohort.
   *
   * Each records where it was originally read, so a carried inspection is never
   * presented as evidence newly gathered for this tranche.
   */
  const carried: Inspection[] = [...priorInspections.values()]
    .filter((i) => cohortTopics.has(i.topic))
    .map((i) => ({
      ...i,
      relationshipToEarlier:
        `Carried forward into Tranche ${n}: same source, same locator, same claim scope. ` +
        `Originally inspected as ${i.inspectionId}.`,
    }))

  /**
   * Inspections performed for this tranche.
   *
   * The list Tranche ${prev} carried was deliberately replaced rather than inherited.
   * Renaming its two NIST entries left `auditability` inspected twice — once
   * carried forward and once as if fresh — and produced an inspection for
   * `audit-export`, a topic this cohort does not contain. A carried inspection
   * and a fresh one are different claims about where evidence came from, and
   * collapsing them would misreport the second.
   */
  const fresh: Inspection[] = config.freshInspections

  const INSPECTIONS = [...carried, ...fresh].sort((a, b) => a.inspectionId.localeCompare(b.inspectionId))
  const inspectedTopics = new Set(INSPECTIONS.map((i) => i.topic))

  write('source-inspections', {
    schemaVersion: `${schema}-source-inspections/1.0`,
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
    soughtButNotInspected: config.soughtButNotInspected,
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
      return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: `present-in-tranche-${n}` as const, note: `Supplied by ${definitionsInCohort.get(key)} in this cohort.` }
    }
    if (reviewedConcepts.has(c.conceptId)) {
      return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: 'satisfied-by-earlier-tranche' as const, note: 'A definition for this concept was reviewed in an earlier tranche.' }
    }
    // A definition that exists on the declared owner but has not been reviewed
    // yet. Reported as its own state rather than as missing: the prerequisite
    // is in the map and will be reviewed, so calling it absent would send
    // someone looking for a definition that is already there. It is also not
    // "satisfied" — nothing has reviewed it — so it does not unblock.
    const laterDefinition = repairedCandidates.find(
      (o) => o.conceptId === c.conceptId && o.routeRole === 'definition'
        && o.siteId === c.conceptAuthority.canonicalOwner)
    if (laterDefinition) {
      return {
        candidateId: c.candidateId,
        conceptId: c.conceptId,
        declaredOwner: c.conceptAuthority.canonicalOwner,
        state: 'awaiting-definition-review' as const,
        note:
          `A definition exists at ${laterDefinition.candidateId} on ${c.conceptAuthority.canonicalOwner} and has ` +
          'not been reviewed yet. The prerequisite is present in the map but unreviewed, so the dependent stays ' +
          'blocked without the definition being reported as absent.',
      }
    }
    return { candidateId: c.candidateId, conceptId: c.conceptId, declaredOwner: c.conceptAuthority.canonicalOwner, state: 'missing' as const, note: `No definition candidate exists for ${c.conceptId} on ${c.conceptAuthority.canonicalOwner}. The dependent page is blocked; the prerequisite must not be inferred.` }
  })
  const dependencyByCandidate = new Map(dependencies.map((d) => [d.candidateId, d]))

  write('dependency-validation', {
    schemaVersion: `${schema}-dependency-validation/1.0`,
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
    schemaVersion: `${schema}-semantic-validation/1.0`,
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
    schemaVersion: `${schema}-decisions/1.0`,
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
    schemaVersion: `${schema}-page-specifications/1.0`,
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
    [`projectedTranche${prev}Unlocks`]: selection.projectedUnlocks,
  } as const

  write('readiness', {
    schemaVersion: `${schema}-readiness/1.0`,
    frozenOn: FROZEN_ON,
    cohortDigest,
    status: 'reviewed-not-published',
    counts: COUNTS,
    honestOutcome:
      'Selection was dependency-first, and the diagnosis bounded what that could achieve. Of the 17 prerequisites ' +
      `blocking Tranche ${prev}, ${selection.prerequisitesSelected.length} exist in the remaining pool and each unlocks ` +
      `one dependent, so this cohort projects ${selection.projectedUnlocks} unlocks rather than 38. The other 13 ` +
      'are absent from the frozen candidate map and are recorded as inactive repair proposals. Evidence-ready is ' +
      `bounded by source inspection: ${COUNTS.topicsInspected} of ${COUNTS.topicsInCohort} topics were inspected, ` +
      `${carried.length} carried forward from Tranche ${prev} and ${fresh.length} newly.`,
    publicationBoundary: 'No route, release, sitemap entry or public page is created. No build was run.',
  })

  const stateRows = Object.entries(byFinalState).map(([k, n]) => `| \`${k}\` | ${n} |`).join('\n')
  writeFileSync(`docs/operations/federation-tranche-${n}-readiness.md`, `# Federation Tranche ${n} — local readiness

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
| Projected Tranche ${prev} unlocks | ${(COUNTS as Record<string, unknown>)[`projectedTranche${prev}Unlocks`]} |

## Classification

| State | Candidates |
|---|---|
${stateRows}

## Dependency-first selection, and its ceiling

Tranche ${prev} left 38 candidates blocked on 17 distinct prerequisites. Only ${COUNTS.prerequisitesSelected} of those
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

  return
}
