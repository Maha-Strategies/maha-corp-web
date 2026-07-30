import { geometricAiClaims, geometricAiSources, GEOMETRIC_AI_ATLAS_URL } from './geometric-ai'
import { holographicQecClaims, holographicQecSources, HOLOGRAPHIC_QEC_ATLAS_URL } from './holographic-qec'
import { landscapeClaims, landscapeSources, LANDSCAPE_OPT_ATLAS_URL } from './landscape-opt'

export const atlasCatalog = {
  geometricAi: { id: 'geometric-ai', title: 'Geometric AI & Symmetry-Aware Neural Networks', url: GEOMETRIC_AI_ATLAS_URL, claims: geometricAiClaims, sources: geometricAiSources },
  holographicQec: { id: 'holographic-qec', title: 'Holographic Quantum Error Correction Compilers', url: HOLOGRAPHIC_QEC_ATLAS_URL, claims: holographicQecClaims, sources: holographicQecSources },
  landscapeOpt: { id: 'landscape-opt', title: 'High-Dimensional Landscape Optimization Solvers', url: LANDSCAPE_OPT_ATLAS_URL, claims: landscapeClaims, sources: landscapeSources },
} as const
