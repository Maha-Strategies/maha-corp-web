import { provenanceDigest, sha256Hex } from './evidence-dossier/digest.ts'
import { CONCEPT_FAMILIES, RELATIONSHIP_TYPES, SITE_CONTRACTS, type FrozenBaseline, type SiteId } from './federation-4000-plan.ts'

export type CandidateMap = {
  provenanceDigest: string
  candidates: Candidate[]
}

export type Candidate = {
  candidateId: string
  siteId: SiteId
  canonicalHost: string
  groupId: string
  routeRole: string
  path: string
  url: string
  title: string
  searchIntent: string
  conceptFamilyId: string
  conceptAuthority: { canonicalOwner: SiteId; role: string; boundary: string }
  typedRelationships: Array<{ type: string; target: string }>
  scores: { weighted: number }
}

export type GscQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number }
export type GscPage = { url: string; clicks: number; impressions: number; ctr: number; position: number }
export type GscSnapshot = {
  schemaVersion: 'maha-federation-gsc-demand-snapshot/1.0'
  exportedOn: string
  window: { start: string; end: string; searchType: 'Web' }
  archiveSha256: string
  sourceCounts: { queryRows: number; pageRows: number }
  queries: GscQuery[]
  pages: GscPage[]
  provenanceDigest: string
}

const codeUnit = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0)
const STOP = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'how', 'in', 'is', 'of', 'on', 'or', 'the', 'through', 'to', 'vs', 'what', 'with'])
const TERM_CANONICAL: Record<string, string> = {
  uncertain: 'uncertainty',
  uncertainties: 'uncertainty',
  propagate: 'propagation',
  propagating: 'propagation',
  propagated: 'propagation',
  acknowledgment: 'acknowledgement',
}

function stem(value: string): string {
  if (value.length > 6 && value.endsWith('ing')) return value.slice(0, -3)
  if (value.length > 5 && value.endsWith('ies')) return `${value.slice(0, -3)}y`
  if (value.length > 4 && value.endsWith('s')) return value.slice(0, -1)
  return value
}

function words(value: string): string[] {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replaceAll('model context protocol', 'mcp')
    .replaceAll('artificial intelligence', 'ai')
    .replaceAll('digital object identifier', 'doi')
  const base = normalized.split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !STOP.has(word))
    .map((word) => TERM_CANONICAL[word] ?? stem(word))
  return [...new Set(base)].sort(codeUnit)
}

function topic(candidate: Candidate): string {
  const parts = candidate.path.split('/').filter(Boolean)
  return parts.at(-2) ?? ''
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  const intersection = [...leftSet].filter((word) => rightSet.has(word)).length
  return intersection / Math.max(1, new Set([...leftSet, ...rightSet]).size)
}

function observedSubject(route: string): string[] {
  const parts = new URL(route).pathname.split('/').filter(Boolean)
  return words(parts.slice(-2).join(' '))
}

function semanticTopic(value: string): string {
  return ({ 'uncertainty-propagation': 'propagation' } as Record<string, string>)[value] ?? value
}

function nearestSemanticRoute(candidate: Candidate, routes: string[]) {
  const topicWords = words(topic(candidate))
  let result: { url: string; similarity: number; exactTopicSegment: boolean } | null = null
  for (const route of routes) {
    const segments = new URL(route).pathname.split('/').filter(Boolean)
    const exactTopicSegment = segments.includes(topic(candidate))
    const terminalSimilarity = jaccard(topicWords, words(segments.at(-1) ?? ''))
    const similarity = exactTopicSegment ? 1 : Math.max(terminalSimilarity, jaccard(topicWords, observedSubject(route)))
    if (!result || similarity > result.similarity || (similarity === result.similarity && codeUnit(route, result.url) < 0)) {
      result = { url: route, similarity: Number(similarity.toFixed(4)), exactTopicSegment }
    }
  }
  return result
}

export type SemanticDisposition =
  | 'retain-distinct'
  | 'replace-with-existing-route'
  | 'reject-internal-duplicate'
  | 'reject-cross-property-definition'
  | 'revise-as-local-application'

export type SemanticEntry = {
  candidateId: string
  url: string
  siteId: SiteId
  topic: string
  routeRole: string
  disposition: SemanticDisposition
  reason: string
  nearestObserved: { url: string; similarity: number; exactTopicSegment: boolean } | null
  retainedBoundary: string | null
}

