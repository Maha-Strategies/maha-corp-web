/* eslint-disable @typescript-eslint/no-explicit-any */
import { provenanceDigest, sha256Hex } from './evidence-dossier/digest.ts'

type JsonRecord = Record<string, any>
type RetirementEntry = {
  candidate: JsonRecord
  semantic: JsonRecord
  demand: JsonRecord
  score: ReturnType<typeof scoreCandidateForRetention>
}

const codeUnit = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0)

const MYTHOLOGY_ALLOCATION = {
  'greek-roman': 36,
  mesopotamian: 36,
  'sanskrit-vedic-epic-puranic': 32,
  egyptian: 24,
  'norse-germanic': 20,
  chinese: 16,
  japanese: 12,
  mesoamerican: 10,
  'african-source-rights-pilots': 4,
  'comparative-methodology': 8,
  'discovery-hub': 1,
  'machine-registry': 1,
} as const

const COLLECTIONS = [
  {
    id: 'greek-roman', label: 'Greek and Roman', topics: [
      ['zeus-jupiter', 'Zeus and Jupiter'], ['hera-juno', 'Hera and Juno'], ['athena-minerva', 'Athena and Minerva'],
      ['apollo', 'Apollo'], ['artemis-diana', 'Artemis and Diana'], ['aphrodite-venus', 'Aphrodite and Venus'],
      ['poseidon-neptune', 'Poseidon and Neptune'], ['hades-pluto', 'Hades and Pluto'], ['demeter-ceres', 'Demeter and Ceres'],
      ['dionysus-bacchus', 'Dionysus and Bacchus'], ['hermes-mercury', 'Hermes and Mercury'], ['ares-mars', 'Ares and Mars'],
    ], lenses: [['source-identity', 'Source identity'], ['epithet-and-cult', 'Epithet and cult'], ['reception-and-comparison', 'Reception and comparison']],
    priors: [78, 86, 83, 72, 45, 86] as const,
  },
  {
    id: 'mesopotamian', label: 'Mesopotamian', topics: [
      ['inanna-ishtar', 'Inanna and Ishtar'], ['enlil', 'Enlil'], ['enki-ea', 'Enki and Ea'], ['marduk', 'Marduk'],
      ['shamash-utu', 'Shamash and Utu'], ['sin-nanna', 'Sîn and Nanna'], ['ereshkigal', 'Ereshkigal'], ['nergal', 'Nergal'],
      ['gilgamesh', 'Gilgamesh'], ['tammuz-dumuzi', 'Tammuz and Dumuzi'], ['ashur', 'Ashur'], ['tiamat', 'Tiamat'],
    ], lenses: [['source-text', 'Source text'], ['city-and-cult', 'City and cult'], ['reception-and-comparison', 'Reception and comparison']],
    priors: [72, 84, 90, 70, 40, 88] as const,
  },
  {
    id: 'sanskrit-vedic-epic-puranic', label: 'Sanskrit, Vedic, Epic and Purāṇic', topics: [
      ['indra', 'Indra'], ['agni', 'Agni'], ['soma', 'Soma'], ['varuna', 'Varuṇa'],
      ['vishnu', 'Viṣṇu'], ['rudra-shiva', 'Rudra and Śiva'], ['krishna', 'Kṛṣṇa'], ['devi', 'Devī'],
    ], lenses: [['vedic-text', 'Vedic text'], ['epic-puranic-reception', 'Epic and Purāṇic reception'], ['epithet-identity', 'Epithet and identity'], ['comparison-boundary', 'Comparison boundary']],
    priors: [80, 78, 88, 74, 50, 90] as const,
  },
  {
    id: 'egyptian', label: 'Egyptian', topics: [
      ['ra', 'Ra'], ['osiris', 'Osiris'], ['isis', 'Isis'], ['horus', 'Horus'],
      ['seth', 'Seth'], ['hathor', 'Hathor'], ['thoth', 'Thoth'], ['anubis', 'Anubis'],
    ], lenses: [['source-text', 'Source text'], ['cult-and-place', 'Cult and place'], ['reception-and-comparison', 'Reception and comparison']],
    priors: [76, 70, 84, 72, 44, 86] as const,
  },
  {
    id: 'norse-germanic', label: 'Norse and Germanic', topics: [
      ['odin', 'Odin'], ['thor', 'Thor'], ['freyja', 'Freyja'], ['freyr', 'Freyr'], ['loki', 'Loki'],
      ['tyr', 'Týr'], ['baldr', 'Baldr'], ['frigg', 'Frigg'], ['hel', 'Hel'], ['njord', 'Njörðr'],
    ], lenses: [['eddic-source', 'Eddic source'], ['reception-boundary', 'Reception boundary']],
    priors: [77, 74, 82, 70, 42, 84] as const,
  },
  {
    id: 'chinese', label: 'Chinese', topics: [
      ['shangdi', 'Shangdi'], ['tian', 'Tian'], ['nuwa', 'Nüwa'], ['fuxi', 'Fuxi'],
      ['guanyin', 'Guanyin'], ['jade-emperor', 'Jade Emperor'], ['queen-mother-of-the-west', 'Queen Mother of the West'], ['nezha', 'Nezha'],
    ], lenses: [['source-lineage', 'Source lineage'], ['reception-boundary', 'Reception boundary']],
    priors: [70, 64, 86, 72, 40, 82] as const,
  },
  {
    id: 'japanese', label: 'Japanese', topics: [
      ['amaterasu', 'Amaterasu'], ['susanoo', 'Susanoo'], ['tsukuyomi', 'Tsukuyomi'],
      ['inari', 'Inari'], ['hachiman', 'Hachiman'], ['izanagi-izanami', 'Izanagi and Izanami'],
    ], lenses: [['source-lineage', 'Source lineage'], ['cult-and-reception', 'Cult and reception']],
    priors: [71, 64, 86, 72, 40, 82] as const,
  },
  {
    id: 'mesoamerican', label: 'Mesoamerican', topics: [
      ['quetzalcoatl', 'Quetzalcoatl'], ['tezcatlipoca', 'Tezcatlipoca'], ['huitzilopochtli', 'Huitzilopochtli'],
      ['tlaloc', 'Tlaloc'], ['maya-maize-god', 'Maya Maize God'],
    ], lenses: [['source-identity', 'Source identity'], ['colonial-reception-boundary', 'Colonial reception boundary']],
    priors: [68, 58, 90, 76, 36, 82] as const,
  },
] as const

