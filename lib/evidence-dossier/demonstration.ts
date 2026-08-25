import { provenanceDigest, sha256Hex, canonicalJson } from './digest.ts'
import {
  CANONICALIZATION_VERSION,
} from './digest.ts'
import {
  DOSSIER_EPISTEMIC_BASE,
  DOSSIER_SCHEMA_VERSION,
  type DossierClaim,
  type DossierPassage,
  type DossierSource,
  type EvidenceDossier,
} from './schema.ts'

/**
 * Evidence Dossier v0.1 — sanitized semiconductor demonstration.
 *
 * Topic: stochastic acid generation in EUV photoresist.
 *
 * This is NOT the topic the commercial brief proposed. The brief's High-NA EUV
 * carbon-nanotube pellicle example was rejected because both submitted DOIs are
 * unregistered in the global DOI handle system and no matching Crossref records
 * were located, so the quoted passages could not be authenticated against the
 * cited identifiers. That makes the submitted claims unverifiable; it does not
 * establish that no related publication exists under different metadata. See
 * antigravity-example-audit.
 *
 * The replacement topic was chosen because its primary source can actually be
 * opened. Every passage below was read from the PDF, and every locator points
 * at a section, equation or caption that a reader can check.
 *
 * The primary source is a modelling paper. That is stated explicitly, and no
 * claim here is presented as an empirical measurement or as replicated.
 */

const NIST_URL = 'https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=910777'

const SOURCES: DossierSource[] = [
  {
    sourceId: 'src_gallatin_2012',
    submittedCitation:
      'Gallatin, G. M., Naulleau, P. P., & Brainard, R. Modeling the effects of acid amplifiers on photoresist stochastics. 22 February 2012.',
    correctedCitation: null,
    identifier: NIST_URL,
    publisherUrl: NIST_URL,
    publicationType: 'model-or-simulation',
    rightsBasis: 'bounded-quotation-for-review; publicly distributed by NIST',
    verificationState: 'document-inspected',
    verifiedAt: '2026-08-25',
    metadataProvenance:
      'PDF downloaded from the NIST publication server and read directly; title page, sections 1-3 and Figure 1 inspected.',
  },
  {
    sourceId: 'src_park_2023',
    submittedCitation:
      'Park, J. Y., Song, H.-J., Nguyen, T. C., & Son, W.-J. (2023). Novel Mechanism-Based Descriptors for Extreme Ultraviolet-Induced Photoacid Generation. Molecules, 28(17), 6244.',
    correctedCitation: null,
    identifier: 'doi:10.3390/molecules28176244',
    publisherUrl: 'https://doi.org/10.3390/molecules28176244',
    publicationType: 'journal-article',
    rightsBasis: 'open-license CC-BY-4.0',
    verificationState: 'metadata-verified',
    verifiedAt: '2026-08-25',
    metadataProvenance:
      'DOI registered in the global handle system (responseCode 1) and Crossref metadata retrieved. The publisher returned HTTP 403 to automated retrieval, so the document itself was not inspected and no passage is drawn from it.',
  },
  {
    sourceId: 'src_hinsberg_houle_2024',
    submittedCitation:
      'Hinsberg, W. D., & Houle, F. A. (2024). Comparison of the spatial statistics of random and defined-sequence photoresist films. Journal of Micro/Nanopatterning, Materials, and Metrology, 23(4), 044601.',
    correctedCitation: null,
    identifier: 'doi:10.1117/1.JMM.23.4.044601',
    publisherUrl: 'https://www.osti.gov/servlets/purl/2551791',
    publicationType: 'model-or-simulation',
    rightsBasis: 'open-license CC-BY-4.0',
    verificationState: 'document-inspected',
    verifiedAt: '2026-08-25',
    metadataProvenance:
      'Located via the OSTI records API (osti_id 2551791), accepted manuscript downloaded from the OSTI full-text endpoint and read directly. Title page, abstract, Section 1, Section 2 with Tables 1 and 2, and Figure 1 inspected. The article states CC-BY 4.0 and peer review on its cover page.',
  },
]