export function adjudicateSemantics(candidateMap: CandidateMap, baseline: FrozenBaseline) {
  const allObserved = baseline.observedProperties.flatMap((property) => property.routes)
  const observedBySite = new Map(baseline.observedProperties.map((property) => [property.siteId, property.routes]))
  observedBySite.set('maha-policy', [])
  const duplicateGroups = new Map<string, Candidate[]>()
  for (const candidate of candidateMap.candidates) {
    const key = `${candidate.siteId}:${topic(candidate)}:${candidate.routeRole}`
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), candidate])
  }
  const internalWinner = new Map<string, string>()
  for (const [key, candidates] of duplicateGroups) {
    const winner = [...candidates].sort((left, right) => right.scores.weighted - left.scores.weighted || codeUnit(left.url, right.url))[0]!
    internalWinner.set(key, winner.candidateId)
  }
  const ownerDefinition = new Set(candidateMap.candidates
    .filter((candidate) => candidate.routeRole === 'definition' && candidate.siteId === candidate.conceptAuthority.canonicalOwner)
    .map((candidate) => `${candidate.siteId}:${topic(candidate)}`))

  const entries: SemanticEntry[] = candidateMap.candidates.map((candidate) => {
    const candidateTopic = topic(candidate)
    const sameSiteNearest = nearestSemanticRoute(candidate, observedBySite.get(candidate.siteId) ?? [])
    const crossSiteNearest = nearestSemanticRoute(candidate, allObserved)
    const nearest = sameSiteNearest?.similarity === 1 ? sameSiteNearest : crossSiteNearest
    const key = `${candidate.siteId}:${candidateTopic}:${candidate.routeRole}`
    let disposition: SemanticDisposition = 'retain-distinct'
    let reason = 'The route-role contract requires material not supplied by an observed route with the same subject.'
    let retainedBoundary: string | null = `The page must answer only the ${candidate.routeRole} intent; general definition material belongs to the canonical concept owner.`

    if (internalWinner.get(key) !== candidate.candidateId) {
      disposition = 'reject-internal-duplicate'
      reason = 'Another frozen candidate on the same property has the same topic and route role; the higher-scoring candidate is the single retained route.'
      retainedBoundary = null
    } else if (candidate.routeRole === 'definition' && sameSiteNearest && (sameSiteNearest.exactTopicSegment || sameSiteNearest.similarity >= .9)) {
      disposition = 'replace-with-existing-route'
      reason = 'An observed route on the same canonical host already defines this exact topic; a second definition would be a doorway duplicate.'
      retainedBoundary = null
    } else if (candidate.routeRole === 'definition' && candidate.siteId !== candidate.conceptAuthority.canonicalOwner) {
      if (ownerDefinition.has(`${candidate.conceptAuthority.canonicalOwner}:${candidateTopic}`)) {
        disposition = 'reject-cross-property-definition'
        reason = 'The canonical-owner property already has a frozen definition candidate for this topic; the local property must link to it rather than publish another definition.'
        retainedBoundary = null
      } else {
        disposition = 'revise-as-local-application'
        reason = 'This property does not own the concept family and no exact owner definition is available; revise the generic definition into a bounded local application before selection.'
        retainedBoundary = null
      }
    } else if (nearest && nearest.similarity >= .8 && candidate.routeRole !== 'definition') {
      reason = 'A semantically adjacent observed route exists, but this candidate is retained only if its role-specific answer, evidence and title remain non-overlapping.'
    }
    return { candidateId: candidate.candidateId, url: candidate.url, siteId: candidate.siteId, topic: candidateTopic, routeRole: candidate.routeRole, disposition, reason, nearestObserved: nearest, retainedBoundary }
  })
  const counts = Object.fromEntries([...new Set(entries.map((entry) => entry.disposition))].sort(codeUnit).map((state) => [state, entries.filter((entry) => entry.disposition === state).length]))
  const body = {
    schemaVersion: 'maha-federation-semantic-adjudication/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    method: {
      exactCandidateKey: 'site + normalized topic + route role',
      observedComparison: 'topic tokens against the final two observed path segments, with exact path segments taking precedence',
      definitionRule: 'An existing same-host subject route replaces a new definition. A non-owner property cannot publish a second generic definition.',
      nonDefinitionRule: 'A role-specific route may survive only with a recorded non-overlap boundary.',
      limitation: 'Semantic adjudication uses route semantics, not body-copy embeddings. Retained routes still require editorial non-overlap review before compilation.',
    },
    counts,
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function candidateDemand(candidate: Candidate, snapshot: GscSnapshot) {
  const topicWords = words(topic(candidate))
  const candidateCoverage = (other: string[]) => {
    const otherSet = new Set(other)
    return topicWords.filter((word) => otherSet.has(word)).length / Math.max(1, topicWords.length)
  }
  const queryMatches = snapshot.queries.map((row) => ({ row, similarity: candidateCoverage(words(row.query)) }))
    .filter(({ similarity }) => similarity >= .67)
    .sort((left, right) => right.row.impressions - left.row.impressions || right.similarity - left.similarity || codeUnit(left.row.query, right.row.query))
    .slice(0, 5)
  const pageMatches = snapshot.pages.map((row) => ({ row, similarity: candidateCoverage(observedSubject(row.url)) }))
    .filter(({ similarity }) => similarity >= .8)
    .sort((left, right) => right.row.impressions - left.row.impressions || right.similarity - left.similarity || codeUnit(left.row.url, right.row.url))
    .slice(0, 3)
  const queryImpressions = queryMatches.reduce((sum, match) => sum + match.row.impressions, 0)
  const queryClicks = queryMatches.reduce((sum, match) => sum + match.row.clicks, 0)
  const pageImpressions = pageMatches.reduce((sum, match) => sum + match.row.impressions, 0)
  const basis = queryMatches.length > 0 ? 'direct-topic-query-signal' : pageMatches.length > 0 ? 'adjacent-existing-page-signal' : 'unknown'
  const boost = Math.min(8, Math.log2(queryImpressions + 1) * 1.5) + Math.min(5, Math.log2(pageImpressions + 1))
  return {
    candidateId: candidate.candidateId,
    basis,
    queryImpressions,
    queryClicks,
    adjacentPageImpressions: pageImpressions,
    matchedQueries: queryMatches.map(({ row, similarity }) => ({ query: row.query, queryFingerprint: `sha256:${sha256Hex(row.query.toLowerCase())}`, clicks: row.clicks, impressions: row.impressions, position: row.position, similarity })),
    matchedPages: pageMatches.map(({ row, similarity }) => ({ url: row.url, clicks: row.clicks, impressions: row.impressions, position: row.position, similarity })),
    calibratedScore: Number((candidate.scores.weighted + boost).toFixed(2)),
    caveat: basis === 'unknown' ? 'No matching signal exists in the supplied seven-day GSC export.' : 'Observed signal is real but does not by itself justify a new route or predict future traffic.',
  }
}

