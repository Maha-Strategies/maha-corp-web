# `@mahastrategies/x402-agentcore`

Application-owned x402 purchase controls for an OpenAI agent tool using Amazon
Bedrock AgentCore Payments.

The package keeps payment authority outside the model. A model may propose only
a resource URL and business purpose. Application code supplies the approved
policy, identities, human approval, payer, payment-session provider, and
settlement verifier.

## Safety properties

- Exact resource, network, asset, payee, amount, and schema checks before a
  payment session is created.
- Exact approved-purpose matching in addition to the underlying Maha buyer
  policy.
- Atomic per-task budget and authorization replay checks through a caller-owned
  ledger.
- A one-use economic tool capability per agent run.
- Exactly one payment-proof request and exactly one paid merchant request.
- No automatic retry after a proof is created.
- Receipt and optional independent on-chain settlement verification.
- Payment-session deletion in `finally`, with cleanup failure surfaced as an
  operator-recovery condition.
- Audit events contain lifecycle outcomes, never session handles, payment
  headers, wallet keys, or merchant response content.

## AWS SDK adapter

The base import remains provider-neutral. Applications using the official AWS
JavaScript SDK can opt into the concrete subpath:

```ts
import { BedrockAgentCoreClient } from '@aws-sdk/client-bedrock-agentcore'
import { createAwsAgentCorePaymentsAdapter } from '@mahastrategies/x402-agentcore/aws'

const payments = createAwsAgentCorePaymentsAdapter({
  managementClient, // management IAM role, maxAttempts: 1
  executionClient,  // ProcessPayment IAM role, maxAttempts: 1
  paymentManagerArn,
  paymentInstrumentId,
  userId,
  agentName,
  journal,
})
```

The two clients must be different instances. The adapter creates the shortest
AgentCore-supported session, converts integer USDC base units to an exact USD
decimal session ceiling, submits one `CRYPTO_X402` `ProcessPayment` command,
and requires a confirmed hard delete. It never retries a payment operation.

## Integration boundary

The package keeps small callback interfaces around the concrete optional AWS
adapter. Implement `AgentCoreMerchantAdapter` with your protected resource
client. The policy behavior stays testable without AWS credentials or value
transfer.

```ts
import {
  CONTROLLED_X402_FETCH_TOOL,
  createAgentCoreControlledCommerceTool,
  parseAgentPurchaseArguments,
} from '@mahastrategies/x402-agentcore'

const tool = createAgentCoreControlledCommerceTool({
  policy,
  ledger,
  approvedPurposes: ['supplier_due_diligence'],
  payer,
  merchant,
  payments,
  confirmSettlement,
  verifyHumanApproval,
})

// Supply CONTROLLED_X402_FETCH_TOOL to the Responses API or Agents SDK. After
// the model requests it, parse only the two permitted model-owned arguments.
const request = parseAgentPurchaseArguments(functionCall.arguments)

// Application-owned state is injected outside model control.
const result = await tool.purchase(request, {
  requestId: 'request-supplier-0001',
  taskId: 'task-supplier-0001',
  authorizationId: 'authorization-supplier-0001',
  idempotencyKey: 'purchase-supplier-0001',
})
```

The returned `report` may be passed to the model. The payment proof, session
handle, wallet material, and complete application state are never returned.

## Non-claims

This package does not provision AWS resources, hold keys, sign authorizations,
discover merchants, or establish blockchain finality by itself. The caller must
provide authenticated approval, a durable atomic ledger, an AgentCore Payments
adapter, and an independent settlement verifier appropriate to production.
