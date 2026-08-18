# Maha Governance Envelope 0.1.0

The Maha Governance Envelope is a protocol-neutral preflight contract for an
action that will travel over A2A, MCP or an x402-gated HTTP request. It is not a
new transport protocol. Existing protocol messages remain unchanged; adapters
derive this bounded envelope immediately before dispatch.

## Control boundary

The evaluator answers one question: may this identified agent perform this
exact operation against this exact target under this policy now?

It checks exact tenant, agent, transport, target, resource, operation and
capability allowlists; input-size, hop and timeout ceilings; validity window;
human-review labels; and a bound result from Maha's existing x402 buyer-policy
evaluator. It returns one closed outcome: `proceed`, `require_review` or `deny`.

Payment rules are deliberately not duplicated. `lib/x402/buyer-policy.ts`
remains authoritative for resource, network, asset, payee, amount, approval,
receipt and replay checks. The governance envelope accepts only the digest and
identity of an allowed buyer-policy authorization.

## Evidence and privacy

The decision contains RFC 8785 SHA-256 digests of the policy and envelope,
stable identifiers, reason codes and the evaluation time. It cannot contain
prompt text, tool arguments, model output, credentials or health records. The
input is represented only by its byte count and digest; `contentRetained` must
be `false` in both the envelope and evidence.

The evaluator is pure and performs no network call, signature, payment,
storage mutation or forwarding. Durable replay claims, task budgets and audit
storage remain adapter responsibilities.

## Fail-closed rules

- Unknown schema versions, extra fields, malformed identifiers and non-HTTPS
  resources are denied.
- An expired envelope is denied.
- Every requested boundary must be explicitly allowed.
- A paid action is denied unless an allowed buyer policy already authorized it.
- A review-labelled operation never becomes `proceed`; it becomes
  `require_review` and must be handled by a trusted approval system.

## Public artifacts

- `/schemas/maha-governance-envelope-0.1.0.json`
- `/schemas/maha-governance-policy-0.1.0.json`
- `/governance/maha-governance-example.json`

## Gateway adapters

The A2A and MCP proxy engines derive an envelope after their native protocol
and allowlist checks and immediately before the outbound fetch. Existing
tenant-scoped registration records remain authoritative; the adapters convert
those records into the common policy rather than creating a second policy
store. A2A accepts a payment attestation only after the x402 buyer-policy
module has authorized it. MCP declares the action unpaid.

Both gateways return outcome, evidence-digest and policy-digest response
headers and add those three metadata fields to their existing success audit
entry. The outcome is the pre-dispatch governance decision, not a claim that
delivery or settlement later succeeded. Native JSON-RPC request and response
bodies are unchanged. The current principal is the authenticated tenant's
Maha gateway adapter, not a claim that
the external calling agent has an independently verified identity. Caller
agent identity should remain outside the envelope until a real authentication
source can bind it.

## Durable workflow state

`lib/workflows/task-state.ts` maintains one tenant-and-task-scoped lifecycle
across A2A agents, MCP servers and an eventual orchestrator. It is separate
from the A2A payment budget: a payment ledger answers how much a task spent;
the workflow ledger answers what the task is waiting for and which governed
actors participated.

The closed states are `pending`, `running`, `awaiting_input`,
`awaiting_review`, `awaiting_payment`, `completed`, `failed` and `cancelled`.
Redis applies each transition atomically, rejects illegal transitions, treats
a repeated transition identifier idempotently and prevents terminal tasks from
being reopened. A2A waiting states are mapped onto this lifecycle, while an
A2A participant's terminal result is recorded as a participant event rather
than falsely completing the multi-agent workflow. An ordinary successful MCP
call likewise records an action success without declaring the workflow done.
Only an explicit orchestrator transition can complete, fail or cancel the
shared task.

The event history contains only versions, timestamps, transport, target,
operation and governance-evidence digests. It never stores prompts, arguments
or outputs. State, transition replay keys and the most recent 200 events expire
after 30 days. Responses carrying workflow attribution expose
`X-Maha-Workflow-State` and `X-Maha-Workflow-Version` alongside the governance
headers. An orchestrator can use the exported store interface to approve
review, supply input, complete, fail or cancel a task without changing either
gateway protocol.

When the caller supplies `x-maha-task-id`, both gateways derive the same opaque
workflow identifier from it; the raw customer identifier is not copied into
this ledger. A2A uses its existing protocol-derived task identifier when that
header is absent. The A2A payment-budget key remains unchanged and separate.

## Restrictive inheritance

An orchestrator may supply an ordered tenant, workflow and action policy chain
to either adapter. Every layer names its immediate parent. Lists are
intersected, numeric ceilings take the minimum, review requirements accumulate
and a payment prohibition dominates every descendant. A child therefore
cannot restore authority removed by an ancestor. Cycles, broken ancestry and
chains deeper than eight layers fail closed. The resolved policy version is a
content-derived digest of the complete chain, so an approval under an older
policy cannot authorize a changed one.

The public routes currently derive their root policy from the registered A2A
agent or MCP server. Policy layers are an orchestrator input to the proxy
interfaces; they are not accepted as untrusted request JSON.

## Human approvals

A `require_review` result creates a durable, 15-minute approval request bound
to the stable action digest, resolved policy digest, tenant and workflow task.
The gateway returns `X-Maha-Approval-ID` and `X-Maha-Approval-State`. An
operator decides it through
`POST /api/v1/workflows/{taskId}/approvals/{approvalId}` using a distinct,
environment-scoped `WORKFLOW_CONTROL_TOKEN`, an idempotency key and a bounded
reason code. Only a token fingerprint is retained. Approved grants are
single-use; denials, expiry, a changed input digest or a changed policy prevent
dispatch.

## Replay-safe recovery

Callers that need retry correlation supply `x-maha-task-id` and
`x-maha-action-id`. The routes hash both into opaque identifiers. Before the
outbound call, Redis atomically claims the action against its stable action and
policy digests. A repeated action ID is never dispatched again. Instead the
gateway returns HTTP 409 with `X-Maha-Recovery-State`,
`X-Maha-Action-ID` and, when known,
`X-Maha-Recovery-Evidence`.

The recovery record contains only status, timestamps, HTTP status, a response
digest and an optional hashed upstream reference. It does not retain the
response body, so it proves prior execution but cannot replay a lost result.
Transport exceptions after dispatch are recorded as `indeterminate`; they are
not treated as permission to try again automatically. A2A payment negotiation
uses a distinct action ID for the unpaid challenge and the subsequently
authorized paid attempt, while its payment authorization and cumulative task
budget remain independently replay-protected.
