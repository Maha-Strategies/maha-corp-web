# Frontier source-alignment Batch 10 internal review

Review `maha-frontier-alignment-batch/10.1` · digest `sha256:30946bb235a3c83a28d3fad99b58e14cfee2c0bc5660ccc5f8a565c598cc4be9`

This is a separate internal-editorial review pass over the immutable Batch 10 remediation packets. It is not external review, independent reproduction, canonical adoption, or release authority. Accepted decisions create private candidate digests only. Eight relevant replacement sources require record revision because the generated record kind overstates or misclassifies what the source supports. No source warranted a forced rejection in this pass.

| Measure | Count |
| --- | --- |
| reviewed | 20 |
| accepted | 12 |
| revise | 8 |
| rejected | 0 |
| acceptedCandidateRevisions | 12 |
| canaryCandidateRevisions | 5 |
| canonicalMutationsAuthorized | 0 |
| publicProjectionsAuthorized | 0 |
| releasesAuthorized | 0 |

## Decisions

| Record | Decision | Claim scope | Version relationship | Action |
| --- | --- | --- | --- | --- |
| `advanced-materials-contact-resistance-in-2d-devices` | `accept` | `supports-exact-bounded-claim` | `exact-version-of-record` | Do not infer a universal resistance value or validated performance for every contact stack. |
| `advanced-materials-moire-superlattices` | `revise` | `record-revision-required` | `exact-version-of-record` | Revise recordKind and claimKind to model or concept before adopting the source; preserve the twist-angle and material-system limits. |
| `advanced-materials-tmd-monolayers` | `revise` | `record-revision-required` | `verified-related-prepublication-manuscript` | Revise the record to measurement or concept and retain the MoS2, layer-count, and spectroscopy limits. |
| `advanced-materials-topological-insulator-surface-states` | `revise` | `record-revision-required` | `verified-related-prepublication-manuscript` | Revise recordKind to concept and distinguish review synthesis from a single empirical result. |
| `advanced-materials-twist-angle-control` | `revise` | `record-revision-required` | `exact-version-of-record` | Revise recordKind to method and restrict the claim to the reported in-situ manipulation and aligned graphene/hBN devices. |
| `agentic-systems-mcp-least-authority-tokens` | `accept` | `supports-exact-bounded-claim` | `exact-version-of-record` | Adopt only as a private candidate and retain the limitation that the design does not prove every deployment secure. |
| `agentic-systems-mcp-sandboxed-tool-execution` | `accept` | `supports-exact-bounded-claim` | `exact-versioned-preprint` | Label the source as a preprint and prohibit claims of complete isolation, universal threat coverage, or production readiness. |
| `agentic-systems-mcp-tool-result-context-injection` | `accept` | `supports-exact-bounded-claim` | `exact-versioned-preprint` | Keep the preprint and benchmark scope explicit; do not infer universal MCP vulnerability or universal mitigation efficacy. |
| `biomolecular-engineering-enzyme-cascade-engineering` | `accept` | `supports-exact-bounded-claim` | `exact-version-of-record` | Keep the claim bounded to the constructed in-vitro cascade and reported optimization conditions. |
| `critical-supply-chains-fluorinated-resist-components` | `accept` | `supports-exact-bounded-claim` | `exact-version-of-record` | Do not widen one material family into a complete commercial supply-chain or all-resist performance claim. |
| `critical-supply-chains-quartz-crucible-manufacturing` | `accept` | `supports-exact-bounded-claim` | `exact-patent-publication` | Identify the evidence as a patent disclosure, not independent proof of yield, adoption, or comparative superiority. |
| `critical-supply-chains-semiconductor-grade-polysilicon` | `revise` | `record-revision-required` | `exact-government-artifact` | Revise the record to a concept or define a named refining/deposition method; preserve the 1984 chronology and prohibit current-market inference. |
| `fusion-plasma-systems-edge-localized-modes` | `accept` | `supports-exact-bounded-claim` | `exact-versioned-preprint` | Label the source as a preprint and restrict the record to the observed suppression regime and named devices. |
| `fusion-plasma-systems-electron-cyclotron-heating` | `revise` | `record-revision-required` | `exact-authoritative-artifact` | Revise recordKind to mechanism or supply an independently supported comparison axis and both sides. |
| `fusion-plasma-systems-magnetic-mirror-confinement` | `accept` | `supports-exact-bounded-claim` | `exact-government-artifact` | Keep the historical experiment and planned-program boundaries; do not infer modern plant feasibility. |
| `fusion-plasma-systems-neutral-beam-injection` | `revise` | `record-revision-required` | `exact-authoritative-artifact` | Revise recordKind to mechanism and keep design values separate from measured outcomes. |
| `fusion-plasma-systems-plasma-position-and-shape-control` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | Record the living-page status and avoid inventing one controller result, uncertainty interval, or universal control law. |
| `mechanistic-interpretability-circuit-completeness` | `accept` | `supports-exact-bounded-claim` | `exact-versioned-preprint` | Keep the GPT-2-small, task, prompt-distribution, and documented-gap boundaries explicit. |
| `mechanistic-interpretability-cross-layer-transcoders` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | Retain reconstruction error, missing mechanisms, living-page status, and non-completeness limitations. |
| `mechanistic-interpretability-io-identification-circuit` | `revise` | `record-revision-required` | `exact-versioned-preprint` | Revise recordKind to concept or method unless a bounded comparison and both supported sides are added. |

