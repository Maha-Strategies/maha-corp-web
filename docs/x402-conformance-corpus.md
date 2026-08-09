# x402 v2 conformance corpus

This is a vendor-neutral set of deterministic fixtures for x402 v2 HTTP, exact EVM/EIP-3009, Bazaar discovery, settlement, and receipt behavior. It is intended for SDK, resource-server, facilitator, crawler, and CI implementations—not for Maha-specific product tests.

Public artifacts after deployment:

- Corpus: `https://www.mahastrategies.com/conformance/x402-v2/corpus.json`
- JSON Schema: `https://www.mahastrategies.com/conformance/x402-v2/corpus.schema.json`
- Declaration-integrity proposal schema: `https://www.mahastrategies.com/conformance/x402-v2/declaration-integrity.schema.json`
- Declaration-integrity test vectors: `https://www.mahastrategies.com/conformance/x402-v2/declaration-integrity-vectors.json`
- Source: `public/conformance/x402-v2/`

The corpus is Apache-2.0 to match the upstream x402 project and permit reuse across implementations.

## What the first release covers

The `0.1.0` corpus contains deterministic cases for:

- a valid v2 `PAYMENT-REQUIRED` challenge, including an exact base64 wire value;
- a valid EIP-3009 payment with a real recoverable EIP-712 signature;
- malformed CAIP-2 identifiers;
- network, token, payee, and amount mismatches;
- an expired authorization and a replayed nonce;
- a crawler example that incorrectly receives HTTP 400 instead of 402;
- invalid Bazaar examples and invalid JSON Schemas;
- a stale live-versus-indexed Bazaar declaration;
- an ambiguous settlement timeout where automatic retry is unsafe; and
- missing and malformed `PAYMENT-RESPONSE` receipts.

All time-dependent cases use the corpus-level `evaluationTime` rather than the wall clock. No chain access, funded wallet, facilitator, or production endpoint is required. The signature fixture contains no private key and controls no funded account.

## Expected-result contract

Every fixture declares four portable outputs:

- `verdict`: `accept`, `reject`, `warn`, or `indeterminate`;
- `phase`: where the result must be recognized;
- `code`: a stable corpus code independent of vendor error text; and
- `retry`: whether retrying is safe, unsafe, requires correction, or is irrelevant.

This deliberately does not require facilitators to return identical prose. Implementations can map their native errors to the corpus codes while preserving their public API.

## Run the reference implementation

```bash
npm run x402:conformance
npm run x402:conformance -- --fixture payment.valid.eip3009
npm run x402:conformance -- --json
npm run x402:conformance -- --list
```

The TypeScript reference evaluator is in `lib/x402/conformance.ts`. It verifies the deterministic EIP-712 signature with Viem, validates Bazaar declarations with the official `@x402/extensions` validators, compares live and indexed declarations canonically, and enforces the receipt and retry-safety rules.

## Adapting another SDK or facilitator

1. Fetch or vendor `corpus.json` and validate its envelope with `corpus.schema.json`.
2. Map each fixture layer to the implementation boundary under test.
3. Evaluate at the fixture's `evaluationTime`; never substitute the current wall clock.
4. Resolve `paymentFixture` and `requirementFixture` references by fixture ID.
5. Map the implementation's native result to `verdict`, `phase`, `code`, and `retry`.
6. Fail CI on a mismatch and report native diagnostic text separately.

The valid payment fixture proves cryptographic interoperability but intentionally does not simulate balance or contract state. An integration suite should add a chain-backed settlement test after these deterministic checks pass.

## Contribution policy

Fixture changes are versioned. A new failure mode adds a fixture and normally increments the corpus minor version. A breaking envelope or expected-result change increments the major version. Corrections that do not change the intended assertion increment the patch version.

Each new fixture should be minimal, deterministic, vendor-neutral, linked to a normative specification or a reproducible interoperability defect, and explicit about retry safety. Production wallet keys, merchant addresses, private endpoints, and provider-specific credentials must never appear in the corpus.
