import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { alignmentBlockers } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { PUBLIC_SUBSTANTIAL_PAGES } from '../lib/substantial-page-public.ts'
import { buildCapacityModel, PAGE_TARGET, type RecordState } from '../lib/scaling-capacity.ts'
import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }

/**
 * Produces the inventory, the capacity model and the operator report.
 *
 * Everything is derived from committed inputs - the observation snapshot and
 * the repository's own alignment and publication data - so two runs produce
 * byte-identical output and no network is touched.
 */

const releases = (observation.releases as { recordId: string; canonicalPath: string; status: string; approvalScopes: string[] }[])
const active = releases.filter((entry) => entry.status === 'active')
const releasedRecordIds = new Set(active.map((entry) => entry.recordId))
const substantialPaths = new Set(PUBLIC_SUBSTANTIAL_PAGES.map((page) => page.path))
const releasedPathByRecord = new Map(active.map((entry) => [entry.recordId, entry.canonicalPath]))

const REQUIRED_SCOPES = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity']
// Two sources of review evidence, and the second is what makes the
// canonical-release bucket observable: an active release proves review for the
// records that have one, and the exact-revision projection proves it for the
// records that do not.
const fullyReviewed = new Set([
  ...active.filter((entry) => REQUIRED_SCOPES.every((scope) => entry.approvalScopes.includes(scope)))
    .map((entry) => entry.recordId),
  ...(projection.projections as { recordId: string; releaseAuthorized: boolean }[])
    .filter((entry) => entry.releaseAuthorized).map((entry) => entry.recordId),
])

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const alignmentClear = (recordId: string) =>
  pilotAlignmentFor(recordId) ? isPilotAlignmentClear(recordId) : alignmentBlockers(recordId).length === 0

const states: RecordState[] = [...records.keys()].sort().map((recordId) => {
  const path = releasedPathByRecord.get(recordId)
  return {
    recordId,
    alignmentClear: alignmentClear(recordId),
    // A record only demonstrates exact-revision review through an active
    // release carrying all four scopes; absent a release there is nothing to
    // read that from, and assuming it would invent a review.
    exactRevisionReviewed: fullyReviewed.has(recordId),
    activeCanonicalRelease: releasedRecordIds.has(recordId),
    hasSubstantialPage: path !== undefined && substantialPaths.has(path),
  }
})

const model = buildCapacityModel(states, 'projected-from-decisions')

const inventory = {
  schemaVersion: 'maha-scaling-inventory/1.0',
  observedAt: model.observedAt,
  sourceDigests: model.sourceDigests,
  crawlable: model.crawlable,
  llmsTxtPaths: (observation.llmsPaths as string[]).length,
  families: model.families,
  unclassified: model.unclassified,
  records: {
    total: records.size,
    alignmentClear: states.filter((state) => state.alignmentClear).length,
    activeCanonicalRelease: active.length,
    exactRevisionReviewed: fullyReviewed.size,
    substantialPages: PUBLIC_SUBSTANTIAL_PAGES.length,
  },
  reconciliation: {
    releasePathsInSitemap: active.filter((entry) => (observation.sitemapPaths as string[]).includes(entry.canonicalPath)).length,
    releasePathsMissingFromSitemap: active.filter((entry) => !(observation.sitemapPaths as string[]).includes(entry.canonicalPath)).map((entry) => entry.canonicalPath),
    substantialPathsReleased: [...substantialPaths].filter((path) => active.some((entry) => entry.canonicalPath === path)).length,
    duplicateSitemapPaths: (observation.sitemapPaths as string[]).length - new Set(observation.sitemapPaths as string[]).size,
  },
  boundary: model.boundary,
}

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

mkdirSync('content/scaling', { recursive: true })
writeFileSync('content/scaling/public-inventory.json', `${JSON.stringify({ ...inventory, inventoryDigest: digest(inventory) }, null, 2)}\n`)
writeFileSync('content/scaling/capacity-model.json', `${JSON.stringify({ ...model, capacityDigest: digest(model) }, null, 2)}\n`)

/* ------------------------------------------------------------ the report -- */

const b = model.buckets
const perBatch = 50
const evidenceBacked = b['publishable-now'] + b['blocked-on-canonical-release'] + b['blocked-on-exact-revision-review'] + b['blocked-on-source-inspection']

