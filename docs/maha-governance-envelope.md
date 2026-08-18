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

## Next adapter work

The first adapters should derive envelopes at the existing A2A and MCP gateway
boundaries, record only the returned decision, and preserve each protocol's
native request and response. A later conformance corpus should run the same
allow, review and deny fixtures through all three transports.
