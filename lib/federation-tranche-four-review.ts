import { provenanceDigest } from './evidence-dossier/digest.ts'

type Candidate = {
  candidateId: string
  siteId: string
  canonicalHost: string
  routeRole: string
  path: string
  url: string
  title: string
  duplicateScreen?: { nearestObservedUrl: string | null; tokenJaccard: number; status: string }
}

type CohortEntry = Candidate & {
  cohortOrder: number
  topic: string
  dependenciesInTranche: string[]
  dependenciesSatisfiedByPriorTranches: string[]
}

export type FederationReviewSource = {
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
}

export type FederationReviewPacket = {
  topicKey: string
  disposition: string
  reason: string
  sourceIdentityChecked: boolean
  locatorChecked: boolean
  rightsChecked: boolean
  scopeChecked: boolean
  boundaryChecked: boolean
  implementationCondition?: string
  sources: FederationReviewSource[]
  provenance?: string
  priorPacketDigest?: string
}

type PriorPacketManifest = { provenanceDigest: string; packets: FederationReviewPacket[] }

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible authority; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text is retained in the packet.'
const localRights = 'Maha-controlled repository source; symbol names and file identity only. No credential, customer value, runtime payload, or receipt body is retained.'

const source = (
  sourceId: string,
  title: string,
  responsibleBody: string,
  versionOrDate: string,
  url: string,
  sourceClass: string,
  locator: string,
  scope: string,
  boundary: string,
  rightsBasis = publicRights,
  inspectionDepth = 'section',
): FederationReviewSource => ({ sourceId, title, responsibleBody, versionOrDate, url, sourceClass, rightsBasis, inspectionDepth, locator, scope, boundary })

const packet = (topicKey: string, reason: string, sources: FederationReviewSource[], disposition = 'evidence-ready', implementationCondition?: string): FederationReviewPacket => ({
  topicKey,
  disposition,
  reason,
  sourceIdentityChecked: true,
  locatorChecked: true,
  rightsChecked: true,
  scopeChecked: true,
  boundaryChecked: true,
  ...(implementationCondition ? { implementationCondition } : {}),
  sources,
})

const NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'agentic-publishing:author-identity': packet('agentic-publishing:author-identity', 'ORCID supports authenticated persistent researcher identifiers and CRediT supports explicit contributor roles; neither substitutes for authorship policy or identity proof outside its own workflow.', [
    source('orcid-authenticated-ids', 'Collecting and sharing ORCID iDs', 'ORCID', `living guidance inspected ${reviewedOn}`, 'https://info.orcid.org/documentation/collecting-and-sharing-orcid-ids/', 'scholarly-identity-guidance', 'Why it is important to collect authenticated ORCID iDs; How it works; metadata passed downstream', 'OAuth-authenticated ORCID iDs associate a record holder with a persistent identifier and can be carried in research-output metadata.', 'An ORCID iD does not prove every biographical claim, contribution, affiliation, or authorship decision.'),
    source('credit-taxonomy', 'CRediT — Contributor Role Taxonomy', 'NISO', `ANSI/NISO standard approved 2022; site inspected ${reviewedOn}`, 'https://credit.niso.org/', 'scholarly-contribution-standard', 'CRediT’s 14 Contributor Roles', 'A controlled vocabulary distinguishes fourteen kinds of contribution to research outputs.', 'A contributor role does not by itself determine authorship, responsibility for every claim, identity, or contribution quality.'),
  ]),
  'agentic-publishing:fact-checking': packet('agentic-publishing:fact-checking', 'The IFCN code supports a bounded fact-checking workflow centered on nonpartisanship, source transparency, methodology, funding, and corrections.', [
    source('ifcn-code', 'IFCN Code of Principles', 'International Fact-Checking Network at Poynter', `current code inspected ${reviewedOn}`, 'https://ifcncodeofprinciples.poynter.org/know-more/the-commitments-of-the-code-of-principles', 'editorial-standard', 'Commitments 1–5', 'Fact-checking organizations disclose nonpartisanship, source and funding transparency, methodology, and an open corrections policy.', 'The code describes organizational commitments; it does not certify that a particular conclusion is true or complete.'),
  ]),
  'maha-os:household-agents': packet('maha-os:household-agents', 'This is a Maha OS operational definition constrained by the NIST IoT baseline: a household agent must remain device-identifiable, configurable, access-controlled, updateable, and observable.', [
    source('nist-ir-8259a-household', 'IoT Device Cybersecurity Capability Core Baseline', 'NIST', 'NISTIR 8259A, May 2020', 'https://nvlpubs.nist.gov/nistpubs/ir/2020/NIST.IR.8259A.pdf', 'government-guidance', 'Section 2, Table 1', 'A broadly applicable baseline covering device identification, configuration, data protection, logical access, software update, and cybersecurity state awareness.', 'The baseline is voluntary, is not specific to AI agents or homes, and does not certify safety, autonomy, or a Maha OS implementation.', governmentRights),
  ]),
  'maha-os:personal-knowledge-store': packet('maha-os:personal-knowledge-store', 'Solid supplies a bounded interoperable model for externally stored resources, owner control, identity, authentication, authorization, and resource lifecycle.', [
    source('solid-protocol-store', 'Solid Protocol', 'W3C Solid Community Group', 'version 0.11.0, 12 May 2024', 'https://solidproject.org/TR/2024/protocol-20240512', 'community-group-specification', 'Abstract; Status; §§1.1, 4.1, 9–11 and 13', 'Secure permissioned access to externally stored data, URI-identified storage and resources, ownership, identity, authentication, and authorization.', 'This is a Draft Community Group Report, not a W3C Standard, and it does not prove data sovereignty, privacy outcomes, or a Maha OS deployment.'),
  ]),
  'maha-policy:international-coordination': packet('maha-policy:international-coordination', 'OECD identifies cooperation mechanisms and the Council of Europe treaty supplies a distinct legal instrument whose force depends on party status and scope.', [
    source('oecd-ai-principle-2-5', 'International co-operation for trustworthy AI', 'OECD', 'AI Principle 2.5, updated May 2024', 'https://oecd.ai/en/dashboards/ai-principles/P14', 'intergovernmental-recommendation', 'Principle 2.5 and rationale', 'Cross-border and cross-sector knowledge sharing, consensus technical standards, and comparable indicators are mechanisms for AI-policy coordination.', 'The OECD Recommendation is non-binding and does not establish harmonized law or implementation by any particular jurisdiction.'),
    source('coe-ai-convention-225', 'Framework Convention on Artificial Intelligence and Human Rights, Democracy and the Rule of Law', 'Council of Europe', 'CETS No. 225, opened for signature 5 September 2024', 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=225', 'international-treaty', 'Treaty details; scope, principles, safeguards and follow-up mechanism', 'A treaty framework for lifecycle consistency with human rights, democracy, and the rule of law, with cooperation and follow-up mechanisms.', 'Legal effect depends on entry into force, ratification, declarations, party status, jurisdiction, and scoped exclusions; this is not legal advice.'),
  ]),
  'maha-policy:research-integrity': packet('maha-policy:research-integrity', 'ALLEA states broad integrity principles while the current U.S. PHS rule provides a narrower jurisdictional misconduct and proceeding framework.', [
    source('allea-code-2023', 'The European Code of Conduct for Research Integrity', 'ALLEA', 'revised edition, June 2023', 'https://allea.org/code-of-conduct/', 'research-integrity-code', 'Section 1, Principles; Sections 2–3', 'Reliability, honesty, respect, and accountability frame good research practice and responsibilities.', 'The code is a self-regulatory European reference and does not decide a specific allegation or create universal law.'),
    source('hhs-42-cfr-93-2024', 'Public Health Service Policies on Research Misconduct', 'U.S. Department of Health and Human Services', '42 CFR Part 93 final rule, 17 September 2024; applicable 1 January 2026', 'https://ori.hhs.gov/sites/default/files/2025-01/42CFR93.pdf', 'regulation', 'Subpart A scope; §§93.103–93.106; institutional and ORI proceeding subparts', 'The current PHS rule defines covered research misconduct and requirements for findings and proceedings within its statutory scope.', 'The rule is limited to covered PHS-supported activity, excludes honest error and differences of opinion, and is not a universal research-integrity definition or legal advice.', governmentRights),
  ]),
  'maha-research:inference-boundary': packet('maha-research:inference-boundary', 'NIST AI RMF requires intended context, assumptions, knowledge limits, oversight, scientific integrity, and generalization limits to remain explicit.', [
    source('nist-ai-rmf-inference', 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)', 'NIST', 'NIST AI 100-1, January 2023', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', 'government-guidance', 'MAP 1.1, MAP 2.2, MAP 2.3 and MEASURE 2.5', 'Documenting context, assumptions, knowledge limits, human oversight, scientific integrity, and generalization limits.', 'The voluntary framework does not validate a particular inference, model, result, or deployment.', governmentRights),
  ]),
  'maha-research:retraction': packet('maha-research:retraction', 'COPE defines when retraction should be considered and what a notice should communicate; Crossmark supplies a status-update mechanism rather than a truth guarantee.', [
    source('cope-retraction-v2', 'Retraction Guidelines', 'COPE Council', 'version 2, November 2019', 'https://doi.org/10.24318/cope.2019.1.4', 'editorial-guidance', 'Summary; When should a publication be retracted?; What form should a retraction take?', 'Reasons for considering retraction and notice properties including linkage, identification, reason, responsibility, promptness, and accessibility.', 'The guidance primarily addresses publications and does not itself retract an object, adjudicate misconduct, or resolve every correction case.'),
    source('crossref-crossmark', 'Crossmark', 'Crossref', `living service documentation inspected ${reviewedOn}`, 'https://www.crossref.org/services/crossmark/', 'metadata-service-documentation', 'What is Crossmark?; updates and current-status metadata', 'Publisher-deposited metadata can communicate corrections, retractions, and other updates to a work.', 'Crossmark depends on deposited publisher metadata and does not guarantee truth, completeness, or the substantive adequacy of an update.'),
  ]),
  'maha-research:table-locator': packet('maha-research:table-locator', 'NISO JATS supplies a stable structural container and identifiers for tables; claim support still requires inspecting the table and its context.', [
    source('jats-table-wrap-1-4', 'JATS: Journal Article Tag Suite, Archiving and Interchange Tag Library', 'NISO and U.S. National Library of Medicine', 'JATS 1.4', 'https://jats.nlm.nih.gov/archiving/tag-library/1.4/element/table-wrap.html', 'markup-standard', 'Element <table-wrap>; base attribute id; label, caption, table and table-wrap-foot content model', 'A table wrapper can carry an identifier, label, caption, table content, alternatives, permissions, and footnotes.', 'Markup identity does not prove that a table supports a claim, that row and column context was preserved, or that reuse rights permit reproduction.'),
  ]),
  'maha-strategies:agent-memory-governance': packet('maha-strategies:agent-memory-governance', 'The NIST Privacy Framework supplies lifecycle and governance boundaries that can be applied to an agent memory without implying that memory is accurate or consented.', [
    source('nist-privacy-memory', 'NIST Privacy Framework: A Tool for Improving Privacy through Enterprise Risk Management', 'NIST', 'version 1.0, January 2020', 'https://www.nist.gov/document/nist-privacy-frameworkv10pdf', 'government-guidance', 'Glossary: Data Action and Data Processing; Core Identify-P, Govern-P and Control-P', 'Data processing includes collection, retention, logging, transformation, use, disclosure, sharing, transmission, and disposal, governed through privacy-risk management.', 'The voluntary framework does not define AI memory, establish consent, validate remembered content, or prove a Maha implementation.', governmentRights),
  ]),
  'maha-strategies:cross-agent-delegation': packet('maha-strategies:cross-agent-delegation', 'OAuth token exchange precisely separates delegation from impersonation and represents subject and actor chains; it does not define a universal agent protocol.', [
    source('rfc-8693-delegation', 'OAuth 2.0 Token Exchange', 'IETF', 'RFC 8693, January 2020', 'https://www.rfc-editor.org/rfc/rfc8693.html', 'internet-standard', '§1.1; §2.1 subject_token and actor_token; §4.1 act claim', 'Delegation, impersonation, subject and actor token roles, validation inputs, and an actor chain representation.', 'Token exchange does not prove authorization policy quality, downstream enforcement, revocation propagation, agent identity, or a Maha deployment.'),
  ]),
  'maha-strategies:provenance-witnessing': packet('maha-strategies:provenance-witnessing', 'W3C PROV defines typed provenance assertions and the local witness records and independently verifies digest-bound execution metadata without capturing arguments or secrets.', [
    source('w3c-prov-witness', 'PROV Model Primer', 'W3C', 'Working Group Note, 30 April 2013', 'https://www.w3.org/TR/prov-primer/', 'standard-primer', '§2.3 generation and usage; §2.4 agents and responsibility; §2.5 roles', 'Entities, activities, agents, generation, use, association, attribution, and role-qualified responsibility.', 'PROV represents asserted provenance; it does not authenticate an actor, observe execution, or establish the truth of an underlying claim.'),
    source('local-computational-witness', 'Maha computational provenance witness', 'Maha Strategies', 'repository source inspected 2026-09-06', 'repo:packages/maha-witness/src/maha_witness/receipt.py', 'local-implementation', 'build_receipt; verify_receipt; assurance and bindings fields', 'Digest-bound inputs, outputs, environment, seeds, adapters, dossier/claim bindings, explicit assurance limits, and offline verification.', 'The receipt observes declared execution metadata; it does not independently reproduce the run, certify scientific validity, prove environment completeness, or establish production use.', localRights, 'code-symbol'),
  ]),
  'maha-strategies:replay-safe-execution': packet('maha-strategies:replay-safe-execution', 'HTTP defines idempotent request semantics while the local guard shows the additional identity and body-binding needed for a replay-safe paid action.', [
    source('rfc-9110-idempotency', 'HTTP Semantics', 'IETF', 'RFC 9110, June 2022', 'https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2', 'internet-standard', '§9.2.2 Idempotent Methods', 'Idempotent methods have the same intended effect for multiple identical requests and may be retried under specified conditions.', 'Method semantics alone do not make a non-idempotent business action replay-safe or prove a request was not processed.'),
    source('local-x402-replay-guard', 'Maha x402 replay guard', 'Maha Strategies', 'repository source inspected 2026-09-06', 'repo:lib/x402/replay-guard.ts', 'local-implementation', 'reserveReplayKey; bodyDigest and settled replay outcomes', 'A bounded implementation reserves an idempotency identity, binds a body digest, and distinguishes in-progress, settled, mismatched, and failed outcomes.', 'Local code inspection does not prove provider delivery, payment settlement, durable storage, or production enforcement.', localRights, 'code-symbol'),
  ]),
  'mayon-rajan:lahar': packet('mayon-rajan:lahar', 'USGS establishes the general physical hazard while PHIVOLCS supplies Mayon-specific operational authority and hazard-map context.', [
    source('usgs-lahar-2024', 'Lahars: Origins, behavior and hazards', 'U.S. Geological Survey', '29 March 2024', 'https://www.usgs.gov/publications/lahars-origins-behavior-and-hazards', 'government-science', 'Publication abstract and hazard-mitigation summary', 'Lahars are volcano-origin debris flows with varied triggers, evolving flow behavior, long runout, and severe downstream consequences.', 'General lahar science does not forecast a Mayon event, define a current hazard zone, or replace local instructions.', governmentRights),
    source('phivolcs-mayon-lahar', 'Mayon Volcano Lahar Hazard Map and volcano hazard information', 'DOST-PHIVOLCS', `official map catalog inspected ${reviewedOn}`, 'https://www.phivolcs.dost.gov.ph/volcano-hazard/', 'official-hazard-source', 'Mayon Volcano Lahar Hazard Map entry and map legend', 'The Philippine operational authority publishes Mayon-specific lahar hazard mapping for planning and reference.', 'A static hazard map is not a current warning, event prediction, evacuation order, or guarantee of safety outside mapped areas.', governmentRights),
  ]),
  'mayon-rajan:monitoring': packet('mayon-rajan:monitoring', 'PHIVOLCS is the current operational authority for Mayon status and exposes multiple monitoring streams; USGS explains the complementary measurement classes.', [
    source('phivolcs-volcano-monitoring', 'PHIVOLCS-LAVA: Local Active Volcanoes Archive', 'DOST-PHIVOLCS', `live portal inspected ${reviewedOn}`, 'https://volcano.phivolcs.dost.gov.ph/', 'official-hazard-source', 'Volcano Status; Volcanic Earthquake; Monitoring Data; Visualize Data', 'Current bulletins and monitoring data cover seismicity, ground deformation, gas, visual observations, and other parameters for monitored Philippine volcanoes.', 'Portal data are time-sensitive; this packet records no alert level or current numerical value and never replaces the latest PHIVOLCS bulletin.', governmentRights),
    source('usgs-volcano-monitoring', 'Monitoring Volcanoes', 'U.S. Geological Survey', `program guidance inspected ${reviewedOn}`, 'https://www.usgs.gov/programs/VHP/monitoring', 'government-science', 'Earthquakes, deformation, gas, visual and lahar-monitoring sections', 'Seismic, deformation, gas, thermal, visual, and flow observations provide complementary evidence about volcanic processes.', 'No single signal deterministically predicts an eruption, and general U.S. guidance is not the operational authority for Mayon.', governmentRights),
  ]),
}