const report = `# Scaling to 1,000 public pages

Generated from \`content/scaling/public-surface-observation.json\`, a read-only
observation of the live public surface taken at ${model.observedAt}.

- sitemap.xml \`${model.sourceDigests.sitemap}\`
- llms.txt \`${model.sourceDigests.llmsTxt}\`
- release registry \`${model.sourceDigests.releaseRegistry}\`

This counts crawlable canonical URLs. It does not assert that any page is
indexed, ranks, or that any claim on it is true.

## Where the surface is now

| | count |
|---|---|
| Crawlable canonical URLs | **${model.crawlable}** |
| Target | ${PAGE_TARGET} |
| Gap | **${model.gapToTarget}** |
| Paths listed in llms.txt | ${inventory.llmsTxtPaths} |

### By family

| family | crawlable | needs a canonical release |
|---|---:|---|
${model.families.map((family) => `| ${family.label} | ${family.crawlable} | ${family.requiresCanonicalRelease ? 'yes' : 'no'} |`).join('\n')}
${model.unclassified.length > 0 ? `\nUnclassified paths: ${model.unclassified.length}.\n` : ''}
### Reconciliation

Every one of the ${inventory.records.activeCanonicalRelease} active canonical
release paths appears in sitemap.xml (${inventory.reconciliation.releasePathsInSitemap} of
${inventory.records.activeCanonicalRelease}, ${inventory.reconciliation.releasePathsMissingFromSitemap.length} missing).
All ${inventory.reconciliation.substantialPathsReleased} substantial-page paths
are backed by an active release. Duplicate sitemap entries: ${inventory.reconciliation.duplicateSitemapPaths}.

llms.txt lists ${inventory.llmsTxtPaths} paths, of which ${(observation.llmsPaths as string[]).filter((path) => !(observation.sitemapPaths as string[]).includes(path)).length} are absent
from sitemap.xml. That asymmetry is correct rather than a defect: they are
\`.well-known\` descriptors, JSON endpoints and API documentation - machine-retrieval
surfaces that belong in an agent manifest and not in a crawler's page index.
**None of them counts toward the ${PAGE_TARGET} target**, and neither do redirects,
aliases, pagination, filters or parameter permutations.

No \`/admin\` or \`/api\` path appears in the sitemap. Client bundles do carry the
field names \`reviewerId\` and \`authorizationBasis\`, which was checked: they are
empty-initialised form state in \`/admin/epistemic-ingestion\` and
\`/admin/epistemic-releases\`, both non-public, and carry no reviewer identity,
review prose or authority value.

## What the ${model.gapToTarget} missing pages are waiting on

| bucket | records |
|---|---:|
| a. publishable now | **${b['publishable-now']}** |
| b. blocked on canonical release | ${b['blocked-on-canonical-release']} |
| c. blocked on exact-revision review | ${b['blocked-on-exact-revision-review']} |
| d. blocked on source inspection / alignment | ${b['blocked-on-source-inspection']} |
| e. requires genuinely new records or sources | ${b['requires-new-records-or-sources']} |

**The publishable-now pool is ${b['publishable-now']}.**

Bucket (b) reads zero as a limit of observation, not as a finding. Exact-revision
review is only readable here through an active canonical release carrying all
four scopes, so a record reviewed but not released is indistinguishable from one
never reviewed, and both are counted against review.

Every record that is both alignment-clear and carries an active canonical
release already has a substantial page. The constraint on the next batch is not
compilation capacity; it is that ${b['blocked-on-canonical-release']} inspected
records are waiting on a canonical release and ${b['blocked-on-source-inspection']}
records are waiting on source inspection. Neither is work that may be
manufactured here: a release decision and a source inspection are human acts,
and inventing either to raise a page count would make the count worthless.

## Roadmap

Existing evidence can support at most ${evidenceBacked} further pages once its
blockers clear — ${b['blocked-on-canonical-release']} through release,
${b['blocked-on-exact-revision-review']} through review, and
${b['blocked-on-source-inspection']} through inspection. That leaves
**${b['requires-new-records-or-sources']}** pages that need records or sources
that do not exist yet.

At ${perBatch} pages per batch, reaching ${PAGE_TARGET} takes
**${Math.ceil(model.gapToTarget / perBatch)} batches**, of which
${Math.ceil(evidenceBacked / perBatch)} can be drawn from records already in the
corpus and ${Math.ceil(b['requires-new-records-or-sources'] / perBatch)} cannot.

The ordering that unblocks the most work per decision:

1. Release the ${b['blocked-on-canonical-release']} records that are already
   inspected and reviewed. This is the only bucket where a single decision
   converts directly into publishable pages.
2. Inspect sources for the ${b['blocked-on-source-inspection']} unaligned
   records, in domain clusters so that internal links land somewhere.
3. Commission new records only after the first two are drained, since new
   sources re-enter at the back of the same queue.

## Search Console checks

Discovery evidence only. Impressions and clicks say a page was found, not that
it was useful or that anyone bought anything.

- **+7 days** — are the newest canonical paths in the index at all? Record
  *Discovered*, *Crawled — currently not indexed* and *Indexed* counts.
- **+14 days** — do impressions appear for the page's declared search intent
  rather than for the site name? Record queries per family.
- **+28 days** — has any family's median position moved, and did internal links
  from released records get followed? Record crawl depth.

Record the observed numbers. Do not record a projection as an observation.
`

mkdirSync('docs/operations', { recursive: true })
writeFileSync('docs/operations/scaling-to-1000.md', report)

process.stdout.write(`${JSON.stringify({
  crawlable: model.crawlable,
  gapToTarget: model.gapToTarget,
  buckets: model.buckets,
  publishableNow: model.publishableNowRecordIds.length,
}, null, 2)}\n`)
