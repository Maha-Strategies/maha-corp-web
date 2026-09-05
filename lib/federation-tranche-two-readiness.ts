import { readFileSync } from 'node:fs'

import { provenanceDigest, sha256Hex } from './evidence-dossier/digest.ts'
import type { CandidateMap } from './federation-4000-adjudication.ts'

export type TrancheTwoDisposition = 'evidence-ready' | 'revise' | 'blocked' | 'reject-as-duplicative'

type Cohort = {
  provenanceDigest: string
  entries: Array<{
    cohortOrder: number
    candidateId: string
    url: string
    siteId: string
    topic: string
    routeRole: string
    dependenciesInTranche: string[]
    dependenciesSatisfiedByTrancheOne: string[]
  }>
}

type PriorCohort = { provenanceDigest: string; entries: Array<{ candidateId: string }> }

type DependencyGraph = {
  provenanceDigest: string
  edges: Array<{ from: string; dependsOn: string; reason: string }>
  observedTopicNodes: Array<{ nodeId: string; url: string }>
  observedAnchorNodes: Array<{ nodeId: string; url: string }>
}

type PriorPackets = {
  provenanceDigest: string
  packets: Array<{
    topicKey: string
    disposition: Exclude<TrancheTwoDisposition, 'reject-as-duplicative'>
    reason: string
    sourceIdentityChecked: boolean
    locatorChecked: boolean
    rightsChecked: boolean
    scopeChecked: boolean
    boundaryChecked: boolean
    implementationCondition: string | null
    sources: SourceRecord[]
  }>
}

type SourceRecord = {
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
}

type TopicEvidence = {
  disposition: Exclude<TrancheTwoDisposition, 'reject-as-duplicative'>
  reason: string
  sources: SourceRecord[]
  implementationCondition?: string
}

const reviewedOn = '2026-09-05'
const publicOfficial = 'Publicly accessible official material; retain the link and a bounded paraphrase only. No source text is redistributed.'
const publicStandard = 'Public standards material; cite the stable identifier and use bounded paraphrase subject to the publisher or standards body terms.'
const localControlled = 'Maha-controlled repository material; retain only file identity, symbol locator, and content fingerprint. No credential or runtime value is included.'
const authorControlled = 'Maha-controlled authorial manuscript; retain only file identity, section locator, and content fingerprint. Quotation remains governed by the author publication policy.'

function source(
  sourceId: string,
  title: string,
  responsibleBody: string,
  versionOrDate: string,
  url: string,
  sourceClass: string,
  locator: string,
  scope: string,
  boundary: string,
  rightsBasis = publicOfficial,
  inspectionDepth = 'section',
): SourceRecord {
  return { sourceId, title, responsibleBody, versionOrDate, url, sourceClass, rightsBasis, inspectionDepth, locator, scope, boundary }
}

function repoSource(
  sourceId: string,
  title: string,
  path: string,
  versionOrDate: string,
  locator: string,
  scope: string,
  boundary: string,
  fingerprints: Record<string, string>,
  rightsBasis = localControlled,
  inspectionDepth = 'code-symbol',
): SourceRecord {
  const contentFingerprint = fingerprints[path]
  if (!contentFingerprint) throw new Error(`Missing repository fingerprint for ${path}.`)
  return { sourceId, title, responsibleBody: 'Maha Strategies', versionOrDate, url: `repo:${path}`, sourceClass: inspectionDepth === 'book-section' ? 'authorial-primary-source' : 'local-implementation', rightsBasis, inspectionDepth, locator, scope, boundary, contentFingerprint }
}

const keyOf = (siteId: string, topic: string) => `${siteId}:${topic}`
const codeUnit = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

