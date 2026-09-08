# Dependency-prerequisite closure

Base `aad9f10` (Tranche 24). Branch `claude/dependency-prerequisite-closure`,
worktree `/private/tmp/maha-closure`.

**Local only.** No ledger created or updated, no Tranche 23/24/25 file touched,
no public route, sitemap, deploy or Production change, no Next/Vercel build.

## Reconciliation

The old branch was not merged. Three commits were reconciled by porting their
substance onto this base and regenerating everything against ledger v7:
`97ca4f1` (verifier and Publish audit), `5e6a5fd` (graph-v3 dangling repair),
and `d1d6ffd`.

The brief named only the first two. `d1d6ffd` is included because it is a
correction *to* `97ca4f1`, not a separate feature: it fixed a rule that
conflated publication ordering with evidence dependency. Porting the first two
without it would have reinstated a defect this work already found and fixed —
and objective 12's "no evidence inheritance" test depends on the corrected rule.

Tranches 23–24 and ledger v7 are intact; nothing owned by them was written.

## The cohort, derived

Every definition candidate unresolved in ledger v7 with incoming fan-out in
graph v3. **4 candidates, 81 incoming edges.** The size is computed at
generation time and asserted against a recomputation in the tests.

| fan-in | prior | candidate |
| ---: | --- | --- |
| 65 | revise | `/knowledge/private-machine-systems/health-data-consent/definition` |
| 7 | revise | `/agentic-publishing/agentic-query-letter/definition` |
| 7 | revise | `/concepts/public-reason/definition` |
| 2 | revise | `/concepts/machine-civilization/definition` |

A further **34 prerequisites carry 142 incoming edges but are not candidates**:
32 held as canonical graph objects by the Tranche 19 Model A decision, and 2
whose definitions v5 deleted. They cannot be frozen or reviewed as candidates
because they are not candidates, and are listed so their fan-out stays visible.

## Decisions: 1 cleared, 3 revise

**`health-data-consent` → evidence-ready.** Eight authorities across two
jurisdictions, 17 findings, each with an exact locator, and all five
requirements met. The four distinctions are each held by a source that states
them — consent (GDPR 4(11)), authorization (45 CFR 164.508(a)(1),(c)(1)), notice
(164.520(b)(1)(ii)(E), which says notice is not permission), lawful basis (GDPR
6(1)(a)–(f), where consent is one of six). Two differences are preserved rather
than smoothed: revocation is prospective and unconditional under GDPR 7(3) but
carries reliance and insurance exceptions under 164.508(b)(5); emergency use
turns on incapacity under GDPR 9(2)(c) and on professional judgement under
164.510(b)(3). Two readings are rejected — no universal law, since every
instrument binds a named actor in a named jurisdiction, and no executable
machine rule, since every provision turns on human judgement.

**It clears exactly one candidate.** Its 65 dependents are unchanged, and
`dependentsMadeEvidenceReady` is 0. A definition establishes what a term means;
it is not evidence for what any page says using the term.

**`agentic-query-letter` → revise.** No implementation and no external
authority. `lib/agent-inquiries.ts` is a reusable lifecycle shape about
commercial offers — nothing there models a manuscript, work, author or
publishing decision. An adjacent implementation is not an implementation.

**`public-reason` → revise.** Filed as an authorial concept, but the term is
established: the Stanford Encyclopedia entry (rev. 2022-04-20) defines it as the
requirement that rules regulating common life be justifiable to those they bind,
and associates it with Rawls, *Political Liberalism*. The candidate is therefore
either that concept, and must cite the literature, or a distinct authorial
sense, and must say so. Neither is done.

**`machine-civilization` → revise.** An authorial coinage with no external
authority and nothing in the repository for a first-party definition to be
grounded in and cite.

## Cascade against ledger v7

| measure | value |
| --- | --- |
| dangling edges | **0** (3,122 → 3,117 edges) |
| evidence inheritance | **12** |
| ordering constraints (not violations) | 114 |
| identity-resolved prerequisites (not violations) | 123 |
| canonical-owner violations | 0 |

The 12 remain `editorial-review` and `machine-readable-article` — definitions
that exist in neither the route map nor the graph objects, with 12
evidence-ready `agentic-publishing` routes depending on them. Their missing-owner
nodes stay explicit and unresolved, and are **not** pointed at the v5
replacement candidates, which are different concepts and are not definitions.

## Assessability, reported separately

**39 unresolved prerequisites with dependents; 173 candidates would become
assessable.** Both figures are derived from the graph and ledger at generation
time. The earlier 34/151 and 36/153 were stale because the report was seeded
from inheritance violations, so correcting the violation rule silently changed
what the projection meant. It is now seeded from the prerequisite cohort, and a
test fails if those literals reappear in the generator.

Assessable is not readiness. A candidate becomes assessable when nothing blocks
it from being reviewed; evidence-ready only when its own sources are inspected
and a decision recorded. Ledger v7 holds 1,426 evidence-ready, reported beside
the projection and never summed with it.

## Verification

- Deterministic regeneration across 3 runs, byte-identical.
- Privacy: no `PRIVATE_CORPUS_MARKERS` in any artifact.
- Typecheck (`next typegen && tsc --noEmit`): 0 errors.
- Targeted: 15/15 closure, 35/35 cascade.
- No ledger written; no Tranche 23/24/25 file written.
