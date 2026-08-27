# Batch two release reconciliation — deterministic preflight

Generated from the record graph alone. Registry and production observations are
operational and live in the release report, not here, so this file regenerates
byte-identically.

Digest: `sha256:16ee32f5df089f1f26521c2eeabd13c5cf0ad1d8e1862ec7181ca1aa5901fa60`

## States

| State | Records |
|---|---|
| `ready-for-initial-canonical-release` | 1 |
| `released-and-revision-matched` | 0 |
| `released-but-revision-drifted` | 0 |
| `audit-or-contract-stale` | 0 |
| `missing-release-decisions` | 29 |
| `source-alignment-blocked` | 0 |
| `release-ineligible` | 0 |
| `withheld-pending-reaudit` | 0 |

## Blockers

| Blocker | Records |
|---|---|
| `publication-gate:approval-review-missing` | 29 |
| `publication-gate:expert-review-missing:boundary-adequacy` | 29 |
| `publication-gate:expert-review-missing:domain-fidelity` | 29 |
| `publication-gate:expert-review-missing:rights-and-locator` | 29 |
| `publication-gate:expert-review-missing:source-fidelity` | 29 |
| `publication-gate:public-promotion-not-requested` | 29 |
| `publication-gate:publication-date-missing` | 29 |
| `publication-gate:review-state-not-canonical` | 29 |

## Records

| Record | Domain | Release eligible | State |
|---|---|---|---|
| advanced-materials-correlated-insulating-states | advanced-materials | no | `missing-release-decisions` |
| advanced-materials-graphene-monolayers | advanced-materials | no | `missing-release-decisions` |
| advanced-materials-hexagonal-boron-nitride-dielectrics | advanced-materials | no | `missing-release-decisions` |
| advanced-materials-magic-angle-superconductivity | advanced-materials | no | `missing-release-decisions` |
| agentic-systems-mcp-context-window-position-effects | agentic-systems-mcp | no | `missing-release-decisions` |
| agentic-systems-mcp-mcp-prompt-templates | agentic-systems-mcp | no | `missing-release-decisions` |
| agentic-systems-mcp-mcp-resource-discovery | agentic-systems-mcp | no | `missing-release-decisions` |
| agentic-systems-mcp-mcp-tool-result-contracts | agentic-systems-mcp | no | `missing-release-decisions` |
| agentic-systems-mcp-tool-deny-by-default | agentic-systems-mcp | no | `missing-release-decisions` |
| biomolecular-engineering-cell-free-transcription-translation | biomolecular-engineering | no | `missing-release-decisions` |
| biomolecular-engineering-experimental-fold-validation | biomolecular-engineering | no | `missing-release-decisions` |
| biomolecular-engineering-sequence-design-with-proteinmpnn | biomolecular-engineering | no | `missing-release-decisions` |
| circuit-quantum-electrodynamics | quantum-systems | no | `missing-release-decisions` |
| critical-supply-chains-critical-mineral-import-reliance | critical-supply-chains | no | `missing-release-decisions` |
| fusion-plasma-systems-breeding-blanket-test-modules | fusion-plasma-systems | no | `missing-release-decisions` |
| fusion-plasma-systems-disruption-mitigation | fusion-plasma-systems | no | `missing-release-decisions` |
| fusion-plasma-systems-divertor-heat-exhaust | fusion-plasma-systems | no | `missing-release-decisions` |
| fusion-plasma-systems-plasma-diagnostics | fusion-plasma-systems | no | `missing-release-decisions` |
| fusion-plasma-systems-tritium-fuel-cycle | fusion-plasma-systems | no | `missing-release-decisions` |
| mechanistic-interpretability-attention-pattern-evidence | mechanistic-interpretability | no | `missing-release-decisions` |
| mechanistic-interpretability-causal-scrubbing | mechanistic-interpretability | no | `missing-release-decisions` |
| mechanistic-interpretability-in-context-learning-circuits | mechanistic-interpretability | no | `missing-release-decisions` |
| mechanistic-interpretability-induction-head-circuits | mechanistic-interpretability | no | `missing-release-decisions` |
| mechanistic-interpretability-sae-encoder-decoder | mechanistic-interpretability | no | `missing-release-decisions` |
| mechanistic-interpretability-sparse-autoencoder-dictionaries | mechanistic-interpretability | no | `missing-release-decisions` |
| neurotechnology-bci-spike-sorting-boundaries | neurotechnology-bci | no | `missing-release-decisions` |
| quantum-error-mitigation | quantum-systems | no | `missing-release-decisions` |
| stabilizer-syndrome-measurement | quantum-systems | no | `missing-release-decisions` |
| surface-code-error-correction | quantum-systems | no | `missing-release-decisions` |
| transmon-qubit | quantum-systems | yes | `ready-for-initial-canonical-release` |

Release readiness is never inferred from a compiled or eligible substantial page. A canonical release additionally requires scoped review decisions on the exact record revision and a separately authenticated human release authority. Internal-editorial decisions create an explicitly labelled internal-review tier; external expert review is an optional upgrade. This module observes and reports; it never creates a decision, never mutates a release and never repairs an evidence mapping.
