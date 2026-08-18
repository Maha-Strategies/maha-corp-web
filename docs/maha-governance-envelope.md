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
