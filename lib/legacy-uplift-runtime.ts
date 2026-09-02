import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

import { UPLIFT_VERSION } from './legacy-knowledge-uplift.ts'

/**
 * The uplift a route is allowed to render.
 *
 * Only pages the compiler passed appear here. A blocked page resolves to null
 * and renders exactly what it rendered before, so a failed gate is invisible
 * to the reader rather than showing as a gap.
 */

export interface RuntimeSection {
  dimension: string
  heading: string
  items: readonly string[]
  sourceIds: readonly string[]
}

export interface RuntimeUplift {
  route: string
  family: string
  sections: readonly RuntimeSection[]
  dimensionCount: number
  upliftDigest: string
}

type CompiledPage = {
  route: string; family: string; slug: string; eligible: boolean
  sections?: RuntimeSection[]
  after: { dimensionCount: number } | null
  upliftDigest: string
}

const byRoute = new Map<string, RuntimeUplift>()
for (const page of compiled.pages as unknown as CompiledPage[]) {
  if (!page.eligible || !page.after) continue
  byRoute.set(page.route, {
    route: page.route, family: page.family,
    sections: page.sections ?? [],
    dimensionCount: page.after.dimensionCount,
    upliftDigest: page.upliftDigest,
  })
}

export function upliftFor(route: string): RuntimeUplift | null {
  return byRoute.get(route) ?? null
}

export function upliftedRoutes(): readonly string[] {
  return [...byRoute.keys()].sort()
}

export const UPLIFT_RUNTIME_VERSION = UPLIFT_VERSION
