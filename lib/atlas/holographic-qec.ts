export const HOLOGRAPHIC_QEC_ATLAS_URL = 'https://research.mahastrategies.com/atlas/holographic-qec'
export const MAHA_ORGANIZATION_ID = 'https://research.mahastrategies.com/#organization'
export const MAYON_RAJAN_PERSON_ID = 'https://www.mayonemaharajan.com/#person'

export interface HolographicCodeGeometry { id: string; tiling: 'pentagon' | 'hexagon' | 'mixed'; curvature: 'negative'; layers: number; boundaryLegCount: number; bulkLogicalCount: number; embedding: 'abstract-hyperbolic' | '2d-routed' | '3d-reconfigurable' }
export interface TensorNetworkState { tensor: 'perfect' | 'stabilizer' | 'isometry'; legsPerTensor: number; bulkLegs: number; boundaryLegs: number; networkRole: 'encoding' | 'recovery' | 'layout-synthesis' }
export interface FaultThreshold { noiseModel: 'depolarizing' | 'amplitude-damping'; physicalErrorRate: number; thresholdEstimate?: number; decoder: string; qualification: string }
export interface SyndromeDecodingLatency { decoder: string; cycleTimeNs: number; p50LatencyNs: number; p99LatencyNs: number; topologyAssumption: string }
export interface HolographicQecSource { id: string; authors: string; title: string; year: number; url: string; doi?: string; arxiv?: string }
export interface HolographicQecClaim { id: string; statement: string; evidenceSourceIds: readonly string[]; status: 'supported-method-basis' | 'research-direction'; boundary: string }

export const holographicCodeGeometries: readonly HolographicCodeGeometry[] = [
  { id: 'happy-pentagon', tiling: 'pentagon', curvature: 'negative', layers: 3, boundaryLegCount: 50, bulkLogicalCount: 11, embedding: 'abstract-hyperbolic' },
  { id: 'hyperbolic-hexagon', tiling: 'hexagon', curvature: 'negative', layers: 4, boundaryLegCount: 96, bulkLogicalCount: 25, embedding: '3d-reconfigurable' },
]

export const tensorNetworkStates: readonly TensorNetworkState[] = [
  { tensor: 'perfect', legsPerTensor: 6, bulkLegs: 1, boundaryLegs: 5, networkRole: 'encoding' },
  { tensor: 'isometry', legsPerTensor: 5, bulkLegs: 1, boundaryLegs: 4, networkRole: 'layout-synthesis' },
]

export const faultThresholdProfiles: readonly FaultThreshold[] = [
  { noiseModel: 'depolarizing', physicalErrorRate: 0.001, decoder: 'declared decoder benchmark', qualification: 'Thresholds must be estimated for the exact finite code, circuit, decoder, and correlated-noise assumptions.' },
  { noiseModel: 'amplitude-damping', physicalErrorRate: 0.001, decoder: 'noise-adapted decoder benchmark', qualification: 'Depolarizing thresholds cannot be transferred to amplitude damping without a separate channel model and recovery analysis.' },
]

export const syndromeDecodingLatencies: readonly SyndromeDecodingLatency[] = [
  { decoder: 'tensor-network contraction', cycleTimeNs: 1000, p50LatencyNs: 0, p99LatencyNs: 0, topologyAssumption: 'Latency fields are measured deployment outputs, not preset performance claims.' },
]

export const holographicQecSources: readonly HolographicQecSource[] = [
  { id: 'pastawski-2015', authors: 'Fernando Pastawski, Beni Yoshida, Daniel Harlow, John Preskill', title: 'Holographic quantum error-correcting codes: Toy models for the bulk/boundary correspondence', year: 2015, url: 'https://doi.org/10.1007/JHEP06(2015)149', doi: '10.1007/JHEP06(2015)149', arxiv: '1503.06237' },
  { id: 'harlow-2016', authors: 'Daniel Harlow', title: 'The Ryu-Takayanagi Formula from Quantum Error Correction', year: 2016, url: 'https://arxiv.org/abs/1607.03901', arxiv: '1607.03901' },
  { id: 'gottesman-2005', authors: 'Daniel Gottesman', title: 'Quantum Error Correction and Fault-Tolerance', year: 2005, url: 'https://arxiv.org/abs/quant-ph/0507174', arxiv: 'quant-ph/0507174' },
  { id: 'jahn-eisert-2021', authors: 'Alexander Jahn, Jens Eisert', title: 'Holographic tensor network models and quantum error correction: A topical review', year: 2021, url: 'https://arxiv.org/abs/2102.02619', arxiv: '2102.02619' },
  { id: 'yoshida-2019', authors: 'Beni Yoshida', title: 'Firewalls vs. Scrambling', year: 2019, url: 'https://arxiv.org/abs/1812.01194', arxiv: '1812.01194' },
]

export const holographicQecClaims: readonly HolographicQecClaim[] = [
  { id: 'hqc-001', statement: 'HaPPY-style tensor networks provide an explicit bulk-to-boundary encoding model in negatively curved geometry, with recovery properties determined by the chosen tensor network and erased boundary region.', evidenceSourceIds: ['pastawski-2015', 'harlow-2016', 'jahn-eisert-2021'], status: 'supported-method-basis', boundary: 'This does not establish that a finite hardware implementation has lower overhead than a surface code; overhead depends on distance, connectivity, routing, gate set, and decoder.' },
  { id: 'hqc-002', statement: 'Fault-tolerance thresholds are properties of a complete code, noisy circuit, decoder, and noise channel; depolarizing and amplitude-damping analyses require distinct channel-aware evaluations.', evidenceSourceIds: ['gottesman-2005', 'jahn-eisert-2021'], status: 'supported-method-basis', boundary: 'No universal threshold or logical-error rate is asserted for holographic codes in this atlas.' },
  { id: 'hqc-003', statement: 'A compiler can map an abstract hyperbolic tensor layout to a hardware connectivity graph, including reconfigurable or three-dimensional architectures, while reporting routing overhead and unmet adjacency constraints.', evidenceSourceIds: ['pastawski-2015', 'jahn-eisert-2021'], status: 'research-direction', boundary: 'A graph embedding is a compilation artifact, not evidence that a target hardware platform realizes non-Euclidean connectivity or fault tolerance.' },
]

export function assertHolographicQecReferentialIntegrity(): void {
  const sourceIds = new Set(holographicQecSources.map((source) => source.id)); const claimIds = new Set<string>()
  for (const claim of holographicQecClaims) { if (claimIds.has(claim.id)) throw new Error(`Duplicate holographic QEC claim id: ${claim.id}`); claimIds.add(claim.id); for (const sourceId of claim.evidenceSourceIds) if (!sourceIds.has(sourceId)) throw new Error(`Claim ${claim.id} references missing source ${sourceId}`) }
}

assertHolographicQecReferentialIntegrity()
