# Maintaining the Mayon hub (/mayon)

The hub is the company-owned home for the Mayon Volcano project. The app itself
stays at mayonrajan.com; this page introduces it, answers the questions people
arrive with, and routes them to the browser experience, the stores, the teacher
hub and the source record.

Nearly everything editable lives in `lib/mayon-hub.ts`. Change it there, not in
the page, so the tests in `test/mayon-hub.test.ts` keep checking real values.

## Where to change what

| What | Where |
| --- | --- |
| Release status per platform | `MAYON_AVAILABILITY` in `lib/mayon-hub.ts` |
| Store, browser, teacher, methods, source, changelog and deep links | `MAYON_LINKS`; the three app links come from `lib/app-store-links.ts` |
| Screenshots and captions | `MAYON_SCREENSHOTS` plus the files in `public/mayon/` |
| Facts strip (location, type, height, activity) | `MAYON_FACTS` |
| The six answers | `MAYON_QUESTIONS` |
| 2.0 roadmap and its statuses | `MAYON_ROADMAP` |
| Source list | `MAYON_SOURCES` |
| Concept-film facts | `MAYON_TRAILER` |
| Analytics event names | `MAYON_EVENTS` |
| "Last checked" date | `MAYON_HUB_REVIEWED` |

## Release status

Per platform, because the platforms differ. Version 1.5 is live in the browser.
On 2026-09-16 the Google Play listing reported 1.4, and the App Store listing
does not publish a version this repository can read. **Never infer store
approval from the version number in the app repository.** Open each listing,
read what it says, then update `MAYON_AVAILABILITY` and `MAYON_HUB_REVIEWED`.

A test refuses copy that claims 1.5 is on a store.

## Screenshots

Source frames live in the app repository under
`store/assets/screenshots-android-9x16/` (and `screenshots-ios-6.9/`), captured
from a release build. Re-export after a release that changes the interface;
old frames showing removed controls are worse than none.

```bash
sips -Z 1440 <source>.png --out /tmp/shot.png
cwebp -q 82 /tmp/shot.png -o public/mayon/screenshot-<name>.webp
```

Keep the 810 × 1440 output size: `MAYON_SCREENSHOTS` declares those dimensions
so the browser reserves the space, and a test checks the ratio. Update the
`alt` text to describe the new frame, not the old one. Do not substitute
generated artwork for a screenshot.

## Concept film and generated artwork

`public/mayon/living-mountain-poster.webp` and
`public/mayon/living-mountain-concept.webp` come from
`Projects/MAYON/output/living-mountain-trailer/`. Both are generated artwork,
and the page says so above the player. If the video is replaced, update every
field in `MAYON_TRAILER` from the real video — title, duration, upload date,
embed URL — because they are published as VideoObject structured data. Do not
use today's date as an upload date.

## Routes

- `/mayon` is canonical.
- `/apps/mayon` is an exact permanent redirect to it, configured in
  `next.config.ts`. `permanent: true` is a 308 in Next.js.
- `/apps/mayon/privacy` keeps its own URL and legal role. Never widen the
  redirect source to a pattern.
- `/projects/mayon` stays as the methods and project background page and links
  to the hub.
- `mayonrajan.com` is the app. It is not redirected here and its guides stay
  there; this page links to them.
- `/knowledge/religion/mayon` is the early Tamil Māyōṉ dossier: a different
  subject with a shared spelling, linked only for disambiguation.

## Measurement

Six aggregate actions use the existing cookie-free conversion endpoint through
`trackConversion`: browser launch, Android click, iOS click, trailer
activation, teacher-resource click and contribution click. Names are in
`MAYON_EVENTS` and must keep the `cta_` prefix, which is how
`/api/conversion-events` classifies them as CTA clicks.

Events are best-effort: navigation never waits for them, and a blocked request
changes nothing a visitor sees. Aggregate counts land in the same store as the
site's other CTA events; there is no per-visitor identifier and no new
provider. Nothing here reports store installs — a store click is a click.

## Facts and corrections

Every number on the page is attributed next to where it appears. The height is
given as a range because published figures differ; do not turn it into a single
exact measurement. Do not add a live alert level: PHIVOLCS is linked instead.
UNESCO appears only as a tentative listing, which is a proposal, not an
inscription. Corrections arrive at mayone@mahastrategies.com.

## One link deliberately left pointing at the redirect

`lib/mayon-topics.ts` (`modernBridgePaths`) and `lib/mayon-knowledge.ts` still
name `/apps/mayon`. That is intentional. `MAYON_PUBLIC_REGISTRY` is hashed into
`MAYON_PUBLIC_REGISTRY_DIGEST`, which is served as the registry ETag *and*
required as `expectedRegistryDigest` by the paid `divine-name-disambiguation`
microproduct. Editing those paths changes the digest, breaks the product's
published example, and would need its examples and discovery contract
regenerated in a separate, deliberate change. The redirect means visitors still
land on `/mayon`.
