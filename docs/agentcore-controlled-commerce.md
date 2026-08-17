# Controlled agentic commerce with Maha buyer policy

This demonstration applies Maha's existing x402 buyer-policy controls to the
application boundary described by OpenAI and AWS for controlled agentic
commerce.

The model may request only a resource URL and a declared business purpose.
Application code retains the approved policy, request and task identities,
human approval, payer, AgentCore payment-session adapter, durable budget ledger,
and settlement verifier.

## Flow

1. The merchant is called without payment to obtain an x402 challenge.
2. Maha binds the exact resource, purpose, scheme, network, asset, payee,
   amount, validated schema, approval, authorization identity, and cumulative
   task budget.
3. Only an allowed decision may create a short-lived AgentCore payment session.
4. The adapter requests exactly one proof and makes exactly one paid merchant
   request. There is no automatic paid retry.
5. Merchant receipt evidence is compared with independent chain evidence.
6. The settlement transaction is claimed once, the response bytes are hashed,
   and the AgentCore session is deleted in `finally`.
7. The model receives the report and redacted evidence—not wallet material,
   payment headers, session handles, or the complete application audit state.

The package exports a strict, dependency-free `x402_fetch` function-tool
declaration for the OpenAI Responses API or Agents SDK. Its parser rejects any
model attempt to supply payment terms, approvals, identities, or credentials;
only `resource_url` and `purpose` cross the model/application boundary.

## Run the no-money demonstration

```bash
npm run demo:agentcore-commerce
```

The scripted run covers:

- an approved 1,000-base-unit purchase;
- a wrong payee;
- a 1,000,000-base-unit ($1 USDC) challenge above policy;
- a thresholded request without authenticated human approval;
- a fabricated merchant receipt; and
- indeterminate independent settlement evidence.

The successful case uses synthetic adapters and reports
`valueTransferred: false`. Denied pre-signing cases must show zero sessions,
zero proofs, and zero paid requests. Post-payment evidence failures must show
exactly one proof and one paid request, with no retry.

## Package boundary

`@mahastrategies/x402-agentcore` compiles the same canonical buyer-policy source
as `@mahastrategies/x402-buyer-policy`; it does not maintain a second policy
implementation. Its callback boundary keeps the controls testable without AWS
credentials while allowing a production application to use the supported
AgentCore Payments SDK.

The adapter is intentionally not an AWS provisioning library. A production
integration must separately provision the payment manager, connector,
instrument, exact-wallet permissions, IAM role separation, testnet/mainnet
gates, log delivery, and recovery procedure required by the operator's AWS
account.

## Live promotion gates

Do not run a value-bearing test until all of these are satisfied:

1. A reviewed AgentCore Payments adapter implements the currently supported AWS
   SDK, with roles and opt-ins separated.
2. A durable atomic ledger replaces the in-memory reference ledger.
3. The exact merchant resource, purpose, network, asset, payee, and maximum
   amount are confirmed from a fresh unpaid challenge.
4. One explicit authorization states the maximum value, payer, payee, resource,
   network, and number of signatures.
5. The client makes at most one signature and one paid request, with no
   automatic retry.
6. Session cleanup, merchant receipt verification, independent settlement
   confirmation, and sanitized evidence all pass.

Merchant HTTP 200 acceptance is not blockchain finality. The evidence contract
keeps `settlementVerified` false unless the caller's independent verifier
returns evidence that binds the transaction, network, asset, payer, payee, and
amount to the authorization.

## Reference

The architecture follows the responsibility split demonstrated in OpenAI's
"Build an AI agent that can pay for APIs using AgentCore Payments" cookbook:
the agent requests the tool, the application owns authorization and audit
state, AgentCore creates a bounded proof, and the merchant serves the paid
resource.

https://developers.openai.com/cookbook/examples/partners/aws/controlled_agentic_commerce_with_agentcore_payments/controlled_agentic_commerce
