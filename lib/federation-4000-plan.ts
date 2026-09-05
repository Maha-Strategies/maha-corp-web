import { provenanceDigest, sha256Hex } from './evidence-dossier/digest.ts'

export const FEDERATION_TARGET = 4_000
export const CANDIDATE_COUNT = 1_628

const compareCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const list = (value: string) => value.trim().split(/\s+/)

export const RELATIONSHIP_TYPES = [
  'governed-by',
  'evidence-for',
  'implemented-by',
  'published-as',
  'derived-from',
  'contrasts-with',
  'applies-to',
  'limits',
  'commercialized-through',
] as const

export const CONCEPT_FAMILIES = [
  ['governance', 'maha-policy'],
  ['evidence', 'maha-research'],
  ['provenance', 'maha-research'],
  ['authority', 'maha-strategies'],
  ['uncertainty', 'maha-research'],
  ['release', 'agentic-publishing'],
  ['identity', 'maha-strategies'],
  ['consent', 'maha-os'],
  ['rights', 'agentic-publishing'],
  ['risk', 'mayon-rajan'],
  ['resilience', 'maha-os'],
  ['measurement', 'maha-research'],
  ['interpretation', 'maha-strategies'],
  ['translation', 'maha-strategies'],
  ['computation', 'maha-research'],
  ['autonomy', 'mayone-maharajan'],
  ['sovereignty', 'mayone-maharajan'],
  ['memory', 'agentic-publishing'],
  ['public-trust', 'maha-policy'],
  ['communication', 'mayon-rajan'],
] as const

export type SiteId =
  | 'maha-strategies'
  | 'maha-research'
  | 'agentic-publishing'
  | 'maha-os'
  | 'mayone-maharajan'
  | 'mayon-rajan'
  | 'maha-policy'

type Group = {
  id: string
  siteId: SiteId
  prefix: string
  family: string
  topics: string[]
  lenses: string[]
  evidenceAvailability: number
  differentiation: number
  machineUtility: number
  commercialProximity: number
}

const MAIN_AGENT_TOPICS = list(`
  enterprise-mcp-gateway tool-authorization identity-bound-agents capability-scoped-tokens
  human-approval-gates replay-safe-execution quota-enforcement metered-evidence-retrieval
  credential-rotation tenant-isolation endpoint-substitution-defense audit-receipts
  durable-task-state agent-memory-governance context-budgeting failure-recovery
  machine-commerce-entitlement delivery-acknowledgement provenance-witnessing cross-agent-delegation
`)
const MAIN_EVIDENCE_TOPICS = list(`
  claim-intake source-identity version-relationship locator-verification passage-support
  rights-basis conflicting-literature uncertainty-recording unsupported-inference internal-review
  canonical-release source-recovery correction-and-retraction calculation-receipts runtime-witness-receipts
  evidence-dossiers privacy-boundary audit-export licensed-retrieval delivery-acknowledgement
`)
const MAIN_MATH_TOPICS = list(`
  deterministic-arithmetic uncertainty-propagation reference-frame-conversion numerical-stability
  interval-bounds dimensional-analysis calibration error-budgets reproducibility-fixtures
  root-finding interpolation numerical-integration optimization causal-inference
  cryptographic-commitments formal-verification
`)
const MAIN_ASTROLOGY_TOPICS = list(`
  birth-time-input location-input timezone-resolution ephemeris-selection ayanamsha-selection
  house-system-selection coordinate-frames uncertainty-bounds missing-inputs rectification-limits
  prospective-registration falsifiability tradition-comparison interpretation-boundaries
`)
const MAIN_TAMIL_TOPICS = list(`
  mayon tirumal kannan narayana mullai kurinji marutam neytal palai paripatal
  sangam-landscapes divine-epithets alvar-reception primary-text-boundaries
`)
const MAIN_BOOK_TOPICS = list(`
  maha-principle cosmic-recursion mental-sovereignty biological-digital-sovereignty
  civilizational-computation epistemic-clearance recursive-institutions governed-autonomy
`)

