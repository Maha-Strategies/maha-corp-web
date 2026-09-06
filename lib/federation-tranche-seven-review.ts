import {
  buildFederationTrancheReview,
  type FederationReviewPacket,
  type FederationReviewSource,
} from './federation-tranche-four-review.ts'

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible source; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text or time-sensitive operational value is retained.'
const localRights = 'Maha-controlled repository source; symbols, headings, and file identity only. No credential, customer value, runtime payload, private input, or receipt body is retained.'

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

const packet = (topicKey: string, reason: string, sources: FederationReviewSource[]): FederationReviewPacket => ({
  topicKey,
  disposition: 'evidence-ready',
  reason,
  sourceIdentityChecked: true,
  locatorChecked: true,
  rightsChecked: true,
  scopeChecked: true,
  boundaryChecked: true,
  sources,
})

const local = (sourceId: string, title: string, path: string, locator: string, scope: string, boundary: string) => source(
  sourceId,
  title,
  'Maha Strategies',
  `repository source inspected ${reviewedOn}`,
  `repo:${path}`,
  'local-public-contract',
  locator,
  scope,
  boundary,
  localRights,
  'code-symbol',
)

const osfPreregistration = source(
  'osf-registrations',
  'Welcome to Registrations',
  'Center for Open Science',
  `living help page inspected ${reviewedOn}`,
  'https://help.osf.io/article/330-welcome-to-registrations',
  'research-workflow-guidance',
  'What are registrations?; What is preregistration?; registration immutability and withdrawal sections',
  'A registration can preserve a time-stamped, read-only study or analysis plan, and preregistration records that plan before data collection or analysis.',
  'Registration does not validate a hypothesis, analysis, dataset, predictive claim, or compliance, and it cannot prevent every deviation or selective report.',
)

const nistUncertainty = source(
  'nist-tn-1297',
  'Guidelines for Evaluating and Expressing the Uncertainty of NIST Measurement Results',
  'National Institute of Standards and Technology',
  'NIST Technical Note 1297, 1994 edition',
  'https://www.nist.gov/pml/nist-technical-note-1297',
  'government-metrology-guidance',
  '§§2–7; Appendix A; Appendix D.1',
  'The note distinguishes Type A and Type B evaluations, standard uncertainty, combined standard uncertainty, expanded uncertainty, uncertainty components, and reporting requirements.',
  'An uncertainty budget does not prove that a model or calibration is correct, identify every systematic effect, validate an input source, or validate astrology.',
  governmentRights,
)

const astrologyProtocol = (sourceId: string, locator: string, scope: string, boundary: string) => local(
  sourceId,
  'Astrology workflow protocols',
  'lib/astrology-workflow-protocols.ts',
  locator,
  scope,
  boundary,
)

const tamilSource = (
  sourceId: string,
  title: string,
  responsibleBody: string,
  versionOrDate: string,
  url: string,
  locator: string,
  scope: string,
  boundary: string,
  rightsBasis: string,
  sourceClass = 'primary-literary-text',
) => source(sourceId, title, responsibleBody, versionOrDate, url, sourceClass, locator, scope, boundary, rightsBasis, 'exact-passage-or-section')

const tolkappiyam = tamilSource(
  'tolkappiyam-porul-5-t7',
  'Tolkāppiyam III: Poruḷatikāram',
  'Project Madurai text preserved by TextGrid',
  'TextGrid version dated 2025-05-27; Project Madurai base text prepared 1999–2001',
  'https://textgridrep.org/browse/49tqk.0',
  'Akattiṇaiyiyal, nūṟpā 5, complete six-line deity-and-landscape stanza',
  'The edition prints Māyōṉ, Cēyōṉ, Vēntaṉ, and Varuṇaṉ in an ordered relationship with four literary landscapes and omits pālai from this complete stanza.',
  'The stanza establishes its wording and literary classification only; it does not prove chronology, a complete pantheon, ethnic ownership, universal historical worship, or later theological identity.',
  'CC BY-NC-SA 4.0 for the TextGrid representation; short quotation with attribution.',
)