interface PassageSeed {
  passageId: string
  sourceId: string
  locator: string
  locatorKind: DossierPassage['locatorKind']
  excerpt: string
  isParaphrase: boolean
}

const PASSAGE_SEEDS: PassageSeed[] = [
  {
    passageId: 'pas_rls',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 1 (Introduction), first paragraph',
    locatorKind: 'section',
    excerpt:
      'EUV resists must simultaneously meet three requirements: high resolution (below 22 nm), low line edge roughness (LER) and high sensitivity.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_photon_energy',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 2, paragraph beginning "There are many sources of stochastic behavior"',
    locatorKind: 'section',
    excerpt:
      'EUV photons have an energy of about 92 eV, as opposed to DUV photons which have energies on the around 5 eV.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_secondary_electrons',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 2, paragraph beginning "There are many sources of stochastic behavior"',
    locatorKind: 'section',
    excerpt:
      'The process of secondary electron generation is certainly stochastic and is often referred to as acid shot noise.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_poisson',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 2, unnumbered equation following Eq. (5)',
    locatorKind: 'equation',
    excerpt:
      'Stochastic effects are introduced by replacing the nominal values of the exposure dose and the PAG, base and acid-amplifier densities in each 1 nm^2 area element with values drawn from a Poisson distribution p(n|N) = (N^n / n!) e^-N.',
    isParaphrase: true,
  },
  {
    passageId: 'pas_fig1_conditions',
    sourceId: 'src_gallatin_2012',
    locator: 'Figure 1 caption',
    locatorKind: 'caption',
    excerpt:
      'The Poisson statistics (discussed in the text) used to generate the plot on the right assumed a pixel size of 1 nm2 and the exposure dose corresponded to 5 mJ/cm2.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_2d_reduction',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 2, paragraph beginning "The aerial image intensity"',
    locatorKind: 'section',
    excerpt:
      'We simplify the numerics by assuming that the exposure intensity and the acid, base and AA densities are uniform through the resist thickness, i.e., in z, and integrate out the z dependence. This effectively reduces the problem to 2D.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_parameter_count',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 3 (Results), first paragraph',
    locatorKind: 'section',
    excerpt:
      'Given the number of parameters in the model (3 diffusion constants, 3 rate constants and 4 initial density values, acid, base, PAG and AA) it is difficult to easily express the full range of dependencies especially when stochastic effects are included.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_aerial_image',
    sourceId: 'src_gallatin_2012',
    locator: 'Section 2, paragraph beginning "The aerial image intensity"',
    locatorKind: 'section',
    excerpt:
      'The image used here is for a 50/50 nm line/space pattern, 1 micron long in the direction of the lines/spaces and 500 nm wide.',
    isParaphrase: false,
  },
]

const HH_PASSAGE_SEEDS: PassageSeed[] = [
  {
    passageId: 'pas_hh_dimensions',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Section 2 (Materials and Methods), final sentence of first paragraph',
    locatorKind: 'section',
    excerpt: 'The volume dimensions used in this work are 31 x 31 x 31 nm.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_hh_coarse_grained',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Section 2 (Materials and Methods), first paragraph',
    locatorKind: 'section',
    excerpt:
      'we employ a coarse-grained model of the resist film with a simplified representation of polymer chains as linear strings of spherical monomers. Monomers are connected by bonds with fixed bond lengths and bond angles, while the torsional angles along the chain are unconstrained.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_hh_composition',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Section 2.1 (Polymer Sequences and Film Compositions)',
    locatorKind: 'section',
    excerpt: 'In all cases, the mole ratios are HOST:TBMA:STYR:PAG:Q = 50:30:6.7:10:3.3.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_hh_shot_noise',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Section 1 (Introduction), page 044601-2',
    locatorKind: 'page',
    excerpt:
      'The small number of EUV photons required to print a feature leads to a variation in the number of photons absorbed from one feature to the next. This variation, shot noise, follows Poisson statistics and leads to a significant difference in the extent of photolysis within a collection of features.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_hh_rls_caution',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Section 1 (Introduction), page 044601-2',
    locatorKind: 'page',
    excerpt:
      'Consideration of the factors that control image quality in chemically amplified (CA) DUV photoresists identified a resolution-line edge roughness-sensitivity (R-L-S) tradeoff. Because of the statistical variations described above, it is not obvious that how the tradeoff operates is the same in EUV lithography.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_hh_result',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Abstract, Results',
    locatorKind: 'section',
    excerpt:
      'In all cases, the spatial distribution of chemical moieties in the film for defined sequence polymers is nearly indistinguishable from random copolymers.',
    isParaphrase: false,
  },
  {
    passageId: 'pas_hh_model_limits',
    sourceId: 'src_hinsberg_houle_2024',
    locator: 'Section 2.2.1 (Polymer packing and film formation-polyscope), final sentence',
    locatorKind: 'section',
    excerpt:
      'Aside from aggregate formation, we do not include in the model other potential interactions between building blocks, such as hydrogen bonding or pi-pi stacking.',
    isParaphrase: false,
  },
]