## Five-record private canary

Canary digest `sha256:66799073ecd764e0754f586c386d847c621daf014c021026e546c88fa3436371`

| Record | Candidate revision | Provenance | State |
| --- | --- | --- | --- |
| `agentic-systems-mcp-least-authority-tokens` | `sha256:983bae94fec4cd68f1bd2cd8c76c6fd7cc366336d49704515e27811643f2a5f8` | `sha256:a1baeb0fce884e77e0a474d7c3204ca0e8422d67c3e05b11ff39bb5defa3cb13` | `private-candidate-only` |
| `biomolecular-engineering-enzyme-cascade-engineering` | `sha256:b4d7abf5183a48c4feac6428b46cf84047e9fb4f4dd1bfd6dbf0e02a5c97f514` | `sha256:b5c8a1fd0878e414718200b5f6650f356cc6cd3e28d03f6ef9884ce8b346aeba` | `private-candidate-only` |
| `critical-supply-chains-fluorinated-resist-components` | `sha256:8a7daa18e51c4083c09a6674d32d192d14480b0611a696a2cd60977e0ea47315` | `sha256:f79a8cbd2e0b4888adebda7853036539c6ec5cb4a18c26398783b6feefb9a1df` | `private-candidate-only` |
| `fusion-plasma-systems-magnetic-mirror-confinement` | `sha256:e1f4ce3de8e409fb66d2f8441f6e1445bf47aec7847a6926d963c2235b5a5a20` | `sha256:ed9155cab700ff9b1e79ef069e71d24319c9bedc7b1761f82b95f2c0321748c6` | `private-candidate-only` |
| `mechanistic-interpretability-circuit-completeness` | `sha256:0075e78a405340b24fa06dccc8e2cbfde16428f6cacdb03b797612d64a6031e6` | `sha256:6e862dac25ae9ca1f01f97d9e8fc2e6d8bac7520edb05645cae9007b0551a8c9` | `private-candidate-only` |

## Boundaries

- A decision is append-only and remains bound to the packet digest, active record revision, and active source contract it reviewed.
- Revise, reject, missing, stale, or tampered decisions fail closed in the candidate compiler.
- Accepted candidates are private source-binding revisions, not canonical records, source overrides, or releases.
- No source text, credential, database row, public route, sitemap entry, or llms.txt entry is created.
