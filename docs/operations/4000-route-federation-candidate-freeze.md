# 4,000-Route Federation Architecture and Candidate Freeze

Status: local candidate freeze; no routes compiled or published

Frozen: 2026-09-05

Observed baseline: 2,372 canonical sitemap routes

Candidate set: 1,628

Projected total after governed publication: 4,000

## Result

The seven-property federation now has a deterministic ownership model and an exact candidate inventory. The map is a research queue, not a publication queue. Every candidate begins with source identity, content inspection, locator inspection, rights review, alignment audit, and exact-revision review marked `not-started`.

The candidate map does not create a route, sitemap entry, release, build, deployment, DNS record, or claim of demand. `policy.mahastrategies.com` remains a proposed property with unresolved DNS and zero observed routes.

## Measured baseline and allocation

| Property | Observed | Frozen candidates | Projected | Canonical role |
| --- | ---: | ---: | ---: | --- |
| `www.mahastrategies.com` | 2,003 | 500 | 2,503 | Applied epistemic clearing, governed agent operations, bounded answers, commercial discovery |
| `research.mahastrategies.com` | 291 | 400 | 691 | Sources, claims, methods, datasets, calculations, reproductions, provenance |
| `publish.mahastrategies.com` | 30 | 160 | 190 | Agentic editorial workflow, rights, releases, context packs, delivery |
| `www.maha-os.com` | 13 | 100 | 113 | Private/on-device AI, consent, local memory, resilient operation |
| `www.mayonemaharajan.com` | 18 | 88 | 106 | Authorial concepts, book lineages, intellectual history, declared thesis |
| `mayonrajan.com` | 17 | 80 | 97 | Mayon Volcano, hazards, preparedness, place, public communication |
| `policy.mahastrategies.com` | 0 | 300 | 300 | Policy evidence, governance mechanisms, comparisons, implementation rules |
| **Total** | **2,372** | **1,628** | **4,000** | |

The baseline is an immutable snapshot of the six public XML sitemaps. It includes route lists and source-sitemap digests, refuses duplicate or off-host URLs, and refuses accidental overwrite.

## Candidate structure

The 1,628 candidates are composed from bounded topic × lens matrices:

| Lane | Property | Topics × lenses | Routes |
| --- | --- | ---: | ---: |
| Applied agent governance | Maha Strategies | 20 × 7 | 140 |
| Evidence workflows | Maha Strategies | 20 × 5 | 100 |
| Deterministic mathematics and astronomy | Maha Strategies | 16 × 5 | 80 |
| Astrology infrastructure | Maha Strategies | 14 × 5 | 70 |
| Tamil religion | Maha Strategies | 14 × 5 | 70 |
| Book concepts, including *The Maha Principle* | Maha Strategies | 8 × 5 | 40 |
| Research objects | Maha Research | 50 × 8 | 400 |
| Agentic publishing | Agentic Publishing | 20 × 8 | 160 |
| Private machine systems | Maha OS | 20 × 5 | 100 |
| Authorial concepts | Mayone Maha Rajan | 11 × 8 | 88 |
| Mayon Volcano | Mayon Rajan | 16 × 5 | 80 |
| Policy clearing | Maha Policy | 30 × 10 | 300 |

Each route has a unique URL, title, search intent, candidate identifier, concept identifier, canonical host, evidence plan, route contract, duplicate screen, score, typed relationships, and publication state.

## Concept ownership

A concept may appear across the federation, but its general definition has one owner. A local page applies that concept within its property's remit and links to the owner; it does not copy the owner's body or inherit its authority.

| Canonical owner | Concept families |
| --- | --- |
| Maha Policy | governance, public trust |
| Maha Research | evidence, provenance, uncertainty, measurement, computation |
| Maha Strategies | authority, identity, interpretation, translation |
| Agentic Publishing | release, rights, memory |
| Maha OS | consent, resilience |
| Mayone Maha Rajan | autonomy, sovereignty |
| Mayon Rajan | risk, communication |

Allowed relationship types are `governed-by`, `evidence-for`, `implemented-by`, `published-as`, `derived-from`, `contrasts-with`, `applies-to`, `limits`, and `commercialized-through`.

Relationships are links, not page generators. They do not transfer evidentiary, legal, theological, scholarly, or operational authority.

## Property contracts

### Maha Strategies

Publishes applications, bounded answers, operational guides, and commercial entry points. Research-source duplication and claims based on unreleased evidence are prohibited.

### Maha Research

Owns the inspectable research objects behind the federation. Sales copy and unsupported interpretation are prohibited.

### Agentic Publishing

Owns publishing protocols, editorial templates, machine-authorship disclosure, correction and retraction practice, context packs, and release/delivery guidance. It does not duplicate research records.

### Maha OS

Owns private-system architecture and consent controls. It cannot present medical diagnosis or cloud-first processing as private operation.

### Mayone Maha Rajan

Owns book-derived and authorial concepts. Every route must distinguish Mayone Maharajan's thesis from empirical findings and scholarly consensus.

### Mayon Rajan

Owns educational material about Mayon Volcano. It must link to current official sources, cannot substitute for official alerts, and cannot conflate the volcano with Māyōṉ.

### Maha Policy

Owns governance mechanisms and policy comparisons. Every page must separate current law, observed evidence, Maha's proposal, tradeoffs, and uncertainty. It cannot provide legal advice or present a proposal as enacted law.

## Scoring and freeze semantics

The queue score weights evidence availability (20%), category-level search-demand prior (18%), machine utility (17%), differentiation (15%), federation utility (13%), commercial proximity (12%), and duplication safety (5%).

The search component is explicitly a category prior. Route-specific queries and impressions were not observed and are not fabricated. Scores determine research order only; they cannot satisfy an evidence or release gate.

The freeze is divided into four research tranches of 400, 400, 400, and 428 candidates. Tranche membership is deterministic. Work may be reordered after real search, access, or customer evidence is recorded, but changing the frozen candidate map requires a new version and digest rather than overwriting this one.

## Publication protocol

A candidate can become public only after all seven gates pass:

1. Candidate frozen.
2. Source identity verified.
3. Content and exact locator inspected.
4. Claim/source alignment clear.
5. Exact revision reviewed.
6. Active canonical release exists for that revision.
7. Route compiled and verified.

Sitemap and `llms.txt` membership follow the same live release decision. A stale, unreleased, metadata-only, inaccessible, or duplicated candidate remains private.

## Remote boundary

This sprint authorizes no Vercel build, Preview, deployment, DNS mutation, production mutation, release, or publication. The architecture records the standing rule that a Vercel build requires explicit operator approval.

## Artifacts

- `content/federation/federation-route-baseline-v1.json`: measured route baseline and source sitemap digests.
- `content/federation/federation-architecture-v1.json`: ownership, relationships, property contracts, and release protocol.
- `content/federation/federation-route-candidates-v1.json`: ranked 1,628-route candidate freeze.
- `scripts/freeze-federation-route-baseline.ts`: fail-closed baseline freezer.
- `scripts/generate-federation-4000-route-map.ts`: deterministic architecture and candidate generator.
- `test/federation-4000-route-map.test.ts`: count, ownership, determinism, privacy, and non-publication proofs.

## Next governed step

Review the architecture before research starts. Once accepted, begin Tranche 1 with source acquisition and duplicate adjudication. Policy research can proceed while DNS remains unresolved, but no policy candidate should be compiled or made crawlable until the property, canonical rules, legal framing, and release path are separately approved.