const PASSAGES: DossierPassage[] = [...PASSAGE_SEEDS, ...HH_PASSAGE_SEEDS].map((seed) => ({
  ...seed,
  extractionMethod: 'direct-pdf-read',
  originalDocumentInspected: true,
  passageHash: `sha256:${sha256Hex(canonicalJson({ locator: seed.locator, excerpt: seed.excerpt }))}`,
  sourceRevision:
    seed.sourceId === 'src_hinsberg_houle_2024'
      ? 'OSTI osti_id=2551791 accepted manuscript, retrieved 2026-08-25'
      : 'NIST pub_id=910777, retrieved 2026-08-25',
}))

const REVIEWER = {
  decidedBy: 'internal-editorial' as const,
  decidedAt: '2026-08-25',
}

type ClaimSeed = Omit<DossierClaim, 'provenanceDigest'>

const CLAIM_SEEDS: ClaimSeed[] = [
  {
    claimId: 'clm_rls_tradeoff',
    submittedStatement: 'EUV resists must trade off resolution, line edge roughness and sensitivity.',
    auditedStatement:
      'The cited modelling paper states that EUV resists must simultaneously meet high resolution below 22 nm, low line edge roughness and high sensitivity, and calls this the RLS tradeoff.',
    claimType: 'definition',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_rls'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked that the sentence appears in Section 1 of the inspected PDF. Not checked: whether 22 nm remains the operative figure for current nodes.',
    uncertainty: 'The 22 nm figure is the threshold stated by the authors in 2012 and is not a current process target.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not read the 22 nm figure as a present-day node requirement.',
      'Do not infer any specific resist formulation from this definition.',
    ],
    reviewerDecisions: [
      { decision: 'accept-as-bounded-definition', rationale: 'Directly quoted from the inspected source.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_photon_energy',
    submittedStatement: 'EUV photons carry far more energy than DUV photons.',
    auditedStatement:
      'The cited paper states EUV photon energy as about 92 eV against about 5 eV for DUV.',
    claimType: 'design-parameter',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_photon_energy'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked that both figures appear in the quoted sentence in Section 2. Not checked against an independent physical-constants source.',
    uncertainty:
      'Both values are stated as approximations by the authors. 13.5 nm corresponds to roughly 92 eV, but the paper gives no tolerance.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not infer dose or throughput from photon energy alone.',
      'Do not infer absorbed energy in resist from incident photon energy.',
    ],
    reviewerDecisions: [
      { decision: 'accept-as-stated-parameter', rationale: 'Quoted verbatim; presented as the authors state it.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_acid_shot_noise',
    submittedStatement: 'Secondary electron generation adds randomness to EUV exposure.',
    auditedStatement:
      'The cited paper describes secondary electron generation as stochastic and names the effect acid shot noise.',
    claimType: 'definition',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_secondary_electrons', 'pas_photon_energy'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the naming and the described mechanism in Section 2. Not checked: any quantitative secondary-electron yield, which the paper does not give.',
    uncertainty:
      'The paper asserts the mechanism qualitatively in this passage and does not quantify the secondary-electron contribution here.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not infer a numerical acid-shot-noise magnitude from this passage.',
      'Do not infer that acid shot noise dominates other stochastic channels.',
    ],
    reviewerDecisions: [
      { decision: 'accept-as-qualitative-mechanism', rationale: 'Bounded to what the passage asserts.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_poisson_model',
    submittedStatement: 'The model treats exposure statistics as Poisson.',
    auditedStatement:
      'In this model, stochastic effects are introduced by drawing dose and PAG, base and acid-amplifier densities per 1 nm^2 area element from a Poisson distribution.',
    claimType: 'modelled-result',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_poisson'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the Poisson form and the 1 nm^2 element in Section 2. This describes a modelling choice, not a measurement.',
    uncertainty:
      'Poisson statistics are an assumption of this model. The paper does not validate that assumption against measured resist data in the inspected sections.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not present this as an empirical finding about any real resist.',
      'Do not infer printed-feature roughness from the distributional assumption.',
    ],
    reviewerDecisions: [
      { decision: 'accept-as-model-assumption', rationale: 'Recorded explicitly as a modelling choice.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_figure_conditions',
    submittedStatement: 'The illustration uses a realistic exposure dose.',
    auditedStatement:
      'Figure 1 was generated with a 1 nm^2 pixel size and an exposure dose corresponding to 5 mJ/cm^2.',
    claimType: 'design-parameter',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_fig1_conditions'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the two conditions in the Figure 1 caption. Not checked: whether 5 mJ/cm^2 is representative of any production process.',
    uncertainty: 'These are the conditions of one illustrative figure, not a swept parameter study.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not treat 5 mJ/cm^2 as a recommended or typical production dose.',
      'Do not compare this dose to scanner source power, intermediate-focus power, or wafer-plane power; the paper relates it to none of them.',
    ],
    reviewerDecisions: [
      { decision: 'accept-with-condition-recording', rationale: 'Conditions recorded so the number is not read out of context.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_2d_reduction',
    submittedStatement: 'The simulation is three-dimensional.',
    auditedStatement:
      'The authors state the opposite: densities are assumed uniform through resist thickness and the z dependence is integrated out, reducing the problem to 2D.',
    claimType: 'author-stated-limitation',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_2d_reduction'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the stated simplification in Section 2. The submitted statement was contradicted by the source and was corrected rather than dropped.',
    uncertainty:
      'The paper does not quantify the error introduced by the 2D reduction in the inspected sections.',
    disagreements: [
      'The submitted statement asserted a 3D simulation; the source states an explicit reduction to 2D.',
    ],
    unsupportedExtensions: [
      'Do not infer through-thickness resist behaviour from these results.',
    ],
    reviewerDecisions: [
      {
        decision: 'correct-submitted-statement',
        rationale: 'The submitted wording was contradicted by the inspected passage. Both are retained.',
        ...REVIEWER,
      },
    ],
  },
  {
    claimId: 'clm_parameter_space',
    submittedStatement: 'The model fully characterises the parameter space.',
    auditedStatement:
      'The authors state that the number of parameters makes it difficult to express the full range of dependencies, and that they show sample results only.',
    claimType: 'author-stated-limitation',
    sourceIds: ['src_gallatin_2012'],
    passageIds: ['pas_parameter_count'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the limitation in Section 3. The submitted statement overstated the paper and was corrected.',
    uncertainty: 'Only sample results are presented; no sensitivity analysis is given in the inspected sections.',
    disagreements: [
      'The submitted statement claimed full characterisation; the source explicitly disclaims it.',
    ],
    unsupportedExtensions: [
      'Do not treat the figures as a parameter sweep.',
      'Do not extrapolate from the sample results to untested parameter combinations.',
    ],
    reviewerDecisions: [
      { decision: 'correct-submitted-statement', rationale: 'Author-stated limitation contradicts the submission.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_photoacid_descriptors',
    submittedStatement:
      'Mechanism-based descriptors predict EUV photoacid generation efficiency across resist chemistries.',
    auditedStatement:
      'A registered, openly licensed 2023 article on mechanism-based descriptors for EUV-induced photoacid generation exists. Its contents were not inspected, so nothing about its findings is asserted here.',
    claimType: 'definition',
    sourceIds: ['src_park_2023'],
    passageIds: [],
    epistemicStatus: 'source-metadata-verified',
    verificationScope:
      'Checked only that the DOI is registered and that Crossref metadata matches the citation. The document was not opened: the publisher returned HTTP 403 to automated retrieval.',
    uncertainty:
      'Everything about the article beyond its bibliographic metadata is unverified in this dossier.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not cite this dossier as support for any finding in that article.',
      'Do not treat metadata verification as evidence about content.',
    ],
    reviewerDecisions: [
      {
        decision: 'record-as-metadata-only',
        rationale:
          'Retained deliberately to show the difference between a located source and a read one. It supports no substantive claim.',
        ...REVIEWER,
      },
    ],
  },
]

const HH_CLAIM_SEEDS: ClaimSeed[] = [
  {
    claimId: 'clm_hh_three_dimensional',
    submittedStatement: 'The second source models the resist film in three dimensions.',
    auditedStatement:
      'Hinsberg and Houle model a 31 x 31 x 31 nm film volume using a coarse-grained representation of polymer chains as linear strings of spherical monomers.',
    claimType: 'modelled-result',
    sourceIds: ['src_hinsberg_houle_2024'],
    passageIds: ['pas_hh_dimensions', 'pas_hh_coarse_grained'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the stated volume and the coarse-grained representation in Section 2 of the inspected manuscript. Not checked: whether 31 nm is large enough to be representative, which the paper does not establish in the inspected sections.',
    uncertainty:
      'A coarse-grained sphere-and-bond representation is an abstraction of real polymer conformation. The paper states it is simplified.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not infer that a 3D model is more accurate than a 2D one; they answer different questions.',
      'Do not infer printed feature dimensions from the simulation volume.',
    ],
    reviewerDecisions: [
      { decision: 'accept-as-model-description', rationale: 'Quoted from the inspected methods section.', ...REVIEWER },
    ],
  },
  {
    claimId: 'clm_hh_shot_noise_poisson',
    submittedStatement: 'Both sources agree that EUV shot noise is Poisson.',
    auditedStatement:
      'Hinsberg and Houle state that shot noise, the feature-to-feature variation in absorbed EUV photons, follows Poisson statistics. Gallatin et al. independently apply Poisson statistics to exposure and component densities. Both are modelling papers stating the same distributional premise.',
    claimType: 'modelled-result',
    sourceIds: ['src_hinsberg_houle_2024', 'src_gallatin_2012'],
    passageIds: ['pas_hh_shot_noise', 'pas_poisson'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the Poisson premise in both inspected sources. This is agreement between two models on an assumption, not an empirical measurement and not a reproduction of a result.',
    uncertainty:
      'Neither inspected source validates the Poisson assumption against measured resist data in the sections read.',
    disagreements: [],
    unsupportedExtensions: [
      'Do not describe this as replication. Two models sharing an assumption is not an empirical result reproduced twice.',
      'Do not infer that the assumption is correct because two papers adopt it.',
    ],
    reviewerDecisions: [
      {
        decision: 'accept-as-shared-assumption',
        rationale: 'Recorded as agreement on a premise, explicitly not as replication.',
        ...REVIEWER,
      },
    ],
  },
  {
    claimId: 'clm_hh_rls_caution',
    submittedStatement: 'The RLS tradeoff established for DUV applies to EUV lithography.',
    auditedStatement:
      'Hinsberg and Houle state the opposite caution: the R-L-S tradeoff was identified for chemically amplified DUV photoresists, and because of EUV statistical variation it is not obvious that the tradeoff operates the same way in EUV lithography.',
    claimType: 'author-stated-limitation',
    sourceIds: ['src_hinsberg_houle_2024'],
    passageIds: ['pas_hh_rls_caution'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked in Section 1 of the inspected manuscript. This qualifies the v0.1 claim clm_rls_tradeoff, which recorded the tradeoff from a source that stated it without this caution.',
    uncertainty:
      'The authors state the transfer is not obvious. They do not establish that the tradeoff fails in EUV, only that it should not be assumed.',
    disagreements: [
      'The v0.1 dossier recorded the RLS requirement from Gallatin et al. without qualification. This source cautions that the DUV-derived tradeoff may not transfer to EUV.',
    ],
    unsupportedExtensions: [
      'Do not infer that the RLS tradeoff is invalid in EUV; the source says it is not obvious, not that it is false.',
    ],
    reviewerDecisions: [
      {
        decision: 'record-as-qualification-of-prior-claim',
        rationale:
          'The second source materially qualifies a claim carried in v0.1. Both are retained; the v0.1 claim is not deleted.',
        ...REVIEWER,
      },
    ],
  },
  {
    claimId: 'clm_hh_dsp_result',
    submittedStatement: 'Defined-sequence polymers produce more uniform resist films.',
    auditedStatement:
      'In this simulation the spatial distribution of chemical moieties for defined-sequence polymers was nearly indistinguishable from random copolymers of the same composition.',
    claimType: 'modelled-result',
    sourceIds: ['src_hinsberg_houle_2024'],
    passageIds: ['pas_hh_result', 'pas_hh_composition'],
    epistemicStatus: 'passage-supports-bounded-claim',
    verificationScope:
      'Checked the abstract Results statement and the composition in Section 2.1. The submitted statement asserted the opposite of the simulated outcome and was corrected.',
    uncertainty:
      'This is a simulated spatial-statistics comparison at one composition, not a lithographic performance measurement.',
    disagreements: [
      'The submitted statement claimed improved uniformity; the inspected source reports near-indistinguishability.',
    ],
    unsupportedExtensions: [
      'Do not infer printed line edge roughness from simulated moiety distribution.',
      'Do not generalise beyond the stated composition ratios.',
    ],
    reviewerDecisions: [
      { decision: 'correct-submitted-statement', rationale: 'Submitted wording contradicted the inspected result.', ...REVIEWER },
    ],
  },
]

const CLAIMS: DossierClaim[] = [...CLAIM_SEEDS, ...HH_CLAIM_SEEDS].map((seed) => ({
  ...seed,
  provenanceDigest: provenanceDigest(seed),
}))

const G = 'src_gallatin_2012'
const H = 'src_hinsberg_houle_2024'

const COMPARISON_SEED = {
  comparisonId: 'cmp_gallatin_hinsberg_houle',
  sourceIds: [G, H],
  question:
    'Do the two inspected sources describe stochastic acid generation in EUV photoresist in ways that can be compared?',
  relation: 'materially-different-assumptions' as const,
  relationRationale:
    'The two agree on the distributional premise and on the framing question, and then diverge on almost everything that determines what their outputs mean. One is a 2D continuum reaction-diffusion model of acid, base and amplifier densities; the other is a 3D coarse-grained molecular packing model of monomers, chains and sequences. They compute different quantities from different state variables, so agreement on the premise does not make their results comparable.',
  axes: [
    {
      axis: 'Dimensionality',
      values: {
        [G]: '2D. Densities are assumed uniform through resist thickness and the z dependence is integrated out.',
        [H]: '3D. A 31 x 31 x 31 nm film volume with periodic boundary conditions.',
      },
      comparable: false,
      note: 'A 2D-reduced continuum field and a 3D packed molecular volume are not the same object; neither is a refinement of the other.',
    },
    {
      axis: 'Model class',
      values: {
        [G]: 'Continuum reaction-diffusion equations for acid, base and acid-amplifier densities, solved by operator splitting.',
        [H]: 'Coarse-grained polymer packing: chains as linear strings of spherical monomers with fixed bonds and free torsions.',
      },
      comparable: false,
      note: 'Continuum densities versus explicit molecular placement. No mapping between the two state representations was supplied by either paper.',
    },
    {
      axis: 'Statistical assumption',
      values: {
        [G]: 'Poisson sampling of dose and of PAG, base and amplifier densities in each 1 nm^2 area element.',
        [H]: 'Photon shot noise follows Poisson statistics; component positions also vary according to Poisson statistics.',
      },
      comparable: true,
      note: 'This is the one axis on which the sources genuinely agree, and it is an agreement about an assumption rather than a measured result.',
    },
    {
      axis: 'Material model',
      values: {
        [G]: 'Generic chemically amplified resist expressed as four densities: acid, base, PAG and acid amplifier.',
        [H]: 'A specific ESCAP-class composition, HOST:TBMA:STYR:PAG:Q = 50:30:6.7:10:3.3, with PAG and quencher bound, free or aggregated.',
      },
      comparable: false,
      note: 'One models a generic resist with an acid amplifier; the other models a named composition without one. The chemistries are not the same system.',
    },
    {
      axis: 'Exposure conditions',
      values: {
        [G]: 'Figure 1 uses a 1 nm^2 pixel and a dose corresponding to 5 mJ/cm^2, for a 50/50 nm line/space aerial image.',
        [H]: 'A simple exposure-deprotection algorithm is applied to the packed film. No dose in mJ/cm^2 appears in the inspected sections.',
      },
      comparable: false,
      note: 'Without a stated dose on both sides, no exposure-level comparison can be made at all.',
    },
    {
      axis: 'Outputs',
      values: {
        [G]: 'Deprotection density maps and their dependence on which statistics are enabled.',
        [H]: 'Spatial statistics of chemical moieties, and developable image structure for defined-sequence versus random copolymers.',
      },
      comparable: false,
      note: 'Different quantities. Neither paper reports the other one, so there is no shared output to compare.',
    },
  ],
  agreements: [
    'Both treat EUV shot noise as Poisson-distributed.',
    'Both frame the problem as the interaction of small photon counts with discrete resist chemistry.',
    'Both are explicit that they are simulations rather than measurements.',
  ],
  qualifications: [
    'Hinsberg and Houle caution that the resolution-line edge roughness-sensitivity tradeoff was identified for DUV resists and that it is not obvious the tradeoff operates the same way in EUV. The v0.1 dossier recorded that tradeoff from Gallatin et al. without this caution. The v0.1 claim is retained and now carries the qualification alongside it.',
  ],
  comparabilityLimits: [
    'No shared output quantity exists between the two papers.',
    'No exposure dose is stated in the inspected sections of the second source.',
    'One models an acid amplifier; the other does not model one at all.',
    'Neither paper cross-validates against the other, and neither cites a common empirical dataset in the sections inspected.',
    'Only parts of each document were read: sections 1 to 3 and Figure 1 of the first, and the abstract, sections 1 and 2 with Tables 1 and 2 and Figure 1 of the second.',
  ],
  replicationAssessment:
    'Not replication, and it cannot become replication by adding further sources of this kind. Both inspected sources are simulations. Replication in this schema requires at least two independent empirical sources reproducing materially equivalent results under comparable conditions, and neither paper reports an empirical measurement. The dossier therefore carries no replicated-empirical claim, and the validator would refuse one.',
}

const COMPARISONS = [
  { ...COMPARISON_SEED, provenanceDigest: provenanceDigest(COMPARISON_SEED) },
]

const PRIOR_REVISIONS = [
  {
    version: 'maha-evidence-dossier/0.1',
    dossierDigest: 'sha256:4479a411c4ff854bcb1fb5507f81d47b4fd2065d3c27e0ff41c6b43f657e13b9',
    supersededAt: '2026-08-25',
    summary:
      'One inspected modelling source and one metadata-only source; eight claims; no source comparison. Superseded by v0.2, which adds a second directly inspected source and a comparison. The v0.1 digest is recorded here so the earlier revision remains checkable; no v0.1 claim was deleted.',
  },
]

const BASE = {
  schemaVersion: DOSSIER_SCHEMA_VERSION,
  epistemicBaseVersion: DOSSIER_EPISTEMIC_BASE,
  dossierId: 'dos_euv_resist_stochastics_v0_1',
  title: 'Stochastic acid generation in EUV photoresist',
  inquiry:
    'What does the inspected modelling literature state about the stochastic mechanisms that govern acid generation in EUV photoresist, and under exactly which stated conditions?',
  domainId: 'semiconductor-lithography',
  intendedUse:
    'A demonstration of dossier structure. It shows what was checked, what was not, and where each statement comes from. It is a reading aid for a technical reviewer, not a basis for a purchasing, process or legal decision.',
  prohibitedUses: [
    'Do not use as evidence of regulatory compliance or approval.',
    'Do not use to support a patent position.',
    'Do not use to predict manufacturing yield, tool lifetime, or process window.',
    'Do not use as a substitute for reading the cited sources.',
    'Do not present any statement here as independently reviewed by an outside expert.',
  ],
  methodology:
    'Two primary sources were downloaded and read directly; each passage cites the section, equation or caption it was taken from. A second source was checked only at the identifier and metadata level because the publisher blocked automated retrieval, and it is marked as such. Submitted statements are preserved beside the audited statement the evidence actually supports. No locator was written that was not read.',
  generatedAt: '2026-08-25T00:00:00Z',
  corpusRevision: 'evidence-dossier-demo/0.2',
  reviewState: 'illustrative-draft' as const,
  sources: SOURCES,
  passages: PASSAGES,
  claims: CLAIMS,
  comparisons: COMPARISONS,
  priorRevisions: PRIOR_REVISIONS,
  contradictions: [
    'Two submitted statements were contradicted by the inspected source: that the simulation is three-dimensional, and that the model fully characterises the parameter space. Both submitted statements are retained beside their corrections.',
  ],
  unsupportedInferences: [
    'Both inspected sources are simulation studies. No statement here is an empirical measurement, and nothing is replicated. Adding further modelling sources cannot establish replication.',
    'Exposure dose in mJ/cm^2 is not scanner source power, intermediate-focus power, wafer-plane power, absorbed power, or plasma power. This dossier relates them to one another nowhere.',
    'Results obtained under one environment do not transfer to argon, vacuum, hydrogen gas or hydrogen-radical environments.',
    'Nothing here supports a manufacturing-yield, tool-lifetime, or process-window extrapolation.',
  ],
  limitations: [
    'Two documents were read, both simulations. Two models are not a literature review, and two models agreeing on an assumption is not evidence that the assumption is correct.',
    'The second source is metadata-verified only; its contents are unverified here.',
    'Quoted figures are as the authors state them and were not checked against independent measurement.',
    'This dossier is an illustrative draft. It has not been internally audited through the existing evidence gate, and no external reviewer has seen it.',
  ],
  disclaimer:
    'This is an illustrative draft produced by Maha Strategies for demonstration. It records where each statement was found and how far checking went. It attests to passage location and claim boundary only. It is not an approval, an attestation, an expert opinion, or a statement that any claim is true.',
}

const BUNDLE_BASE = {
  corpusRevision: BASE.corpusRevision,
  digestAlgorithm: 'sha256' as const,
  canonicalizationVersion: CANONICALIZATION_VERSION,
  sourceCount: SOURCES.length,
  passageCount: PASSAGES.length,
  claimCount: CLAIMS.length,
  comparisonCount: COMPARISONS.length,
}

export const DEMONSTRATION_DOSSIER: EvidenceDossier = {
  ...BASE,
  provenanceBundle: {
    ...BUNDLE_BASE,
    dossierDigest: provenanceDigest({ ...BASE, provenanceBundle: BUNDLE_BASE }),
  },
}