const paripatal = tamilSource(
  'project-madurai-paripatal-t7',
  'Paripāṭal and Paripāṭal Tiraṭṭu',
  'Project Madurai',
  'Unicode Tamil edition first published 2000; page notice updated through 2021',
  'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0087.html',
  'Edition header; Tirumāl poems 1–4, 13, and 15; especially poem 2 lines 20–25 and poem 3 lines 31–40',
  'The inspected edition presents hymnic material addressed to Tirumāl and preserves named attributes, associated figures, poetic places, and compressed mythic allusions.',
  'A poem establishes its wording and discourse, not historical events, a universal theology, an unchanged identity across periods, or a direction of cultural influence.',
  'Project Madurai permits free distribution with its header intact; this packet links and paraphrases only.',
)

const subbiah = tamilSource(
  'subbiah-1988-t7',
  'Patterns in Religious Thought in Early South India: A Study of Classical Tamil Texts',
  'McMaster University Open Access Dissertations and Theses',
  'PhD dissertation submitted August 1988; MacSphere repository scan',
  'https://macsphere.mcmaster.ca/items/cb7a8643-b50b-447e-8964-7220a7ad2870',
  'printed pp. 64–66, 71–74, 98–114, 150–154, and 218–221',
  'The dissertation provides an attributed reading of the landscape stanza, Paripāṭal subject groups, Tirumāl sacred-place poetics, associated figures, and ambiguous epithets.',
  'This is a scholarly synthesis rather than a primary witness or archaeological report; translations, identities, site relations, and historical reconstruction remain attributed arguments.',
  'Open university repository copy; paraphrase and limited quotation with page attribution.',
  'scholarly-interpretation',
)

const divyaPrabandham = tamilSource(
  'divya-prabandham-part-4-t7',
  'Nālāyira Divya Prabandham, Part 4: English translation',
  'Project Madurai; translated by Kausalya Hart',
  'Project Madurai translation containing pāsurams 2971–4000',
  'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0624_eng.html',
  'Tiruvāymoḻi pāsurams 3052–3054, 3147–3150, 3310–3320, 3541–3543, 3615–3628, 3648–3650, and 3849–3852',
  'The named translation renders later devotional occurrences of forms including Māyan, Māl, Kaṇṇan, Nārāyaṇa, and Neṭumāl at exact numbered units.',
  'This establishes one translator’s rendering, not the untranslated Tamil, every semantic range, historical continuity with Sangam material, or the truth of theological claims.',
  'Project Madurai distribution terms; limited quotation and paraphrase with translator attribution.',
  'primary-text-in-translation',
)

