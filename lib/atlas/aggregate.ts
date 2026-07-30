import { atlasCatalog } from './catalog'
import { assertGeometricAiReferentialIntegrity } from './geometric-ai'
import { assertHolographicQecReferentialIntegrity } from './holographic-qec'
import { assertLandscapeOptReferentialIntegrity } from './landscape-opt'

export const atlasAggregate = {
  modules: [atlasCatalog.geometricAi, atlasCatalog.holographicQec, atlasCatalog.landscapeOpt],
  claimCount: atlasCatalog.geometricAi.claims.length + atlasCatalog.holographicQec.claims.length + atlasCatalog.landscapeOpt.claims.length,
  sourceCount: atlasCatalog.geometricAi.sources.length + atlasCatalog.holographicQec.sources.length + atlasCatalog.landscapeOpt.sources.length,
} as const

assertGeometricAiReferentialIntegrity()
assertHolographicQecReferentialIntegrity()
assertLandscapeOptReferentialIntegrity()
