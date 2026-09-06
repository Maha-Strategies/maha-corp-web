import {
  buildFederationTrancheReview,
  type FederationReviewPacket,
  type FederationReviewSource,
} from './federation-tranche-four-review.ts'

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible source; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text is retained in the packet.'
const localRights = 'Maha-controlled repository source; symbols, headings, and file identity only. No credential, customer value, runtime payload, or private input is retained.'
const authorRights = 'Maha-controlled authorial manuscript; bounded paraphrase and locator only. The packet does not redistribute the manuscript.'

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

const astrologyProtocol = (sourceId: string, locator: string, scope: string, boundary: string) => source(
  sourceId,
  'Astrology workflow protocols',
  'Maha Strategies',
  `repository source inspected ${reviewedOn}`,
  'repo:lib/astrology-workflow-protocols.ts',
  'local-public-contract',
  locator,
  scope,
  boundary,
  localRights,
  'code-symbol',
)

const ianaTheory = source(
  'iana-tzdb-theory',
  'Theory and pragmatics of the tz code and data',
  'Internet Assigned Numbers Authority',
  `living tzdb theory inspected ${reviewedOn}`,
  'https://www.iana.org/time-zones/theory',
  'technical-reference',
  'Scope; Timezone identifiers; Accuracy of the tz database',
  'Timezone identifiers name representative regions whose civil-time histories and rules can be applied reproducibly when the database version is pinned.',
  'The database is not an authoritative historical record, does not represent uncertainty, and has incomplete or approximate historical coverage.',
)

const mahaPrinciple = (sourceId: string, locator: string, scope: string, boundary: string) => source(
  sourceId,
  'The Maha Principle',
  'Mayone Maharajan',
  'working authorial manuscript inspected 2026-09-06',
  'repo:content/books/the-maha-principle/The-Maha-Principle.md',
  'authorial-primary-source',
  locator,
  scope,
  boundary,
  authorRights,
  'book-section',
)

const cosmicRecursion = source(
  'cosmic-recursion-primary-t6',
  'The Cosmic Recursion',
  'Mayone Maharajan',
  'working authorial manuscript inspected 2026-09-06',
  'repo:content/books/the-cosmic-recursion/THE-COSMIC-RECURSION-manuscript.md',
  'authorial-primary-source',
  'Introduction: On the word recursion, and what I am refusing; The three registers; Four slots; How this could be wrong',
  'The manuscript defines its own recursive framework, distinguishes registers and analytical slots, and states conditions under which the framework would fail.',
  'An authorial framework does not establish physical recurrence, scientific consensus, empirical validation, priority, or external adoption.',
  authorRights,
  'book-section',
)

const tolkappiyam = source(
  'project-madurai-tolkappiyam-akattinaiyiyal-5',
  'Tolkāppiyam, Poruḷatikāram',
  'Project Madurai electronic text',
  `Project Madurai edition inspected ${reviewedOn}`,
  'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0100.html',
  'primary-literary-text',
  'Akattiṇaiyiyal, sūtra 5',
  'The printed unit directly orders Māyōṉ with mullai, Cēyōṉ with kuṟiñci, Vēntaṉ with marutam, and Varuṇaṉ with neytal.',
  'This literary ordering alone does not establish a universal cult map, chronology, ethnic exclusivity, later theological identity, or a relationship to Mayon Volcano.',
  'Project Madurai permits free distribution with its header intact; this packet links and paraphrases only.',
)

