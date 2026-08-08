# Production x402 Bazaar canary

The scheduled workflow protects the Context Compiler from Bazaar's 30-day
settlement inactivity removal rule without manufacturing routine call volume.
It checks Coinbase merchant discovery twice a week and settles one $0.001 call
only when the latest recorded settlement is at least 21 days old. Any real
customer settlement resets the same clock and suppresses the canary.

## One-time GitHub setup

Create a GitHub environment named `production-x402-canary` and restrict it to
the protected `main` branch. Scheduled jobs cannot proceed unattended through
a required-reviewer gate, so do not add required reviewers if the canary must
be fully automatic.

Add one required environment secret:

- `X402_BUYER_PRIVATE_KEY`: private key for the dedicated buyer address
  `0x7b7ff44288fADe4A1829abA2584DFCeB952146f2`.

Optionally add `BASE_RPC_URL` as an environment variable (not a secret).
Without it, Viem uses the Base Mainnet public RPC configured by the chain
definition. The official public value is `https://mainnet.base.org`.

This wallet is a bounded operational credential, not a treasury. Keep only a
small USDC balance in it (for example $0.05-$0.10) and no unrelated assets.
The code refuses any other buyer, endpoint, payee, network, asset, or price and
can issue at most one signature per workflow run.

## Operation

Workflow: `.github/workflows/production-x402-canary.yml`

- Schedule: Monday and Thursday at 04:17 UTC.
- Payment threshold: 21 days since Bazaar's `quality.lastCalledAt`.
- Payment ceiling: exactly 1,000 USDC base units ($0.001).
- Concurrency: one non-cancelling run.
- Evidence: sanitized JSON artifact retained for 90 days.
- Failure notification: deduplicated GitHub issue labeled `x402-canary`.

Use **Actions → Production x402 Bazaar canary → Run workflow** after initial
setup. A healthy initial run should report `settlement_recent` and spend
nothing. Canary settlements are operational traffic and must not be counted as
external demand or customer revenue.
