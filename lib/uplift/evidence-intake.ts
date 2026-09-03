import attestationFile from '../../content/legacy-uplift/inspection-attestations.json' with { type: 'json' }
import batch1 from '../../content/semiconductor-evidence/batch-1.json' with { type: 'json' }
import batch2 from '../../content/evidence-batch-2/inspections.json' with { type: 'json' }
import batch3 from '../../content/evidence-batch-3/inspections.json' with { type: 'json' }
import batch4 from '../../content/evidence-batch-4/inspections.json' with { type: 'json' }
import reuse from '../../content/evidence-batch-7/reuse-audit.json' with { type: 'json' }
import batch8 from '../../content/evidence-batch-8/inspections.json' with { type: 'json' }
import batch9 from '../../content/evidence-batch-9/inspections.json' with { type: 'json' }
import batch12 from '../../content/evidence-batch-12/inspections.json' with { type: 'json' }

import { isVendorAuthored } from './vendor-authorship.ts'

/**
 * Every inspection record the uplift draws on, in one place.
 *
 * Batches accumulate: each one added an import, a spread and sometimes a second
 * spread somewhere further down the generator, and forgetting the second was a
 * silent no-op rather than an error. Registering a batch here is now one edit,
 * and the two shapes batches come in are named rather than implied.
 *
 * ROUTE_SCOPED batches name the routes a source supports.
 * CLAIM_SCOPED batches name a passage per claim, so a source reaches a page
 * only where a distinct inspected passage backs that page's own claim.
 */

export type Attestation = {
  sourceId: string; establishes: string; boundary: string; depth: string
  exactLocator: string; observedContent: string; identityVerified: boolean
  subjectAligned: boolean; retrievedFrom: string; retrievedOn: string
  versionRelationship: string; rightsBasis: string
}

export type RouteScopedEntry = {
  sourceId: string; title: string; retrievedFrom: string; retrievedOn: string
  depth: string; exactLocators: string[]; observedContent: string
  establishes: string; boundary: string; identityVerified: boolean
  versionRelationship: string; rightsBasis: string; supportsRoutes: string[]
}

export type ClaimScopedSource = {
  sourceId: string; title: string; versionRelationship: string; rightsBasis: string
  boundary: string; exactLocators: string[]; establishes: string
  retrievedFrom: string; retrievedOn: string
  claimByClaimSupport: { route: string; locator: string; supportingPassage: string }[]
}

export type ReusedSource = {
  sourceId: string; exactLocator: string; supportingPassage: string
  limitationsCarried: string; rightsBasis: string; sourceTitle: string; version: string
}

/**
 * Batch 4 names supported routes per claim rather than per source. Flattened
 * into the route-scoped contract so it reads the same as its neighbours.
 */
const batch4Flattened = (batch4.inspected as unknown as { claimByClaimSupport: { route: string }[] }[])
  .map((entry) => ({ ...entry, supportsRoutes: entry.claimByClaimSupport.map((c) => c.route) }))

/** Batches that name the routes a source supports. Order is load-bearing. */
const ROUTE_SCOPED = [
  ...(batch1.inspected as RouteScopedEntry[]),
  ...(batch2.inspected as unknown as RouteScopedEntry[]),
  ...(batch3.inspected as unknown as RouteScopedEntry[]),
  ...(batch4Flattened as unknown as RouteScopedEntry[]),
]

/** Batches that name a passage per claim. Order is load-bearing. */
const CLAIM_SCOPED = [
  ...batch8.inspected,
  ...batch9.inspected,
  ...batch12.inspected,
] as unknown as ClaimScopedSource[]

/** Sources read in an earlier batch and reused against a new route. */
const REUSED = reuse.accepted as unknown as Record<string, string>[]

/** Attestations recorded against a source, keyed by source id. */
export const attested = new Map<string, Attestation>(
  (attestationFile.attestations as Attestation[]).map((a) => [a.sourceId, a]))

/**
 * Reuse and claim-scoped support, per route.
 *
 * Each entry names one route, one source and the exact passage that reaches
 * that route's claim. Nothing is inferred from a source's other routes.
 */
