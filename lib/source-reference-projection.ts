import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { getActiveEpistemicCanonicalReleases } from './public-epistemic-releases.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'
import { evaluateSourcePage, GOVERNANCE_MODEL, INFORMATION_DIMENSIONS, type BoundClaim } from './source-evidence-reference.ts'
import contracts from '../content/source-first/pilot-contracts.json' with { type: 'json' }
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }

/**
 * Projects a source page from the releases that are active right now.
 *
 * The contract file says which sources were eligible when it was generated. It
 * is not permission to render: eligibility is re-derived here against live
 * active releases every time, so a withdrawal removes the claim it carried and
 * a page that loses a required claim stops resolving.
 *
 * That is the whole of Model A. The page owns nothing. Everything it displays
 * belongs to a released record, and when the record goes the text goes with it,
 * in the same act rather than at the next rebuild.
 */

export const SOURCE_PROJECTION_VERSION = 'maha-source-reference-projection/1.0' as const
export const SOURCE_ROUTE_PREFIX = '/knowledge/sources' as const

export const SOURCE_PROJECTION_NOTICE =
  'This page is a projection of Maha canonical record releases about one source. It is not a separately certified source assessment, not an independent review, and not a replication. Every finding below is carried from a released record and disappears from this page when that record is withdrawn.'

export interface SourceReferencePage {
  slug: string
  route: string
  sourceId: string
  title: string
  authors: readonly string[]
  publisher: string | null
  publishedAt: string | null
  versionInspected: string
  rightsBasis: string
  researchQuestion: string
  evidenceType: string
  inspectedLocators: readonly string[]
  findings: readonly { statement: string; recordId: string; recordRoute: string; locator: string }[]
  doesNotEstablish: readonly string[]
  limitations: readonly string[]
  relatedReleasedRecords: readonly { recordId: string; route: string }[]
  bridges: readonly { bridgeId: string; targetRecordId: string; bridgeType: string }[]
  provenanceDigest: string
  projectionNotice: string
}

export function sourceSlug(sourceId: string): string {
  return sourceId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

type InventoryEntry = (typeof inventory.sources)[number]
const bySlug = new Map<string, InventoryEntry>(
  (inventory.sources as InventoryEntry[]).map((entry) => [sourceSlug(entry.sourceId), entry]),
)
/** The slugs a contract was written for. Necessary, never sufficient. */
const contracted = new Set((contracts.contracts as { sourceId: string }[]).map((entry) => sourceSlug(entry.sourceId)))

/**
 * Builds the page, or refuses.
 *
 * Returns null rather than a smaller page. A source that loses one required
 * claim does not render the rest: an aggregate quietly disagreeing with its
 * records is worse than an aggregate that is gone, because a reader can see the
 * second happen.
 */
export async function projectSourceReference(
  slug: string,
  releases?: readonly Awaited<ReturnType<typeof getActiveEpistemicCanonicalReleases>>[number][],
): Promise<SourceReferencePage | null> {
  const entry = bySlug.get(slug)
  if (!entry || !contracted.has(slug)) return null

  // Injectable only so the refusal behaviour can be exercised without a
  // database. Production always takes the live path, so a page can never be
  // rendered from anything but the releases that are active at request time.
  const active = releases ?? await getActiveEpistemicCanonicalReleases()
  const activeByRecord = new Map(active.map((release) => [release.recordId, release]))

  // Every bound record must still be released, and at the revision the page was
  // built against. A superseding release changes the digest, so the claim is
  // re-read from the new snapshot rather than assumed unchanged.
  const claims: BoundClaim[] = entry.boundRecords.map((bound) => {
    const release = activeByRecord.get(bound.recordId)
    return {
      recordId: bound.recordId,
      revisionSha256: bound.revisionSha256,
      activeRelease: Boolean(release),
      locator: bound.locator,
      statement: release
        ? String((release.recordSnapshot.claims ?? [])[0]?.statement ?? bound.statement)
        : bound.statement,
    }
  })

  const verdict = evaluateSourcePage(
    {
      sourceId: entry.sourceId,
      identityVerified: !entry.identityConflicted,
      inspectionDepth: entry.inspectionDepth as never,
      exactLocators: entry.exactLocators,
      rightsBasis: entry.rightsBasis,
      claims,
      satisfies: [...INFORMATION_DIMENSIONS],
      route: `${SOURCE_ROUTE_PREFIX}/${slug}`,
      searchIntent: entry.candidateSearchIntent,
      alignmentMismatch: entry.identityConflicted,
    },
    new Set(), new Set(), new Set(),
  )
  if (!verdict.eligible) return null

  const released = claims.filter((claim) => claim.activeRelease)
  const findings = released.map((claim) => ({
    statement: claim.statement,
    recordId: claim.recordId,
    recordRoute: activeByRecord.get(claim.recordId)!.canonicalPath,
    locator: claim.locator,
  }))
  const bridges = released.flatMap((claim) =>
    ((activeByRecord.get(claim.recordId)!.recordSnapshot.bridges ?? []) as unknown as Record<string, string>[])
      .map((bridge) => ({ bridgeId: String(bridge.bridgeId), targetRecordId: String(bridge.targetRecordId), bridgeType: String(bridge.bridgeType) })))

  const body = {
    slug,
    route: `${SOURCE_ROUTE_PREFIX}/${slug}`,
    sourceId: entry.sourceId,
    title: entry.title,
    authors: entry.authors,
    publisher: entry.publisher,
    publishedAt: entry.publishedAt,
    versionInspected: entry.versionRelationship,
    rightsBasis: entry.rightsBasis,
    researchQuestion: `What ${entry.title} investigates, and what Maha records released against it establish.`,
    evidenceType: entry.inspectionDepth === 'section-or-full-text' ? 'section or full-text inspection of the cited source' : 'not inspected beyond metadata',
    inspectedLocators: entry.exactLocators,
    findings,
    doesNotEstablish: [
      'Independent replication of any result reported by the source.',
      'Any claim from a Maha record that is not currently released.',
      'Endorsement, peer review or expert consensus by Maha.',
    ],
    limitations: [
      'A projection of released record claims. It adds no finding of its own.',
      'Inspection reached the locators listed above and no further.',
    ],
    relatedReleasedRecords: released.map((claim) => ({
      recordId: claim.recordId,
      route: activeByRecord.get(claim.recordId)!.canonicalPath,
    })),
    bridges,
    projectionNotice: SOURCE_PROJECTION_NOTICE,
  }
  return {
    ...body,
    provenanceDigest: `sha256:${createHash('sha256').update(canonicalJson({ ...body, projectionNotice: undefined }), 'utf8').digest('hex')}`,
  }
}

/** Every slug that resolves right now. Recomputed, never cached. */
export async function eligibleSourceSlugs(
  releases?: readonly Awaited<ReturnType<typeof getActiveEpistemicCanonicalReleases>>[number][],
): Promise<readonly string[]> {
  const active = releases ?? await getActiveEpistemicCanonicalReleases()
  const resolved: string[] = []
  for (const slug of [...contracted].sort()) {
    if (await projectSourceReference(slug, active)) resolved.push(slug)
  }
  return resolved
}

/** The slugs a contract exists for. Necessary for a page, never sufficient. */
export const CONTRACTED_SOURCE_SLUGS: readonly string[] = [...contracted].sort()

export const SOURCE_GOVERNANCE = GOVERNANCE_MODEL
export { epistemicRecordPath }
