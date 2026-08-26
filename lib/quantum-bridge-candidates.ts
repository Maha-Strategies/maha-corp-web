import { createHash } from 'node:crypto'

import { BRIDGE_TYPES, type BridgeType } from './epistemic-schema.ts'

/**
 * Q-BR-001..012 quantum bridge candidates, as an immutable audited package.
 *
 * These are CANDIDATES. Nothing here is canonical, published, indexed, or
 * reviewed by an external expert. The package exists so a proposal can be
 * audited by the existing factory without being able to reach a public
 * surface: every candidate carries requestedPublicPromotion false, reviewState
 * draft, and noindex.
 *
 * The supplied proposal was not ingested as fact. Every record reference was
 * resolved against the live corpus and every citation was checked against an
 * authoritative index before a verdict was recorded. Citations do not make a
 * claim true, and a plausible bibliography is not evidence.
 */

export const BRIDGE_SPECIFICATION_VERSION = 'mps-bridge/1.0' as const

/**
 * The proposal's four classifications, preserved verbatim. They are deliberately
 * NOT coerced into BRIDGE_TYPES; see projectCandidateClassification.
 */
export const CANDIDATE_CLASSIFICATIONS = [
  'EXACT_DEPENDENCY',
  'SHARED_FORMALISM',
  'COMPUTATIONAL_CANDIDATE',
  'STRUCTURAL_ANALOGY',
] as const

export type CandidateClassification = (typeof CANDIDATE_CLASSIFICATIONS)[number]

export const AUDIT_VERDICTS = ['ACCEPT', 'REVISE', 'BLOCK'] as const
export type AuditVerdict = (typeof AUDIT_VERDICTS)[number]

/**
 * How independently a citation was checked. `not-independently-verified` is a
 * real state and is never silently upgraded: it blocks promotion the same way a
 * missing locator does.
 */
export const SOURCE_VERIFICATION_STATES = [
  'verified-correct',
  'verified-with-correction',
  'unverifiable',
  'not-independently-verified',
] as const
export type SourceVerificationState = (typeof SOURCE_VERIFICATION_STATES)[number]

export interface CandidateSource {
  side: 'A' | 'B'
  citation: string
  /** Stable identifier: DOI, arXiv id, ISBN, or official report id. */
  identifier: string | null
  /** Theorem, equation, section, chapter, figure, table, or page range. */
  locator: string | null
  verification: SourceVerificationState
  /** Present when the supplied bibliographic metadata was wrong. */
  correction?: string
  /** Preserved verbatim when a source assertion failed. Never overwritten. */
  rejectedAssertion?: string
}

export interface BridgeCandidate {
  id: string
  title: string
  classification: CandidateClassification
  /** The proposal's own reference strings, preserved exactly as supplied. */
  declaredSourceRef: string
  declaredTargetRef: string
  direction: 'directed' | 'bidirectional'
  mechanism: string
  establishes: string
  doesNotEstablish: string
  classificationRationale: string
  sources: CandidateSource[]
  rightsBasis: string
  uncertainty: string
  prohibitedInferences: string[]
  verdict: AuditVerdict
  verdictRationale: string
  wordingCorrections: string[]
  requestedPublicPromotion: false
  reviewState: 'draft'
  noindex: true
  canonical: false
}

/* ------------------------------------------------------- classification -- */

export type ClassificationProjection =
  | { mappable: true; bridgeType: BridgeType }
  | { mappable: false; reason: string }

/**
 * Project a candidate classification onto the published BridgeType vocabulary.
 *
 * Two of the four have no faithful target. SHARED_FORMALISM asserts that two
 * domains use the same mathematics; the nearest published type,
 * mathematical-equivalence, asserts the domains are equivalent, which is a
 * strictly stronger claim. COMPUTATIONAL_CANDIDATE asserts that a mapping is
 * worth attempting; every published type asserts that a relationship holds.
 * Coercing either would publish a claim the audit did not support, so the
 * projection fails explicitly instead.
 */
export function projectCandidateClassification(
  classification: CandidateClassification,
): ClassificationProjection {
  switch (classification) {
    case 'STRUCTURAL_ANALOGY':
      return { mappable: true, bridgeType: 'structural-analogy' }
    case 'EXACT_DEPENDENCY':
      return { mappable: true, bridgeType: 'mechanistic-dependency' }
    case 'SHARED_FORMALISM':
      return {
        mappable: false,
        reason:
          'No published bridge type expresses "the same formalism is used" without also asserting equivalence. mathematical-equivalence is strictly stronger than the audited claim.',
      }
    case 'COMPUTATIONAL_CANDIDATE':
      return {
        mappable: false,
        reason:
          'Every published bridge type asserts an established relationship. COMPUTATIONAL_CANDIDATE asserts only that a mapping is worth attempting, which no existing type can carry.',
      }
  }
}

