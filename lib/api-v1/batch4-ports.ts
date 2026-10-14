import type { MicroProductId } from '../x402/micro-contracts.ts'
import type { Domain } from './types.ts'
export const FOURTH_BATCH_LEGACY_PORTS = [
  ['spending-variance-bridge', 'compute', 'public-finance', 'variance-bridge'],
  ['transparency-hash-chain-verification', 'verify', 'public-finance', 'hash-chain'],
  ['public-filing-amendment-resolver', 'verify', 'public-finance', 'filing-amendments'],
  ['angular-separation-batch', 'celestial', 'geometry', 'angular-separations'],
  ['observing-window-planner', 'celestial', 'observations', 'sampled-windows'],
  ['terrain-profile-arithmetic', 'compute', 'terrain', 'profile-arithmetic'],
  ['edition-locator-alignment', 'library', 'editions', 'locator-alignment'],
  ['manuscript-release-diff', 'library', 'editions', 'release-diff'],
] as const satisfies readonly (readonly [MicroProductId, Domain, string, string])[]
export const FOURTH_BATCH_BOOK_PORTS = [
  ['volcano-concept-evidence-pack', 'library', 'the-volcanic-engine', 'concept-pack'],
  ['cross-book-concept-pack', 'library', 'books', 'cross-book-concepts'],
  ['book-reading-pack-the-maha-principle', 'library', 'the-maha-principle', 'reading-pack'],
] as const
