import { provenanceDigest } from './evidence-dossier/digest.ts'
import { SITE_CONTRACTS, type SiteId } from './federation-4000-plan.ts'

type Decision = {
  candidateId: string
  url: string
  title: string
  siteId: string
  topic: string
  routeRole: string
  disposition: string
  reason: string
  topicPacketKey: string
  topicPacketDigest: string
}

type Specification = {
  candidateId: string
  url: string
  title: string
  siteId?: string
  topic?: string
  routeRole: string
  answerContract: string
  requiredSections: string[]
  boundedQuestions: string[]
  sourceBindings: Array<{ sourceId: string; locator: string; scope: string; boundary: string }>
  dependencies: Record<string, unknown>
  structuredData: { type: string; noRatingOrEndorsement: boolean }
  machineContract: Record<string, boolean>
  implementationState: string
}

type Packet = {
  topicKey: string
  disposition: string
  reason: string
  sources: Array<{
    sourceId: string
    title: string
    responsibleBody: string
    versionOrDate: string
    url: string
    sourceClass: string
    rightsBasis: string
    inspectionDepth: string
    locator: string
    scope: string
    boundary: string
    contentFingerprint?: string
  }>
}

type Candidate = {
  candidateId: string
  siteId: SiteId
  canonicalHost: string
  path: string
  url: string
  title: string
  conceptId: string
  conceptFamilyId: string
  conceptAuthority: { canonicalOwner: SiteId; role: string; boundary: string }
  typedRelationships: Array<{ type: string; target: string }>
  routeContract: { allowedContent: string[]; mustNotClaim: string[] }
}

type Inputs = {
  candidateMap: { provenanceDigest: string; candidates: Candidate[] }
  priorRelationshipHorizon?: number
  tranches: Array<{
    tranche: 1 | 2
    decisions: { provenanceDigest: string; entries: Decision[] }
    specifications: { provenanceDigest: string; specifications: Specification[] }
    packets: { provenanceDigest: string; packets: Packet[] }
  }>
  supplements?: Array<{
    batchId: string
    tranche: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
    decisions: { provenanceDigest: string; entries: Decision[] }
    specifications: { provenanceDigest: string; specifications: Specification[] }
    packets: { provenanceDigest: string; packets: Packet[] }
  }>
}

type DependencyLink = {
  url: string
  relationship: string
  availability: 'implemented-in-this-batch' | 'observed-existing' | 'unready-candidate'
  candidateId: string | null
}

const codeUnit = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const sentence = (value: string) => /[.!?]$/.test(value) ? value : `${value}.`
const lowerInitial = (value: string) => value.length ? `${value[0]!.toLowerCase()}${value.slice(1)}` : value
const titleCase = (value: string) => value.split('-').map((part) => part === 'ai' ? 'AI' : part === 'mcp' ? 'MCP' : part === 'oauth' ? 'OAuth' : part.charAt(0).toUpperCase() + part.slice(1)).join(' ')

const ROLE_LABELS: Record<string, string> = {
  architecture: 'architecture',
  'commercial-use': 'commercial-use boundary',
  comparison: 'comparison',
  controls: 'control model',
  'current-law': 'current-law summary',
  definition: 'definition',
  development: 'development account',
  evidence: 'evidence assessment',
  example: 'worked example',
  'failure-mode': 'failure-mode analysis',
  'failure-modes': 'failure-mode analysis',
  fixture: 'reproducibility fixture',
  implementation: 'implementation guide',
  limits: 'limits guide',
  'machine-interface': 'machine interface',
  'machine-record': 'machine record',
  mechanisms: 'mechanism analysis',
  method: 'method',
  'official-sources': 'official-source guide',
  'operator-guide': 'operator guide',
  preparedness: 'preparedness guide',
  protocol: 'protocol',
  relationship: 'relationship map',
  relationships: 'relationship map',
  reproducibility: 'reproducibility guide',
  'source-contract': 'source contract',
  sources: 'source register',
  template: 'template',
  threats: 'threat analysis',
  uncertainty: 'uncertainty analysis',
  verification: 'verification guide',
  'worked-example': 'worked example',
  workflow: 'workflow',
}

