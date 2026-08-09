# x402 Doctor

`x402-doctor` is a read-only-by-default conformance and discovery diagnostic for x402 resource servers. It is motivated by a production failure mode: a seller can publish a correct live declaration while Bazaar continues to serve stale metadata, or can publish a valid-looking input example that the crawler receives as HTTP 400 instead of 402.

The doctor also implements the draft [`declaration-integrity` proposal](./x402-declaration-digest-proposal.md). When a seller and catalog expose the proposed digest, it independently hashes the live declaration and compares that value with the catalog-computed indexed digest. Reports label this source as `catalog`. Until catalogs support the proposal, the existing field-normalization comparison remains available and is explicitly labeled `reconstructed`.

## Read-only inspection

```bash
npm run x402:doctor -- \
  https://www.mahastrategies.com/api/v1/compress \
  --method POST
```

Machine-readable output:

```bash
npm run x402:doctor -- https://seller.example/resource --format json
npm run x402:doctor -- https://seller.example/resource --format sarif --output x402-doctor.sarif
```

For an endpoint whose initial request needs a body, pass JSON directly or from a file. The report never includes the body.

```bash
npm run x402:doctor -- https://seller.example/resource \
  --method POST \
  --body @fixtures/discovery-request.json
```

## One bounded paid canary

Payment is impossible unless all three controls are supplied: `--pay`, a positive base-unit ceiling, and a dedicated EVM private key. The live requirement is compared with the previously diagnosed requirement immediately before signing. Any read-only conformance error skips payment.

```bash
export X402_BUYER_PRIVATE_KEY='0x...dedicated-canary-key...'
npm run x402:doctor -- https://seller.example/resource \
  --method POST \
  --pay \
  --max-amount 1000
```

`--max-amount` is denominated in the asset's smallest unit. It is intentionally not inferred from a floating-point dollar value.

## Exit codes

- `0`: no errors; warnings are permitted unless `--fail-on-warning` is set.
- `1`: conformance errors, or warnings under `--fail-on-warning`.
- `2`: invalid CLI configuration or an unrecoverable invocation error.

## Stale metadata and a future protocol improvement

The doctor currently canonicalizes `{ resource, description, mimeType, accepts, extensions }` and compares SHA-256 digests across the live challenge and Bazaar record. A future x402 extension could standardize this as a declaration digest plus metadata version. Catalogs could then reject or refresh stale seller metadata without requiring an unrelated paid call solely to trigger re-indexing.
