/**
 * Atlas ledger records cited by the Tensor-Opt job API.
 *
 * These mirror the published Tensor Network Optimization Atlas at
 * research.mahastrategies.com/atlas/tensor-networks. Identifiers were resolved
 * against the arXiv API and Crossref on 2026-07-29; nothing here is written
 * from recall. Claim ids match the research node, so a claimId returned by this
 * API resolves at the atlas URL rather than being a local invention.
 */

export const TENSOR_NETWORKS_ATLAS_URL = 'https://research.mahastrategies.com/atlas/tensor-networks'
export const MAHA_ORGANIZATION_ID = 'https://research.mahastrategies.com/#organization'
export const MAYON_RAJAN_PERSON_ID = 'https://www.mayonemaharajan.com/#person'

export interface TensorNetworkSource { id: string; authors: string; title: string; year: number; url: string; doi?: string; arxiv?: string }
export interface TensorNetworkClaim {
  id: string
  statement: string
  evidenceSourceIds: readonly string[]
  status: 'supported-method-basis' | 'research-direction' | 'boundary-record'
  boundary: string
}

export const tensorNetworkSources: readonly TensorNetworkSource[] = [
  { id: 'schollwoeck-2010', authors: 'Ulrich Schollwöck', title: 'The density-matrix renormalization group in the age of matrix product states', year: 2010, url: 'https://arxiv.org/abs/1008.3477', arxiv: '1008.3477' },
  { id: 'lucas-2013', authors: 'Andrew Lucas', title: 'Ising formulations of many NP problems', year: 2013, url: 'https://arxiv.org/abs/1302.5843', arxiv: '1302.5843', doi: '10.3389/fphy.2014.00005' },
  { id: 'markov-shi-2005', authors: 'Igor L. Markov, Yaoyun Shi', title: 'Simulating quantum computation by contracting tensor networks', year: 2005, url: 'https://arxiv.org/abs/quant-ph/0511069', arxiv: 'quant-ph/0511069', doi: '10.1137/050644756' },
  { id: 'mugel-2020', authors: 'Samuel Mugel, Carlos Kuchkovsky, Escolástico Sánchez, Samuel Fernández-Lorenzo, Jorge Luis-Hita, Enrique Lizaso, Román Orús', title: 'Dynamic Portfolio Optimization with Real Datasets Using Quantum Processors and Quantum-Inspired Tensor Networks', year: 2020, url: 'https://arxiv.org/abs/2007.00017', arxiv: '2007.00017', doi: '10.1103/PhysRevResearch.4.013006' },
  { id: 'pan-2021', authors: 'Feng Pan, Keyang Chen, Pan Zhang', title: 'Solving the sampling problem of the Sycamore quantum circuits', year: 2021, url: 'https://arxiv.org/abs/2111.03011', arxiv: '2111.03011', doi: '10.1103/PhysRevLett.129.090502' },
]

export const tensorNetworkClaims: readonly TensorNetworkClaim[] = [
  { id: 'tn-004', statement: 'Tensor-network accuracy is controlled by singular-value truncation, and the discarded weight is the quantity that makes a result interpretable.', evidenceSourceIds: ['schollwoeck-2010'], status: 'supported-method-basis', boundary: 'Small per-step discarded weight does not bound global error; truncations accumulate across sweeps.' },
  { id: 'tn-007', statement: 'QUBO problems map exactly onto Ising spin models, and explicit Ising formulations exist for a catalogue of NP-hard problems.', evidenceSourceIds: ['lucas-2013'], status: 'supported-method-basis', boundary: 'The encoding is exact and polynomial; it does not make the instance tractable, and penalty multipliers worsen conditioning.' },
  { id: 'tn-008', statement: 'The cost of contracting a tensor network is governed by the contraction order and by structural properties of the network graph such as its treewidth.', evidenceSourceIds: ['markov-shi-2005'], status: 'supported-method-basis', boundary: 'Favourable structure is a property of the instance. GPU acceleration changes the constant factor, not the complexity class.' },
  { id: 'tn-011', statement: 'Classical tensor-network contraction has been reported to solve the Sycamore random-circuit sampling problem, narrowing the advantage originally claimed for that task.', evidenceSourceIds: ['pan-2021'], status: 'supported-method-basis', boundary: 'One benchmark sampling task, not an application workload, and not a general classical-over-quantum result.' },
  { id: 'tn-014', statement: 'No source in the atlas establishes that classical tensor-network contraction generally outperforms quantum hardware on industrial optimization workloads.', evidenceSourceIds: ['pan-2021', 'mugel-2020'], status: 'boundary-record', boundary: 'This API returns measured solver diagnostics for the submitted instance only. No throughput comparison against QAOA or quantum annealers is expressed or implied by a job result.' },
]

export function assertTensorNetworkReferentialIntegrity(): void {
  const ids = new Set(tensorNetworkSources.map((source) => source.id))
  const seen = new Set<string>()
  for (const claim of tensorNetworkClaims) {
    if (seen.has(claim.id)) throw new Error(`Duplicate tensor-network claim id: ${claim.id}`)
    seen.add(claim.id)
    for (const sourceId of claim.evidenceSourceIds) {
      if (!ids.has(sourceId)) throw new Error(`Claim ${claim.id} references missing source ${sourceId}`)
    }
  }
}
