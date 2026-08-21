# x402 Doctor

`x402-doctor` is a read-only-by-default conformance and discovery diagnostic for x402 resource servers. It is motivated by a production failure mode: a seller can publish a correct live declaration while Bazaar continues to serve stale metadata, or can publish a valid-looking input example that the crawler receives as HTTP 400 instead of 402.

Each inspection also issues one unauthenticated `GET` to an intentionally
impossible path on the same host. This is a negative control for route
existence, not a resource probe: it has no request body, credentials, or
payment header. Reports classify the protected resource as:

- `confirmed` when the protected resource returns `402` and the impossible
  path returns `404` or `410`;
- `absent` when the declared resource itself returns `404` or `410`; or
- `uninformative` when the host gates before routing (`402` on both paths),
  returns a soft `200` to the impossible path, or returns another ambiguous
  response.

`confirmed` means the route was distinguishable at the time of the probe. It
does not claim a registry has indexed it, a payment will settle, or that a
future probe will match.

## Public live-adapter evidence

The [versioned live-adapter result artifact](/conformance/x402-v2/x402-doctor-live-adapter-results.json)
and its [JSON Schema](/conformance/x402-v2/x402-doctor-live-adapter-results.schema.json)
exercise the three meaningful same-host control outcomes: route-confirming
`404`, payment-gated `402`, and soft `200`. It is deliberately a synthetic,
in-memory transport run. It proves the adapter's classification behavior, not
the state of a public host, registry listing, third-party client behavior, or
payment settlement.

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
