# Open x402 Conformance Observatory

The observatory publishes factual, point-in-time protocol and discovery checks for explicitly allowlisted public x402 resources. It uses `x402-doctor`; it does not create a separate scanner or subjective ranking model.

Public surfaces after deployment:

- Human view: `https://www.mahastrategies.com/x402-observatory`
- Machine-readable latest status: `https://www.mahastrategies.com/api/x402-observatory`
- Vendor-neutral fixture corpus: `https://www.mahastrategies.com/conformance/x402-v2/corpus.json`

## Published facts

For each resource, the latest public observation contains:

- whether the payment challenge was reachable;
- whether the observed challenge satisfied the x402 v2 contract;
- whether declared Bazaar schemas and examples validated;
- whether the declared crawler request received HTTP 402;
- whether the Bazaar record was current, stale, missing, unknown, or not declared;
- whether digest evidence came from a catalog or from legacy field reconstruction; and
- the last successful bounded settlement, only when the operator explicitly enabled that check.

Missing evidence is `unknown` or `not_applicable`, never a fabricated pass or fail.

## Explicit exclusions

The observatory does not rate trust, security, reputation, service quality, economic value, uptime, or SLA compliance. A passing protocol observation does not mean a resource is safe or useful. A failed observation can be transient and remains in the append-only history even after a later recovery.

This project does not replace x402 Trust or another liveness monitor. The scheduled run exists only to refresh protocol and discovery correctness on a bounded cadence.

## Inclusion policy

Resources live in the reviewed allowlist at `lib/x402/observatory-registry.ts`. There is no arbitrary URL submission endpoint. This prevents the runner becoming an SSRF primitive or public proxy.

An inclusion request should provide:

1. a stable credential-free HTTPS resource URL;
2. operator or maintainer identity;
3. the HTTP method needed to obtain an unpaid challenge;
4. a reproducible Bazaar input example when discovery is declared; and
5. explicit consent if a bounded paid settlement is requested.

Paid checks are disabled by default. Enabling one also requires a separately reviewed secret-backed probe and an integer base-unit ceiling. A registry flag alone cannot spend funds.

## Data handling

The observation ledger stores check states, rule IDs, duration, resource identity, timestamps, and an optional public transaction hash. It does not retain request or response bodies, credentials, private keys, IP addresses, user agents, payloads, or facilitator authentication.

Rows are append-only: the service role can select and insert but cannot update, delete, or truncate them. The free public API exposes only the latest observation and last voluntarily enabled successful settlement. Historical delivery, private endpoint monitoring, webhook notifications, and CI retention are intentionally outside the first public release.

## Operation

The daily Vercel Cron route is protected by `CRON_SECRET` and runs only the repository allowlist. Apply the migration before deployment:

```text
supabase/migrations/20260809000200_x402_conformance_observatory.sql
```

The route is `GET /api/cron/x402-observatory`. A database write failure makes the run fail with HTTP 503 rather than presenting an unrecorded check as successful.

## Corrections

Open a repository issue with the resource URL, observation timestamp, disputed check, and reproducible evidence. Corrections are new observations or code changes; historical rows are not rewritten.
