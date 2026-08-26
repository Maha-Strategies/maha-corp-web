import { createHash } from 'node:crypto'

import { resolveEpistemicReference } from './epistemic-reference-resolver.ts'

/**
 * Endpoint closure: deciding what to do about a submitted bridge endpoint that
 * the resolver could not resolve.
 *
 * This module is deliberately generic. A bridge batch supplies its submitted
 * references and this layer records, for each one, a single disposition plus
 * the reasoning, confidence and blockers behind it. The Q-BR batch is data at
 * the bottom of the file, not structure: the next batch registers its own plan
 * and reuses every function here.
 *
 * Two rules shape the design.
 *
 * The submitted reference is immutable. Normalisation, proposed canonical ids
 * and atomisation live in separate fields so a reviewer always sees what was
 * actually submitted next to what the audit proposes.
 *
 * A plan is not a resolution. Classifying an endpoint as `new-record-candidate`
 * and building the candidate does not make the endpoint resolve: candidates are
 * never in the canonical pool. The resolution count reported by the gap report
 * only ever counts canonical resolutions.
 */

export const ENDPOINT_CLOSURE_PLAN_VERSION = 'maha-endpoint-closure/1.0' as const

export const ENDPOINT_CLASSIFICATIONS = [
  /** An existing canonical record is genuinely semantically equivalent. */
  'existing-record-alias',
  /** The concept is legitimate and absent from the corpus. */
  'new-record-candidate',
  /** The reference fuses several concepts and must be atomised. */
  'compound-endpoint',
  /** The concept or the asserted mapping is incoherent or unsupported. */
  'invalid-endpoint',
  /** A related record exists only in a pilot or otherwise noncanonical class. */
  'incompatible-record-class',
  /** The record cannot be bounded without evidence that can be inspected. */
  'blocked-pending-evidence',
  /**
   * A related existing record may be more appropriate, but the submitted
   * reference cannot resolve through an alias because semantic equivalence has
   * not been established. This is the honest middle: it names where the
   * submitter should probably look without the resolver pretending the two
   * references mean the same thing.
   */
  'revise-reference',
] as const

export type EndpointClassification = (typeof ENDPOINT_CLASSIFICATIONS)[number]

/** How far the audit trusts its own disposition, not how good the bridge is. */
export const CLOSURE_CONFIDENCES = ['high', 'medium', 'low'] as const
export type ClosureConfidence = (typeof CLOSURE_CONFIDENCES)[number]

/**
 * What a compound endpoint would have to become. `higher-order-relation` means
 * neither atom alone carries the submitted meaning: the bridge is really about
 * the relation between them.
 */
export const BRIDGE_IMPACTS = ['single-endpoint', 'multiple-endpoints', 'higher-order-relation'] as const
export type BridgeImpact = (typeof BRIDGE_IMPACTS)[number]

export interface AtomicProposal {
  concept: string
  /** An existing canonical id where one already covers the atom. */
  existingRecordId: string | null
  proposedCanonicalId: string | null
  rationale: string
}

export interface Atomization {
  reason: string
  atoms: readonly AtomicProposal[]
  bridgeImpact: BridgeImpact
}

export interface EndpointClosureEntry {
  key: string
  batchId: string
  bridgeId: string
  side: 'A' | 'B'
  /** Verbatim, as submitted. Never rewritten by this plan. */
  submittedReference: string
  /** Recorded separately when a declared alias applies. Never substituted. */
  normalizedReference: string | null
  classification: EndpointClassification
  /** Where a record would live if one is created or aliased to. */
  proposedCanonicalId: string | null
  reasoning: string
  confidence: ClosureConfidence
  /** Machine-readable reasons this endpoint is not closed. */
  blockers: readonly string[]
  /**
   * Existing records that are close but NOT equivalent. Advisory. Listing a
   * near miss is how the plan refuses to alias a merely similar concept while
   * still telling the submitter where to look.
   */
  nearMissRecords: readonly string[]
  /**
   * Required for `revise-reference`: the records the submitter should consider
   * instead. Advisory only - never substituted, and never resolved against.
   */
  proposedReplacementRecordIds?: readonly string[]
  atomization?: Atomization
  /** Set only when this sprint actually built the candidate. */
  candidateId: string | null
}

