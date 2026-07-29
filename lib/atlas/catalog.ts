import { geometricAiClaims, geometricAiSources, GEOMETRIC_AI_ATLAS_URL } from './geometric-ai'
import { holographicQecClaims, holographicQecSources, HOLOGRAPHIC_QEC_ATLAS_URL } from './holographic-qec'

export const atlasCatalog = {
  geometricAi: { id: 'geometric-ai', title: 'Geometric AI & Symmetry-Aware Neural Networks', url: GEOMETRIC_AI_ATLAS_URL, claims: geometricAiClaims, sources: geometricAiSources },
  holographicQec: { id: 'holographic-qec', title: 'Holographic Quantum Error Correction Compilers', url: HOLOGRAPHIC_QEC_ATLAS_URL, claims: holographicQecClaims, sources: holographicQecSources },
} as const