export const TRANCHE_SIX_NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'maha-os:caregiver-access': packet('maha-os:caregiver-access', 'U.S. HIPAA guidance distinguishes legally recognized personal representatives, individual-directed disclosure, care-related disclosure, and professional judgment; family status alone is not treated as universal access authority.', [
    source('hhs-hipaa-family-access', 'Under HIPAA, when can a family member access an individual’s PHI?', 'U.S. Department of Health and Human Services', `official FAQ inspected ${reviewedOn}`, 'https://www.hhs.gov/hipaa/for-professionals/faq/2069/under-hipaa-when-can-a-family-member/index.html', 'government-legal-guidance', 'Answer paragraphs on personal representatives, written direction, involvement in care, and incapacity', 'HIPAA permits distinct access or disclosure paths through applicable-law representation, an individual’s written direction, involvement in care, and specified professional-judgment circumstances.', 'Family relationship alone does not create universal access; applicable law, the individual’s instructions, minimum relevance, capacity, and context control. This is U.S.-specific information, not legal advice.', governmentRights),
    source('hhs-personal-representatives', 'Personal Representatives', 'U.S. Department of Health and Human Services', `official guidance inspected ${reviewedOn}`, 'https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/personal-representatives/index.html', 'government-legal-guidance', 'Who must be recognized; authority under applicable law; exceptions', 'A covered entity generally treats a person authorized under applicable law to act for an individual as the individual for relevant HIPAA rights.', 'Authority is role-, law-, person-, and context-specific and can be limited by exceptions; it does not authorize every caregiver action or every data system.', governmentRights),
  ]),
  'maha-policy:export-controls': packet('maha-policy:export-controls', 'BIS supplies the operative U.S. EAR structure and compliance-program elements, while GAO documents implementation burden without converting that burden into legal advice.', [
    source('bis-ear', 'Export Administration Regulations', 'U.S. Bureau of Industry and Security', `living regulations portal inspected ${reviewedOn}`, 'https://www.bis.gov/regulations/ear', 'government-regulation-portal', '15 CFR Parts 730–774; Commerce Control List; Country Chart; Country Groups', 'The EAR organizes U.S. dual-use export controls through classifications, destinations, end uses, end users, license requirements, and exceptions.', 'The BIS web presentation is not the official legal edition; rules change and any real transaction requires current facts, current law, and qualified advice.', governmentRights),
    source('gao-export-controls-2024', 'Export Controls: Commerce Implemented Advanced Semiconductor Rules and Took Steps to Address Compliance Challenges', 'U.S. Government Accountability Office', 'GAO-25-107386, 2 December 2024', 'https://www.gao.gov/products/gao-25-107386', 'government-audit', 'What GAO Found; compliance challenges; recommendations', 'GAO describes the 2022–2023 advanced-semiconductor controls, later updates, and reported compliance challenges including rule frequency and complexity.', 'The audit describes a dated control program and stakeholder challenges; it does not classify an item, determine a license, or state current law for a transaction.', governmentRights),
  ]),
  'maha-policy:health-ai-governance': packet('maha-policy:health-ai-governance', 'WHO supplies broad ethical principles and FDA/IMDRF supplies a narrower medical-device lifecycle practice model; the scopes remain separate.', [
    source('who-ai-health-2021', 'Ethics and governance of artificial intelligence for health', 'World Health Organization', '28 June 2021', 'https://www.who.int/publications/i/item/9789240029200', 'intergovernmental-guidance', 'Six consensus principles and governance recommendations', 'WHO frames health-AI governance through autonomy, well-being and safety, transparency, accountability, inclusion, and sustainability.', 'The guidance is broad, non-certifying, and not a substitute for jurisdiction-specific law, clinical evaluation, procurement review, or patient consent. Link and bounded paraphrase only; no WHO text is redistributed.'),
    source('fda-imdrf-gmlp', 'Good Machine Learning Practice for Medical Device Development: Guiding Principles', 'U.S. Food and Drug Administration and IMDRF', `final IMDRF principles noted January 2025; FDA page inspected ${reviewedOn}`, 'https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles', 'regulatory-guidance', 'Ten guiding principles across the total product lifecycle', 'The principles address multidisciplinary expertise, representative data, independent test sets, appropriate reference standards, human-AI interaction, deployed performance, and user information for ML-enabled medical devices.', 'The scope is medical-device development and does not certify a model, establish clinical benefit, create universal law, or cover every health-AI use.', governmentRights),
  ]),
  'maha-research:compiler-provenance': packet('maha-research:compiler-provenance', 'SLSA provides a stable provenance predicate for describing how an artifact was produced; the fixture role is descriptive and independently checkable, not proof of compiler correctness.', [
    source('slsa-build-provenance-v1-2', 'SLSA Build Track: Build Provenance', 'OpenSSF SLSA project', 'specification version 1.2', 'https://slsa.dev/spec/v1.2/build-provenance', 'supply-chain-specification', 'BuildDefinition; RunDetails; builder identity; external parameters; resolved dependencies', 'Build provenance can identify the builder, build process, external parameters, dependencies, environment details, and produced subject.', 'A provenance statement does not by itself prove source correctness, compiler correctness, reproducibility, absence of compromise, or semantic equivalence of outputs.'),
    source('local-witness-receipts-t6', 'Maha computational provenance witness', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:packages/maha-witness/README.md', 'local-implementation-documentation', 'Receipt contents; adapters; verification; current assurance limits', 'The local witness records digest-bound inputs, outputs, environment, seeds, adapter identity, and claim or dossier bindings for offline verification.', 'A recorded receipt is evidence of declared metadata and digest integrity, not independent reproduction, compiler correctness, scientific validity, or Production use.', localRights, 'named-section'),
  ]),
  'maha-strategies:biological-digital-sovereignty': packet('maha-strategies:biological-digital-sovereignty', 'This is an explicitly authorial concept about compromised choice, attention, and networked influence; critique may test its internal claims but cannot present the term as established scholarship.', [
    mahaPrinciple('maha-principle-biological-sovereignty', 'The Biological Basis of Liberty; Behavioral Capture: The Digital Voodoo Doll', 'The manuscript defines sovereignty narrowly as the capacity to choose from a body and mind not compromised without consent, and relates that definition to digitally mediated behavioral capture.', 'This is authorial doctrine and synthesis, not a clinical diagnosis, legal definition, measured population effect, or scholarly consensus.'),
  ]),
  'maha-strategies:birth-time-input': packet('maha-strategies:birth-time-input', 'The protocol keeps an imprecise event time as an interval and withholds unstable derived features rather than inventing minute-level precision.', [
    astrologyProtocol('local-birth-time-input', 'uncertain-time-interval; interval-stability-sweep', 'A bounded interval can retain the earliest and latest defensible instant, evaluate requested features throughout it, and withhold any feature that crosses a boundary.', 'The workflow does not recover an unknown birth time, make a midpoint observed, validate rectification, or validate astrology.'),
    ianaTheory,
  ]),
  'maha-strategies:cosmic-recursion': packet('maha-strategies:cosmic-recursion', 'Critique and application are limited to the manuscript’s explicit registers, slots, refusals, and failure conditions.', [cosmicRecursion]),
  'maha-strategies:location-input': packet('maha-strategies:location-input', 'Location is treated as a reproducible civil-time and coordinate input with versioned assumptions, not as a silent proxy for certainty.', [
    astrologyProtocol('local-location-input', 'civil-time-resolution; timezone-fold-gap-triage; uncertain-time-interval', 'A workflow can validate a named place or coordinates, bind an IANA region and tzdb version, enumerate fold or gap candidates, and carry unresolved location or timezone uncertainty forward.', 'A place name alone does not establish coordinates, historical civil time, the intended locality, astrological meaning, or a uniquely correct chart.'),
    ianaTheory,
  ]),
  'maha-strategies:mayon': packet('maha-strategies:mayon', 'The relationship and commentary routes start with the direct literary pairing and keep later identity claims in a separately attributed interpretive layer.', [
    tolkappiyam,
    source('local-mayon-evidence-contract', 'Māyōṉ knowledge evidence contract', 'Maha Strategies', `repository source inspected ${reviewedOn}`, 'repo:lib/mayon-knowledge.ts', 'local-public-contract', 'primary-text, translation, commentary, historical-inference, theology, and modern-namesake layer definitions', 'The local contract requires primary text, translation, commentary, historical inference, theology, and modern namesake relations to remain separately labelled.', 'A separation contract constrains presentation but does not independently prove an identity, date a tradition, validate a translation, or supply missing scholarship.', localRights, 'code-symbol'),
  ]),
  'maha-strategies:mental-sovereignty': packet('maha-strategies:mental-sovereignty', 'The term is presented as the manuscript’s own normative framework for attention, judgment, and dependence on networked systems.', [
    mahaPrinciple('maha-principle-mental-sovereignty', 'Zero-Inventory Thinking: The Hollowing of the Sovereign Mind; The Thin Client; The Steel-Man: What the Critics Get Right; The Attentional Veto', 'The manuscript develops an authorial critique of outsourced recall and judgment, considers a counterargument, and proposes a bounded attentional practice.', 'The manuscript does not establish a neurological effect, prevalence, therapeutic benefit, philosophical priority, or consensus definition.'),
  ]),
  'maha-strategies:missing-inputs': packet('maha-strategies:missing-inputs', 'Missing inputs remain missing; the protocol distinguishes refusal, interval analysis, and withheld outputs from fabricated defaults.', [
    astrologyProtocol('local-missing-inputs', 'uncertain-time-interval; interval-stability-sweep; refusal conditions and withheld-feature output', 'A calculation can proceed only where defensible bounds exist, can report features stable across those bounds, and must withhold unstable or ungrounded values.', 'The protocol does not turn absence into a probability, infer a preferred input from an output, or validate an astrological interpretation.'),
  ]),
  'maha-strategies:neytal': packet('maha-strategies:neytal', 'The bounded relationship is the literary Varuṇaṉ–neytal pairing in Akattiṇaiyiyal 5; later commentary and theology must be separately sourced.', [tolkappiyam]),
  'maha-strategies:timezone-resolution': packet('maha-strategies:timezone-resolution', 'Evaluation checks whether a civil timestamp resolves reproducibly under a pinned rule set and refuses hidden fold or gap choices.', [
    ianaTheory,
    astrologyProtocol('local-timezone-resolution', 'civil-time-resolution; timezone-fold-gap-triage', 'The local protocol validates civil fields, loads named timezone rules, enumerates ordinary, fold, and gap cases, and emits the offset and UTC instant together.', 'A successful conversion does not make tzdb authoritative for disputed history, remove source uncertainty, or validate astrology.'),
  ]),
  'mayon-rajan:seismicity': packet('mayon-rajan:seismicity', 'PHIVOLCS is the current operational authority for Mayon observations; USGS explains why seismicity is one complementary monitoring class rather than a deterministic forecast.', [
    source('phivolcs-mayon-instruments', 'Mayon Volcano monitoring instruments', 'DOST-PHIVOLCS', `live official page inspected ${reviewedOn}`, 'https://volcano.phivolcs.dost.gov.ph/monitor/instruments?volcano=mvo', 'official-hazard-source', 'Camera, volcano-station earthquake record, and RSAM instrument panels; page disclaimer', 'PHIVOLCS exposes Mayon-specific instrument observations including earthquake records and real-time seismic amplitude measurements.', 'Values are time-sensitive and cannot be independently interpreted as current behavior or a forecast without PHIVOLCS evaluation; this packet records no current alert level or numerical reading.', governmentRights),
    source('usgs-volcano-seismicity', 'Monitoring volcano seismicity provides insight to volcanic structure', 'U.S. Geological Survey', `program explanation inspected ${reviewedOn}`, 'https://www.usgs.gov/programs/VHP/monitoring-volcano-seismicity-provides-insight-volcanic-structure', 'government-science', 'Volcano-seismicity monitoring and interpretation sections', 'Earthquake locations, types, rates, and patterns can inform models of volcanic structure and changing processes when interpreted with other observations.', 'General U.S. science is not Mayon’s operational authority, and seismicity alone does not determine eruption timing, hazard-zone status, or public action.', governmentRights),
  ]),
  'mayone-maharajan:civilizational-memory': packet('mayone-maharajan:civilizational-memory', 'This is an authorial relationship among memory, language, culture, distributed cognition, and custodianship, not a settled historical or cognitive-science category.', [
    source('borrowed-light-civilizational-memory', 'The Borrowed Light', 'Mayone Maharajan', 'working authorial manuscript inspected 2026-09-06', 'repo:content/books/the-borrowed-light/chapter-5.md; repo:content/books/the-borrowed-light/chapter-6.md', 'authorial-primary-source', 'Chapter 5: The Hard Problem in the Mirror; Chapter 6: The Evidence That Needs No Physics and The Custodians', 'The manuscript relates cultural and linguistic inheritance to distributed memory and describes custodians as carrying knowledge beyond an individual mind.', 'This establishes the author’s framework, not a historical lineage, empirical model of memory, cultural authority, priority, or consensus.', authorRights, 'book-section'),
  ]),
}

type ReviewInput = Omit<Parameters<typeof buildFederationTrancheReview>[0], 'trancheNumber' | 'additionalPackets'>

export function buildTrancheSixReview(input: ReviewInput) {
  return buildFederationTrancheReview({
    ...input,
    trancheNumber: 6,
    additionalPackets: TRANCHE_SIX_NEW_PACKETS,
  })
}