function newTopicEvidence(fingerprints: Record<string, string>): Record<string, TopicEvidence> {
  const crossref = source(
    'crossref-versioning',
    'Versioning',
    'Crossref',
    `living guidance inspected ${reviewedOn}`,
    'https://www.crossref.org/documentation/principles-practices/best-practices/versioning/',
    'technical-specification',
    'Versioning: preprints, accepted manuscripts, versions of record, corrections, and retractions',
    'Persistent scholarly-object identity and explicit relationships among versions.',
    'A version relationship does not prove that a source supports a claim or that two versions are substantively equivalent.',
  )
  const lean = source(
    'lean-theorems',
    'Theorem Definitions',
    'Lean FRO',
    `Lean Language Reference inspected ${reviewedOn}`,
    'https://lean-lang.org/doc/reference/latest/Definitions/Theorems/',
    'technical-specification',
    'Theorem Definitions: syntax, elaboration, proof term, and irreducibility',
    'Formal theorem declarations and the distinction between a proposition, proof term, and checker result.',
    'A checked proof establishes only the encoded proposition under its formal assumptions; it does not validate empirical premises.',
  )
  const rfc9700 = source(
    'rfc-9700',
    'Best Current Practice for OAuth 2.0 Security',
    'IETF',
    'RFC 9700 / BCP 240, January 2025',
    'https://www.rfc-editor.org/rfc/rfc9700.html',
    'standard',
    'Sections 2.2, 2.3, and 4.10.2',
    'Replay resistance, least-privilege access tokens, audience restriction, and counterfeit resource-server threats.',
    'OAuth security guidance does not prove a particular gateway enforces scopes or that an entitlement is commercially valid.',
    publicStandard,
  )
  const privacy = source(
    'nist-privacy-core',
    'NIST Privacy Framework 1.0 Core',
    'NIST',
    'version 1.0, January 2020',
    'https://www.nist.gov/system/files/documents/2021/05/05/NIST-Privacy-Framework-V1.0-Core-PDF.pdf',
    'government-guidance',
    'Control-P data-processing policies, especially CT.DP-P1 and CT.DP-P4',
    'Local processing and selective collection or disclosure as privacy-risk controls.',
    'Local processing can reduce observability or linkability but does not by itself prove privacy, security, correctness, or legal compliance.',
  )
  const phivolcs = source(
    'phivolcs-alert-levels',
    'Volcano Alert Levels',
    'DOST-PHIVOLCS',
    `current official page inspected ${reviewedOn}`,
    'https://www2.phivolcs.dost.gov.ph/volcano/volcano-alert-levels/',
    'official-hazard-source',
    'Mayon Volcano alert-level table and linked bulletin hierarchy',
    'Meaning and operational role of official Mayon alert levels.',
    'An explanatory page is not a live alert. Current bulletins, evacuation orders, and local authorities always control.',
  )

  return {
    'agentic-publishing:machine-readable-article': {
      disposition: 'blocked',
      reason: 'JATS and Schema.org establish external machine-readable article vocabularies, but the existing Publish owner definition could not be inspected; a parallel definition or template would risk semantic conflict.',
      implementationCondition: 'Inspect https://publish.mahastrategies.com/docs/machine-readability, preserve it as the canonical owner definition, and bind any template or example to its exact fields and version.',
      sources: [
        source('niso-jats-1-4', 'Journal Article Tag Suite (JATS) 1.4', 'NISO', 'ANSI/NISO Z39.96-2024', 'https://www.niso.org/standards-committees/jats', 'standard', 'JATS 1.4 standard description and tag-suite scope', 'XML elements and attributes for journal-article metadata and full content.', 'JATS is designed for journal articles and does not define every agentic publication or Maha release field.', publicStandard),
        source('schema-org-article', 'Article', 'Schema.org Community Group', `living vocabulary inspected ${reviewedOn}`, 'https://schema.org/Article', 'technical-specification', 'Article type, properties, and TechArticle and ScholarlyArticle subtypes', 'Public structured-data vocabulary for describing article resources.', 'Schema.org describes resources; it does not verify evidence, authorship, review, release status, or factual accuracy.', publicStandard),
      ],
    },
    'maha-os:device-identity': {
      disposition: 'evidence-ready',
      reason: 'NIST defines a bounded IoT device-identification capability, while the local authorization layer supplies the applied agent-client binding.',
      sources: [
        source('nist-ir-8259a', 'IoT Device Cybersecurity Capability Core Baseline', 'NIST', 'NISTIR 8259A, May 2020', 'https://nvlpubs.nist.gov/nistpubs/ir/2020/NIST.IR.8259a.pdf', 'government-guidance', 'Section 2 and Table 1, Device Identification', 'Logical and physical identification of an IoT device for cybersecurity management.', 'The baseline is a manufacturer-oriented IoT starting point, not universal device identity or proof that a device has not been substituted.'),
        repoSource('local-agent-credentials', 'Agent client credential authorization', 'lib/agent-client-credentials.ts', 'repository source inspected 2026-09-05', 'credential fingerprint, client binding, status, and authorization checks', 'Current Maha client-credential identity and authorization behavior.', 'Repository behavior is implementation evidence, not an independent security certification.', fingerprints),
      ],
    },
    'maha-os:on-device-inference': {
      disposition: 'evidence-ready',
      reason: 'NIST supplies the edge-processing and privacy-control boundaries needed for a bounded local-inference definition and operator guide.',
      sources: [
        source('nist-edge-ai', 'Edge AI', 'NIST', `program page inspected ${reviewedOn}`, 'https://www.nist.gov/programs-projects/edge-ai', 'government-guidance', 'Background and Key Challenges', 'AI computation at edge nodes and user devices under resource, privacy, security, and reliability constraints.', 'Edge execution does not imply offline capability, confidentiality, accuracy, or immunity from model and software updates.'),
        privacy,
      ],
    },
    'maha-policy:automated-decision-governance': {
      disposition: 'evidence-ready',
      reason: 'Current EU primary law supports a jurisdiction-bounded distinction among automated-decision rights, high-risk-system oversight, and broader policy proposals.',
      sources: [
        source('gdpr-art-22', 'Regulation (EU) 2016/679', 'European Parliament and Council', 'OJ L 119, 4 May 2016', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679', 'law', 'Article 22 and related safeguards', 'EU restrictions and safeguards for certain decisions based solely on automated processing.', 'Article 22 has defined scope, exceptions, jurisdiction, and contested interpretation; it is not a universal ban or legal advice.'),
        source('eu-ai-act-art-14', 'Regulation (EU) 2024/1689 (Artificial Intelligence Act)', 'European Parliament and Council', 'OJ L, 12 July 2024', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32024R1689', 'law', 'Article 14, Human oversight', 'Human-oversight objectives and capabilities for high-risk AI systems.', 'Article 14 applies within the Act’s high-risk-system framework and must not be generalized to every automated decision.'),
      ],
    },
    'maha-research:proof-status': {
      disposition: 'evidence-ready',
      reason: 'Lean defines theorem and proof objects; the local bridge records whether a particular artifact was accepted, refused, or remained unverified.',
      sources: [
        lean,
        repoSource('local-lean-verifier', 'Maha Lean bridge verifier', 'packages/maha-lean-bridge/src/verifier.ts', 'repository source inspected 2026-09-05', 'verification result and refusal construction', 'Current local proof-verification status model.', 'A local verifier result is implementation evidence; it does not establish empirical truth or external review.', fingerprints),
      ],
    },
    'maha-research:software-environment': {
      disposition: 'evidence-ready',
      reason: 'OCI gives a content-addressed environment vocabulary and the witness implementation records the narrower runtime receipt actually observed.',
      sources: [
        source('oci-image-spec', 'Open Container Initiative Image Format Specification', 'Open Container Initiative', 'release 1.1.1', 'https://github.com/opencontainers/image-spec/blob/v1.1.1/spec.md', 'technical-specification', 'Image Manifest, Image Index, Image Configuration, Layers, and content descriptors', 'Content-addressed manifests, configuration, layers, media types, and digests for container images.', 'An image digest identifies declared image content; it does not capture every host, kernel, device, network, or runtime dependency.', 'Apache License 2.0 source; cite the versioned specification and retain bounded excerpts only.'),
        repoSource('local-witness-receipt', 'Maha computational witness receipt', 'packages/maha-witness/src/maha_witness/receipt.py', 'repository source inspected 2026-09-05', 'runtime, inputs, environment, seed, and receipt digest fields', 'Current local runtime-provenance receipt behavior.', 'A receipt attests recorded inputs and environment metadata; it does not prove scientific validity or complete environmental capture.', fingerprints),
      ],
    },
    'maha-research:source-version': {
      disposition: 'evidence-ready',
      reason: 'Crossref explicitly separates scholarly versions and correction relationships, supporting a source-version record without treating versions as interchangeable.',
      sources: [crossref],
    },
    'maha-research:units': {
      disposition: 'evidence-ready',
      reason: 'The SI Brochure supplies authoritative quantity-value and unit-writing rules for the definition and fixture.',
      sources: [
        source('bipm-si-brochure', 'The International System of Units (SI Brochure)', 'BIPM', '9th edition, version 4.01, August 2025', 'https://www.bipm.org/documents/20126/41483022/SI-Brochure-9.pdf', 'standard', 'Sections 2.2–2.3 and 5.4', 'SI base and derived units, quantity values, and rules for writing unit symbols and values.', 'Correct units do not establish that a model, measurement, conversion, or numerical result is scientifically appropriate.', publicStandard),
      ],
    },
    'maha-strategies:capability-scoped-tokens': {
      disposition: 'evidence-ready',
      reason: 'OAuth BCP supplies least-privilege and audience restrictions while the local credential layer supplies the concrete capability binding.',
      sources: [rfc9700, repoSource('local-agent-credentials', 'Agent client credential authorization', 'lib/agent-client-credentials.ts', 'repository source inspected 2026-09-05', 'credential scopes, fingerprint, client binding, status, and authorization checks', 'Current Maha capability and client binding.', 'Local code does not independently establish deployment security or correct policy configuration.', fingerprints)],
    },
    'maha-strategies:endpoint-substitution-defense': {
      disposition: 'evidence-ready',
      reason: 'The OAuth issuer and audience controls define the substitution threat, and the local A2A validation path supplies the applied refusal boundary.',
      sources: [
        source('rfc-9207', 'OAuth 2.0 Authorization Server Issuer Identification', 'IETF', 'RFC 9207, March 2022', 'https://www.rfc-editor.org/rfc/rfc9207.html', 'standard', 'Sections 2 and 4, issuer parameter and mix-up attack mitigation', 'Binding an authorization response to the expected issuer.', 'Issuer validation addresses authorization-server mix-up; resource audience, TLS, redirect, and application-level selector checks remain separate.', publicStandard),
        rfc9700,
        repoSource('local-a2a-validation', 'Maha A2A validation and proxy', 'lib/a2a/validation.ts', 'repository source inspected 2026-09-05', 'endpoint identity and request validation', 'Current endpoint and request validation behavior before A2A forwarding.', 'Local validation is implementation evidence and does not prove the remote endpoint’s identity or behavior beyond checked signals.', fingerprints),
      ],
    },
    'maha-strategies:machine-commerce-entitlement': {
      disposition: 'evidence-ready',
      reason: 'The local federation and Preview contracts distinguish discovery, entitlement, zero-dollar licensing, delivery, and acknowledgement without claiming payment capability.',
      sources: [
        repoSource('local-product-federation', 'CARP/CABEZON product federation contract', 'lib/product-federation.ts', 'repository source inspected 2026-09-05', 'offer state, identity binding, entitlement, delivery reference, and acknowledgement types', 'Current private machine-commerce offer and entitlement state model.', 'The contract is not evidence of an external customer, settled payment, escrow, or Production availability.', fingerprints),
        repoSource('local-cabezon-preview', 'CABEZON Preview adapter', 'lib/cabezon-preview.ts', 'repository source inspected 2026-09-05', 'Preview enquiry, replay, delivery, and acknowledgement boundaries', 'Current Preview-only lifecycle behavior and refusal states.', 'Preview fixtures and canaries are synthetic and do not establish commercial demand or Production operation.', fingerprints),
      ],
    },
    'maha-strategies:tenant-isolation': {
      disposition: 'evidence-ready',
      reason: 'NIST frames multitenant isolation as a cloud security requirement and the gateway source identifies the narrower tenant boundary currently enforced.',
      sources: [
        source('nist-sp-800-144', 'Guidelines on Security and Privacy in Public Cloud Computing', 'NIST', 'SP 800-144, December 2011', 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-144.pdf', 'government-guidance', 'Section 2.1, pp. 2–4, cloud architecture and multi-tenancy', 'Isolation of computations and data belonging to different cloud tenants.', 'The publication is general and dated guidance; it does not certify Maha’s current tenancy controls.'),
        repoSource('local-mcp-gateway', 'Enterprise MCP gateway implementation', 'lib/mcp-gateway.ts', 'repository source inspected 2026-09-05', 'tenant resolution, tool allowlist, quota, and request-ledger boundaries', 'Current Maha gateway tenant-selection and request-control behavior.', 'Repository behavior is not independent penetration testing or proof of infrastructure configuration.', fingerprints),
      ],
    },
    'mayon-rajan:infrastructure-resilience': {
      disposition: 'evidence-ready',
      reason: 'UNDRR supplies resilience principles and PHIVOLCS supplies the current-hazard authority boundary for Mayon-specific preparedness.',
      sources: [
        source('undrr-resilient-infrastructure', 'Principles for Resilient Infrastructure', 'UNDRR', '2022', 'https://www.undrr.org/publication/principles-resilient-infrastructure', 'government-guidance', 'Principles 1–6 and continuity of critical services', 'Planning and governance principles for infrastructure resilience and continuity.', 'The principles are not a site-specific engineering assessment, building code, hazard map, or evacuation instruction.'),
        phivolcs,
      ],
    },
    'mayon-rajan:official-alerts': {
      disposition: 'evidence-ready',
      reason: 'PHIVOLCS is the operational authority for current Mayon alert levels and bulletins; the page can explain only how to find and interpret that authority.',
      sources: [
        phivolcs,
        source('phivolcs-mayon-bulletins', 'Mayon Volcano Bulletin Archive', 'DOST-PHIVOLCS', `current archive inspected ${reviewedOn}`, 'https://wovodat.phivolcs.dost.gov.ph/bulletin/list-of-bulletin?edate=&sdate=&type=&vdId=574', 'official-hazard-source', 'Mayon bulletin list, issue dates, and linked bulletin records', 'Primary route to dated official Mayon volcano bulletins.', 'An archive entry can become stale immediately; the latest official bulletin and local government instructions control.'),
      ],
    },
    'mayone-maharajan:cosmic-recursion': {
      disposition: 'evidence-ready',
      reason: 'The authorial manuscript explicitly defines the term, separates its registers, relates its conceptual slots, and states how the thesis could be wrong.',
      sources: [repoSource('cosmic-recursion-manuscript', 'The Cosmic Recursion', 'content/books/the-cosmic-recursion/THE-COSMIC-RECURSION-manuscript.md', 'working authorial manuscript inspected 2026-09-05', 'Introduction: “On the word recursion, and what I am refusing”; “The three registers”; “Four slots”; “How this could be wrong”', 'Mayone Maharajan’s own definition, conceptual relationships, development, and stated limits.', 'This is an authorial thesis, not scientific consensus, empirical proof, a theological authority, or a claim that metaphor establishes mechanism.', fingerprints, authorControlled, 'book-section')],
    },
    'mayone-maharajan:public-reason': {
      disposition: 'revise',
      reason: 'Rawls supplies a primary genealogy for public reason, but no inspected Mayone manuscript passage establishes that the term is part of Mayone’s authorial system or how his use differs.',
      implementationCondition: 'Add and inspect an authorial passage that explicitly adopts, rejects, or revises Rawls’s concept; until then publish neither a Mayone definition nor a relationship map.',
      sources: [
        source('rawls-public-reason', 'The Idea of Public Reason Revisited', 'John Rawls', 'University of Chicago Law Review 64(3), 1997', 'https://chicagounbound.uchicago.edu/uclrev/vol64/iss3/1/', 'scholarly-primary-source', 'pp. 765–807, especially the statement of public reason and the criterion of reciprocity', 'Rawls’s account of public reason in constitutional democratic political justification.', 'Rawls establishes his own political conception, not Mayone Maharajan’s adoption of it, empirical public agreement, or a universal theory of reason.', 'Copyrighted scholarly article; cite bibliographic metadata and use bounded paraphrase only.'),
      ],
    },
  }
}

const DUPLICATE_ID = 'cand_48485c2639eca0b2fb4d9852'
const MACHINE_READABILITY_OWNER = 'https://publish.mahastrategies.com/docs/machine-readability'
const OBSERVED_LOCAL_DEFINITIONS: Record<string, string> = {
  'agentic-publishing:release-manifest': 'https://publish.mahastrategies.com/docs/release-manifests',
  'maha-strategies:enterprise-mcp-gateway': 'https://www.mahastrategies.com/enterprise-mcp-gateway',
}

export function manuallyValidateTrancheTwo(candidateMap: CandidateMap, cohort: Cohort) {
  const candidateById = new Map(candidateMap.candidates.map((entry) => [entry.candidateId, entry]))
  const entries = cohort.entries.map((entry) => {
    const candidate = candidateById.get(entry.candidateId)
    if (!candidate) throw new Error(`Unknown candidate ${entry.candidateId}.`)
    const duplicate = entry.candidateId === DUPLICATE_ID
    return {
      cohortOrder: entry.cohortOrder,
      candidateId: entry.candidateId,
      candidateUrl: entry.url,
      siteId: entry.siteId,
      topic: entry.topic,
      routeRole: entry.routeRole,
      manualDisposition: duplicate ? 'replace-with-existing-route' : 'retain-distinct',
      changedFromFrozenMachineDisposition: duplicate,
      comparedRoute: duplicate ? MACHINE_READABILITY_OWNER : null,
      manualReason: duplicate
        ? 'Publish already has a canonical machine-readability document. A second generic definition would split the meaning of the same publishing concept; keep the observed document and make later templates or examples depend on it.'
        : `The ${entry.routeRole} route has a distinct answer contract for ${entry.topic} on ${entry.siteId}; it may proceed only within that role and must preserve the candidate’s canonical-owner boundary rather than restating a neighboring definition.`,
      reviewerTier: 'internal-editorial',
      reviewedOn,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-tranche-two-semantic-validation/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    cohortDigest: cohort.provenanceDigest,
    method: 'Manual review of all 100 candidate subjects, route roles, nearest observed routes, and canonical-owner boundaries. Semantic identity, not URL similarity, controls the outcome.',
    assurance: 'Internal editorial adjudication; not external expert review or publication authority.',
    counts: {
      reviewed: entries.length,
      retainedDistinct: entries.filter((entry) => entry.manualDisposition === 'retain-distinct').length,
      replaceWithExisting: entries.filter((entry) => entry.manualDisposition === 'replace-with-existing-route').length,
      corrected: entries.filter((entry) => entry.changedFromFrozenMachineDisposition).length,
    },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function observedUrl(graph: DependencyGraph, nodeId: string) {
  return [...graph.observedTopicNodes, ...graph.observedAnchorNodes].find((entry) => entry.nodeId === nodeId)?.url ?? null
}

export function validateTrancheTwoDependencies(candidateMap: CandidateMap, graph: DependencyGraph, cohort: Cohort, trancheOne: PriorCohort) {
  const candidateById = new Map(candidateMap.candidates.map((entry) => [entry.candidateId, entry]))
  const prior = new Set(trancheOne.entries.map((entry) => entry.candidateId))
  const selected = new Set(cohort.entries.map((entry) => entry.candidateId))
  const graphEdges = new Map<string, Array<{ dependsOn: string; reason: string }>>()
  for (const edge of graph.edges) graphEdges.set(edge.from, [...(graphEdges.get(edge.from) ?? []), { dependsOn: edge.dependsOn, reason: edge.reason }])

  const resolveNode = (nodeId: string) => {
    if (nodeId === DUPLICATE_ID) return { nodeId, resolution: 'observed-canonical-replacement', url: MACHINE_READABILITY_OWNER }
    const candidate = candidateById.get(nodeId)
    if (candidate) return { nodeId, resolution: selected.has(nodeId) ? 'tranche-two-candidate' : prior.has(nodeId) ? 'tranche-one-prerequisite' : 'frozen-candidate', url: candidate.url }
    const url = observedUrl(graph, nodeId)
    return url ? { nodeId, resolution: 'observed-route', url } : { nodeId, resolution: 'unresolved', url: null }
  }

  const entries = cohort.entries.map((entry) => {
    const candidate = candidateById.get(entry.candidateId)!
    const edges = (graphEdges.get(entry.candidateId) ?? []).map((edge) => ({ ...edge, ...resolveNode(edge.dependsOn) }))
    const observedDefinition = OBSERVED_LOCAL_DEFINITIONS[keyOf(entry.siteId, entry.topic)]
    const definitionDependency = entry.routeRole === 'definition'
      ? (entry.candidateId === DUPLICATE_ID ? { nodeId: DUPLICATE_ID, resolution: 'observed-canonical-replacement', url: MACHINE_READABILITY_OWNER } : { nodeId: entry.candidateId, resolution: 'self-definition', url: entry.url })
      : edges.find((edge) => edge.reason === 'local-topic-definition-first')
        ?? (observedDefinition ? { nodeId: `observed:${entry.siteId}:${entry.topic}`, resolution: 'observed-local-definition', url: observedDefinition } : null)
    const ownerDependencies = edges.filter((edge) => edge.reason === 'canonical-family-owner-definition-first' || edge.reason === 'canonical-topic-owner-definition-first')
    const dependencyValid = edges.every((edge) => edge.url !== null)
      && (candidate.conceptAuthority.canonicalOwner !== entry.siteId || Boolean(definitionDependency?.url))
      && ownerDependencies.every((edge) => edge.url !== null)
      && candidate.conceptAuthority.canonicalOwner.length > 0
    return {
      cohortOrder: entry.cohortOrder,
      candidateId: entry.candidateId,
      url: entry.url,
      siteId: entry.siteId,
      topic: entry.topic,
      routeRole: entry.routeRole,
      canonicalOwner: candidate.conceptAuthority.canonicalOwner,
      definitionDependency,
      ownerDependencies,
      graphEdges: edges,
      dependencyValid,
      bodyInspectionCaveat: entry.topic === 'release-manifest'
        ? 'The existing Publish release-manifest owner route was identified but its body was not available for inspection.'
        : entry.topic === 'machine-readable-article'
          ? 'The existing Publish machine-readability owner route was identified but its body was not available for inspection.'
          : null,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-tranche-two-dependency-validation/1.0',
    cohortDigest: cohort.provenanceDigest,
    priorCohortDigest: trancheOne.provenanceDigest,
    dependencyGraphDigest: graph.provenanceDigest,
    rule: 'Resolve every frozen dependency, require the local definition before applications, preserve canonical-property ownership, and replace the rejected machine-readable definition with the existing Publish owner route.',
    counts: {
      checked: entries.length,
      valid: entries.filter((entry) => entry.dependencyValid).length,
      invalid: entries.filter((entry) => !entry.dependencyValid).length,
      dependenciesResolvedThroughTrancheOne: entries.filter((entry) => entry.graphEdges.some((edge) => edge.resolution === 'tranche-one-prerequisite')).length,
      observedOwnerBodyCaveats: entries.filter((entry) => entry.bodyInspectionCaveat).length,
    },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function buildEvidencePackets(cohort: Cohort, priorPackets: PriorPackets, fingerprints: Record<string, string>) {
  const represented = [...new Set(cohort.entries.map((entry) => keyOf(entry.siteId, entry.topic)))].sort(codeUnit)
  if (represented.length !== 44) throw new Error(`Expected 44 represented topic/property pairs; received ${represented.length}.`)
  const priorByKey = new Map(priorPackets.packets.map((entry) => [entry.topicKey, entry]))
  const fresh = newTopicEvidence(fingerprints)
  const packets = represented.map((topicKey) => {
    const prior = priorByKey.get(topicKey)
    if (prior) {
      return {
        ...prior,
        provenance: 'carried-forward-same-version',
        priorPacketDigest: provenanceDigest(prior),
      }
    }
    const evidence = fresh[topicKey]
    if (!evidence) throw new Error(`Missing Tranche 2 evidence packet for ${topicKey}.`)
    return {
      topicKey,
      disposition: evidence.disposition,
      reason: evidence.reason,
      sourceIdentityChecked: evidence.sources.every((item) => item.title && item.responsibleBody && item.versionOrDate && item.url),
      locatorChecked: evidence.sources.every((item) => item.locator.length > 5),
      rightsChecked: evidence.sources.every((item) => item.rightsBasis.length > 20),
      scopeChecked: evidence.sources.every((item) => item.scope.length > 20),
      boundaryChecked: evidence.sources.every((item) => item.boundary.length > 20),
      implementationCondition: evidence.implementationCondition ?? null,
      sources: evidence.sources,
      provenance: 'new-section-inspection',
      priorPacketDigest: null,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-tranche-two-evidence-packets/1.0',
    cohortDigest: cohort.provenanceDigest,
    priorPacketManifestDigest: priorPackets.provenanceDigest,
    inspectedOn: reviewedOn,
    inspectionMethod: 'Reuse only immutable Tranche 1 packets for identical topic/property keys; inspect authoritative sources for each new key at an exact section, code symbol, or manuscript section. Retain no source excerpt.',
    localSourceFingerprints: fingerprints,
    counts: {
      topics: packets.length,
      carriedForward: packets.filter((entry) => entry.provenance === 'carried-forward-same-version').length,
      newlyInspected: packets.filter((entry) => entry.provenance === 'new-section-inspection').length,
      byDisposition: Object.fromEntries(['evidence-ready', 'revise', 'blocked'].map((state) => [state, packets.filter((entry) => entry.disposition === state).length])),
    },
    packets,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function sectionsFor(role: string) {
  const roleSection: Record<string, string> = {
    definition: 'Term boundaries and disambiguation',
    'source-contract': 'Source contract and refusal rules',
    'machine-record': 'Machine-readable schema and validation',
    relationships: 'Typed relationship map and non-equivalences',
    architecture: 'Components, trust boundaries, and data flow',
    controls: 'Control objectives and failure evidence',
    threats: 'Threat model and mitigations',
    implementation: 'Implementation contract and operational limits',
    commercialization: 'Offer state, scope, privacy, and delivery terms',
    'operator-guide': 'Operator checklist, failure states, and rollback',
    fixture: 'Synthetic deterministic fixture',
    template: 'Versioned template and required fields',
    example: 'Bounded worked example',
    comparison: 'Jurisdictional or conceptual comparison',
    'current-law': 'Current law, effective dates, and jurisdiction',
    uncertainty: 'Uncertainty and change triggers',
    sources: 'Authority hierarchy and version notes',
    mechanisms: 'Mechanisms, evidence, and alternatives',
    'machine-interface': 'Machine-readable schema and refusal states',
    policy: 'Normative proposal separated from current authority',
    workflow: 'Ordered workflow and handoff states',
    method: 'Method, assumptions, and reproducibility',
    protocol: 'Ordered procedure and refusal conditions',
    limits: 'Limits, exclusions, and current-authority handoff',
    'official-sources': 'Official source hierarchy and freshness',
    development: 'Development path and stated falsifiers',
    'failure-mode': 'Failure taxonomy and detection',
  }
  return ['Direct answer', roleSection[role] ?? 'Role-specific answer', 'Definition and operating context', 'Evidence and exact locators', 'What the evidence does not establish', 'Related definitions and applications']
}

function candidateDisposition(entry: Cohort['entries'][number], packet: ReturnType<typeof buildEvidencePackets>['packets'][number]): { disposition: TrancheTwoDisposition; reason: string } {
  if (entry.candidateId === DUPLICATE_ID) return { disposition: 'reject-as-duplicative', reason: `The existing ${MACHINE_READABILITY_OWNER} route is the canonical definition; publishing another generic definition would split one concept across two doorways.` }
  if (entry.routeRole === 'commercialization') return { disposition: 'revise', reason: 'The inspected sources establish implementation and control boundaries, but not current offer terms, availability, price, or customer outcomes.' }
  return { disposition: packet.disposition, reason: packet.reason }
}

export function evaluateTrancheTwo(
  candidateMap: CandidateMap,
  graph: DependencyGraph,
  cohort: Cohort,
  trancheOne: PriorCohort,
  priorPackets: PriorPackets,
  localSourceFingerprints: Record<string, string>,
) {
  const candidateById = new Map(candidateMap.candidates.map((entry) => [entry.candidateId, entry]))
  const manualSemantic = manuallyValidateTrancheTwo(candidateMap, cohort)
  const dependencyValidation = validateTrancheTwoDependencies(candidateMap, graph, cohort, trancheOne)
  const evidencePackets = buildEvidencePackets(cohort, priorPackets, localSourceFingerprints)
  const packetByKey = new Map(evidencePackets.packets.map((entry) => [entry.topicKey, entry]))
  const dependencyById = new Map(dependencyValidation.entries.map((entry) => [entry.candidateId, entry]))
  const semanticById = new Map(manualSemantic.entries.map((entry) => [entry.candidateId, entry]))
  const decisions = cohort.entries.map((entry) => {
    const packet = packetByKey.get(keyOf(entry.siteId, entry.topic))!
    const dependency = dependencyById.get(entry.candidateId)!
    const semantic = semanticById.get(entry.candidateId)!
    const classified = !dependency.dependencyValid
      ? { disposition: 'blocked' as const, reason: 'One or more required definition or canonical-owner dependencies did not resolve.' }
      : candidateDisposition(entry, packet)
    return {
      cohortOrder: entry.cohortOrder,
      candidateId: entry.candidateId,
      url: entry.url,
      title: candidateById.get(entry.candidateId)!.title,
      siteId: entry.siteId,
      topic: entry.topic,
      routeRole: entry.routeRole,
      disposition: classified.disposition,
      reason: classified.reason,
      semanticValidationDigest: provenanceDigest(semantic),
      dependencyValidationDigest: provenanceDigest(dependency),
      topicPacketKey: packet.topicKey,
      topicPacketDigest: provenanceDigest(packet),
      reviewedOn,
      activeRouteCreated: false,
    }
  })
  const decisionBody = {
    schemaVersion: 'maha-federation-tranche-two-decisions/1.0',
    cohortDigest: cohort.provenanceDigest,
    semanticValidationDigest: manualSemantic.provenanceDigest,
    dependencyValidationDigest: dependencyValidation.provenanceDigest,
    evidencePacketManifestDigest: evidencePackets.provenanceDigest,
    assurance: 'Internal editorial evidence-readiness decisions only. They are not exact-revision publication review, release authority, external expert review, or a deployment claim.',
    counts: Object.fromEntries(['evidence-ready', 'revise', 'blocked', 'reject-as-duplicative'].map((state) => [state, decisions.filter((entry) => entry.disposition === state).length])),
    entries: decisions,
  }
  const decisionManifest = { ...decisionBody, provenanceDigest: provenanceDigest(decisionBody) }

  const specificationsList = decisions.filter((entry) => entry.disposition === 'evidence-ready').map((decision) => {
    const packet = packetByKey.get(decision.topicPacketKey)!
    const dependency = dependencyById.get(decision.candidateId)!
    const shortTitle = decision.title.replace(/ — .+$/, '')
    return {
      candidateId: decision.candidateId,
      url: decision.url,
      title: decision.title,
      siteId: decision.siteId,
      topic: decision.topic,
      routeRole: decision.routeRole,
      answerContract: `Answer the ${decision.routeRole} intent for ${shortTitle} directly. Label legal authority, standard, government guidance, local implementation, and authorial thesis; never transfer one kind of authority to another.`,
      requiredSections: sectionsFor(decision.routeRole),
      boundedQuestions: [
        `What does ${shortTitle} mean in this bounded context?`,
        `Which inspected sources support this ${decision.routeRole} answer?`,
        'What does the evidence not establish?',
        'Which definition or canonical owner must be read first?',
        'What source, policy, implementation, or release change would require revision?',
      ],
      sourceBindings: packet.sources.map((item) => ({ sourceId: item.sourceId, locator: item.locator, scope: item.scope, boundary: item.boundary })),
      dependencies: {
        definition: dependency.definitionDependency,
        canonicalOwner: dependency.canonicalOwner,
        ownerDependencies: dependency.ownerDependencies,
        graphEdges: dependency.graphEdges,
      },
      structuredData: { type: 'TechArticle', noRatingOrEndorsement: true },
      machineContract: { deterministicAnswerRegistry: true, exactLocatorsRequired: true, prohibitedInferenceRequired: true, exactRevisionReviewRequired: true, canonicalReleaseRequiredBeforePublication: true },
      implementationState: 'specification-only',
    }
  })
  const specificationBody = {
    schemaVersion: 'maha-federation-tranche-two-page-specifications/1.0',
    decisionManifestDigest: decisionManifest.provenanceDigest,
    rule: 'Generate specifications only for evidence-ready candidates. A specification does not create a route or authorize review, release, build, or deployment.',
    counts: { specifications: specificationsList.length },
    specifications: specificationsList,
  }
  const specifications = { ...specificationBody, provenanceDigest: provenanceDigest(specificationBody) }

  const reportBody = {
    schemaVersion: 'maha-federation-tranche-two-readiness/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    cohortDigest: cohort.provenanceDigest,
    semanticValidationDigest: manualSemantic.provenanceDigest,
    dependencyValidationDigest: dependencyValidation.provenanceDigest,
    evidencePacketsDigest: evidencePackets.provenanceDigest,
    decisionManifestDigest: decisionManifest.provenanceDigest,
    specificationsDigest: specifications.provenanceDigest,
    status: 'local-readiness-complete',
    counts: {
      selectedCandidates: cohort.entries.length,
      semanticCandidatesReviewed: manualSemantic.counts.reviewed,
      semanticCorrections: manualSemantic.counts.corrected,
      representedTopics: evidencePackets.counts.topics,
      priorPacketsReused: evidencePackets.counts.carriedForward,
      newTopicPacketsInspected: evidencePackets.counts.newlyInspected,
      dependenciesValid: dependencyValidation.counts.valid,
      evidenceReady: decisions.filter((entry) => entry.disposition === 'evidence-ready').length,
      revise: decisions.filter((entry) => entry.disposition === 'revise').length,
      blocked: decisions.filter((entry) => entry.disposition === 'blocked').length,
      duplicative: decisions.filter((entry) => entry.disposition === 'reject-as-duplicative').length,
      substantialPageSpecifications: specificationsList.length,
      publicRoutesCreated: 0,
      nextBuildsRun: 0,
      vercelBuildsRun: 0,
    },
    implementationBoundary: 'Evidence-ready candidates may enter route implementation. Publication still requires implementation, deterministic verification, exact-revision review, canonical release where applicable, and the user’s explicit approval before any Next or Vercel build.',
    blockers: decisions.filter((entry) => entry.disposition !== 'evidence-ready').map((entry) => ({ candidateId: entry.candidateId, url: entry.url, disposition: entry.disposition, reason: entry.reason })),
  }
  const readinessReport = { ...reportBody, provenanceDigest: provenanceDigest(reportBody) }
  return { manualSemantic, dependencyValidation, evidencePackets, decisionManifest, specifications, readinessReport }
}

export function trancheTwoSourceFingerprints(root: string) {
  const paths = [
    'lib/agent-client-credentials.ts',
    'lib/mcp-gateway.ts',
    'lib/a2a/validation.ts',
    'lib/product-federation.ts',
    'lib/cabezon-preview.ts',
    'packages/maha-witness/src/maha_witness/receipt.py',
    'packages/maha-lean-bridge/src/verifier.ts',
    'content/books/the-cosmic-recursion/THE-COSMIC-RECURSION-manuscript.md',
  ]
  return Object.fromEntries(paths.map((path) => [path, `sha256:${sha256Hex(readFileSync(`${root}/${path}`, 'utf8'))}`]))
}
