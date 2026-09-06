import {
  buildFederationTrancheReview,
  type FederationReviewPacket,
  type FederationReviewSource,
} from './federation-tranche-four-review.ts'

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible authority; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text or time-sensitive operational value is retained.'
const localRights = 'Maha-controlled repository source; headings, symbols, and file identity only. No credential, customer value, runtime payload, private input, or receipt body is retained.'
const authorRights = 'Maha-controlled working authorial manuscript; bounded summary only. The packet does not imply publication, peer review, consensus, or empirical validation.'

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

const local = (
  sourceId: string,
  title: string,
  path: string,
  locator: string,
  scope: string,
  boundary: string,
  sourceClass = 'local-public-contract',
) => source(sourceId, title, 'Maha Strategies', `repository source inspected ${reviewedOn}`, `repo:${path}`, sourceClass, locator, scope, boundary, localRights, 'code-symbol')

const manuscript = (sourceId: string, locator: string, scope: string, boundary: string) => source(
  sourceId,
  'The Maha Principle',
  'Mayone Maharajan',
  `working authorial manuscript inspected ${reviewedOn}`,
  'repo:content/books/the-maha-principle/The-Maha-Principle.md',
  'authorial-primary-source',
  locator,
  scope,
  boundary,
  authorRights,
  'book-section',
)

const tolkappiyam = source(
  'tolkappiyam-porul-5-t10',
  'Tolkāppiyam III: Poruḷatikāram',
  'Project Madurai text preserved by TextGrid',
  'TextGrid version dated 2025-05-27; Project Madurai base text prepared 1999–2001',
  'https://textgridrep.org/browse/49tqk.0',
  'primary-literary-text',
  'Akattiṇaiyiyal, nūṟpā 5, complete six-line deity-and-landscape stanza',
  'The printed unit orders Māyōṉ with mullai, Cēyōṉ with kuṟiñci, Vēntaṉ with marutam, and Varuṇaṉ with neytal.',
  'The stanza establishes wording and literary classification, not chronology, ethnic ownership, modern geography, a complete pantheon, or later theological identity.',
  'CC BY-NC-SA 4.0 for the TextGrid representation; short quotation with attribution.',
  'exact-passage',
)

const tiruvaymoli = source(
  'project-madurai-tiruvaymoli-t10',
  'Nālāyira Divya Prabandham, Part 4: English translation',
  'Project Madurai; translated by Kausalya Hart',
  'Project Madurai translation containing pāsurams 2971–4000',
  'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0624_eng.html',
  'primary-text-in-translation',
  'Edition header and Tiruvāymoḻi pāsurams 2791–3298, including numbered units with Māyan, Māl, Kaṇṇan, Nārāyaṇa and named devotional places',
  'The named translation supplies passage-level later devotional occurrences, poetic voices, places, epithets, and relationships.',
  'This is one translator’s rendering, not the untranslated Tamil, a critical apparatus, proof of direct descent from Sangam material, or verification of theology.',
  'Project Madurai permits free distribution with its header intact; this packet links and paraphrases only.',
  'exact-passage',
)

