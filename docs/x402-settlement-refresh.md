# Automatic public settlement ledger

Local September 13 update: `/developers/settlement` is a transaction ledger, not a product catalogue. The zero-sale product table is removed. Every available offer and declared historical price feeds scheduled classification automatically; positive unmatched transfers remain visible without a product guess. Amount matching is not proof of an endpoint call or delivery.

Saved snapshots validate against their recorded catalogue before being reprojected against the current catalogue for display. This prevents a catalogue addition from rejecting intact saved history and stopping the worker. Reprojection does not change the observed date or scanned block range and never runs a chain scan. Digest/summary/row tampering still refuses. No production refresh, build or deployment was executed for this local update.

Production runs `/api/cron/x402-settlements` hourly at minute 17 UTC. It requires
the existing `CRON_SECRET` bearer token and rejects non-production environments.
The job only reads finalized Base USDC Transfer logs to Maha's payee. It cannot
sign transactions, spend funds, or invoke a model.

An incremental cursor and 128-block overlap preserve cumulative history without
rescanning 60 days every hour. Each invocation scans at most 24,000 blocks in
2,000-block requests, matching Base's public `eth_getLogs` limit;
backlogs catch up across runs. Logs are identified by transaction hash and log
index. Failed scans do not publish partial results or advance the saved cursor.

The existing Upstash Redis stores `x402:settlement-ledger:live:v1` with environment
namespacing. An ownership-checked 55-second lock makes publication atomic and
prevents an expired worker from overwriting a newer snapshot. Keep the previous
snapshot on RPC or Redis failures; inspect Vercel cron logs on errors. Large
responses (over 1,000 logs or 40 distinct timestamp blocks per run) require an
operator-reviewed backfill, not silent truncation.

The settlement page reads Redis at request time, without running a chain scan.
It shows the observation time, catchup status, and an overdue warning after two
hours. If Redis is unavailable it clearly labels the bundled fallback. A visible
browser tab checks the saved snapshot every five minutes and when returning to it. No website rebuild
is needed for ordinary settlement updates.

For a read-only deployment fallback update, run
`node --experimental-strip-types scripts/refresh-x402-settlement-fallback.ts`.
Review the resulting JSON before committing. The older GitHub settlement-watch
workflow remains an independent artifact-based check, not the publication path.

Only known operator wallets are excluded from external figures. A wallet is not
a unique customer; price-matched transfers do not prove discovery, an exact
endpoint, payload delivery, or acceptance. Unknown operator addresses must be
classified before treating them as demand.

## Operator receipts (ledger schema 1.1)

A Transfer log carries payer, amount and recipient, so the ledger names a
product by amount. That misattributed eight of our own canary payments made on
2026-09-09 while offers shared prices: three celestial launches and
`audit-export-normalizer` were credited to Deep Context Evaluation, the
evidence matrix and the MPS audit, and four 5000-unit micro payments were not
counted.

`lib/x402/operator-settlement-receipts.ts` records those eight purchases from
the canary evidence files (runs 34312284707 and 34325055311). Each receipt also
names the catalogue commit where the offer published that price; a test reads
that commit. Both builders (the hourly refresh and the manual generator) apply
them.

- A receipt binds only when there is exactly one receipt for the transaction,
  exactly one Transfer log in it, an operator payer, an offer in the catalogue
  and the settled amount. Otherwise the row is **unattributed** and the reason
  is recorded (`receipt_duplicated`, `receipt_for_external_payer`,
  `receipt_multiple_transfer_logs`, `receipt_unknown_offer`,
  `receipt_amount_mismatch`). Conflicting evidence is never resolved by
  choosing the amount match instead.
- Every 1.1 row carries `attribution`: the method (`amount-match`,
  `operator-receipt`, `unattributed`), what the amount alone indicates, and the
  receipt source. The page shows "Our test purchase · from canary receipt ·
  amount alone: …", so the correction stays visible.
- Receipts never change `payerRole`. All eight remain operator test payments,
  excluded from external settlements, wallets, repeat and cross-product figures
  and external value; those figures are identical with and without receipts.
- `summary.receiptAttributedSettlements` counts receipt rows. The four
  5000-unit payments now count as operator settlements (+4), and Deep Context
  Evaluation, the matrix and the MPS audit lose 2, 1 and 1 operator rows.

Snapshots: a 1.1 ledger records the receipts it was built with, and validation
rebuilds it from those. A 1.0 snapshot saved before receipts existed still
validates by amount alone, so the hourly refresh does not stop at
`invalid_saved_snapshot`; its next run publishes 1.1. The public page always
reprojects saved rows with the committed receipts, so receipts stored in Redis
cannot change what readers see. The bundled fallback
`content/x402/settlement-ledger.json` is left as its original 1.0 observation.
