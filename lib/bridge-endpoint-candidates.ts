import { createHash } from 'node:crypto'

/**
 * Foundational endpoint candidates created by the source-closure sprint.
 *
 * These are candidates, not records. They are deliberately NOT added to
 * EPISTEMIC_RECORDS, so they cannot reach the resolver's canonical pool, a
 * public route, sitemap.xml or llms.txt. Promotion into the canonical graph is
 * a separate decision that this sprint does not make.
 *
 * Each one is justified on its own terms: it would be worth holding even if
 * every Q-BR bridge stayed blocked forever. None was created merely to satisfy
 * a submitted reference.
 *
 * Every candidate carries `locator: null` on its sources. No full text was
 * obtained during this sprint, so no passage-level locator could be verified
 * and none was invented. That is a real gap and it keeps these candidates
 * blocked, which is the correct outcome rather than a defect to route around.
 */

export const ENDPOINT_CANDIDATE_VERSION = 'maha-endpoint-candidate/1.0' as const

export interface CandidateSourceRef {
  citation: string
  identifier: string
  locator: string | null
  verification: 'verified-correct' | 'verified-with-correction'
  verificationSource: string
  verifiedAt: string
  rightsBasis: string
}

export interface EndpointCandidate {
  id: string
  domainSlug: string
  slug: string
  recordClass: 'mechanism' | 'concept' | 'supply-node'
  title: string
  /** Bounded definition: what this record covers and where it stops. */
  definition: string
  scope: string
  uncertainty: string
  prohibitedInferences: readonly string[]
  sources: readonly CandidateSourceRef[]
  rightsBasis: string
  /** Which unresolved endpoint prompted creation, and why it stands alone. */
  originEndpointKey: string
  independentJustification: string
  reviewState: 'draft'
  reviewerKind: 'internal-editorial'
  requestedPublicPromotion: false
  canonical: false
  noindex: true
  provenanceDigest: string
}

const METADATA_ONLY = 'bibliographic-metadata-only'

type Seed = Omit<EndpointCandidate, 'provenanceDigest' | 'reviewState' | 'reviewerKind' | 'requestedPublicPromotion' | 'canonical' | 'noindex' | 'id'>

function build(seed: Seed): EndpointCandidate {
  const candidate: EndpointCandidate = {
    ...seed,
    id: `urn:maha:candidate:${seed.domainSlug}-${seed.slug}`,
    reviewState: 'draft',
    reviewerKind: 'internal-editorial',
    requestedPublicPromotion: false,
    canonical: false,
    noindex: true,
    provenanceDigest: '',
  }
  const digestable = { ...candidate, provenanceDigest: undefined }
  candidate.provenanceDigest = `sha256:${createHash('sha256').update(JSON.stringify(digestable)).digest('hex')}`
  return candidate
}