const RESEARCH_TOPICS = list(`
  source-identity source-version doi-resolution repository-copy author-manuscript government-mirror
  passage-locator section-locator figure-locator table-locator equation-locator claim-extraction
  scope-matching contradiction-search literature-conflict rights-basis inspection-depth
  metadata-only-evidence abstract-only-evidence full-text-evidence primary-source
  dataset-provenance software-environment compiler-provenance random-seed container-image slurm-job
  qiskit-circuit calculation-inputs units assumptions uncertainty propagation reproducibility
  formal-definition theorem-statement proof-status counterexample benchmark-design evaluation-protocol
  calibration measurement-error model-boundary inference-boundary retraction correction citation-lineage
  evidence-graph provenance-graph research-release
`)
const PUBLISH_TOPICS = list(`
  agentic-query-letter editorial-intake author-identity source-rights citation-verification
  manuscript-versioning machine-authorship-disclosure human-review editorial-review fact-checking
  correction-policy retraction-policy release-manifest context-pack structured-abstract
  machine-readable-article licensed-delivery delivery-receipt acknowledgement publishing-observability
`)
const OS_TOPICS = list(`
  on-device-inference biometric-data-boundary health-data-consent sensor-provenance local-memory
  cloud-escalation private-compute model-update device-identity household-agents caregiver-access
  emergency-override data-retention user-revocation offline-operation resilience-mode
  personal-knowledge-store consent-receipts health-claim-boundaries wellness-recommendation-limits
`)
const AUTHOR_TOPICS = list(`
  maha-principle cosmic-recursion mental-sovereignty civilizational-memory governed-autonomy
  recursive-institutions machine-civilization human-agency public-reason epistemic-infrastructure authorial-lineage
`)
const VOLCANO_TOPICS = list(`
  identity-and-location eruption-history hazard-zones ashfall lahar pyroclastic-density-current
  evacuation official-alerts monitoring seismicity deformation gas-emissions rainfall-triggered-hazards
  community-preparedness infrastructure-resilience name-disambiguation
`)
const POLICY_TOPICS = list(`
  ai-agent-accountability automated-decision-governance algorithmic-impact-assessment public-sector-procurement
  model-evaluation auditability traceability data-protection biometric-governance health-ai-governance
  scientific-evidence-policy standards-and-conformity assurance-cases incident-reporting
  human-oversight capability-controls tool-governance agent-identity machine-contracting
  competition-policy intellectual-property copyright-and-training-data research-integrity export-controls
  semiconductor-policy quantum-policy digital-public-infrastructure interoperability public-trust international-coordination
`)

