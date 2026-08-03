# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately. Do not open a public issue, and do
not include working exploit details in any public channel.

Preferred: GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**). Failing that, email
**mayone@mahastrategies.com** with `SECURITY` in the subject.

Please include the affected URL or endpoint, the request that demonstrates the
issue, what an attacker gains, and whether you accessed any data that was not
your own. A first response should be expected within three business days. This
is a small team; there is no bug bounty and no guaranteed remediation window.

Do not test against production accounts you do not control, do not run load or
denial-of-service tests, and do not access, modify, or retain another
customer's data. Stop at the point where you have demonstrated the issue.

## Handling credentials found in a report

Any credential shared in a report is treated as compromised and rotated. Never
send a live API key, Stripe key, service-role key, or customer credential in
plaintext; describe it by its prefix and where it was found instead.

## Scope

In scope: `www.mahastrategies.com` and its subdomains, the public and
credentialed APIs under `/api`, the MCP gateway, the Stripe webhook endpoints,
and the published `@mahastrategies/sdk` package.

Out of scope: the vendor platforms themselves (Vercel, Supabase, Upstash,
Modal, Stripe, Sentry, Resend) — report those to the vendor — along with
missing security headers with no demonstrated impact, rate-limit findings on
endpoints already documented as rate-limited, and social engineering.

## What the platform already assumes

These are deliberate design properties, not oversights, and a report that
depends on one of them being different should say so explicitly:

- Credential secrets are disclosed exactly once at issuance and are stored only
  as hashes. There is no endpoint that returns a credential secret.
- Stripe webhook endpoints each use a distinct signing secret, verify the
  signature against the exact raw body, and record every `evt_` ID under a
  unique constraint committed in the same transaction as its ledger change.
  Replaying a captured event is expected to be a no-op.
- Ledgers are append-only. Corrections are new rows; refunds are reversal
  entries. Operator interventions go through audited, idempotent actions rather
  than direct table writes.
- Error and performance telemetry is scrubbed before transmission: request
  bodies, headers, cookies, identity, query strings, and exception messages are
  dropped, and spans exclude tenant IDs, keys, and JSON-RPC parameters.
- Public rate limiting keys on an HMAC of a visitor fingerprint. The source text
  submitted to the public MPS preflight is deliberately never persisted, and
  neither is a hash of it.

## Preview and Production are credential-isolated

Preview and Production share one Vercel project, so a variable defined once for
both environments carries the same value in both. Preview is the least
controlled environment — it builds from every pull request — so a shared
credential means anything exposing a Preview deployment exposes Production to
the same degree.

Every credential is therefore per-environment. Preview has its own Supabase
project, Redis keyspace, Stripe key, operator tokens, and encryption key; it
cannot page the on-call, drive Production GPU compute, forge signed Stripe
webhooks, or send mail from the domain.

`environment-isolation.yml` audits this daily and opens a deduplicated issue if
a credential becomes shared. The check reads Vercel record *structure* rather
than values — one record targeting both environments is one value — so it never
decrypts or handles a secret. The policy lives in `lib/environment-isolation.ts`
and grades by consequence: authenticating against Production fails, a metered
third-party key warns, configuration is ignored.

Unlisted variables are treated as configuration, so new settings create no
noise. **A new credential must be classified in that policy deliberately** —
add it when you add the variable.

## Operational security references

- Alerting, telemetry scrubbing, and readiness checks: [`docs/observability.md`](docs/observability.md)
- Release health, rollback, and recovery: [`docs/release-recovery.md`](docs/release-recovery.md)
- Service objectives and the bounded capacity harness: [`docs/slo-capacity.md`](docs/slo-capacity.md)