const AFRICAN_PILOTS = [
  ['yoruba-orisha-source-boundaries', 'Yorùbá Òrìṣà source boundaries'],
  ['asante-nyame-source-boundaries', 'Asante Nyame source boundaries'],
  ['dahomey-vodun-source-boundaries', 'Dahomey Vodun source boundaries'],
  ['ancient-kush-religion-source-boundaries', 'Ancient Kush religion source boundaries'],
] as const

const COMPARATIVE_TOPICS = [
  ['deity-equivalence-method', 'Deity equivalence method'],
  ['translation-versus-identity', 'Translation versus identity'],
  ['shared-function-not-same-deity', 'Shared function does not establish identical deity'],
  ['colonial-syncretism-records', 'Colonial records and syncretism'],
  ['primary-text-versus-later-commentary', 'Primary text versus later commentary'],
  ['cult-title-versus-personal-name', 'Cult title versus personal name'],
  ['iconography-versus-textual-identity', 'Iconography versus textual identity'],
  ['reception-versus-origin', 'Reception versus origin'],
] as const

const GROUP_CONTINUITY_BONUS: Record<string, number> = {
  'book-concepts': 30,
  'authorial-concepts': 22,
  'tamil-religion': 25,
  'astrology-infrastructure': 18,
  'evidence-workflows': 10,
  'applied-mathematics-astronomy': 12,
  'policy-clearing': 10,
  'research-objects': 10,
  'agentic-publishing': 10,
  'private-machine-systems': 10,
  'applied-agent-governance': 12,
  'mayon-volcano': 8,
}

function activeCandidateDigest(candidate: JsonRecord): string {
  return provenanceDigest(candidate)
}

