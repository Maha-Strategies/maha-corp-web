# Three-offer x402 rollout

Operational record for the tiered autonomous offers. The catalog itself lives in
`lib/x402/offers.ts` and is the source of truth for everything published; this
file covers the decisions a deploy needs and the numbers behind them.

## The offers

| Offer | Method and path | Amount | Enabled where |
| --- | --- | --- | --- |
| `context-compression` | `POST /api/v1/compress` | 1000 (`$0.001`) | Production, Preview |
| `deep-context-evaluation` | `POST /api/v1/compress/evaluate` | 10000 (`$0.01`) | Preview (branch-scoped) |
| `mps-autonomous-audit` | `POST /api/v1/mps/audit` | 100000 (`$0.10`) | nowhere yet — blocked on migrations |

Matching is exact on method *and* path. A sub-path of a priced route is not
priced by inheritance, and a `GET` beside a priced `POST` is not the priced
resource. This is what keeps `POST /api/v1/mps/audit/{auditId}` free: a caller
recovering a job it already paid for must never be charged again.

## MPS worst-case unit economics

Computed, not asserted — see `lib/x402/mps-unit-economics.ts` and
`test/x402-mps-unit-economics.test.ts`. The inputs (passage cap, `max_tokens`,
model, price) are read from the modules that define them, so changing any of
them fails the test rather than silently eroding the margin.

Assumptions: `claude-sonnet-4-6` at $3/$15 per MTok; 0.5 tokens per character
(pessimistic — the cap is in characters, and dense CJK or markup tokenizes far
worse than the ~0.25 English prose ratio); a ~700-token prompt template; a 15%
first-attempt failure rate against the 3-attempt ceiling, because a paid job may
be resumed without a second payment and every retry is a model call we absorb.

| | 6,000-char passage (binding) | 32,768-char (body limit) |
| --- | ---: | ---: |
| Model, one call | $0.0336 | $0.0738 |
| Model, incl. expected retries (×1.1725) | $0.0394 | $0.0865 |
| Facilitator allowance | $0.0050 | $0.0050 |
| Infrastructure allowance | $0.0020 | $0.0020 |
| **Total cost** | **$0.0464** | **$0.0935** |
| **Margin at $0.10** | **$0.0536 (53.6%)** | **$0.0065 (6.5%)** |
| Minimum safe price | 46,396 base units | 93,475 base units |

**The 32 KB figure in the original brief is the HTTP body limit, not the model
input.** `validateAuditPassage` rejects any passage over 6,000 characters with a
413 before an Anthropic client is constructed, so 32 KB cannot reach the model.
The right-hand column is priced anyway: raising the passage cap toward the body
limit collapses the margin to single digits and is a repricing decision, not a
config tweak.

**Verdict: $0.10 is safe at the current cap** — 53.6% margin, comfortably above
the ~25% floor that leaves room for a model price change. It is *not* safe if the
passage cap is raised without repricing.

## Production environment changes required

Nothing has been changed in Production. When promoting:

```
X402_RESOURCES = [{"method":"POST","path":"/api/v1/compress"},
                  {"method":"POST","path":"/api/v1/compress/evaluate"},
                  {"method":"POST","path":"/api/v1/mps/audit"}]
```

Entries now carry only `method` and `path`. Amount, description and concurrency
cap are read from the catalog, so a stale variable can no longer sell an offer at
a price the published manifests contradict. The old `pathPrefix` spelling is
still accepted as a synonym for `path`, so the existing Production value keeps
working unchanged until it is replaced.

If the variable does disagree with the catalog, the catalog's values are served
and the contradiction is recorded on `X402Config.catalogContradictions` for
readiness to fail on — serving the variable's number would be the drift this
whole change exists to prevent.

No other Production variable changes. `ANTHROPIC_API_KEY` is already set for both
environments.

## Blockers before the MPS offer can be enabled anywhere

1. **Two migrations are unapplied**: `20260810000300_x402_offer_telemetry.sql`
   and `20260810000400_x402_mps_audit_jobs.sql`. Without `x402_mps_audits`, a
   paid audit settles and then returns 503 — the exact "settled payment into an
   untraceable failure" this design otherwise prevents. Telemetry degrades
   silently by design and is not a blocker on its own.
2. The only reviewed apply path is the `production-migrations` workflow, which
   targets Production and requires the `APPLY PRODUCTION MIGRATIONS`
   confirmation.

Until then the offer stays out of `X402_RESOURCES` everywhere. An unpriced route
is refused by the API-key gate, which is the safe direction to fail: an unpriced
route takes no money, a mispriced one does.

## Preview verification

Deployment Protection is on for Preview, so `x402-doctor`'s internal Bazaar
crawler probe cannot carry the bypass header and always reports
`x402.bazaar.crawler_status: 401` there. That finding is an artifact of the
environment, not the route: replaying each offer's own published crawler example
with the bypass header returns HTTP 402 with the correct amount and a distinct
declaration digest. `x402.bazaar.not_found` is likewise expected — Preview URLs
are not in the Bazaar merchant record.

Preview settles on Base Sepolia (`eip155:84532`). The `maha-offer` extension
reads its network from the requirement rather than a constant, so it agrees with
the `accepts` array in both environments; an earlier revision hard-coded mainnet
and was caught by deploying.
