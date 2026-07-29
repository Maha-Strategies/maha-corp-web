import { atlasCatalog } from './catalog'
import { assertGeometricAiReferentialIntegrity } from './geometric-ai'
import { assertHolographicQecReferentialIntegrity } from './holographic-qec'

export const atlasAggregate = {
  modules: [atlasCatalog.geometricAi, atlasCatalog.holographicQec],
  claimCount: atlasCatalog.geometricAi.claims.length + atlasCatalog.holographicQec.claims.length,
  sourceCount: atlasCatalog.geometricAi.sources.length + atlasCatalog.holographicQec.sources.length,
} as const

assertGeometricAiReferentialIntegrity()
assertHolographicQecReferentialIntegrity()
