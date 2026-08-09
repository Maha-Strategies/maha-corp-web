# Integration patterns

The policy gate belongs immediately before the wallet signer. The settlement
gate belongs immediately after the paid response and independent chain read.

## Viem and x402 fetch

Use the EIP-3009 nonce as `authorizationId`. An asynchronous pre-signing hook
must await `authorizePayment()` before calling `account.signTypedData()`.

```ts
async function beforeSign(requirement, challenge, transferAuthorization) {
  const decision = await authorizePayment({
    policy, ledger,
    intent: {
      taskId: agentRunId,
      authorizationId: transferAuthorization.nonce,
      requestedResource: requestUrl,
      declaredResource: challenge.resource.url,
      requirement,
      schema: validatedBazaarSchema,
    },
  })
  if (!decision.allowed) throw new Error(decision.code)
  return decision
}
```

## LangChain.js

Wrap the paid network call in a `DynamicStructuredTool`. Use the LangChain run
identifier as `taskId`; do not create a fresh task ID for every tool call or the
per-task ceiling becomes meaningless. Validate tool input and the discovered
resource schema before invoking the buyer policy.

## MCP clients

Apply the buyer policy after validating `tools/call` arguments but before the
HTTP payment transport. Keep the MCP request ID, agent task ID, and EIP-3009
nonce as three distinct fields. An allowlist for an MCP tool name is not a
substitute for the buyer policy's exact resource and payee binding.

## Python LangChain and CrewAI

The TypeScript package is not imported into Python. Load and validate
`policy.schema.json`, then reproduce the same structured decision codes in the
single tool that owns wallet access. The agent should receive a denial code, not
the raw key, signer, or approval credential. A native Python port should use the
public conformance tests before claiming parity.

## Human approval

`verifyHumanApproval` must call a trusted boundary: verify an operator
signature, read an authenticated approval record, or consult a hardware-backed
policy service. Returning `true` because an approval-shaped object is present
defeats the control and is explicitly outside this reference design.