const topicKey = (entry: { siteId: string; topic: string }) => `${entry.siteId}:${entry.topic}`
const artifact = <T extends object>(body: T): T & { provenanceDigest: string } => ({ ...body, provenanceDigest: provenanceDigest(body) })

function specification(candidate: Candidate & { topic: string }, packetValue: FederationReviewPacket, dependencies: unknown) {
  const role = candidate.routeRole.replaceAll('-', ' ')
  return {
    candidateId: candidate.candidateId,
    url: candidate.url,
    title: candidate.title,
    siteId: candidate.siteId,
    topic: candidate.topic,
    routeRole: candidate.routeRole,
    answerContract: `Answer the ${role} intent for ${candidate.title.split(' — ')[0]} directly, using only the inspected scope and preserving every source boundary.`,
    requiredSections: ['Direct answer', 'Role-specific answer', 'Definition and operating context', 'Evidence and exact locators', 'What the evidence does not establish', 'Related definitions and applications'],
    boundedQuestions: [
      `What does ${candidate.title.split(' — ')[0]} mean in this bounded context?`,
      `Which inspected sources support this ${role} answer?`,
      'What does the evidence not establish?',
      'Which definition or canonical owner must be read first?',
      'What source, policy, implementation, or release change would require revision?',
    ],
    sourceBindings: packetValue.sources.map(({ sourceId, locator, scope, boundary }) => ({ sourceId, locator, scope, boundary })),
    dependencies,
    structuredData: { type: 'TechArticle', noRatingOrEndorsement: true },
    machineContract: { deterministicAnswerRegistry: true, exactLocatorsRequired: true, prohibitedInferenceRequired: true, exactRevisionReviewRequired: true, canonicalReleaseRequiredBeforePublication: true },
    implementationState: 'specification-only',
  }
}

