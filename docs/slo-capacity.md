# Service objectives and capacity acceptance

These are internal operating objectives, not a customer-facing contractual SLA. They define when a release is healthy enough to promote and when operators must stop and investigate.

## Objectives

| Surface | Availability objective | Latency objective | Measurement |
| --- | ---: | --- | --- |
| Public and documentation surfaces | 99.9% monthly | p95 ≤ 1,000 ms; p99 ≤ 2,500 ms | Vercel/Sentry plus the `public` capacity profile |
| Authenticated control plane | 99.9% monthly | p95 ≤ 1,500 ms; p99 ≤ 3,000 ms | readiness, Supabase probes, Upstash balance lookup, Sentry |
| MCP Gateway with the controlled upstream | 99.5% monthly | p95 ≤ 3,000 ms; p99 ≤ 7,000 ms | Sentry spans plus the confirmed `mcp` capacity profile |

A 99.9% monthly objective permits approximately 43 minutes and 50 seconds of unavailable time in a 30-day month. A 99.5% objective permits approximately 3 hours and 36 minutes. Planned maintenance counts unless a future customer contract explicitly says otherwise.

Capacity acceptance uses a stricter small-sample release gate: 99.9% success for public/control-plane scenarios and 99.5% for the MCP scenario. Because the bounded samples are small, this normally means zero failed requests.

Each scenario begins with a concurrency-sized warmup batch. Warmup success and maximum latency remain visible and must stay below 3 seconds for public, 5 seconds for control-plane, and 10 seconds for MCP. The stricter p95/p99 limits are then applied to the measured steady-state batch. This separates cold-start behavior from sustained capacity without discarding either signal.

## Safe profiles

- `public` sends only GET requests to the homepage and OpenAPI document.
- `control-plane` adds authenticated billing/observability readiness and API-key balance lookups. It does not deduct credits or modify configuration.
- `mcp` invokes the controlled upstream and deducts one canary credit per measured or warmup request. It is capped at 30 measured requests and concurrency 5 and requires the exact confirmation `CONSUME CANARY CREDITS`.

The harness rejects the canonical Production domain unless `CAPACITY_PRODUCTION_CONFIRMATION=LOAD TEST PRODUCTION` is also present. The GitHub workflow deliberately does not expose that confirmation and is therefore Preview-only.

## Preview acceptance

Create the GitHub environment `preview-capacity` with:

- Secret `CAPACITY_API_KEY`: an isolated Preview canary API key.
- Secret `CAPACITY_RELEASE_HEALTH_TOKEN`: the Preview deployment's read-only release-health token.
- Secret `VERCEL_AUTOMATION_BYPASS_SECRET`: the Preview protection bypass secret.
- Variable `CAPACITY_MCP_SERVER_ID`: an existing Preview tenant server connected to the controlled Modal upstream; required only for the MCP profile.

Dispatch `preview-capacity.yml` with the immutable ready Preview URL. Run `control-plane` first at 40 requests per scenario and concurrency 5. Run `mcp` separately at 20 requests and concurrency 2 only after confirming the canary balance and upstream availability.

Leaving `base_url` blank resolves the newest ready Preview automatically. This requires secret `VERCEL_TOKEN` and variables `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` in the `preview-capacity` environment, in addition to the secrets listed above.

## Scheduled trend

The workflow also runs daily at 06:17 UTC against the newest ready Preview. A scheduled run is always the `control-plane` profile at 40 requests and concurrency 5, regardless of any input: it never selects `public` and, more importantly, never selects `mcp`, which spends a canary credit on every measured and warmup request. Consuming credits stays an explicit, supervised decision.

The control-plane profile is credit-free. Its authenticated scenarios are the two readiness endpoints and `/api/v1/keys/balance`, which is a self-managed key route and is not metered by the edge proxy.

Each run uploads `preview-capacity-target.json` alongside the report, recording the trigger, profile, measured origin, deployment ID, and commit SHA. Without that, a trend point cannot be attributed to a change.

Read the trend for direction, not for absolute numbers. Each scheduled run measures a different Preview deployment of a different commit, and Preview instances are not performance-comparable with Production. A single slow run is more likely to be a cold start or a noisy neighbour than a regression; several consecutive runs drifting in one direction is the signal worth acting on. Promotion decisions still use a deliberate dispatched run against a specific Preview.

Deployment selection re-checks target, readiness, and project ownership on every entry rather than trusting the API filter, so a Production deployment can never be selected even if it is newer.

For local execution, the harness also recognizes the existing `TEST_API_URL`, `STAGING_API_KEY`, and `RELEASE_HEALTH_TOKEN` aliases after loading the standard Next.js environment files. Explicit `CAPACITY_*` values always take precedence.

Do not increase concurrency or request limits simply to obtain a larger headline number. To establish higher tenant throughput, provision multiple isolated canary tenants, define the expected tier limits first, and increase load in supervised steps while watching Vercel, Sentry, Upstash, Modal, and error-budget consumption.
