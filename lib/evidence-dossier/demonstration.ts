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
 * carbon-nanotube pellicle example was rejected outright: both of its DOIs are
 * unregistered in the global DOI handle system, so its quoted passages could
 * not have been read from the documents it names. See antigravity-example-audit.
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

const PASSAGES: DossierPassage[] = PASSAGE_SEEDS.map((seed) => ({
  ...seed,
  extractionMethod: 'direct-pdf-read',
  originalDocumentInspected: true,
  passageHash: `sha256:${sha256Hex(canonicalJson({ locator: seed.locator, excerpt: seed.excerpt }))}`,
  sourceRevision: 'NIST pub_id=910777, retrieved 2026-08-25',
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

const CLAIMS: DossierClaim[] = CLAIM_SEEDS.map((seed) => ({
  ...seed,
  provenanceDigest: provenanceDigest(seed),
}))

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
    'One primary source was downloaded and read directly; each passage cites the section, equation or caption it was taken from. A second source was checked only at the identifier and metadata level because the publisher blocked automated retrieval, and it is marked as such. Submitted statements are preserved beside the audited statement the evidence actually supports. No locator was written that was not read.',
  generatedAt: '2026-08-25T00:00:00Z',
  corpusRevision: 'evidence-dossier-demo/0.1',
  reviewState: 'illustrative-draft' as const,
  sources: SOURCES,
  passages: PASSAGES,
  claims: CLAIMS,
  contradictions: [
    'Two submitted statements were contradicted by the inspected source: that the simulation is three-dimensional, and that the model fully characterises the parameter space. Both submitted statements are retained beside their corrections.',
  ],
  unsupportedInferences: [
    'The primary source is a simulation study. No statement here is an empirical measurement, and none is replicated.',
    'Exposure dose in mJ/cm^2 is not scanner source power, intermediate-focus power, wafer-plane power, absorbed power, or plasma power. This dossier relates them to one another nowhere.',
    'Results obtained under one environment do not transfer to argon, vacuum, hydrogen gas or hydrogen-radical environments.',
    'Nothing here supports a manufacturing-yield, tool-lifetime, or process-window extrapolation.',
  ],
  limitations: [
    'Only one document was read in full. A single modelling paper is not a literature review.',
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
}

export const DEMONSTRATION_DOSSIER: EvidenceDossier = {
  ...BASE,
  provenanceBundle: {
    ...BUNDLE_BASE,
    dossierDigest: provenanceDigest({ ...BASE, provenanceBundle: BUNDLE_BASE }),
  },
}
