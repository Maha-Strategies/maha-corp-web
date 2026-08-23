# Evaluator walkthrough: adding a governance decision to an MCP gateway

For someone who already runs an MCP gateway and wants to know what integrating
this would cost them. Short version: one pre-dispatch call, and **no change to
your authentication, sandboxing, or audit-log system**.

Spec: `mcp-gateway-governance-interface.md` · Code: `lib/mcp-gateway-interop/` ·
Fixtures: `fixtures/mcp-gateway-interop/`

---

## What you keep

| Your system | Changes? |
| --- | --- |
| Authentication / identity | **No.** You pass the ids you already resolved. This layer authenticates nobody. |
| Sandboxing / execution | **No.** You pass your dispatch callback. Execution stays yours. |
| Audit log | **No.** You get fields to put in the row you already write. |
| Transport, session, framing | **No.** The decision is protocol-neutral. |
| Rate limiting, quotas, tenancy | **No.** Untouched. |

What you add is one call before dispatch.

---

## The integration, in full

```ts
import { McpGatewayInterop } from '@/lib/mcp-gateway-interop/adapter'
import { mcpToolCallToGatewayRequest } from '@/lib/mcp-gateway-interop/mcp-adapter'

const interop = new McpGatewayInterop({ chain: yourPolicyChain, clock: () => new Date() })

// In your pre-dispatch hook:
const request = mcpToolCallToGatewayRequest(frame, {
  requestId: ctx.traceId,
  tenantId: ctx.tenantId,      // already authenticated by you
  agentId: ctx.agentId,        // already authenticated by you
  targetId: upstream.id,
  resource: upstream.url,
  timeoutMs: upstream.timeoutMs,
})

const result = await interop.handle(request, async (authorized) => {
  const receipt = await yourExistingDispatch(authorized)   // your sandbox, your transport
  return { outcome: 'succeeded', receiptId: receipt.id }
})

yourAuditLog.write({
  requestId: result.requestId,
  decision: result.decision,
  reasonCodes: result.reasonCodes,
  policySha256: result.policy.policySha256,
  decisionSha256: result.evidence.decisionSha256,
})
```

Note what the callback means: **your dispatch runs only if the decision
authorised it.** You do not check `result.decision` and decide whether to
proceed — by the time you have a result, the decision has already been enforced.

---

## The three answers

| `result.decision` | What you do |
| --- | --- |
| `allow` | nothing — dispatch already ran inside the callback |
| `deny` | return the error; `result.reasonCodes` says why |
| `approval_required` | hold; surface `result.approval` to a reviewer |

---

## Walking the fixtures

Each file is real adapter output, not illustration, and regenerates via
`node --experimental-strip-types scripts/generate-gateway-interop-fixtures.ts`.

**`allow.json`** — `records.read` is inside policy and off the review list.
`dispatch.attempted: true`, one callback invocation.

**`deny.json`** — `records.delete` is outside the policy.
`capability_not_allowed`, `dispatch.attempted: false`. The callback was never
invoked; that is verified by counting calls, not by reading the field.

**`approval-required.json`** — `records.export` is on the review list. Note
`approval.boundTo`: the policy, input and evidence digests the approval is
addressed by.

**`approval-invalidated.json`** — the same export after the evidence was
revised. `approval_binding_stale`, no dispatch. The grant was not overridden;
the binding changed, so it was not found.

**`indeterminate-recovery.json`** — an authorised action whose receipt came back
indeterminate. `recovery: indeterminate_side_effect`, `safeToRetry: false`.

---

## Checking it yourself

```bash
npm test -- test/mcp-gateway-interop.test.ts
```

Thirteen tests. The four that matter:

| Test | Proves |
| --- | --- |
| a denied action cannot reach the dispatch callback | counts invocations, not decision fields |
| approval is invalidated when its bound evidence changes | paired with a positive control, so it cannot pass vacuously |
| a duplicate idempotency key does not cause a second dispatch | exactly one invocation for one key |
| an authorized action without a receipt becomes indeterminate | and a resumed run does not re-dispatch |

The denial test was mutation-checked: disabling the guard makes it fail. A test
that cannot fail is not evidence.

---

## Deciding whether to go further

Reasonable next questions, none of which this package answers:

1. **Where does policy live?** The reference uses an in-process object. You need
   policy storage, versioning and a change-review path.
2. **Where does approval state live?** In-process here. Approvals crossing a
   restart need durable storage.
3. **Who reviews?** The model requires a `human_reviewer` identity; provisioning
   is yours.
4. **How is an indeterminate action reconciled?** The model refuses to guess,
   which means someone must decide.
5. **Digest custody.** Nothing verifies that a supplied digest matches bytes the
   caller holds. Closing that means hashing at your ingestion boundary.

---

## What has and has not been established

**Has.** The decision is deterministic and reproducible from the fixtures. A
denial cannot reach dispatch. Approvals are content-addressed and invalidate on
change. Duplicate keys do not double-dispatch. Indeterminate actions are not
auto-retried. No credential, argument value, or document content appears in any
request, result, or fixture.

**Has not.** No deployed service. No integration with any specific gateway
product — the shape is chosen for a generic pre-dispatch hook and nothing
depends on a particular one existing. No provider was contacted. No performance
or concurrency characteristic is measured. No external audit or certification.
