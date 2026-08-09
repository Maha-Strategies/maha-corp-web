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
can issue at most one signature per workflow run. The workflow exposes the key
only to first-party configuration and canary steps, not to checkout, package
installation, artifact, or notification actions.

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

## Deliberate metadata refresh

Recent settlement activity protects the listing from inactivity removal but
does not prove that Bazaar indexed the current discovery declaration. When the
read-only drift workflow reports a mismatch, manually dispatch this workflow
with **force_refresh** enabled. That authorizes exactly one 0.001 USDC call even
inside the 21-day window. Every existing buyer, endpoint, payee, network,
asset, price, balance, one-signature, response, and receipt guard still applies.

`force_refresh` is unavailable to scheduled runs and is not a general force or
price override. After the settlement, rerun x402 Doctor and close the drift
issue only when the indexed declaration matches the live challenge.

## Reading a failure

The evidence artifact carries a `failure` object as well as the message:

```json
{
  "outcome": "failed",
  "error": "...",
  "failure": {
    "errorCode": "payment_rejected",
    "httpStatus": 402,
    "operation": "verify",
    "providerReason": "facilitator_verify_rejected_request: 'paymentPayload' is invalid: ...",
    "authorization": { "validAfter": "...", "validBefore": "...", "nonceHash": "..." },
    "settled": false
  }
}
```

`operation` names the layer that failed and `settled` says whether money is
known to have moved. When `settled` is absent, assume nothing: check the payee
wallet on Base before dispatching another run. The nonce appears only as a
digest, which is enough to tell two attempts apart or recognise a replay and
not enough to reuse.

## Known failure mode: oversized resource description

Between 2026-08-08 and 2026-08-09 every settlement failed with
`facilitator_verify_failed`, which reads like an unreachable facilitator. It was
not. CDP answered **HTTP 400**, `'paymentPayload' is invalid: must match one of
[x402V2PaymentPayload, ...]` — it authenticated the request and then refused to
parse the payload, because `resource.description` had grown from 196 to 865
characters. Neither the x402 v2 specification nor `@x402/core`'s
`ResourceInfoSchema` caps that field; the CDP facilitator does, and does not
document the limit. It is tracked upstream as
[x402-foundation/x402#2284](https://github.com/x402-foundation/x402/issues/2284),
which reports 480 characters passing and 523 failing.

Because a settlement is also what refreshes the Bazaar listing, the stale
metadata drift reported separately was a symptom of the same change rather than
an independent fault.

`lib/x402/discovery.ts` now bounds the field at **480 characters and 480 UTF-8
bytes**, inside the known-passing value rather than in the unresolved gap
between 480 and 523. Both limits are enforced because no implementation states
which one it measures, and for ASCII copy they agree -- the difference only
appears when a non-Latin sentence is added and the field silently triples in
bytes while looking unchanged.

The production description is written to fit as authored. `boundDescription()`
is a defensive fallback, not the mechanism: it clamps by code point so a CJK
character or an emoji is never cut in half, and a value that reaches it is a
bug CI has already failed on. The facilitator adapter preserves the provider's
own message instead of collapsing it, so if the real ceiling is lower still,
the next failure names it in `providerReason` rather than costing another day
of live probing.

### Verifying a fix without spending

Facilitator **verify** does not move money; only settlement does. So a fix can
be confirmed for free by signing a challenge with an unfunded throwaway key and
presenting it to production. A CDP schema rejection surfaces as
`facilitator_verify_rejected_request`; a payload CDP accepts and then refuses on
the merits surfaces as a typed reason such as `insufficient_funds`. Reaching the
typed reason is the pass condition — it proves the payload parsed. Only then is
a paid canary run worth authorizing.
