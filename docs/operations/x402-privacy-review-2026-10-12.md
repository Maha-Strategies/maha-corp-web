# x402 Privacy and Retention Review

The focused buyer and attribution release keeps the existing 24-hour result cache, limits new private purchase attribution to a 90-day active window, and preserves financial and replay-protection ledgers. The public notices at `/developers/x402-privacy` and `/developers/x402-buyer` explain those boundaries. This is a technical data-handling review, not legal certification or confirmation of provider backup settings.

## Data and Access

| Store | Data | Retention and access |
| --- | --- | --- |
| Request processing | Sanitized JSON and payment evidence | Request memory; no new application body/signature logging |
| Redis recovery | Bounded result, digests, payer/chain, timestamps, merchant receipt and coarse source | At most 24 hours from preparation; retries never extend the TTL |
| New private attribution | Offer/chain, authorization fingerprint, wallet pseudonym, amount/transaction, source, outcome and retry counters | 90 days in reports; hourly bounded physical cleanup; RLS and restricted service functions |
| Existing daily telemetry | Daily counts and bounded numerical metrics by fixed source bucket | Existing aggregate history retained; no wallet, IP, raw referrer or body added |
| Existing financial and replay ledgers | Payment/settlement/replay evidence | Unchanged; no deletion or historical relabelling by this release |
| Buyer outbox | Exact input, signed authorization, private recovery headers | Buyer-controlled private storage; durable persistence is required before paid submission |

The payer key is deterministic and chain-specific. It is pseudonymous, not anonymous: a known public wallet can be matched. Discovery labels are caller-controlled, not customer identity or verified referral evidence. Known operators are classified from the verified payer, not the claimed source. A prepared response is not proof of buyer receipt.

Anonymous and ordinary authenticated roles cannot access the purchase table or its RPCs. The service role can read it and invoke restricted recording/cleanup functions, but cannot directly insert, update or delete its rows. No signer, wallet key, raw payment signature, recovery secret, source text, IP or unrestricted referrer is present in attribution.

## Expiry and Failure Handling

`prune_x402_purchase_attributions()` computes its own cutoff from the first observation, accepts no caller-selected cutoff, and removes at most 1,000 expired rows with a five-second statement timeout. It reports whether expired rows remain. The existing authenticated, production-only hourly settlement job invokes it independently of scan success; cleanup failure cannot discard the saved settlement snapshot. The RPC request has a six-second client timeout. The aggregate attribution reader also excludes records older than 90 days.

The cleanup function targets only the new attribution table. It does not touch `x402_payments`, chain settlements, recovery/replay guards or aggregate history. Delayed cleanup and provider backups are disclosed rather than described as immediate global deletion. No historical attribution is invented.

Synthetic PostgreSQL tests verified the age cutoff, first-observation clock despite recent recovery, preservation of younger rows and existing histories, 1,000-row batch limit, backlog reporting and restricted cleanup grants. The earlier migration assertions verified identity conflicts, immutable first source, monotonic settlement, deduplication and RLS.

## Provider Boundary

Vercel, Upstash Redis, Supabase, the configured payment facilitator and chain RPC providers necessarily process the requests relevant to their roles. The public notice distinguishes application non-retention from provider infrastructure logs and backups. Provider expiry and backup lifetimes were not independently established; no zero-log or immediate-backup-deletion promise is made. Upstash documents durable storage, and Supabase documents database job monitoring; these do not establish our account-specific deletion settings. [Upstash durability](https://upstash.com/docs/redis/features/durability), [Supabase Cron](https://supabase.com/docs/guides/cron).

## Release Checks

The release uses the exact current production base `c00f2f77d7392a51ebb1b8211f1f542d88ac6853` plus focused buyer, attribution, notice and cleanup changes. Only migration `20261012120000` is authorized; unapplied historical migrations must remain withheld. A fresh dry-run and its evidence precede the single apply. The protected environment reviewer remains enabled. Temporary access is restricted to `codex/x402-observability-demand-20261012` and must be removed after the workflow finishes.

Production verification should establish: both public guides load; each demand tool advertises the guide/notice and unchanged price; unsigned POST still returns valid Base and Arbitrum quotes; source labels reach aggregate counters; the new private schema and cleanup grants match the migration; and the scheduled ledger remains healthy. No extra paid canary is authorized for this release. Local recovery tests are not represented as new mainnet delivery tests.

## Build and Workflow Verification

The focused release changes the Git deployment catch-all to `"**": false` and keeps `"main": true`. A single star does not match slash-containing branch names. The configuration test guards this distinction. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

The Webpack local production build passed, including TypeScript and 3,795 static pages. The initial sandboxed Turbopack compile stalled with no CPU progress and was stopped; that attempt is not called a successful build. Local output warned about pre-existing Scalar dynamic dependencies and unavailable Redis credentials; no credential or database was created in response to those warnings. The two new pages were read back and visually inspected on the local production server.

Protected dry-run [38256653949](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/38256653949) reported workflow success for commit `d87d75a61569fb68866c1044ab08254b32a70881`. Artifact `production-migrations-38256653949` has digest `sha256:6e46a4dab437ef94b116b0b405b52fdaa8dca5e1d62b27899cca99095376e9dd`. Its history records the target as unapplied, while the generic pending command stopped on an intentionally withheld older backlog. That command's exit was masked by its pipeline; the workflow badge alone is not proof of a clean CLI dry-run. The later isolated single-apply run records a successful bounded dry-run listing only the approved target. `--include-all` was not authorized or used.

The target migration SHA-256 is `4e54b4e86921e97749c3cbcf9f1579802080687667bb3836d2a69aba76b6d5b5`. Protected single-apply [38257921073](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/38257921073) passed isolation, apply and exact-version recording. Artifact `production-migrations-38257921073` has digest `sha256:e2c345872622f9624fee75657f957df8c322953ceabf50629e3741b74cf9f555`. Its detailed health artifact is unhealthy: homepage, billing and observability were ready, but OpenAPI returned 404. The pipeline masked that failure, so the green workflow badge must not be called a successful health check. The temporary branch permission was removed and main-only environment access read back. No full-history convergence claim is made for the intentionally withheld migration backlog.

Release `71f68eac225fdebd5068b27866d01f079efff947` is live in production deployment `dpl_AQtUi3o316FP95z44q4Jm3HiTFsQ`: buyer and privacy guides return 200, and the scheduled Base/Arbitrum ledger is healthy and caught up. OpenAPI remains 404. A deployment-input inspection established that unanchored `docs` in `.vercelignore` removes both `app/docs` and `app/api/docs`; the local full build serves OpenAPI 3.1.0 successfully. The owner approved one corrective build for a root-scoped `/docs/` exclusion and explicit Bash/pipefail in the migration workflow. No migration reapply or new paid call is authorized or needed.