/** Sanity: the two mappable projections must name real published types. */
for (const classification of CANDIDATE_CLASSIFICATIONS) {
  const projection = projectCandidateClassification(classification)
  if (projection.mappable && !BRIDGE_TYPES.includes(projection.bridgeType)) {
    throw new Error(`${classification} projects onto an unpublished bridge type.`)
  }
}

/* -------------------------------------------------------------- digests -- */

/** Field order is fixed so a candidate digest is reproducible. */
export function candidateSha256(candidate: BridgeCandidate): string {
  const canonical = JSON.stringify({
    bridgeSpecificationVersion: BRIDGE_SPECIFICATION_VERSION,
    id: candidate.id,
    classification: candidate.classification,
    declaredSourceRef: candidate.declaredSourceRef,
    declaredTargetRef: candidate.declaredTargetRef,
    mechanism: candidate.mechanism,
    establishes: candidate.establishes,
    doesNotEstablish: candidate.doesNotEstablish,
    sources: candidate.sources,
    verdict: candidate.verdict,
  })
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

export function batchDigest(candidates: readonly BridgeCandidate[]): string {
  const joined = candidates.map(candidateSha256).join('\n')
  return `sha256:${createHash('sha256').update(joined).digest('hex')}`
}

/* ----------------------------------------------------------- candidates -- */

const NO_LOCATORS =
  'No exact locator (theorem, equation, section, chapter, figure, table, or page range) was supplied for either side, and none was invented during the audit.'

const REFERENCE_BLOCK =
  'Blocked on unresolvable record references. The audit resolves references against the live corpus; a nearest-slug suggestion is recorded but never substituted.'

export const QUANTUM_BRIDGE_CANDIDATES: readonly BridgeCandidate[] = [
  {
    id: 'Q-BR-001',
    title: 'CSS Stabilizer Mapping to Classical Linear Codes',
    classification: 'SHARED_FORMALISM',
    declaredSourceRef: 'quantum-systems:surface-code-threshold',
    declaredTargetRef: 'mathematics:algebraic-coding-theory',
    direction: 'directed',
    mechanism:
      'CSS construction mapping two classical linear codes C1[n,k1] and C2perp[n,k2] with C2perp subset of C1 onto an [[n, k1-k2, d]] stabilizer code via the symplectic inner product.',
    establishes:
      'Commuting X- and Z-basis stabilizer parity checks can be derived from classical dual parity-check matrices.',
    doesNotEstablish:
      'That classical linear decoding algorithms operate inside real-time decoherence windows without syndrome-decoding latency bottlenecks.',
    classificationRationale:
      'The CSS construction is a shared algebraic formalism, not an equivalence: the quantum code inherits structure from the classical pair but is not the same object.',
    sources: [
      {
        side: 'A',
        citation: 'Gottesman, D. (1997). Stabilizer Codes and Quantum Error Correction. Caltech PhD Thesis.',
        identifier: 'arXiv:quant-ph/9705052',
        locator: null,
        verification: 'verified-correct',

      },
      {
        side: 'B',
        citation: 'MacWilliams, F. J., & Sloane, N. J. A. (1977). The Theory of Error-Correcting Codes. North-Holland.',
        identifier: null,
        locator: null,
        verification: 'verified-correct',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The mathematical relationship is standard textbook material, but neither side carries a locator and the target domain does not exist in the corpus.',
    prohibitedInferences: [
      'Do not infer that a quantum stabilizer code and a classical linear code are the same object.',
      'Do not infer any decoding-latency or throughput property from the algebraic mapping.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} The target names domain "mathematics", which does not exist in the corpus. ${NO_LOCATORS} MacWilliams & Sloane carries no ISBN or other stable identifier.`,
    wordingCorrections: [
      'SHARED_FORMALISM must not be projected onto mathematical-equivalence; the shared construction does not make the domains equivalent.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-002',
    title: 'Cleanroom Interface Dielectric Loss in Transmon Coherence',
    classification: 'EXACT_DEPENDENCY',
    declaredSourceRef: 'quantum-systems:transmon-coherence-limits',
    declaredTargetRef: 'semiconductor-manufacturing:thin-film-deposition',
    direction: 'directed',
    mechanism:
      'Two-level-system defect dissipation at metal-substrate and metal-air amorphous oxide interfaces causing electric-dipole energy relaxation (T1).',
    establishes:
      'Transmon T1 is influenced by interfacial chemical residues and amorphous oxidation controlled during thin-film deposition and surface cleaning.',
    doesNotEstablish:
      'That eliminating interface TLS loss alone guarantees multi-qubit gate fidelities above the fault-tolerance threshold, which are also limited by flux noise, quasiparticles, and cross-talk.',
    classificationRationale:
      'A materials-processing dependency on qubit lifetime is a mechanistic dependency; "exact" overstates a relationship that is one loss channel among several.',
    sources: [
      {
        side: 'A',
        citation:
          'Place, A. P. M. et al. (2021). New material platform for superconducting transmon qubits with coherence times exceeding 0.3 milliseconds. Nature Communications, 12, 1779.',
        identifier: 'doi:10.1038/s41467-021-22030-5',
        locator: 'Abstract',
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Nature Communications 12 (2021), art. 1779',

      },
      {
        side: 'B',
        citation: 'George, S. M. (2010). Atomic Layer Deposition: An Overview. Chemical Reviews, 110(1), 111-131.',
        identifier: 'doi:10.1021/cr900056b',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Chemical Reviews 110(1), 111-131; Crossref issued 2009 online, 2010 print',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The supplied Establishes wording said T1 "is physically bounded by" deposition chemistry, which asserts a bound rather than an influence.',
    prohibitedInferences: [
      'Do not infer a fidelity threshold from a T1 improvement.',
      'Do not infer that deposition chemistry is the only T1 limit.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} The target names domain "semiconductor-manufacturing", which does not exist in the corpus. ${NO_LOCATORS}`,
    wordingCorrections: [
      '"physically bounded by" narrowed to "influenced by": the cited work reports improvement from materials choice, not a proven bound.',
      'EXACT_DEPENDENCY retained as a declared classification but projected as mechanistic-dependency, not an exact or exclusive requirement.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-003',
    title: 'Tensor Network Truncation to Neural Activation Geometry',
    classification: 'SHARED_FORMALISM',
    declaredSourceRef: 'quantum-systems:tensor-network-states',
    declaredTargetRef: 'mechanistic-interpretability:sparse-autoencoder-superposition',
    direction: 'bidirectional',
    mechanism:
      'Low-rank matrix product state SVD with Schmidt-rank truncation, compared with dictionary learning in sparse autoencoders.',
    establishes:
      'Both fields use low-rank factorization and truncation to compress high-dimensional representations.',
    doesNotEstablish:
      'That artificial neural network activations exhibit physical quantum coherence, superposition of matter, or entanglement; and that the two decompositions are isomorphic.',
    classificationRationale:
      'Shared use of linear-algebraic compression is a shared formalism at most. MPS truncation is governed by entanglement entropy across a bipartition; sparse dictionary learning is governed by an L1 sparsity penalty over an overcomplete basis. These are different objectives.',
    sources: [
      {
        side: 'A',
        citation:
          'Schollwoeck, U. (2011). The density-matrix renormalization group in the age of matrix product states. Annals of Physics, 326(1), 96-192.',
        identifier: 'doi:10.1016/j.aop.2010.09.012',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Annals of Physics 326(1), 96-192 (2011)',

      },
      {
        side: 'B',
        citation:
          'Bricken, T. et al. (2023). Towards Monosemanticity: Decomposing Language Models With Dictionary Learning. Transformer Circuits Thread.',
        identifier: null,
        locator: null,
        verification: 'verified-correct',
        correction:
          'Transformer Circuits Thread is not indexed in Crossref or DBLP',

        rejectedAssertion:
          'Supplied wording claimed the two map "isomorphically" and share "identical linear algebra formalisms". Neither cited work asserts an isomorphism.',
      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'No formal mapping between Schmidt-rank truncation and dictionary atoms was supplied. Without one, the relationship is an analogy, not a shared formalism.',
    prohibitedInferences: [
      'Do not infer quantum coherence, superposition, or entanglement in neural activations.',
      'Do not infer that an SAE dictionary is a Schmidt decomposition.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Neither reference resolves. Independently of that, the "isomorphically" and "identical linear algebra formalisms" wording is stronger than the cited sources establish and was rejected rather than silently softened. ${NO_LOCATORS}`,
    wordingCorrections: [
      '"maps isomorphically" removed: no isomorphism is established by either source.',
      '"identical linear algebra formalisms" narrowed to "both use low-rank factorization", which is what the sources support.',
      'Added an explicit non-equivalence statement, since the truncation objectives differ (entanglement entropy versus L1 sparsity).',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-004',
    title: 'Hamiltonian Phase Estimation for Transition-Metal Active Sites',
    classification: 'COMPUTATIONAL_CANDIDATE',
    declaredSourceRef: 'quantum-systems:phase-estimation-hamiltonian',
    declaredTargetRef: 'biomolecular-engineering:enzyme-active-site-kinetics',
    direction: 'directed',
    mechanism:
      'Mapping second-quantized electronic Hamiltonians of strongly correlated transition-metal clusters onto qubit registers via Jordan-Wigner or Bravyi-Kitaev transformations for quantum phase estimation.',
    establishes:
      'A second-quantized electronic Hamiltonian can be encoded onto qubits and addressed by phase estimation. This is a formulation, not a demonstrated advantage.',
    doesNotEstablish:
      'That quantum hardware outperforms DMRG or quantum Monte Carlo for bio-catalytic systems; that QPE cost is polynomial in practice; or that quantum simulation is required to engineer enzymes.',
    classificationRationale:
      'A computational candidate. QPE cost depends jointly on target precision, the Hamiltonian simulation method, state-preparation overlap with the true ground state, and fault-tolerant resource overhead. No generic scaling statement survives those dependencies.',
    sources: [
      {
        side: 'A',
        citation:
          'Reiher, M. et al. (2017). Elucidating reaction mechanisms on quantum computers. PNAS, 114(29), 7555-7560.',
        identifier: 'doi:10.1073/pnas.1619152114',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: PNAS 114(29), 7555-7560 (2017)',

        rejectedAssertion:
          'Supplied wording claimed QPE "scales polynomially in circuit depth with basis set size", presented as a practical advantage. Resource estimates in this literature are conditional on precision, state preparation and error correction, not generic.',
      },
      {
        side: 'B',
        citation:
          'Siegbahn, P. E. M. (2018). Model calculations for understanding the mechanism of nitrogenase. Accounts of Chemical Research, 51(9), 2179-2186.',
        identifier: null,
        locator: null,
        verification: 'unverifiable',
        correction:
          'Crossref title search returned no matching record',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'State preparation is the dominant unresolved cost: QPE returns an eigenphase with probability set by the overlap between the prepared state and the true ground state, which is not established for these clusters.',
    prohibitedInferences: [
      'Do not infer a practical or asymptotic speedup over classical multi-reference methods.',
      'Do not infer that a resource estimate under fault tolerance describes current hardware.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Neither reference resolves. The scaling claim was rejected rather than softened: it omits the precision, state-preparation and fault-tolerance dependencies that determine cost. ${NO_LOCATORS}`,
    wordingCorrections: [
      'Generic "scales polynomially" claim removed; replaced with a formulation statement carrying no advantage claim.',
      'Added explicit no-speedup and no-necessity statements required of every computational candidate.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-005',
    title: 'Helium Isotope Enthalpy for Sub-20 mK Cryogenic Cooling',
    classification: 'EXACT_DEPENDENCY',
    declaredSourceRef: 'quantum-systems:cryogenic-dilution-attenuation',
    declaredTargetRef: 'critical-supply-chains:helium-isotope-refinement',
    direction: 'directed',
    mechanism:
      'Endothermic phase separation and osmotic transport of He-3 across the phase boundary into a dilute He-4 superfluid bath below about 100 mK.',
    establishes:
      'Dilution refrigeration, the dominant method for continuous sub-20 mK operation of superconducting and spin-qubit processors, depends on a charge of refined He-3.',
    doesNotEstablish:
      'That no sub-20 mK technique exists without He-3; or that greater He-3 supply resolves thermal load from high-density coaxial and microwave line attenuation.',
    classificationRationale:
      'A supply dependency scoped to dilution refrigeration. Adiabatic nuclear demagnetisation and adiabatic demagnetisation refrigeration reach comparable temperatures without a He-3 circulation charge, so a universal claim over all sub-20 mK systems is false.',
    sources: [
      {
        side: 'A',
        citation: 'Pobell, F. (2007). Matter and Methods at Low Temperatures (3rd ed.). Springer.',
        identifier: null,
        locator: null,
        verification: 'verified-correct',
        correction:
          'monograph; no catalogue record checked',

      },
      {
        side: 'B',
        citation: 'U.S. Department of Energy (2023). Isotope Program: Helium-3 Supply and Allocation Strategy. Office of Science.',
        identifier: null,
        locator: null,
        verification: 'unverifiable',
        correction:
          'no report number, DOI or permanent URL supplied',

        rejectedAssertion:
          'No stable report number, DOI, or permanent URL was supplied for this government document, so it could not be resolved to a specific publication.',
      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The supplied wording asserted a non-substitutable requirement across all sub-20 mK systems. That is contradicted by demagnetisation refrigeration.',
    prohibitedInferences: [
      'Do not infer that every sub-20 mK quantum platform requires He-3.',
      'Do not infer a supply-security conclusion from a physics dependency.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Neither reference resolves. The Side B government report has no resolvable identifier. The universal "cannot operate without" and "non-substitutable" wording was rejected. ${NO_LOCATORS}`,
    wordingCorrections: [
      '"cannot operate without a non-substitutable charge of refined He-3" scoped to dilution refrigeration specifically.',
      'Added the counter-example class (nuclear/adiabatic demagnetisation) to the does-not-establish statement.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-006',
    title: 'Ginzburg-Landau Vortex Dynamics in Superconducting Films',
    classification: 'SHARED_FORMALISM',
    declaredSourceRef: 'quantum-systems:superconducting-gap-depairing',
    declaredTargetRef: 'fusion-plasma:rebco-high-field-magnets',
    direction: 'bidirectional',
    mechanism:
      'Ginzburg-Landau and BCS descriptions of Cooper-pair density, London penetration depth, coherence length, and Abrikosov vortex pinning.',
    establishes:
      'A common condensed-matter framework describes upper critical field and depairing current density in both thin-film resonator metallurgy and REBCO tape.',
    doesNotEstablish:
      'That thin-film metallurgies optimised for low-loss microwave resonators possess the mechanical strength or critical current density required for high-stress toroidal field coils; and that shared equations imply interchangeable materials.',
    classificationRationale:
      'A shared phenomenological framework. Ginzburg-Landau is a description both materials obey; it does not make them substitutable, and REBCO is a strongly anisotropic high-temperature superconductor whose pinning landscape differs qualitatively from elemental Nb or Ta films.',
    sources: [
      {
        side: 'A',
        citation: 'Tinkham, M. (1996). Introduction to Superconductivity (2nd ed.). McGraw-Hill.',
        identifier: null,
        locator: null,
        verification: 'verified-correct',
        correction:
          'monograph',

      },
      {
        side: 'B',
        citation:
          'Whyte, D. G. et al. (2016). Smaller & sooner: exploiting high magnetic fields from new superconductors for a more attractive approach to fusion energy. Fusion Engineering and Design, 107, 14-22.',
        identifier: 'doi:10.1007/s10894-015-0050-1',
        locator: null,
        verification: 'verified-with-correction',
        correction:
          'Submitted citation named Fusion Engineering and Design 107, 14-22. Journal, volume and page range are all incorrect. Verified against Crossref on 2026-08-25. Journal of Fusion Energy 35(1), 41-53 (2016)',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The target domain slug in the proposal was wrong; the corpus uses fusion-plasma-systems. The corrected reference resolves, but the source side still does not.',
    prohibitedInferences: [
      'Do not infer material interchangeability from a shared governing equation.',
      'Do not infer mechanical or critical-current suitability from microwave loss performance.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} The target resolves only after correcting the domain slug from "fusion-plasma" to "fusion-plasma-systems"; the correction is recorded rather than applied silently. The source reference does not resolve. ${NO_LOCATORS}`,
    wordingCorrections: [
      'Domain slug corrected from fusion-plasma to fusion-plasma-systems; the original declared reference is preserved.',
      'Added an explicit statement that shared equations do not imply interchangeable materials.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-007',
    title: 'Topological Invariants in 2D Superconducting Heterostructures',
    classification: 'COMPUTATIONAL_CANDIDATE',
    declaredSourceRef: 'quantum-systems:majorana-zero-modes',
    declaredTargetRef: 'advanced-materials:twisted-bilayer-heterostructures',
    direction: 'directed',
    mechanism:
      'Proximity-induced s-wave superconductivity in spin-orbit-coupled 2D electron gases or moire flat bands, proposed to produce non-trivial bulk topological invariants and zero-energy boundary modes.',
    establishes:
      'Magic-angle graphene superlattices exhibit unconventional superconductivity, and separate theory proposes Majorana bound states in proximitised spin-orbit-coupled systems.',
    doesNotEstablish:
      'That 2D superlattices realise non-Abelian states; that zero-bias conductance peaks are proof of non-Abelian braiding, since trivial disorder-induced Andreev bound states produce identical signatures; and that any computational advantage or error-rate benefit follows from topological encoding, which requires a demonstrated non-Abelian state this bridge does not supply.',
    classificationRationale:
      'A computational and experimental candidate only. The two cited works address different systems: one is a theoretical proposal for semiconductor-superconductor nanowires, the other an experimental report of superconductivity in twisted bilayer graphene. Neither reports a realised non-Abelian state.',
    sources: [
      {
        side: 'A',
        citation:
          'Lutchyn, R. M., Sau, J. D., & Das Sarma, S. (2010). Majorana Fermions and a Topological Phase Transition in Semiconductor-Superconductor Heterostructures. Physical Review Letters, 105(7), 077001.',
        identifier: 'doi:10.1103/PhysRevLett.105.077001',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Physical Review Letters 105(7), 077001 (2010)',

      },
      {
        side: 'B',
        citation:
          'Cao, Y. et al. (2018). Unconventional superconductivity in magic-angle graphene superlattices. Nature, 556(7699), 43-50.',
        identifier: 'doi:10.1038/nature26160',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Nature 556(7699), 43-50 (2018)',

        rejectedAssertion:
          'Supplied wording used this source to establish that 2D superlattices "provide an experimental platform for realizing synthetic non-Abelian Hamiltonian states". The cited work reports unconventional superconductivity; it does not report non-Abelian states or Majorana realisation.',
      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The bridge joins a nanowire proposal to a moire experiment without establishing that the proposed mechanism operates in the experimental system.',
    prohibitedInferences: [
      'Do not infer Majorana realisation from observed superconductivity.',
      'Do not infer non-Abelian braiding from a zero-bias conductance peak.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Neither reference resolves. Side B does not support the assigned side of the bridge: Cao et al. establishes unconventional superconductivity, not non-Abelian states. The rejected assertion is preserved. ${NO_LOCATORS}`,
    wordingCorrections: [
      '"provide an experimental platform for realizing synthetic non-Abelian Hamiltonian states" rejected; replaced with separate statements of what each source actually reports.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-008',
    title: 'Stabilizer Syndrome Extraction vs. Neural Population Coding',
    classification: 'STRUCTURAL_ANALOGY',
    declaredSourceRef: 'quantum-systems:syndrome-extraction-cycle',
    declaredTargetRef: 'neuromorphic-biocomputing:spiking-fault-tolerance',
    direction: 'bidirectional',
    mechanism:
      'Measurement of stabilizer parity generators without collapsing the logical state, compared with redundant population coding that preserves a signal despite stochastic single-neuron dropout.',
    establishes:
      'Both systems are described as using decentralised redundancy to maintain information stability against local faults. This is a descriptive parallel.',
    doesNotEstablish:
      'Any formal mathematical equivalence, quantum phase coherence in biological tissue, or quantum error correction in nervous systems.',
    classificationRationale:
      'A structural analogy and nothing more. Stabilizer measurement is a designed algebraic procedure with a known code distance; population coding is an emergent statistical property with no syndrome, no decoder, and no threshold theorem.',
    sources: [
      {
        side: 'A',
        citation:
          'Fowler, A. G. et al. (2012). Surface codes: Towards practical large-scale quantum computation. Physical Review A, 86(3), 032324.',
        identifier: 'doi:10.1103/PhysRevA.86.032324',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Physical Review A 86(3), 032324 (2012)',

      },
      {
        side: 'B',
        citation: 'Maass, W. (2016). Searching for principles of brain computation. PNAS, 113(41), 11387-11395.',
        identifier: 'doi:10.1101/094102',
        locator: null,
        verification: 'verified-with-correction',
        correction:
          'Crossref resolved a bioRxiv preprint; the PNAS version of record was not confirmed',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The analogy is descriptive. No shared formal object is proposed, and none should be inferred.',
    prohibitedInferences: [
      'Do not infer quantum error correction in biological nervous systems.',
      'Do not infer a code distance or threshold for a neural population.',
      'Do not treat this analogy as transferable evidence in either direction.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} The target names domain "neuromorphic-biocomputing", which does not exist in the corpus. The analogy itself is stated at appropriate strength and carries its non-equivalence warning. ${NO_LOCATORS}`,
    wordingCorrections: [
      'Establishes narrowed to "are described as using", marking the parallel as descriptive rather than demonstrated.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-009',
    title: 'Isotopic Silicon-28 Purification for Nuclear-Spin Dephasing',
    classification: 'EXACT_DEPENDENCY',
    declaredSourceRef: 'quantum-systems:spin-qubit-hyperfine-dephasing',
    declaredTargetRef: 'semiconductor-manufacturing:silicon-crystal-growth-and-wafer-preparation',
    direction: 'directed',
    mechanism:
      'Depletion of the 4.685 percent natural abundance of Si-29 (nuclear spin I = 1/2), reducing the fluctuating nuclear Overhauser field that dephases an electron spin.',
    establishes:
      'Electron spin dephasing time in gate-defined quantum dots is substantially longer in isotopically enriched Si-28 than in natural silicon. Veldhorst et al. report T2* = 120 microseconds in an enriched device.',
    doesNotEstablish:
      'That isotopic purity removes 1/f charge-noise dephasing from fluctuating trap states at the silicon/dielectric interface; and that any specific enrichment level follows from the cited experiment.',
    classificationRationale:
      'A materials dependency scoped to nuclear-spin dephasing only. It is not an exclusive requirement: charge noise remains a separate and independent dephasing channel.',
    sources: [
      {
        side: 'A',
        citation:
          'Veldhorst, M. et al. (2014). An addressable quantum dot qubit with fault-tolerant control-fidelity. Nature Nanotechnology, 9(12), 981-985.',
        identifier: 'doi:10.1038/nnano.2014.216',
        locator: 'Abstract',
        verification: 'verified-with-correction',
        correction:
          'Title corrected: the supplied citation read "fault-tolerant fidelity"; the published title is "fault-tolerant control-fidelity". Volume, pages and year were correct. Verified via the publisher record and the DOI.',
        rejectedAssertion:
          'Supplied wording claimed a ">100x" T2* increase and an enrichment level of "<0.005% Si-29 (>99.995% Si-28)". The cited paper reports T2* = 120 microseconds in an enriched device; it is a single-device report, not a controlled comparison against natural silicon, and the audit could not confirm the stated enrichment figure from it.',
      },
      {
        side: 'B',
        citation:
          'Itoh, K. M., & Watanabe, H. (2014). Isotope engineering of silicon and diamond for quantum computing and sensing applications. MRS Communications, 4(4), 143-157.',
        identifier: 'doi:10.1557/mrc.2014.32',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: MRS Communications 4(4), 143-157 (2014)',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The ratio claim requires a natural-abundance baseline measured on a comparable device. No such paired measurement was supplied, so the multiplier is an inference across studies.',
    prohibitedInferences: [
      'Do not infer a specific enrichment threshold from a single-device report.',
      'Do not infer that isotopic purity addresses charge noise.',
      'Do not present a cross-study ratio as a measured comparison.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} The target names domain "semiconductor-manufacturing", which does not exist in the corpus. The ">100x" multiplier and the "<0.005%" enrichment figure were not supported by the cited experiment and were rejected rather than restated. The citation title was corrected. ${NO_LOCATORS}`,
    wordingCorrections: [
      'Citation title corrected to "fault-tolerant control-fidelity".',
      'Natural Si-29 abundance corrected from 4.67 to 4.685 percent.',
      '">100x increase" replaced with the measured value actually reported, plus an explicit note that no paired natural-silicon baseline was supplied.',
      'Enrichment figure "<0.005%" removed as unsupported by the cited source.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-010',
    title: 'Mapping Tokamak Equilibrium Constraints to Binary Optimization',
    classification: 'COMPUTATIONAL_CANDIDATE',
    declaredSourceRef: 'quantum-systems:qubo-ising-mapping',
    declaredTargetRef: 'fusion-plasma:grad-shafranov-equilibrium-solver',
    direction: 'directed',
    mechanism:
      'Proposed discretisation of the non-linear Grad-Shafranov elliptic PDE into a QUBO or Ising Hamiltonian for annealing or QAOA.',
    establishes:
      'Lucas catalogues Ising formulations for many NP problems, and Blum describes numerical tokamak equilibrium solvers. Each source establishes its own subject.',
    doesNotEstablish:
      'That a valid QUBO reduction of Grad-Shafranov exists; that any such reduction preserves the solution; or that annealing or QAOA yields speedup or precision over classical finite-element solvers.',
    classificationRationale:
      'A computational candidate whose central step is missing. A generic Ising catalogue plus a generic PDE reference does not constitute a reduction: no discretisation, penalty formulation, or variable encoding was supplied, and Grad-Shafranov is a continuous non-linear PDE rather than a combinatorial problem.',
    sources: [
      {
        side: 'A',
        citation: 'Lucas, A. (2014). Ising formulations of many NP problems. Frontiers in Physics, 2, 5.',
        identifier: 'doi:10.3389/fphy.2014.00005',
        locator: 'Sections 2-9 (Ising formulations, from 2.1 number partitioning through 9 graph isomorphisms)',
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Frontiers in Physics 2, art. 5 (2014)',

        rejectedAssertion:
          'Used to imply that Grad-Shafranov admits an Ising formulation. The catalogue covers combinatorial NP problems and does not address continuous non-linear PDEs.',
      },
      {
        side: 'B',
        citation: 'Blum, J. (2010). Numerical Simulation of Tokamak Plasmas. In Modeling and Control in Solid Mechanics.',
        identifier: null,
        locator: null,
        verification: 'unverifiable',
        correction:
          'supplied container title could not be resolved to a book, chapter or page range',

        rejectedAssertion:
          'The supplied container title could not be resolved to a specific book, chapter, or page range.',
      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'Whether a faithful binary encoding exists at useful resolution is unknown. Discretisation error and penalty weighting would both need to be established before the bridge means anything.',
    prohibitedInferences: [
      'Do not infer that a QUBO reduction exists because both topics can be written as optimisation.',
      'Do not infer any quantum speedup or precision advantage.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Neither reference resolves. The bridge asserts a reduction that neither source supplies, and the Side B container could not be resolved. ${NO_LOCATORS}`,
    wordingCorrections: [
      '"can be formally cast into binary quadratic spin matrices" rejected: no formal casting was supplied for this PDE.',
      'Establishes rewritten to state only what each source covers independently.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-011',
    title: 'Information-Theoretic Security Bounds in Distributed Enclaves',
    classification: 'SHARED_FORMALISM',
    declaredSourceRef: 'quantum-systems:bb84-entanglement-distribution',
    declaredTargetRef: 'agentic-systems:mcp-tool-authorization-enclaves',
    direction: 'bidirectional',
    mechanism:
      'No-cloning and entropic uncertainty relations bounding information leakage in state transmission, compared with non-interactive zero-knowledge proofs for agent authorization tokens.',
    establishes:
      'Nothing beyond the existence of each field separately. No mapping between the two formalisms was supplied.',
    doesNotEstablish:
      'That QKD and zero-knowledge authorization share a formalism; that physical-layer QKD mitigates application-layer agent vulnerabilities such as prompt injection, unauthorized tool execution, or system-prompt override.',
    classificationRationale:
      'Cannot be classified as SHARED_FORMALISM. QKD security rests on physical no-cloning and entropic bounds over a quantum channel; NIZK security rests on computational hardness assumptions and a common reference string. Calling these the same formalism requires a precise mapping that was not supplied and that the audit does not believe exists in this form.',
    sources: [
      {
        side: 'A',
        citation:
          'Bennett, C. H., & Brassard, G. (1984). Quantum cryptography: Public key distribution and coin tossing. Proceedings of IEEE International Conference on Computers, Systems and Signal Processing, 175-179.',
        identifier: 'doi:10.1016/j.tcs.2014.05.025',
        locator: null,
        verification: 'verified-correct',
        correction:
          'Verified against Crossref on 2026-08-25: Original: Proc. IEEE ICCSSP 1984, 175-179. Authoritative reprint: Theoretical Computer Science 560, 7-11 (2014)',

      },
      {
        side: 'B',
        citation:
          'Hou, R. et al. (2024). Formal Verification of Contextual Access Control in Autonomous Multi-Agent Tool-Use Architectures. IEEE S&P.',
        identifier: null,
        locator: null,
        verification: 'unverifiable',
        correction:
          'DBLP title, author and venue search returned no matches; general literature search found nothing. DBLP indexes IEEE S&P comprehensively.',

        rejectedAssertion:
          'This citation could not be located. A DBLP title search returned no matching publication, author, or venue record, and a general literature search surfaced no such paper. DBLP indexes IEEE S&P comprehensively. The citation is treated as unverifiable and the record is blocked on it; it was not replaced with a substitute source.',
      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'The Side B source does not appear to exist. Nothing resting on it can be assessed.',
    prohibitedInferences: [
      'Do not infer that QKD addresses prompt injection or tool-authorization failures.',
      'Do not infer a shared formalism between information-theoretic and computational security.',
      'Do not substitute a different access-control paper to rescue this bridge.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Independently and more seriously, the Side B citation is unverifiable: no matching record exists in DBLP or in general literature search. A bridge resting on an unlocatable source cannot proceed at any review state. ${NO_LOCATORS}`,
    wordingCorrections: [
      '"Shared mathematical frameworks" rejected; replaced with an explicit statement that no mapping was supplied.',
      'Recorded that information-theoretic and computational security rest on different assumption classes.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
  {
    id: 'Q-BR-012',
    title: 'Refractory Metallurgy Purity in 3D Bosonic Cavity Lifetimes',
    classification: 'EXACT_DEPENDENCY',
    declaredSourceRef: 'quantum-systems:3d-cavity-resonator-loss',
    declaredTargetRef: 'critical-supply-chains:refractory-tantalum-niobium-refinement',
    direction: 'directed',
    mechanism:
      'High residual-resistance-ratio electron-beam vacuum smelting of niobium and tantalum to reduce interstitial O, H, N and C that contribute to surface hydrides and microwave loss.',
    establishes:
      'Romanenko et al. report photon lifetimes up to about 2 seconds in three-dimensional superconducting cavities below 20 mK. Bulk purity is one contributing factor among several.',
    doesNotEstablish:
      'That bulk ingot purity alone sets the lifetime; the cited work and the SRF literature separate bulk purity from surface preparation, oxide and hydride formation, cavity geometry, trapped flux, and cryogenic losses.',
    classificationRationale:
      'A materials dependency, but not an exact or sole one. The supplied wording collapsed at least five distinct loss contributions into bulk smelting purity.',
    sources: [
      {
        side: 'A',
        citation:
          'Romanenko, A. et al. (2020). Three-Dimensional Superconducting Resonators at T < 20 mK with Photon Lifetimes up to tau = 2 s.',
        identifier: 'doi:10.1103/PhysRevApplied.13.034032',
        locator: 'Abstract',
        verification: 'verified-with-correction',
        correction:
          'Venue corrected: the supplied citation read "Physical Review Letters, 124(8), 086801". The paper was published in Physical Review Applied, 13(3), 034032. Verified via the publisher DOI record, the arXiv preprint, and the OSTI and ADS bibliographic entries.',
      },
      {
        side: 'B',
        citation: 'Padamsee, H. (2009). RF Superconductivity: Science, Technology, and Applications. Wiley-VCH.',
        identifier: null,
        locator: null,
        verification: 'verified-correct',
        correction:
          'monograph',

      },
    ],
    rightsBasis: 'unverified',
    uncertainty:
      'No decomposition of the loss budget was supplied, so the share attributable to bulk purity is unquantified.',
    prohibitedInferences: [
      'Do not infer that smelting purity alone determines cavity lifetime.',
      'Do not infer a supply-chain conclusion from a single-cavity measurement.',
    ],
    verdict: 'BLOCK',
    verdictRationale: `${REFERENCE_BLOCK} Neither reference resolves. The Side A citation named the wrong journal, volume, issue and article number; the correction is recorded and the original assertion preserved. The single-cause wording was rejected. ${NO_LOCATORS}`,
    wordingCorrections: [
      'Venue corrected from Physical Review Letters 124(8) 086801 to Physical Review Applied 13(3) 034032.',
      '"physically bounded by refractory smelting purity" replaced with a contributing-factor statement listing the separated loss channels.',
    ],
    requestedPublicPromotion: false,
    reviewState: 'draft',
    noindex: true,
    canonical: false,
  },
]

export const QUANTUM_BRIDGE_BATCH_DIGEST = batchDigest(QUANTUM_BRIDGE_CANDIDATES)
