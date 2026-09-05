import { readFileSync } from 'node:fs'

import { provenanceDigest, sha256Hex } from './evidence-dossier/digest.ts'
import type { Candidate, CandidateMap, SemanticDisposition } from './federation-4000-adjudication.ts'

export type EvidenceDisposition = 'evidence-ready' | 'revise' | 'blocked' | 'reject-as-duplicative'

type SemanticArtifact = {
  provenanceDigest: string
  counts: Record<string, number>
  entries: Array<{
    candidateId: string
    url: string
    siteId: string
    topic: string
    routeRole: string
    disposition: SemanticDisposition
    reason: string
    nearestObserved: { url: string; similarity: number; exactTopicSegment: boolean } | null
  }>
}

type DependencyGraph = {
  provenanceDigest: string
  counts: { cycles: number } & Record<string, number>
  edges: Array<{ from: string; dependsOn: string; reason: string }>
  observedTopicNodes: Array<{ nodeId: string; url: string }>
  observedAnchorNodes: Array<{ nodeId: string; url: string }>
  missingOwnerTopicNodes: Array<{ nodeId: string; siteId: string; topic: string }>
}

type Cohort = {
  provenanceDigest: string
  entries: Array<{
    cohortOrder: number
    candidateId: string
    url: string
    siteId: string
    topic: string
    routeRole: string
    dependencies: string[]
    evidenceRequirements: { minimumIndependentSources: number }
  }>
}

type SourceRecord = {
  sourceId: string
  title: string
  responsibleBody: string
  versionOrDate: string
  url: string
  sourceClass: 'law' | 'government-guidance' | 'standard' | 'technical-specification' | 'editorial-standard' | 'scholarly-method' | 'official-hazard-source' | 'local-implementation' | 'authorial-primary-source'
  rightsBasis: string
  inspectionDepth: 'section' | 'code-symbol' | 'book-section'
}

type SourceBinding = {
  sourceId: string
  locator: string
  scope: string
  boundary: string
}

type TopicEvidence = {
  disposition: Exclude<EvidenceDisposition, 'reject-as-duplicative'>
  reason: string
  sources: SourceBinding[]
  implementationCondition?: string
}

const reviewedOn = '2026-09-05'
const publicParaphrase = 'Publicly accessible official source; link and bounded paraphrase only. No source text is redistributed in the packet.'
const localMetadataOnly = 'Maha-controlled repository source; record symbols and file digest only. No credential, customer data, or runtime value is included.'
const authorialMetadataOnly = 'Maha-controlled authorial manuscript; record section identity and file digest only. Any later quotation remains subject to the author-controlled publication policy.'

function source(
  sourceId: string,
  title: string,
  responsibleBody: string,
  versionOrDate: string,
  url: string,
  sourceClass: SourceRecord['sourceClass'],
  rightsBasis = publicParaphrase,
  inspectionDepth: SourceRecord['inspectionDepth'] = 'section',
): SourceRecord {
  return { sourceId, title, responsibleBody, versionOrDate, url, sourceClass, rightsBasis, inspectionDepth }
}

