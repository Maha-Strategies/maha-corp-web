# Governed Context Verification Pack

Status: implementation only. The SKU is not published, no settlement has been made, and no financial commitment is authorized by this repository change.

## Frozen external contract

The adapter uses `seller-endpoint-call-ticket-v1`, digest `VIBES_CODED_CONTRACT_DIGEST` exported by `lib/vibes-coded-seller.ts`. The digest is SHA-256 over the committed normalized snapshot in that module. The snapshot was derived from the public Vibes-Coded machine index observed on 2026-08-20:

- `https://vibes-coded.com/llms.txt`
- `https://vibes-coded.com/docs/SELLER_ENDPOINT_FIRST_SKU.md`
- `https://vibes-coded.com/publish-endpoint`

The shell could not resolve the live host during implementation, so the checklist body was not copied into the repository. Mayone must re-fetch the checklist and confirm that the verify and receipt request fields match the snapshot before any publish or paid test.

## Product boundary and price

`governed-context-verification-pack` is a separate `$0.50` / `50` cent SKU. It does not reprice or proxy the existing `$0.001` Context Compression or `$0.01` Deep Context Evaluation offers.

The $0.50 value is a fixed package of six outputs:

1. Task-specific extractive context compilation with source IDs, passage IDs, passage hashes, source hashes, deduplication, and token/byte metrics.
2. Exact evidence-retention evaluation against caller-declared source spans.
3. Source-linked provenance in the returned Context Pack.
4. Stable request, compiled-output, evaluation-output, artifact, and delivery-response hashes.
5. Explicit policy and budget results, including limits, observed counts, budget mode, and budget satisfaction.
6. Metadata-only delivery evidence with an idempotent receipt ID and optional `response_sha256`.

The service does not verify factual claims, guarantee completeness, guarantee downstream model behavior, or retain source/result bodies in its paid-call ledger.

## Call contract

Target URL: `POST /api/v1/seller-endpoints/governed-context-verification-pack/call`.

The request body is exactly [governed-context-verification-pack-request.schema.json](/Users/mayonerajan/.codex/worktrees/7354/maha-corp-web/public/governed-context-verification-pack-request.schema.json). It is the existing Context Pack evaluation contract with strict top-level fields: `clientRequestId`, `task`, `tokenBudget`, `documents`, `requiredEvidence`, and optional `provenance`, `scoring`, and `budgetMode`.

The output body is exactly [governed-context-verification-pack-response.schema.json](/Users/mayonerajan/.codex/worktrees/7354/maha-corp-web/public/governed-context-verification-pack-response.schema.json). It contains the compiled pack, evidence statuses, metrics, policy/budget results, limitations, stable hashes, and `sourceTextStored: false`, `compiledContextStored: false`, and `responseBodyStored: false` declarations.

Sanitized example:

```json
{
  "clientRequestId": "demo-governed-001",
  "task": "Check the rollback condition and preserve provenance.",
  "tokenBudget": 256,
  "documents": [{"id":"runbook","title":"Release runbook","text":"Rollback begins when error rate exceeds two percent for five minutes."}],
  "requiredEvidence": [{"evidenceId":"rollback-condition","sourceId":"runbook","text":"Rollback begins when error rate exceeds two percent for five minutes."}],
  "provenance": "compact",
  "scoring": "bm25",
  "budgetMode": "guaranteed"
}
```

## Failure and refund behavior

- No ticket: HTTP `402` from the Maha target, with no paid computation.
- Malformed, expired, spent, replayed, or binding-mismatched ticket: fail closed with HTTP `409` and no computation.
- Verifier unavailable after a Vibes-coded settlement may have occurred: HTTP `503`, `paymentState: paid_delivery_pending`.
- Receipt unavailable or rejected after computation: HTTP `202`, `paymentState: paid_delivery_pending`; retry the same logical request and ticket, never pay again.
- Duplicate receipt or an interrupted response: the durable state and deterministic hashes recover the original result/receipt; the adapter does not persist source or result bodies.
- There is no automatic refund operation in Maha. Refund/charge dispute handling remains a Vibes-coded operator action until its checklist specifies an API and authorization policy.

The call ticket is never a standing credential. Maha stores only its SHA-256 fingerprint and uses the raw ticket only for the current verifier/receipt HTTPS exchange.

## Operator runbook

1. Lint: run `npm run vibes:sku-lint`. This calls only the free `seller-first-sku-lint` publish-payload preflight. It is not a load test of Maha and a network failure is not a publish approval.
2. Confirm unpaid behavior only at Vibes-coded's exact smoke path: `POST https://vibes-coded.com/api/v1/seller-endpoints/vibes-demo-echo/call`. The request must return `402` without touching Maha's origin. The trial claim is only a smoke key for the Outcome catalog and must never be used to call Maha.
3. Re-fetch the public checklist, publish schema, and verify/receipt examples. Compare the exact field names, amount representation, ticket header, target URL, and response semantics to the frozen snapshot and update the contract version/digest if needed. Maha does not need to wait on Vibes-coded to publish, but publication itself still requires Mayone's later authorization through `https://vibes-coded.com/publish-endpoint`.
4. For one future bounded paid test, obtain fresh human authorization immediately before the test. Use a dedicated bounded buyer, exactly `$0.50`, one fresh ticket, one sanitized fixture, and no automatic retry that could pay again. The test is not authorized by this branch. Do not request or authorize a scoped USDC slice until a mutually defined done-when exists.
5. Capture only status codes, ticket/result hashes, receipt ID, external URLs, timestamps, and transaction/settlement identifiers supplied by Vibes-coded. Never capture tickets, source text, result bodies, wallet secrets, or health data.
6. Verify recovery by interrupting the response after receipt submission or making the receipt endpoint unavailable, then retry the same body, client request ID, and ticket. Confirm no second verification/payment and an idempotent receipt.
7. Roll back by disabling `VIBES_CODED_SELLER_ENABLED`, removing the SKU from any unpublished staging configuration, and reverting the application deployment. Do not delete the ledger migration or rows; preserve paid-pending evidence for reconciliation. Do not merge or deploy this branch during review.