const ROLE_METHODS: Record<string, [string, string]> = {
  definition: ['Use the term only for the source-backed scope stated here; keep adjacent concepts separate unless a typed relationship is explicit.', 'A useful definition states both inclusion and exclusion conditions so a machine answer cannot silently widen it.'],
  architecture: ['Describe components, trust boundaries, decisions, and handoffs before naming implementation benefits.', 'An architecture is incomplete when it hides which component refuses an invalid, stale, unauthorized, or unsupported request.'],
  controls: ['State the controlled input, decision rule, observable failure, and evidence that the control ran.', 'A control description is not evidence of effectiveness; verification and operational observation remain separate.'],
  threats: ['Begin with the source-backed condition whose failure creates the threat, then name detection and refusal behavior.', 'Do not imply that naming a threat proves mitigation or exhausts the attack surface.'],
  implementation: ['Translate the source-backed rule into inspectable inputs, state transitions, outputs, and refusal conditions.', 'Local code can demonstrate behavior, but it cannot supply independent assurance or prove the surrounding deployment is configured correctly.'],
  verification: ['Recompute or re-observe the relevant identity, digest, state, or output instead of trusting a self-declared success field.', 'A verifier must distinguish missing evidence, failed observation, mismatch, and confirmed success.'],
  commercialization: ['Separate the implemented capability from price, availability, delivery terms, and customer outcomes.', 'No commercial statement is publishable until its current offer contract and delivery boundary are independently established.'],
  protocol: ['Present steps in order with required inputs, outputs, stop conditions, and a rollback or correction path.', 'A protocol is reproducible only to the extent that its inputs, versions, assumptions, and decision rules are fixed.'],
  method: ['Name the model or method, its inputs, assumptions, transformations, and validity conditions.', 'A valid calculation under a stated model does not establish that the model answers the real-world question.'],
  fixture: ['Use synthetic or openly licensed inputs with fixed versions and an independently recomputable digest.', 'A fixture proves a mechanism can be exercised; it is not evidence of production operation or external validation.'],
  'source-contract': ['Accept a source only after identity, version, locator, rights, claim scope, and boundary checks all pass.', 'Metadata or topical similarity alone cannot satisfy passage-level support.'],
  'machine-record': ['Expose stable field names, typed states, version identifiers, digests, and refusal codes.', 'Machine readability describes representation, not truth, review quality, or release authority.'],
  relationships: ['Name the relationship type and direction, then state what does not transfer across the edge.', 'A relationship does not make two concepts equivalent or transfer evidence, legal authority, or empirical validity.'],
  relationship: ['Name the relationship type and direction, then state what does not transfer across the edge.', 'A relationship does not make two concepts equivalent or transfer evidence, legal authority, or empirical validity.'],
  comparison: ['Compare the same dimension on both sides and preserve differences in jurisdiction, source class, version, and scope.', 'Shared vocabulary is not equivalence, and a policy comparison is not legal advice.'],
  'current-law': ['Name the jurisdiction, instrument, article, effective context, and material scope before summarizing a rule.', 'Current-law pages are informational, can become stale, and do not replace qualified legal advice.'],
  mechanisms: ['Separate the mechanism proposed by the source from observed outcomes and from Maha’s interpretation.', 'A plausible mechanism is not proof of causality, sufficiency, or effect size.'],
  sources: ['Order authorities by role, version, jurisdiction, and freshness rather than treating every link as interchangeable.', 'A source list is useful only when each source’s scope and boundary remain attached.'],
  'official-sources': ['Identify the operational authority and explain how to find its freshest dated statement.', 'This page never substitutes for a current bulletin, evacuation order, or local authority.'],
  'operator-guide': ['Tell the operator what to check before acting, when to refuse, and how to preserve evidence of the outcome.', 'The guide cannot infer that a device, service, source, or credential is healthy when observation is unavailable.'],
  limits: ['State the strongest supported boundary first and route time-sensitive decisions to the current authority.', 'A limits page must not turn a warning into a weaker version of the unsupported claim.'],
  'failure-mode': ['Describe the failed invariant, observable signal, safe refusal, and correction or recovery path.', 'An absent signal is not proof of success unless the protocol defines and validates that interpretation.'],
  'failure-modes': ['Describe the failed invariant, observable signal, safe refusal, and correction or recovery path.', 'An absent signal is not proof of success unless the protocol defines and validates that interpretation.'],
  template: ['Expose required fields, their authority, allowed values, and validation failures without pre-filling unknown evidence.', 'A complete-looking template must not manufacture review, rights, measurements, or release state.'],
  example: ['Use bounded inputs and carry every assumption, source, and limitation into the result.', 'The example demonstrates a method and must not be presented as a production observation.'],
  'worked-example': ['Use bounded inputs and carry every assumption, source, unit, uncertainty, and limitation into the result.', 'A worked result is conditional on the stated inputs and must not be generalized beyond them.'],
  uncertainty: ['Separate measured uncertainty, model limitation, unresolved evidence, and future-change risk.', 'Unknown is a valid state and must not be replaced with an invented probability or confidence score.'],
  workflow: ['Show the ordered states, authorization boundaries, handoffs, replay rules, and terminal outcomes.', 'A workflow diagram does not prove that a remote provider, payment, release, or delivery occurred.'],
  'machine-interface': ['Define request and response fields, versions, identifiers, error states, and replay behavior.', 'An interface contract must preserve unknown and refusal states and cannot imply a service is available.'],
  evidence: ['Bind each conclusion to the source and locator that can carry it, keeping contrary or missing evidence visible.', 'Evidence quality and sufficiency remain claim-specific; one source cannot automatically support every adjacent assertion.'],
  preparedness: ['Separate durable preparedness steps from current hazard conditions and operational orders.', 'Preparedness education never substitutes for official, current emergency instructions.'],
  development: ['Trace the concept through dated authorial stages and identify revisions, departures, and unresolved tensions.', 'Authorial development is not historical consensus or empirical validation.'],
  reproducibility: ['Record inputs, versions, environment, method, uncertainty, and digest checks needed for an independent rerun.', 'Reproducibility does not establish correctness, external validity, or scientific importance.'],
}

