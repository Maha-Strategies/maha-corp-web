# Parent collection hubs — local readiness

Date: 2026-09-13. Base: 5ec8d0b67a0b8a12ae2319d699e80051138c7fd7.

## Scope and implementation

The 180 explicitly enumerated missing parent paths now share a collection
renderer. Exact path-only configuration rewrites preserve all existing article
URLs. Proxy host checks restrict these hubs to Maha Strategies, and direct
requests to the internal renderer remain 404. Unlisted descendants are not
accepted as hubs.

Collections derive article listings from the current main-property sitemap,
not private candidate inventories. They add navigation, not evidence or release
authority. Directory listings for the main property now use that same sitemap;
other properties retain their federation inventories and are described as such.
Knowledge/domain hubs link into collections, and shared article templates link
back to the nearest collection. Each hub includes breadcrumbs, an absolute
canonical, and CollectionPage/ItemList structured data.

## Observed local verification

- Final local production build: passed (`next build --webpack`). No Vercel build.
- Typecheck and focused ESLint: passed.
- Targeted navigation, visual-system and regression tests: 22 passed, 0 failed.
- Local sitemap: 2,674 existing URLs + 180 hubs = 2,854 URLs.
- Real anchor crawl from `/`: all 2,854 URLs discovered and fetched; 0 unlinked.
- New hubs: 180 HTTP 200 responses, 180 exact canonicals, 0 unreachable.
- Direct internal renderer, wrong Policy host, and unlisted child: each 404.
- Mathematics collection: 125 descendant articles rendered; desktop inspected;
  mobile viewport and document scroll width both 375px, with no overflow.
- Existing article URLs and release gates unchanged.

The served crawl is not the old inventory-only check: it starts at the homepage,
extracts real HTML anchors (excluding scripts/RSC strings), and checks responses
and canonicals. Regression tests reject disconnected pages, 404s and wrong
canonicals. The origin and root slash are normalized as equivalent URLs.

## Remaining whole-site findings — not hub failures

The full audit deliberately still returns failure: 122 existing leaf URLs return
404 in the credential-free local environment, and 21 existing pages have
canonical mismatches. The dynamic insight and epistemic-record renderers require
public publication/release data and refuse when unavailable. Two representative
local failures were checked read-only in Production and both returned 200:

- `/knowledge/advanced-materials/concepts/advanced-materials-graphene-monolayers`
- `/insights/verify-ai-generated-citations`

This sample does not prove all 122 are healthy in Production. Existing canonical
failures include `/audit` and doctrine briefs inheriting the homepage canonical.
These require a separate content/canonical pass and configured Preview checks;
they have not been repaired or waived by this navigation change.

## Reproduce and release boundary

Serve the local production build at port 3412 with `VERCEL_ENV=preview`, then run:

```sh
node --experimental-strip-types scripts/audit-site-route-reachability.ts --base=http://127.0.0.1:3412 --output=/private/tmp/maha-parent-crawl-final.json
```

Full crawl evidence is at `/private/tmp/maha-parent-crawl-final.json`; the console
summary separately reports `parentHubs` so their success cannot hide existing
whole-site failures. Test logs and build logs are local, not public assets.

No push, Vercel Preview, Production build, deployment, database mutation or sitemap
submission has been performed. Request approval before the Vercel release step.
