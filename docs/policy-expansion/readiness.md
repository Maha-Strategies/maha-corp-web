# Policy expansion — local readiness report

September 19, 2026. This is an implementation and research report, not an approved political platform.

## Delivered

- Frozen 24-issue, 96-question map; four area and four methodology slots: **128 planning slots**, with the main entrance counted separately.
- **Five question slots reuse existing proposal URLs**. The map is not 128 new routes.
- Local question-led `/policy` entrance: four plain-language areas, 24 issue cards, search over **21 available entries** (12 briefs, five existing proposals, four methods). Unresearched questions are not searchable as completed answers.
- **12 written options briefs**, each with a 99–105-word direct answer, dated baseline, options, mechanism, authority boundaries, uncosted funding/distribution discussion, objections, implementation sequence, outcome measures, reconsideration triggers and source disclosures.
- **15 inspected source packets**, with exact locator, document version, inspection date, scope, limitation and rights boundary. These are bounded original paraphrases and links, not copied documents.
- Four methodology drafts; five-proposal position register and two philosophical references; decision document for Mayone.
- Production guard: new answer/method pages are available only when `NODE_ENV === 'development'`; all other environments return no draft static parameters and refuse draft rendering/metadata. Local draft metadata is noindex/nofollow. The production `/policy` render and metadata remain identical to the repository HEAD baseline.

## Evidence readiness, not publication approval

| Draft | State | Main unresolved work |
| --- | --- | --- |
| Housing affordability | Options brief for review | Select a locality, inspect current local data and original causal studies, cost the pilot. |
| Healthcare costs | Options brief for review | Choose service/program, inspect intervention evidence and payment authority, score alternatives. |
| Food quality and affordability | Options brief for review | Validate nutritional measure and health-effect evidence; inspect instrument-specific authority. |
| Federal spending and debt | Options brief for review; undecided | Select objectives; refresh applicable baseline and obtain independent package/distributional scores. |
| Borders, asylum and immigration | Revise current baseline | Operative regulations, injunctions and current administrative data remain incomplete. |
| Schools and skilled work | Options brief for review | Current program statutes, local learning outcomes and original apprenticeship evaluations. |
| Reliable affordable energy | Options brief for review | Region-specific reliability/cost modelling and current permitting/tariff rules. |
| Crime and civil liberties | Revise current baseline | NIJ source is archived 2009 material; inspect newer original studies, safeguards and local law. |
| Use of military force | Revise current baseline; undecided | Specific authorizations, current legal interpretations and international-law constraints. |
| China competition/cooperation | Revise current baseline; undecided | CRS PDF is October 2023, not current; current controls, trade and diplomatic instruments unverified. |
| AI and jobs | Options brief for review | Identify an observed cohort, compare impact evaluations and cost support alternatives. |
| AI accountability | Options brief for review | Jurisdiction/sector liability and remedies, enforceability, administrative costs and independent review. |

**Eight reviewable options briefs, four explicit evidence-refresh holds, zero approved-for-publication positions.** Even the eight briefs do not establish that their proposed interventions work. The strongest objections are reasoned alternatives prepared for review, not invented quotations or claims of consensus. Independent competing intervention studies remain an important next research step.

Law, empirical evidence, conditional forecasts, source descriptions, values and existing proposals are labelled separately. In particular, NIST's voluntary framework and agency jurisdiction overviews are source descriptions—not enacted liability rules or causal evaluations. Every new option is under consideration; no independent expert, legal or budget review is claimed.

## Inventory and ownership

`content/policy-expansion/v1/inventory.json` inventories the main entrance, five proposals, nutrition working paper, 300 technical Policy manifest articles and five specifically inspected adjacent assets (Knowledge, semiconductor process map, book landing, governed workflow and Evidence Preflight).

Five public HTTP observations were made: main `/policy`, its nutrient proposal, Policy homepage, AI accountability definition and The Maha Principle landing. All returned 200. This is **not a new live crawl or substantive review of 300 articles**, nor proof of Google indexing. Search demand remains unknown throughout; no GSC/private visitor data was accessed.

Main-host pages own approachable choices and attributed proposals. Technical Policy canonicals remain unchanged. Five technical definition dependencies resolve to existing manifest entries. A dependency traversal verifies area → issue → question → methodology/technical reference relationships without cycles.

