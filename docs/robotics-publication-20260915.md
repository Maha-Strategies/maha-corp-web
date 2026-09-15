# Robotics evidence collection — publication, 2026-09-15

User authorized deploying the robotics pages through the established release
process. This record covers the change from local noindex drafts
([first tranche](robotics-local-readiness.md), [40 topics](robotics-40-local-readiness.md))
to public, indexable pages. Live verification is recorded in the release
report, not here.

## Route inventory

- `/knowledge/robotics` — hub, linked from the `/knowledge` domain grid.
- `/knowledge/robotics/[slug]` — 40 statically generated topics, `dynamicParams = false`:
  38 editorial guides, the `evidence-package` specification and the
  `pick-place-example` toy experiment. Unknown slugs and inherited object keys
  such as `toString` return 404.

Groups: foundations 8, evaluation 10, provenance 8, assistance 6, governance 4,
specifications and examples 4. Map digest unchanged:
`sha256:b8fc24dcc4d84ad97e817a5ae26abe77527a697b619abe5e8cea03c50ca28323`.

## What changed for publication

- Robots metadata: the explicit `index: false, follow: false` is removed, so
  the pages inherit the site default. Canonicals stay self-referential on
  `https://www.mahastrategies.com`.
- Titles gain the ` | Maha Strategies` suffix; Open Graph title, description
  and canonical URL are added.
- Labels: "Local research draft · not released" and "Local draft" become
  "Evidence-engineering guides" / "Robotics evidence guide", and both keep
  "automated editorial preparation, not expert review".
- `app/sitemap.ts` lists the hub and all 40 topics with `lastModified`
  `ROBOTICS_RELEASE_DATE` (2026-09-15). Search demand for the collection has
  not been measured.
- The `/knowledge` card label drops "local editorial draft"; its statement that
  simulation evidence is not physical safety validation is kept.
- Knowledge route tripwires move 73 -> 75 for the two new route files.

Article content, sources, procedures and boundaries are unchanged from the
40-topic readiness record.

## Citation check

All ten cited sources returned HTTP 200 on 2026-09-15 and contain the cited
locators (W3C PROV Overview; NIST TN 1297 §2.1–2.4; NIST Privacy Framework;
NIST AI RMF; NIST Performance Assessment Framework for Robotic Systems; ROS
REP 103, 105 and 2004; rosbag2 README; LeRobotDataset v3). Each source's
paraphrased claim was compared with the fetched text. Links and paraphrase
only; no third-party text, images or data are redistributed.

## Pre-release verification (local production build)

- `next build` completed with the hub static and all 40 topics prerendered.
- `next start`: hub and topics 200; `/knowledge/robotics/not-a-topic` and
  `/knowledge/robotics/toString` 404; no robots meta; self canonicals; titles
  with the site suffix; `sitemap.xml` lists the hub and 40 topics.
- Headless Chrome at 1440x900 and 375x812 for `/knowledge`, the hub,
  `embodiment-and-capability`, `evidence-package`, `pick-place-example` and
  `lerobot-intake-example`: document scroll width equals client width (no
  horizontal overflow), the pages inherit `data-visual-system="cyber-light"`,
  and body copy is dark on a light surface. The `/knowledge` card renders
  first in the domain grid.
- `test/robotics-local.test.ts`, `tsconfig.robotics-local.json`,
  `scripts/verify-robotics-render.cjs`, the map digest and the simulation
  summary pass unchanged.

Not checked: screen-reader traversal, keyboard focus order and non-Chromium
browsers.

## Simulation boundary

The pick-and-place example is a deterministic grid-world with synthetic
assistance flags. Its results (direct 2/1/3, search 3/1/2 autonomous, assisted,
failed over six fixtures) describe these fixtures and this implementation, not
real-world robot reliability, hardware manipulation or safety. Every guide that
touches physical operation states that boundary in its Limits section.

## Rollback

Revert the robotics publication commit (restores noindex drafts and removes the
sitemap entries and Knowledge card), or roll Production back to the previous
deployment. Rolling back does not remove URLs already fetched by crawlers;
restoring `noindex` is the way to withdraw them from search.
