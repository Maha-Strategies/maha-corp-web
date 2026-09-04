import statusFile from '../content/legacy-uplift/evidence-status-public.json' with { type: 'json' }

import type { EvidenceStatusDisclosure } from './evidence-status-disclosure.ts'

/**
 * The evidence status a route may render.
 *
 * Reads the sanitised public file, never the audit artifacts. A route with no
 * entry resolves to null and renders nothing, so a page outside the uplift is
 * unaffected rather than showing an empty banner.
 */
export interface EvidenceStatusRender extends EvidenceStatusDisclosure {
  route: string
}

const byRoute = new Map<string, EvidenceStatusRender>(
  (statusFile.entries as EvidenceStatusRender[]).map((e) => [e.route, e]))

export function evidenceStatusFor(route: string): EvidenceStatusRender | null {
  return byRoute.get(route) ?? null
}

export const EVIDENCE_STATUS_COUNTS = statusFile.counts as Record<string, number>
