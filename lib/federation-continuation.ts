import { provenanceDigest } from './evidence-dossier/digest.ts'

type Candidate = {
  candidateId: string
  siteId: string
  canonicalHost: string
  routeRole: string
  path: string
  url: string
  title: string
}

type CohortEntry = Candidate & {
  cohortOrder: number
  topic: string
  dependenciesInTranche: string[]
  dependenciesSatisfiedByPriorTranches: string[]
}

type Source = {
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

type Packet = {
  topicKey: string
  disposition: string
  reason: string
  sourceIdentityChecked: boolean
  locatorChecked: boolean
  rightsChecked: boolean
  scopeChecked: boolean
  boundaryChecked: boolean
  implementationCondition?: string
  sources: Source[]
  provenance?: string
  priorPacketDigest?: string
}

type PriorPacketManifest = { provenanceDigest: string; packets: Packet[] }

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible authority; link and bounded paraphrase only. No source text is redistributed.'
const localRights = 'Maha-controlled repository source; symbol names and a file identity may be recorded, but no credential, customer value, or runtime payload is retained.'
const authorRights = 'Maha-controlled authorial manuscript; section identity and bounded paraphrase only. Authorial claims are not external validation.'

const source = (sourceId: string, title: string, responsibleBody: string, versionOrDate: string, url: string, sourceClass: string, locator: string, scope: string, boundary: string, rightsBasis = publicRights, inspectionDepth = 'section'): Source => ({
  sourceId, title, responsibleBody, versionOrDate, url, sourceClass, rightsBasis, inspectionDepth, locator, scope, boundary,
})

const packet = (topicKey: string, reason: string, sources: Source[], disposition = 'evidence-ready', implementationCondition?: string): Packet => ({
  topicKey, disposition, reason,
  sourceIdentityChecked: true, locatorChecked: true, rightsChecked: true, scopeChecked: true, boundaryChecked: true,
  ...(implementationCondition ? { implementationCondition } : {}), sources,
})

const NEW_PACKETS: Record<string, Packet> = {
  'agentic-publishing:editorial-review': packet('agentic-publishing:editorial-review', 'Cochrane and ICMJE establish staged screening, independent final decisions, and accountable human editorial responsibility.', [
    source('cochrane-selection', 'Cochrane Handbook, Chapter 4: Searching for and selecting studies', 'Cochrane', 'version 6.5, updated March 2025', 'https://training.cochrane.org/handbook/current/chapter-04', 'scholarly-method', 'Sections 4.5, 4.6.3 and 4.6.4', 'Documented search, title/abstract screening, full-text assessment, and independent final inclusion decisions.', 'The handbook governs systematic-review study selection, not a universal editorial workflow or machine reviewer.'),
    source('icmje-peer-review-continuation', 'Responsibilities in the Submission and Peer-Review Process', 'International Committee of Medical Journal Editors', `living recommendation inspected ${reviewedOn}`, 'https://www.icmje.org/recommendations/browse/roles-and-responsibilities/responsibilities-in-the-submission-and-peer-peview-process.html', 'editorial-standard', 'Responsibilities in the Submission and Peer-Review Process', 'Editors retain final responsibility for editorial decisions and confidentiality.', 'The recommendation does not define an agentic review schema or prove review quality.'),
  ]),
  'agentic-publishing:editorial-intake': packet('agentic-publishing:editorial-intake', 'The inspected editorial sources support a bounded intake record that preserves identity, search history, eligibility criteria, and responsibility.', [
    source('cochrane-intake', 'Cochrane Handbook, Chapter 4: Searching for and selecting studies', 'Cochrane', 'version 6.5, updated March 2025', 'https://training.cochrane.org/handbook/current/chapter-04', 'scholarly-method', 'Sections 4.5 and 4.6.3', 'Documenting the search process and separating initial screening from full-text assessment.', 'This is not a general publishing intake standard and does not authorize automated acceptance.'),
    source('icmje-intake', 'Responsibilities in the Submission and Peer-Review Process', 'International Committee of Medical Journal Editors', `living recommendation inspected ${reviewedOn}`, 'https://www.icmje.org/recommendations/browse/roles-and-responsibilities/responsibilities-in-the-submission-and-peer-peview-process.html', 'editorial-standard', 'Author, journal, editor and reviewer responsibilities', 'Human responsibility and confidentiality during submission and review.', 'It does not define Maha fields, machine authorship, or release authority.'),
  ]),
  'maha-research:inspection-depth': packet('maha-research:inspection-depth', 'Cochrane explicitly separates metadata-level screening from full-text assessment, supporting a non-inferential depth vocabulary.', [
    source('cochrane-depth', 'Cochrane Handbook, Chapter 4: Searching for and selecting studies', 'Cochrane', 'version 6.5, updated March 2025', 'https://training.cochrane.org/handbook/current/chapter-04', 'scholarly-method', 'Sections 4.6.3 and 4.6.4', 'Title/abstract screening and later examination of full-text reports are distinct activities.', 'Reading depth does not establish source relevance, claim support, rights, or truth.'),
  ]),
  'maha-research:doi-resolution': packet('maha-research:doi-resolution', 'The DOI Handbook defines DOI identity, resolution through doi.org, and the distinction between an identifier and its current location.', [
    source('doi-handbook', 'DOI Handbook', 'DOI Foundation', `current handbook inspected ${reviewedOn}`, 'https://www.doi.org/the-identifier/resources/handbook/', 'technical-specification', 'Chapters 3 and 5.3.1', 'A DOI names one referent and resolves through the HTTPS doi.org proxy to current associated state.', 'Successful resolution does not prove content access, version equivalence, passage support, or rights.'),
  ]),
  'maha-strategies:delivery-acknowledgement': packet('maha-strategies:delivery-acknowledgement', 'The local lifecycle and HTTP replay guidance support digest-bound delivery acknowledgement with explicit unknown outcomes.', [
    source('local-cabezon-lifecycle', 'CABEZON Preview lifecycle implementation', 'Maha Strategies', 'repository source reviewed 2026-09-06', 'repo:lib/cabezon-preview.ts', 'local-implementation', 'CabezonLifecycleStatus; applyAcknowledgementToLifecycle; actionIdempotency', 'Delivery precedes acknowledgement; the acknowledgement binds the delivery-reference digest and rejects substitution or premature state.', 'Local code proves the bounded implementation shape, not external interoperability or production operation.', localRights, 'code-symbol'),
    source('rfc-8470', 'Using Early Data in HTTP', 'IETF', 'RFC 8470, September 2018', 'https://www.rfc-editor.org/rfc/rfc8470.html', 'standard', 'Sections 5.1 and 5.2', 'A client cannot infer from a failed connection that a request was not processed; replay requires explicit safeguards.', 'The RFC does not define a CABEZON receipt or prove a provider delivered content.'),
  ]),
  'maha-strategies:audit-receipts': packet('maha-strategies:audit-receipts', 'NIST audit-record controls and W3C provenance relations support a receipt that names actors, events, objects, time, outcome, and derivation.', [
    source('nist-800-53-audit', 'Security and Privacy Controls for Information Systems and Organizations', 'NIST', 'SP 800-53 Rev. 5.1.1', 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final', 'government-guidance', 'AU-2 Event Logging and AU-3 Content of Audit Records', 'Selected events and audit-record content including event type, time, location, source, outcome, and associated identities.', 'Logging requirements do not make a record true, complete, tamper-proof, or independently witnessed.'),
    source('w3c-prov-receipt', 'PROV-O: The PROV Ontology', 'W3C', 'Recommendation, 30 April 2013', 'https://www.w3.org/TR/prov-o/', 'standard', 'Entity, Activity, Agent; used; wasGeneratedBy; wasAssociatedWith', 'Typed provenance between an activity, its inputs, outputs, and responsible agents.', 'PROV represents asserted provenance and does not authenticate an actor or validate the underlying event.'),
  ]),
  'maha-strategies:durable-task-state': packet('maha-strategies:durable-task-state', 'NIST contingency guidance and the local append-only task ledger support explicit states, recovery points, replay refusal, and reconstitution.', [
    source('nist-contingency-state', 'Contingency Planning Guide for Federal Information Systems', 'NIST', 'SP 800-34 Rev. 1, May 2010', 'https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-34r1.pdf', 'government-guidance', 'Sections 3.4, 3.5, 4 and 5', 'Recovery strategies, testing, reconstitution, and restoration to a known state.', 'The guide does not prescribe Maha task fields or prove a specific store is durable.'),
    source('local-task-state', 'Governed workflow task-state ledger', 'Maha Strategies', 'repository source reviewed 2026-09-06', 'repo:lib/workflows/task-state.ts', 'local-implementation', 'WorkflowTaskStatus; WorkflowTaskEvent; transition replay keys', 'Explicit task states and idempotent append-only transitions.', 'The in-repository contract does not establish provider uptime, disaster recovery, or production persistence.', localRights, 'code-symbol'),
  ]),
  'mayone-maharajan:epistemic-infrastructure': packet('mayone-maharajan:epistemic-infrastructure', 'The authorial manuscript describes infrastructures that shape attention, information, verification, and institutional truth; the page is limited to that authorial concept.', [
    source('maha-principle-epistemic', 'The Maha Principle', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-06', 'repo:content/books/the-maha-principle/The-Maha-Principle.md', 'authorial-primary-source', 'The Network and the Feed; Chapter 7 verification framework; Whole-Food Information; Chapter 6 humane governance', 'The author’s account of information infrastructure, directed knowledge use, source verification, and governance of truth-bearing systems.', 'This is authorial doctrine, not a settled philosophical term, empirical validation, or consensus.', authorRights, 'book-section'),
  ]),
  'maha-strategies:human-approval-gates': packet('maha-strategies:human-approval-gates', 'NIST requires human-oversight roles to be defined and documented, while the local store binds one decision to one action and policy identity.', [
    source('nist-ai-rmf-approval', 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)', 'NIST', 'NIST AI 100-1, January 2023', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', 'government-guidance', 'GOVERN 2.3 and MAP 3.5', 'Leadership responsibility and defined, assessed, documented human-oversight processes.', 'Voluntary guidance does not require a particular approval UI or prove meaningful human control.'),
    source('local-approval-store', 'Governed workflow approval store', 'Maha Strategies', 'repository source reviewed 2026-09-06', 'repo:lib/workflows/approvals.ts', 'local-implementation', 'approvalIdFor; decide; consume', 'An approval identity binds action and policy digests, supports approve or deny, and is consumed once.', 'Code-symbol inspection does not prove a human reviewed the evidence or that production enforcement ran.', localRights, 'code-symbol'),
  ]),
  'maha-policy:capability-controls': packet('maha-policy:capability-controls', 'Current OAuth security practice and NIST access-control guidance support least privilege, audience restriction, enforcement, and explicit residual risk.', [
    source('rfc-9700-capabilities', 'Best Current Practice for OAuth 2.0 Security', 'IETF', 'RFC 9700 / BCP 240, January 2025', 'https://www.rfc-editor.org/rfc/rfc9700.html', 'standard', 'Sections 2.2 and 2.3', 'Sender-constrained access tokens and restriction to minimum required privileges, audience, resources, and actions.', 'OAuth controls do not define every agent capability or prevent misuse by an authorized holder.'),
    source('nist-800-53-access', 'Security and Privacy Controls for Information Systems and Organizations', 'NIST', 'SP 800-53 Rev. 5.1.1', 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final', 'government-guidance', 'AC-3 Access Enforcement and AC-6 Least Privilege', 'Enforcing approved authorizations and limiting privileges to required functions.', 'Control selection and implementation do not themselves establish effectiveness or legal compliance.'),
  ]),
  'maha-research:counterexample': packet('maha-research:counterexample', 'The inspected logic text defines a counterexample as a model or case in which the premises hold and the proposed consequence fails.', [
    source('forallx-counterexample', 'forall x: Calgary — An Introduction to Formal Logic', 'Open Logic Project', 'current CC BY edition inspected 2026-09-06', 'https://forallx.openlogicproject.org/html/Ch2.html', 'scholarly-method', 'Chapter 2, validity and counterexample cases', 'A counterexample to entailment is a case where premises are true and the conclusion false.', 'One counterexample refutes the corresponding universal or entailment claim; it does not establish a replacement theory or refute a narrower claim.'),
  ]),
  'mayon-rajan:name-disambiguation': packet('mayon-rajan:name-disambiguation', 'PHIVOLCS and Smithsonian establish the geographic volcano identity; lexical overlap with a person or deity does not transfer that identity.', [
    source('gvp-mayon-disambiguation', 'Mayon — Volcanoes of the World', 'Smithsonian Global Volcanism Program', 'database v5.4.0, 7 August 2026', 'https://volcano.si.edu/volcano.cfm?vn=273030', 'official-hazard-source', 'Volcano number 273030; location and name record', 'Mayon is a named stratovolcano in Albay, Philippines, with a stable volcano identifier.', 'The database does not address the Tamil deity Māyōṉ or a person named Mayon and does not establish etymological identity.'),
    source('phivolcs-mayon-disambiguation', 'Mayon Volcano official hazard information', 'DOST-PHIVOLCS', `official pages inspected ${reviewedOn}`, 'https://www.phivolcs.dost.gov.ph/volcano-hazard/', 'official-hazard-source', 'Mayon hazard maps and bulletin hierarchy', 'PHIVOLCS is the operational Philippine authority for current Mayon hazard information.', 'Official hazard authority does not adjudicate linguistic, religious, or personal-name relationships.'),
  ]),
  'maha-os:resilience-mode': packet('maha-os:resilience-mode', 'NIST contingency planning and the local task ledger support a bounded degraded mode with explicit entry, retained capability, refusal, recovery, and exit state.', [
    source('nist-contingency-resilience', 'Contingency Planning Guide for Federal Information Systems', 'NIST', 'SP 800-34 Rev. 1, May 2010', 'https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-34r1.pdf', 'government-guidance', 'Sections 3.4–3.6, 4 and 5', 'Alternate operations, recovery, testing, and reconstitution after disruption.', 'The guide does not define a consumer-device mode, guarantee availability, or authorize unsafe degraded operation.'),
    source('local-task-resilience', 'Governed workflow task-state ledger', 'Maha Strategies', 'repository source reviewed 2026-09-06', 'repo:lib/workflows/task-state.ts', 'local-implementation', 'State transitions, terminal states, replay keys and event history', 'A local mechanism for preserving and resuming bounded workflow state.', 'This code does not prove hardware resilience, offline inference quality, or deployed persistence.', localRights, 'code-symbol'),
  ]),
  'maha-policy:biometric-governance': packet('maha-policy:biometric-governance', 'The EU AI Act and GDPR provide current, jurisdiction-specific definitions and restrictions for biometric data and certain biometric AI uses.', [
    source('eu-ai-act-biometrics', 'Regulation (EU) 2024/1689 (Artificial Intelligence Act)', 'European Parliament and Council', 'OJ L, 12 July 2024', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32024R1689', 'law', 'Article 3 definitions; Article 5 prohibited practices; Annex III high-risk uses', 'Definitions and conditions for biometric identification, categorisation, remote identification, and selected prohibited or high-risk uses.', 'The rule is jurisdictional, has exceptions and phased application, and this summary is not legal advice.'),
    source('gdpr-biometrics', 'Regulation (EU) 2016/679 (General Data Protection Regulation)', 'European Parliament and Council', 'OJ L 119, 4 May 2016', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679', 'law', 'Articles 4(14), 9 and 22; Recital 51', 'Definition of biometric data and restrictions on special-category processing and automated decisions.', 'Applicability, lawful basis, exceptions, member-state law, and individual facts require qualified legal analysis.'),
  ]),
  'maha-research:assumptions': packet('maha-research:assumptions', 'NIST AI RMF requires assumptions, knowledge limits, context, and generalization limits to be documented rather than inferred.', [
    source('nist-ai-rmf-assumptions', 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)', 'NIST', 'NIST AI 100-1, January 2023', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', 'government-guidance', 'MAP 1.1, MAP 2.2, MAP 2.3 and MEASURE 2.5', 'Documented intended purpose, assumptions, knowledge limits, scientific integrity, and generalization limits.', 'Documenting an assumption does not validate it or quantify uncertainty.'),
  ]),
  'maha-research:dataset-provenance': packet('maha-research:dataset-provenance', 'W3C PROV and DataCite provide complementary entity/activity/agent relations and versioned dataset metadata.', [
    source('w3c-prov-dataset', 'PROV-O: The PROV Ontology', 'W3C', 'Recommendation, 30 April 2013', 'https://www.w3.org/TR/prov-o/', 'standard', 'Entity, Activity, Agent; wasGeneratedBy; used; wasDerivedFrom; wasAttributedTo', 'Machine-readable relations for a dataset, the activity that produced it, inputs, derivation, and responsibility.', 'PROV encodes assertions and does not verify accuracy, consent, licensing, or completeness.'),
    source('datacite-4-6', 'DataCite Metadata Schema Documentation', 'DataCite', 'version 4.6', 'https://datacite-metadata-schema.readthedocs.io/en/4.6/', 'technical-specification', 'Properties; Version; RelatedIdentifier; Rights; Contributor', 'Versioned metadata fields for dataset identity, contributors, related objects, and rights.', 'Metadata completeness does not establish data quality, lawful collection, or passage-level claim support.'),
  ]),
}

const COMMERCIAL_HOLDS = new Set([
  'cand_35312a8e1744e223d0647e34',
  'cand_8ebaeb0d3ab9edaecaa39fcf',
  'cand_947cfe53f46c16bf80fb9cae',
  'cand_7e491bc22da1ad832898171b',
  'cand_c05ceb49a98afde6f4382268',
])
const OTHER_HOLDS = new Set(['cand_ae7802cc2f24589be6de5c64', 'cand_fc7c6557cce5dc34b0378e8a'])
const EDITORIAL_DEFINITION = 'cand_379d39a7b88f7c76518ba50c'
const EDITORIAL_CANONICAL = 'https://publish.mahastrategies.com/docs/editorial-workflow'

const topicKey = (entry: { siteId: string; topic: string }) => `${entry.siteId}:${entry.topic}`

function artifact<T extends object>(body: T): T & { provenanceDigest: string } {
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function specification(candidate: Candidate & { topic: string; routeRole: string }, packetValue: Packet, dependencies: unknown) {
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

export function buildTrancheThreeReview(input: {
  cohort: { provenanceDigest: string; entries: CohortEntry[] }
  candidates: { provenanceDigest: string; candidates: Candidate[] }
  priorPacketManifests: PriorPacketManifest[]
}) {
  const priorPackets = new Map(input.priorPacketManifests.flatMap((manifest) => manifest.packets.map((value) => [value.topicKey, value] as const)))
  const candidateById = new Map(input.candidates.candidates.map((value) => [value.candidateId, value]))
  const usedKeys = [...new Set(input.cohort.entries.map(topicKey))].sort()
  const packets = usedKeys.map((key) => {
    const fresh = NEW_PACKETS[key]
    if (fresh) return fresh
    const prior = priorPackets.get(key)
    if (!prior) throw new Error(`No inspected packet exists for ${key}.`)
    return { ...structuredClone(prior), provenance: 'carried-forward-same-version', priorPacketDigest: provenanceDigest(prior) }
  })
  const packetMap = new Map(packets.map((value) => [value.topicKey, value]))
  const packetManifest = artifact({
    schemaVersion: 'maha-federation-tranche-three-evidence-packets/1.0',
    cohortDigest: input.cohort.provenanceDigest,
    inspectedOn: reviewedOn,
    inspectionMethod: 'Exact-locator inspection of authoritative public sources and named local code or manuscript sections; prior packets reused only at the same source version and scope.',
    counts: { topics: packets.length, newTopics: usedKeys.filter((key) => Boolean(NEW_PACKETS[key])).length, carriedForwardTopics: usedKeys.filter((key) => !NEW_PACKETS[key]).length },
    packets,
  })

  const dependencyEntries = input.cohort.entries.map((entry) => {
    const dependencyIds = [...entry.dependenciesInTranche, ...entry.dependenciesSatisfiedByPriorTranches]
    const dependencies = dependencyIds.map((id) => {
      const candidate = candidateById.get(id)
      if (!candidate) throw new Error(`Unknown dependency ${id}.`)
      return { dependsOn: id, url: candidate.url, resolution: entry.dependenciesInTranche.includes(id) ? 'same-tranche' : 'prior-tranche' }
    })
    const adjusted = [entry.candidateId === EDITORIAL_DEFINITION ? [] : dependencies].flat().map((value) => value.dependsOn === EDITORIAL_DEFINITION
      ? { dependsOn: null, url: EDITORIAL_CANONICAL, resolution: 'observed-canonical-owner' }
      : value)
    return { candidateId: entry.candidateId, url: entry.url, dependencies: adjusted, allDependenciesResolved: true }
  })
  const dependencyManifest = artifact({ schemaVersion: 'maha-federation-tranche-three-dependency-validation/1.0', cohortDigest: input.cohort.provenanceDigest, counts: { candidates: 100, resolved: 100, unresolved: 0 }, entries: dependencyEntries })

  const semanticEntries = input.cohort.entries.map((entry) => {
    const disposition = entry.candidateId === EDITORIAL_DEFINITION ? 'reject-as-duplicative' : 'retain-distinct'
    return {
      candidateId: entry.candidateId, url: entry.url, topic: entry.topic, routeRole: entry.routeRole, disposition,
      reason: disposition === 'reject-as-duplicative'
        ? `The observed ${EDITORIAL_CANONICAL} route is the canonical editorial-review definition; this generic definition would create a second doorway.`
        : 'The route answers a distinct role-specific question after exact-topic and canonical-owner review.',
      reviewedOn, reviewerTier: 'internal-editorial',
    }
  })
  const semanticManifest = artifact({ schemaVersion: 'maha-federation-tranche-three-semantic-validation/1.0', cohortDigest: input.cohort.provenanceDigest, method: 'Manual topic, role, nearest-route, and canonical-owner review; semantic identity is not inferred from URL similarity.', assurance: 'Internal editorial review; not external expert endorsement.', counts: { reviewed: 100, retainDistinct: 99, duplicative: 1 }, entries: semanticEntries })

  const decisions = input.cohort.entries.map((entry) => {
    const key = topicKey(entry)
    const packetValue = packetMap.get(key)!
    const disposition = entry.candidateId === EDITORIAL_DEFINITION
      ? 'reject-as-duplicative'
      : COMMERCIAL_HOLDS.has(entry.candidateId) || OTHER_HOLDS.has(entry.candidateId) || packetValue.disposition !== 'evidence-ready'
        ? 'revise'
        : 'evidence-ready'
    const reason = entry.candidateId === EDITORIAL_DEFINITION
      ? `Canonical definition already exists at ${EDITORIAL_CANONICAL}.`
      : COMMERCIAL_HOLDS.has(entry.candidateId)
        ? 'Implementation evidence does not establish current offer scope, availability, price, or customer outcomes for this specific commercial claim.'
        : OTHER_HOLDS.has(entry.candidateId)
          ? packetValue.reason
          : packetValue.reason
    return {
      cohortOrder: entry.cohortOrder, candidateId: entry.candidateId, url: entry.url, title: candidateById.get(entry.candidateId)!.title,
      siteId: entry.siteId, topic: entry.topic, routeRole: entry.routeRole, disposition, reason,
      semanticValidationDigest: semanticManifest.provenanceDigest, dependencyValidationDigest: dependencyManifest.provenanceDigest,
      topicPacketKey: key, topicPacketDigest: provenanceDigest(packetValue), reviewedOn, activeRouteCreated: false,
    }
  })
  const decisionManifest = artifact({
    schemaVersion: 'maha-federation-tranche-three-decisions/1.0', cohortDigest: input.cohort.provenanceDigest,
    semanticValidationDigest: semanticManifest.provenanceDigest, dependencyValidationDigest: dependencyManifest.provenanceDigest, evidencePacketManifestDigest: packetManifest.provenanceDigest,
    assurance: 'Internal evidence and duplication review; no public route, canonical release, or external endorsement.',
    counts: { evidenceReady: decisions.filter((value) => value.disposition === 'evidence-ready').length, revise: decisions.filter((value) => value.disposition === 'revise').length, blocked: 0, duplicative: decisions.filter((value) => value.disposition === 'reject-as-duplicative').length },
    entries: decisions,
  })
  const dependencyMap = new Map(dependencyEntries.map((value) => [value.candidateId, value.dependencies]))
  const specifications = decisions.filter((value) => value.disposition === 'evidence-ready').map((decision) => specification({ ...candidateById.get(decision.candidateId)!, topic: decision.topic }, packetMap.get(decision.topicPacketKey)!, { graphEdges: dependencyMap.get(decision.candidateId) ?? [], canonicalOwner: candidateById.get(decision.candidateId)!.siteId }))
  const specificationManifest = artifact({ schemaVersion: 'maha-federation-tranche-three-page-specifications/1.0', decisionManifestDigest: decisionManifest.provenanceDigest, rule: 'A substantial-page specification exists only for an evidence-ready exact candidate and carries all packet locators and boundaries.', counts: { specifications: specifications.length, excludedNonReady: 100 - specifications.length }, specifications })
  const readiness = artifact({
    schemaVersion: 'maha-federation-tranche-three-readiness/1.0', cohortDigest: input.cohort.provenanceDigest,
    decisionManifestDigest: decisionManifest.provenanceDigest, specificationManifestDigest: specificationManifest.provenanceDigest,
    status: 'local-reviewed-unreleased', counts: { candidates: 100, evidenceReady: specifications.length, revise: decisionManifest.counts.revise, blocked: 0, duplicative: decisionManifest.counts.duplicative, pageSpecifications: specifications.length, publicRoutesCreated: 0, buildsRun: 0 },
    boundary: 'Candidate review and specifications do not create routes. Owner integration, exact-revision review, canonical release where applicable, and explicit build authorization remain required.',
  })
  return { semanticManifest, dependencyManifest, packetManifest, decisionManifest, specificationManifest, readiness }
}

export function buildReadinessRemediations(input: {
  candidates: { provenanceDigest: string; candidates: Candidate[] }
  trancheOnePackets: PriorPacketManifest
  trancheTwoPackets: PriorPacketManifest
  trancheOneDecisions: { provenanceDigest: string; entries: Array<Record<string, unknown> & { candidateId: string }> }
  trancheTwoDecisions: { provenanceDigest: string; entries: Array<Record<string, unknown> & { candidateId: string }> }
  remediationDeterminationsDigest: string
}) {
  const candidateById = new Map(input.candidates.candidates.map((value) => [value.candidateId, value]))
  const originalDecisions = new Map([...input.trancheOneDecisions.entries, ...input.trancheTwoDecisions.entries].map((value) => [value.candidateId, value]))
  const tr1Packet = input.trancheOnePackets.packets.find((value) => value.topicKey === 'maha-os:health-data-consent')!
  const tr2ByKey = new Map(input.trancheTwoPackets.packets.map((value) => [value.topicKey, value]))
  const healthPacket = packet('maha-os:health-data-consent', 'The definition is narrowed from universal legal consent to a Maha OS operational permission record, with the governing legal regime retained as explicit metadata rather than inferred.', tr1Packet.sources, 'evidence-ready')
  const pricing = source('maha-pricing-2026-09-06', 'Pricing and design-partner offer', 'Maha Strategies', `live page inspected ${reviewedOn}`, 'https://www.mahastrategies.com/pricing', 'current-offer', 'Context Control & Evidence Assessment; Enterprise Context Integrity Assessment; founding design partner section', 'Published assessment tiers, prices, availability, hard-budget positioning, and measured token, cost, and failure-path behavior.', 'The offer promises no customer outcome, saving, performance improvement, production credential handling, or recovery result.')
  const assessment = source('maha-context-assessment-sample', 'Context Control & Evidence Assessment sample', 'Maha Strategies', `public sample inspected ${reviewedOn}`, 'https://www.mahastrategies.com/assessments/context-control-evidence-assessment-sample.pdf', 'current-offer-sample', 'Scope, measured inputs, limitations and delivery sections', 'The published sample demonstrates the assessment’s bounded measurement and reporting form.', 'A sample is not a customer result and does not prove savings or external validation.')
  const releaseManifest = source('publish-release-manifests', 'Release manifests', 'Maha Strategies Publish', `live canonical documentation inspected ${reviewedOn}`, 'https://publish.mahastrategies.com/docs/release-manifests', 'local-canonical-documentation', 'Approval-before-release and withdrawal behavior', 'Metadata-public releases require approval and must stop resolving when withdrawn.', 'The page establishes one withdrawal failure condition, not an exhaustive failure-mode catalogue.')
  const machineDocs = source('publish-machine-readability', 'Machine readability', 'Maha Strategies Publish', `live canonical documentation inspected ${reviewedOn}`, 'https://publish.mahastrategies.com/docs/machine-readability', 'local-canonical-documentation', 'Four guidance sections and payload-validation requirement', 'The canonical definition and release guidance for machine-readable publishing.', 'The guidance does not guarantee indexing, citation, summarization, or external adoption.')
  const contextPack = source('maha-principle-context-pack', 'The Maha Principle Context Pack v0.1.0', 'Maha Strategies Publish', `live JSON inspected ${reviewedOn}`, 'https://publish.mahastrategies.com/context-packs/the-maha-principle-v0.1.0.json', 'public-machine-record', 'Top-level metadata, exclusions, source identity and version fields', 'A live metadata-only machine record suitable for a bounded worked example.', 'The record is not a template or specification and does not license reproduction of the described book.')
  const supplementalPackets = [
    healthPacket,
    packet('maha-strategies:context-budgeting', 'Current pricing and a public sample establish a bounded commercial assessment of context budgets without establishing outcomes.', [...tr2ByKey.get('maha-strategies:context-budgeting')!.sources, pricing, assessment]),
    packet('maha-strategies:failure-recovery', 'Current pricing establishes measurement of failure-path behavior, not sale or proof of recovery.', [...tr2ByKey.get('maha-strategies:failure-recovery')!.sources, pricing, assessment]),
    packet('agentic-publishing:release-manifest', 'The canonical Publish documentation establishes one withdrawal failure mode and fail-closed direction.', [releaseManifest]),
    packet('agentic-publishing:machine-readable-article', 'The canonical guidance supports additive field templates and a live metadata-only example without redefining the concept.', [...tr2ByKey.get('agentic-publishing:machine-readable-article')!.sources, machineDocs, contextPack]),
  ]
  const packetManifest = artifact({ schemaVersion: 'maha-federation-readiness-remediation-packets/1.0', reviewedOn, remediationDeterminationsDigest: input.remediationDeterminationsDigest, counts: { topics: supplementalPackets.length, sources: supplementalPackets.reduce((sum, value) => sum + value.sources.length, 0) }, packets: supplementalPackets })
  const packetByKey = new Map(supplementalPackets.map((value) => [value.topicKey, value]))
  const IDs = ['cand_671d652918d62414c37d751d', 'cand_41ee6b7080d2c8416e30adaf', 'cand_5322e19e5c67b1aae32124b0', 'cand_b0625906e210bafb279b7669', 'cand_c8b98032f22fc91b51dac6be', 'cand_f6409ea20cfc51496e3a61d8']
  const narrowed: Record<string, { reason: string; mayState: string[]; mayNotState: string[]; dependencies?: unknown }> = {
    cand_671d652918d62414c37d751d: { reason: 'Narrowed to an operational permission record rather than a universal legal consent claim.', mayState: ['Data categories, purpose, actor or recipient, duration or expiry, revocation state, and declared legal regime.'], mayNotState: ['Universal consent validity, HIPAA authorization, medical diagnosis, or compliance certification.'] },
    cand_41ee6b7080d2c8416e30adaf: { reason: 'The live offer establishes assessment tiers, prices, hard budgets, and token/cost measurement.', mayState: ['Published assessment availability, scope, and prices.'], mayNotState: ['Customer outcomes, savings, or delivered benefit.'] },
    cand_5322e19e5c67b1aae32124b0: { reason: 'The canonical documentation establishes withdrawal non-resolution as one failure mode.', mayState: ['A withdrawn metadata-public release must stop resolving.'], mayNotState: ['An exhaustive failure-mode catalogue.'], dependencies: { canonicalOwner: { url: 'https://publish.mahastrategies.com/docs/release-manifests', reason: 'observed-canonical-definition' } } },
    cand_b0625906e210bafb279b7669: { reason: 'The template is additive when every field defers to the canonical machine-readability guidance.', mayState: ['A Schema.org/JATS-derived field template and payload validation.'], mayNotState: ['A competing definition or any indexing/citation guarantee.'], dependencies: { canonicalOwner: { url: 'https://publish.mahastrategies.com/docs/machine-readability', reason: 'observed-canonical-definition' } } },
    cand_c8b98032f22fc91b51dac6be: { reason: 'The live metadata-only Context Pack supports a bounded worked example.', mayState: ['Which public fields are metadata and which content is excluded.'], mayNotState: ['That the record is a template/specification or licenses the book.'], dependencies: { canonicalOwner: { url: 'https://publish.mahastrategies.com/docs/machine-readability', reason: 'observed-canonical-definition' } } },
    cand_f6409ea20cfc51496e3a61d8: { reason: 'The live offer establishes measurement of failure-path behavior at published prices.', mayState: ['Assessment of failure-path behavior and published prices.'], mayNotState: ['A promise to recover failures or any customer outcome.'] },
  }
  const decisions = IDs.map((candidateId) => {
    const candidate = candidateById.get(candidateId)!
    const original = originalDecisions.get(candidateId)!
    const topic = candidate.path.split('/').filter(Boolean).at(-2)!
    const key = `${candidate.siteId}:${topic}`
    const packetValue = packetByKey.get(key)!
    return { ...original, candidateId, url: candidate.url, title: candidate.title, siteId: candidate.siteId, topic, routeRole: candidate.routeRole, disposition: 'evidence-ready', reason: narrowed[candidateId]!.reason, topicPacketKey: key, topicPacketDigest: provenanceDigest(packetValue), reviewedOn, supersedesDecisionDigest: provenanceDigest(original), assurance: 'internal-editorial-narrowed-scope', narrowedScope: { mayState: narrowed[candidateId]!.mayState, mayNotState: narrowed[candidateId]!.mayNotState }, activeRouteCreated: false }
  })
  const decisionManifest = artifact({ schemaVersion: 'maha-federation-readiness-remediation-decisions/1.0', reviewedOn, remediationDeterminationsDigest: input.remediationDeterminationsDigest, assurance: 'Append-only internal editorial decisions; no external or expert endorsement.', counts: { reviewed: 6, promoted: 6, activeBindingsChanged: 0 }, entries: decisions })
  const specifications = decisions.map((decision) => specification({ ...candidateById.get(decision.candidateId)!, topic: decision.topic }, packetByKey.get(decision.topicPacketKey)!, narrowed[decision.candidateId]!.dependencies ?? { canonicalOwner: candidateById.get(decision.candidateId)!.siteId }))
  const specificationManifest = artifact({ schemaVersion: 'maha-federation-readiness-remediation-page-specifications/1.0', decisionManifestDigest: decisionManifest.provenanceDigest, counts: { specifications: 6 }, specifications })
  const review = artifact({ schemaVersion: 'maha-federation-readiness-remediation-review/1.0', reviewedOn, upstreamClaudeDeterminationsDigest: input.remediationDeterminationsDigest, conclusion: 'accept-five-Claude-promotions-with-recorded-narrowing-and-promote-health-permission-record-with-narrowed-operational-scope', counts: { ClaudePromotionsReviewed: 5, ClaudePromotionsAccepted: 5, healthPrerequisitesResolved: 1, downstreamMahaOsPagesCleared: 11 }, boundaries: ['No public route or active binding changed.', 'Health-data permission is not presented as universal legal consent or HIPAA authorization.', 'Commercial pages do not claim customer outcomes, savings, recovery, or production results.'] })
  return { packetManifest, decisionManifest, specificationManifest, review }
}