export function calibrateDemand(candidateMap: CandidateMap, snapshot: GscSnapshot) {
  const entries = candidateMap.candidates.map((candidate) => candidateDemand(candidate, snapshot))
  const body = {
    schemaVersion: 'maha-federation-gsc-demand-calibration/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    snapshotDigest: snapshot.provenanceDigest,
    window: snapshot.window,
    sourceCounts: snapshot.sourceCounts,
    counts: {
      directTopicQuerySignal: entries.filter((entry) => entry.basis === 'direct-topic-query-signal').length,
      adjacentExistingPageSignal: entries.filter((entry) => entry.basis === 'adjacent-existing-page-signal').length,
      unknown: entries.filter((entry) => entry.basis === 'unknown').length,
    },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

const FAMILY_ANCHOR_TOPIC: Record<string, string> = {
  governance: 'tool-governance',
  evidence: 'source-identity',
  authority: 'identity-bound-agents',
  computation: 'calculation-inputs',
  release: 'release-manifest',
  consent: 'health-data-consent',
  interpretation: 'interpretation-boundaries',
  translation: 'primary-text-boundaries',
  risk: 'hazard-zones',
  autonomy: 'governed-autonomy',
}

const FAMILY_EXISTING_ANCHOR: Record<string, string> = {
  interpretation: 'https://www.mahastrategies.com/mps/source-interpretation-speculation',
  translation: 'https://www.mahastrategies.com/knowledge/religion/translation-and-semantic-range',
}

export function buildDependencyGraph(candidateMap: CandidateMap, semantic: ReturnType<typeof adjudicateSemantics>) {
  const semanticById = new Map(semantic.entries.map((entry) => [entry.candidateId, entry]))
  const retained = candidateMap.candidates.filter((candidate) => semanticById.get(candidate.candidateId)?.disposition === 'retain-distinct')
  const candidateByKey = new Map(retained.map((candidate) => [`${candidate.siteId}:${semanticTopic(topic(candidate))}:${candidate.routeRole}`, candidate]))
  const ownerByFamily = new Map<string, SiteId>(CONCEPT_FAMILIES)
  const anchors = new Map<string, { candidate: Candidate | null; existingUrl: string | null }>()
  for (const family of new Set(candidateMap.candidates.map((candidate) => candidate.conceptFamilyId))) {
    const owner = ownerByFamily.get(family)
    const anchorTopic = FAMILY_ANCHOR_TOPIC[family]
    const proposedAnchor = candidateMap.candidates.find((candidate) => candidate.siteId === owner && candidate.routeRole === 'definition' && topic(candidate) === anchorTopic)
    const retainedAnchor = proposedAnchor && semanticById.get(proposedAnchor.candidateId)?.disposition === 'retain-distinct' ? proposedAnchor : null
    const replacedBy = proposedAnchor && semanticById.get(proposedAnchor.candidateId)?.disposition === 'replace-with-existing-route'
      ? semanticById.get(proposedAnchor.candidateId)?.nearestObserved?.url ?? null
      : null
    const existingUrl = replacedBy ?? FAMILY_EXISTING_ANCHOR[family] ?? null
    if (!retainedAnchor && !existingUrl) throw new Error(`No retained or observed owner definition anchor for ${family}.`)
    anchors.set(family, { candidate: retainedAnchor, existingUrl })
  }
  const edges: Array<{ from: string; dependsOn: string; reason: string }> = []
  const observedTopicNodes = new Map<string, { nodeId: string; url: string; state: 'observed-owner-topic-definition' }>()
  const missingTopicNodes = new Map<string, { nodeId: string; siteId: string; topic: string; state: 'missing-owner-topic-definition' }>()
  for (const candidate of retained) {
    const dependencies = new Map<string, string>()
    const anchor = anchors.get(candidate.conceptFamilyId)!
    const anchorNodeId = anchor.candidate?.candidateId ?? `observed_${sha256Hex(anchor.existingUrl!).slice(0, 24)}`
    if (candidate.candidateId !== anchorNodeId) dependencies.set(anchorNodeId, 'canonical-family-owner-definition-first')
    const normalizedTopic = semanticTopic(topic(candidate))
    if (candidate.routeRole !== 'definition') {
      const localDefinition = candidateByKey.get(`${candidate.siteId}:${normalizedTopic}:definition`)
      if (localDefinition && localDefinition.candidateId !== candidate.candidateId) {
        dependencies.set(localDefinition.candidateId, 'local-topic-definition-first')
      } else {
        const replacedDefinition = candidateMap.candidates.find((entry) => entry.siteId === candidate.siteId && semanticTopic(topic(entry)) === normalizedTopic && entry.routeRole === 'definition' && semanticById.get(entry.candidateId)?.disposition === 'replace-with-existing-route')
        const existingUrl = replacedDefinition ? semanticById.get(replacedDefinition.candidateId)?.nearestObserved?.url ?? null : null
        if (existingUrl) {
          const nodeId = `observed_${sha256Hex(existingUrl).slice(0, 24)}`
          observedTopicNodes.set(nodeId, { nodeId, url: existingUrl, state: 'observed-owner-topic-definition' })
          dependencies.set(nodeId, 'observed-local-topic-definition-already-precedes-application')
        }
      }
    }
    if (candidate.siteId !== candidate.conceptAuthority.canonicalOwner) {
      const ownerDefinition = candidateByKey.get(`${candidate.conceptAuthority.canonicalOwner}:${normalizedTopic}:definition`)
      if (ownerDefinition) {
        dependencies.set(ownerDefinition.candidateId, 'canonical-owner-topic-definition-first')
      } else {
        const replacedOwnerDefinition = candidateMap.candidates.find((entry) => entry.siteId === candidate.conceptAuthority.canonicalOwner && semanticTopic(topic(entry)) === normalizedTopic && entry.routeRole === 'definition' && semanticById.get(entry.candidateId)?.disposition === 'replace-with-existing-route')
        const existingUrl = replacedOwnerDefinition ? semanticById.get(replacedOwnerDefinition.candidateId)?.nearestObserved?.url ?? null : null
        if (existingUrl) {
          const nodeId = `observed_${sha256Hex(existingUrl).slice(0, 24)}`
          observedTopicNodes.set(nodeId, { nodeId, url: existingUrl, state: 'observed-owner-topic-definition' })
          dependencies.set(nodeId, 'observed-canonical-owner-topic-definition-already-precedes-application')
        } else {
          const nodeId = `missing_${sha256Hex(`${candidate.conceptAuthority.canonicalOwner}:${normalizedTopic}`).slice(0, 24)}`
          missingTopicNodes.set(nodeId, { nodeId, siteId: candidate.conceptAuthority.canonicalOwner, topic: normalizedTopic, state: 'missing-owner-topic-definition' })
          dependencies.set(nodeId, 'missing-canonical-owner-topic-definition-blocks-application')
        }
      }
    }
    for (const [dependency, reason] of dependencies) {
      edges.push({ from: candidate.candidateId, dependsOn: dependency, reason })
    }
  }
  const nodes = candidateMap.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    url: candidate.url,
    siteId: candidate.siteId,
    topic: topic(candidate),
    routeRole: candidate.routeRole,
    semanticDisposition: semanticById.get(candidate.candidateId)!.disposition,
    isFamilyAnchor: anchors.get(candidate.conceptFamilyId)?.candidate?.candidateId === candidate.candidateId,
  }))
  const observedAnchorNodes = [...anchors].filter(([, anchor]) => anchor.existingUrl).map(([conceptFamilyId, anchor]) => ({
    nodeId: `observed_${sha256Hex(anchor.existingUrl!).slice(0, 24)}`,
    conceptFamilyId,
    url: anchor.existingUrl!,
    state: 'observed-owner-anchor' as const,
  }))
  const externalNodeIds = new Set([...observedAnchorNodes.map((node) => node.nodeId), ...observedTopicNodes.keys(), ...missingTopicNodes.keys()])
  const retainedIds = new Set(retained.map((candidate) => candidate.candidateId))
  const incoming = new Map([...retainedIds].map((id) => [id, 0]))
  const dependents = new Map<string, string[]>()
  for (const edge of edges) {
    if (retainedIds.has(edge.dependsOn)) {
      incoming.set(edge.from, (incoming.get(edge.from) ?? 0) + 1)
      dependents.set(edge.dependsOn, [...(dependents.get(edge.dependsOn) ?? []), edge.from])
    }
  }
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id).sort(codeUnit)
  const topologicalOrder: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    topologicalOrder.push(id)
    for (const dependent of (dependents.get(id) ?? []).sort(codeUnit)) {
      const next = incoming.get(dependent)! - 1
      incoming.set(dependent, next)
      if (next === 0) {
        queue.push(dependent)
        queue.sort(codeUnit)
      }
    }
  }
  if (topologicalOrder.length !== retained.length) throw new Error('Federation dependency graph contains a cycle.')
  const body = {
    schemaVersion: 'maha-federation-dependency-graph/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    semanticAdjudicationDigest: semantic.provenanceDigest,
    relationshipVocabulary: RELATIONSHIP_TYPES,
    rule: 'Canonical family-owner definitions and local topic definitions must precede dependent application routes.',
    anchors: [...anchors].sort(([left], [right]) => codeUnit(left, right)).map(([conceptFamilyId, anchor]) => ({ conceptFamilyId, canonicalOwner: ownerByFamily.get(conceptFamilyId), anchorType: anchor.candidate ? 'frozen-candidate' : 'observed-route', candidateId: anchor.candidate?.candidateId ?? null, nodeId: anchor.candidate?.candidateId ?? `observed_${sha256Hex(anchor.existingUrl!).slice(0, 24)}`, url: anchor.candidate?.url ?? anchor.existingUrl! })),
    counts: { nodes: nodes.length + externalNodeIds.size, candidateNodes: nodes.length, observedAnchorNodes: new Set([...observedAnchorNodes.map((node) => node.nodeId), ...observedTopicNodes.keys()]).size, missingOwnerTopicNodes: missingTopicNodes.size, retainedNodes: retained.length, dependencyReadyNodes: retained.filter((candidate) => !(edges.some((edge) => edge.from === candidate.candidateId && missingTopicNodes.has(edge.dependsOn)))).length, excludedNodes: nodes.length - retained.length, edges: edges.length, cycles: 0 },
    nodes,
    observedAnchorNodes,
    observedTopicNodes: [...observedTopicNodes.values()].sort((left, right) => codeUnit(left.nodeId, right.nodeId)),
    missingOwnerTopicNodes: [...missingTopicNodes.values()].sort((left, right) => codeUnit(left.nodeId, right.nodeId)),
    edges: edges.sort((left, right) => codeUnit(`${left.from}:${left.dependsOn}`, `${right.from}:${right.dependsOn}`)),
    topologicalOrder,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function evidenceRequirements(candidate: Candidate) {
  const site = SITE_CONTRACTS.find((contract) => contract.siteId === candidate.siteId)!
  const common = {
    sourceIdentity: 'Canonical title, responsible institution or author, version/date, and stable URL or identifier must be verified.',
    locator: 'Every explanatory assertion requires an exact section, paragraph, figure, table, equation, or versioned specification anchor.',
    rights: 'Record access basis and quotation boundary; store fingerprints and locators rather than redistributing restricted full text.',
    scope: `Evidence must support the ${candidate.routeRole} intent without inheriting authority from a related concept or property.`,
    boundary: site.prohibited.join('; '),
  }
  if (candidate.siteId === 'maha-policy') return { ...common, minimumIndependentSources: 2, sourceClasses: ['current primary law, regulator, or standards text', 'independent implementation or outcome evidence'], additionalFrame: 'Separate current law, observed evidence, Maha proposal, tradeoffs, jurisdiction, effective date, and uncertainty.' }
  if (candidate.siteId === 'maha-research') return { ...common, minimumIndependentSources: 1, sourceClasses: ['primary specification, standard, dataset documentation, government publication, or research paper'], additionalFrame: 'State what the source establishes, what it does not establish, and the reproduction boundary.' }
  if (candidate.siteId === 'agentic-publishing') return { ...common, minimumIndependentSources: 1, sourceClasses: ['primary editorial standard, rights authority, publisher protocol, or versioned technical specification'], additionalFrame: 'Separate workflow recommendation from binding rights or legal requirements.' }
  if (candidate.siteId === 'maha-os') return { ...common, minimumIndependentSources: 2, sourceClasses: ['primary technical specification', 'independent privacy, security, safety, or health authority'], additionalFrame: 'No diagnosis or clinical efficacy claim; state local/cloud data movement and consent revocation explicitly.' }
  if (candidate.siteId === 'mayone-maharajan') return { ...common, minimumIndependentSources: 1, sourceClasses: ['identified book passage or authorial primary source', 'independent source only where historical or empirical context is asserted'], additionalFrame: 'Label authorial thesis, interpretation, historical claim, and empirical claim separately.' }
  if (candidate.siteId === 'mayon-rajan') return { ...common, minimumIndependentSources: 1, sourceClasses: ['PHIVOLCS or other current official hazard source', 'peer-reviewed or government background source where needed'], additionalFrame: 'Never substitute for live official alerts; include source date and geographic applicability.' }
  return { ...common, minimumIndependentSources: 1, sourceClasses: ['canonical owner evidence', 'operational or empirical source for the local application'], additionalFrame: 'Keep general definition, bounded application, commercial statement, and observed performance distinct.' }
}

export function selectTrancheOne(
  candidateMap: CandidateMap,
  semantic: ReturnType<typeof adjudicateSemantics>,
  graph: ReturnType<typeof buildDependencyGraph>,
  demand: ReturnType<typeof calibrateDemand>,
) {
  const propertyLimits: Record<SiteId, number> = {
    'maha-strategies': 31,
    'maha-research': 25,
    'agentic-publishing': 10,
    'maha-os': 6,
    'mayone-maharajan': 5,
    'mayon-rajan': 5,
    'maha-policy': 18,
  }
  const candidateById = new Map(candidateMap.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const semanticById = new Map(semantic.entries.map((entry) => [entry.candidateId, entry]))
  const demandById = new Map(demand.entries.map((entry) => [entry.candidateId, entry]))
  const dependencies = new Map<string, string[]>()
  const missingNodeIds = new Set(graph.missingOwnerTopicNodes.map((node) => node.nodeId))
  const blockedByMissingOwner = new Set(graph.edges.filter((edge) => missingNodeIds.has(edge.dependsOn)).map((edge) => edge.from))
  for (const edge of graph.edges) {
    if (candidateById.has(edge.dependsOn)) dependencies.set(edge.from, [...(dependencies.get(edge.from) ?? []), edge.dependsOn])
  }
  const retained = candidateMap.candidates.filter((candidate) => semanticById.get(candidate.candidateId)?.disposition === 'retain-distinct' && !blockedByMissingOwner.has(candidate.candidateId))
  const ranked = retained.sort((left, right) => demandById.get(right.candidateId)!.calibratedScore - demandById.get(left.candidateId)!.calibratedScore || codeUnit(left.url, right.url))
  const selected = new Set<string>()
  const closure = (id: string, accumulator = new Set<string>()): Set<string> => {
    if (accumulator.has(id)) return accumulator
    accumulator.add(id)
    for (const dependency of dependencies.get(id) ?? []) closure(dependency, accumulator)
    return accumulator
  }
  const addIfFits = (candidate: Candidate) => {
    const needed = [...closure(candidate.candidateId)].filter((id) => !selected.has(id))
    if (selected.size + needed.length > 100) return false
    const prospective = new Map<string, number>()
    const prospectiveSites = new Map<SiteId, number>()
    for (const id of selected) {
      const entry = candidateById.get(id)!
      const key = `${entry.siteId}:${topic(entry)}`
      prospective.set(key, (prospective.get(key) ?? 0) + 1)
      prospectiveSites.set(entry.siteId, (prospectiveSites.get(entry.siteId) ?? 0) + 1)
    }
    for (const id of needed) {
      const entry = candidateById.get(id)!
      const key = `${entry.siteId}:${topic(entry)}`
      const next = (prospective.get(key) ?? 0) + 1
      if (next > 4) return false
      prospective.set(key, next)
      const siteNext = (prospectiveSites.get(entry.siteId) ?? 0) + 1
      if (siteNext > propertyLimits[entry.siteId]) return false
      prospectiveSites.set(entry.siteId, siteNext)
    }
    needed.forEach((id) => selected.add(id))
    return true
  }
  for (const anchor of graph.anchors) {
    if (anchor.candidateId) addIfFits(candidateById.get(anchor.candidateId)!)
  }
  for (const contract of SITE_CONTRACTS) {
    for (const candidate of ranked.filter((entry) => entry.siteId === contract.siteId).slice(0, 3)) addIfFits(candidate)
  }
  for (const candidate of ranked) {
    if (selected.size === 100) break
    addIfFits(candidate)
  }
  if (selected.size !== 100) throw new Error(`Dependency-aware cohort must contain 100 candidates; selected ${selected.size}.`)
  const orderIndex = new Map(graph.topologicalOrder.map((id, index) => [id, index]))
  const ordered = [...selected].sort((left, right) => orderIndex.get(left)! - orderIndex.get(right)!)
  const entries = ordered.map((id, index) => {
    const candidate = candidateById.get(id)!
    const demandEntry = demandById.get(id)!
    return {
      cohortOrder: index + 1,
      candidateId: id,
      url: candidate.url,
      siteId: candidate.siteId,
      topic: topic(candidate),
      routeRole: candidate.routeRole,
      calibratedScore: demandEntry.calibratedScore,
      demandBasis: demandEntry.basis,
      dependencies: (dependencies.get(id) ?? []).filter((dependency) => selected.has(dependency)),
      evidenceRequirements: evidenceRequirements(candidate),
      evidenceState: 'not-inspected',
      pageSpecEligible: false,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-tranche-one-cohort/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    semanticAdjudicationDigest: semantic.provenanceDigest,
    dependencyGraphDigest: graph.provenanceDigest,
    demandCalibrationDigest: demand.provenanceDigest,
    status: 'frozen-for-evidence-intake',
    selectionRule: 'Family anchors first, then three high-utility candidates per property, then calibrated score within a proportional property cap; every dependency closure must fit inside the 100-record bound.',
    propertyLimits,
    counts: { selected: entries.length, byProperty: Object.fromEntries(SITE_CONTRACTS.map((contract) => [contract.siteId, entries.filter((entry) => entry.siteId === contract.siteId).length])), inspected: 0, evidenceReady: 0, pageSpecs: 0 },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}