export const FEDERATION_SOURCE_LIBRARY: readonly SourceRecord[] = [
  source('w3c-annotation', 'Web Annotation Data Model', 'W3C', 'Recommendation, 23 February 2017', 'https://www.w3.org/TR/annotation-model/', 'standard'),
  source('w3c-prov-o', 'PROV-O: The PROV Ontology', 'W3C', 'Recommendation, 30 April 2013', 'https://www.w3.org/TR/prov-o/', 'standard'),
  source('crossref-versioning', 'Versioning', 'Crossref', `living guidance inspected ${reviewedOn}`, 'https://www.crossref.org/documentation/principles-practices/best-practices/versioning/', 'technical-specification'),
  source('lean-theorems', 'Theorem Definitions', 'Lean FRO', `Lean Language Reference inspected ${reviewedOn}`, 'https://lean-lang.org/doc/reference/latest/Definitions/Theorems/', 'technical-specification'),
  source('jcgm-gum', 'Evaluation of measurement data — Guide to the expression of uncertainty in measurement', 'Joint Committee for Guides in Metrology', 'JCGM 100:2008, corrected 2010', 'https://www.bipm.org/documents/20126/2071204/JCGM_100_2008_E.pdf', 'standard'),
  source('nist-ai-rmf', 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)', 'NIST', 'NIST AI 100-1, January 2023', 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', 'government-guidance'),
  source('cochrane-heterogeneity', 'Cochrane Handbook, Chapter 10: Analysing data and undertaking meta-analyses', 'Cochrane', 'version 6.5, November 2024', 'https://training.cochrane.org/handbook/current/chapter-10', 'scholarly-method'),
  source('cope-retraction', 'Retraction Guidelines', 'Committee on Publication Ethics', 'version 2, November 2019', 'https://members.publicationethics.org/sites/default/files/retraction-guidelines-cope.pdf', 'editorial-standard', 'COPE PDF is CC BY-NC-ND 4.0; this packet records metadata and paraphrase only.'),
  source('cc-by-4', 'Attribution 4.0 International Legal Code', 'Creative Commons', 'version 4.0', 'https://creativecommons.org/licenses/by/4.0/legalcode', 'standard'),
  source('mcp-authorization', 'Authorization', 'Model Context Protocol', 'specification 2025-06-18', 'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization', 'technical-specification'),
  source('mcp-tools', 'Tools', 'Model Context Protocol', 'specification 2025-06-18', 'https://modelcontextprotocol.io/specification/2025-06-18/server/tools', 'technical-specification'),
  source('rfc-9700', 'Best Current Practice for OAuth 2.0 Security', 'IETF', 'RFC 9700 / BCP 240, January 2025', 'https://www.rfc-editor.org/rfc/rfc9700.html', 'standard'),
  source('nist-zero-trust', 'Zero Trust Architecture', 'NIST', 'SP 800-207, August 2020', 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf', 'government-guidance'),
  source('nist-contingency', 'Contingency Planning Guide for Federal Information Systems', 'NIST', 'SP 800-34 Rev. 1, May 2010', 'https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-34r1.pdf', 'government-guidance'),
  source('nist-patching', 'Guide to Enterprise Patch Management Planning', 'NIST', 'SP 800-40 Rev. 4, April 2022', 'https://csrc.nist.gov/pubs/sp/800/40/r4/final', 'government-guidance'),
  source('nist-privacy', 'NIST Privacy Framework', 'NIST', 'version 1.0, January 2020', 'https://www.nist.gov/privacy-framework/privacy-framework', 'government-guidance'),
  source('hhs-hipaa-auth', 'What is the difference between consent and authorization under the HIPAA Privacy Rule?', 'U.S. Department of Health and Human Services', 'reviewed 28 December 2022', 'https://www.hhs.gov/hipaa/for-professionals/faq/264/what-is-the-difference-between-consent-and-authorization/index.html', 'government-guidance'),
  source('icmje-peer-review', 'Responsibilities in the Submission and Peer-Review Process', 'International Committee of Medical Journal Editors', `living recommendation inspected ${reviewedOn}`, 'https://www.icmje.org/recommendations/browse/roles-and-responsibilities/responsibilities-in-the-submission-and-peer-peview-process.html', 'editorial-standard'),
  source('icmje-abstract', 'Preparing a Manuscript for Submission to a Medical Journal — Abstract', 'International Committee of Medical Journal Editors', `living recommendation inspected ${reviewedOn}`, 'https://icmje.org/recommendations/browse/manuscript-preparation/preparing-for-submission.html', 'editorial-standard'),
  source('eu-ai-act', 'Regulation (EU) 2024/1689 (Artificial Intelligence Act)', 'European Parliament and Council', 'OJ L, 12 July 2024', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32024R1689', 'law'),
  source('gdpr', 'Regulation (EU) 2016/679 (General Data Protection Regulation)', 'European Parliament and Council', 'OJ L 119, 4 May 2016', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679', 'law'),
  source('eu-dsm', 'Directive (EU) 2019/790 on copyright and related rights in the Digital Single Market', 'European Parliament and Council', 'OJ L 130, 17 May 2019', 'https://eur-lex.europa.eu/eli/dir/2019/790/oj', 'law'),
  source('usco-ai-training', 'Copyright and Artificial Intelligence, Part 3: Generative AI Training', 'U.S. Copyright Office', 'pre-publication version, May 2025', 'https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf', 'government-guidance'),
  source('oecd-accountability', 'OECD AI Principle 1.5: Accountability', 'OECD.AI', `principle page inspected ${reviewedOn}`, 'https://oecd.ai/en/dashboards/ai-principles/P9', 'government-guidance'),
  source('oecd-transparency', 'OECD AI Principle 1.3: Transparency and explainability', 'OECD.AI', `principle page inspected ${reviewedOn}`, 'https://oecd.ai/en/dashboards/ai-principles/P7', 'government-guidance'),
  source('phivolcs-hazards', 'Mayon Volcano Hazard Maps', 'DOST-PHIVOLCS', `current landing page inspected ${reviewedOn}`, 'https://www.phivolcs.dost.gov.ph/volcano-hazard/', 'official-hazard-source'),
  source('gvp-mayon', 'Mayon — Volcanoes of the World', 'Smithsonian Global Volcanism Program', 'database v5.4.0, 7 August 2026', 'https://volcano.si.edu/volcano.cfm?vn=273030', 'official-hazard-source'),
  source('local-mcp-gateway', 'Enterprise MCP gateway implementation', 'Maha Strategies', 'repository source reviewed 2026-09-05', 'repo:lib/mcp-gateway.ts', 'local-implementation', localMetadataOnly, 'code-symbol'),
  source('local-mcp-evidence', 'Licensed evidence retrieval contract and implementation', 'Maha Strategies', 'repository source reviewed 2026-09-05', 'repo:lib/mcp-evidence-public-contract.ts', 'local-implementation', localMetadataOnly, 'code-symbol'),
  source('local-context-compiler', 'Context Compiler implementation and metering model', 'Maha Strategies', 'repository source reviewed 2026-09-05', 'repo:lib/context-compiler.ts', 'local-implementation', localMetadataOnly, 'code-symbol'),
  source('local-recovery', 'Governed workflow recovery ledger', 'Maha Strategies', 'repository source reviewed 2026-09-05', 'repo:lib/workflows/recovery.ts', 'local-implementation', localMetadataOnly, 'code-symbol'),
  source('local-credentials', 'Agent client credential authorization', 'Maha Strategies', 'repository source reviewed 2026-09-05', 'repo:lib/agent-client-credentials.ts', 'local-implementation', localMetadataOnly, 'code-symbol'),
  source('local-release', 'Canonical release implementation', 'Maha Strategies', 'repository source reviewed 2026-09-05', 'repo:lib/epistemic-release.ts', 'local-implementation', localMetadataOnly, 'code-symbol'),
  source('orbital-mind', 'The Orbital Mind', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-05', 'repo:content/books/the-orbital-mind/the-orbital-mind.md', 'authorial-primary-source', authorialMetadataOnly, 'book-section'),
  source('maha-principle', 'The Maha Principle', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-05', 'repo:content/books/the-maha-principle/The-Maha-Principle.md', 'authorial-primary-source', authorialMetadataOnly, 'book-section'),
] as const

const binding = (sourceId: string, locator: string, scope: string, boundary: string): SourceBinding => ({ sourceId, locator, scope, boundary })
const ready = (reason: string, sources: SourceBinding[], implementationCondition?: string): TopicEvidence => ({ disposition: 'evidence-ready', reason, sources, implementationCondition })
const revise = (reason: string, sources: SourceBinding[], implementationCondition: string): TopicEvidence => ({ disposition: 'revise', reason, sources, implementationCondition })
const blocked = (reason: string, sources: SourceBinding[], implementationCondition: string): TopicEvidence => ({ disposition: 'blocked', reason, sources, implementationCondition })

const TOPIC_EVIDENCE: Record<string, TopicEvidence> = {
  'maha-research:source-identity': ready('The inspected standards distinguish persistent identity, provenance, and revision relationships.', [
    binding('crossref-versioning', 'Versioning: preprints/accepted manuscripts/versions of record and corrections', 'Version relationships and persistent identifiers for scholarly objects.', 'A DOI identifies an object; it does not prove the object supports a claim.'),
    binding('w3c-prov-o', 'Overview; Entity; wasRevisionOf and wasDerivedFrom', 'Machine-readable identity and provenance relationships.', 'PROV expresses asserted provenance and does not independently validate it.'),
  ]),
  'maha-research:theorem-statement': ready('Lean provides an exact formal distinction between a proposition-bearing theorem statement and its proof body.', [
    binding('lean-theorems', 'Theorem Definitions: syntax, elaboration, and irreducibility', 'Formal theorem declarations and the statement/proof boundary.', 'A checked theorem proves only the encoded proposition under its assumptions; it does not validate an empirical premise.'),
  ]),
  'maha-research:propagation': ready('JCGM supplies equations and reporting requirements for measurement-uncertainty propagation.', [
    binding('jcgm-gum', 'Sections 5.1–5.2; equations (10) and (16); section 7.2', 'Propagation of standard measurement uncertainty through a stated model.', 'The method does not convert undocumented model error or epistemic uncertainty into measurement uncertainty.'),
  ]),
  'maha-research:section-locator': ready('The Web Annotation model defines exact selectors and their maintenance tradeoffs.', [
    binding('w3c-annotation', 'Sections 4.2.1, 4.2.4, and 4.2.5', 'Fragment, text-quote, and text-position selectors for passage location.', 'A locator makes content findable; it does not establish source identity or claim support.'),
  ]),
  'maha-research:figure-locator': ready('The selector model supports fragment-addressed resources and explicit states.', [
    binding('w3c-annotation', 'Sections 4.2.1 Fragment Selector and 4.3 State', 'Figure or media-fragment identity with version state.', 'A figure locator does not license image redistribution or validate an interpretation of the figure.'),
  ]),
  'maha-research:model-boundary': ready('NIST requires intended context, knowledge limits, assumptions, and generalization limits to be documented.', [
    binding('nist-ai-rmf', 'MAP 1.1, MAP 2.2, MEASURE 2.5–2.9', 'Documented use context, knowledge limits, generalizability, validation, and safe failure.', 'AI RMF 1.0 is voluntary guidance and is being revised; it does not certify a model.'),
  ]),
  'maha-research:uncertainty': ready('The metrology guide supplies a disciplined definition and reporting grammar for measurement uncertainty.', [
    binding('jcgm-gum', 'Sections 3.1, 4.1–4.4, and 7.2', 'Components, evaluation, combination, and reporting of measurement uncertainty.', 'Do not generalize a metrology construct to every form of uncertainty without declaring the translation.'),
  ]),
  'maha-research:research-release': ready('Crossref and COPE preserve versions and correction/retraction history instead of silently overwriting records.', [
    binding('crossref-versioning', 'Versioning: corrections, retractions, and version relationships', 'Persistent version and correction relationships.', 'Crossref guidance does not define Maha release authority.'),
    binding('cope-retraction', 'Sections 2–4: when to retract and form of notices', 'Reasons for retraction and durable notice requirements.', 'COPE guidance concerns scholarly publication ethics, not software deployment.'),
  ]),
  'maha-research:calculation-inputs': ready('JCGM requires the measurand, model, input estimates, uncertainty components, units, and reporting assumptions.', [
    binding('jcgm-gum', 'Sections 4.1–4.4, 5.1–5.2, and 7.2', 'Inputs, model, uncertainty, units, sensitivity coefficients, and reporting.', 'A complete input record makes a calculation reproducible; it does not make its model appropriate.'),
  ]),
  'maha-research:literature-conflict': ready('Cochrane distinguishes clinical, methodological, and statistical heterogeneity and warns against forced synthesis.', [
    binding('cochrane-heterogeneity', 'Sections 10.10.1–10.10.4', 'Classifying inconsistency, measuring it, and deciding whether synthesis is meaningful.', 'The guidance is written for systematic reviews of interventions; other domains must adapt it explicitly.'),
  ]),
  'maha-research:rights-basis': ready('The inspected rights sources separate access, permission, attribution, exceptions, and endorsement.', [
    binding('cc-by-4', 'Sections 2 and 3', 'Licensed rights, attribution conditions, retained notices, and no-endorsement boundary.', 'One work’s license does not grant rights in third-party material, trademarks, privacy, or patents.'),
    binding('w3c-annotation', 'Section 3.3.6 Rights', 'Recording rights information on annotation resources.', 'Recording a rights URI is not proof that the asserted right is valid.'),
  ]),
  'maha-strategies:source-identity': ready('The Research definition is backed by persistent-identity standards and the local pages are bounded applications.', [
    binding('crossref-versioning', 'Versioning: object identity and version relationships', 'Operational checks for declared scholarly identity.', 'Identity verification does not imply passage support or commercial reuse rights.'),
    binding('w3c-prov-o', 'Entity and revision relationships', 'Provenance relations used by a verification workflow.', 'A provenance assertion remains an assertion until checked.'),
  ], 'Each application must link to the selected Research source-identity definition.'),
  'maha-strategies:identity-bound-agents': ready('NIST zero trust and MCP authorization both bind access decisions to an authenticated subject, resource, and policy.', [
    binding('nist-zero-trust', 'Sections 3.2–3.3: policy decision point, policy enforcement point, and trust algorithm', 'Per-request subject and resource authorization.', 'Zero trust is an architecture, not proof that this implementation is secure.'),
    binding('mcp-authorization', 'Token validation; resource indicators; audience validation; token storage', 'MCP resource-server authorization boundaries.', 'Authorization is optional in MCP and HTTP transport-specific.'),
  ]),
  'maha-strategies:metered-evidence-retrieval': ready('The local contract exposes exact entitlement, quota, selector, replay, and evidence-quality boundaries.', [
    binding('local-mcp-evidence', 'MCP_EVIDENCE_TOOL; MCP_EVIDENCE_LICENSE_PLANS; MCP_EVIDENCE_LICENSE_TERMS; parseMcpEvidenceToolArguments; buildLicensedEvidenceProjection', 'Current Maha licensed-evidence interface and access boundary.', 'Repository behavior is product evidence, not independent evidence of security, availability, or customer value.'),
    binding('mcp-authorization', 'Access-token audience and resource validation requirements', 'Protocol-level authorization context for protected retrieval.', 'MCP does not define Maha pricing or quota policy.'),
  ]),
  'maha-strategies:context-budgeting': ready('The local implementation defines explicit byte/token budgets, selection modes, provenance modes, and metering boundaries.', [
    binding('local-context-compiler', 'STANDARD_MAX_CONTEXT_PACK_BYTES; parseContextPackRequest; compileContextPack; quoteMeteredCredits', 'Current bounded context-selection behavior.', 'Local implementation does not establish that a chosen context is sufficient or improves a model outcome.'),
    binding('nist-ai-rmf', 'MAP 2.2 and MEASURE 2.9', 'Documenting knowledge limits and interpreting outputs in context.', 'NIST does not prescribe Maha token budgets or ranking algorithms.'),
  ]),
  'maha-strategies:tool-authorization': ready('MCP gives the human-denial boundary while NIST zero trust supplies per-request enforcement architecture.', [
    binding('mcp-tools', 'Human in the loop; ability to deny tool invocations; safety recommendations', 'Human denial and clear tool-exposure UI.', 'The protocol does not mandate a specific interaction model and does not itself enforce deny-by-default.'),
    binding('nist-zero-trust', 'Sections 3.2–3.3', 'Dynamic per-request authorization through policy decision and enforcement points.', 'The architecture does not select an application’s tool allowlist.'),
    binding('local-mcp-gateway', 'SAFE_METHODS; evaluateGatewayPolicy; parseGatewayToolNames', 'Current Maha method and per-tool allowlist enforcement.', 'Code inspection does not prove deployed configuration or resistance to every attack.'),
  ]),
  'maha-strategies:failure-recovery': ready('The inspected guidance and local ledger separate interruption, recovery, replay, and indeterminate side effects.', [
    binding('nist-contingency', 'Sections 3.4–3.6 and 5: recovery strategies, testing, and reconstitution', 'Recovery planning, alternate processing, testing, and known-state restoration.', 'Federal-system contingency guidance does not prove a specific SaaS recovery time.'),
    binding('local-recovery', 'RecoveryStatus; RecoveryStore.claim; RecoveryStore.finish; recoveryResponseHeaders', 'Current replay-safe action and recovery-state ledger.', 'A recorded state is not independent confirmation of the upstream side effect.'),
  ]),
  'maha-strategies:enterprise-mcp-gateway': ready('The live product contract and local implementation establish the current supported controls and their limits.', [
    binding('local-mcp-gateway', 'parsePublicUpstreamUrl; assertPublicUpstreamHost; evaluateGatewayPolicy; evaluateContextPackAdmission; validateMcpHeaders', 'Current endpoint, SSRF, method, tool, and context-pack controls.', 'Code inspection does not establish production availability, private-network support, or commercial demand.'),
    binding('nist-zero-trust', 'Sections 3.2–3.3', 'Independent architecture for policy enforcement and least implicit trust.', 'NIST does not endorse or certify the Maha gateway.'),
  ]),
  'maha-strategies:credential-rotation': ready('RFC 9700 defines refresh-token rotation and sender-constrained tokens; the local implementation exposes expiry and status checks.', [
    binding('rfc-9700', 'Sections 2.2, 2.3, and 4.14', 'Sender constraint, audience-restricted access tokens, and refresh-token rotation.', 'The BCP addresses OAuth; non-OAuth secrets need an explicitly translated lifecycle.'),
    binding('local-credentials', 'createCredentialSecret; authorizeClientAccess; status and expires_at checks', 'Current Maha machine-credential issuance shape and refusal checks.', 'The source does not prove external revocation or rotation has occurred.'),
  ]),
  'maha-strategies:uncertainty-propagation': ready('The application can be bound directly to JCGM inputs and equations and to deterministic local calculation receipts.', [
    binding('jcgm-gum', 'Sections 5.1–5.2; equations (10) and (16); section 7.2', 'Worked propagation with declared units, correlation assumptions, and uncertainty.', 'Only measurement-uncertainty examples within the stated model are allowed.'),
  ], 'Worked examples must contain all numerical inputs and independently recomputable receipts; otherwise omit the number.'),
  'maha-strategies:rights-basis': ready('The local application is bounded by the Research definition and the legal-code distinction between access and licensed reuse.', [
    binding('cc-by-4', 'Sections 2–3', 'Verification of permissions and conditions for a CC BY 4.0 example.', 'The example cannot generalize to fair use, database rights, privacy, or other licenses.'),
    binding('w3c-annotation', 'Section 3.3.6 Rights', 'Machine-readable recording of a rights basis.', 'A recorded rights link does not prove the person applying it owns the rights.'),
  ], 'Each application must link to the selected Research rights-basis definition.'),
  'agentic-publishing:human-review': ready('ICMJE supplies a clear editorial-review definition and assigns final responsibility to editors.', [
    binding('icmje-peer-review', 'Responsibilities in the Submission and Peer-Review Process', 'Independent critical assessment, confidentiality, conflicts, and editorial responsibility.', 'This is medical-journal guidance; agentic publishing must label its adaptation and may not imply peer review occurred.'),
  ]),
  'agentic-publishing:agentic-query-letter': revise('No inspected authority defines an agentic query letter; the closest editorial source only governs conventional submission responsibilities.', [
    binding('icmje-peer-review', 'Responsibilities in the Submission and Peer-Review Process', 'Human author/editor responsibilities that a proposed machine query letter must not obscure.', 'The source does not define machine authorship, an agentic query-letter schema, or acceptance criteria.'),
  ], 'Write and review a canonical Publish protocol first, explicitly labelled as a Maha proposal rather than an editorial standard.'),
  'agentic-publishing:release-manifest': blocked('The observed canonical Publish definition route could not be inspected, so its templates and interfaces cannot be checked for semantic or schema agreement.', [
    binding('w3c-prov-o', 'Entity, Activity, Agent, used, wasGeneratedBy, and wasDerivedFrom', 'Minimum interoperable provenance relations for a release manifest.', 'PROV does not define Maha release authority, status transitions, or manifest schema.'),
    binding('local-release', 'CanonicalReleaseInput; releaseReadiness; buildEpistemicCanonicalRelease; sanitizedEpistemicRelease', 'Existing Maha release semantics available in the main repository.', 'A main-site implementation cannot silently substitute for the uninspected canonical Publish definition.'),
  ], 'Inspect https://publish.mahastrategies.com/docs/release-manifests and reconcile its schema with the current canonical-release implementation.'),
  'agentic-publishing:structured-abstract': ready('ICMJE names the required abstract components and the limits against overinterpretation.', [
    binding('icmje-abstract', 'Section IV.A.3.b Abstract', 'Context, purpose, procedures, main findings, effect sizes, conclusions, limitations, and consistency.', 'The guidance is biomedical and does not establish one universal abstract format for all disciplines.'),
  ]),
  'maha-os:health-data-consent': revise('HIPAA distinguishes consent and authorization, but the generic route would overstate a rule that only applies to covered entities and business associates.', [
    binding('hhs-hipaa-auth', 'Entire FAQ: consent versus authorization', 'HIPAA-specific distinction between optional consent and detailed authorization.', 'HIPAA does not govern every consumer health application or every jurisdiction.'),
    binding('nist-privacy', 'Core functions Identify-P, Govern-P, Control-P, Communicate-P, Protect-P', 'Voluntary privacy-risk framework for data processing and user control.', 'The framework is voluntary and does not create legal consent.'),
  ], 'Retitle and scope the page to the Maha OS consent record, with a separate applicability box for HIPAA and other jurisdictions.'),
  'maha-os:offline-operation': ready('NIST contingency guidance supports alternate processing, recovery, testing, and restoration to a known secure state.', [
    binding('nist-contingency', 'Sections 3.4–3.6; Table 3-4; Section 5', 'Offline/alternate processing, backups, exercises, recovery, and reconstitution.', 'The source does not establish that a specific device can perform every function offline.'),
    binding('nist-privacy', 'Control-P and Protect-P functions', 'User control and safeguards for local processing.', 'Local processing reduces some data-transfer risks but does not itself guarantee privacy.'),
  ]),
  'maha-os:model-update': ready('NIST patch guidance defines inventory, prioritization, testing, installation, verification, and operational tradeoffs.', [
    binding('nist-patching', 'Sections 2–4: enterprise patch management strategy and lifecycle', 'Planned update acquisition, testing, deployment, verification, and risk prioritization.', 'Patch guidance does not establish the safety or efficacy of a particular model update.'),
    binding('nist-ai-rmf', 'GOVERN 1.5; MAP 1.1; MEASURE 2.5–2.9; MANAGE 4.1', 'Lifecycle change, context, validation, limitations, monitoring, and response.', 'AI RMF 1.0 is voluntary and currently under revision.'),
  ]),
  'mayone-maharajan:governed-autonomy': ready('The authorial source defines autonomy as bounded control over attention, consent, and device use.', [
    binding('maha-principle', 'Device Autonomy assessment; bodily-autonomy bridge; authorial framing', 'The author’s normative concept of autonomy under technological and institutional pressure.', 'This is an authorial thesis and assessment framework, not a validated clinical scale or settled political doctrine.'),
    binding('orbital-mind', 'Mars · Agency and Boundary; Limits and Alternatives', 'Agency as mobilization constrained by boundaries and explicit failure modes.', 'Planetary and mythic material is symbolic imagery, not empirical evidence.'),
  ]),
  'mayone-maharajan:human-agency': ready('The manuscript explicitly defines agency, its limits, relationships, and development while separating evidence from symbolism.', [
    binding('orbital-mind', 'Mars · Agency and Boundary, sections I–V; Appendix A, Agency, effort, and leadership; Appendix B', 'Authorial definition, under/over-expression limits, relational stewardship, and development practices.', 'Authorial interpretation must remain labelled; psychology claims require their separately cited literature and planetary imagery testifies to nothing.'),
  ]),
  'mayon-rajan:hazard-zones': ready('PHIVOLCS publishes distinct current hazard maps for Mayon hazards.', [
    binding('phivolcs-hazards', 'Mayon Volcano Hazard Maps: pyroclastic flow, lahar, lava flow, and ash fall', 'Official hazard-map categories and map provenance.', 'A static guide never substitutes for the current PHIVOLCS alert level, bulletin, evacuation order, or local authority.'),
  ]),
  'mayon-rajan:identity-and-location': ready('The GVP entry supplies stable identity and coordinates; PHIVOLCS remains the live operational authority.', [
    binding('gvp-mayon', 'Basic Data; Geological Summary; volcano number 273030', 'Mayon identity, coordinates, morphology, setting, and historical-summary context.', 'The database is periodically updated and is not the live local alert authority.'),
    binding('phivolcs-hazards', 'Mayon Volcano Hazard Maps and current GIS link', 'Official Philippine hazard sources and route to current maps.', 'Location and identity do not establish current safety.'),
  ]),
  'maha-policy:tool-governance': ready('The policy can distinguish a protocol recommendation, a zero-trust enforcement architecture, and Maha proposals.', [
    binding('mcp-tools', 'Human in the loop and tool safety recommendations', 'Ability to deny invocations and communicate tool exposure.', 'MCP uses normative SHOULD language but does not mandate one interaction model.'),
    binding('nist-zero-trust', 'Sections 3.2–3.3', 'Policy decision and enforcement points for each request.', 'NIST zero trust is not tool-specific law.'),
  ]),
  'maha-policy:data-protection': ready('GDPR provides binding EU principles and rights while NIST provides a clearly voluntary operational framework.', [
    binding('gdpr', 'Articles 5, 22, 24, and 25', 'EU data-processing principles, automated decisions, controller responsibility, and data protection by design/default.', 'Jurisdiction, role, exemptions, and effective legal interpretation must be stated; this is not legal advice.'),
    binding('nist-privacy', 'Identify-P, Govern-P, Control-P, Communicate-P, Protect-P', 'Operational privacy-risk management functions.', 'The NIST framework is voluntary and does not satisfy GDPR by itself.'),
  ]),
  'maha-policy:public-trust': ready('OECD and NIST tie trustworthy practice to transparency, traceability, accountability, and documented risk management.', [
    binding('oecd-transparency', 'Principle 1.3', 'Disclosure, meaningful information, and ability to challenge AI outcomes.', 'A principle is not evidence that public trust increased.'),
    binding('nist-ai-rmf', 'GOVERN 4.2; MAP 2.2; MEASURE 2.8–2.9', 'Documentation, communication of impacts, limits, transparency, and accountability.', 'AI RMF is voluntary and trustworthiness characteristics can conflict.'),
  ]),
  'maha-policy:ai-agent-accountability': ready('The sources define role-based accountability, traceability, and governance without pretending an agent is a legal person.', [
    binding('oecd-accountability', 'Principle 1.5', 'Accountability according to role, traceability, and systematic risk management.', 'The principle does not allocate liability in a particular jurisdiction.'),
    binding('eu-ai-act', 'Articles 12–14, 20, and 26', 'Logging, oversight, incident/corrective duties, and deployer obligations for covered systems.', 'Most provisions are role- and risk-class-specific; they do not govern every agent.'),
  ]),
  'maha-policy:copyright-and-training-data': ready('EU law and the current U.S. Copyright Office report permit a jurisdiction-bounded comparison without claiming settled global law.', [
    binding('eu-dsm', 'Articles 3 and 4', 'EU text-and-data-mining exceptions, lawful access, retention, and machine-readable reservation.', 'National implementation and other rights still matter; the exception is not a global training license.'),
    binding('eu-ai-act', 'Article 53(1)(c)–(d)', 'GPAI-provider copyright policy and public training-content summary duties.', 'These are provider duties under the EU AI Act, not a ruling that training is licensed.'),
    binding('usco-ai-training', 'Executive Summary; Parts II–III; status page identifying pre-publication version', 'Current U.S. Copyright Office analysis of training uses and licensing questions.', 'The May 2025 document is pre-publication and not binding law or a court judgment.'),
  ]),
  'maha-policy:human-oversight': ready('The EU AI Act supplies binding high-risk-system duties; MCP supplies a narrower tool-denial recommendation.', [
    binding('eu-ai-act', 'Article 14', 'Human oversight objectives, competence, interpretation, override, intervention, and stop capability for high-risk systems.', 'Article 14 applies to high-risk systems under the Act and must not be generalized to every AI use.'),
    binding('mcp-tools', 'Human in the loop and tool safety recommendations', 'A human able to deny tool invocations in MCP deployments.', 'The protocol itself does not mandate a specific user interaction model.'),
  ]),
}

const MANUAL_SEMANTIC_OVERRIDES: Record<string, { disposition: SemanticDisposition; reason: string }> = {
  cand_e408480bb2fa7b47dcc46870: { disposition: 'reject-cross-property-definition', reason: 'The observed Publish versioning document is the canonical cross-property definition; Main may add a workflow application but not another generic definition.' },
  cand_5e6022299eca12e8075b56ae: { disposition: 'reject-cross-property-definition', reason: 'The observed Publish privacy-boundaries document already owns the definition; the Main candidate must be removed or recast as a concrete local control.' },
  cand_e6c929c6091b476a00819104: { disposition: 'replace-with-existing-route', reason: 'The existing /audit route is the same-host canonical audit-export surface; a second generic definition would be a doorway duplicate.' },
  cand_75aaf8bb30e7e38f7c51d303: { disposition: 'replace-with-existing-route', reason: 'The existing epistemic-system releases route already defines canonical release on the same host.' },
  cand_4ae22550519f12f62fb2994c: { disposition: 'replace-with-existing-route', reason: 'The existing MCP licensed-evidence retrieval contract is already the concrete definition and should receive any additional explanation.' },
  cand_188ee813ef00716b06198d73: { disposition: 'replace-with-existing-route', reason: 'The existing digest-bound buyer receipt and acknowledgement guide already covers this exact workflow subject.' },
  cand_def6fc0f88f719d9c206deaf: { disposition: 'replace-with-existing-route', reason: 'The existing conflicting-literature clearing page already answers this generic definition intent.' },
  cand_ee30bb8bfb36370ec54b2ae2: { disposition: 'replace-with-existing-route', reason: 'The existing calculation-receipt recomputation page is the same-host canonical concept surface.' },
}

const sourceById = new Map(FEDERATION_SOURCE_LIBRARY.map((entry) => [entry.sourceId, entry]))
const codeUnit = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const topicOf = (candidate: Candidate) => candidate.path.split('/').filter(Boolean).at(-2) ?? ''
const ownerTopicOf = (topic: string) => topic === 'uncertainty-propagation' ? 'propagation' : topic
const keyOf = (siteId: string, topic: string) => `${siteId}:${topic}`

export function manuallyValidateSemantics(semantic: SemanticArtifact) {
  const machineEntries = semantic.entries.filter((entry) => entry.disposition !== 'retain-distinct')
  if (machineEntries.length !== 43) throw new Error(`Expected 43 semantic adjudications; received ${machineEntries.length}.`)
  const entries = machineEntries.map((entry) => {
    const override = MANUAL_SEMANTIC_OVERRIDES[entry.candidateId]
    const manualDisposition = override?.disposition ?? entry.disposition
    const manualReason = override?.reason ?? (
      entry.disposition === 'revise-as-local-application'
        ? `The nearest observed route does not supply a generic ${entry.topic} definition. Retain the idea only as a ${entry.siteId} application with an explicit owner link.`
        : entry.disposition === 'replace-with-existing-route'
          ? `The observed route already answers the ${entry.topic} definition intent on the correct property.`
          : entry.disposition === 'reject-cross-property-definition'
            ? `The canonical owner has the ${entry.topic} definition; this property must link rather than redefine it.`
            : `The lower-scoring ${entry.topic} ${entry.routeRole} repeats the same site, subject, and role and has no independent answer contract.`
    )
    return {
      candidateId: entry.candidateId,
      candidateUrl: entry.url,
      topic: entry.topic,
      routeRole: entry.routeRole,
      machineDisposition: entry.disposition,
      manualDisposition,
      changedByManualReview: manualDisposition !== entry.disposition,
      comparedObservedUrl: entry.nearestObserved?.url ?? null,
      manualReason,
      reviewerTier: 'internal-editorial',
      reviewedOn,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-manual-semantic-validation/1.0',
    semanticAdjudicationDigest: semantic.provenanceDigest,
    method: 'Manual route-role and canonical-owner comparison of every machine-excluded candidate. URL similarity alone is not dispositive.',
    assurance: 'Internal editorial review; not external, independent, or expert endorsement.',
    counts: {
      reviewed: entries.length,
      confirmed: entries.filter((entry) => !entry.changedByManualReview).length,
      corrected: entries.filter((entry) => entry.changedByManualReview).length,
      byDisposition: Object.fromEntries(['reject-cross-property-definition', 'reject-internal-duplicate', 'replace-with-existing-route', 'revise-as-local-application'].map((state) => [state, entries.filter((entry) => entry.manualDisposition === state).length])),
    },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function observedNodeUrl(graph: DependencyGraph, nodeId: string): string | null {
  return [...graph.observedAnchorNodes, ...graph.observedTopicNodes].find((node) => node.nodeId === nodeId)?.url ?? null
}

export function validateCohortDependencies(candidateMap: CandidateMap, semantic: SemanticArtifact, graph: DependencyGraph, cohort: Cohort) {
  const candidateById = new Map(candidateMap.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const selected = new Set(cohort.entries.map((entry) => entry.candidateId))
  const semanticByKey = new Map(semantic.entries.map((entry) => [`${entry.siteId}:${entry.topic}:${entry.routeRole}`, entry]))
  const graphEdges = new Map<string, Array<{ dependsOn: string; reason: string }>>()
  for (const edge of graph.edges) graphEdges.set(edge.from, [...(graphEdges.get(edge.from) ?? []), { dependsOn: edge.dependsOn, reason: edge.reason }])
  const entries = cohort.entries.map((entry) => {
    const candidate = candidateById.get(entry.candidateId)!
    const topic = topicOf(candidate)
    const localDefinition = candidate.routeRole === 'definition'
      ? { kind: 'self-definition', candidateId: candidate.candidateId, url: candidate.url }
      : candidateMap.candidates.find((item) => item.siteId === candidate.siteId && topicOf(item) === topic && item.routeRole === 'definition' && selected.has(item.candidateId))
        ? (() => { const item = candidateMap.candidates.find((value) => value.siteId === candidate.siteId && topicOf(value) === topic && value.routeRole === 'definition' && selected.has(value.candidateId))!; return { kind: 'selected-definition', candidateId: item.candidateId, url: item.url } })()
        : (() => { const observed = semanticByKey.get(`${candidate.siteId}:${topic}:definition`); return observed?.disposition === 'replace-with-existing-route' && observed.nearestObserved ? { kind: 'observed-definition', candidateId: null, url: observed.nearestObserved.url } : null })()
    const owner = candidate.conceptAuthority.canonicalOwner
    const ownerTopic = ownerTopicOf(topic)
    const ownerDefinition = owner === candidate.siteId
      ? localDefinition
      : candidateMap.candidates.find((item) => item.siteId === owner && topicOf(item) === ownerTopic && item.routeRole === 'definition' && selected.has(item.candidateId))
        ? (() => { const item = candidateMap.candidates.find((value) => value.siteId === owner && topicOf(value) === ownerTopic && value.routeRole === 'definition' && selected.has(value.candidateId))!; return { kind: 'selected-owner-definition', candidateId: item.candidateId, url: item.url } })()
        : (() => { const observed = semanticByKey.get(`${owner}:${ownerTopic}:definition`); return observed?.disposition === 'replace-with-existing-route' && observed.nearestObserved ? { kind: 'observed-owner-definition', candidateId: null, url: observed.nearestObserved.url } : null })()
    const edges = (graphEdges.get(candidate.candidateId) ?? []).map((edge) => ({ ...edge, url: candidateById.get(edge.dependsOn)?.url ?? observedNodeUrl(graph, edge.dependsOn) }))
    const dependencyValid = Boolean(ownerDefinition && (owner !== candidate.siteId || localDefinition) && edges.every((edge) => edge.url))
    return {
      candidateId: candidate.candidateId,
      url: candidate.url,
      routeRole: candidate.routeRole,
      topic,
      canonicalOwner: owner,
      localDefinition,
      canonicalOwnerDefinition: ownerDefinition,
      graphEdges: edges,
      dependencyValid,
      evidenceCaveat: keyOf(candidate.siteId, topic) === 'agentic-publishing:release-manifest' ? 'The observed owner definition exists but its body was inaccessible during inspection.' : null,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-dependency-validation/1.0',
    cohortDigest: cohort.provenanceDigest,
    dependencyGraphDigest: graph.provenanceDigest,
    rule: 'Every application depends on its local topic definition; every non-owner application also depends on the exact canonical-owner topic definition. Family anchors remain additional dependencies.',
    counts: { checked: entries.length, valid: entries.filter((entry) => entry.dependencyValid).length, invalid: entries.filter((entry) => !entry.dependencyValid).length, bodyInspectionCaveats: entries.filter((entry) => entry.evidenceCaveat).length },
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function topicPackets(cohort: Cohort, localSourceFingerprints: Record<string, string>) {
  const represented = [...new Set(cohort.entries.map((entry) => keyOf(entry.siteId, entry.topic)))].sort(codeUnit)
  if (represented.length !== 38) throw new Error(`Expected 38 represented topics; received ${represented.length}.`)
  const packets = represented.map((topicKey) => {
    const evidence = TOPIC_EVIDENCE[topicKey]
    if (!evidence) throw new Error(`Missing evidence packet for ${topicKey}.`)
    const sources = evidence.sources.map((item) => {
      const identity = sourceById.get(item.sourceId)
      if (!identity) throw new Error(`Unknown source ${item.sourceId}.`)
      return { ...identity, locator: item.locator, scope: item.scope, boundary: item.boundary }
    })
    return {
      topicKey,
      disposition: evidence.disposition,
      reason: evidence.reason,
      sourceIdentityChecked: sources.every((item) => item.title && item.responsibleBody && item.versionOrDate && item.url),
      locatorChecked: sources.every((item) => item.locator.length > 5),
      rightsChecked: sources.every((item) => item.rightsBasis.length > 20),
      scopeChecked: sources.every((item) => item.scope.length > 20),
      boundaryChecked: sources.every((item) => item.boundary.length > 20),
      implementationCondition: evidence.implementationCondition ?? null,
      sources,
    }
  })
  const body = {
    schemaVersion: 'maha-federation-topic-evidence-packets/1.0',
    cohortDigest: cohort.provenanceDigest,
    inspectedOn: reviewedOn,
    inspectionMethod: 'Section-level inspection of official public sources plus symbol-level or section-level inspection of identified Maha-controlled sources. No source excerpt is retained.',
    localSourceFingerprints,
    counts: { topics: packets.length, sources: FEDERATION_SOURCE_LIBRARY.length, byDisposition: Object.fromEntries(['evidence-ready', 'revise', 'blocked'].map((state) => [state, packets.filter((packet) => packet.disposition === state).length])) },
    packets,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

function candidateDisposition(entry: Cohort['entries'][number], packet: ReturnType<typeof topicPackets>['packets'][number]): { disposition: EvidenceDisposition; reason: string } {
  if (entry.url.endsWith('/source-identity/failure-modes')) return { disposition: 'reject-as-duplicative', reason: 'The observed source-identity-mismatch page already answers this failure-mode intent; retain one canonical answer.' }
  if (entry.url.endsWith('/rights-basis/failure-modes')) return { disposition: 'reject-as-duplicative', reason: 'The observed rights-and-access-uncertain page already answers this failure-mode intent; retain one canonical answer.' }
  if (entry.routeRole === 'commercialization') return { disposition: 'revise', reason: 'The implementation and controls are evidenced, but current offer terms, availability, and customer outcomes are not established by the inspected sources.' }
  return { disposition: packet.disposition, reason: packet.reason }
}

function sectionsFor(role: string): string[] {
  const common = ['Direct answer', 'Definition and operating context', 'Evidence and exact locators', 'What the evidence does not establish', 'Related definitions and applications']
  const roleSpecific: Record<string, string> = {
    definition: 'Term boundaries and disambiguation',
    protocol: 'Ordered procedure and refusal conditions',
    relationships: 'Typed relationship map',
    fixture: 'Synthetic, reproducible fixture',
    'failure-modes': 'Failure taxonomy and detection',
    example: 'Bounded worked example',
    threats: 'Threat model and mitigations',
    implementation: 'Implementation contract and operational limits',
    'operator-guide': 'Operator checklist and rollback',
    template: 'Versioned template and required fields',
    'machine-interface': 'Machine-readable schema and validation rules',
    commercialization: 'Offer state, price, scope, privacy, and delivery terms',
    sources: 'Source register and jurisdiction/version notes',
    uncertainty: 'Uncertainty, unresolved questions, and change triggers',
    controls: 'Control objectives and failure evidence',
    preparedness: 'Preparedness actions and current-authority handoff',
    limits: 'Limits, exclusions, and non-claims',
    'official-sources': 'Official source hierarchy and freshness',
    workflow: 'Ordered workflow and handoff states',
    verification: 'Verification procedure and refusal codes',
    'commercial-use': 'Commercial-use boundary and rights checks',
    reproducibility: 'Reproduction inputs and digest checks',
    'worked-example': 'Worked inputs, units, assumptions, output, and receipt',
    mechanisms: 'Mechanisms, alternatives, and tradeoffs',
    development: 'Development pathway and limits',
    relationship: 'Relationship and non-equivalence map',
    governance: 'Authority, change, withdrawal, and audit rules',
  }
  return [common[0]!, roleSpecific[role] ?? 'Role-specific application', ...common.slice(1)]
}

export function evaluateTrancheOne(candidateMap: CandidateMap, semantic: SemanticArtifact, graph: DependencyGraph, cohort: Cohort, localSourceFingerprints: Record<string, string>) {
  const candidateById = new Map(candidateMap.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const manualSemantic = manuallyValidateSemantics(semantic)
  const dependencyValidation = validateCohortDependencies(candidateMap, semantic, graph, cohort)
  const evidencePackets = topicPackets(cohort, localSourceFingerprints)
  const packetByKey = new Map(evidencePackets.packets.map((packet) => [packet.topicKey, packet]))
  const dependencyById = new Map(dependencyValidation.entries.map((entry) => [entry.candidateId, entry]))
  const decisions = cohort.entries.map((entry) => {
    const packet = packetByKey.get(keyOf(entry.siteId, entry.topic))!
    const dependency = dependencyById.get(entry.candidateId)!
    const candidate = candidateById.get(entry.candidateId)!
    const classified = dependency.dependencyValid ? candidateDisposition(entry, packet) : { disposition: 'blocked' as const, reason: 'A required canonical or local definition dependency is missing.' }
    return {
      cohortOrder: entry.cohortOrder,
      candidateId: entry.candidateId,
      url: entry.url,
      title: candidate.title,
      siteId: entry.siteId,
      topic: entry.topic,
      routeRole: entry.routeRole,
      disposition: classified.disposition,
      reason: classified.reason,
      topicPacketKey: packet.topicKey,
      topicPacketDigest: provenanceDigest(packet),
      dependencyValidationDigest: provenanceDigest(dependency),
      exactSourceCount: packet.sources.length,
      reviewedOn,
      activeRouteCreated: false,
    }
  })
  const decisionBody = {
    schemaVersion: 'maha-federation-tranche-one-decisions/1.0',
    cohortDigest: cohort.provenanceDigest,
    topicEvidenceDigest: evidencePackets.provenanceDigest,
    dependencyValidationDigest: dependencyValidation.provenanceDigest,
    assurance: 'Internal editorial source inspection and route-readiness decision. It is not release authority, external expert review, or proof of public deployment.',
    counts: Object.fromEntries(['evidence-ready', 'revise', 'blocked', 'reject-as-duplicative'].map((state) => [state, decisions.filter((entry) => entry.disposition === state).length])),
    entries: decisions,
  }
  const decisionManifest = { ...decisionBody, provenanceDigest: provenanceDigest(decisionBody) }
  const specs = decisions.filter((decision) => decision.disposition === 'evidence-ready').map((decision) => {
    const candidate = candidateById.get(decision.candidateId)!
    const packet = packetByKey.get(decision.topicPacketKey)!
    const dependency = dependencyById.get(decision.candidateId)!
    const questions = [
      `What does ${candidate.title.replace(/ — .+$/, '')} mean in this bounded context?`,
      `Which inspected sources establish the ${decision.routeRole} answer?`,
      `What does the evidence not establish?`,
      `Which canonical definition must be read first?`,
      `What change would require this page to be revised or withdrawn?`,
    ]
    return {
      candidateId: decision.candidateId,
      url: decision.url,
      title: candidate.title,
      routeRole: decision.routeRole,
      answerContract: `Answer the ${decision.routeRole} intent directly; label law, standard, local implementation, authorial thesis, and proposal without transferring authority between them.`,
      requiredSections: sectionsFor(decision.routeRole),
      boundedQuestions: questions,
      sourceBindings: packet.sources.map((item) => ({ sourceId: item.sourceId, locator: item.locator, scope: item.scope, boundary: item.boundary })),
      dependencies: { localDefinition: dependency.localDefinition, canonicalOwnerDefinition: dependency.canonicalOwnerDefinition, graphEdges: dependency.graphEdges },
      structuredData: { type: 'TechArticle', noRatingOrEndorsement: true },
      machineContract: { deterministicAnswerRegistry: true, exactLocatorsRequired: true, prohibitedInferenceRequired: true, releaseAndRevisionMatchRequiredBeforePublication: true },
      implementationState: 'specification-only',
    }
  })
  const specificationBody = {
    schemaVersion: 'maha-federation-substantial-page-specifications/1.0',
    decisionManifestDigest: decisionManifest.provenanceDigest,
    rule: 'Only evidence-ready candidates receive a page specification. A specification is not a route, release, or deployment.',
    counts: { specifications: specs.length },
    specifications: specs,
  }
  const specifications = { ...specificationBody, provenanceDigest: provenanceDigest(specificationBody) }
  const reportBody = {
    schemaVersion: 'maha-federation-tranche-one-readiness/1.0',
    candidateMapDigest: candidateMap.provenanceDigest,
    cohortDigest: cohort.provenanceDigest,
    manualSemanticDigest: manualSemantic.provenanceDigest,
    dependencyValidationDigest: dependencyValidation.provenanceDigest,
    evidencePacketsDigest: evidencePackets.provenanceDigest,
    decisionManifestDigest: decisionManifest.provenanceDigest,
    specificationsDigest: specifications.provenanceDigest,
    status: 'local-readiness-complete',
    counts: {
      semanticAdjudicationsReviewed: manualSemantic.counts.reviewed,
      semanticAdjudicationsCorrected: manualSemantic.counts.corrected,
      selectedCandidates: cohort.entries.length,
      representedTopics: evidencePackets.counts.topics,
      dependenciesValid: dependencyValidation.counts.valid,
      evidenceReady: decisions.filter((entry) => entry.disposition === 'evidence-ready').length,
      revise: decisions.filter((entry) => entry.disposition === 'revise').length,
      blocked: decisions.filter((entry) => entry.disposition === 'blocked').length,
      duplicative: decisions.filter((entry) => entry.disposition === 'reject-as-duplicative').length,
      substantialPageSpecifications: specs.length,
      publicRoutesCreated: 0,
      vercelBuildsRun: 0,
    },
    implementationBoundary: 'The evidence-ready count may enter implementation. Publication still requires route implementation, deterministic verification, exact-revision review, canonical release where applicable, and explicit build/deployment authorization.',
    blockers: decisions.filter((entry) => entry.disposition !== 'evidence-ready').map((entry) => ({ candidateId: entry.candidateId, url: entry.url, disposition: entry.disposition, reason: entry.reason })),
  }
  const readinessReport = { ...reportBody, provenanceDigest: provenanceDigest(reportBody) }
  return { manualSemantic, dependencyValidation, evidencePackets, decisionManifest, specifications, readinessReport }
}

export function sourceFileFingerprints(root: string) {
  const paths = ['lib/mcp-gateway.ts', 'lib/mcp-evidence-public-contract.ts', 'lib/context-compiler.ts', 'lib/workflows/recovery.ts', 'lib/agent-client-credentials.ts', 'lib/epistemic-release.ts', 'content/books/the-orbital-mind/the-orbital-mind.md', 'content/books/the-maha-principle/The-Maha-Principle.md']
  return Object.fromEntries(paths.map((path) => [path, `sha256:${sha256Hex(readFileSync(`${root}/${path}`, 'utf8'))}`]))
}