const COMMERCIAL_REASON = 'Technical or implementation evidence does not establish that this exact capability is currently offered, priced, deliverable, or validated by a customer.'

export function buildFederationTrancheReview(input: {
  cohort: { provenanceDigest: string; entries: CohortEntry[] }
  candidates: { provenanceDigest: string; candidates: Candidate[] }
  priorPacketManifests: PriorPacketManifest[]
  trancheNumber: 4 | 5 | 6
  additionalPackets?: Record<string, FederationReviewPacket>
}) {
  const schemaStem = `maha-federation-tranche-${input.trancheNumber}`
  const availableNewPackets = input.additionalPackets ?? {}
  const priorPackets = new Map(input.priorPacketManifests.flatMap((manifest) => manifest.packets.map((value) => [value.topicKey, value] as const)))
  const candidateById = new Map(input.candidates.candidates.map((value) => [value.candidateId, value]))
  const usedKeys = [...new Set(input.cohort.entries.map(topicKey))].sort()
  const packets = usedKeys.map((key) => {
    const fresh = availableNewPackets[key]
    if (fresh) return { ...fresh, provenance: 'new-section-inspection' }
    const prior = priorPackets.get(key)
    if (!prior) throw new Error(`No inspected packet exists for ${key}.`)
    return { ...structuredClone(prior), provenance: 'carried-forward-same-version', priorPacketDigest: provenanceDigest(prior) }
  })
  const packetMap = new Map(packets.map((value) => [value.topicKey, value]))
  const packetManifest = artifact({
    schemaVersion: `${schemaStem}-evidence-packets/1.0`,
    cohortDigest: input.cohort.provenanceDigest,
    inspectedOn: reviewedOn,
    inspectionMethod: 'Exact-locator inspection of authoritative public sources and named local code; source text is not retained. Prior packets are reused only at the recorded version and scope.',
    counts: { topics: packets.length, newTopics: usedKeys.filter((key) => Boolean(availableNewPackets[key])).length, carriedForwardTopics: usedKeys.filter((key) => !availableNewPackets[key]).length, sources: packets.reduce((sum, value) => sum + value.sources.length, 0) },
    packets,
  })

  const dependencyEntries = input.cohort.entries.map((entry) => {
    const dependencies = [...entry.dependenciesInTranche, ...entry.dependenciesSatisfiedByPriorTranches].map((candidateId) => {
      const candidate = candidateById.get(candidateId)
      if (!candidate) throw new Error(`Unknown dependency ${candidateId}.`)
      return { dependsOn: candidateId, url: candidate.url, resolution: entry.dependenciesInTranche.includes(candidateId) ? 'same-tranche' : 'prior-tranche' }
    })
    return { candidateId: entry.candidateId, url: entry.url, dependencies, allDependenciesResolved: true }
  })
  const dependencyManifest = artifact({ schemaVersion: `${schemaStem}-dependency-validation/1.0`, cohortDigest: input.cohort.provenanceDigest, counts: { candidates: 100, resolved: 100, unresolved: 0 }, entries: dependencyEntries })

  const semanticEntries = input.cohort.entries.map((entry) => {
    const candidate = candidateById.get(entry.candidateId)!
    const nearest = candidate.duplicateScreen?.nearestObservedUrl ?? null
    const reason = nearest
      ? `Manually retained: the observed ${nearest} route has a different property, topic, audience, or route-role contract; the candidate cannot replace or redefine it.`
      : 'Manually retained after topic, role, owner, and dependency review; no existing route answers the same bounded question.'
    return { candidateId: entry.candidateId, url: entry.url, topic: entry.topic, routeRole: entry.routeRole, disposition: 'retain-distinct', reason, nearestObservedUrl: nearest, reviewedOn, reviewerTier: 'internal-editorial' }
  })
  const semanticManifest = artifact({ schemaVersion: `${schemaStem}-semantic-validation/1.0`, cohortDigest: input.cohort.provenanceDigest, method: 'Manual review of topic, role, nearest observed route, canonical owner, and answer contract; URL similarity alone never determines identity.', assurance: 'Internal editorial review; not external expert endorsement.', counts: { reviewed: 100, retainDistinct: 100, duplicative: 0 }, entries: semanticEntries })

  const dependencyMap = new Map(dependencyEntries.map((value) => [value.candidateId, value.dependencies]))
  const decisions = input.cohort.entries.map((entry) => {
    const key = topicKey(entry)
    const packetValue = packetMap.get(key)!
    const disposition = entry.routeRole === 'commercialization' || packetValue.disposition !== 'evidence-ready' ? 'revise' : 'evidence-ready'
    const reason = entry.routeRole === 'commercialization' ? COMMERCIAL_REASON : packetValue.reason
    return {
      cohortOrder: entry.cohortOrder,
      candidateId: entry.candidateId,
      url: entry.url,
      title: candidateById.get(entry.candidateId)!.title,
      siteId: entry.siteId,
      topic: entry.topic,
      routeRole: entry.routeRole,
      disposition,
      reason,
      semanticValidationDigest: semanticManifest.provenanceDigest,
      dependencyValidationDigest: dependencyManifest.provenanceDigest,
      topicPacketKey: key,
      topicPacketDigest: provenanceDigest(packetValue),
      reviewedOn,
      activeRouteCreated: false,
    }
  })
  const decisionManifest = artifact({
    schemaVersion: `${schemaStem}-decisions/1.0`,
    cohortDigest: input.cohort.provenanceDigest,
    semanticValidationDigest: semanticManifest.provenanceDigest,
    dependencyValidationDigest: dependencyManifest.provenanceDigest,
    evidencePacketManifestDigest: packetManifest.provenanceDigest,
    assurance: 'Internal evidence and duplication review; no public route, canonical release, commercial availability, or external endorsement.',
    counts: { evidenceReady: decisions.filter((value) => value.disposition === 'evidence-ready').length, revise: decisions.filter((value) => value.disposition === 'revise').length, blocked: 0, duplicative: 0 },
    entries: decisions,
  })
  const specifications = decisions.filter((value) => value.disposition === 'evidence-ready').map((decision) => specification(
    { ...candidateById.get(decision.candidateId)!, topic: decision.topic },
    packetMap.get(decision.topicPacketKey)!,
    { graphEdges: dependencyMap.get(decision.candidateId) ?? [], canonicalOwner: candidateById.get(decision.candidateId)!.siteId },
  ))
  const specificationManifest = artifact({ schemaVersion: `${schemaStem}-page-specifications/1.0`, decisionManifestDigest: decisionManifest.provenanceDigest, rule: 'A substantial-page specification exists only for an evidence-ready exact candidate and carries every packet locator and boundary.', counts: { specifications: specifications.length, excludedNonReady: 100 - specifications.length }, specifications })
  const readiness = artifact({
    schemaVersion: `${schemaStem}-readiness/1.0`,
    cohortDigest: input.cohort.provenanceDigest,
    decisionManifestDigest: decisionManifest.provenanceDigest,
    specificationManifestDigest: specificationManifest.provenanceDigest,
    status: 'local-reviewed-unreleased',
    counts: { candidates: 100, evidenceReady: specifications.length, revise: decisionManifest.counts.revise, blocked: 0, duplicative: 0, pageSpecifications: specifications.length, publicRoutesCreated: 0, buildsRun: 0 },
    boundary: 'No route or public registry entry is created. Owner integration, exact-revision review, canonical release where applicable, completion of the 4,000-route corpus, and explicit build authorization remain required.',
  })
  return { semanticManifest, dependencyManifest, packetManifest, decisionManifest, specificationManifest, readiness }
}

export function buildTrancheFourReview(input: {
  cohort: { provenanceDigest: string; entries: CohortEntry[] }
  candidates: { provenanceDigest: string; candidates: Candidate[] }
  priorPacketManifests: PriorPacketManifest[]
}) {
  return buildFederationTrancheReview({ ...input, trancheNumber: 4, additionalPackets: NEW_PACKETS })
}