function scoreCandidateForRetention(candidate: JsonRecord, semanticEntry: JsonRecord, demandEntry: JsonRecord, dependencyFanOut: number, sameTopicRoleCount: number) {
  const semanticBonus = semanticEntry.disposition === 'retain-distinct' ? 0 : -1_000
  const demandBonus = demandEntry.basis === 'direct-topic-query-signal' ? 30 : demandEntry.basis === 'adjacent-existing-page-signal' ? 15 : 0
  const continuityBonus = GROUP_CONTINUITY_BONUS[candidate.groupId] ?? 0
  const definitionBonus = candidate.routeRole === 'definition' ? 15 : 0
  const dependencyBonus = dependencyFanOut > 0 ? 1_000 : 0
  const saturationPenalty = Math.max(0, sameTopicRoleCount - 2) * 2
  const retentionScore = Number((candidate.scores.weighted + semanticBonus + demandBonus + continuityBonus + definitionBonus + dependencyBonus - saturationPenalty).toFixed(2))
  return { retentionScore, semanticBonus, demandBonus, continuityBonus, definitionBonus, dependencyBonus, saturationPenalty }
}

function weightedScore(priors: readonly [number, number, number, number, number, number]) {
  const [searchDemandPrior, evidenceAvailability, differentiation, machineUtility, commercialProximity, federationUtility] = priors
  const duplicationSafety = 94
  const weighted = searchDemandPrior * .18 + evidenceAvailability * .20 + differentiation * .15 + machineUtility * .17 + commercialProximity * .12 + federationUtility * .13 + duplicationSafety * .05
  return { searchDemandPrior, evidenceAvailability, differentiation, machineUtility, commercialProximity, federationUtility, duplicationSafety, weighted: Number(weighted.toFixed(2)) }
}

function mythologyCandidate(input: { collectionId: string; collectionLabel: string; topic: string; topicLabel: string; lens: string; lensLabel: string; priors: readonly [number, number, number, number, number, number]; ordinal: number; pathOverride?: string }) {
  const { collectionId, collectionLabel, topic, topicLabel, lens, lensLabel, priors, ordinal, pathOverride } = input
  const path = pathOverride ?? `/knowledge/religion/mythology/${collectionId}/${topic}/${lens}`
  const url = `https://www.mahastrategies.com${path}`
  const conceptId = `urn:maha:concept:mythology:${collectionId}:${topic}`
  const candidateId = `cand_${sha256Hex(`mythology-v2:${url}`).slice(0, 24)}`
  return {
    candidateId,
    siteId: 'maha-strategies',
    canonicalHost: 'www.mahastrategies.com',
    groupId: `mythology-${collectionId}`,
    routeRole: lens,
    path,
    url,
    title: `${topicLabel} — ${lensLabel}`,
    searchIntent: `Understand ${topicLabel} through a source-bounded ${lensLabel.toLowerCase()} lens in ${collectionLabel} mythology.`,
    demandEvidence: {
      basis: 'category-prior-not-observed',
      observedQueries: 0,
      observedImpressions: null,
      warning: 'No route-specific GSC signal was supplied. This prior orders research only and does not predict demand.',
    },
    conceptId,
    conceptFamilyId: 'mythology',
    conceptAuthority: {
      canonicalOwner: 'maha-strategies',
      role: 'source-led-religion-application',
      boundary: 'This route may describe identified texts, cults and reception histories; it cannot equate traditions, certify theology, or infer common origin from resemblance.',
    },
    typedRelationships: [
      { type: 'derived-from', target: conceptId },
      { type: 'governed-by', target: 'urn:maha:concept:interpretation' },
      { type: 'limits', target: 'urn:maha:concept:translation' },
      ...(collectionId === 'discovery-hub' ? [{ type: 'contrasts-with', target: 'urn:maha:concept:religion:mayon' }] : []),
    ],
    evidencePlan: {
      sourceIdentity: 'not-started', contentInspection: 'not-started', locatorInspection: 'not-started',
      rightsReview: 'not-started', alignmentAudit: 'not-started', exactRevisionReview: 'not-started',
    },
    routeContract: {
      selfCanonical: true,
      canonicalOwner: 'maha-strategies',
      allowedContent: ['bounded primary-text description', 'identified translation comparison', 'historical reception with explicit source frame', 'typed cross-concept links'],
      mustNotClaim: ['cross-tradition identity from shared attributes', 'unlocated primary-text claims', 'theological truth or falsity', 'restricted or community-held knowledge without an appropriate rights basis'],
    },
    duplicateScreen: { nearestObservedUrl: null, tokenJaccard: 0, status: 'editorial-semantic-review-required' },
    scores: weightedScore(priors),
    publication: { state: 'candidate-only', inspected: false, reviewed: false, canonicallyReleased: false, compiled: false, crawlable: false },
    rank: 1_628 + ordinal,
    tranche: 5,
  }
}

