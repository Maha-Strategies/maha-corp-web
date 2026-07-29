export const GEOMETRIC_AI_ATLAS_URL = 'https://research.mahastrategies.com/atlas/geometric-ai'
export const MAHA_ORGANIZATION_ID = 'https://research.mahastrategies.com/#organization'
export const MAYON_RAJAN_PERSON_ID = 'https://www.mayonemaharajan.com/#person'

export type LieGroup = 'SO(3)' | 'SE(3)' | 'E(n)' | 'SU(N)'

export interface LieGroupEquivariance {
  group: LieGroup
  action: string
  inputRepresentation: string
  outputRepresentation: string
  formulation: string
  guarantee: 'architectural' | 'empirical'
}

export interface ManifoldMetric {
  manifold: string
  metric: string
  curvature?: string
  topology: string
  learningRole: string
}

export interface PhysicalConstraintGuarantee {
  id: string
  quantity: string
  mechanism: string
  scope: string
  verification: string
  limitation: string
}

export interface AtlasSource {
  id: string
  authors: string
  title: string
  year: number
  url: string
  doi?: string
  arxiv?: string
}

export interface AtlasClaim {
  id: string
  statement: string
  evidenceSourceIds: readonly string[]
  status: 'supported-method-basis' | 'research-direction'
  boundary: string
}

export const geometricAiEquivariances: readonly LieGroupEquivariance[] = [
  { group: 'SO(3)', action: '3D rotations', inputRepresentation: 'scalars, vectors, and irreducible representations', outputRepresentation: 'rotated features under the same representation', formulation: 'f(ρin(R)x) = ρout(R)f(x)', guarantee: 'architectural' },
  { group: 'SE(3)', action: '3D rotations and translations', inputRepresentation: 'point sets, molecular graphs, meshes', outputRepresentation: 'translation-invariant scalars and equivariant vectors/tensors', formulation: 'f(Rx + t) = ρ(R)f(x)', guarantee: 'architectural' },
  { group: 'E(n)', action: 'Euclidean rotations, translations, and reflections', inputRepresentation: 'n-dimensional geometric graphs', outputRepresentation: 'features transformed under the declared E(n) action', formulation: 'f(g·x) = ρ(g)f(x)', guarantee: 'architectural' },
  { group: 'SU(N)', action: 'unitary internal symmetry', inputRepresentation: 'fields with a declared gauge representation', outputRepresentation: 'covariant field features', formulation: 'f(g·x) = ρ(g)f(x)', guarantee: 'architectural' },
]

export const geometricAiManifoldMetrics: readonly ManifoldMetric[] = [
  { manifold: 'Riemann surface', metric: 'conformal metric g = e^{2φ}|dz|²', curvature: 'Gaussian curvature', topology: 'genus and marked points', learningRole: 'coordinate-aware metric learning and mesh parameterization' },
  { manifold: 'Calabi–Yau manifold', metric: 'Ricci-flat Kähler metric in a fixed Kähler class', curvature: 'Ricci curvature Rᵢⱼ = 0', topology: 'complex dimension, Hodge data, Kähler class', learningRole: 'numerical metric approximation for compactification and dimensional-reduction studies' },
]

export const physicalConstraintGuarantees: readonly PhysicalConstraintGuarantee[] = [
  { id: 'se3-equivariance', quantity: 'declared SE(3) transformation law', mechanism: 'equivariant layers and representation-aware message passing', scope: 'Every model evaluation under the specified group action.', verification: 'Transform input; compare output to the prescribed representation transform.', limitation: 'Equivariance does not establish force-field accuracy, stability, or every physical law.' },
  { id: 'hamiltonian-structure', quantity: 'Hamiltonian structure and energy conservation in the modeled closed system', mechanism: 'Hamiltonian parameterization with symplectic time evolution', scope: 'The declared autonomous closed-system model and numerical integration regime.', verification: 'Report Hamiltonian drift and symplecticity diagnostics over a held-out trajectory.', limitation: 'Open systems, model misspecification, and numerical error require explicit treatment.' },
  { id: 'boundary-conditions', quantity: 'declared boundary condition', mechanism: 'hard parameterization or constraint-compatible discretization', scope: 'Only the boundary condition encoded in the submitted job.', verification: 'Evaluate residual at boundary nodes or faces.', limitation: 'A zero boundary residual does not prove interior solution accuracy.' },
]

