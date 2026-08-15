# Context Compiler proof-fixture contract

Status: fixture contract validated; public Context Compiler response unchanged; proof guest not yet accepted.

## Purpose

The sidecar exporter binds the existing Context Compiler result to a private proof witness without changing `POST /api/v1/compress`. It is deliberately a validation boundary, not a claim that the current zkVM prototype can already prove Maha's production result.

The checked-in bundles live under `test/fixtures/context-proof/`:

| Bundle | Expected decision | Purpose |
| --- | --- | --- |
| `representative-n70` | `success` | Published four-source workload retaining 70 passages. |
| `boundary-n128` | `success` | Exact supported retained-passage boundary. |
| `unsupported-n129` | `unsupported_passage_count` | No proof attempt and no charge above the boundary. |
| `duplicate-retained-set` | `success` | Valid exact duplicate plus an adversarial mutation that retains both copies and must fail. |

Regenerate with `npm run generate:context-proof-fixtures` and validate with `npm run validate:context-proof-fixtures`.

To export a sidecar from any valid Context Compiler request without calling or changing the public route:

```bash
npm run export:context-proof-sidecar -- \
  --input request.json \
  --output proof-fixture.json \
  --fixture-id customer-safe-fixture \
  --description "Sanitized proof-contract validation workload."
```

The exporter refuses to overwrite an existing output file and prints only status/count metadata, never source or passage text.

## Canonical semantics

- Offsets are half-open UTF-8 byte ranges over the exact `normalized_source_v1` string bound by `sourceHash`.
- Hashes use `sha256:<64 lowercase hex>` for source, passage, input and output commitments.
- Passage and normalized-source bytes are private witness values. Public retained-passage records contain identity, source binding, offsets and hashes only.
- Public coverage is represented-source count over total-source count, expressed as numerator, denominator and integer basis points. It is not byte coverage.
- Retained-passage order is the compiler output order. The proof does not rerank passages or claim BM25 correctness.
- Deduplication proves only that retained passage hashes are pairwise unique. It does not prove candidate-set completeness.
- Token arithmetic is checked over Maha-reported counts. The proof must state `tokenEstimatorVerified: false` and `providerTokenBudgetGuaranteed: false`; it does not reproduce a provider tokenizer or prove Maha's estimator.
- More than 128 retained passages returns `unsupported_passage_count` before proving. No proof should be attempted and no proof fee may be charged.

## Current prototype compatibility result

The prototype guest identified by `sha256:2b208e449719961e777c294ce7f78e37eb8d90671156b7cbe424c716e1a896e0` is intentionally marked incompatible with proof-contract version 3. It must be updated before running these fixtures because it currently:

1. recomputes whitespace token counts;
2. derives non-production input and output hashes;
3. performs a new source/offset-order selection instead of validating the compiler-retained set;
4. reports byte coverage rather than source coverage;
5. has no `N > 128` no-proof/no-charge path; and
6. omits the explicit token-estimator non-claims from public values.

Those are contract failures, not fixture failures. The exporter must not imitate them, and the production response must not be changed to accommodate them.

## Acceptance gate for the next guest

A new guest/verifying-key digest is acceptable only when it:

1. executes the three supported fixtures successfully;
2. returns `unsupported_passage_count` for `N=129` without invoking the prover;
3. rejects `adversarial-retained-duplicate.json`;
4. emits public values byte-for-byte equivalent to each fixture's `expectedPublicValues`;
5. retains all explicit non-claims; and
6. reports measured cycle count, wall time, peak memory and proof size for `N=70` and `N=128`.

Until that gate passes, the fixture sidecar is test-only and no proof field belongs in the public Context Compiler response.
