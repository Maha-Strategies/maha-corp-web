# x402 Doctor

Checks a live x402 v2 resource before it reaches a discovery catalog. The action:

- requires the unpaid resource request to return HTTP 402;
- decodes `PAYMENT-REQUIRED` and validates v2 payment requirements;
- validates CAIP-2 networks, EVM addresses, positive base-unit prices, and timeouts;
- validates Bazaar examples against their JSON Schema with the official extension validators;
- reproduces the request in `extensions.bazaar.info.input` and catches validation-first HTTP 400 responses;
- inspects observable `EXTENSION-RESPONSES` headers;
- compares a digest of the live declaration with the current Bazaar merchant record; and
- uploads findings as SARIF.

The action is read-only. The CLI has a separately gated paid mode for deliberate release canaries.

```yaml
permissions:
  contents: read
  security-events: write

steps:
  - uses: Maha-Strategies/maha-corp-web/.github/actions/x402-doctor@main
    with:
      endpoint: https://www.mahastrategies.com/api/v1/compress
      method: POST
      fail-on-warning: 'true'
```

The action installs the pinned dependencies from this repository with lifecycle scripts disabled. Reports contain endpoint metadata and declaration digests, never request bodies or wallet secrets.

