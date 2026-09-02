import { upliftFor } from './legacy-uplift-runtime.ts'

/**
 * What a family index may say about its children.
 *
 * An index that counts every child as covered implies the blocked ones are
 * evidence-verified too. So the summary is built only from children that
 * passed the gate, and the count of those that did not is stated rather than
 * hidden: a reader can see that a family is partly verified without being told
 * which way by omission.
 */

export interface IndexSummary {
  familyRoute: string
  totalChildren: number
  verifiedChildren: number
  unverifiedChildren: number
  /** Only these may be presented as evidence-backed. */
  verifiedRoutes: readonly string[]
  disclosure: string
}

export function summariseFamily(familyRoute: string, childRoutes: readonly string[]): IndexSummary {
  const verified = childRoutes.filter((route) => upliftFor(route) !== null)
  const unverified = childRoutes.length - verified.length
  return {
    familyRoute,
    totalChildren: childRoutes.length,
    verifiedChildren: verified.length,
    unverifiedChildren: unverified,
    verifiedRoutes: [...verified].sort(),
    disclosure: unverified === 0
      ? `All ${childRoutes.length} pages in this family carry claim-level sources with declared boundaries.`
      : `${verified.length} of ${childRoutes.length} pages in this family carry claim-level sources with declared boundaries. The remaining ${unverified} are published but not evidence-verified, and are not summarised here.`,
  }
}