export const TRANCHE_SEVEN_NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'agentic-publishing:context-pack': packet('agentic-publishing:context-pack', 'The local compiler and evaluator provide a deterministic, evidence-retention-aware context-package contract without claiming that retained context is true or sufficient.', [
    local('local-context-pack-compiler', 'Maha context-pack compiler', 'lib/context-compiler.ts', 'parseContextPackRequest; compileContextPack; includedPassages; inputHash and outputHash', 'The compiler validates bounded document and request inputs, selects source passages under a deterministic budget, and emits input and output hashes.', 'A compiled context pack does not establish source truth, relevance outside its declared request, legal compliance, downstream answer quality, or model behavior.'),
    local('local-context-pack-evaluator', 'Maha context-pack evidence evaluator', 'lib/context-pack-evaluator.ts', 'parseContextEvaluationRequest; evaluateContextPack; requiredEvidenceRetentionPercent', 'The evaluator requires exact evidence spans from declared input documents and reports whether each span was retained in the compiled pack.', 'Retention means that an exact supplied span remains present; it does not validate factual accuracy, answer quality, rights, safety, or downstream use.'),
  ]),
  'agentic-publishing:correction-policy': packet('agentic-publishing:correction-policy', 'Crossmark supports a bounded machine-readable status and update workflow; the publisher remains responsible for depositing complete and current metadata.', [
    source('crossref-crossmark-t7', 'Crossmark', 'Crossref', `living service documentation inspected ${reviewedOn}`, 'https://www.crossref.org/services/crossmark/', 'scholarly-status-service', 'Current status; corrections, retractions, and updates; additional publication information', 'Publisher-deposited Crossmark metadata can communicate a work’s current status and link corrections, retractions, or other updates.', 'Crossmark depends on publisher deposits and does not independently determine truth, completeness, misconduct, correction adequacy, or current status when metadata are absent.'),
  ]),
  'agentic-publishing:delivery-receipt': packet('agentic-publishing:delivery-receipt', 'The local receipt binds delivery to one execution, licensed projection, canonical release, record revision, route, and publication digest without treating entitlement as evidence quality.', [
    local('local-substantial-delivery-receipt', 'Substantial MCP delivery receipt contract', 'lib/substantial-mcp-delivery-receipt.ts', 'bindingFromLicensedProjection; buildSubstantialMcpDeliveryReceipt; verifySubstantialMcpDeliveryReceipt', 'A receipt records digest-bound execution, release, exact substantial-publication revision and route, delivery state, and acknowledgement requirement.', 'A valid receipt proves internal field and digest consistency only; it does not prove payment settlement, recipient identity, downstream use, external acknowledgement, or claim truth.'),
  ]),
  'agentic-publishing:source-rights': packet('agentic-publishing:source-rights', 'DataCite supplies explicit rights metadata fields while preserving the difference between recording a rights statement and possessing a permission.', [
    source('datacite-rights-4-7', 'DataCite Metadata Schema 4.7: Rights', 'DataCite', 'Metadata Schema 4.7', 'https://datacite-metadata-schema.readthedocs.io/en/4.7/properties/rights/', 'metadata-specification', 'Rights property; rightsList; rightsUri; rightsIdentifier; rightsIdentifierScheme; schemeUri', 'The schema can record a rights or license statement, URI, identifier, identifier scheme, and scheme URI for a resource.', 'Rights metadata records a supplied assertion or link; it does not grant rights, prove ownership, resolve territorial or contractual limits, or establish that a license covers a proposed use.'),
  ]),
  'maha-os:consent-receipts': packet('maha-os:consent-receipts', 'Kantara defines a human-readable and machine-readable consent record, while the local permission contract keeps execution authority bounded and revocable.', [
    source('kantara-consent-receipt-1-1', 'Consent Receipt Specification', 'Kantara Initiative', 'version 1.1.0, 20 February 2018', 'https://kantarainitiative.org/file-downloads/consent-receipt-specification-v1-1-0/', 'consent-record-specification', 'Definition of a Consent Receipt; receipt fields; human-readable and JSON representations', 'The specification describes a record of authority a PII principal states that a controller has for processing PII, with purpose and related receipt fields.', 'A receipt records stated consent; it does not prove identity, comprehension, legal validity, freely given consent, continuing authority, execution compliance, or applicability in every jurisdiction.'),
    source('nist-privacy-framework-consent-t7', 'NIST Privacy Framework: A Tool for Improving Privacy through Enterprise Risk Management', 'National Institute of Standards and Technology', 'version 1.0, January 2020', 'https://www.nist.gov/document/nist-privacy-frameworkv10pdf', 'government-guidance', 'Core Functions Identify-P, Govern-P, Control-P and Communicate-P; glossary definitions for data action and data processing', 'The framework organizes privacy-risk governance, data-processing awareness, individual participation, permissions, preferences, and communication across an information lifecycle.', 'The voluntary framework does not establish legal consent, identity, capacity, comprehension, jurisdictional compliance, or that a recorded preference was enforced.', governmentRights),
  ]),
  'maha-os:sensor-provenance': packet('maha-os:sensor-provenance', 'SOSA/SSN identifies observation inputs and results, while PROV records asserted generation and responsibility; neither validates a sensor reading.', [
    source('w3c-ssn-sosa-2023', 'Semantic Sensor Network Ontology', 'W3C', 'W3C Recommendation, 4 December 2023', 'https://www.w3.org/TR/vocab-ssn-2023/', 'web-standard', '§§5.5.1–5.5.2; sosa:madeBySensor, observedProperty, hasFeatureOfInterest, usedProcedure, hasResult, phenomenonTime, resultTime', 'SOSA can identify a sensor, observed property, feature of interest, procedure, result, phenomenon time, and result time for an asserted observation.', 'The ontology structures an assertion; it does not prove sensor accuracy, calibration, integrity, device identity, consent, completeness, or truthful reporting.'),
    source('w3c-prov-primer-t7', 'PROV Model Primer', 'W3C', 'Working Group Note, 30 April 2013', 'https://www.w3.org/TR/prov-primer/', 'standard-primer', '§2.3 generation and usage; §2.4 agents and responsibility; §2.5 roles', 'PROV represents entities, activities, agents, generation, use, derivation, association, attribution, and role-qualified responsibility.', 'PROV represents asserted provenance; it does not authenticate actors, observe an event, validate a result, or prove that the asserted history is complete.'),
  ]),
  'maha-research:abstract-only-evidence': packet('maha-research:abstract-only-evidence', 'The local source gate distinguishes bibliographic or abstract inspection from section/full-text inspection and refuses explanatory publication on the shallower state.', [
    local('local-source-reference-gate', 'Maha source-reference eligibility gate', 'lib/source-evidence-reference.ts', 'SourceInspectionDepth; evaluateSourcePage; section-or-full-text eligibility', 'The contract records inspection depth and permits an explanatory source page only when every bound record is current, released, subject-aligned, and inspected at section or full-text depth.', 'The gate enforces recorded state but cannot prove that the human inspection was competent, exhaustive, unbiased, or correctly transcribed.'),
  ]),
  'maha-research:author-manuscript': packet('maha-research:author-manuscript', 'NIHMS distinguishes an author accepted manuscript from the final published article, preserving version identity and rights questions.', [
    source('nihms-glossary-aam', 'NIHMS Glossary', 'National Institutes of Health Manuscript Submission System', `living glossary inspected ${reviewedOn}`, 'https://www.nihms.nih.gov/help/glossary/', 'government-publishing-guidance', 'Author Accepted Manuscript; Final Published Article', 'The glossary distinguishes the peer-reviewed accepted manuscript from the publisher’s final copyedited, formatted, and version-of-record article.', 'An accepted manuscript is not the final published article; public availability does not establish content identity, reuse permission, completeness, or that the accepted version contains later corrections.', governmentRights),
  ]),
  'maha-research:calibration': packet('maha-research:calibration', 'NIST supplies the measurement and uncertainty vocabulary needed to state calibration inputs, corrections, uncertainty components, and reporting limits.', [nistUncertainty]),
  'maha-research:citation-lineage': packet('maha-research:citation-lineage', 'DataCite supplies typed version relations that preserve lineage without treating related identifiers as content-equivalent.', [
    source('datacite-versioning-t7', 'Versioning', 'DataCite', `living support documentation inspected ${reviewedOn}`, 'https://support.datacite.org/docs/versioning', 'metadata-guidance', 'IsPreviousVersionOf; IsNewVersionOf; HasVersion; IsVersionOf', 'DataCite relation types can express predecessor, successor, version-container, and version-of relationships between deposited resources.', 'Deposited relations do not prove identity, semantic equivalence, completeness, correctness, chronology outside the metadata, or that every version has been linked.'),
  ]),
  'maha-research:claim-extraction': packet('maha-research:claim-extraction', 'The local contracts separate claim provenance from empirical support and require source identity, locator, scope, and boundary checks to travel independently.', [
    local('local-claim-evidence-contract', 'Maha claim-evidence contract', 'lib/claim-evidence.ts', 'assertClaimEvidence; provenance and empirical evidence axes', 'The contract represents where a claim came from separately from what empirical evidence, if any, supports it.', 'A typed evidence label does not make a claim true, sufficient, current, causal, reproducible, or within a source’s actual scope.'),
    local('local-source-alignment-contract-t7', 'Maha frontier source-alignment contract', 'lib/frontier-source-alignment.ts', 'source identity, version, locator, claim scope, and boundary axes', 'The alignment contract keeps source identity, version relationship, locator completeness, claim scope, and inference boundary as distinct review axes.', 'The contract detects recorded defects and omissions; it cannot replace inspection or infer support from metadata or topical similarity.'),
  ]),
  'maha-research:container-image': packet('maha-research:container-image', 'OCI defines manifest and descriptor fields that identify image bytes and configuration while making no broader security or reproducibility guarantee.', [
    source('oci-image-manifest-t7', 'OCI Image Manifest Specification', 'Open Container Initiative', `served specification inspected ${reviewedOn}`, 'https://specs.opencontainers.org/image-spec/manifest/', 'technical-specification', 'Image manifest property descriptions: schemaVersion, mediaType, artifactType, config, layers, subject, annotations', 'An OCI image manifest identifies configuration and ordered filesystem layers through typed descriptors and can carry subject and annotation metadata.', 'A manifest does not prove security, provenance, reproducibility, vulnerability state, runtime behavior, authorship, or correctness of the referenced content.'),
    source('oci-descriptor-t7', 'OCI Content Descriptor Specification', 'Open Container Initiative', `served specification inspected ${reviewedOn}`, 'https://specs.opencontainers.org/image-spec/descriptor/', 'technical-specification', 'Descriptor properties, especially mediaType, digest, size, urls, annotations and data', 'A descriptor supplies a content identifier and metadata needed to address and retrieve referenced content.', 'A matching digest identifies bytes, not safety, intent, source truth, availability, completeness, or semantic equivalence across separately built images.'),
  ]),
  'maha-strategies:ayanamsha-selection': packet('maha-strategies:ayanamsha-selection', 'The local protocol requires a named sidereal zero-point convention and comparison against the same celestial state, preventing a preferred interpretation from selecting the frame.', [
    astrologyProtocol('local-ayanamsha-selection-t7', 'zodiac-zero-point-declaration; sidereal-transform-receipt; tropical-sidereal-decision-map', 'The workflow names the sidereal convention and offset, records the transform inputs and receipt, and compares tropical and sidereal outputs without blending rule namespaces.', 'A declared ayanāṃśa makes a calculation reproducible but does not identify a universally correct convention or establish astrological validity.'),
  ]),
  'maha-strategies:calibration': packet('maha-strategies:calibration', 'NIST constrains uncertainty language and the local receipt exposes assumptions and units; neither converts a calibration workflow into evidence for astrology.', [
    nistUncertainty,
    astrologyProtocol('local-astrology-calibration-t7', 'root-sum-square-uncertainty; buildAstrologyCalculationReceipt; verifyAstrologyCalculationReceipt', 'The local workflow records numerical inputs, units, assumptions, outputs, uncertainty, operation identity, and a recomputable receipt digest.', 'A deterministic receipt checks calculation consistency only; it does not show that the model is calibrated, predictively valid, complete, or scientifically accepted.'),
  ]),
  'maha-strategies:ephemeris-selection': packet('maha-strategies:ephemeris-selection', 'NAIF explains version, coverage, metadata, and loading-order choices, while the local protocol requires the complete ephemeris dependency chain to be pinned.', [
    source('naif-kernel-selection-t7', 'Selecting the Kernels to Use', 'NASA/JPL Navigation and Ancillary Information Facility', `living technical guidance inspected ${reviewedOn}`, 'https://naif.jpl.nasa.gov/naif/kernel_selection.html', 'government-technical-guidance', 'Kernel selection; meta-kernels; time coverage; precedence; predicted, reconstructed and archived kernels', 'NAIF documents selecting kernels by required data, time coverage, quality, metadata, and precedence, and recording a reproducible loading set.', 'The newest file is not automatically correct for reproduction; selection does not validate downstream interpretation, guarantee coverage, or establish astrological meaning.', governmentRights),
    astrologyProtocol('local-ephemeris-pinning-t7', 'ephemeris-model-pinning', 'The protocol binds positions to an identified ephemeris, kernel or data release, software version, correction policy, and dependency digest.', 'Pinning makes dependencies inspectable and repeatable; it does not make the output accurate beyond the source data or validate astrology.'),
  ]),
  'maha-strategies:falsifiability': packet('maha-strategies:falsifiability', 'Prospective registration and a locked local claim protocol preserve the difference between a testable prediction and a retrospective interpretation.', [
    osfPreregistration,
    astrologyProtocol('local-falsifiability-protocol-t7', 'preregister-one-testable-claim; prospective-model-scoring; null-adverse-and-replication-reporting', 'The protocol freezes one measurable claim, outcome window, data source, scoring rule, baseline, exclusions, and reporting obligations before the outcome.', 'A testable protocol does not establish predictive validity; a single result is not general validation, and exploratory or retrospective findings remain labelled.'),
  ]),
  'maha-strategies:prospective-registration': packet('maha-strategies:prospective-registration', 'OSF defines immutable time-stamped registration and the local workflow specifies the prediction fields that must be fixed before outcome access.', [
    osfPreregistration,
    astrologyProtocol('local-prospective-registration-t7', 'preregister-one-testable-claim; blinded-outcome-join; multiplicity-and-stopping-rule', 'The local protocol fixes hypotheses, eligible tasks, outcome sources, scoring, baselines, multiplicity, stopping, and abstention rules before outcomes are joined.', 'Registration documents a declared plan; it does not guarantee adherence, methodological adequacy, blinding, data integrity, statistical power, or a favorable result.'),
  ]),
  'maha-strategies:kannan': packet('maha-strategies:kannan', 'The exact later translated occurrences of Kaṇṇan can be connected to Māyōṉ research only as a typed reception relation, not silently normalized into one timeless name.', [divyaPrabandham, subbiah]),
  'maha-strategies:palai': packet('maha-strategies:palai', 'The complete inspected stanza supports only passage-level silence about pālai; it cannot support a universal absence claim or a deity assignment elsewhere.', [tolkappiyam, subbiah]),
  'maha-strategies:paripatal': packet('maha-strategies:paripatal', 'The primary edition supplies exact Tirumāl poem locations and the dissertation supplies attributed corpus and reception context; their evidentiary roles remain distinct.', [paripatal, subbiah]),
  'maha-strategies:sangam-landscapes': packet('maha-strategies:sangam-landscapes', 'The primary stanza and attributed scholarship support a bounded literary relationship graph without turning tiṇai into a complete historical cult map.', [tolkappiyam, subbiah]),
  'maha-strategies:tirumal': packet('maha-strategies:tirumal', 'Tirumāl is traced from exact Paripāṭal passages into later translated devotional forms without erasing genre, date, translation, or institutional differences.', [paripatal, divyaPrabandham, subbiah]),
  'mayon-rajan:eruption-history': packet('mayon-rajan:eruption-history', 'The Smithsonian archive supports a historical eruption chronology, while PHIVOLCS remains the current operational authority; the packet freezes no alert or current-status value.', [
    source('smithsonian-gvp-mayon-history-t7', 'Mayon volcano profile and eruptive history', 'Smithsonian Institution Global Volcanism Program', `living database page inspected ${reviewedOn}`, 'https://volcano.si.edu/volcano.cfm?vn=273030', 'scientific-volcano-database', 'Geological Summary; Eruptive History; eruption rows and cited references', 'The profile describes Mayon’s morphology, tectonic setting, documented eruption periods, and the database’s dated historical chronology.', 'The database is a living secondary compilation and does not provide the current PHIVOLCS alert, a forecast, hazard-zone permission, or operational advice; historical entries may be revised.'),
    source('phivolcs-mayon-current-authority-t7', 'PHIVOLCS-LAVA: Local Active Volcanoes Archive', 'DOST-PHIVOLCS', `live official portal inspected ${reviewedOn}`, 'https://volcano.phivolcs.dost.gov.ph/', 'official-hazard-source', 'Volcano Status; Bulletins; monitoring and hazard-information navigation', 'PHIVOLCS is the Philippine operational source for current Mayon bulletins, observations, alert levels, and public hazard information.', 'The portal is time-sensitive; this packet records no alert, reading, forecast, or safety instruction and cannot replace the latest official bulletin.', governmentRights),
  ]),
}

type ReviewInput = Omit<Parameters<typeof buildFederationTrancheReview>[0], 'trancheNumber' | 'additionalPackets'>

export function buildTrancheSevenReview(input: ReviewInput) {
  return buildFederationTrancheReview({
    ...input,
    trancheNumber: 7,
    additionalPackets: TRANCHE_SEVEN_NEW_PACKETS,
  })
}