function roleMethod(role: string): [string, string] {
  return ROLE_METHODS[role] ?? [
    'Keep the answer within the inspected source scope and make every operational step or conceptual relation explicit.',
    'Do not use completeness of presentation as a substitute for evidence, review, or release.',
  ]
}

function dependencyObjects(value: unknown): Array<{ url: string; relationship: string; candidateId: string | null }> {
  const found: Array<{ url: string; relationship: string; candidateId: string | null }> = []
  const visit = (node: unknown, inherited = 'related-definition') => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, inherited))
      return
    }
    const record = node as Record<string, unknown>
    const relationship = typeof record.reason === 'string' ? record.reason : inherited
    if (typeof record.url === 'string' && record.url.startsWith('https://')) {
      const candidateId = typeof record.candidateId === 'string'
        ? record.candidateId
        : typeof record.dependsOn === 'string' && record.dependsOn.startsWith('cand_') ? record.dependsOn : null
      found.push({ url: record.url, relationship, candidateId })
    }
    for (const [key, child] of Object.entries(record)) {
      if (key !== 'url' && key !== 'candidateId' && key !== 'dependsOn' && key !== 'reason') visit(child, key)
    }
  }
  visit(value)
  return [...new Map(found.map((entry) => [`${entry.url}:${entry.relationship}`, entry])).values()].sort((left, right) => codeUnit(left.url, right.url) || codeUnit(left.relationship, right.relationship))
}

function directAnswer(topic: string, role: string, scopes: string[]) {
  const label = ROLE_LABELS[role] ?? titleCase(role)
  const scopeText = scopes.map(sentence).join(' ')
  return `${titleCase(topic)}, in this ${label}, is limited to the following inspected scope. ${scopeText} The answer carries the source boundaries forward and does not infer authority from a neighboring topic.`
}

function sourceAnswer(sources: Packet['sources']) {
  return sources.map((source) => `${source.title} (${source.versionOrDate}), at ${source.locator}, supports ${lowerInitial(source.scope)}`).join(' ')
}

function boundaryAnswer(sources: Packet['sources'], propertyBoundary: string) {
  return `${sources.map((source) => sentence(source.boundary)).join(' ')} Property boundary: ${sentence(propertyBoundary)}`
}

function definitionAnswer(links: DependencyLink[], canonicalOwner: string) {
  const first = links.find((link) => link.relationship.includes('definition'))
  return first
    ? `Read the ${canonicalOwner} definition at ${first.url} first. The present page applies that definition through its narrower route role.`
    : `This page is the local ${canonicalOwner} definition for its topic. Related applications may depend on it but may not silently redefine it.`
}

function revisionAnswer() {
  return `Re-evaluate this page when a cited source, locator, governing instrument, local implementation, or canonical definition changes. Publication also requires a matching exact-revision review and active canonical release.`
}

