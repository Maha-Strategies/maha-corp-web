import { provenanceDigest } from './evidence-dossier/digest.ts'
import type { Candidate, CandidateMap, SemanticDisposition } from './federation-4000-adjudication.ts'
import type { SiteId } from './federation-4000-plan.ts'

type SemanticArtifact = {
  provenanceDigest: string
  entries: Array<{ candidateId: string; disposition: SemanticDisposition }>
}

type DemandArtifact = {
  provenanceDigest: string
  entries: Array<{ candidateId: string; calibratedScore: number; basis: string }>
}

type DependencyGraph = {
  provenanceDigest: string
  topologicalOrder: string[]
  missingOwnerTopicNodes: Array<{ nodeId: string }>
  edges: Array<{ from: string; dependsOn: string }>
}

type PriorCohort = {
  provenanceDigest: string
  entries: Array<{ candidateId: string }>
}

const codeUnit = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const topicOf = (candidate: Candidate) => candidate.path.split('/').filter(Boolean).at(-2) ?? ''

const PROPERTY_LIMITS: Record<SiteId, number> = {
  'maha-strategies': 31,
  'maha-research': 25,
  'agentic-publishing': 10,
  'maha-os': 6,
  'mayone-maharajan': 5,
  'mayon-rajan': 5,
  'maha-policy': 18,
}

function evidenceRequirements(candidate: Candidate) {
  const common = {
    sourceIdentity: 'Verify canonical title, responsible institution or author, version/date, and stable URL or identifier.',
    locator: 'Bind every explanatory assertion to an exact section, paragraph, figure, table, equation, or versioned specification anchor.',
    rights: 'Record access and reuse basis; retain locators and fingerprints rather than restricted full text.',
    scope: `Support the ${candidate.routeRole} intent without inheriting authority from a neighboring topic or property.`,
    boundary: candidate.conceptAuthority.boundary,
  }
  return candidate.siteId === 'maha-policy'
    ? { ...common, minimumIndependentSources: 2, sourceClasses: ['current primary law, regulator, or standards text', 'independent implementation or outcome evidence'] }
    : { ...common, minimumIndependentSources: 1, sourceClasses: ['canonical primary authority', 'operational or empirical source where the application makes an outcome claim'] }
}

