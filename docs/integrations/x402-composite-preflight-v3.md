# NS Goods composite preflight v3 — fixture-only validation

Maha reviewed the frozen `preflight_v3` contract before any live endpoint was
built or any paid call was authorized. The verifier is offline: it reads only
archived public artifacts and performs no request, payment, transaction or
production mutation.

## Provider re-issue

After the first paid canary response was lost before persistence, NSGoods
provided a no-charge, freshly signed envelope for the same declared subject.
Maha preserves the exact 3,673 provider bytes at
`fixtures/x402-composite-preflight-v3/reissues/preflight_v3_reissue_pf_be2a8c76d0e7dcc7.json`
and the bounded verification result at
`public/artifacts/integrations/nsgoods-preflight-v3-reissue-validation-2026-09-03.json`.

The re-issue verifies offline against the pinned v3 schema and signer authority.
It is not the lost original response, contains no settlement evidence, required
no payment, and is not a paid live-implementation canary.

## Pinned boundary

The archive under `fixtures/x402-composite-preflight-v3/` contains the
provider's v3 JSON Schema and human-readable contract, the exact five frozen
fixtures and `DIGEST`, and the proof manifest that authorizes the composite
signer. The earlier v1 and v2 fixtures remain under the v2 audit archive solely
for cross-version rejection tests.

The v3 `DIGEST` declares SHA-256
`cf1e2b16bc626eba01af48d84f1b5026a01d104c993cd097600900c22cf6251f`
over the concatenated bytes of the five fixtures followed by the schema. Maha
recomputes every individual digest and the combined digest.

## Verification

Run from the repository root in an environment with the pinned dependencies:

```bash
python scripts/verify-x402-composite-preflight-v3.py
```

The verifier checks:

1. all six provider-declared file digests and the combined digest;
2. the active `preflight` signer authorization in the pinned proof manifest;
3. all five fixtures against the Draft 2020-12 schema;
4. nine component digests and EIP-191 signatures;
5. three whole-envelope EIP-191 signatures;
6. nine exact subject-equality checks and three
   `components_evaluated` consistency checks;
7. the unsigned, uncharged HTTP 400 and 503 refusal boundaries;
8. nine tamper/fail-closed mutations, including `envelope` and unknown-field
   injection into both refusal branches; and
9. rejection of all four archived v1 fixtures and all five archived v2
   fixtures by the v3 schema.

The envelope signature is verified over the complete response after removing
only `envelope.signature`; component signatures and digests remain inside that
signed payload. Each component signature is verified separately after removing
only `component_digest` and `component_signature` from that component.

## Result and limits

The sanitized result is preserved at
`content/integrations/x402-preflight-v3-fixture-audit.json`. The fixture audit
passed with no findings. The v3 provider contract now rejects injected
envelopes and arbitrary fields in both refusal branches, so the v2 blocking
finding is resolved at the announced immutable version boundary.

This result authorizes NS Goods to build the endpoint against the pinned v3
contract. It does not authorize a paid call or establish current payability,
sanctions status, reputation, endpoint availability or production correctness.
The implemented endpoint remains a separate review gate before Maha sends
funds or relies on a live result.

Two fixtures are intentionally unsigned refusal bodies:
`invalid-subject.json` (HTTP 400) and `signing-unavailable.json` (HTTP 503).
The three successful composite fixtures carry twelve signatures in total: nine
component signatures and three envelope signatures. The
`partial-not-evaluated` fixture contains a provider-declared synthetic condition
because an actual oracle outage was not externally forced.