export interface EndpointClosurePlan {
  batchId: string
  planVersion: typeof ENDPOINT_CLOSURE_PLAN_VERSION
  entries: readonly EndpointClosureEntry[]
}

/* ------------------------------------------------------------- generic ---- */

export function classificationTotals(plan: EndpointClosurePlan): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const classification of ENDPOINT_CLASSIFICATIONS) totals[classification] = 0
  for (const entry of plan.entries) totals[entry.classification] += 1
  return totals
}

export function blockerTotals(plan: EndpointClosurePlan): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const entry of plan.entries) {
    for (const blocker of entry.blockers) totals[blocker] = (totals[blocker] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(totals).sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * A plan entry never asserts resolution. This asks the live resolver what the
 * submitted reference actually does now, so the report cannot drift from the
 * resolver the way the source ledger once drifted from the candidates.
 */
export function liveOutcome(entry: EndpointClosureEntry): string {
  return resolveEpistemicReference(entry.submittedReference).outcome.status
}

/** Stable across runs: the plan is sorted and contains no timestamps. */
export function planDigest(plan: EndpointClosurePlan): string {
  const canonical = {
    batchId: plan.batchId,
    planVersion: plan.planVersion,
    entries: [...plan.entries]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((entry) => ({ ...entry, blockers: [...entry.blockers].sort() })),
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`
}

/*
 * Which near misses became `revise-reference`.
 *
 * The prior sprint recorded six endpoints as needing a revised reference. Three
 * moved here; three did not, because a more specific classification says more:
 *
 *   Q-BR-001A and Q-BR-003B are `compound-endpoint`. Both name two existing
 *   records at once, and "revise this reference" would hide that the fix is to
 *   split the endpoint, not to repoint it.
 *
 *   Q-BR-008A is `existing-record-alias`. Equivalence WAS established against
 *   the canonical record text, so it resolves rather than needing revision.
 *
 * Q-BR-010B and Q-BR-011B keep their source blockers. Reclassifying the
 * endpoint says nothing about the citation, and the blocker list proves it.
 */

/* ------------------------------------------------------------ Q-BR data --- */

const QBR: readonly EndpointClosureEntry[] = [
  {
    key: 'Q-BR-001A', batchId: 'Q-BR', bridgeId: 'Q-BR-001', side: 'A',
    submittedReference: 'quantum-systems:surface-code-threshold',
    normalizedReference: null,
    classification: 'compound-endpoint',
    proposedCanonicalId: null,
    reasoning:
      'The surface-code threshold is the fault-tolerance threshold condition evaluated for one particular code. Both halves already exist as separate canonical records, and the submitted name is the intersection rather than either one. Aliasing it to either record would assert that a code-specific number and a general condition are the same thing.',
    confidence: 'high',
    blockers: ['endpoint-requires-atomization'],
    nearMissRecords: [
      'urn:maha:record:surface-code-error-correction',
      'urn:maha:record:fault-tolerance-threshold-condition',
    ],
    atomization: {
      reason:
        'Two existing canonical records already carry the halves. What the bridge wants is the value of one evaluated under the other, which is a relation between them, not a third record.',
      atoms: [
        {
          concept: 'Surface-code error correction',
          existingRecordId: 'urn:maha:record:surface-code-error-correction',
          proposedCanonicalId: null,
          rationale: 'The code architecture the threshold is quoted for.',
        },
        {
          concept: 'Fault-tolerance threshold condition',
          existingRecordId: 'urn:maha:record:fault-tolerance-threshold-condition',
          proposedCanonicalId: null,
          rationale: 'The general condition that yields a threshold once a code and decoder are fixed.',
        },
      ],
      bridgeImpact: 'higher-order-relation',
    },
    candidateId: null,
  },
  {
    key: 'Q-BR-001B', batchId: 'Q-BR', bridgeId: 'Q-BR-001', side: 'B',
    submittedReference: 'mathematics:algebraic-coding-theory',
    normalizedReference: null,
    classification: 'incompatible-record-class',
    proposedCanonicalId: null,
    reasoning:
      'The mathematics domain exists only in the Phase-4 pilot corpus. Pilot entries carry their own unresolved source blockers and are not canonical graph records, so nothing here can back a bridge endpoint until the domain is promoted — a structural decision outside an endpoint sprint.',
    confidence: 'high',
    blockers: ['domain-is-pilot-only', 'requires-domain-promotion-decision'],
    nearMissRecords: [],
    candidateId: null,
  },
  {
    key: 'Q-BR-002A', batchId: 'Q-BR', bridgeId: 'Q-BR-002', side: 'A',
    submittedReference: 'quantum-systems:transmon-coherence-limits',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-transmon-coherence-limits',
    reasoning:
      'What physically limits transmon coherence is distinct from coherence-t1-t2-measurements, which covers how T1 and T2 are measured. The loss-channel account stands on its own for anyone reading transmon hardware claims.',
    confidence: 'high',
    blockers: ['candidate-source-missing-locator'],
    nearMissRecords: ['urn:maha:record:coherence-t1-t2-measurements', 'urn:maha:record:transmon-qubit'],
    candidateId: 'urn:maha:candidate:quantum-systems-transmon-coherence-limits',
  },
  {
    key: 'Q-BR-002B', batchId: 'Q-BR', bridgeId: 'Q-BR-002', side: 'B',
    submittedReference: 'semiconductor-manufacturing:thin-film-deposition',
    normalizedReference: 'semiconductor:thin-film-deposition',
    classification: 'incompatible-record-class',
    proposedCanonicalId: null,
    reasoning:
      'The declared domain alias reaches the semiconductor namespace, which is pilot-only. The alias makes the namespace difference explicit; it does not make a pilot entry canonical.',
    confidence: 'high',
    blockers: ['domain-is-pilot-only', 'requires-domain-promotion-decision'],
    nearMissRecords: [],
    candidateId: null,
  },
  {
    key: 'Q-BR-003A', batchId: 'Q-BR', bridgeId: 'Q-BR-003', side: 'A',
    submittedReference: 'quantum-systems:tensor-network-states',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-tensor-network-states',
    reasoning:
      'Matrix product states and DMRG underpin both quantum many-body simulation and every classical-simulability argument made about quantum hardware. The concept is justified independently of Q-BR-003, which is itself conceptually invalid.',
    confidence: 'high',
    blockers: ['candidate-source-missing-locator'],
    nearMissRecords: [],
    candidateId: 'urn:maha:candidate:quantum-systems-tensor-network-states',
  },
  {
    key: 'Q-BR-003B', batchId: 'Q-BR', bridgeId: 'Q-BR-003', side: 'B',
    submittedReference: 'mechanistic-interpretability:sparse-autoencoder-superposition',
    normalizedReference: null,
    classification: 'compound-endpoint',
    proposedCanonicalId: null,
    reasoning:
      'The reference names the sparse autoencoder and the superposition hypothesis in one slug. Both already exist as separate canonical records, and conflating them is exactly the move that makes Q-BR-003 assert an isomorphism it cannot support.',
    confidence: 'high',
    blockers: ['endpoint-requires-atomization'],
    nearMissRecords: [
      'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries',
      'urn:maha:record:mechanistic-interpretability-neural-feature-superposition',
    ],
    atomization: {
      reason:
        'A dictionary-learning method and a hypothesis about representation geometry are different objects. Naming them together invites the reader to treat the method as evidence for the hypothesis.',
      atoms: [
        {
          concept: 'Sparse autoencoder dictionaries',
          existingRecordId: 'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries',
          proposedCanonicalId: null,
          rationale: 'The method actually cited by the submitted source.',
        },
        {
          concept: 'Neural feature superposition',
          existingRecordId: 'urn:maha:record:mechanistic-interpretability-neural-feature-superposition',
          proposedCanonicalId: null,
          rationale: 'The representational hypothesis the method is used to probe.',
        },
      ],
      bridgeImpact: 'multiple-endpoints',
    },
    candidateId: null,
  },
  {
    key: 'Q-BR-004A', batchId: 'Q-BR', bridgeId: 'Q-BR-004', side: 'A',
    submittedReference: 'quantum-systems:phase-estimation-hamiltonian',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-phase-estimation-resource-scaling',
    reasoning:
      'Quantum phase estimation applied to a second-quantised electronic Hamiltonian is one procedure with one resource account. The corpus has no record for it, and every chemistry-advantage claim depends on the resource dependencies it carries.',
    confidence: 'medium',
    blockers: ['candidate-source-missing-locator'],
    nearMissRecords: [],
    candidateId: 'urn:maha:candidate:quantum-systems-phase-estimation-resource-scaling',
  },
  {
    key: 'Q-BR-004B', batchId: 'Q-BR', bridgeId: 'Q-BR-004', side: 'B',
    submittedReference: 'biomolecular-engineering:enzyme-active-site-kinetics',
    normalizedReference: null,
    classification: 'blocked-pending-evidence',
    proposedCanonicalId: null,
    reasoning:
      'The domain is canonical and the concept is plausible, but the only submitted source for it could not be located in any authoritative index. A record whose scope would have to be guessed is not a record, and inventing a bounding source to rescue the endpoint is the failure mode this audit exists to prevent.',
    confidence: 'high',
    blockers: ['source-unverifiable', 'cannot-bound-scope-without-source'],
    nearMissRecords: [
      'urn:maha:record:biomolecular-engineering-directed-enzyme-evolution',
      'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering',
    ],
    candidateId: null,
  },
  {
    key: 'Q-BR-005A', batchId: 'Q-BR', bridgeId: 'Q-BR-005', side: 'A',
    submittedReference: 'quantum-systems:cryogenic-dilution-attenuation',
    normalizedReference: null,
    classification: 'compound-endpoint',
    proposedCanonicalId: null,
    reasoning:
      'Dilution refrigeration and cryogenic attenuation of control lines are two different pieces of hardware doing two different jobs. The submitted slug fuses the cooling stage with the signal chain, and only the cooling half is what Q-BR-005 actually argues about.',
    confidence: 'high',
    blockers: ['endpoint-requires-atomization', 'candidate-source-missing-locator'],
    nearMissRecords: ['urn:maha:record:cryogenic-superconducting-control-stack'],
    atomization: {
      reason:
        'The helium-3 dependency Q-BR-005 asserts belongs to the refrigerator, not to the attenuators. Keeping them fused would let a supply claim about one be read as a claim about the other.',
      atoms: [
        {
          concept: 'Dilution refrigeration below 100 mK',
          existingRecordId: null,
          proposedCanonicalId: 'urn:maha:record:quantum-systems-dilution-refrigeration',
          rationale: 'The cooling stage that actually consumes a helium-3 charge. Built as a candidate.',
        },
        {
          concept: 'Cryogenic line attenuation',
          existingRecordId: null,
          proposedCanonicalId: null,
          rationale:
            'Thermalisation of control lines by staged attenuators. Not created: no verified source was available to bound it in this sprint.',
        },
      ],
      bridgeImpact: 'multiple-endpoints',
    },
    candidateId: 'urn:maha:candidate:quantum-systems-dilution-refrigeration',
  },
  {
    key: 'Q-BR-005B', batchId: 'Q-BR', bridgeId: 'Q-BR-005', side: 'B',
    submittedReference: 'critical-supply-chains:helium-isotope-refinement',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:critical-supply-chains-helium-3-isotope-supply',
    reasoning:
      'Helium-3 supply is a genuine supply node with a distinct origin path, and the corpus covers helium liquefaction logistics only, which is a helium-4 story. The two are not interchangeable.',
    confidence: 'high',
    blockers: ['candidate-source-missing-locator'],
    nearMissRecords: ['urn:maha:record:critical-supply-chains-helium-liquefaction-logistics'],
    candidateId: 'urn:maha:candidate:critical-supply-chains-helium-3-isotope-supply',
  },
  {
    key: 'Q-BR-006A', batchId: 'Q-BR', bridgeId: 'Q-BR-006', side: 'A',
    submittedReference: 'quantum-systems:superconducting-gap-depairing',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-superconducting-gap-and-depairing',
    reasoning:
      'The energy gap, the critical field and the depairing current are one BCS-level account of what bounds a superconductor, and the corpus has no record for it despite several records depending on it.',
    confidence: 'medium',
    blockers: ['candidate-source-missing-locator'],
    nearMissRecords: ['urn:maha:record:josephson-junction-nonlinearity'],
    candidateId: 'urn:maha:candidate:quantum-systems-superconducting-gap-and-depairing',
  },
  {
    key: 'Q-BR-007A', batchId: 'Q-BR', bridgeId: 'Q-BR-007', side: 'A',
    submittedReference: 'quantum-systems:majorana-zero-modes',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-majorana-zero-modes',
    reasoning:
      'A well-defined theoretical proposal with a contested experimental record. Worth holding precisely because the claim history is contested, and the corpus currently has nowhere to attach that history.',
    confidence: 'high',
    blockers: ['candidate-source-missing-locator'],
    nearMissRecords: [],
    candidateId: 'urn:maha:candidate:quantum-systems-majorana-zero-modes',
  },
  {
    key: 'Q-BR-007B', batchId: 'Q-BR', bridgeId: 'Q-BR-007', side: 'B',
    submittedReference: 'advanced-materials:twisted-bilayer-heterostructures',
    normalizedReference: null,
    classification: 'revise-reference',
    proposedCanonicalId: null,
    reasoning:
      'The structural concept is legitimate and is not the same as the phenomena it hosts, so no alias is justified. But the corpus already holds four neighbouring records and the submitted source IS the magic-angle superconductivity paper, which is one of them. The submitter should point at an existing record rather than have a fifth created that duplicates the graph. Equivalence has not been established, so this stays unresolved.',
    confidence: 'medium',
    blockers: ['needs-editorial-decision-duplicate-risk'],
    proposedReplacementRecordIds: [
      'urn:maha:record:advanced-materials-magic-angle-superconductivity',
      'urn:maha:record:advanced-materials-moire-superlattices',
    ],
    nearMissRecords: [
      'urn:maha:record:advanced-materials-magic-angle-superconductivity',
      'urn:maha:record:advanced-materials-moire-superlattices',
      'urn:maha:record:advanced-materials-twist-angle-control',
      'urn:maha:record:advanced-materials-graphene-hbn-heterostructures',
    ],
    candidateId: null,
  },
  {
    key: 'Q-BR-008A', batchId: 'Q-BR', bridgeId: 'Q-BR-008', side: 'A',
    submittedReference: 'quantum-systems:syndrome-extraction-cycle',
    normalizedReference: 'quantum-systems:stabilizer-syndrome-measurement',
    classification: 'existing-record-alias',
    proposedCanonicalId: 'urn:maha:record:stabilizer-syndrome-measurement',
    reasoning:
      'Syndrome extraction and syndrome measurement are the same operation under two standard names. The canonical record already scopes the repeated round — "Repeated parity measurements that extract error information" — so the submitted name adds nothing it does not already bound. This is the only alias this sprint adds.',
    confidence: 'medium',
    blockers: [],
    nearMissRecords: [],
    candidateId: null,
  },
  {
    key: 'Q-BR-008B', batchId: 'Q-BR', bridgeId: 'Q-BR-008', side: 'B',
    submittedReference: 'neuromorphic-biocomputing:spiking-fault-tolerance',
    normalizedReference: null,
    classification: 'incompatible-record-class',
    proposedCanonicalId: null,
    reasoning:
      'The neuromorphic-biocomputing domain exists only in the Phase-4 pilot corpus. As with mathematics and semiconductor, promotion of the domain is a prerequisite and is out of scope here.',
    confidence: 'high',
    blockers: ['domain-is-pilot-only', 'requires-domain-promotion-decision'],
    nearMissRecords: [],
    candidateId: null,
  },
  {
    key: 'Q-BR-009A', batchId: 'Q-BR', bridgeId: 'Q-BR-009', side: 'A',
    submittedReference: 'quantum-systems:spin-qubit-hyperfine-dephasing',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-spin-qubit-hyperfine-dephasing',
    reasoning:
      'Hyperfine coupling to residual silicon-29 is the specific mechanism behind the isotopic-enrichment argument, and silicon-spin-qubits covers the platform rather than the mechanism.',
    confidence: 'high',
    blockers: [],
    nearMissRecords: ['urn:maha:record:silicon-spin-qubits', 'urn:maha:record:coherence-t1-t2-measurements'],
    candidateId: 'urn:maha:candidate:quantum-systems-spin-qubit-hyperfine-dephasing',
  },
  {
    key: 'Q-BR-009B', batchId: 'Q-BR', bridgeId: 'Q-BR-009', side: 'B',
    submittedReference: 'semiconductor-manufacturing:silicon-crystal-growth-and-wafer-preparation',
    normalizedReference: 'semiconductor:silicon-crystal-growth-and-wafer-preparation',
    classification: 'incompatible-record-class',
    proposedCanonicalId: null,
    reasoning:
      'Pilot-only domain, which blocks first and blocks regardless. The reference is also compound — crystal growth and wafer preparation are separate process steps — so even after a domain promotion it would still need atomising. Both are recorded; the class problem is the one that must be solved first.',
    confidence: 'high',
    blockers: ['domain-is-pilot-only', 'requires-domain-promotion-decision', 'endpoint-requires-atomization'],
    nearMissRecords: ['urn:maha:record:critical-supply-chains-semiconductor-grade-polysilicon'],
    atomization: {
      reason:
        'Czochralski growth and the downstream slicing, lapping and polishing sequence are different processes with different failure modes and different supply dependencies.',
      atoms: [
        {
          concept: 'Silicon crystal growth',
          existingRecordId: null,
          proposedCanonicalId: null,
          rationale: 'Blocked behind the same domain promotion decision.',
        },
        {
          concept: 'Wafer preparation',
          existingRecordId: null,
          proposedCanonicalId: null,
          rationale: 'Blocked behind the same domain promotion decision.',
        },
      ],
      bridgeImpact: 'multiple-endpoints',
    },
    candidateId: null,
  },
  {
    key: 'Q-BR-010A', batchId: 'Q-BR', bridgeId: 'Q-BR-010', side: 'A',
    submittedReference: 'quantum-systems:qubo-ising-mapping',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-qubo-ising-mapping',
    reasoning:
      'The QUBO-to-Ising reduction is a concrete, well-sourced mapping that underlies every annealing claim, and the submitted source carries an inspected section-level locator. It stands on its own even though Q-BR-010 is conceptually invalid.',
    confidence: 'high',
    blockers: [],
    nearMissRecords: [],
    candidateId: 'urn:maha:candidate:quantum-systems-qubo-ising-mapping',
  },
  {
    key: 'Q-BR-010B', batchId: 'Q-BR', bridgeId: 'Q-BR-010', side: 'B',
    submittedReference: 'fusion-plasma:grad-shafranov-equilibrium-solver',
    normalizedReference: 'fusion-plasma-systems:grad-shafranov-equilibrium-solver',
    classification: 'revise-reference',
    proposedCanonicalId: null,
    proposedReplacementRecordIds: ['urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium'],
    reasoning:
      'The domain alias resolves and the canonical domain holds a tokamak-plasma-equilibrium record. A numerical solver is not the equilibrium it solves, so no alias is justified, but that record is where a submitter asking about tokamak equilibrium should be pointed. The source blocker is unchanged and tracked separately: the submitted citation could not be located, and the plausible substitute found in Crossref remains a pending human decision.',
    confidence: 'high',
    blockers: ['source-unverifiable', 'cannot-bound-scope-without-source'],
    nearMissRecords: ['urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium'],
    candidateId: null,
  },
  {
    key: 'Q-BR-011A', batchId: 'Q-BR', bridgeId: 'Q-BR-011', side: 'A',
    submittedReference: 'quantum-systems:bb84-entanglement-distribution',
    normalizedReference: null,
    classification: 'invalid-endpoint',
    proposedCanonicalId: null,
    reasoning:
      'BB84 is a prepare-and-measure protocol. It does not distribute entanglement — that is E91 and its descendants. The submitted slug asserts a property of the protocol that the protocol does not have, so there is no coherent record to create and no existing record to alias to. Creating one would encode the error.',
    confidence: 'high',
    blockers: ['concept-incoherent-as-stated'],
    nearMissRecords: [],
    candidateId: null,
  },
  {
    key: 'Q-BR-011B', batchId: 'Q-BR', bridgeId: 'Q-BR-011', side: 'B',
    submittedReference: 'agentic-systems:mcp-tool-authorization-enclaves',
    normalizedReference: 'agentic-systems-mcp:mcp-tool-authorization-enclaves',
    classification: 'revise-reference',
    proposedCanonicalId: null,
    proposedReplacementRecordIds: [
      'urn:maha:record:agentic-systems-mcp-least-authority-tokens',
      'urn:maha:record:agentic-systems-mcp-sandboxed-tool-execution',
      'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    ],
    reasoning:
      'The domain alias resolves into a canonical namespace that already holds five neighbouring authorization records. "Authorization enclaves" fuses an access-control question with a hardware-isolation one, so equivalence with any single one of them is not established and no alias is justified. The submitter should be pointed at the least-authority, sandboxing and deny-by-default records instead. The source blocker is unchanged and tracked separately: the only cited source could not be found in any authoritative index.',
    confidence: 'high',
    blockers: ['source-unverifiable', 'cannot-bound-scope-without-source'],
    nearMissRecords: [
      'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
      'urn:maha:record:agentic-systems-mcp-least-authority-tokens',
      'urn:maha:record:agentic-systems-mcp-sandboxed-tool-execution',
      'urn:maha:record:agentic-systems-mcp-human-approval-boundaries',
      'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    ],
    candidateId: null,
  },
  {
    key: 'Q-BR-012A', batchId: 'Q-BR', bridgeId: 'Q-BR-012', side: 'A',
    submittedReference: 'quantum-systems:3d-cavity-resonator-loss',
    normalizedReference: null,
    classification: 'new-record-candidate',
    proposedCanonicalId: 'urn:maha:record:quantum-systems-3d-cavity-resonator-loss',
    reasoning:
      'Loss channels in three-dimensional superconducting cavities are distinct from planar transmon loss and from circuit QED generally. The submitted source is verified and carries an inspected abstract-level locator for the lifetime figure.',
    confidence: 'high',
    blockers: [],
    nearMissRecords: ['urn:maha:record:circuit-quantum-electrodynamics'],
    candidateId: 'urn:maha:candidate:quantum-systems-3d-cavity-resonator-loss',
  },
  {
    key: 'Q-BR-012B', batchId: 'Q-BR', bridgeId: 'Q-BR-012', side: 'B',
    submittedReference: 'critical-supply-chains:refractory-tantalum-niobium-refinement',
    normalizedReference: null,
    classification: 'compound-endpoint',
    proposedCanonicalId: null,
    reasoning:
      'Tantalum and niobium refining are already two separate canonical records. The submitted slug fuses them, and the two metals have different ore routes, different processing concentration and different export exposure, so a supply claim about one is not a claim about the other.',
    confidence: 'high',
    blockers: ['endpoint-requires-atomization'],
    nearMissRecords: [
      'urn:maha:record:critical-supply-chains-tantalum-concentrate-traceability',
      'urn:maha:record:critical-supply-chains-niobium-ferroniobium-production',
    ],
    atomization: {
      reason:
        'Both atoms already exist canonically. Fusing them would let the better-documented metal carry the weaker claim about the other.',
      atoms: [
        {
          concept: 'Tantalum concentrate traceability',
          existingRecordId: 'urn:maha:record:critical-supply-chains-tantalum-concentrate-traceability',
          proposedCanonicalId: null,
          rationale: 'Covers the tantalum half, including origin traceability.',
        },
        {
          concept: 'Niobium and ferroniobium production',
          existingRecordId: 'urn:maha:record:critical-supply-chains-niobium-ferroniobium-production',
          proposedCanonicalId: null,
          rationale: 'Covers the niobium half, including its distinct processing concentration.',
        },
      ],
      bridgeImpact: 'multiple-endpoints',
    },
    candidateId: null,
  },
]

export const QBR_ENDPOINT_CLOSURE_PLAN: EndpointClosurePlan = {
  batchId: 'Q-BR',
  planVersion: ENDPOINT_CLOSURE_PLAN_VERSION,
  entries: QBR,
}

/** Every registered batch. A new bridge family adds one entry here. */
export const ENDPOINT_CLOSURE_PLANS: readonly EndpointClosurePlan[] = [QBR_ENDPOINT_CLOSURE_PLAN]

const planKeys = new Set(QBR.map((entry) => entry.key))
if (planKeys.size !== QBR.length) throw new Error('Duplicate key in the Q-BR endpoint closure plan.')

for (const entry of QBR) {
  if (entry.classification !== 'revise-reference') continue
  if (!entry.proposedReplacementRecordIds?.length) {
    throw new Error(`${entry.key} is revise-reference without a proposed replacement record.`)
  }
  if (entry.proposedCanonicalId) {
    throw new Error(`${entry.key} is revise-reference and must not propose a new canonical id.`)
  }
}

/** A revise-reference endpoint is still unresolved. It never counts as closure. */
export function countsAsResolution(entry: EndpointClosureEntry): boolean {
  return entry.classification === 'existing-record-alias'
}
