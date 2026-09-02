# NS Goods composite preflight v2 — fixture-only validation

Maha reviewed the frozen `preflight_v2` contract before any live endpoint was
built or any paid call was authorized. The local verifier is offline: it reads
only archived public artifacts and performs no request, payment, transaction or
production mutation.

## Pinned boundary

The archive under `fixtures/x402-composite-preflight-v2/` contains:

- the provider's v2 JSON Schema and human-readable contract;
- the provider's `DIGEST` file and exact five frozen fixtures;
- the proof manifest that authorizes the composite signer; and
- the four superseded v1 fixtures used only to prove cross-version rejection.

The v2 `DIGEST` declares SHA-256
`686f1673d13f9efccaef02d44a591768f98e894dabfc0a87a0de6e59f874aef2`
over the concatenated bytes of the five fixtures followed by the schema. Maha
recomputes the individual and combined digests rather than trusting that claim.

## Verification

Run from the repository root in an environment with `jsonschema` and
`eth-account` installed:

```bash
python scripts/verify-x402-composite-preflight-v2.py
```

The verifier checks:

1. every digest in the provider's `DIGEST` and the combined digest;
2. the active `preflight` signer authorization in the pinned proof manifest;
3. all five fixtures against the Draft 2020-12 schema;
4. nine component digests and EIP-191 signatures;
5. three whole-envelope EIP-191 signatures;
6. exact subject equality and `components_evaluated` consistency;
7. the unsigned, uncharged HTTP 400 and 503 refusal boundaries;
8. seven tamper/fail-closed cases; and
9. rejection of all four archived v1 fixtures by the v2 schema.

The envelope signature is verified over the complete response after removing
only `envelope.signature`; component signatures and digests remain inside that
signed payload. Component signatures are verified separately after removing
only `component_digest` and `component_signature` from that component.

## Result and limits

The sanitized result is preserved at
`content/integrations/x402-preflight-v2-fixture-audit.json`. This run is
**blocked**: the HTTP 400 and 503 branches in the published v2 schema omit
`additionalProperties: false`. Both therefore accept an injected `envelope`,
contrary to the accompanying contract's claim that every object rejects unknown
fields. Maha's consumer checks still reject those objects, but consumer-side
compensation does not repair the provider contract.

The provider should not build against v2. The correction should be published at
a new immutable schema and fixture version, with the refusal fields explicitly
declared and `additionalProperties: false` applied to both refusal branches.
Maha should then rerun this audit before authorizing endpoint implementation.
Even a future passing fixture audit would not authorize a paid call or establish
current payability, sanctions status, reputation, endpoint availability or
production correctness. The implemented endpoint remains a separate review
gate.

Two of the five fixtures are refusal bodies and are intentionally unsigned:
`invalid-subject.json` (HTTP 400) and `signing-unavailable.json` (HTTP 503).
The three successful composite fixtures carry twelve signatures in total: nine
component signatures and three envelope signatures.

The `partial-not-evaluated` fixture includes a provider-declared synthetic
condition because an actual oracle outage was not externally forced. The audit
verifies its contract and signature; it does not convert the synthetic condition
into an observed production outage.