export function selectTrancheTwo(candidateMap: CandidateMap, semantic: SemanticArtifact, graph: DependencyGraph, demand: DemandArtifact, trancheOne: PriorCohort) {
  const candidateById = new Map(candidateMap.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const semanticById = new Map(semantic.entries.map((entry) => [entry.candidateId, entry]))
  const demandById = new Map(demand.entries.map((entry) => [entry.candidateId, entry]))
  const priorIds = new Set(trancheOne.entries.map((entry) => entry.candidateId))
  const missingNodeIds = new Set(graph.missingOwnerTopicNodes.map((node) => node.nodeId))
  const blockedByMissingOwner = new Set(graph.edges.filter((edge) => missingNodeIds.has(edge.dependsOn)).map((edge) => edge.from))
  const dependencies = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (candidateById.has(edge.dependsOn)) dependencies.set(edge.from, [...(dependencies.get(edge.from) ?? []), edge.dependsOn])
  }
  const eligible = candidateMap.candidates.filter((candidate) => semanticById.get(candidate.candidateId)?.disposition === 'retain-distinct' && !blockedByMissingOwner.has(candidate.candidateId) && !priorIds.has(candidate.candidateId))
  const eligibleIds = new Set(eligible.map((candidate) => candidate.candidateId))
  const ranked = [...eligible].sort((left, right) => demandById.get(right.candidateId)!.calibratedScore - demandById.get(left.candidateId)!.calibratedScore || codeUnit(left.url, right.url))
  const selected = new Set<string>()

  const closure = (id: string, accumulator = new Set<string>()): Set<string> => {
    if (priorIds.has(id) || accumulator.has(id)) return accumulator
    if (!eligibleIds.has(id)) throw new Error(`Candidate ${id} depends on an unavailable candidate ${id}.`)
    accumulator.add(id)
    for (const dependency of dependencies.get(id) ?? []) closure(dependency, accumulator)
    return accumulator
  }

  const addIfFits = (candidate: Candidate) => {
    const needed = [...closure(candidate.candidateId)].filter((id) => !selected.has(id))
    if (selected.size + needed.length > 100) return false
    const byTopic = new Map<string, number>()
    const bySite = new Map<SiteId, number>()
    for (const id of selected) {
      const entry = candidateById.get(id)!
      byTopic.set(`${entry.siteId}:${topicOf(entry)}`, (byTopic.get(`${entry.siteId}:${topicOf(entry)}`) ?? 0) + 1)
      bySite.set(entry.siteId, (bySite.get(entry.siteId) ?? 0) + 1)
    }
    for (const id of needed) {
      const entry = candidateById.get(id)!
      const key = `${entry.siteId}:${topicOf(entry)}`
      const topicCount = (byTopic.get(key) ?? 0) + 1
      const siteCount = (bySite.get(entry.siteId) ?? 0) + 1
      if (topicCount > 4 || siteCount > PROPERTY_LIMITS[entry.siteId]) return false
      byTopic.set(key, topicCount)
      bySite.set(entry.siteId, siteCount)
    }
    needed.forEach((id) => selected.add(id))
    return true
  }

  for (const siteId of Object.keys(PROPERTY_LIMITS) as SiteId[]) {
    for (const candidate of ranked.filter((entry) => entry.siteId === siteId).slice(0, 3)) addIfFits(candidate)
  }
  for (const candidate of ranked) {
    if (selected.size === 100) break
    addIfFits(candidate)
  }
  if (selected.size !== 100) throw new Error(`Tranche 2 must contain 100 candidates; selected ${selected.size}.`)

  const orderIndex = new Map(graph.topologicalOrder.map((id, index) => [id, index]))
  const entries = [...selected].sort((left, right) => orderIndex.get(left)! - orderIndex.get(right)!).map((id, index) => {
    const candidate = candidateById.get(id)!
    const demandEntry = demandById.get(id)!
    const allDependencies = dependencies.get(id) ?? []
    return {
      cohortOrder: index + 1,
      candidateId: id,
      url: candidate.url,
      siteId: candidate.siteId,
      topic: topicOf(candidate),
      routeRole: candidate.routeRole,
      calibratedScore: demandEntry.calibratedScore,
      demandBasis: demandEntry.basis,
      dependenciesInTranche: allDependencies.filter((dependency) => selected.has(dependency)),
      dependenciesSatisfiedByTrancheOne: allDependencies.filter((dependency) => priorIds.has(dependency)),
      evidenceRequirements: evidenceRequirements(candidate),
      evidenceState: 'not-inspected',
      pageSpecEligible: false,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-tranche-two-cohort/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    semanticAdjudicationDigest: semantic.provenanceDigest,
    dependencyGraphDigest: graph.provenanceDigest,
    demandCalibrationDigest: demand.provenanceDigest,
    priorCohortDigest: trancheOne.provenanceDigest,
    status: 'frozen-for-evidence-intake',
    selectionRule: 'Highest calibrated utility after Tranche 1, with dependency closure, a four-page property/topic cap, proportional property caps, and Tranche 1 definitions treated as satisfied prerequisites.',
    propertyLimits: PROPERTY_LIMITS,
    counts: {
      selected: entries.length,
      overlapWithTrancheOne: entries.filter((entry) => priorIds.has(entry.candidateId)).length,
      dependenciesSatisfiedByTrancheOne: entries.filter((entry) => entry.dependenciesSatisfiedByTrancheOne.length > 0).length,
      byProperty: Object.fromEntries((Object.keys(PROPERTY_LIMITS) as SiteId[]).map((siteId) => [siteId, entries.filter((entry) => entry.siteId === siteId).length])),
      inspected: 0,
      evidenceReady: 0,
      pageSpecs: 0,
    },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}
