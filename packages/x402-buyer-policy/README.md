# @mahastrategies/x402-buyer-policy

A zero-dependency reference policy layer for autonomous x402 buyers. It runs
before a wallet signs and after a seller returns settlement evidence. It does
not discover endpoints, hold keys, sign messages, or submit payments.

## Controls

- Maximum price per call and atomic maximum spend per task.
- Approved CAIP-2 networks, assets, payees, schemes, and exact resources.
- Valid discovery-schema evidence before signing.
- Scoped, expiring human approval above a configured threshold.
- Authorization and settlement replay protection through a pluggable ledger.
- `PAYMENT-RESPONSE` binding and optional independent on-chain confirmation.

## Install

```sh
npm install @mahastrategies/x402-buyer-policy
```

## Use before signing

```ts
import {
  authorizePayment,
  createInMemoryBuyerPolicyLedger,
  type BuyerPolicy,
} from '@mahastrategies/x402-buyer-policy'

const policy: BuyerPolicy = {
  schemaVersion: '1.0.0',
  policyId: 'research-agent-prod',
  policyVersion: '2026-08-09',
  approvedSchemes: ['exact'],
  approvedResources: ['https://api.example.com/v1/research'],
  approvedPayees: ['0x1111111111111111111111111111111111111111'],
  assetRules: [{
    network: 'eip155:8453',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    maxAmountPerCall: '5000',
    maxAmountPerTask: '25000',
    humanApprovalAbove: '2000',
  }],
  requireValidatedSchema: true,
  settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
}

const ledger = createInMemoryBuyerPolicyLedger() // examples and one process only
const decision = await authorizePayment({
  policy,
  ledger,
  intent: {
    taskId: 'task-research-0001',
    authorizationId: crypto.randomUUID(),
    requestedResource: 'https://api.example.com/v1/research',
    declaredResource: challenge.resource.url,
    requirement,
    schema: { status: doctorReport.ok ? 'valid' : 'invalid' },
  },
})

if (!decision.allowed) throw new Error(`${decision.code}: ${decision.message}`)
// Only now invoke the wallet signer.
```

The in-memory ledger is deliberately not presented as production-safe. A
production adapter must atomically enforce the task total and authorization
claim in Redis, Postgres, a durable object, or equivalent shared storage.
Threshold exceptions additionally require `verifyHumanApproval`; an approval
object supplied by the agent is never treated as authenticated by itself.

## Framework boundary

The policy is framework-neutral TypeScript. LangChain.js, MCP TypeScript clients,
and Viem can invoke it directly before their signing callback. Python LangChain
and CrewAI applications should enforce the published `policy.schema.json` in
their own payment boundary until a separately maintained Python port exists.

The complete executable recipe and settlement-verification example are at:
https://www.mahastrategies.com/x402-buyer-policy

## License

Apache-2.0
