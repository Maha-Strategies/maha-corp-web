# Context Compiler proof-contract v3.1 addendum

Status: normative clarification of proof contract v3. It does not change the public Context Compiler response, the v3 wire shape, or any previously validated fixture byte.

## Immutable checkpoint

The six files named in `test/fixtures/context-proof-addendum-v3.1/index.json` are the frozen checkpoint already validated by the independent prover implementation. Their SHA-256 file digests are pinned in that index and in regression tests. Regeneration of this addendum must fail review if any frozen digest changes.

## Hash preimages

All hash strings use `sha256:<64 lowercase hex>`. Hash bytes are the 32-byte SHA-256 digest; the `sha256:` prefix is an external encoding and is not part of any preimage.

### Source and passage hashes

`sourceHash` is SHA-256 over the UTF-8 bytes of `normalized_source_v1`. That normalization, in order, is:

1. replace CRLF or bare CR with LF;
2. replace each non-empty run of spaces or tabs with one ASCII space;
3. replace each run of three or more LF characters with two LF characters; and
4. trim leading and trailing ECMAScript whitespace.

No Unicode normalization form is applied. `passageHash` is SHA-256 over the exact UTF-8 passage bytes selected from that normalized source by the half-open byte range `[sourceStartByte, sourceEndByte)`.

### Production `inputHash`

This is not RFC 8785/JCS. Its preimage is the UTF-8 encoding of ECMAScript `JSON.stringify` applied to an explicitly constructed object with this property order:

```json
{"task":"...","tokenBudget":128,"documents":[{"id":"release","title":"Release control","hash":"sha256:..."}]}
```

The top-level order is `task`, `tokenBudget`, `documents`. Each document order is `id`, `title`, `hash`; array order is request order. If `title` is absent, `JSON.stringify` omits that property. `hash` is the normalized `sourceHash` above. There is no trailing newline.

The production commitment deliberately excludes `clientRequestId`, `provenance`, `scoring`, and `budgetMode`. Consequently, `inputHash` must not be described as binding those fields. Their effect on a result is instead observable through the separately bound output. `recomputeContextCompilerInputHash()` is the executable reference.

### Production `outputHash`

The preimage is the exact UTF-8 byte sequence of the rendered Context Pack markdown, with no JSON wrapper, normalization, or trailing newline added by the hash function. `recomputeContextCompilerOutputHash()` is the executable reference.

## Token-accounting claim matrix

This table states the checks the v3 contract requires from an accepting guest. It does not assert that an external implementation has completed its current token-field audit; that must be reported separately by the guest author.

| Field or relationship | v3 proof claim |
| --- | --- |
| Every retained passage has a non-negative integer `reportedEstimatedTokens` | Checked input validity. |
| `retainedPassageReportedTokens` equals the sum of retained reported counts | Proved. |
| `retainedPassageReportedTokens <= compilerSelectionBudget` | Proved. |
| `compiledContextReportedTokens <= compilerSelectionBudget` | Proved over the supplied reported count. |
| `compilerSelectionBudget` equals the declared budget in `estimated` mode or `floor(0.72 * declaredTokenBudget)`, minimum 1, in `guaranteed` mode | Proved. |
| `includedPassageCount` equals the retained record count | Proved. |
| Maha's estimator produced each reported count correctly | Not proved in v3. |
| `compiledContextReportedTokens` was independently recomputed from private markdown | Not proved in v3. |
| Compatibility with an Anthropic, OpenAI, or other provider tokenizer | Not proved. |
| Provider-token budget or billing amount | Not guaranteed. |

Every success result therefore retains `reportedTokenArithmeticValid: true`, `tokenEstimatorVerified: false`, and `providerTokenBudgetGuaranteed: false`.

## Rejection public values

A rejection has no success-shaped `expectedPublicValues`, no proof, and no proof charge. The machine-readable index proposes the complete minimal public records for the two current rejections:

- `unsupported_passage_count`: contract version, status, stable reason code, observed retained count, supported maximum, `proofAttempted: false`, and `chargePermitted: false`.
- `rejected_invalid_retained_set`: contract version, status, stable reason code, `proofAttempted: false`, and `chargePermitted: false`.

Neither record repeats input/output hashes, coverage, or token metrics from a stale success object. These shapes are the Maha proposal for the guest author to confirm before they become a new wire-contract version.

## Partial-coverage fixture

`partial-coverage-3-of-4/fixture.json` uses the unchanged v3 envelope. It contains four sanitized single-passage sources, retains the three relevant control sources, omits the irrelevant office note, and expects source coverage `3 / 4 = 7,500` basis points. It exercises coverage arithmetic without changing the validated N=70/N=128 checkpoint.

Generate it with `npm run generate:context-proof-addendum` and validate it with the normal fixture validator plus the regression suite.
