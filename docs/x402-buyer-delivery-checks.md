# Repeatable buyer-delivery checks v0.1

This is an **offline verifier of a saved buyer-local capture**, not a payment client or historical delivery reconstruction service. It does not repurchase a product, contact a model, load credentials, acknowledge a delivery to a server, query a chain, or change listings.

## Replay a saved exchange

Run from the repository root after installing its locked dependencies:

```sh
npm run verify:x402-buyer-delivery -- \
  --capture /absolute/path/capture.json \
  --request /absolute/path/request.json \
  --response /absolute/path/response.json \
  --expected-capture-sha256 sha256:<independently-preserved-capture-file-digest>
```

The three files are exact UTF-8 JSON bytes. Never pretty-print or reserialize them after hashing. The manifest is:

```json
{
  "schemaVersion": "maha-buyer-capture/0.1",
  "provenance": "buyer-local",
  "offerId": "context-compression",
  "method": "POST",
  "resourcePath": "/api/v1/compress",
  "httpStatus": 201,
  "requestSha256": "sha256:<64 lowercase hex characters>",
  "responseSha256": "sha256:<64 lowercase hex characters>"
}
```

The placeholders above are not runnable evidence. The Certen demo below produces a complete runnable synthetic set.

Use `createBuyerCapture` in `lib/x402/buyer-delivery-check.ts` to construct the manifest from actual captured bytes and status. Existing `captureResponseBody` in `lib/x402/canary-response-capture.ts` saves a response before validation and uses mode `0600`; its bare `sha256` value needs the `sha256:` prefix when used here. Capture the request bytes before sending and use the exact same bytes for the send and the commitment. No integration with live payment scripts is enabled by this change.

Preserve the SHA-256 of the exact manifest file in an independently controlled, contemporaneous record. A digest recalculated from possibly altered files is **not** a trust anchor. Neither a self-generated manifest nor a hash proves the identity of its author. An authentic signature, trusted buyer-side storage or independently authenticated acknowledgment would be a separate integration.

## Results and exit codes

| State | Exit | Meaning |
| --- | --- | --- |
| `payload_verified` | 0 | Pinned bytes match; request/offer and declared success-body checks pass. |
| `pending` | 2 | HTTP 202 or a processing job. The final deliverable has not been verified. |
| `rejected` | 1 | Missing/altered bytes, bad JSON/schema/binding, HTTP error/402, failed or incomplete result. |

CLI setup/read failures also exit 1. Reports omit payload bodies, validation values, and retrieval tokens. Keep raw files private: responses can contain copyrighted text, submitted material, or retrieval credentials. Hashes are commitments, not anonymization. Do not upload real captures to public Git or logs.

The checker uses the **current checkout's full offer schemas**, not a compact Bazaar example. Record the Git revision with real captures and retain that revision for future verification; future schema changes may reject older payloads. Coverage includes all 11 offers. Job envelopes alone are not finished MPS/Research Intake products; book section IDs must match the request, and a full-edition discovery placeholder (`exampleOnly: true`) is rejected.

For a pending paid job, use the product's documented authenticated retrieval path and preserve the original job/retrieval credentials locally. Do not repeat a paid POST just to obtain delivery evidence. This v0.1 command checks original purchase-response contracts; a separately retrieved response may have a different envelope and needs its own adapter before being accepted here.

## Honest boundary

`payload_verified` is limited to local byte integrity, declared shape and exposed request/offer identifiers. It does **not** independently recompute every product-specific embedded digest, replay the computation, prove substantive quality, prove an agent consumed the result, or authenticate a remote buyer. Settlement always remains `not_checked`; indexing is separate. A historical settlement with no contemporaneous buyer capture remains **delivery unconfirmed**.

No live routes, prices, acknowledgment API, wallet, database or scheduled job are changed. The separate unmerged transaction-bound server-receipt work is not silently incorporated.

## Repeatable regression gate

```sh
node --test --experimental-strip-types test/x402-buyer-delivery-check.test.ts test/certen-synthetic-example.test.ts
npm run demo:certen-evidence
```

The existing `npm test` quality gate automatically includes these tests. They exercise all 11 declared products synthetically (local book builders for actual section/edition shapes; catalog fixtures for model-backed products). They make no provider calls or payments. Passing is not an uptime, live settlement, or organic-customer claim.