export const ENDPOINT_CANDIDATES: readonly EndpointCandidate[] = [
  build({
    domainSlug: 'quantum-systems',
    slug: 'transmon-coherence-limits',
    recordClass: 'mechanism',
    title: 'Transmon coherence limits',
    definition:
      'The physical loss channels that bound energy relaxation and dephasing in a fixed-frequency transmon qubit: two-level-system defects at metal-substrate and metal-air interfaces, quasiparticle poisoning, flux and charge noise, and radiative or package loss.',
    scope:
      'Covers the identified loss channels and their materials dependence. Does not cover gate design, control electronics, or multi-qubit cross-talk.',
    uncertainty:
      'The relative weight of each loss channel is device- and process-specific. Reported improvements usually change several variables at once, so attribution to a single channel is rarely clean.',
    prohibitedInferences: [
      'Do not infer a two-qubit gate fidelity from a single-qubit T1.',
      'Do not infer that one materials change is the sole cause of a reported coherence improvement.',
      'Do not treat a best-device number as a process yield.',
    ],
    sources: [
      {
        citation:
          'Place, A. P. M. et al. (2021). New material platform for superconducting transmon qubits with coherence times exceeding 0.3 milliseconds. Nature Communications, 12, 1779.',
        identifier: 'doi:10.1038/s41467-021-22030-5',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'Crossref REST API work record',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
    ],
    rightsBasis: METADATA_ONLY,
    originEndpointKey: 'Q-BR-002A',
    independentJustification:
      'Transmon coherence claims are among the most frequently quoted hardware numbers in the field. A record that names the loss channels separately is the prerequisite for reading any of those claims, bridge or no bridge.',
  }),
  build({
    domainSlug: 'quantum-systems',
    slug: 'phase-estimation-resource-scaling',
    recordClass: 'mechanism',
    title: 'Quantum phase estimation and its resource dependencies',
    definition:
      'Quantum phase estimation extracts an eigenphase of a unitary to a chosen precision. Its cost depends jointly on target precision, the Hamiltonian simulation method, the overlap between the prepared state and the target eigenstate, and fault-tolerant overhead.',
    scope:
      'Covers the algorithm and the four cost dependencies. Does not cover any specific chemical system, and asserts no comparison against classical methods.',
    uncertainty:
      'State-preparation overlap is the least constrained term and is usually unknown for strongly correlated systems. Resource estimates in the literature vary by orders of magnitude with assumptions.',
    prohibitedInferences: [
      'Do not infer a practical speedup over DMRG, coupled cluster, or quantum Monte Carlo.',
      'Do not quote a fault-tolerant resource estimate as a description of current hardware.',
      'Do not treat polynomial gate-count scaling as polynomial wall-clock cost.',
    ],
    sources: [
      {
        citation:
          'Reiher, M. et al. (2017). Elucidating reaction mechanisms on quantum computers. PNAS, 114(29), 7555-7560.',
        identifier: 'doi:10.1073/pnas.1619152114',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'Crossref REST API work record',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
    ],
    rightsBasis: METADATA_ONLY,
    originEndpointKey: 'Q-BR-004A',
    independentJustification:
      'Most quantum-advantage claims in chemistry rest on phase estimation. A bounded record naming the four cost dependencies is the single most useful guard against the generic "polynomial scaling" claim, independent of any bridge.',
  }),
  build({
    domainSlug: 'quantum-systems',
    slug: 'dilution-refrigeration',
    recordClass: 'mechanism',
    title: 'Dilution refrigeration below 100 mK',
    definition:
      'Continuous cooling below roughly 100 mK by endothermic transport of He-3 across the phase boundary into a dilute He-3/He-4 mixture, providing cooling power that does not vanish at the lowest temperatures the way single-shot methods do.',
    scope:
      'Covers the dilution cycle and its He-3 dependence. Does not claim that dilution refrigeration is the only route below 20 mK: adiabatic and nuclear demagnetisation reach comparable temperatures without a circulating He-3 charge.',
    uncertainty:
      'Achievable base temperature and cooling power depend on circulation rate, heat-exchanger design and wiring heat load, which vary widely between installations.',
    prohibitedInferences: [
      'Do not infer that every sub-20 mK platform requires He-3.',
      'Do not infer thermal headroom for a given qubit count from a quoted base temperature.',
    ],
    sources: [
      {
        citation: 'Pobell, F. Matter and Methods at Low Temperatures. Springer.',
        identifier: 'isbn:9783662032251',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'Open Library catalogue record',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
    ],
    rightsBasis: METADATA_ONLY,
    originEndpointKey: 'Q-BR-005A',
    independentJustification:
      'Dilution refrigeration is the operating precondition for most superconducting and spin-qubit hardware. The corpus records the control stack but not the cooling mechanism, which is a gap regardless of any supply-chain argument.',
  }),
  build({
    domainSlug: 'critical-supply-chains',
    slug: 'helium-3-isotope-supply',
    recordClass: 'supply-node',
    title: 'Helium-3 isotope supply',
    definition:
      'The provenance and allocation of He-3, which is not mined but arises predominantly as a tritium decay product from weapons-stockpile stewardship, and is allocated administratively rather than by an open commodity market.',
    scope:
      'Covers provenance, allocation mechanism and demand competition between cryogenics, neutron detection and medical imaging. Does not cover helium-4 liquefaction or bulk helium logistics, which the corpus records separately.',
    uncertainty:
      'Public reserve and allocation figures are reported at coarse granularity and lag actual inventory. Demand forecasts across competing uses are contested.',
    prohibitedInferences: [
      'Do not infer a spot price from an allocation figure; there is no open market.',
      'Do not infer that supply expansion resolves cryogenic thermal-load limits.',
      'Do not treat helium-4 supply commentary as applying to He-3.',
    ],
    sources: [
      {
        citation:
          'U.S. Government Accountability Office (2011). Managing Critical Isotopes: Weaknesses in DOE’s Management of Helium-3 Delayed the Federal Response to a Critical Supply Shortage. GAO-11-472.',
        identifier: 'GAO-11-472',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'gao.gov published report record',
        verifiedAt: '2026-08-25',
        rightsBasis: 'us-government-work',
      },
    ],
    rightsBasis: 'us-government-work',
    originEndpointKey: 'Q-BR-005B',
    independentJustification:
      'He-3 is a genuine single-source critical input with an administrative allocation regime, which is exactly what this domain exists to record. It is unrelated to the existing helium-liquefaction-logistics record.',
  }),
  build({
    domainSlug: 'quantum-systems',
    slug: 'superconducting-gap-and-depairing',
    recordClass: 'concept',
    title: 'Superconducting gap, critical field and depairing current',
    definition:
      'The energy gap of a superconductor and the derived limits on it: the upper critical field above which superconductivity is destroyed, and the depairing current density above which the condensate breaks.',
    scope:
      'Covers the phenomenological relationships. Does not cover fabrication, mechanical properties, or the suitability of any material for a given application.',
    uncertainty:
      'Phenomenological parameters are geometry- and disorder-dependent. Thin-film values routinely differ from bulk values for the same element.',
    prohibitedInferences: [
      'Do not infer material interchangeability from a shared governing equation.',
      'Do not infer mechanical strength or engineering current density from a critical field.',
      'Do not apply elemental-superconductor intuitions to layered high-temperature superconductors.',
    ],
    sources: [
      {
        citation: 'Tinkham, M. Introduction to Superconductivity. McGraw-Hill.',
        identifier: 'isbn:0071147829',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'Open Library catalogue record',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
    ],
    rightsBasis: METADATA_ONLY,
    originEndpointKey: 'Q-BR-006A',
    independentJustification:
      'These quantities are cited across both quantum hardware and fusion magnet work. Recording them once, with the explicit warning that shared equations do not imply interchangeable materials, prevents a recurring category error.',
  }),
  build({
    domainSlug: 'quantum-systems',
    slug: 'majorana-zero-modes',
    recordClass: 'concept',
    title: 'Majorana zero modes: proposal and experimental signature',
    definition:
      'Zero-energy boundary modes predicted in proximitised spin-orbit-coupled systems, together with the distinction between the theoretical proposal and the experimental signatures offered as evidence for it.',
    scope:
      'Covers the proposal and the interpretive status of zero-bias conductance peaks. Does not assert that any realisation has been demonstrated.',
    uncertainty:
      'Trivial disorder-induced Andreev bound states reproduce the principal reported signature. Several prominent claims in this area have been retracted or substantially qualified.',
    prohibitedInferences: [
      'Do not infer Majorana realisation from observed superconductivity.',
      'Do not infer non-Abelian braiding from a zero-bias conductance peak.',
      'Do not infer a topological-qubit error-rate benefit from a proposal.',
    ],
    sources: [
      {
        citation:
          'Lutchyn, R. M., Sau, J. D., & Das Sarma, S. (2010). Majorana Fermions and a Topological Phase Transition in Semiconductor-Superconductor Heterostructures. Physical Review Letters, 105(7), 077001.',
        identifier: 'doi:10.1103/PhysRevLett.105.077001',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'Crossref REST API work record',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
    ],
    rightsBasis: METADATA_ONLY,
    originEndpointKey: 'Q-BR-007A',
    independentJustification:
      'This is one of the most contested experimental areas in quantum hardware, with a documented history of overstated claims. A record that separates proposal from signature is valuable precisely because the distinction is routinely lost.',
  }),
  build({
    domainSlug: 'quantum-systems',
    slug: 'spin-qubit-hyperfine-dephasing',
    recordClass: 'mechanism',
    title: 'Hyperfine dephasing in silicon spin qubits',
    definition:
      'Dephasing of an electron spin by the fluctuating Overhauser field of nearby nuclear spins, dominated in natural silicon by the spin-1/2 Si-29 isotope, and suppressed by isotopic enrichment in spin-zero Si-28.',
    scope:
      'Covers the nuclear-spin dephasing channel and its isotopic remedy. Does not cover charge noise, which is a separate and independent dephasing channel that enrichment does not address.',
    uncertainty:
      'Reported coherence gains from enrichment come from different devices and processes rather than paired measurements, so cross-study ratios are inferences, not measured comparisons.',
    prohibitedInferences: [
      'Do not infer that isotopic purity addresses 1/f charge noise at the dielectric interface.',
      'Do not present a cross-study coherence ratio as a controlled comparison.',
      'Do not infer a specific enrichment threshold from a single-device report.',
    ],
    sources: [
      {
        citation:
          'Veldhorst, M. et al. (2014). An addressable quantum dot qubit with fault-tolerant control-fidelity. Nature Nanotechnology, 9(12), 981-985.',
        identifier: 'doi:10.1038/nnano.2014.216',
        locator: null,
        verification: 'verified-with-correction',
        verificationSource: 'Crossref REST API work record; publisher landing page',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
      {
        citation:
          'Itoh, K. M., & Watanabe, H. (2014). Isotope engineering of silicon and diamond for quantum computing and sensing applications. MRS Communications, 4(4), 143-157.',
        identifier: 'doi:10.1557/mrc.2014.32',
        locator: null,
        verification: 'verified-correct',
        verificationSource: 'Crossref REST API work record',
        verifiedAt: '2026-08-25',
        rightsBasis: METADATA_ONLY,
      },
    ],
    rightsBasis: METADATA_ONLY,
    originEndpointKey: 'Q-BR-009A',
    independentJustification:
      'Isotopic enrichment is routinely quoted as though it solves spin-qubit decoherence generally. Recording it as one channel among several, with charge noise explicitly excluded, corrects a common overstatement.',
  }),
]

if (ENDPOINT_CANDIDATES.length > 8) {
  throw new Error(`This sprint creates at most eight endpoint candidates; found ${ENDPOINT_CANDIDATES.length}.`)
}

/** A candidate is enqueueable only when every source carries an exact locator. */
export function candidateBlockers(candidate: EndpointCandidate): readonly string[] {
  const blockers: string[] = []
  if (candidate.sources.some((source) => !source.locator)) blockers.push('source-missing-locator')
  if (candidate.sources.length < 2) blockers.push('single-source-record')
  return blockers
}

export function promotableEndpointCandidates(): readonly EndpointCandidate[] {
  return ENDPOINT_CANDIDATES.filter((candidate) => candidateBlockers(candidate).length === 0)
}