export const GROUPS: Group[] = [
  { id: 'applied-agent-governance', siteId: 'maha-strategies', prefix: '/clearing/agent-governance', family: 'authority', topics: MAIN_AGENT_TOPICS, lenses: list('definition architecture controls threats implementation verification commercialization'), evidenceAvailability: 82, differentiation: 90, machineUtility: 98, commercialProximity: 96 },
  { id: 'evidence-workflows', siteId: 'maha-strategies', prefix: '/clearing/evidence-workflows', family: 'evidence', topics: MAIN_EVIDENCE_TOPICS, lenses: list('definition workflow failure-modes verification commercial-use'), evidenceAvailability: 92, differentiation: 94, machineUtility: 98, commercialProximity: 96 },
  { id: 'applied-mathematics-astronomy', siteId: 'maha-strategies', prefix: '/clearing/deterministic-computation', family: 'computation', topics: MAIN_MATH_TOPICS, lenses: list('definition worked-example uncertainty reproducibility machine-interface'), evidenceAvailability: 94, differentiation: 82, machineUtility: 94, commercialProximity: 74 },
  { id: 'astrology-infrastructure', siteId: 'maha-strategies', prefix: '/clearing/astrology-infrastructure', family: 'interpretation', topics: MAIN_ASTROLOGY_TOPICS, lenses: list('input-contract workflow calculation uncertainty evaluation'), evidenceAvailability: 78, differentiation: 90, machineUtility: 86, commercialProximity: 72 },
  { id: 'tamil-religion', siteId: 'maha-strategies', prefix: '/clearing/tamil-religion', family: 'translation', topics: MAIN_TAMIL_TOPICS, lenses: list('identity primary-text translation commentary relationship'), evidenceAvailability: 84, differentiation: 99, machineUtility: 83, commercialProximity: 54 },
  { id: 'book-concepts', siteId: 'maha-strategies', prefix: '/clearing/book-concepts', family: 'authority', topics: MAIN_BOOK_TOPICS, lenses: list('definition argument genealogy application critique'), evidenceAvailability: 70, differentiation: 98, machineUtility: 78, commercialProximity: 82 },
  { id: 'research-objects', siteId: 'maha-research', prefix: '/federation/research', family: 'evidence', topics: RESEARCH_TOPICS, lenses: list('definition source-contract method protocol fixture failure-mode machine-record relationships'), evidenceAvailability: 96, differentiation: 96, machineUtility: 99, commercialProximity: 78 },
  { id: 'agentic-publishing', siteId: 'agentic-publishing', prefix: '/agentic-publishing', family: 'release', topics: PUBLISH_TOPICS, lenses: list('definition workflow policy template example failure-mode machine-interface governance'), evidenceAvailability: 86, differentiation: 98, machineUtility: 94, commercialProximity: 90 },
  { id: 'private-machine-systems', siteId: 'maha-os', prefix: '/knowledge/private-machine-systems', family: 'consent', topics: OS_TOPICS, lenses: list('definition architecture controls failure-mode operator-guide'), evidenceAvailability: 82, differentiation: 94, machineUtility: 91, commercialProximity: 84 },
  { id: 'authorial-concepts', siteId: 'mayone-maharajan', prefix: '/concepts', family: 'autonomy', topics: AUTHOR_TOPICS, lenses: list('definition argument origin development relationship application critique limits'), evidenceAvailability: 72, differentiation: 99, machineUtility: 72, commercialProximity: 68 },
  { id: 'mayon-volcano', siteId: 'mayon-rajan', prefix: '/mayon-volcano', family: 'risk', topics: VOLCANO_TOPICS, lenses: list('definition evidence preparedness official-sources limits'), evidenceAvailability: 92, differentiation: 84, machineUtility: 80, commercialProximity: 56 },
  { id: 'policy-clearing', siteId: 'maha-policy', prefix: '/policy', family: 'governance', topics: POLICY_TOPICS, lenses: list('definition current-law evidence mechanisms implementation tradeoffs uncertainty comparison machine-rule sources'), evidenceAvailability: 90, differentiation: 96, machineUtility: 96, commercialProximity: 88 },
]

export const SITE_CONTRACTS = [
  { siteId: 'maha-strategies', canonicalHost: 'www.mahastrategies.com', current: 2_003, candidates: 500, projected: 2_503, role: 'Applied epistemic clearing, governed agent operations, bounded answers, and commercial discovery.', allowed: ['bounded explanations', 'operational guides', 'commercial entry points'], prohibited: ['research-source duplication', 'unreleased evidence claims'] },
  { siteId: 'maha-research', canonicalHost: 'research.mahastrategies.com', current: 291, candidates: 400, projected: 691, role: 'Canonical source, claim, method, dataset, calculation, reproduction, and evidence-graph authority.', allowed: ['research objects', 'machine-readable provenance', 'reproduction protocols'], prohibited: ['sales copy', 'unsupported interpretation'] },
  { siteId: 'agentic-publishing', canonicalHost: 'publish.mahastrategies.com', current: 30, candidates: 160, projected: 190, role: 'Agentic editorial workflow, rights, context packs, publication releases, and delivery.', allowed: ['publishing protocols', 'editorial templates', 'release guidance'], prohibited: ['duplicate research records', 'unlabelled machine authorship'] },
  { siteId: 'maha-os', canonicalHost: 'www.maha-os.com', current: 13, candidates: 100, projected: 113, role: 'On-device and private AI, health-data consent, local memory, and resilient operation.', allowed: ['private-system architecture', 'consent controls', 'operator guidance'], prohibited: ['medical diagnosis', 'cloud-first defaults presented as private'] },
  { siteId: 'mayone-maharajan', canonicalHost: 'www.mayonemaharajan.com', current: 18, candidates: 88, projected: 106, role: 'Canonical authorial concepts, book lineages, intellectual history, and declared thesis.', allowed: ['authorial interpretation', 'concept genealogy', 'book relationships'], prohibited: ['authorial thesis presented as consensus', 'empirical authority transfer'] },
  { siteId: 'mayon-rajan', canonicalHost: 'mayonrajan.com', current: 17, candidates: 80, projected: 97, role: 'Mayon Volcano identity, hazard literacy, place, preparedness, and public communication.', allowed: ['bounded hazard education', 'official-source routing', 'place interpretation'], prohibited: ['real-time alert substitution', 'religious-name conflation'] },
  { siteId: 'maha-policy', canonicalHost: 'policy.mahastrategies.com', current: 0, candidates: 300, projected: 300, role: 'Policy evidence, governance mechanisms, implementation comparisons, and machine-readable policy rules.', allowed: ['current-law summaries', 'policy evidence', 'Maha proposals labelled as proposals'], prohibited: ['legal advice', 'proposal presented as enacted law'] },
] as const

