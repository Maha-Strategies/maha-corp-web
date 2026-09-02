import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import cascade from '../content/release-cascade/cascade-model.json' with { type: 'json' }
import canary from '../content/release-cascade/canary-manifest.json' with { type: 'json' }
import remainder from '../content/release-cascade/remainder-manifest.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import candidates from '../content/source-first/record-candidates.json' with { type: 'json' }
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import {
  CONTRACTED_SOURCE_SLUGS, SOURCE_PROJECTION_NOTICE, SOURCE_ROUTE_PREFIX,
  eligibleSourceSlugs, projectSourceReference, sourceSlug,
} from '../lib/source-reference-projection.ts'

const ROOT = resolve(import.meta.dirname, '..')

/** A synthetic active release for one bound record of a contracted source. */
type Release = { recordId: string; canonicalPath: string; recordSnapshot: Record<string, unknown> }
const sourceFor = (slug: string) =>
  (inventory.sources as { sourceId: string; boundRecords: { recordId: string }[] }[])
    .find((entry) => sourceSlug(entry.sourceId) === slug)!
const releasesFor = (slug: string, drop: string[] = []): Release[] =>
  sourceFor(slug).boundRecords.filter((bound) => !drop.includes(bound.recordId)).map((bound) => ({
    recordId: bound.recordId,
    canonicalPath: `/knowledge/x/${bound.recordId.split(':').pop()}`,
    recordSnapshot: { claims: [{ statement: 'a released claim' }], bridges: [] },
  }))

const SLUG = CONTRACTED_SOURCE_SLUGS[0]

/* --- projection freshness -------------------------------------------------- */

test('a fully released source renders, and states it is a projection', async () => {
  const page = await projectSourceReference(SLUG, releasesFor(SLUG) as never)
  assert.ok(page, 'a fully released source must resolve')
  assert.equal(page.projectionNotice, SOURCE_PROJECTION_NOTICE)
  assert.match(page.projectionNotice, /not a separately certified source assessment, not an independent review/)
  assert.equal(page.route, `${SOURCE_ROUTE_PREFIX}/${SLUG}`)
  assert.match(page.provenanceDigest, /^sha256:[0-9a-f]{64}$/)
  assert.ok(page.findings.length >= 2)
  assert.ok(page.doesNotEstablish.length > 0 && page.limitations.length > 0)
})

test('withdrawing any underlying record refuses the whole page', async () => {
  for (const bound of sourceFor(SLUG).boundRecords) {
    const page = await projectSourceReference(SLUG, releasesFor(SLUG, [bound.recordId]) as never)
    assert.equal(page, null, `withdrawing ${bound.recordId} must refuse the aggregate, not shrink it`)
  }
})

test('a source page cannot outlive all of its released records', async () => {
  assert.equal(await projectSourceReference(SLUG, [] as never), null)
  assert.deepEqual(await eligibleSourceSlugs([] as never), [])
})

test('source metadata alone cannot keep a page public', async () => {
  // The inventory entry still exists in full; only the releases are gone.
  assert.ok(sourceFor(SLUG).boundRecords.length > 0)
  assert.equal(await projectSourceReference(SLUG, [] as never), null)
})

test('superseding replaces the claim text rather than keeping the prior revision', async () => {
  const superseded = releasesFor(SLUG).map((release) => ({
    ...release, recordSnapshot: { claims: [{ statement: 'the superseding statement' }], bridges: [] },
  }))
  const page = await projectSourceReference(SLUG, superseded as never)
  assert.ok(page)
  for (const finding of page.findings) assert.equal(finding.statement, 'the superseding statement')
})

test('an uncontracted slug never resolves, however many releases exist', async () => {
  assert.equal(await projectSourceReference('not-a-contracted-source', releasesFor(SLUG) as never), null)
})

test('the route is rendered per request, not cached', () => {
  const route = readFileSync(resolve(ROOT, 'app/knowledge/sources/[slug]/page.tsx'), 'utf8')
  assert.match(route, /export const dynamic = 'force-dynamic'/)
  assert.match(route, /notFound\(\)/)
  assert.ok(!/revalidate\s*=/.test(route), 'a revalidate window would let a withdrawn claim survive')
  // The same live read decides listing, so a page cannot linger in the sitemap.
  const sitemap = readFileSync(resolve(ROOT, 'app/sitemap.ts'), 'utf8')
  assert.match(sitemap, /eligibleSourceSlugs\(\)/)
  assert.match(sitemap, /export const dynamic = 'force-dynamic'/)
})

/* --- positional-legacy safety --------------------------------------------- */

test('five records sharing one source do not create an eligible aggregate', () => {
  const fiveRecord = (inventory.sources as { boundRecords: unknown[]; sourceId: string }[])
    .filter((entry) => entry.boundRecords.length === 5)
  assert.equal(fiveRecord.length, 40, 'the positional groups')
  const contracted = new Set(CONTRACTED_SOURCE_SLUGS)
  const eligibleFive = fiveRecord.filter((entry) => contracted.has(sourceSlug(entry.sourceId)))
  assert.ok(eligibleFive.length < fiveRecord.length,
    'co-assignment to one source must not by itself make a page')
})

