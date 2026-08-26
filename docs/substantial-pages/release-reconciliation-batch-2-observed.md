# Batch two release reconciliation — observed state and authorization request

Deterministic preflight: `content/substantial-pages/release-reconciliation-batch-2.json`.
Append-only observation: `publication-batch-2-reconciliation-observations.json`.
The original deployment baseline is **not** edited by this report.

## Outcome in one line

**No canonical release was performed, and none could be.** All 25 unreleased records and both
drifted records fail the repository’s own `releaseReadiness()` for want of scoped expert review
decisions. Creating those decisions would be fabricating expert review, so the five-record
canary is empty by evidence, not by permission.

## Cohort states — counted separately

| State | Count |
|---|---|
| compiled | 30 |
| eligible | 30 |
| canonicallyReleased | 4 |
| publiclyReachable | 5 |
| substantiallyRendered | 3 |
| sitemap | 5 |
| llmsTxt | 5 |

These are five different numbers over the same thirty records. Batch two was described as a
"30-page publication" because four of them were collapsed into the word *published*.

## Reconciliation states

| State | Records |
|---|---|
| `missing-release-decisions` | 25 |
| `released-and-revision-matched` | 2 |
| `released-but-revision-drifted` | 2 |
| `ready-for-initial-canonical-release` | 1 |

## The 25 unreleased records

Every one is blocked identically. `releaseReadiness()` returns `ready: false` for all 25, each
missing **five** decisions on its exact revision:

- `approval-review-missing`
- `expert-review-missing:source-fidelity`
- `expert-review-missing:domain-fidelity`
- `expert-review-missing:boundary-adequacy`
- `expert-review-missing:rights-and-locator`

That is **125 missing human review decisions**. Their evidence is in good order — all 25 are
alignment-clear, content-inspected and carry exact locators — so the blocker is the review
layer alone, not the source work.

## The two drifted records

### `advanced-materials-hexagonal-boron-nitride-dielectrics`

| Field | Released revision | Audited revision |
|---|---|---|
| revision digest | `376cd21b08d466e7` | `4caa07bb7312f980` |
| claim `sourceIds` | `source-advanced-materials-graphene` | `source-advanced-materials-hbn-substrates` |
| claim ids | unchanged | unchanged |
| claim wording | unchanged | unchanged |
| uncertainty | unchanged | unchanged |
| scope | changed | changed |
| source identity | changed | changed |
| source locator | changed | changed |
| evidence status | changed | changed |

**Classification: source-binding change.** Not editorial, not evidence-neutral — a changed
`sourceIds` or scope never is. It also carries a scope change and an evidentiary correction.

The production release still carries the pre-repair positional source assignment; the audited revision carries the subject-matched source. The withheld state protects readers from prose bound to the wrong paper.

**Disposition:** `withheld-pending-reaudit`. withheld-pending-reaudit — the current revision is alignment-clear and content-inspected, but a superseding release requires scoped review decisions that do not exist.

### `neurotechnology-bci-spike-sorting-boundaries`

| Field | Released revision | Audited revision |
|---|---|---|
| revision digest | `0438a6ef58edff4d` | `e16a7245541be017` |
| claim `sourceIds` | `source-neurotechnology-bci-neuropixels` | `source-neurotechnology-bci-spike-sorting-quality-metrics` |
| claim ids | unchanged | unchanged |
| claim wording | unchanged | unchanged |
| uncertainty | unchanged | unchanged |
| scope | changed | changed |
| source identity | changed | changed |
| source locator | changed | changed |
| evidence status | changed | changed |

**Classification: source-binding change.** Not editorial, not evidence-neutral — a changed
`sourceIds` or scope never is. It also carries a scope change and an evidentiary correction.

The production release still carries the pre-repair positional source assignment; the audited revision carries the subject-matched source. The withheld state protects readers from prose bound to the wrong paper.

**Disposition:** `withheld-pending-reaudit`. withheld-pending-reaudit — the current revision is alignment-clear and content-inspected, but a superseding release requires scoped review decisions that do not exist.

## Why the drift matters more than it looks

The drift is not decay. Production still holds the **pre-repair positional source assignment**
— the defect where six sources were spread across thirty concepts by array position. The
audited revision holds the corrected, subject-matched source. Had the revision guard not
withheld these two pages, production would have served hexagonal-boron-nitride prose citing
the graphene paper, and spike-sorting prose citing the probe-architecture paper.

The guard did exactly what it exists to do. Both records are now **evidence-ready and
decision-blocked**: alignment-clear against subject-matched sources, awaiting review.

## Authorization request

Two separate things are needed, and neither can be inferred:

1. **Scoped expert review decisions** on the exact current revision for each record — four
   scopes plus an approval review. 125 for the initial cohort, 10 more for the two drifted.
   These must come from reviewers, not from this pipeline.
