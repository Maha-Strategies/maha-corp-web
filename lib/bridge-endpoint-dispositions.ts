/**
 * Disposition for each unresolved Q-BR endpoint reference.
 *
 * An alias is only appropriate where the submitted concept and an existing
 * record are semantically equivalent. A similar topic is not an alias, so most
 * near-misses here are REVISE_REFERENCE: the submitter should point at the
 * record that already exists rather than have the resolver quietly redirect.
 *
 * A pilot-only domain (mathematics, semiconductor, neuromorphic-biocomputing)
 * cannot receive a canonical record without first deciding to promote that
 * domain into the canonical graph. That decision is out of scope for this
 * sprint, so those endpoints are deferred rather than created.
 */

export const ENDPOINT_DISPOSITION_VERSION = 'maha-bridge-endpoint-dispositions/1.0' as const

export const DISPOSITIONS = [
  'CREATE_FOUNDATIONAL_CANDIDATE',
  'MAP_TO_EXISTING_RECORD_WITH_EXPLICIT_ALIAS',
  'REVISE_REFERENCE',
  'REJECT_REFERENCE',
  'DEFER_INSUFFICIENT_EVIDENCE',
] as const

export type Disposition = (typeof DISPOSITIONS)[number]

export interface EndpointDisposition {
  key: string
  bridgeId: string
  side: 'A' | 'B'
  submittedReference: string
  disposition: Disposition
  rationale: string
  /** Existing records a REVISE should point at. Advisory, never auto-applied. */
  suggestedExistingRecords?: readonly string[]
  /** Included in this sprint's creation batch. */
  inCreationBatch: boolean
}