function generateMythologyCandidates() {
  const candidates: JsonRecord[] = []
  for (const collection of COLLECTIONS) {
    for (const [topic, topicLabel] of collection.topics) {
      for (const [lens, lensLabel] of collection.lenses) {
        candidates.push(mythologyCandidate({ collectionId: collection.id, collectionLabel: collection.label, topic, topicLabel, lens, lensLabel, priors: collection.priors, ordinal: candidates.length + 1 }))
      }
    }
  }
  for (const [topic, topicLabel] of AFRICAN_PILOTS) {
    candidates.push(mythologyCandidate({ collectionId: 'african-source-rights-pilots', collectionLabel: 'African source and rights pilots', topic, topicLabel, lens: 'source-and-rights-boundary', lensLabel: 'Source and rights boundary', priors: [62, 45, 96, 76, 32, 82], ordinal: candidates.length + 1 }))
  }
  for (const [topic, topicLabel] of COMPARATIVE_TOPICS) {
    candidates.push(mythologyCandidate({ collectionId: 'comparative-methodology', collectionLabel: 'comparative mythology methodology', topic, topicLabel, lens: 'method', lensLabel: 'Method', priors: [74, 80, 94, 88, 46, 94], ordinal: candidates.length + 1 }))
  }
  candidates.push(mythologyCandidate({ collectionId: 'discovery-hub', collectionLabel: 'cross-cultural mythology', topic: 'mythology', topicLabel: 'Mythology', lens: 'discovery-hub', lensLabel: 'Discovery hub', priors: [82, 78, 92, 90, 55, 96], ordinal: candidates.length + 1, pathOverride: '/knowledge/religion/mythology' }))
  candidates.push(mythologyCandidate({ collectionId: 'machine-registry', collectionLabel: 'cross-cultural mythology', topic: 'mythology', topicLabel: 'Mythology', lens: 'machine-registry', lensLabel: 'Machine registry', priors: [55, 78, 94, 98, 68, 98], ordinal: candidates.length + 1, pathOverride: '/knowledge/religion/mythology/registry' }))
  if (candidates.length !== 200) throw new Error(`Expected 200 mythology candidates; generated ${candidates.length}.`)
  return candidates
}

function topicFromCandidate(candidate: JsonRecord) {
  return candidate.conceptId?.split(':').at(-1) ?? candidate.path.split('/').filter(Boolean).at(-2) ?? 'unknown'
}

function buildSemanticV2(candidateMap: JsonRecord, v1Semantic: JsonRecord, retainedIds: Set<string>, newCandidates: JsonRecord[]) {
  const retainedEntries = v1Semantic.entries.filter((entry: JsonRecord) => retainedIds.has(entry.candidateId))
  const newEntries = newCandidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    url: candidate.url,
    siteId: candidate.siteId,
    topic: topicFromCandidate(candidate),
    routeRole: candidate.routeRole,
    disposition: 'retain-distinct',
    reason: 'The route occupies a source-bounded tradition, figure, passage, or comparison-method role absent from the v1 candidate map; it remains subject to exact editorial duplication review before selection.',
    nearestObserved: null,
    retainedBoundary: candidate.conceptAuthority.boundary,
  }))
  const entries = [...retainedEntries, ...newEntries]
  const states = [...new Set(entries.map((entry) => entry.disposition))].sort(codeUnit)
  const body = {
    schemaVersion: 'maha-federation-semantic-adjudication/2.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    previousSemanticAdjudicationDigest: v1Semantic.provenanceDigest,
    method: {
      retainedRule: 'Every retained v1 semantic entry is preserved byte-for-byte.',
      addedRule: 'New mythology routes are differentiated by tradition + subject + source lens; cross-tradition identity claims remain forbidden and exact editorial non-overlap review is still required before cohort selection.',
      limitation: 'This migration-level adjudication proves structural uniqueness, not evidentiary support or publication readiness.',
    },
    counts: Object.fromEntries(states.map((state) => [state, entries.filter((entry) => entry.disposition === state).length])),
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function buildDemandV2(candidateMap: JsonRecord, v1Demand: JsonRecord, retainedIds: Set<string>, newCandidates: JsonRecord[]) {
  const entries = [
    ...v1Demand.entries.filter((entry: JsonRecord) => retainedIds.has(entry.candidateId)),
    ...newCandidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      basis: 'unknown', queryImpressions: 0, queryClicks: 0, adjacentPageImpressions: 0,
      matchedQueries: [], matchedPages: [], calibratedScore: candidate.scores.weighted,
      caveat: 'No route-specific signal exists in the supplied GSC export; category priors are not observations.',
    })),
  ]
  const body = {
    schemaVersion: 'maha-federation-gsc-demand-calibration/2.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    previousDemandCalibrationDigest: v1Demand.provenanceDigest,
    snapshotDigest: v1Demand.snapshotDigest,
    window: v1Demand.window,
    sourceCounts: v1Demand.sourceCounts,
    counts: {
      directTopicQuerySignal: entries.filter((entry) => entry.basis === 'direct-topic-query-signal').length,
      adjacentExistingPageSignal: entries.filter((entry) => entry.basis === 'adjacent-existing-page-signal').length,
      unknown: entries.filter((entry) => entry.basis === 'unknown').length,
    },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function topologicalOrder(ids: Set<string>, edges: JsonRecord[]) {
  const incoming = new Map([...ids].map((id) => [id, 0]))
  const dependents = new Map<string, string[]>()
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.dependsOn)) continue
    incoming.set(edge.from, (incoming.get(edge.from) ?? 0) + 1)
    dependents.set(edge.dependsOn, [...(dependents.get(edge.dependsOn) ?? []), edge.from])
  }
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id).sort(codeUnit)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const dependent of (dependents.get(id) ?? []).sort(codeUnit)) {
      const next = incoming.get(dependent)! - 1
      incoming.set(dependent, next)
      if (next === 0) { queue.push(dependent); queue.sort(codeUnit) }
    }
  }
  if (order.length !== ids.size) throw new Error('Candidate-map v2 dependency graph contains a cycle.')
  return order
}

