import {
  buildFederationTrancheReview,
  type FederationReviewPacket,
  type FederationReviewSource,
} from './federation-tranche-four-review.ts'

const reviewedOn = '2026-09-06'
const publicRights = 'Publicly accessible source; link and bounded paraphrase only. No source text is redistributed.'
const governmentRights = 'Official government source; link and bounded paraphrase only. No full text or time-sensitive operational value is retained.'
const localRights = 'Maha-controlled repository source; headings, symbols, and file identity only. No credential, customer value, runtime payload, private input, or receipt body is retained.'
const authorRights = 'Maha-controlled working authorial manuscript; bounded summary and short attributed quotation only. The packet does not imply publication, peer review, consensus, or empirical validation.'

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

const local = (sourceId: string, title: string, path: string, locator: string, scope: string, boundary: string, sourceClass = 'local-public-contract') => source(
  sourceId,
  title,
  'Maha Strategies',
  `repository source inspected ${reviewedOn}`,
  `repo:${path}`,
  sourceClass,
  locator,
  scope,
  boundary,
  localRights,
  'code-symbol',
)

const mahaPrinciple = (sourceId: string, locator: string, scope: string, boundary: string) => source(
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

const phivolcsAuthority = source(
  'phivolcs-mayon-operational-authority-t8',
  'PHIVOLCS-LAVA: Local Active Volcanoes Archive',
  'DOST-PHIVOLCS',
  `live official portal inspected ${reviewedOn}`,
  'https://volcano.phivolcs.dost.gov.ph/',
  'official-hazard-source',
  'Volcano Status; Bulletins; Monitoring Data; Visualize Data',
  'PHIVOLCS is the Philippine operational source for current Mayon bulletins, observations, alert levels, and public hazard information.',
  'The portal is time-sensitive. This packet records no current alert, measurement, forecast, hazard-zone permission, evacuation instruction, or safety assurance.',
  governmentRights,
)

export const TRANCHE_EIGHT_NEW_PACKETS: Record<string, FederationReviewPacket> = {
  'maha-policy:agent-identity': packet('maha-policy:agent-identity', 'SPIFFE supplies a bounded workload-identity namespace and verifiable identity document; NIST human digital-identity guidance is retained as an explicit non-transfer boundary rather than relabelled as agent identity.', [
    source(
      'spiffe-identity-svid-t8',
      'SPIFFE Identity and Verifiable Identity Document',
      'SPIFFE project',
      `latest stable rendered standard inspected ${reviewedOn}`,
      'https://spiffe.io/docs/latest/spiffe-specs/spiffe-id/',
      'workload-identity-standard',
      '§2 SPIFFE Identity, §§2.1–2.2 trust domain and path, §3 SPIFFE Verifiable Identity Document, §3.1 SVID Trust, §3.2 SVID Components',
      'A SPIFFE ID names a workload within a trust domain, and a signed SVID lets a compute endpoint present that identifier for cryptographic verification.',
      'The administrator defines path meaning; trust-domain names are self-registered; an SVID does not prove a human, legal entity, agent intent, delegated authority, current entitlement, or correct policy enforcement.',
    ),
    source(
      'nist-sp-800-63-4-agent-boundary-t8',
      'Digital Identity Guidelines',
      'National Institute of Standards and Technology',
      'NIST SP 800-63-4, final, August 2025',
      'https://pages.nist.gov/800-63-4/sp800-63.html',
      'government-digital-identity-guidance',
      'Scope and Applicability; Digital Identity Model; definitions of identifier and identity assurance level; excluded machine-to-machine and API subjects',
      'The guidelines define assurance concepts for identity proofing, authentication, federation, identifiers, and subscriber accounts for natural-person subjects.',
      'The publication explicitly does not address machine-to-machine authentication, interconnected devices, or API access on behalf of subjects. Those human assurance levels cannot be assigned to an autonomous agent by analogy.',
      governmentRights,
    ),
  ]),
  'maha-policy:public-sector-procurement': packet('maha-policy:public-sector-procurement', 'OMB M-25-22 supports a current, jurisdiction-bounded account of U.S. federal AI acquisition planning, testing, contracting, data rights, and performance monitoring.', [
    source(
      'omb-m-25-22-ai-acquisition-t8',
      'Driving Efficient Acquisition of Artificial Intelligence in Government',
      'U.S. Office of Management and Budget',
      'Memorandum M-25-22, 3 April 2025',
      'https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf',
      'government-policy-memorandum',
      '§2 Scope; §3 agency policy; §4 AI acquisition lifecycle guidance, especially pp. 4–7 on privacy, IP and data, cross-functional planning, demonstrations, performance requirements, and monitoring',
      'Covered U.S. federal agencies are directed to use cross-functional acquisition planning, protect privacy and government data, define IP terms, test systems in realistic settings, address lock-in, and use outcome-linked performance requirements and monitoring.',
      'The memorandum is limited to covered U.S. federal agencies and covered AI acquisitions, operates with other applicable law and policy, contains both requirements and recommendations, and is not a universal procurement code or legal advice.',
      governmentRights,
    ),
  ]),
  'maha-research:benchmark-design': packet('maha-research:benchmark-design', 'The NIST draft provides an explicit construct-first benchmark workflow and records configuration, scaffolding, cost, contamination, analysis, and reporting limits without turning one score into general capability.', [
    source(
      'nist-ai-800-2-ipd-t8',
      'Practices for Automated Benchmark Evaluations of Language Models',
      'National Institute of Standards and Technology',
      'NIST AI 800-2 ipd, Initial Public Draft, January 2026',
      'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.800-2.ipd.pdf',
      'government-initial-public-draft',
      'Practice 1.1 and Practice 1.2, pp. 7–10; evaluation protocol settings, pp. 12–20; analysis and reporting practices, pp. 23–29',
      'A benchmark evaluation should begin with intended use and measurement construct, assess conceptual fit, inspect items, fix protocol and scaffolding settings, control cost and leakage, and qualify the resulting measurements in analysis and reporting.',
      'This is an Initial Public Draft, not final guidance. A benchmark score is conditional on construct, items, population, provider, scaffolding, tools, budget, grading, and analysis; it does not establish general intelligence, real-world fitness, safety, or superiority outside that frame.',
      governmentRights,
      'full-text',
    ),
  ]),
  'maha-research:correction': packet('maha-research:correction', 'Crossmark supplies a public update-status channel while the local correction contract binds a proposed change to its predecessor and refuses undecided or no-op rewrites.', [
    source(
      'crossref-crossmark-correction-t8',
      'Crossmark documentation',
      'Crossref',
      `living service documentation inspected ${reviewedOn}`,
      'https://www.crossref.org/documentation/crossmark/',
      'scholarly-status-service',
      'Crossmark; Benefits of Crossmark; How Crossmark works; Obligations for Crossmark',
      'Publisher-deposited Crossmark metadata can expose current status and link corrections, retractions, or other updates through pages, PDFs, and the Crossref REST API.',
      'Crossmark depends on complete and prompt publisher deposits, and Crossref states that its presence is not a guarantee. It does not itself decide truth, misconduct, correction adequacy, or completeness.',
    ),
    local(
      'local-correction-governance-t8',
      'Maha correction governance contract',
      'lib/correction-governance.ts',
      'proposeCorrection; decideCorrection; applyCorrection; no-op-correction, undecided, rejected and stale-predecessor refusals',
      'The local contract creates an append-only proposed revision bound to predecessor text, requires a recorded decision, and applies only an accepted correction against the expected predecessor.',
      'The contract proves local transition and digest consistency only; it does not prove the correction is substantively right, externally reviewed, publicly released, or propagated to every copy.',
    ),
  ]),
  'maha-strategies:civilizational-computation': packet('maha-strategies:civilizational-computation', 'The route family names an authorial metaphor for applying a shared governance pattern across personal, household, community, and state scales; it must not be presented as literal computation or established systems science.', [
    mahaPrinciple(
      'maha-principle-civilizational-computation-t8',
      'Part III: The Application; The Fractal: As the Cell, So the State; The Three Scales of Construction; The Maha Rosetta Stone: One War, Four Battlefields; The Swarm vs. the Hive',
      'The manuscript proposes that a bounded set of governance principles can be expressed at individual, household, community, and state scales, and contrasts decentralized protocol coordination with centralized command.',
      '“Civilizational computation” is a label for Mayone Maharajan’s argument and metaphor. The manuscript does not establish that civilization literally computes, that biological and political systems are structurally identical, that the framework is novel or validated, or that its policy proposals work.',
    ),
  ]),
  'maha-strategies:interpretation-boundaries': packet('maha-strategies:interpretation-boundaries', 'The local astrology protocols keep event evidence, astronomical calculation, tradition-relative rule application, and empirical evaluation in separate stages.', [
    local(
      'local-astrology-interpretation-boundaries-t8',
      'Astrology workflow protocols',
      'lib/astrology-workflow-protocols.ts',
      'COMMON_BOUNDARY; source-event-intake; canonical-input-manifest; tropical-sidereal-decision-map; preregister-one-testable-claim; null-adverse-and-replication-reporting',
      'The protocols require source-bound event inputs, canonical calculation choices, tradition-specific rule namespaces, prospective hypotheses, ordinary baselines, and publication of null or adverse outcomes.',
      'The protocols can establish reproducibility, declared scope, and prospective-test status. They do not turn interpretation into astronomical fact, validate astrology, or permit a preferred interpretation to select inputs, frames, exclusions, or outcomes.',
    ),
  ]),
  'maha-strategies:narayana': packet('maha-strategies:narayana', 'The named translation supports occurrence-level commentary and typed identity relationships among Nārāyaṇa and neighboring devotional names without erasing passage, language, period, or theological frame.', [
    source(
      'divya-prabandham-narayana-t8',
      'Nālāyira Divya Prabandham, Part 4: English translation',
      'Project Madurai; translated by Kausalya Hart',
      'Project Madurai translation containing pāsurams 2971–4000',
      'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0624_eng.html',
      'primary-text-in-translation',
      'Tiruvāymoḻi pāsurams 3052–3054, 3147–3150, 3211–3221, 3222–3232, 3244–3254, and 3288–3298',
      'The named translation prints Nārāyaṇa within specific later Tamil devotional units alongside forms including Māyan and Kaṇṇan, with distinct poetic voices and contexts.',
      'This establishes one translator’s rendering at exact numbered units, not the untranslated Tamil’s complete semantic range, identity in every period, continuity from Sangam texts, historical events, or the truth of theological claims.',
      'Project Madurai distribution terms; limited quotation and bounded paraphrase with translator attribution.',
      'exact-passage',
    ),
  ]),
  'mayon-rajan:ashfall': packet('mayon-rajan:ashfall', 'USGS supplies general ashfall definition and impact evidence; PHIVOLCS remains the operational authority for current Mayon conditions and instructions.', [
    source(
      'usgs-volcanic-ashfall-t8',
      'Ashfall is the most widespread and frequent volcanic hazard',
      'U.S. Geological Survey Volcano Hazards Program',
      `living science page inspected ${reviewedOn}`,
      'https://www.usgs.gov/programs/VHP/ashfall-most-widespread-and-frequent-volcanic-hazard',
      'government-volcano-science',
      'Explosive eruptions produce ash; Ash endangers aviation and infrastructure; impact-variability discussion',
      'Explosive eruptions produce tephra; ash is the finest fraction, can travel far downwind, and can disrupt aviation, buildings, transport, utilities, agriculture, and health under conditions that vary by eruption and receiving environment.',
      'General USGS science does not establish a current Mayon ashfall, forecast its direction or thickness, define a Philippine hazard zone, or replace PHIVOLCS and local instructions.',
      governmentRights,
    ),
    phivolcsAuthority,
  ]),
  'mayon-rajan:deformation': packet('mayon-rajan:deformation', 'USGS explains what GPS networks can observe and infer from volcano deformation; PHIVOLCS remains the operational authority for current Mayon measurements and interpretation.', [
    source(
      'usgs-volcano-gps-deformation-t8',
      'Networks of GPS receivers track ground movement at volcanoes',
      'U.S. Geological Survey Volcano Hazards Program',
      `living science page inspected ${reviewedOn}`,
      'https://www.usgs.gov/programs/VHP/networks-gps-receivers-track-ground-movement-volcanoes',
      'government-volcano-science',
      'GPS network method; deformation inference; measurement-accuracy section',
      'Repeated positions from one receiver can reveal surface movement; a network can estimate the area, speed, and direction of deformation and inform models of subsurface reservoirs or faults.',
      'Deformation is not unique to magma, a subsurface model is an inference, and one signal does not determine whether or when Mayon will erupt. General U.S. guidance is not Mayon’s operational authority.',
      governmentRights,
    ),
    source(
      'usgs-comprehensive-volcano-monitoring-t8',
      'Comprehensive monitoring provides timely warnings of volcano reawakening',
      'U.S. Geological Survey Volcano Hazards Program',
      `living science page inspected ${reviewedOn}`,
      'https://www.usgs.gov/programs/VHP/comprehensive-monitoring-provides-timely-warnings-volcano-reawakening',
      'government-volcano-science',
      'Broad networks of many instruments; monitoring data and forecasting sections',
      'Volcano assessment combines ground movement with earthquakes, gas, chemistry, visual observations, and satellite analysis, compared against prior behavior.',
      'A multi-signal picture improves assessment but does not make eruption timing deterministic, validate every subsurface model, or supersede local warnings.',
      governmentRights,
    ),
    phivolcsAuthority,
  ]),
  'mayone-maharajan:mental-sovereignty': packet('mayone-maharajan:mental-sovereignty', 'This is an authorial doctrine of bounded interior and attentional self-direction, not a clinical, legal, neurological, or political sovereignty claim.', [
    mahaPrinciple(
      'maha-principle-mental-sovereignty-t8',
      'The Biological Basis of Liberty; Chapter 2: The Fractured Mind; The Attentional Veto; The Sovereign Self: Internal Authority Without Domination; The Mind Domain: Attentional Sovereignty',
      'The manuscript defines sovereignty as capacity for considered choice within one’s own mind and body, distinguishes that interior authority from domination of others, and proposes attention-management practices as an authorial programme.',
      'The term is Mayone Maharajan’s normative synthesis. It is not a diagnosis, legal status, measured neurological construct, proof that the proposed practices work, permission to disregard care, or authority over another person.',
    ),
  ]),
}

type ReviewInput = Omit<Parameters<typeof buildFederationTrancheReview>[0], 'trancheNumber' | 'additionalPackets'>

export function buildTrancheEightReview(input: ReviewInput) {
  return buildFederationTrancheReview({
    ...input,
    trancheNumber: 8,
    additionalPackets: TRANCHE_EIGHT_NEW_PACKETS,
  })
}
