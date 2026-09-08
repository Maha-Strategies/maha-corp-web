# Federation 4,000-route deployment readiness

Branch `codex/federation-4000-indexing-control`, worktree `/private/tmp/maha-tr13`.
Clean, 0 behind `origin/main`, 52 ahead, not yet on origin.

**Verdict: NOT ready for a Production deployment that would make all 4,000 routes
reachable.** The code is sound and the sitemaps are fail-closed. The blocker is
deployment topology, and it is not fixable inside this repository.

## Deployment topology (read-only Vercel query)

Nine federation hostnames are served by **six different Vercel projects**, of
which this repository is one.

| hostname | Vercel project | this repo? |
| --- | --- | --- |
| www.mahastrategies.com | maha-corp-web | **yes** |
| mahastrategies.com | maha-corp-web | **yes** |
| research.mahastrategies.com | research-journal | no |
| publish.mahastrategies.com | agentic-publisher-web | no |
| **policy.mahastrategies.com** | **none — NXDOMAIN** | no |
| www.maha-os.com / maha-os.com | maha-os-marketing | no |
| mayonrajan.com / www.mayonrajan.com | mayonrajan | no |
| mayonemaharajan.com / www.mayonemaharajan.com | mayone-dossier | no |

`policy.mahastrategies.com` is attached to no Vercel project and does not
resolve (`NXDOMAIN`). Every other host resolves and returns 200 today, served
by its own project.

## What deploying this artifact would and would not do

Of the 1,628 released routes:

| owning host | released routes | served by this deployment |
| --- | ---: | --- |
| www.mahastrategies.com | 660 | **yes** |
| research.mahastrategies.com | 369 | no |
| policy.mahastrategies.com | 300 | no — host does not exist |
| publish.mahastrategies.com | 108 | no |
| www.maha-os.com | 66 | no |
| www.mayonemaharajan.com | 60 | no |
| mayonrajan.com | 53 | no |
| mayonemaharajan.com | 11 | no |
| www.mayonrajan.com | 1 | no |

**660 reachable, 968 not.** The other eight hostnames route to projects that do
not contain this code, so their `/sitemap-index.xml`, `/sitemaps/[segment].xml`
and host-specific `robots.txt` would never be served from here. All nine
`/sitemap-index.xml` endpoints return 404 in Production today.

## Local verification

Production build succeeded. Warnings were the expected nonblocking pair: an NFT
broad-trace notice from `next.config.ts`, and missing Upstash variables because
protected Production environment variables are absent locally.

- **All 1,628 released routes serve HTTP 200** under their exact assigned Host
  header, verified individually against the v8 ledger.
- **Sitemap totals under exact Host headers: 4,000**, partitioned strictly per
  host (2,663 / 300 / 660 / 138 / 79 / 70 / 1 / 78 / 11). No cross-host entries.
- The host gate refuses correctly: a federation path returns 200 on its
  canonical host and 404 on any other.
- Privacy: 27 sitemap/robots endpoints and 82 sampled released pages screened
  against all six private-corpus markers — zero occurrences.

### The 123 legacy 404s are all Production-service dependencies

Every one of the 2,663 URLs in the www sitemap was requested locally. 123
returned 404. **All 123 were then requested on live Production and all 123
returned 200.** None is a genuine defect.

They are epistemic-release-backed pages — 115 knowledge articles across 11
domains, 8 `/knowledge/sources/*` references, and 3 others — whose pages read
live release records. The worktree has no `.env.local` and therefore no service
credentials, so those reads fail closed to 404. This is the gate behaving
correctly, not a broken route.

### A correction to an earlier count

An initial pass reported 161 federation routes returning 404. That pass used
the paths in `federation-route-candidates-v5.json`. Ledger v8 records
`retainedReady: 1467` and `sourceCenteredReplacements: 161`: those 161 v5 paths
were **superseded**, and their `/source-guides/*` replacements are the released
routes. The superseded paths correctly 404 and are correctly absent from every
sitemap. Tested against the v8 released set, **all 1,628 serve 200**.

## Sitemap integrity

No sitemap advertises an unavailable page:

- The 123 local 404s are all live-200 in Production.
- The 161 superseded paths appear in no sitemap.
- `/knowledge/religion/mythology` has no page and 404s on every host — and is
  **not** listed in any sitemap.

No sitemap change was required, and the 4,000-route ledger was not reduced.

## Open defect (latent, not currently exploitable)

`federationCanonicalHostForPath` returns `null` for
`/knowledge/religion/mythology` because its rule requires a trailing slash. The
guard in `proxy.ts:19` only runs when that function returns non-null, so this
path is exempt from the host gate and would be servable from any hostname. It is
not exploitable today because the page does not exist, and the route is not in
any sitemap. It should be closed before that hub page is ever added.

## Tests

Run sequentially to remove concurrent generator and disposable-PostgreSQL noise.

- Indexing, sitemap hygiene, canonical-release freshness, visual-system
  completeness, book-section indexing: **19/19**.
- Federation suite: **522/522**.
- Typecheck: 0 errors. Lint on the 60 files this branch changes: clean.

## Blockers before Production

1. `policy.mahastrategies.com` does not exist. 300 released routes have no host.
2. 968 released routes belong to hostnames owned by five other Vercel projects.
   Deploying `maha-corp-web` cannot serve them, and no domain or deployment
   change was made or is proposed here.
3. The host-gate gap above.

Sitemap segmentation improves discovery, segmentation and update signaling. It
does not guarantee indexing or impression growth.