export type FrozenBaseline = {
  provenanceDigest: string
  totals: { observedCanonicalRoutes: number; targetCanonicalRoutes: number; candidateGap: number }
  observedProperties: Array<{ siteId: string; canonicalHost: string; routeCount: number; routes: string[] }>
  proposedProperties: Array<{ siteId: string; canonicalHost: string; routeCount: number; routes: string[]; state: string }>
}

function title(value: string): string {
  return value.split('-').map((word) => word === 'ai' ? 'AI' : word === 'mcp' ? 'MCP' : word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function tokens(value: string): Set<string> {
  return new Set(decodeURIComponent(value).toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 1))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((value) => b.has(value)).length
  return intersection / (a.size + b.size - intersection || 1)
}

function nearestObserved(url: string, observed: string[]): { url: string | null; tokenJaccard: number } {
  if (observed.length === 0) return { url: null, tokenJaccard: 0 }
  const candidateTokens = tokens(new URL(url).pathname)
  let nearest = observed[0]!
  let score = -1
  for (const route of observed) {
    const similarity = jaccard(candidateTokens, tokens(new URL(route).pathname))
    if (similarity > score || (similarity === score && compareCodeUnit(route, nearest) < 0)) {
      nearest = route
      score = similarity
    }
  }
  return { url: nearest, tokenJaccard: Number(score.toFixed(4)) }
}

function siteDemandPrior(siteId: SiteId): number {
  return ({ 'maha-strategies': 92, 'maha-research': 68, 'agentic-publishing': 72, 'maha-os': 76, 'mayone-maharajan': 62, 'mayon-rajan': 78, 'maha-policy': 82 })[siteId]
}

function buildArchitecture(baseline: FrozenBaseline) {
  const body = {
    schemaVersion: 'maha-federation-architecture/1.0',
    frozenOn: '2026-09-05',
    baselineDigest: baseline.provenanceDigest,
    targetCanonicalRoutes: FEDERATION_TARGET,
    principles: [
      'Every route is self-canonical on exactly one host.',
      'Every broad concept family has exactly one declared canonical owner.',
      'Other properties publish bounded local applications, not duplicate definitions.',
      'A typed relationship creates a link; it does not automatically create a page.',
      'Authority never transfers across a relationship.',
      'Candidate status never implies inspection, review, release, compilation, or publication.',
    ],
    conceptFamilies: CONCEPT_FAMILIES.map(([conceptFamilyId, canonicalOwner]) => ({ conceptFamilyId, canonicalOwner, canonicalConceptId: `urn:maha:concept:${conceptFamilyId}` })),
    relationshipTypes: RELATIONSHIP_TYPES,
    properties: SITE_CONTRACTS,
    crossPropertyRules: {
      copiedBodyTextForbidden: true,
      selfCanonicalRequired: true,
      oneCanonicalOwnerPerConceptFamily: true,
      relationshipDoesNotTransferAuthority: true,
      policyFrameSeparation: ['current-law', 'observed-evidence', 'maha-proposal', 'tradeoffs', 'uncertainty'],
      hazardSafety: 'Educational pages must route readers to current official sources and never replace official alerts.',
      authorialBoundary: 'Authorial thesis and interpretation must remain distinct from empirical or consensus authority.',
    },
    releaseProtocol: {
      requiredGates: ['candidate-frozen', 'source-identity-verified', 'content-and-locator-inspected', 'alignment-clear', 'exact-revision-reviewed', 'active-canonical-release', 'compiled-and-verified'],
      vercelBuildRequiresOperatorApproval: true,
      remoteBuildAuthorized: false,
      previewAuthorized: false,
      deploymentAuthorized: false,
      dnsMutationAuthorized: false,
      productionMutationAuthorized: false,
    },
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

export function generateFederationPlan(baseline: FrozenBaseline) {
  if (baseline.totals.observedCanonicalRoutes !== 2_372 || baseline.totals.candidateGap !== CANDIDATE_COUNT) {
    throw new Error('The candidate map requires the reviewed 2,372-route baseline and 1,628-route gap.')
  }
  const observedBySite = new Map<string, string[]>(baseline.observedProperties.map((property) => [property.siteId, property.routes]))
  observedBySite.set('maha-policy', [])
  const contractBySite = new Map(SITE_CONTRACTS.map((contract) => [contract.siteId, contract]))
  const architecture = buildArchitecture(baseline)
  const candidates = GROUPS.flatMap((group) => group.topics.flatMap((topic, topicIndex) => group.lenses.map((lens, lensIndex) => {
    const contract = contractBySite.get(group.siteId)!
    const path = `${group.prefix}/${topic}/${lens}`
    const url = `https://${contract.canonicalHost}${path}`
    const nearest = nearestObserved(url, observedBySite.get(group.siteId) ?? [])
    const demand = Math.max(1, Math.min(100, siteDemandPrior(group.siteId) - (topicIndex % 7) * 2 - (lensIndex % 3)))
    const duplicationSafety = Math.round((1 - nearest.tokenJaccard) * 100)
    const federationUtility = group.siteId === 'maha-policy' ? 98 : 86 + (lensIndex % 5) * 2
    const weighted = demand * .18 + group.evidenceAvailability * .20 + group.differentiation * .15 + group.machineUtility * .17 + group.commercialProximity * .12 + federationUtility * .13 + duplicationSafety * .05
    const conceptId = `urn:maha:concept:${group.family}:${topic}`
    const family = CONCEPT_FAMILIES.find(([id]) => id === group.family)
    if (!family) throw new Error(`Unknown concept family ${group.family}.`)
    const canonicalOwner = family[1]
    const body = {
      candidateId: `cand_${sha256Hex(url).slice(0, 24)}`,
      siteId: group.siteId,
      canonicalHost: contract.canonicalHost,
      groupId: group.id,
      routeRole: lens,
      path,
      url,
      title: `${title(topic)} — ${title(lens)}`,
      searchIntent: `Understand ${title(topic)} through the ${title(lens).toLowerCase()} lens in ${title(group.id)} on ${contract.canonicalHost}.`,
      demandEvidence: {
        basis: 'category-prior-not-observed',
        observedQueries: 0,
        observedImpressions: null,
        warning: 'This score orders research only. It is not route-specific search evidence or a publication claim.',
      },
      conceptId,
      conceptFamilyId: group.family,
      conceptAuthority: {
        canonicalOwner,
        role: canonicalOwner === group.siteId ? 'owner-application' : 'local-application',
        boundary: `This route may apply ${group.family}; it cannot redefine or inherit the authority of its canonical owner.`,
      },
      typedRelationships: [
        { type: 'applies-to', target: conceptId },
        ...(group.siteId === 'maha-policy'
          ? [{ type: 'implemented-by', target: 'urn:maha:property:maha-strategies' }]
          : [{ type: 'governed-by', target: 'urn:maha:concept:governance' }]),
        { type: 'evidence-for', target: `urn:maha:concept:${group.family}` },
      ],
      evidencePlan: {
        sourceIdentity: 'not-started',
        contentInspection: 'not-started',
        locatorInspection: 'not-started',
        rightsReview: 'not-started',
        alignmentAudit: 'not-started',
        exactRevisionReview: 'not-started',
      },
      routeContract: {
        selfCanonical: true,
        canonicalOwner: group.siteId,
        allowedContent: contract.allowed,
        mustNotClaim: contract.prohibited,
      },
      duplicateScreen: {
        nearestObservedUrl: nearest.url,
        tokenJaccard: nearest.tokenJaccard,
        status: nearest.tokenJaccard >= .75 ? 'editorial-review-required' : 'no-high-similarity-observed',
      },
      scores: {
        searchDemandPrior: demand,
        evidenceAvailability: group.evidenceAvailability,
        differentiation: group.differentiation,
        machineUtility: group.machineUtility,
        commercialProximity: group.commercialProximity,
        federationUtility,
        duplicationSafety,
        weighted: Number(weighted.toFixed(2)),
      },
      publication: {
        state: 'candidate-only',
        inspected: false,
        reviewed: false,
        canonicallyReleased: false,
        compiled: false,
        crawlable: false,
      },
    }
    return body
  })))
  if (candidates.length !== CANDIDATE_COUNT) throw new Error(`Expected ${CANDIDATE_COUNT} candidates; generated ${candidates.length}.`)
  const urls = candidates.map((candidate) => candidate.url)
  if (new Set(urls).size !== urls.length) throw new Error('Duplicate candidate URL generated.')
  const observed = new Set(baseline.observedProperties.flatMap((property) => property.routes))
  const collision = urls.find((url) => observed.has(url))
  if (collision) throw new Error(`Candidate collides with observed route: ${collision}`)
  const sorted = [...candidates].sort((a, b) => b.scores.weighted - a.scores.weighted || compareCodeUnit(a.url, b.url))
    .map((candidate, index) => ({ ...candidate, rank: index + 1, tranche: index < 400 ? 1 : index < 800 ? 2 : index < 1_200 ? 3 : 4 }))
  const allocation = SITE_CONTRACTS.map((contract) => {
    const candidateCount = sorted.filter((candidate) => candidate.siteId === contract.siteId).length
    if (candidateCount !== contract.candidates) throw new Error(`${contract.siteId} allocation mismatch: ${candidateCount}.`)
    return { siteId: contract.siteId, observed: contract.current, candidates: candidateCount, projected: contract.current + candidateCount }
  })
  const candidateBody = {
    schemaVersion: 'maha-federation-route-candidate-map/1.0',
    frozenOn: '2026-09-05',
    baselineDigest: baseline.provenanceDigest,
    architectureDigest: architecture.provenanceDigest,
    status: 'candidate-freeze-only',
    summary: { observedCanonicalRoutes: 2_372, frozenCandidates: CANDIDATE_COUNT, projectedCanonicalRoutes: FEDERATION_TARGET },
    scoring: {
      weights: { searchDemandPrior: .18, evidenceAvailability: .20, differentiation: .15, machineUtility: .17, commercialProximity: .12, federationUtility: .13, duplicationSafety: .05 },
      caveat: 'Scores prioritize research. They do not establish demand, evidentiary readiness, release readiness, or publication entitlement.',
    },
    executionState: { researchStarted: false, reviewsCreated: false, releasesCreated: false, routesCompiled: false, buildRun: false, previewCreated: false, deployed: false, dnsChanged: false },
    requiredGates: architecture.releaseProtocol.requiredGates,
    tranches: [
      { tranche: 1, startRank: 1, endRank: 400, candidateCount: 400 },
      { tranche: 2, startRank: 401, endRank: 800, candidateCount: 400 },
      { tranche: 3, startRank: 801, endRank: 1_200, candidateCount: 400 },
      { tranche: 4, startRank: 1_201, endRank: 1_628, candidateCount: 428 },
    ],
    allocation,
    candidates: sorted,
  }
  return { architecture, candidateMap: { ...candidateBody, provenanceDigest: provenanceDigest(candidateBody) } }
}