Known pre-existing gap: The Maha Principle is a maintenance placeholder whose public canonical resolves to the main homepage. The sprint records, but does not fix or republish, this unrelated book issue.

## Verification performed

| Check | Result and scope |
| --- | --- |
| Targeted Node tests | **17 passed, zero failed**: 11 new sprint tests plus six existing Policy front-door tests. |
| Mutation/refusal cases | Missing factual citations, source-bounded authority without a citation, unrendered sources, invented approval and invented independent scores are refused. This validates structure, not factual truth. |
| Scoped TypeScript | `tsc -p tsconfig.policy-local.json` passed; no Next type-generation or production-build command. |
| Scoped lint | New policy modules, route files, components, scripts and tests passed. CommonJS rendering harness explicitly documents its require-import exception. |
| Frozen artifacts | Two regeneration checks byte-identical; generator is read-only and refuses automatic overwrite. |
| Isolated React rendering | 17 renders, one H1 each; 16 drafts reachable from entrance; all source anchors and internal reader links resolve; canonical/noindex checked; production refusal exercised. Next Link/notFound are adapted in this harness. |
| Production fallback preservation | React output and metadata compared exactly with `git show HEAD:app/policy/page.tsx`; unchanged. This is not a production build. |
| Actual local Next dev HTTP | 17 routes returned 200 with canonical/noindex and one H1; two invalid route controls returned 404. |
| Browser interaction | Search: housing → 1, no-match → 0 with helpful message, clear → 21, technology → 3. Tab moves from query to area with visible outline. Source disclosure opens with Enter. |
| Responsive browser | Entrance and housing brief checked at 375px; housing also at 1280px. Document scroll width matched viewport width. This is a smoke check, not an all-page/device accessibility certification. |
| Privacy/index boundary | Search has no transmission/storage/URL query code; no new analytics, profiling or personalisation. Local HTML checks found none of the named private credential/identity markers. Existing global site infrastructure was not re-audited. No sitemap imports or draft entries added. |

Not performed: full repository suite, screen-reader audit, comprehensive dark-mode/text-enlargement checks, production bundle inspection, Preview build, production build, deployment or GSC submission.

The development server emitted `MaxListenersExceededWarning` messages during the unknown-route/404 checks. Both controls returned 404 and the smoke assertions passed, but the warning's cause was not diagnosed or attributed to this diff. Do not describe the development run as warning-free. The temporary server was stopped after testing and its loopback port was confirmed no longer listening.

The first source-packet test incorrectly required a version string longer than 20 characters, rejecting the valid “April 2023.” Replaced with a year-presence assertion; locator/scope/rights checks remain. A later editorial check corrected descriptions of voluntary frameworks and agency overviews to `source-description`. The draft digest was explicitly updated; the candidate freeze was not changed.

## Reproduction

From the repository root:

```sh
node --test test/policy-expansion.test.ts test/policy-front-door.test.ts
node scripts/verify-policy-expansion-render.cjs
node scripts/policy-expansion-artifacts.ts --check
node scripts/policy-expansion-artifacts.ts --check
node_modules/.bin/tsc -p tsconfig.policy-local.json
```

For local browser review only, start `NEXT_TELEMETRY_DISABLED=1 node_modules/.bin/next dev --hostname 127.0.0.1 --port 3124`, visit `/policy`, and optionally run `node scripts/verify-policy-expansion-http.ts`. This is development compilation, not a production build. Stop the server when review is finished.

Candidate freeze SHA-256: `50802fc9d3380b66020f2547aab3dd4098c8f663109ca3fca2b0be89659dba71`.

## Before publication

1. Review `decisions.md`; decide whether each answer is a neutral options brief or an approved attributed position.
2. Resolve or explicitly scope the time-sensitive holds. Refresh evidence and obtain legal/cost review commensurate with any stronger recommendation; do not silently promote options into commitments.
3. Approve the editorial text, authorship/review disclosure and applicable dates.
4. Separately authorize changing the development-only guard, sitemap admission and Preview/production validation. Run that release workflow only after authorization.

Unrelated workspace changes were preserved. No push, merge, deployment, paid dependency, service provisioning, Vercel build or production build occurred.
