import publicFirstParty from '../content/evidence-batch-5/first-party-public.json' with { type: 'json' }

import { FIRST_PARTY_DISCLOSURE } from './first-party-evidence.ts'

/**
 * First-party documentation a supplier route may render.
 *
 * Only eligible entries appear. A refused supplier resolves to null and its
 * page renders exactly as before, so a failed gate is invisible rather than
 * showing as a gap.
 */

export interface FirstPartyRender {
  route: string
  organisation: string
  documentTitle: string
  documentKind: string
  url: string
  exactLocator: string
  publishedOrVersion: string
  inspectedOn: string
  establishes: string
  doesNotEstablish: string
  disclosure: string
}

type Entry = {
  route: string; organisation: string; documentTitle: string
  documentKind: string; url: string; exactLocator: string
  publishedOrVersion: string; inspectedOn: string
  establishes: string; doesNotEstablish: string
}

// Reads the sanitized projection. The private record is never imported here,
// because a runtime import inlines the whole file into the served chunk.
const byRoute = new Map<string, FirstPartyRender>()
for (const entry of publicFirstParty.entries as Entry[]) {
  byRoute.set(entry.route, {
    route: entry.route,
    organisation: entry.organisation,
    documentTitle: entry.documentTitle,
    documentKind: entry.documentKind,
    url: entry.url,
    exactLocator: entry.exactLocator,
    publishedOrVersion: entry.publishedOrVersion,
    inspectedOn: entry.inspectedOn,
    establishes: entry.establishes,
    doesNotEstablish: entry.doesNotEstablish,
    disclosure: FIRST_PARTY_DISCLOSURE,
  })
}

export function firstPartyFor(route: string): FirstPartyRender | null {
  return byRoute.get(route) ?? null
}

export function firstPartyRoutes(): readonly string[] {
  return [...byRoute.keys()].sort()
}