export const TRANCHE_TEN_NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'maha-os:data-retention': packet('maha-os:data-retention', 'NIST supplies a lifecycle control vocabulary for review, deletion, policy-bound destruction, minimized logging, and tested technical measures without selecting one universal retention period.', [
    source('nist-privacy-core-retention-t10', 'NIST Privacy Framework Core', 'National Institute of Standards and Technology', 'version 1.0, 16 January 2020', 'https://www.nist.gov/system/files/documents/2021/05/05/NIST-Privacy-Framework-V1.0-Core-PDF.pdf', 'government-guidance', 'CT.PO-P2–P4 and CT.DM-P1–P10, PDF pp. 4–5', 'A governed data lifecycle can define review, transfer, alteration, deletion, policy-bound destruction, minimized audit logging, permissions, testing, and stakeholder preferences.', 'The voluntary framework does not choose a retention period, establish consent, prove deletion in a particular system, override records law, or certify a Maha OS deployment.', governmentRights, 'full-text'),
  ]),
  'maha-policy:machine-contracting': packet('maha-policy:machine-contracting', 'UNCITRAL provides a bounded model-law frame for automated formation and performance, output attribution, code and dynamic information, unexpected outcomes, disclosure, and continuing compliance.', [
    source('uncitral-mlac-2024-t10', 'UNCITRAL Model Law on Automated Contracting', 'United Nations Commission on International Trade Law', 'adopted 11 July 2024; official overview inspected 2026-09-06', 'https://uncitral.un.org/en/mlac', 'intergovernmental-model-law', 'Purpose; technology neutrality and non-discrimination; party autonomy; legal recognition; output attribution; unexpected outcomes; disclosure', 'The Model Law supplies legislators with rules for recognizing automation in contract formation and performance, including AI, smart contracts, and machine-to-machine transactions.', 'A model law is not automatically enacted law. Contract validity, attribution, remedies, disclosure duties, consumer protections, and mandatory rules depend on the governing jurisdiction and agreement; this is not legal advice.'),
  ]),
  'maha-policy:model-evaluation': packet('maha-policy:model-evaluation', 'NIST ties model evaluation to mapped context, selected risks, declared metrics, repeatable TEVV, deployment-like conditions, monitoring, and documented tradeoffs.', [
    source('nist-ai-rmf-measure-t10', 'Artificial Intelligence Risk Management Framework Core', 'National Institute of Standards and Technology', 'AI RMF 1.0, 26 January 2023; online Core inspected 2026-09-06', 'https://airc.nist.gov/airmf-resources/airmf/5-sec-core/', 'government-guidance', 'MAP function; MEASURE 1.1–1.3, 2.1–2.13, 3.1–3.3 and 4.1–4.3', 'Evaluation begins from intended context and risk, documents tests, metrics and methods, uses representative conditions where appropriate, involves independent or affected actors as needed, and reports residual uncertainty and tradeoffs.', 'The framework is voluntary and context-dependent. It does not make one metric universally valid, certify a model, prove legal compliance, guarantee deployment performance, or eliminate unmeasured risk.', governmentRights),
  ]),
  'maha-policy:scientific-evidence-policy': packet('maha-policy:scientific-evidence-policy', 'The current U.S. statutory baseline requires agency evidence-building and evaluation planning; executive scientific-integrity policy is a separate, changeable instrument and is not relabelled as statute.', [
    source('evidence-act-pl-115-435-t10', 'Foundations for Evidence-Based Policymaking Act of 2018', 'United States Congress; official copy published by the U.S. Government Publishing Office', 'Public Law 115-435, approved 14 January 2019', 'https://www.govinfo.gov/content/pkg/PLAW-115publ435/pdf/PLAW-115publ435.pdf', 'law', 'Title I, 5 U.S.C. §§311–315, especially §§311–313; evaluation and personnel standards at 132 Stat. 5534–5535', 'The Act defines evaluation for its federal scope and requires agency evidence-building plans, annual evaluation plans, evaluation officers, capacity assessment, and government-wide evaluation guidance.', 'The law governs specified U.S. federal activity. It does not prescribe one scientific method, guarantee policy correctness, validate a study, or make later executive guidance statutory.', governmentRights, 'full-text'),
    source('eo-gold-standard-science-2025-t10', 'Restoring Gold Standard Science', 'Executive Office of the President of the United States', 'Executive Order of 23 May 2025; inspected 2026-09-06', 'https://www.whitehouse.gov/presidential-actions/2025/05/restoring-gold-standard-science/', 'executive-order', 'Sections 2–5, including principles, agency implementation, and interim scientific-integrity policies', 'The order states current executive-branch scientific-integrity direction, including transparency, uncertainty, alternative hypotheses, reproducibility, and reevaluation of intervening policies.', 'An executive order is not a statute and may change, be revoked, be constrained by law, or be implemented differently by agency. This packet does not claim universal scientific consensus or legal advice.', governmentRights),
  ]),
  'maha-research:evaluation-protocol': packet('maha-research:evaluation-protocol', 'NIST supplies the context-to-TEVV frame and Maha’s local evaluation corpus supplies a deterministic, label-frozen fixture whose retention metric remains distinct from factual accuracy.', [
    source('nist-ai-rmf-evaluation-protocol-t10', 'Artificial Intelligence Risk Management Framework Core', 'National Institute of Standards and Technology', 'AI RMF 1.0, 26 January 2023; online Core inspected 2026-09-06', 'https://airc.nist.gov/airmf-resources/airmf/5-sec-core/', 'government-guidance', 'MAP 1–5; MEASURE 1.1–1.3, 2.1–2.13, 3.1–3.3 and 4.1–4.3', 'A protocol can bind intended context, risk, test sets, metrics, tools, assessors, deployment conditions, monitoring, uncertainty, and documentation into repeatable TEVV.', 'The framework does not supply a universal test fixture, validate a chosen metric, or make a passing evaluation equivalent to safety, truth, or production fitness.', governmentRights),
    local('local-wso2-evaluation-fixture-t10', 'Maha WSO2 evaluation corpus and harness', 'lib/integrations/wso2-evaluation-corpus.ts;repo:lib/integrations/wso2-evaluation-harness.ts', 'calculateWso2LabelFreezeDigest; validateWso2EvaluationLabels; evaluateWso2CompilerRetention; planEvaluationCalls; recordEvaluationResult', 'The local contract freezes labelled workloads, plans a bounded evaluation matrix, records results by deterministic identity, and measures exact required-span retention.', 'The fixture measures its declared corpus and exact-span retention only. It does not establish factual accuracy, answer quality, generalization, customer performance, or provider behaviour.'),
  ]),
  'maha-strategies:alvar-reception': packet('maha-strategies:alvar-reception', 'A named translation and attributed scholarship permit typed later-reception links while refusing an unbroken identity or institutional lineage from Sangam material.', [
    tiruvaymoli,
    source('reddy-tamil-bhakti-context-t10', 'The Giver of the Worn Garland: Krishnadevaraya’s Āmuktamālyada', 'University of California, Berkeley eScholarship; author Srinivas Reddy', 'PhD dissertation, 2011', 'https://escholarship.org/content/qt9v6585kp/qt9v6585kp.pdf', 'attributed-scholarship', 'pp. 25–26, 30, 33–46 and 88–93: Tamil bhakti, Āḻvārs, Nammāḻvār, temple localization, and akam/tiṇai literary continuity', 'The dissertation supplies an attributed literary and reception-historical context for Āḻvār devotion, Nammāḻvār, localization, and adaptation of Tamil poetic modes.', 'Literary continuity does not prove unchanged identity, cult, doctrine, institution, or direct transmission between any two named passages.'),
  ]),
  'maha-strategies:coordinate-frames': packet('maha-strategies:coordinate-frames', 'IERS and IAU SOFA define explicit celestial/terrestrial systems and transformation chains; the local protocol requires axes, origin, epoch, equinox, correction state, and uncertainty to be declared before interpretation.', [
    source('iers-conventions-2010-t10', 'IERS Conventions (2010)', 'International Earth Rotation and Reference Systems Service', 'IERS Technical Note 36, 2010; official conventions page inspected 2026-09-06', 'https://www.iers.org/SharedDocs/Publikationen/EN/IERS/Publications/tn/TechnNote36/tn36.pdf?__blob=publicationFile&v=2', 'intergovernmental-technical-standard', 'Introduction; Chapters 2–5 on celestial and terrestrial systems, frames, Earth orientation, and transformations', 'IERS defines standard reference systems, conventional realizations, models, constants, Earth-orientation inputs, and procedures for transforming between celestial and terrestrial systems.', 'A coordinate frame establishes geometry and conventions, not astrological meaning. Working updates may differ from the registered 2010 edition, and omitted epoch, origin, time scale, or correction state prevents a valid comparison.'),
    source('iau-sofa-cookbooks-t10', 'Standards of Fundamental Astronomy — Cookbooks', 'International Astronomical Union SOFA Center', 'living documentation inspected 2026-09-06', 'https://www.iausofa.org/cookbooks', 'astronomical-software-standard', 'Earth Attitude; Miscellaneous Topics; Astrometry Tools at a Glance', 'SOFA documents reference-system transformations, Earth attitude, time scales, calendars, Julian dates, and astrometric conversion chains.', 'The routines implement named astronomical conventions; they do not validate astrology, choose a zodiac or house tradition, remove upstream observation uncertainty, or justify interpretation.'),
    local('local-coordinate-frame-contract-t10', 'Astrology workflow protocols', 'lib/astrology-workflow-protocols.ts', 'reference-frame-declaration; coordinate-origin-selection; timescale-conversion-chain; canonical-input-manifest; combined-uncertainty-budget', 'The local workflows require self-describing coordinates, named transformations, retained precision, versioned inputs, and explicit stability decisions.', 'The workflows establish reproducibility and declared scope only. They do not turn interpretation into astronomical fact or claim predictive validity.'),
  ]),
  'maha-strategies:marutam': packet('maha-strategies:marutam', 'The exact primary-text relation is Vēntaṉ–marutam inside one four-landscape sequence; commentary and later Indra identification remain separate layers.', [tolkappiyam]),
  'maha-strategies:primary-text-boundaries': packet('maha-strategies:primary-text-boundaries', 'The inspected religion contract keeps edition wording, named translation, commentary, historical inference, reception history, and theology as separate evidence frames.', [
    tolkappiyam,
    tiruvaymoli,
    local('local-mayon-evidence-frames-t10', 'Māyōṉ knowledge evidence contract', 'lib/mayon-knowledge.ts', 'MayonEvidenceFrame; MAYON_SOURCES; MAYON_CLAIMS; commentarial-identification-layer', 'The local contract records exact source locators and distinguishes primary text, named translation, attributed scholarship, and bibliographic records.', 'A typed frame prevents authority transfer; it does not make a source correct, settle textual variants, verify theology, or permit silent translation.'),
  ]),
  'mayon-rajan:gas-emissions': packet('mayon-rajan:gas-emissions', 'USGS supplies general measurement capabilities and limitations while PHIVOLCS remains the operational authority for time-sensitive Mayon observations and bulletins.', [
    source('usgs-volcanic-gas-monitoring-t10', 'Volcanic gas monitoring', 'U.S. Geological Survey', 'Scientific Investigations Report 2024-5062, chapter E', 'https://pubs.usgs.gov/publication/sir20245062E', 'government-science', 'Required capabilities; direct sampling; plume composition and emission-rate measurements; diffuse soil emissions; Satellite Remote Sensing for SO2', 'Gas monitoring combines direct sampling, plume composition and emission-rate measurements, soil emissions, and satellite, airborne, and ground-based techniques to characterize baselines and change.', 'Techniques have different sensitivity, spatial scale, weather, access, and species limitations. A gas value alone does not deterministically predict an eruption or replace local multi-parameter interpretation.', governmentRights, 'full-text'),
    source('phivolcs-mayon-gas-bulletin-t10', 'PHIVOLCS-LAVA Mayon Volcano activity bulletin', 'DOST-PHIVOLCS', 'live operational bulletin service inspected 2026-09-06; no value retained', 'https://vmepd.phivolcs.dost.gov.ph/bulletin/activity-mvo?bid=16644&lang=en', 'official-hazard-source', 'Mayon bulletin fields for SO2 emission rate, measurement method, observation date, alert context, and authority notice', 'PHIVOLCS publishes dated Mayon-specific SO2 observations with the named measurement method and interprets them inside a current multi-parameter bulletin.', 'The value is time-sensitive and intentionally not copied into this packet. Readers must consult the latest PHIVOLCS bulletin; this route is not an alert, forecast, evacuation order, or substitute for local authorities.', governmentRights),
  ]),
  'mayone-maharajan:maha-principle': packet('mayone-maharajan:maha-principle', 'The author site may explain how the manuscript’s named principle relates to its own strategy, governance, verification, and application architecture without presenting the framework as accepted doctrine.', [
    manuscript('maha-principle-relationship-t10', 'THE MAHA PRINCIPLE: A MAP OF THE TERRAIN; The Architecture of Renewal; Chapters 5–8; The Fractal: As the Cell, So the State', 'The manuscript relates its central principle to asymmetric strategy, humane governance, verification under complexity, long-horizon vision, and application across scales.', 'The manuscript establishes the author’s intended relationships only. It does not prove novelty, empirical validity, adoption, philosophical priority, commercial success, or consensus.'),
  ]),
  'mayone-maharajan:recursive-institutions': packet('mayone-maharajan:recursive-institutions', 'The author site may define and relate this disclosed editorial label to the manuscript’s scale-aware institutional proposal while preserving the absence of independent validation.', [
    manuscript('maha-principle-recursive-institutions-t10', 'The Fractal: As the Cell, So the State; The Three Scales of Construction; subsidiarity and scale-error discussion; Zone of Exception', 'The manuscript proposes recurring governance patterns across individual, household, community, and civic scales and argues that competence and authority should remain scale-aware.', '“Recursive institutions” is an editorial label, not a settled academic term. The manuscript does not prove structural identity across scales, causal effects, institutional feasibility, or superior outcomes.'),
  ]),
}

