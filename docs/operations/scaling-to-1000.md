# Scaling to 1,000 public pages

Generated from `content/scaling/public-surface-observation.json`, a read-only
observation of the live public surface taken at 2026-09-01T12:00:00.000Z.

- sitemap.xml `sha256:c9609cfe19d732912f6a9ec99caeb1c2817f81427f022d54ab092c8a4f1b43a6`
- llms.txt `sha256:f951fcd86d4a03811ac930654fe4e527705e127fc79c47c6e138327e27cf83a6`
- release registry `sha256:cbaaff0cdc5f761b230db94b0f65998a934356e67effdb215627a3e53e87b179`

This counts crawlable canonical URLs. It does not assert that any page is
indexed, ranks, or that any claim on it is true.

## Where the surface is now

| | count |
|---|---|
| Crawlable canonical URLs | **764** |
| Target | 1000 |
| Gap | **236** |
| Paths listed in llms.txt | 190 |

### By family

| family | crawlable | needs a canonical release |
|---|---:|---|
| Methodology and governance | 34 | no |
| Substantial canonical record | 437 | yes |
| Open book chapter | 167 | no |
| Intelligence and analysis | 49 | no |
| Product, tool and developer surface | 42 | no |
| Case study and consulting | 12 | no |
| Corporate and legal | 6 | no |

Unclassified paths: 17.

### Reconciliation

Every one of the 114 active canonical
release paths appears in sitemap.xml (114 of
114, 0 missing).
All 103 substantial-page paths
are backed by an active release. Duplicate sitemap entries: 0.

llms.txt lists 190 paths, of which 53 are absent
from sitemap.xml. That asymmetry is correct rather than a defect: they are
`.well-known` descriptors, JSON endpoints and API documentation - machine-retrieval
surfaces that belong in an agent manifest and not in a crawler's page index.
**None of them counts toward the 1000 target**, and neither do redirects,
aliases, pagination, filters or parameter permutations.

No `/admin` or `/api` path appears in the sitemap. Client bundles do carry the
field names `reviewerId` and `authorizationBasis`, which was checked: they are
empty-initialised form state in `/admin/epistemic-ingestion` and
`/admin/epistemic-releases`, both non-public, and carry no reviewer identity,
review prose or authority value.

## What the 236 missing pages are waiting on

| bucket | records |
|---|---:|
| a. publishable now | **0** |
| b. blocked on canonical release | 30 |
| c. blocked on exact-revision review | 8 |
| d. blocked on source inspection / alignment | 149 |
| e. requires genuinely new records or sources | 49 |

**The publishable-now pool is 0.**

Bucket (b) reads zero as a limit of observation, not as a finding. Exact-revision
review is only readable here through an active canonical release carrying all
four scopes, so a record reviewed but not released is indistinguishable from one
never reviewed, and both are counted against review.

Every record that is both alignment-clear and carries an active canonical
release already has a substantial page. The constraint on the next batch is not
compilation capacity; it is that 30 inspected
records are waiting on a canonical release and 149
records are waiting on source inspection. Neither is work that may be
manufactured here: a release decision and a source inspection are human acts,
and inventing either to raise a page count would make the count worthless.

## Roadmap

Existing evidence can support at most 187 further pages once its
blockers clear — 30 through release,
8 through review, and
149 through inspection. That leaves
**49** pages that need records or sources
that do not exist yet.

At 50 pages per batch, reaching 1000 takes
**5 batches**, of which
4 can be drawn from records already in the
corpus and 1 cannot.

The ordering that unblocks the most work per decision:

1. Release the 30 records that are already
   inspected and reviewed. This is the only bucket where a single decision
   converts directly into publishable pages.
2. Inspect sources for the 149 unaligned
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