function buildDependencyV2(candidateMap: JsonRecord, semantic: JsonRecord, v1Graph: JsonRecord, retainedIds: Set<string>, newCandidates: JsonRecord[]) {
  const candidateIds = new Set(candidateMap.candidates.map((candidate: JsonRecord) => candidate.candidateId))
  const oldEdges = v1Graph.edges.filter((edge: JsonRecord) => retainedIds.has(edge.from) && (!edge.dependsOn.startsWith('cand_') || retainedIds.has(edge.dependsOn)))
  const methodUrls = [
    'https://www.mahastrategies.com/knowledge/religion/textual-authority',
    'https://www.mahastrategies.com/knowledge/religion/translation-and-semantic-range',
  ]
  const observedMethods = methodUrls.map((url) => ({ nodeId: `observed_${sha256Hex(url).slice(0, 24)}`, conceptFamilyId: 'mythology', url, state: 'observed-method-anchor' }))
  const hub = newCandidates.find((candidate) => candidate.groupId === 'mythology-discovery-hub')!
  const newEdges: JsonRecord[] = []
  for (const candidate of newCandidates) {
    for (const method of observedMethods) newEdges.push({ from: candidate.candidateId, dependsOn: method.nodeId, reason: 'observed-religion-methodology-precedes-mythology-route' })
    if (candidate.candidateId !== hub.candidateId) newEdges.push({ from: candidate.candidateId, dependsOn: hub.candidateId, reason: 'mythology-discovery-hub-precedes-specialized-route' })
  }
  const edges = [...oldEdges, ...newEdges].sort((left, right) => codeUnit(`${left.from}:${left.dependsOn}`, `${right.from}:${right.dependsOn}`))
  const nodes = [
    ...v1Graph.nodes.filter((node: JsonRecord) => retainedIds.has(node.candidateId)),
    ...newCandidates.map((candidate) => ({ candidateId: candidate.candidateId, url: candidate.url, siteId: candidate.siteId, topic: topicFromCandidate(candidate), routeRole: candidate.routeRole, semanticDisposition: 'retain-distinct', isFamilyAnchor: candidate.candidateId === hub.candidateId })),
  ]
  const observedAnchorNodes = [...v1Graph.observedAnchorNodes]
  for (const method of observedMethods) if (!observedAnchorNodes.some((node: JsonRecord) => node.nodeId === method.nodeId)) observedAnchorNodes.push(method)
  const missingOwnerTopicNodes = v1Graph.missingOwnerTopicNodes.filter((node: JsonRecord) => edges.some((edge) => edge.dependsOn === node.nodeId))
  const retainedSemanticIds = new Set<string>(semantic.entries.filter((entry: JsonRecord) => entry.disposition === 'retain-distinct').map((entry: JsonRecord) => entry.candidateId))
  const missingIds = new Set(missingOwnerTopicNodes.map((node: JsonRecord) => node.nodeId))
  const body = {
    schemaVersion: 'maha-federation-dependency-graph/2.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    semanticAdjudicationDigest: semantic.provenanceDigest,
    previousDependencyGraphDigest: v1Graph.provenanceDigest,
    relationshipVocabulary: v1Graph.relationshipVocabulary,
    rule: 'Retained v1 dependencies remain binding. Mythology routes depend on the observed textual-authority and translation-boundary methods, and specialized routes also depend on the mythology discovery hub.',
    anchors: [...v1Graph.anchors, { conceptFamilyId: 'mythology', canonicalOwner: 'maha-strategies', anchorType: 'frozen-candidate', candidateId: hub.candidateId, nodeId: hub.candidateId, url: hub.url }],
    counts: {
      nodes: nodes.length + new Set([...observedAnchorNodes.map((node: JsonRecord) => node.nodeId), ...v1Graph.observedTopicNodes.map((node: JsonRecord) => node.nodeId), ...missingOwnerTopicNodes.map((node: JsonRecord) => node.nodeId)]).size,
      candidateNodes: nodes.length,
      observedAnchorNodes: new Set([...observedAnchorNodes.map((node: JsonRecord) => node.nodeId), ...v1Graph.observedTopicNodes.map((node: JsonRecord) => node.nodeId)]).size,
      missingOwnerTopicNodes: missingOwnerTopicNodes.length,
      retainedNodes: retainedSemanticIds.size,
      dependencyReadyNodes: [...retainedSemanticIds].filter((id) => !edges.some((edge) => edge.from === id && missingIds.has(edge.dependsOn))).length,
      excludedNodes: nodes.length - retainedSemanticIds.size,
      edges: edges.length,
      cycles: 0,
    },
    nodes,
    observedAnchorNodes,
    observedTopicNodes: v1Graph.observedTopicNodes.filter((node: JsonRecord) => edges.some((edge) => edge.dependsOn === node.nodeId)),
    missingOwnerTopicNodes,
    edges,
    topologicalOrder: topologicalOrder(retainedSemanticIds, edges),
  }
  for (const edge of edges) {
    if (!candidateIds.has(edge.from)) throw new Error(`Dependency source is not active: ${edge.from}`)
    if (edge.dependsOn.startsWith('cand_') && !candidateIds.has(edge.dependsOn)) throw new Error(`Dependency target was superseded: ${edge.dependsOn}`)
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

export function migrateCandidateMapV2(input: {
  baseline: JsonRecord
  v1Map: JsonRecord
  v1Semantic: JsonRecord
  v1Dependency: JsonRecord
  v1Demand: JsonRecord
  trancheCohorts: JsonRecord[]
}) {
  const { baseline, v1Map, v1Semantic, v1Dependency, v1Demand, trancheCohorts } = input
  const selectedTrancheById = new Map<string, number>()
  for (const [index, cohort] of trancheCohorts.entries()) for (const entry of cohort.entries) {
    if (selectedTrancheById.has(entry.candidateId)) throw new Error(`Candidate selected more than once: ${entry.candidateId}`)
    selectedTrancheById.set(entry.candidateId, index + 1)
  }
  if (selectedTrancheById.size !== 1_000) throw new Error(`Expected 1,000 reviewed candidate identities; found ${selectedTrancheById.size}.`)
  const semanticById = new Map(v1Semantic.entries.map((entry: JsonRecord) => [entry.candidateId, entry]))
  const demandById = new Map(v1Demand.entries.map((entry: JsonRecord) => [entry.candidateId, entry]))
  const fanOut = new Map<string, number>()
  for (const edge of v1Dependency.edges) if (edge.dependsOn.startsWith('cand_')) fanOut.set(edge.dependsOn, (fanOut.get(edge.dependsOn) ?? 0) + 1)
  const topicRoleCounts = new Map<string, number>()
  for (const candidate of v1Map.candidates) {
    const key = `${candidate.siteId}:${topicFromCandidate(candidate)}:${candidate.routeRole}`
    topicRoleCounts.set(key, (topicRoleCounts.get(key) ?? 0) + 1)
  }
  const retirementPool: RetirementEntry[] = v1Map.candidates.filter((candidate: JsonRecord) => !selectedTrancheById.has(candidate.candidateId) && (fanOut.get(candidate.candidateId) ?? 0) === 0)
    .map((candidate: JsonRecord) => {
      const semantic = semanticById.get(candidate.candidateId)
      const demand = demandById.get(candidate.candidateId)
      if (!semantic || !demand) throw new Error(`Missing v1 projection for ${candidate.candidateId}`)
      const key = `${candidate.siteId}:${topicFromCandidate(candidate)}:${candidate.routeRole}`
      return { candidate, semantic, demand, score: scoreCandidateForRetention(candidate, semantic, demand, fanOut.get(candidate.candidateId) ?? 0, topicRoleCounts.get(key) ?? 1) }
    })
    .sort((left: RetirementEntry, right: RetirementEntry) => left.score.retentionScore - right.score.retentionScore || codeUnit(left.candidate.url, right.candidate.url))
  if (retirementPool.length < 200) throw new Error('Fewer than 200 unselected leaf candidates are available for migration.')
  const retired = retirementPool.slice(0, 200)
  const retiredIds = new Set<string>(retired.map((entry: RetirementEntry) => entry.candidate.candidateId))
  const retainedCandidates = v1Map.candidates.filter((candidate: JsonRecord) => !retiredIds.has(candidate.candidateId))
  const retainedIds = new Set<string>(retainedCandidates.map((candidate: JsonRecord) => candidate.candidateId))
  const newCandidates = generateMythologyCandidates()
  const allCandidateIds = [...retainedIds, ...newCandidates.map((candidate) => candidate.candidateId)]
  const allUrls = [...retainedCandidates.map((candidate: JsonRecord) => candidate.url), ...newCandidates.map((candidate) => candidate.url)]
  const observedUrls = new Set(baseline.observedProperties.flatMap((property: JsonRecord) => property.routes))
  if (new Set(allCandidateIds).size !== 1_628 || new Set(allUrls).size !== 1_628) throw new Error('Candidate-map v2 generated duplicate candidate identities or URLs.')
  const collision = allUrls.find((url) => observedUrls.has(url))
  if (collision) throw new Error(`Candidate-map v2 collides with observed route: ${collision}`)
  const invalidV1Ids = new Set<string>(v1Semantic.entries.filter((entry: JsonRecord) => entry.disposition !== 'retain-distinct').map((entry: JsonRecord) => entry.candidateId))
  if ([...invalidV1Ids].some((id) => !retiredIds.has(id))) throw new Error('Every v1 semantic exclusion must be superseded by this migration.')

  const retainedLineage = retainedCandidates.map((candidate: JsonRecord) => ({
    candidateId: candidate.candidateId,
    candidateObjectDigest: activeCandidateDigest(candidate),
    priorRank: candidate.rank,
    priorTranche: candidate.tranche,
    reviewedInTranche: selectedTrancheById.get(candidate.candidateId) ?? null,
    transition: 'retained-byte-identical',
  }))
  const supersededLineage = retired.map(({ candidate, semantic, score }: RetirementEntry) => ({
    candidateId: candidate.candidateId,
    candidateObjectDigest: activeCandidateDigest(candidate),
    priorRank: candidate.rank,
    priorTranche: candidate.tranche,
    siteId: candidate.siteId,
    groupId: candidate.groupId,
    url: candidate.url,
    semanticDisposition: semantic.disposition,
    retentionScore: score.retentionScore,
    scoreComponents: score,
    transition: 'superseded-before-selection',
    reason: semantic.disposition === 'retain-distinct'
      ? 'Unselected leaf candidate ranked below the retained frontier after semantic saturation, observed-demand, strategic-continuity, role, and dependency value were applied.'
      : `The v1 semantic audit classified this candidate as ${semantic.disposition}; migration retires the unresolved duplicate or ownership conflict instead of carrying it forward.`,
  }))
  const addedLineage = newCandidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    candidateObjectDigest: activeCandidateDigest(candidate),
    collectionId: candidate.groupId.replace('mythology-', ''),
    url: candidate.url,
    transition: 'added-candidate-only',
    evidenceState: 'not-inspected',
  }))
  const lineageBody = {
    schemaVersion: 'maha-federation-candidate-lineage/2.0',
    previousCandidateMapDigest: v1Map.provenanceDigest,
    migrationPurpose: 'Replace 200 unselected future candidates with a source-bounded cross-cultural mythology program while preserving every reviewed candidate and the 4,000-route target.',
    rules: {
      reviewedCandidatesImmutable: true,
      dependencyTargetsProtected: true,
      allPriorSemanticExclusionsSuperseded: true,
      retirementBasis: 'semantic disposition first; otherwise lowest retention score among unselected dependency leaves',
      retentionFactors: ['weighted v1 utility', 'observed GSC basis', 'strategic continuity', 'definition role', 'dependency fan-out', 'same-topic role saturation'],
      publicationEffect: 'none',
    },
    counts: { prior: 1_628, retained: 1_428, reviewedRetained: 1_000, superseded: 200, added: 200, active: 1_628 },
    mythologyAllocation: MYTHOLOGY_ALLOCATION,
    retainedCandidates: retainedLineage,
    supersededCandidates: supersededLineage,
    addedCandidates: addedLineage,
  }
  const lineage = { ...lineageBody, provenanceDigest: provenanceDigest(lineageBody) }
  const candidates = [...retainedCandidates, ...newCandidates]
  const siteIds = [...new Set(candidates.map((candidate: JsonRecord) => candidate.siteId))].sort(codeUnit)
  const activeRanks = [...candidates].sort((left, right) => right.scores.weighted - left.scores.weighted || codeUnit(left.url, right.url)).map((candidate, index) => ({ candidateId: candidate.candidateId, activeRank: index + 1 }))
  const candidateMapBody = {
    schemaVersion: 'maha-federation-route-candidate-map/2.0',
    frozenOn: '2026-09-06',
    baselineDigest: v1Map.baselineDigest,
    architectureDigest: v1Map.architectureDigest,
    previousCandidateMapDigest: v1Map.provenanceDigest,
    lineageDigest: lineage.provenanceDigest,
    status: 'candidate-migration-only',
    summary: { observedCanonicalRoutes: 2_372, activeCandidates: 1_628, projectedCanonicalRoutes: 4_000, retainedV1: 1_428, supersededV1: 200, addedMythology: 200 },
    scoring: { ...v1Map.scoring, migrationCaveat: 'Retention and mythology scores order future research only. New mythology demand remains unknown until observed.' },
    executionState: { researchStarted: false, reviewsCreated: false, releasesCreated: false, routesCompiled: false, buildRun: false, previewCreated: false, deployed: false, dnsChanged: false },
    requiredGates: v1Map.requiredGates,
    allocation: siteIds.map((siteId) => {
      const observed = baseline.observedProperties.find((property: JsonRecord) => property.siteId === siteId)?.routeCount ?? 0
      const activeCandidates = candidates.filter((candidate: JsonRecord) => candidate.siteId === siteId).length
      return { siteId, observed, activeCandidates, projected: observed + activeCandidates }
    }),
    activeRanks,
    candidates,
  }
  const candidateMap = { ...candidateMapBody, provenanceDigest: provenanceDigest(candidateMapBody) }
  const semantic = buildSemanticV2(candidateMap, v1Semantic, retainedIds, newCandidates)
  const demand = buildDemandV2(candidateMap, v1Demand, retainedIds, newCandidates)
  const dependency = buildDependencyV2(candidateMap, semantic, v1Dependency, retainedIds, newCandidates)
  const report = {
    observedRoutes: 2_372,
    activeCandidates: 1_628,
    projectedRoutes: 4_000,
    selectedCandidatesPreserved: 1_000,
    v1CandidatesRetained: 1_428,
    v1CandidatesSuperseded: 200,
    priorSemanticExclusionsSuperseded: invalidV1Ids.size,
    mythologyCandidatesAdded: 200,
    newDemandKnown: demand.entries.filter((entry: JsonRecord) => newCandidates.some((candidate) => candidate.candidateId === entry.candidateId) && entry.basis !== 'unknown').length,
    newRoutesCompiled: 0,
    buildRun: false,
    deploymentPerformed: false,
  }
  return { lineage, candidateMap, semantic, demand, dependency, report }
}

export { MYTHOLOGY_ALLOCATION }