test('a mismatched or shallow source is refused however released its records', async () => {
  const blocked = (inventory.sources as { sourceId: string; inspectionDepth: string; identityConflicted: boolean }[])
    .filter((entry) => entry.identityConflicted || entry.inspectionDepth !== 'section-or-full-text')
  assert.ok(blocked.length > 0)
  for (const entry of blocked) {
    assert.ok(!CONTRACTED_SOURCE_SLUGS.includes(sourceSlug(entry.sourceId)),
      `${entry.sourceId} is mismatched or shallow yet contracted`)
  }
})

/* --- cascade honesty ------------------------------------------------------- */

test('the cascade is computed from dependency sets, not assumed', () => {
  assert.equal(cascade.releaseReadyCount, 33)
  assert.equal(cascade.directRoutesUnlocked, 33)
  // The finding that matters: none of the 33 completes a source set.
  assert.equal(cascade.sourcePagesUnlocked, 0)
  for (const entry of cascade.cascade as { sourceSetRemaining: number | null; completesSourceAggregate: boolean }[]) {
    if (entry.completesSourceAggregate) assert.equal(entry.sourceSetRemaining, 0)
    if (entry.sourceSetRemaining !== 0) assert.equal(entry.completesSourceAggregate, false)
  }
})

test('the canary is five records over at least three domains, unexecuted', () => {
  assert.equal(canary.cohortSize, 5)
  assert.ok((canary.domains as string[]).length >= 3)
  assert.equal(canary.released, false)
  assert.equal(canary.executed, false)
  assert.equal((canary.tier as { humanReviewed: boolean }).humanReviewed, false)
  assert.match(canary.releaseAuthority, /separate/)
  for (const entry of canary.canary as { alignmentClear: boolean; reviewAxes: unknown[] }[]) {
    assert.equal(entry.alignmentClear, true)
    assert.equal(entry.reviewAxes.length, 5)
  }
})

test('canary and remainder partition the 33 exactly once', () => {
  const ids = [...(canary.canary as { recordId: string }[]), ...(remainder.remainder as { recordId: string }[])]
    .map((entry) => entry.recordId)
  assert.equal(ids.length, 33)
  assert.equal(new Set(ids).size, 33, 'no record counted twice')
  assert.equal(remainder.cohortSize, 28)
  assert.equal(remainder.released, false)
})

/* --- public boundary ------------------------------------------------------- */

test('the capacity model separates deployed from prepared', () => {
  assert.equal(capacity.cascade.currentProductionRoutes, 764)
  assert.equal(capacity.cascade.routesAfterSourcePagesDeploy, 772)
  assert.equal(capacity.cascade.sourcePagesUnlockedByAll33, 0)
  assert.equal(capacity.cascade.privateCandidatesExcludedFromPublicTotals, true)
  assert.equal(capacity.crawlable, 764, 'nothing is reachable until deployment')
})

test('private candidates never appear on a route, sitemap or llms surface', async () => {
  const slugs = CONTRACTED_SOURCE_SLUGS
  for (const candidate of candidates.candidates as { slug: string }[]) {
    assert.ok(!slugs.includes(candidate.slug), `${candidate.slug} is a private candidate yet contracted`)
    assert.equal(await projectSourceReference(candidate.slug, releasesFor(SLUG) as never), null)
  }
})

test('no private inspection or reviewer material reaches the rendered route', () => {
  const route = readFileSync(resolve(ROOT, 'app/knowledge/sources/[slug]/page.tsx'), 'utf8')
  const lib = readFileSync(resolve(ROOT, 'lib/source-reference-projection.ts'), 'utf8')
  for (const [pattern, label] of [
    [/reviewerId|displayName|authorityId|packetDigest/, 'reviewer or authority identity'],
    [/reject-or-hold|review packet|audit corpus/i, 'private reviewer vocabulary'],
    [/attemptedRoutes|remediationDigest|boundedPassage/, 'private inspection packet field'],
    [/VERCEL_TOKEN|SUPABASE_ACCESS_TOKEN|EPISTEMIC_RELEASE_AUTHORITY/, 'credential name'],
  ] as [RegExp, string][]) {
    assert.ok(!pattern.test(route), `the route contains ${label}`)
    assert.ok(!pattern.test(lib), `the projection contains ${label}`)
  }
})

test('structured data claims no rating, endorsement or review', () => {
  const route = readFileSync(resolve(ROOT, 'app/knowledge/sources/[slug]/page.tsx'), 'utf8')
  assert.match(route, /'@type': 'ScholarlyArticle'/)
  for (const forbidden of ['aggregateRating', 'reviewRating', 'Review', 'endorse', 'ratingValue']) {
    assert.ok(!route.includes(forbidden), `structured data must not include ${forbidden}`)
  }
  assert.match(route, /citation:/)
})

test('regenerating produces byte-identical artifacts', () => {
  const files = ['content/release-cascade/cascade-model.json', 'content/release-cascade/canary-manifest.json',
    'content/release-cascade/remainder-manifest.json', 'content/scaling/capacity-model.json']
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-release-cascade.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-scaling-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})