export const TRANCHE_TEN_DECISION_OVERRIDES = {
  'maha-strategies:house-system-selection:calculation': {
    disposition: 'revise',
    reason: 'The inspected contract defines house-system eligibility and comparison, but it contains no independently recomputable house-cusp calculation fixture. The calculation route must remain held until one exists.',
  },
  'maha-strategies:interpretation-boundaries:calculation': {
    disposition: 'revise',
    reason: 'The inspected contract separates calculation from interpretation but does not make “interpretation boundaries” a numerical operation with inputs, units, assumptions, uncertainty, and a recomputable receipt.',
  },
  'maha-strategies:tradition-comparison:calculation': {
    disposition: 'revise',
    reason: 'The inspected decision maps compare declared conventions, but no recomputable cross-tradition calculation fixture is bound to this topic. A calculation-labelled page would overstate the evidence.',
  },
} as const

type ReviewInput = Omit<Parameters<typeof buildFederationTrancheReview>[0], 'trancheNumber' | 'additionalPackets' | 'decisionOverrides'>

export function buildTrancheTenReview(input: ReviewInput) {
  return buildFederationTrancheReview({
    ...input,
    trancheNumber: 10,
    additionalPackets: TRANCHE_TEN_NEW_PACKETS,
    decisionOverrides: TRANCHE_TEN_DECISION_OVERRIDES,
  })
}