function publicSource(source: Packet['sources'][number]) {
  return {
    sourceId: source.sourceId,
    title: source.title,
    responsibleBody: source.responsibleBody,
    versionOrDate: source.versionOrDate,
    sourceClass: source.sourceClass,
    url: source.url.startsWith('https://') ? source.url : null,
    locator: source.locator,
    establishes: source.scope,
    doesNotEstablish: source.boundary,
    rightsBasis: source.rightsBasis,
    inspectionDepth: source.inspectionDepth,
    contentFingerprint: source.contentFingerprint ?? null,
  }
}

export function compileFederationPages(inputs: Inputs) {
  const candidates = new Map(inputs.candidateMap.candidates.map((entry) => [entry.candidateId, entry]))
  const sourceSets = [
    ...inputs.tranches.map((entry) => ({ ...entry, batchId: `tranche-${entry.tranche}` })),
    ...(inputs.supplements ?? []),
  ]
  const allDecisions = sourceSets.flatMap((sourceSet) => sourceSet.decisions.entries.map((entry) => ({ ...entry, tranche: sourceSet.tranche, batchId: sourceSet.batchId })))
  const decisionById = new Map(allDecisions.map((entry) => [entry.candidateId, entry]))
  const readyIds = new Set([...decisionById.values()].filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  const packetBySourceSetAndKey = new Map(sourceSets.flatMap((sourceSet) => sourceSet.packets.packets.map((packet) => [`${sourceSet.batchId}:${packet.topicKey}`, packet] as const)))
  const specs = sourceSets.flatMap((sourceSet) => sourceSet.specifications.specifications.map((specification) => ({ specification, tranche: sourceSet.tranche, batchId: sourceSet.batchId })))
  const relationshipEligible = (pageTranche: number, siblingTranche: number) => inputs.priorRelationshipHorizon === undefined
    || siblingTranche <= Math.max(pageTranche, inputs.priorRelationshipHorizon)
  if (specs.length !== readyIds.size) throw new Error(`Expected one specification for each of ${readyIds.size} evidence-ready decisions; received ${specs.length}.`)

  const drafts = specs.map(({ specification, tranche, batchId }) => {
    const candidate = candidates.get(specification.candidateId)
    const decision = decisionById.get(specification.candidateId)
    if (!candidate || !decision) throw new Error(`Missing candidate or decision for ${specification.candidateId}.`)
    if (decision.disposition !== 'evidence-ready') throw new Error(`Specification exists for non-ready candidate ${specification.candidateId}.`)
    if (decision.batchId !== batchId) throw new Error(`Specification and active decision disagree on source set for ${specification.candidateId}.`)
    const packet = packetBySourceSetAndKey.get(`${batchId}:${decision.topicPacketKey}`)
    if (!packet) throw new Error(`Missing packet ${decision.topicPacketKey} for ${batchId}.`)
    const dependencies = dependencyObjects(specification.dependencies).map((dependency): DependencyLink => ({
      ...dependency,
      availability: dependency.candidateId
        ? readyIds.has(dependency.candidateId) ? 'implemented-in-this-batch' : 'unready-candidate'
        : 'observed-existing',
    }))
    const blockedDependencies = dependencies.filter((entry) => entry.availability === 'unready-candidate')
    const safeLinks = dependencies.filter((entry) => entry.availability !== 'unready-candidate')
    const contract = SITE_CONTRACTS.find((entry) => entry.siteId === candidate.siteId)
    if (!contract) throw new Error(`Missing site contract for ${candidate.siteId}.`)
    const sources = packet.sources.map(publicSource)
    const scopes = sources.map((source) => source.establishes)
    const boundaries = sources.map((source) => source.doesNotEstablish)
    const answer = directAnswer(decision.topic, decision.routeRole, scopes)
    const [roleMethodOne, roleMethodTwo] = roleMethod(decision.routeRole)
    const topicSiblings = specs
      .filter((entry) => entry.specification.candidateId !== specification.candidateId)
      .map((entry) => ({ entry, candidate: candidates.get(entry.specification.candidateId) }))
      .filter(({ entry, candidate: sibling }) => relationshipEligible(tranche, entry.tranche) && sibling?.siteId === candidate.siteId && decisionById.get(sibling.candidateId)?.topic === decision.topic)
      .slice(0, 3)
      .map(({ entry }) => ({ url: entry.specification.url, relationship: 'same-topic-application', availability: 'implemented-in-this-batch' as const, candidateId: entry.specification.candidateId }))
    const relatedLinks = [...new Map([...safeLinks, ...topicSiblings, { url: `https://${candidate.canonicalHost}/`, relationship: 'property-home', availability: 'observed-existing' as const, candidateId: null }].map((entry) => [entry.url, entry])).values()]
    const qa = specification.boundedQuestions.map((question, index) => ({
      question,
      answer: [
        answer,
        sourceAnswer(packet.sources),
        boundaryAnswer(packet.sources, candidate.conceptAuthority.boundary),
        definitionAnswer(relatedLinks, candidate.conceptAuthority.canonicalOwner),
        revisionAnswer(),
      ][index]!,
    }))
    const body = {
      schemaVersion: 'maha-federation-page/1.0',
      candidateId: specification.candidateId,
      tranche,
      siteId: candidate.siteId,
      canonicalHost: candidate.canonicalHost,
      path: candidate.path,
      canonicalUrl: candidate.url,
      title: candidate.title,
      topic: decision.topic,
      routeRole: decision.routeRole,
      concept: {
        conceptId: candidate.conceptId,
        familyId: candidate.conceptFamilyId,
        canonicalOwner: candidate.conceptAuthority.canonicalOwner,
        authorityRole: candidate.conceptAuthority.role,
        boundary: candidate.conceptAuthority.boundary,
        typedRelationships: candidate.typedRelationships,
      },
      directAnswer: answer,
      sections: [
        { heading: 'Direct answer', kind: 'answer', paragraphs: [answer] },
        { heading: specification.requiredSections[1] && specification.requiredSections[1] !== 'Role-specific answer' ? specification.requiredSections[1] : titleCase(ROLE_LABELS[decision.routeRole] ?? decision.routeRole), kind: 'role-method', paragraphs: [roleMethodOne, roleMethodTwo, `Applied scope: ${scopes.map(sentence).join(' ')}`] },
        { heading: 'Definition and operating context', kind: 'authority', paragraphs: [`The canonical concept owner is ${candidate.conceptAuthority.canonicalOwner}. ${sentence(candidate.conceptAuthority.boundary)}`, `This property may publish ${contract.allowed.join(', ')}. It must not publish ${contract.prohibited.join(' or ')}.`] },
        { heading: 'Evidence and exact locators', kind: 'evidence', paragraphs: sources.map((source) => `${source.title} — ${source.locator}. Establishes: ${sentence(source.establishes)}`) },
        { heading: 'What the evidence does not establish', kind: 'limitations', paragraphs: [...boundaries.map(sentence), ...candidate.routeContract.mustNotClaim.map((claim) => `This route must not claim ${claim}.`)] },
        { heading: 'Related definitions and applications', kind: 'relationships', paragraphs: relatedLinks.map((link) => `${link.relationship}: ${link.url}`) },
      ],
      sources,
      relatedLinks,
      boundedAnswers: qa,
      qualityDimensions: ['direct-answer', 'role-specific-method', 'claim-level-source-binding', 'exact-locators', 'source-boundaries', 'authority-boundary', 'typed-related-links', 'bounded-question-registry'],
      structuredData: {
        '@context': 'https://schema.org',
        '@type': specification.structuredData.type,
        '@id': `${candidate.url}#article`,
        headline: candidate.title,
        url: candidate.url,
        isPartOf: `https://${candidate.canonicalHost}/`,
        citation: sources.flatMap((source) => source.url ? [source.url] : []),
        mainEntity: qa.map((entry) => ({ '@type': 'Question', name: entry.question, acceptedAnswer: { '@type': 'Answer', text: entry.answer } })),
      },
      sourcePolicy: {
        exactLocatorsRequired: true,
        noSourceTextRetained: true,
        unsupportedValuesRemainUnknown: true,
        noRatingOrEndorsement: true,
      },
      adoption: {
        state: blockedDependencies.length ? 'blocked-on-unready-prerequisite' : 'ready-for-owner-integration',
        blockedDependencies,
        routeFileCreated: false,
        exactRevisionReviewed: false,
        canonicallyReleased: false,
        crawlable: false,
      },
      provenance: {
        candidateMapDigest: inputs.candidateMap.provenanceDigest,
        sourceSetId: batchId,
        decisionManifestDigest: sourceSets.find((entry) => entry.batchId === batchId)!.decisions.provenanceDigest,
        decisionDigest: provenanceDigest(decision),
        specificationManifestDigest: sourceSets.find((entry) => entry.batchId === batchId)!.specifications.provenanceDigest,
        specificationDigest: provenanceDigest(specification),
        packetManifestDigest: sourceSets.find((entry) => entry.batchId === batchId)!.packets.provenanceDigest,
        packetDigest: provenanceDigest(packet),
      },
    }
    return { ...body, contentDigest: provenanceDigest(body) }
  }).sort((left, right) => codeUnit(left.canonicalUrl, right.canonicalUrl))

  const pages = drafts.map((page) => {
    const pageSiblingLinks = drafts
      .filter((entry) => relationshipEligible(page.tranche, entry.tranche) && entry.candidateId !== page.candidateId && entry.siteId === page.siteId && entry.topic === page.topic)
      .slice(0, 3)
      .map((entry) => ({ url: entry.canonicalUrl, relationship: 'same-topic-application', availability: 'implemented-in-this-batch' as const, candidateId: entry.candidateId }))
    if (pageSiblingLinks.every((link) => page.relatedLinks.some((existing) => existing.url === link.url))) return page
    const relatedLinks = [...new Map([...page.relatedLinks, ...pageSiblingLinks].map((entry) => [entry.url, entry])).values()]
    const sections = page.sections.map((section) => section.kind === 'relationships'
      ? { ...section, paragraphs: relatedLinks.map((link) => `${link.relationship}: ${link.url}`) }
      : section)
    const withoutDigest = { ...page, relatedLinks, sections }
    delete (withoutDigest as Partial<typeof page>).contentDigest
    return { ...withoutDigest, contentDigest: provenanceDigest(withoutDigest) }
  })

  const duplicateDigests = [...new Set(pages.map((entry) => entry.contentDigest))].length !== pages.length
  if (duplicateDigests) throw new Error('Federation pages must have unique content digests.')
  const byProperty = Object.fromEntries(SITE_CONTRACTS.map((contract) => [contract.siteId, pages.filter((entry) => entry.siteId === contract.siteId).length])) as Record<SiteId, number>
  const registryBody = {
    schemaVersion: 'maha-federation-page-implementation-registry/1.0',
    generatedFrom: sourceSets.map((sourceSet) => ({ batchId: sourceSet.batchId, tranche: sourceSet.tranche, decisionManifestDigest: sourceSet.decisions.provenanceDigest, specificationManifestDigest: sourceSet.specifications.provenanceDigest, packetManifestDigest: sourceSet.packets.provenanceDigest })),
    status: 'local-unreleased',
    counts: {
      pages: pages.length,
      readyForOwnerIntegration: pages.filter((entry) => entry.adoption.state === 'ready-for-owner-integration').length,
      blockedOnUnreadyPrerequisite: pages.filter((entry) => entry.adoption.state === 'blocked-on-unready-prerequisite').length,
      byProperty,
      boundedAnswers: pages.reduce((sum, entry) => sum + entry.boundedAnswers.length, 0),
      sourceBindings: pages.reduce((sum, entry) => sum + entry.sources.length, 0),
      publicRoutesCreated: 0,
      nextBuildsRun: 0,
      vercelBuildsRun: 0,
    },
    releaseBoundary: 'These records are local content implementations. Their owning properties must adopt and verify them. No route exists until an owner adapter is added; no page may become crawlable before exact-revision review, canonical release where applicable, and explicit build/deployment authorization.',
    entries: pages.map((entry) => ({ candidateId: entry.candidateId, siteId: entry.siteId, canonicalUrl: entry.canonicalUrl, contentDigest: entry.contentDigest, adoptionState: entry.adoption.state, blockedDependencies: entry.adoption.blockedDependencies })),
  }
  const registry = { ...registryBody, provenanceDigest: provenanceDigest(registryBody) }
  const propertyManifests = SITE_CONTRACTS.map((contract) => {
    const propertyPages = pages.filter((entry) => entry.siteId === contract.siteId)
    const body = {
      schemaVersion: 'maha-federation-property-pages/1.0',
      siteId: contract.siteId,
      canonicalHost: contract.canonicalHost,
      registryDigest: registry.provenanceDigest,
      status: 'local-unreleased',
      counts: { pages: propertyPages.length, readyForOwnerIntegration: propertyPages.filter((entry) => entry.adoption.state === 'ready-for-owner-integration').length, blockedOnUnreadyPrerequisite: propertyPages.filter((entry) => entry.adoption.state === 'blocked-on-unready-prerequisite').length },
      pages: propertyPages,
    }
    return { ...body, provenanceDigest: provenanceDigest(body) }
  })
  return { pages, registry, propertyManifests }
}
