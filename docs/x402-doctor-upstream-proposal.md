# Proposal: x402-doctor CLI for crawler replay and Bazaar drift detection

## Problem

Seller-side Bazaar metadata can be valid while the resource remains undiscoverable or the catalog serves a stale declaration. Existing validation catches malformed declarations, but it does not reproduce the exact declared crawler request, compare the live `PAYMENT-REQUIRED` declaration with the current Bazaar record, or provide CI output.

A real failure mode is:

1. A seller changes a description or schema.
2. The live 402 is correct.
3. The Bazaar record remains stale until another successful settlement and indexing pass.
4. Neither the seller nor CI can distinguish live-contract drift from a malformed crawler request.

A second common failure is a POST resource returning HTTP 400 to the request declared in `extensions.bazaar.info.input`, preventing indexing even though ordinary unpaid requests return 402.

## Proposal

Add a read-only-by-default `x402-doctor` CLI, with an optional GitHub Action, that:

- requests a protected endpoint without payment and requires HTTP 402;
- decodes and validates the v2 `PAYMENT-REQUIRED` header;
- validates CAIP-2 network IDs, asset and payee addresses, positive base-unit price, timeout, Bazaar examples, and JSON Schema using the existing extension validators;
- replays the HTTP request declared in `extensions.bazaar.info.input` and requires HTTP 402 rather than an accidental 400;
- inspects observable `EXTENSION-RESPONSES`;
- fetches the Bazaar merchant record and compares a canonical digest of `resource`, `description`, `mimeType`, `accepts`, and `extensions`;
- warns when the live and indexed declarations differ; and
- emits human, JSON, and SARIF reports.

An optional paid probe should require an explicit flag, an integer base-unit ceiling, and a dedicated key. It must re-check live terms immediately before signing, make at most one payment, and skip settlement whenever read-only conformance checks fail.

## Non-goals

- Replacing existing Bazaar extension validation.
- Facilitator or chain conformance testing.
- Paying by default.
- Treating a missing `EXTENSION-RESPONSES` header on seller responses as a failure, since facilitator headers may not be forwarded.

## Follow-up protocol idea

A later extension could standardize a declaration digest and metadata version. Catalogs could then detect stale seller metadata without requiring an unrelated paid call solely to trigger re-indexing.

There is a working TypeScript prototype with tests for valid discovery, crawler HTTP 400, stale metadata, v1 header warnings, bounded settlement injection, JSON output, and SARIF. It can be adapted to the x402 repository's TypeScript package conventions if maintainers agree with the scope.

