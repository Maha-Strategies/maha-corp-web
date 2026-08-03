# Preview end-to-end gates

`preview-e2e.yml` runs `scripts/test-e2e.ts` against each ready Preview
deployment. Until now that suite ran only after a change reached Production, via
the manually dispatched production canary — integration regressions were found
after deploy rather than before merge.

> **This workflow has not yet run.** See *Bootstrapping* below: it cannot test
> itself on the pull request that adds it.

## What it verifies

Against the deployed Preview, using a Preview canary API key:

- MCP server registration and automatic `tools/list` discovery.
- That a server listing never leaks `authSecret`, and manual rediscovery agrees
  with the automatic result.
- Tenant SLA settings round-trip.
- A JSON-RPC tool call proxied through the gateway returns an authenticated
  result.
- A controlled upstream timeout returns 504, the circuit breaker then blocks the
  next call with 503, and the half-open probe recovers.
- The tenant MCP rate limiter returns 429.
- CSV audit export contains the gateway entry, and PDF export is a real PDF.

## Trigger

Vercel reports each deployment to GitHub, and the workflow runs on
`deployment_status` when the state is `success` and the environment is not
Production. The immutable Preview URL comes from the event, and the checkout uses
the deployed commit rather than the tip of the branch, so the suite always tests
the code that was actually deployed.

There is also a `workflow_dispatch` path taking an explicit `preview_url`, which
is how you should exercise it the first time.

## Bootstrapping

`deployment_status` only fires for workflow files that already exist on the
default branch. The workflow therefore cannot run on the pull request that
introduces it. Sequence:

1. Create the `preview-e2e` environment and its secrets.
2. Dispatch manually against a known-ready Preview URL and confirm it passes.
3. Merge to `main`.
4. Confirm it fires automatically on the next Preview deployment.
5. Only then add it as a required status check.

## Making it a merge blocker

Once it runs automatically, add **Preview E2E gates** to the required status
checks in branch protection for `main`. Note the timing: the check appears on a
commit only after Vercel finishes deploying it, so a pull request stays pending
until its Preview is ready.

## Why runs queue instead of cancelling

Every run drives the same canary tenant. It mutates that tenant's MCP SLA
settings and deliberately trips its circuit breaker. Two concurrent runs would
fight over shared state.

More importantly, the script restores the original SLA settings in a `finally`
block. A cancelled run skips it and can leave the tenant pinned at
`requestsPerMinute: 1`, which breaks every later run until someone resets it by
hand. The concurrency group is global with `cancel-in-progress: false`, so a
superseded Preview queues rather than cancelling. If runs ever back up badly
enough to matter, provision a second isolated canary tenant rather than turning
cancellation on.

## Guard against running on Production

The suite mutates tenant settings and spends credits, so pointing it at
Production would be costly rather than merely wrong. Two independent stops:

- The job condition excludes `deployment_status` events whose environment is
  Production.
- A step rejects any target that is not `https`, matches `PRODUCTION_BASE_URL`,
  or ends in `mahastrategies.com`. Preview deployments live on `vercel.app`, so
  a custom domain is treated as a mistake and fails closed.

Production is still covered by the existing manually dispatched
`production-canary.yml`, which is unchanged.

## Cost and accumulation

Each request through `/api/v1` deducts one credit, so a run costs roughly a
dozen credits from the Preview canary tenant. Keep an eye on that balance; the
standard low-credit alert fires for this tenant like any other.

Every run registers a new MCP server on the canary tenant and there is no
deregistration endpoint, so those rows accumulate. The existing production canary
has always behaved the same way. If the count becomes a problem, remove them
through the operational control plane rather than by direct table edits, or add
a deregistration capability and have the suite clean up after itself.

## Required GitHub environment

Create `preview-e2e`. It needs no reviewer — it must run unattended on every
Preview deployment.

- Secret `PREVIEW_CANARY_API_KEY` — an isolated Preview canary API key. Never a
  Production key.
- Secret `PREVIEW_MCP_UPSTREAM_TOKEN` — authenticates to the controlled JSON-RPC
  test upstream.
- Secret `VERCEL_AUTOMATION_BYPASS_SECRET` — required because Preview
  deployments are protected. Same value the other Preview workflows use.
- Variable `PREVIEW_MCP_UPSTREAM_URL` — the controlled Modal test upstream, the
  one deployed with `MAHA_E2E_MCP_TOKEN` from `workers/maha_workers.py`.
- Variable `PRODUCTION_BASE_URL=https://www.mahastrategies.com` — read only so
  the guard can refuse it.

If you already configured `preview-capacity`, the bypass secret and the upstream
URL and token are the same values; the API key should stay distinct so capacity
and E2E runs do not consume one another's balance.
