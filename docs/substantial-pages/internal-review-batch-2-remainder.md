# Batch 2 internal review — remaining 22 records

These are record-specific AI-assisted internal editorial decisions with the publisher conflict disclosed on every decision. They are not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification. External expert review remains an optional append-only upgrade.

Digest: `sha256:59c0ea47293098014ccaa8bd45f78b19e5b224473327f436dedcd443a582dcc9`

## Counts

| Set | Records |
|---|---|
| reviewed | 22 |
| approved | 20 |
| rejected | 0 |
| revise-and-rereview | 2 |
| blocked | 0 |
| initial-release candidates | 19 |
| superseding-release candidates | 1 |
| recorded review decisions | 80 |
| criterion decisions | 240 |
| still withheld | 2 |

Released records are reported by the production operator, not by this artifact: publication is an operational fact and is recorded in the append-only observation.

## Withheld records

### `agentic-systems-mcp-tool-deny-by-default` — revise-and-rereview

Blockers: `claim-not-supported-by-cited-source`, `source-boundary-contradicts-claim`, `comparison-kind-without-comparative-evidence`

- **source-fidelity / claim-source-alignment unsatisfied.** The bound source is the MCP core specification, and that source contract states in its own boundary that “A protocol primitive does not prescribe an organization’s allowlist, identity, retention, or approval policy.” Deny-by-default for tool invocation is precisely an approval and allowlist policy, so the cited location does not support the claim. No inspected specification text establishing a default-deny requirement was found.
- **domain-fidelity / scope-transfer unsatisfied.** The record is typed as a comparison, but the specification reports no comparison between default-deny and default-allow tool exposure. Presenting a security posture as source-supported by a protocol definition transfers the claim outside the cited scope.

**Remediation.** Either narrow the wording to what the specification does say — that the protocol negotiates tool capabilities and that its security section places consent and authorisation decisions with the host — and re-type the record away from comparison; or bind a security-policy source that actually prescribes default-deny, then re-inspect and re-review at the new exact locator. Until direct inspected source text supports a default-deny requirement, the record stays withheld.

### `fusion-plasma-systems-breeding-blanket-test-modules` — revise-and-rereview

Blockers: `locator-does-not-name-claimed-subject`, `measurement-kind-without-measured-quantity`

- **source-fidelity / claim-source-alignment unsatisfied.** The bound locator covers “heating and current drive, fuel cycle, vacuum, cryogenic, diagnostics, and tritium breeding system summaries.” It names neither breeding blankets nor test blanket modules. Treating a tritium-breeding system summary as support for a test-module record requires an inference the inspected location does not carry.
- **domain-fidelity / mechanism-and-method unsatisfied.** The record is typed as a measurement, but the cited page is a supporting-systems inventory whose own boundary states that a system inventory is not evidence of integrated operation. An inventory entry supplies no measurement.

**Remediation.** Bind an ITER source that names the Test Blanket Module programme directly and inspect it at that section, or re-scope the record to the tritium breeding system summary the current locator does cover and re-type it away from measurement. Sibling fusion records sharing this page were approved only where the locator names their subject — diagnostics and fuel cycle do, blanket test modules do not.

## Approved records

| Record | Domain | Release kind | Scoped decisions | Criterion decisions |
|---|---|---|---|---|
| advanced-materials-correlated-insulating-states | advanced-materials | initial | 4 | 12 |
| advanced-materials-magic-angle-superconductivity | advanced-materials | initial | 4 | 12 |
| agentic-systems-mcp-mcp-prompt-templates | agentic-systems-mcp | initial | 4 | 12 |
| agentic-systems-mcp-mcp-resource-discovery | agentic-systems-mcp | initial | 4 | 12 |
| biomolecular-engineering-experimental-fold-validation | biomolecular-engineering | initial | 4 | 12 |
| biomolecular-engineering-sequence-design-with-proteinmpnn | biomolecular-engineering | initial | 4 | 12 |
| circuit-quantum-electrodynamics | quantum-systems | initial | 4 | 12 |
| critical-supply-chains-critical-mineral-import-reliance | critical-supply-chains | initial | 4 | 12 |
| fusion-plasma-systems-divertor-heat-exhaust | fusion-plasma-systems | initial | 4 | 12 |
| fusion-plasma-systems-plasma-diagnostics | fusion-plasma-systems | initial | 4 | 12 |
| fusion-plasma-systems-tritium-fuel-cycle | fusion-plasma-systems | initial | 4 | 12 |
| mechanistic-interpretability-attention-pattern-evidence | mechanistic-interpretability | initial | 4 | 12 |
| mechanistic-interpretability-in-context-learning-circuits | mechanistic-interpretability | initial | 4 | 12 |
| mechanistic-interpretability-induction-head-circuits | mechanistic-interpretability | initial | 4 | 12 |
| mechanistic-interpretability-sae-encoder-decoder | mechanistic-interpretability | initial | 4 | 12 |
| mechanistic-interpretability-sparse-autoencoder-dictionaries | mechanistic-interpretability | initial | 4 | 12 |
| neurotechnology-bci-spike-sorting-boundaries | neurotechnology-bci | superseding | 4 | 12 |
| quantum-error-mitigation | quantum-systems | initial | 4 | 12 |
| stabilizer-syndrome-measurement | quantum-systems | initial | 4 | 12 |
| surface-code-error-correction | quantum-systems | initial | 4 | 12 |
