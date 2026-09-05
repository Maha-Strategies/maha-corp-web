# Epistemic Clearing Expansion — Batch 2

Prepared: 2026-09-05  
State: prepared, not built or deployed  
Artifact: `content/scaling/epistemic-clearing-batch-2.json`  
Digest: `sha256:c6df032f6628fcb98d14d4d5d492a9325c305aa897371a22c9c6e658395e240f`

## Decision

Batch 2 prepares 407 finite routes and 2,035 bounded questions. Every route is a **bounded method guide**. It explains how to decide or verify a subject-specific question and explicitly records that no subject-specific result has yet been produced.

This distinction is load-bearing. The batch does not claim to have completed a calculation, inspected a Tamil passage, proved a theorem, made an astronomical observation, verified a cross-domain transfer, or run an external integration merely because it publishes the procedure that such work would require.

## Allocation

| Lane | Routes | Bounded questions | Intended utility |
| --- | ---: | ---: | --- |
| Machine integrations | 60 | 300 | Identity, entitlement, quota, bounded execution, receipt, and acknowledgement procedures. |
| Tamil religion and textual traditions | 80 | 400 | Passage, edition, translation, commentary, historical-inference, reception, and theology boundaries. |
| Astrology infrastructure | 80 | 400 | Inputs, frames, deterministic computation, sensitivity, and prospective-evaluation protocols. |
| Evidence clearing | 100 | 500 | Source identity, locator, scope, conflict, uncertainty, release, and retrieval decisions. |
| Mathematics and astronomy | 50 | 250 | Definition, derivation, fixtures, calibration, observables, and inference boundaries. |
| Cross-domain synthesis | 37 | 185 | Typed transfer contracts that refuse equivalence by shared terminology or metaphor. |
| **Total** | **407** | **2,035** | |

Two hundred sixty routes carry a book-concept priority. Book links are rendered as conceptual lenses, never as operational or inspected technical evidence, and they are excluded from structured-data citations.

## Page contract

Each route contains:

- one bounded question and direct procedural answer;
- an explicit method boundary and `no-subject-specific-result-claimed` status;
- a subject-specific decision record with minimum evidence, pass condition, refusal condition, and current result;
- at least four required inputs, six ordered steps, three outputs, three refusal conditions, and three limitations;
- five bounded follow-up questions;
- source-role labels that distinguish operational sources, inspected projections, conceptual lenses, and related guides;
- canonical metadata, `TechArticle` and `FAQPage` structured data, and a recomputable SHA-256 provenance digest.

Tamil religion guides link to existing source atlases and dossiers as related guides. They do not claim those pages establish a new occurrence, identity, translation, or lineage finding for the route subject. Calculation guides state that missing inputs produce no number. Mathematics and astronomy guides report no new proof or observation. Cross-domain guides do not claim that validity transfers between fields.

## Routing and discovery

The prepared graph spans seven finite dynamic route families:

- `/developers/epistemic-clearing/[slug]`
- `/knowledge/religion/clearing/[category]/[slug]`
- `/knowledge/astrology/workflows/[category]/[slug]`
- `/knowledge/epistemic-system/clearing/[slug]`
- `/knowledge/mathematics/clearing/[slug]`
- `/knowledge/astronomy/clearing/[slug]`
- `/knowledge/integrations/epistemic-clearing/[slug]`

Every family sets `dynamicParams = false` and derives `generateStaticParams` from the deterministic registry. The sitemap and `llms.txt` read the same combined Batch 1 and Batch 2 registry. Mathematics, astronomy, and integrations hubs now expose curated entry points; the existing developer, religion, astrology, and epistemic-system hubs inherit the expanded registry.

No `publish.mahastrategies.com` or `publishing.mahastrategies.com` route is created or modified by this batch.

## Count boundary

The last operator-authorized local build counted 993 static pages. Batch 1 prepared 100 routes and Batch 2 prepares 407, yielding a **planning projection of 1,500 pages**.

That is not a measured build result. It is not a claim that 1,500 pages are live, crawlable, indexed, useful to search systems, or commercially validated. The exact total can only be established by a later operator-authorized build.

## Verification under the build embargo

Allowed and completed:

- deterministic artifact generation and per-page digest recomputation;
- exact route, lane, question, and candidate-binding checks;
- duplicate checks against Batch 1 and the last observed sitemap;
- finite-route and discovery-surface checks;
- structured-data citation-role checks;
- source-link resolution against observed or prepared routes;
- credential, submission-content, local-path, and publishing-subdomain scans;
- focused Node tests, type checking, and linting.

Verification results:

- Batch 1, Batch 2, candidate-map, Knowledge-layout, and visual-system tests: **43/43 pass**;
- type checking: **pass**;
- lint: **0 errors, 26 pre-existing warnings**;
- serialized repository suite: **3,728 pass, 10 fail, 1 skipped**. Nine failures stop at PostgreSQL `initdb` because the host has exhausted System V shared-memory identifiers; no migration or Batch 2 code executes. The remaining failure is an unrelated dirty-worktree canonical-URL change under `/books`. Neither failure class touches this batch.

Not run:

- `next build` or `npm run build`;
- Vercel Preview or Production build;
- Preview or Production deployment;
- Production route, indexing, or rendering observation.

## Remaining limitations

- No new source was inspected for Batch 2.
- The routes provide decision utility, not completed subject research.
- Candidate demand scores prioritize work; they do not forecast impressions, clicks, revenue, or answer-engine citation.
- Repeated procedural structure is intentional, but each route must still earn utility through its subject-specific decision record. Future review should remove any page whose intent is already answered elsewhere.
- The build threshold has been reached only as a projection. A separate operator decision is required before any build or deployment.
