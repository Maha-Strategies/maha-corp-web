# Maha Strategies Agentic Commerce Discovery

Canonical JSON manifest: https://www.mahastrategies.com/agent-offers.json

Read-only discovery API: https://www.mahastrategies.com/api/agentic-commerce/offers

OpenAPI: https://www.mahastrategies.com/api/docs/openapi

## Context Compression via x402

- Product page: https://www.mahastrategies.com/context-compiler
- API: `POST https://www.mahastrategies.com/api/v1/compress`
- Payment protocol: x402 v2, exact scheme
- Network: Base Mainnet (`eip155:8453`)
- Price: 1,000 USDC base units (`0.001 USDC`)
- Bazaar MCP discovery: https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp
- Alternative authorization: a provisioned Maha API key
- Reproducible MCRB-1 benchmark: https://www.mahastrategies.com/benchmarks/context-retention
- Aggregate benchmark results: https://www.mahastrategies.com/benchmarks/mcrb-1/results.json
- Executable large-document recipe: https://www.mahastrategies.com/recipes/context-compiler-large-document

This capability accepts autonomous payment under the terms in its `PAYMENT-REQUIRED` challenge. This exception does not authorize autonomous Stripe Checkout, research engagements, enterprise onboarding, or spending through the local Maha MCP Bridge.

## MPS Prepaid Audit API Access

- Product page: https://www.mahastrategies.com/mps/audit-access
- API capability: `mps_audit`
- Audit endpoint: `POST https://www.mahastrategies.com/api/mps-audits`
- Credit balance endpoint: `GET https://www.mahastrategies.com/api/mps-credits`
- Checkout endpoint: `POST https://www.mahastrategies.com/api/mps-credits/checkout`
- Credit unit: `mps_audit_invocation`

MPS audit access is a prepaid API product. One credit is atomically reserved before an audit reaches the model. A failed audit returns the reserved credit. A prepaid credential with no credits receives HTTP `402 Payment Required` and a purchase link.

The current fixed-pack price and available payment methods are presented in Stripe Checkout before payment is authorized. A human purchaser must authorize the Stripe payment; this document and the discovery API do not authorize an autonomous charge.

A checkout creates a credential scoped only to MPS audits. It activates only after Stripe's signed webhook confirms payment. The plaintext credential is shown once in the purchaser's browser, cannot be recovered later, and must be stored in a secret manager. Credentials are rate-limited, expiring, and revocable.

## MCP bridge

The local MCP bridge package is `@mahastrategies/maha-mcp-bridge`. Install it with:

```sh
npm install -g @mahastrategies/maha-mcp-bridge
```

The bridge uses the documented API with a user-held credential. It has no merchant secret or autonomous spending authority.

Compatibility manifest: https://www.mahastrategies.com/api/mcp-bridge/manifest

This local commercial bridge is distinct from the hosted Maha Cognitive Gateway at https://mcp.maha-os.com/mcp. The two services use separate credentials and tool sets.

## Enterprise MCP Gateway

The Enterprise MCP Gateway is separate from both the local bridge and the hosted Cognitive Gateway. It is a tenant-scoped control layer for registered upstream MCP servers: https://www.mahastrategies.com/enterprise-mcp-gateway

- Contract: https://www.mahastrategies.com/mcp-gateway-contract.json
- Gateway endpoint: `POST https://www.mahastrategies.com/api/v1/mcp/gateway/{serverId}`
- Registration: `POST https://www.mahastrategies.com/api/v1/mcp/register`
- Policy: `PATCH https://www.mahastrategies.com/api/v1/mcp/servers/{serverId}`
- Required credential: a provisioned Maha tenant API key.
- Enforced boundary: the verified API-key tenant and registered server must match; tool calls require an explicit allowlist.
- The gateway supports public HTTPS JSON upstreams and encrypts configured bearer or HMAC credentials. Private-network connectivity and upstream OAuth token exchange remain future integrations.

## Context Compiler

The credentialed Context Compiler produces a bounded, source-linked Context Pack before an agent receives document context. The lightweight `/api/v1/compress` contract above is the separate API-key-or-x402 path intended for automated callers.

- Product page: https://www.mahastrategies.com/context-compiler
- API: `POST https://www.mahastrategies.com/api/context-packs`
- Request schema: https://www.mahastrategies.com/context-pack-schema.json
- Required credential capability: `context_compile`
- The service returns source references, hashes, and model-neutral estimated-token metrics. It retains neither source text nor compiled context in its ledger, and it does not make verification or hallucination-prevention claims.

## Context Pack Evaluator

- Product page: https://www.mahastrategies.com/context-pack-evaluator
- API: `POST https://www.mahastrategies.com/api/context-pack-evaluations`
- Request schema: https://www.mahastrategies.com/context-pack-evaluation-schema.json
- Required credential capability: `context_compile`
- The evaluator requires each test span to be an exact span from a declared source document. It returns retained/omitted evidence status and efficiency metrics; it does not evaluate factual accuracy or a model's final answer.
- GitHub Action: `Maha-Strategies/maha-corp-web/.github/actions/maha-context-evidence@main`. It uses a `context_compile` credential stored as a GitHub Secret and can fail a pull request below a configured evidence-retention threshold.

## Other available products

- **MPS Preflight**: $49 self-service private document review. Product page: https://www.mahastrategies.com/mps/preflight. A human authorizes Stripe Checkout; it is automated triage, not a certification or source-by-source human verification.
- **Books & Essays**: Four free public web editions: https://www.mahastrategies.com/books. The paid entitlement adds heading-addressable structured API access for the local MCP bridge; it does not restrict the free web text. Terms: https://www.mahastrategies.com/books/mcp-access. The current price appears in Stripe Checkout before payment is authorized; the checkout endpoint is `POST https://www.mahastrategies.com/api/books/checkout`.
- **Maha OS**: Local-first mobile application. Product page: https://www.mahastrategies.com/software. It is acquired under Apple App Store or Google Play terms; no autonomous purchase endpoint is offered here.
- **Rapid Intelligence Brief**: Starting at $500; inquiry only after authenticated intake and human scope confirmation. https://www.mahastrategies.com/rapid-intelligence-brief
- **Verified Research Brief**: $2,500 fixed-scope research synthesis; inquiry only after authenticated intake and human scope confirmation. https://www.mahastrategies.com/consulting