2. **Release authority** — the separately authenticated human mechanism. No release-authority
   or operations token was used, requested or logged in this work.

Once decisions exist for a record, it moves to `ready-for-initial-canonical-release` on the
next preflight run with no code change, and a five-record canary can proceed.

## Per-record observed state

| Record | Domain | State | HTTP | Released | Rendered | Sitemap | llms.txt |
|---|---|---|---|---|---|---|---|
| advanced-materials-correlated-insulating-states | advanced-materials | `missing-release-decisions` | 404 | no | no | no | no |
| advanced-materials-graphene-monolayers | advanced-materials | `released-and-revision-matched` | 200 | yes | yes | yes | yes |
| advanced-materials-hexagonal-boron-nitride-dielectrics | advanced-materials | `released-but-revision-drifted` | 200 | yes | no | yes | yes |
| advanced-materials-magic-angle-superconductivity | advanced-materials | `missing-release-decisions` | 404 | no | no | no | no |
| agentic-systems-mcp-context-window-position-effects | agentic-systems-mcp | `missing-release-decisions` | 404 | no | no | no | no |
| agentic-systems-mcp-mcp-prompt-templates | agentic-systems-mcp | `missing-release-decisions` | 404 | no | no | no | no |
| agentic-systems-mcp-mcp-resource-discovery | agentic-systems-mcp | `missing-release-decisions` | 404 | no | no | no | no |
| agentic-systems-mcp-mcp-tool-result-contracts | agentic-systems-mcp | `released-and-revision-matched` | 200 | yes | yes | yes | yes |
| agentic-systems-mcp-tool-deny-by-default | agentic-systems-mcp | `missing-release-decisions` | 404 | no | no | no | no |
| biomolecular-engineering-cell-free-transcription-translation | biomolecular-engineering | `missing-release-decisions` | 404 | no | no | no | no |
| biomolecular-engineering-experimental-fold-validation | biomolecular-engineering | `missing-release-decisions` | 404 | no | no | no | no |
| biomolecular-engineering-sequence-design-with-proteinmpnn | biomolecular-engineering | `missing-release-decisions` | 404 | no | no | no | no |
| circuit-quantum-electrodynamics | quantum-systems | `missing-release-decisions` | 404 | no | no | no | no |
| critical-supply-chains-critical-mineral-import-reliance | critical-supply-chains | `missing-release-decisions` | 404 | no | no | no | no |
| fusion-plasma-systems-breeding-blanket-test-modules | fusion-plasma-systems | `missing-release-decisions` | 404 | no | no | no | no |
| fusion-plasma-systems-disruption-mitigation | fusion-plasma-systems | `missing-release-decisions` | 404 | no | no | no | no |
| fusion-plasma-systems-divertor-heat-exhaust | fusion-plasma-systems | `missing-release-decisions` | 404 | no | no | no | no |
| fusion-plasma-systems-plasma-diagnostics | fusion-plasma-systems | `missing-release-decisions` | 404 | no | no | no | no |
| fusion-plasma-systems-tritium-fuel-cycle | fusion-plasma-systems | `missing-release-decisions` | 404 | no | no | no | no |
| mechanistic-interpretability-attention-pattern-evidence | mechanistic-interpretability | `missing-release-decisions` | 404 | no | no | no | no |
| mechanistic-interpretability-causal-scrubbing | mechanistic-interpretability | `missing-release-decisions` | 404 | no | no | no | no |
| mechanistic-interpretability-in-context-learning-circuits | mechanistic-interpretability | `missing-release-decisions` | 404 | no | no | no | no |
| mechanistic-interpretability-induction-head-circuits | mechanistic-interpretability | `missing-release-decisions` | 404 | no | no | no | no |
| mechanistic-interpretability-sae-encoder-decoder | mechanistic-interpretability | `missing-release-decisions` | 404 | no | no | no | no |
| mechanistic-interpretability-sparse-autoencoder-dictionaries | mechanistic-interpretability | `missing-release-decisions` | 404 | no | no | no | no |
| neurotechnology-bci-spike-sorting-boundaries | neurotechnology-bci | `released-but-revision-drifted` | 200 | yes | no | yes | yes |
| quantum-error-mitigation | quantum-systems | `missing-release-decisions` | 404 | no | no | no | no |
| stabilizer-syndrome-measurement | quantum-systems | `missing-release-decisions` | 404 | no | no | no | no |
| surface-code-error-correction | quantum-systems | `missing-release-decisions` | 404 | no | no | no | no |
| transmon-qubit | quantum-systems | `ready-for-initial-canonical-release` | 200 | no | yes | yes | yes |

Release readiness is never inferred from a compiled or eligible substantial page. A canonical release additionally requires scoped review decisions on the exact record revision and a separately authenticated human release authority. This module observes and reports; it never creates a decision, never mutates a release and never repairs an evidence mapping.
