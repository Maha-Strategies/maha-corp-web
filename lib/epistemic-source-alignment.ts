import type { EpistemicRecord, EpistemicSource } from './epistemic-schema.ts'

export type SourceClaimAlignment = 'aligned-by-structure' | 'declared-partial' | 'declared-mismatch'

const DECLARED_MISMATCH = [
  /no (?:supporting )?passage (?:was )?(?:located|retrievable)/i,
  /could not be matched/i,
  /does not establish (?:the|this|either|which|whether)/i,
  /do not establish (?:the|this|either|which|whether)/i,
  /not a matching source/i,
  /does not support (?:the|this|its)/i,
]

const DECLARED_PARTIAL = [
  /only partially/i,
  /partial mismatch/i,
  /extends beyond/i,
  /does not establish the complete/i,
  /supports .* but not/i,
  /must (?:be )?(?:narrowed|reviewed|re-sourced|replaced)/i,
]

export const SOURCE_ALIGNMENT_BLOCKER_PREFIX = 'source-claim-alignment-mismatch:' as const

export function sourceClaimAlignment(source: EpistemicSource): SourceClaimAlignment {
  const text = `${source.exactLocator}\n${source.establishes}\n${source.boundary}`
  if (DECLARED_MISMATCH.some((pattern) => pattern.test(text))) return 'declared-mismatch'
  if (DECLARED_PARTIAL.some((pattern) => pattern.test(text))) return 'declared-partial'
  return 'aligned-by-structure'
}

export function sourceAlignmentBlockerCode(sourceId: string): string {
  return `${SOURCE_ALIGNMENT_BLOCKER_PREFIX}${sourceId}`
}

export function sourceAlignmentBlockers(record: EpistemicRecord): string[] {
  const linked = new Set(record.claims.flatMap((claim) => claim.sourceIds))
  return record.sources
    .filter((source) => linked.has(source.id) && sourceClaimAlignment(source) === 'declared-mismatch')
    .map((source) => sourceAlignmentBlockerCode(source.id))
    .sort()
}