export const ENDPOINT_DISPOSITIONS: readonly EndpointDisposition[] = [
  {
    key: 'Q-BR-001A', bridgeId: 'Q-BR-001', side: 'A',
    submittedReference: 'quantum-systems:surface-code-threshold',
    disposition: 'REVISE_REFERENCE',
    rationale:
      'Two existing records already cover this ground from different angles. The submitted name is surface-code specific while fault-tolerance-threshold-condition is the general condition, so they are not equivalent and an alias would overstate the match.',
    suggestedExistingRecords: ['quantum-systems-fault-tolerance-threshold-condition', 'quantum-systems-surface-code-error-correction'],
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-001B', bridgeId: 'Q-BR-001', side: 'B',
    submittedReference: 'mathematics:algebraic-coding-theory',
    disposition: 'DEFER_INSUFFICIENT_EVIDENCE',
    rationale:
      'The mathematics domain exists only in the Phase-4 pilot corpus and is not a canonical graph domain. Creating a canonical record here requires first deciding to promote the domain, which is a structural decision outside this sprint.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-002A', bridgeId: 'Q-BR-002', side: 'A',
    submittedReference: 'quantum-systems:transmon-coherence-limits',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'What physically limits transmon coherence is distinct from coherence-t1-t2-measurements, which covers how T1 and T2 are measured. The loss-channel account is independently valuable to anyone reading transmon hardware claims.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-002B', bridgeId: 'Q-BR-002', side: 'B',
    submittedReference: 'semiconductor-manufacturing:thin-film-deposition',
    disposition: 'DEFER_INSUFFICIENT_EVIDENCE',
    rationale:
      'Resolves by declared alias to the semiconductor domain, which is pilot-only. Same structural blocker as mathematics: the domain must be promoted before a canonical record can exist.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-003A', bridgeId: 'Q-BR-003', side: 'A',
    submittedReference: 'quantum-systems:tensor-network-states',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'Matrix product states and DMRG are foundational to quantum many-body simulation and to classical-simulability claims about quantum hardware. The concept stands on its own even though Q-BR-003 is conceptually invalid, so it is justified independently of that bridge.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-003B', bridgeId: 'Q-BR-003', side: 'B',
    submittedReference: 'mechanistic-interpretability:sparse-autoencoder-superposition',
    disposition: 'REVISE_REFERENCE',
    rationale:
      'The submitted name fuses two concepts that already exist as separate records. Creating a merged record would blur a distinction the corpus deliberately keeps.',
    suggestedExistingRecords: [
      'mechanistic-interpretability-sparse-autoencoder-dictionaries',
      'mechanistic-interpretability-neural-feature-superposition',
    ],
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-004A', bridgeId: 'Q-BR-004', side: 'A',
    submittedReference: 'quantum-systems:phase-estimation-hamiltonian',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'Quantum phase estimation and its resource dependencies are absent from the corpus and are the basis of most quantum-chemistry advantage claims. A bounded record is valuable precisely because those claims are routinely overstated.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-004B', bridgeId: 'Q-BR-004', side: 'B',
    submittedReference: 'biomolecular-engineering:enzyme-active-site-kinetics',
    disposition: 'DEFER_INSUFFICIENT_EVIDENCE',
    rationale:
      'The biomolecular-engineering domain is scoped to design and evolution workflows, not enzymological kinetics. Placing active-site kinetics here would widen the domain definition, and the supporting citation for this side is unverifiable.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-005A', bridgeId: 'Q-BR-005', side: 'A',
    submittedReference: 'quantum-systems:cryogenic-dilution-attenuation',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'Dilution refrigeration is a distinct mechanism from the cryogenic-superconducting-control-stack record, which covers signal chain and wiring. The He-3/He-4 phase-separation account is independently valuable and is the factual anchor for supply-dependency arguments.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-005B', bridgeId: 'Q-BR-005', side: 'B',
    submittedReference: 'critical-supply-chains:helium-isotope-refinement',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'helium-liquefaction-logistics covers bulk helium handling, not isotope separation. He-3 provenance is a genuinely different supply question with different producers and constraints.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-006A', bridgeId: 'Q-BR-006', side: 'A',
    submittedReference: 'quantum-systems:superconducting-gap-depairing',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'The superconducting gap, critical field and depairing current are foundational and currently absent. They underpin both resonator design and magnet engineering, so the record is useful across domains.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-007A', bridgeId: 'Q-BR-007', side: 'A',
    submittedReference: 'quantum-systems:majorana-zero-modes',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'Majorana zero modes carry a long history of contested experimental claims. A bounded record separating theoretical proposal from experimental signature is independently valuable regardless of any bridge.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-007B', bridgeId: 'Q-BR-007', side: 'B',
    submittedReference: 'advanced-materials:twisted-bilayer-heterostructures',
    disposition: 'REVISE_REFERENCE',
    rationale:
      'The corpus already decomposes this into moire-superlattices, twist-angle-control and magic-angle-superconductivity. The submitted umbrella term is less precise than what exists.',
    suggestedExistingRecords: [
      'advanced-materials-moire-superlattices',
      'advanced-materials-twist-angle-control',
      'advanced-materials-magic-angle-superconductivity',
    ],
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-008A', bridgeId: 'Q-BR-008', side: 'A',
    submittedReference: 'quantum-systems:syndrome-extraction-cycle',
    disposition: 'REVISE_REFERENCE',
    rationale:
      'stabilizer-syndrome-measurement covers the same operation. The submitted name emphasises the repeated round, which is close but not identical, and the alias bar is semantic equivalence rather than closeness.',
    suggestedExistingRecords: ['quantum-systems-stabilizer-syndrome-measurement'],
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-008B', bridgeId: 'Q-BR-008', side: 'B',
    submittedReference: 'neuromorphic-biocomputing:spiking-fault-tolerance',
    disposition: 'DEFER_INSUFFICIENT_EVIDENCE',
    rationale:
      'neuromorphic-biocomputing is pilot-only, and its four existing entries do not cover spiking fault tolerance. The supporting citation for this side was also misattributed, so the evidence base is not settled.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-009A', bridgeId: 'Q-BR-009', side: 'A',
    submittedReference: 'quantum-systems:spin-qubit-hyperfine-dephasing',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'silicon-spin-qubits covers the platform; hyperfine dephasing is a specific decoherence mechanism with its own isotopic remedy and its own limits. Separating it prevents the common conflation of isotopic purity with charge-noise immunity.',
    inCreationBatch: true,
  },
  {
    key: 'Q-BR-009B', bridgeId: 'Q-BR-009', side: 'B',
    submittedReference: 'semiconductor-manufacturing:silicon-crystal-growth-and-wafer-preparation',
    disposition: 'DEFER_INSUFFICIENT_EVIDENCE',
    rationale: 'Pilot-only semiconductor domain; same structural blocker as the other semiconductor endpoint.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-010A', bridgeId: 'Q-BR-010', side: 'A',
    submittedReference: 'quantum-systems:qubo-ising-mapping',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'QUBO and Ising formulations are foundational to annealing and QAOA and are independently justified. Deprioritised from this batch because Q-BR-010 is conceptually invalid and the record supports no remediable bridge.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-010B', bridgeId: 'Q-BR-010', side: 'B',
    submittedReference: 'fusion-plasma:grad-shafranov-equilibrium-solver',
    disposition: 'REVISE_REFERENCE',
    rationale:
      'tokamak-plasma-equilibrium already covers the Grad-Shafranov equilibrium problem. The submitted reference names a solver rather than the physical concept the corpus records.',
    suggestedExistingRecords: ['fusion-plasma-systems-tokamak-plasma-equilibrium'],
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-011A', bridgeId: 'Q-BR-011', side: 'A',
    submittedReference: 'quantum-systems:bb84-entanglement-distribution',
    disposition: 'REJECT_REFERENCE',
    rationale:
      'The reference is internally inconsistent. BB84 is a prepare-and-measure protocol that distributes no entanglement; entanglement-based key distribution is a different protocol family, E91. The submitted name fuses two distinct schemes, so there is no single coherent record to create or point at.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-011B', bridgeId: 'Q-BR-011', side: 'B',
    submittedReference: 'agentic-systems:mcp-tool-authorization-enclaves',
    disposition: 'REVISE_REFERENCE',
    rationale:
      '"Authorization enclaves" is not an established MCP concept. The corpus already carries the real mechanisms the bridge appears to mean.',
    suggestedExistingRecords: [
      'agentic-systems-mcp-tool-allowlisting',
      'agentic-systems-mcp-least-authority-tokens',
      'agentic-systems-mcp-sandboxed-tool-execution',
    ],
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-012A', bridgeId: 'Q-BR-012', side: 'A',
    submittedReference: 'quantum-systems:3d-cavity-resonator-loss',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'Three-dimensional superconducting cavities and their loss budget are absent from the corpus and are the basis of bosonic quantum memory claims. A record that separates the loss channels is independently valuable.',
    inCreationBatch: false,
  },
  {
    key: 'Q-BR-012B', bridgeId: 'Q-BR-012', side: 'B',
    submittedReference: 'critical-supply-chains:refractory-tantalum-niobium-refinement',
    disposition: 'CREATE_FOUNDATIONAL_CANDIDATE',
    rationale:
      'High-RRR refractory refining for superconducting RF is distinct from tantalum-concentrate-traceability and niobium-ferroniobium-production, which cover upstream sourcing rather than purity for cryogenic performance.',
    inCreationBatch: false,
  },
]

if (ENDPOINT_DISPOSITIONS.length !== 23) {
  throw new Error(`Expected 23 unresolved endpoints; found ${ENDPOINT_DISPOSITIONS.length}.`)
}

export function dispositionTotals(): Record<Disposition, number> {
  const totals = Object.fromEntries(DISPOSITIONS.map((value) => [value, 0])) as Record<Disposition, number>
  for (const entry of ENDPOINT_DISPOSITIONS) totals[entry.disposition] += 1
  return totals
}