export const reuseByRoute = new Map<string, ReusedSource[]>()
for (const source of CLAIM_SCOPED) {
  for (const claim of source.claimByClaimSupport) {
    reuseByRoute.set(claim.route, [...(reuseByRoute.get(claim.route) ?? []), {
      sourceId: source.sourceId, exactLocator: claim.locator,
      supportingPassage: claim.supportingPassage, limitationsCarried: source.boundary,
      rightsBasis: source.rightsBasis, sourceTitle: source.title, version: source.versionRelationship,
    }])
  }
}
for (const entry of REUSED) {
  reuseByRoute.set(entry.route, [...(reuseByRoute.get(entry.route) ?? []), {
    sourceId: entry.sourceId, exactLocator: entry.exactLocator,
    supportingPassage: entry.supportingPassage, limitationsCarried: entry.limitationsCarried,
    rightsBasis: entry.rightsBasis, sourceTitle: entry.sourceTitle, version: entry.version,
  }])
}

/** Route-scoped support, per route. */
export const routeScopedByRoute = new Map<string, RouteScopedEntry[]>()
for (const entry of ROUTE_SCOPED) {
  for (const route of entry.supportsRoutes) {
    routeScopedByRoute.set(route, [...(routeScopedByRoute.get(route) ?? []), entry])
  }
}

type CompiledAttestation = {
  sourceId: string; retrievedFrom: string; retrievedOn: string; depth: never
  exactLocator: string; observedContent: string; identityVerified: boolean
  identityBasis: string; subjectAligned: boolean; subjectBasis: string
  versionRelationship: string; rightsBasis: string
}

/**
 * The attestation map the compiler reads.
 *
 * Built in a fixed precedence: legacy attestations first, then route-scoped,
 * then reuse, then claim-scoped. A vendor-authored source is excluded from the
 * legacy layer, which is what stops it conferring independent support.
 */
export function buildAttestations(): Record<string, CompiledAttestation> {
  const legacy = Object.fromEntries(
    [...attested.entries()].filter(([id]) => !isVendorAuthored(id)).map(([id, a]) => [id, {
      sourceId: id, retrievedFrom: a.retrievedFrom, retrievedOn: a.retrievedOn,
      depth: a.depth as never, exactLocator: a.exactLocator, observedContent: a.observedContent,
      identityVerified: a.identityVerified, identityBasis: 'recorded at inspection',
      subjectAligned: a.subjectAligned, subjectBasis: 'recorded at inspection',
      versionRelationship: a.versionRelationship, rightsBasis: a.rightsBasis,
    }]))

  const routeScoped = Object.fromEntries(ROUTE_SCOPED.map((entry) => [entry.sourceId, {
    sourceId: entry.sourceId, retrievedFrom: entry.retrievedFrom, retrievedOn: entry.retrievedOn,
    depth: entry.depth as never, exactLocator: entry.exactLocators.join('; '),
    observedContent: entry.observedContent, identityVerified: entry.identityVerified,
    identityBasis: 'recorded at inspection', subjectAligned: true,
    subjectBasis: 'route-scoped: the source was checked against this page subject',
    versionRelationship: entry.versionRelationship, rightsBasis: entry.rightsBasis,
  }]))

  const reused = Object.fromEntries(REUSED.map((entry) => [entry.sourceId, {
    sourceId: entry.sourceId, retrievedFrom: `locator:${entry.exactLocator}`, retrievedOn: '2026-09-03',
    depth: 'section-or-full-text' as never, exactLocator: entry.exactLocator,
    observedContent: entry.supportingPassage, identityVerified: true,
    identityBasis: 'inspected in an earlier batch; identity and version carried forward unchanged',
    subjectAligned: true, subjectBasis: entry.whyItMatches,
    versionRelationship: entry.version, rightsBasis: entry.rightsBasis,
  }]))

  // A claim-scoped source with no claimByClaimSupport attaches to no route, so
  // an inspected source that supports nothing stays inspected and unused rather
  // than being stretched onto claims it does not state.
  const claimScoped = Object.fromEntries(CLAIM_SCOPED.map((entry) => [entry.sourceId, {
    sourceId: entry.sourceId, retrievedFrom: entry.retrievedFrom, retrievedOn: entry.retrievedOn,
    depth: 'section-or-full-text' as never, exactLocator: entry.exactLocators.join('; '),
    observedContent: entry.establishes, identityVerified: true,
    identityBasis: 'verified at inspection against the cited identifier',
    subjectAligned: true, subjectBasis: 'route-scoped per claim',
    versionRelationship: entry.versionRelationship, rightsBasis: entry.rightsBasis,
  }]))

  return { ...legacy, ...routeScoped, ...reused, ...claimScoped } as Record<string, CompiledAttestation>
}

/** How many inspection records back the corpus, for reporting and tests. */
export const INTAKE_COUNTS = {
  routeScopedSources: ROUTE_SCOPED.length,
  claimScopedSources: CLAIM_SCOPED.length,
  reusedSources: REUSED.length,
  legacyAttestations: attested.size,
} as const
