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
