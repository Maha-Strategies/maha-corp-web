# x402 buyer-policy reference library

The buyer-policy library is an Apache-2.0, vendor-neutral safety boundary for
agents that can pay x402 resources. It separates four responsibilities that are
often collapsed into a wallet callback:

1. discovery and schema validation;
2. a policy decision and atomic budget reservation;
3. wallet signing and payment transport; and
4. receipt, chain, and replay verification.

The canonical TypeScript source is `lib/x402/buyer-policy.ts`. The independently
buildable package is `packages/x402-buyer-policy`, and the machine-readable
policy contract is published at `/schemas/x402-buyer-policy-1.0.0.json`.

## Safety properties

- All prices are decimal strings in the asset's smallest unit. Floating point
  currency is never used.
- Resource comparison is exact after URL parsing. A challenge for a sibling
  path, different query, credential-bearing URL, or fragment is rejected.
- Network and asset approval is a pair, preventing an approved token address on
  one chain from being interpreted on another.
- Per-task limits are enforced by a pluggable ledger. Production ledgers must
  atomically claim the authorization identity and increment the task total.
- Human approval binds policy, task, resource, network, asset, payee, maximum
  amount, and expiry. It is not a generic yes/no flag, and a trusted verifier
  must authenticate it before the policy grants an exception.
- Receipt verification binds the transaction, network, and payer. Optional
  independent chain evidence additionally binds token, payer, payee, and amount.
- A settlement transaction is claimed once, so one receipt cannot satisfy two
  tasks.

## What the package does not do

It does not validate arbitrary JSON Schema itself. Instead it requires explicit
schema evidence from x402-doctor or another validator. It does not hold a wallet,
sign EIP-712 data, select a facilitator, or decide whether an endpoint is useful
or trustworthy.

The included in-memory ledger is suitable for tests and a single-process
example. It is not safe for distributed agents. Redis, Postgres, or a durable
object should implement the `BuyerPolicyLedger` interface in production.

## Integration boundaries

- **Viem:** call `authorizePayment()` in the asynchronous pre-signing hook, then
  call `verifyAndRecordSettlement()` after `PAYMENT-RESPONSE` and a chain read.
- **LangChain.js:** put the same gate inside the tool that performs paid fetches;
  use the run or task ID as `taskId`.
- **MCP:** apply the policy after tool input validation and before dispatching a
  paid HTTP resource; keep the MCP request ID distinct from the payment nonce.
- **Python LangChain and CrewAI:** validate the public policy JSON and reproduce
  the same decision codes at the wallet boundary. The TypeScript package is not
  advertised as a native Python dependency.

## Reservation lifecycle

The reference ledger conservatively counts a reserved authorization even if a
human later rejects the wallet prompt. Production adapters should attach a
short expiry to unsigned reservations and reconcile them after a declined or
failed signing attempt. A confirmed settlement must never be released.

## Publishing

The current package is `@mahastrategies/x402-buyer-policy@0.1.1`. Version
`0.1.0` was the initial release; `0.1.1` is tagged `latest`. Run the build and
dry-run pack checks before every future immutable npm release.
