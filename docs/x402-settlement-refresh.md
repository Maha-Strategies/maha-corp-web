# Automatic public settlement ledger

Production runs `/api/cron/x402-settlements` hourly at minute 17 UTC. It requires
the existing `CRON_SECRET` bearer token and rejects non-production environments.
The job only reads finalized Base USDC Transfer logs to Maha's payee. It cannot
sign transactions, spend funds, or invoke a model.

An incremental cursor and 128-block overlap preserve cumulative history without
rescanning 60 days every hour. Each invocation scans at most 108,000 blocks;
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