export const geometricAiSources: readonly AtlasSource[] = [
  { id: 'bronstein-2021', authors: 'Michael M. Bronstein, Joan Bruna, Taco Cohen, Petar Veličković', title: 'Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges', year: 2021, url: 'https://arxiv.org/abs/2104.13478', arxiv: '2104.13478' },
  { id: 'cohen-welling-2016', authors: 'Taco S. Cohen, Max Welling', title: 'Group Equivariant Convolutional Networks', year: 2016, url: 'https://arxiv.org/abs/1602.07576', arxiv: '1602.07576' },
  { id: 'kipf-welling-2017', authors: 'Thomas N. Kipf, Max Welling', title: 'Semi-Supervised Classification with Graph Convolutional Networks', year: 2017, url: 'https://arxiv.org/abs/1609.02907', arxiv: '1609.02907' },
  { id: 'villani-2009', authors: 'Cédric Villani', title: 'Optimal Transport: Old and New', year: 2009, url: 'https://doi.org/10.1007/978-3-540-71050-9', doi: '10.1007/978-3-540-71050-9' },
  { id: 'greydanus-2019', authors: 'Samuel Greydanus, Misko Dzamba, Jason Yosinski', title: 'Hamiltonian Neural Networks', year: 2019, url: 'https://arxiv.org/abs/1906.01563', arxiv: '1906.01563' },
  { id: 'he-jejjala-mishra-2017', authors: 'Yang-Hui He, Vishnu Jejjala, Brent D. Nelson, Mary K. Gaillard, Andrew Ashmore', title: 'Machine Learning Calabi–Yau Metrics', year: 2017, url: 'https://arxiv.org/abs/1712.00464', arxiv: '1712.00464' },
]

export const geometricAiClaims: readonly AtlasClaim[] = [
  { id: 'gai-001', statement: 'For a specified SE(3) action and compatible representations, an equivariant architecture can enforce the declared transformation law by construction; data augmentation instead samples only a finite subset of transformations and does not itself provide an exact architectural guarantee.', evidenceSourceIds: ['bronstein-2021', 'cohen-welling-2016'], status: 'supported-method-basis', boundary: 'This is a symmetry statement, not a claim of universal physical correctness or a fixed sample-efficiency multiplier.' },
  { id: 'gai-002', statement: 'Hamiltonian parameterizations provide a route to modeling closed-system dynamics with a declared conserved Hamiltonian; conservation must still be measured under the chosen solver and operating regime.', evidenceSourceIds: ['greydanus-2019'], status: 'supported-method-basis', boundary: 'No conservation claim is made for open, driven, dissipative, or misspecified systems without an explicit model.' },
  { id: 'gai-003', statement: 'Learned approximations to Calabi–Yau metrics are a research method for numerical compactification and dimensional-reduction studies, subject to geometric residual and convergence checks.', evidenceSourceIds: ['he-jejjala-mishra-2017', 'villani-2009'], status: 'research-direction', boundary: 'A metric approximation is not a proof of a compactification solution or a phenomenological prediction.' },
]

export function assertGeometricAiReferentialIntegrity(): void {
  const sourceIds = new Set(geometricAiSources.map((source) => source.id))
  const claimIds = new Set<string>()
  for (const claim of geometricAiClaims) {
    if (claimIds.has(claim.id)) throw new Error(`Duplicate geometric AI claim id: ${claim.id}`)
    claimIds.add(claim.id)
    for (const sourceId of claim.evidenceSourceIds) if (!sourceIds.has(sourceId)) throw new Error(`Claim ${claim.id} references missing source ${sourceId}`)
  }
}

assertGeometricAiReferentialIntegrity()
