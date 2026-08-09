# A2A + MCP compatibility prototype

This prototype places an unmodified A2A agent and an unmodified MCP server
behind the same tenant-authenticated Maha boundary.

## What is enforced

- MCP: the existing validated `tools/list` inventory, method allowlist, tool
  allowlist, tenant rate limit, timeout and circuit breaker.
- A2A: a validated Agent Card, method allowlist, Agent Card skill/task-class
  allowlist, text-only compatibility profile, payload ceiling, tenant rate
  limit, timeout and circuit breaker.
- x402 requested by an A2A upstream: exact resource, scheme, CAIP-2 network,
  asset, payee and per-call ceiling are checked before a challenge reaches a
  wallet. A signed retry is checked again before it reaches the upstream, and
  `PAYMENT-RESPONSE` is bound to the authorized network and signing wallet.

Maha does **not** hold the buyer key or sign on the tenant's behalf. The wallet
remains in the calling agent. This avoids introducing custody into a protocol
compatibility proof.

## Deliberate prototype limits

- JSON-RPC request/response only. A2A SSE streaming, push notifications, file
  parts and webhooks are denied.
- The A2A task class is supplied in `X-Maha-Task-Class` and must be a skill ID
  from the validated Agent Card. It is a policy label, not a claim that Maha
  semantically understands the task.
- Multi-call task budgets are durable in Upstash. A signed turn is atomically
  reserved before forwarding. Only a verified receipt moves the reservation
  into cumulative spend. Explicit payment refusals release the reservation;
  ambiguous outcomes remain reserved and fail closed. The ledger closes when
  cumulative spend reaches `maxAmountPerTask`.
- A first `message/send` uses a stable gateway task identity derived from its
  A2A context/message identifier. The upstream task id returned on success is
  durably aliased to that ledger for later `tasks/get` and `tasks/cancel` turns.
- Independent on-chain receipt confirmation is not implemented in this slice;
  a policy requesting it is rejected at registration rather than weakened.
- A validated Agent Card is not the same as a validated x402 input/output
  schema. Therefore payment-policy evaluation reports schema evidence as
  `not_checked` and fails closed when `requireValidatedSchema` is enabled.

## Staging proof

Deploy the controlled fixture without changing the production GPU worker:

```bash
modal deploy workers/a2a_e2e_upstream.py
```

Set `MAHA_E2E_A2A_TOKEN` in the isolated Modal `maha-a2a-e2e-secrets` group,
then register its `/.well-known/agent-card.json` URL through
`POST /api/v1/a2a/register`. Send tasks to
`POST /api/v1/a2a/gateway/{agentId}` with `X-Maha-Task-Class:
governance.echo`.

The controlled agent returns valid x402 challenges and deterministic fixture
receipts:

- a message beginning `paid:` requests 1,000 USDC base units;
- a message beginning `expensive:` requests 1,000,000 base units.

With a 1,000-base-unit per-call ceiling and 2,000-base-unit per-task ceiling,
the suite commits two fixture settlements to one durable task ledger, blocks
the next turn because the cumulative ceiling is closed, and separately blocks
the `$1` challenge before a wallet is asked to sign. Fixture receipts exercise
gateway state transitions; they are not represented as on-chain settlements.
