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
- Bazaar discovery-to-payment recipe (CDP and Viem wallets): https://www.mahastrategies.com/recipes/bazaar-discovery-to-payment

This capability accepts autonomous payment under the terms in its `PAYMENT-REQUIRED` challenge. This exception does not authorize autonomous Stripe Checkout, research engagements, enterprise onboarding, or spending through the local Maha MCP Bridge.

## Deep Context Evaluation via x402

- API: `POST https://www.mahastrategies.com/api/v1/compress/evaluate`
- Payment protocol: x402 v2, exact scheme
- Network: Base Mainnet (`eip155:8453`)
- Price: 10,000 USDC base units (`0.01 USDC`)
- Alternative authorization: a provisioned Maha API key
- Input bounds: 1-8 documents, 1-32 required-evidence spans, 1,050,000 request bytes
- Returns: the compiled Context Pack, source-linked included passages, input and output hashes, original and compiled token estimates, `tokensSaved`, source coverage, `requiredEvidenceCount`, `retainedEvidenceCount`, `requiredEvidenceRetentionPercent`, machine-readable limitation codes, and zero-retention flags

What the retention figure means, precisely: the fraction of the evidence spans **you labelled** that appear verbatim in the compiled pack. It is exact span matching. It is **not** factual accuracy, **not** answer quality, **not** verification, and **not** hallucination prevention. A retained span means the text survived selection, not that the text is true. An omitted span means the budget or the ranker dropped it, and the response says which.

No source text, compiled context, or evidence span text is retained. Only hashes and counts are.

**Status: available.** Payable autonomously on Base Mainnet under the terms above.

## Autonomous MPS Audit via x402 (withheld — not currently payable)

- API: `POST https://www.mahastrategies.com/api/v1/mps/audit`
- Retrieval and resume: `GET`/`POST https://www.mahastrategies.com/api/v1/mps/audit/{auditId}`
- Payment protocol: x402 v2, exact scheme
- Network: Base Mainnet (`eip155:8453`)
- Price: 100,000 USDC base units (`0.10 USDC`)
- Authorization: x402 only. This route requires **no** Maha credential and consumes **no** prepaid MPS audit credit. The credential and prepaid path at `/api/mps-audits` is unchanged and separate.
- Input bounds: 6,000-character passage, 32 KB request body

What this is: automated claim triage. Each substantive claim in the passage is returned with a model-assigned provenance status (`VERIFIED`, `SOURCED`, `BOUNDARY`, `ILLUSTRATIVE`, `UNVERIFIED`), a one-sentence rationale, and a suggested action.

What this is not: it is **not factual certification**, **not legal advice**, and **not human verification**. The statuses are model judgements about what a passage's own text supports, and they must be checked before publication.

Retention, stated precisely: **the complete submitted passage is not retained.** Audit results retain short verbatim claim excerpts (6-25 words each), classifications, rationales, hashes, and operational metadata. An audit that could not quote the claim it tagged would be unusable, so the excerpts are retained by design. An earlier version of this page claimed no source text was retained at all; that was wrong.

**Status: withheld.** This offer is described here and is not payable in any environment. It is blocked on database separation and on proving durable paid-job recovery against a real deployment.

Recovery. The response carries a one-time high-entropy `retrievalToken`. A paid job is retrievable and resumable at the retrieval path without a second payment, up to three model attempts. Because no source text is stored, a resume must resubmit the original passage; it is accepted only if it hashes to the passage the job was paid for. Keep the token: it is issued once and the `auditId` alone is not sufficient to read a result.

## Which routes accept autonomous payment

Three offers are published. Only the ones marked payable below accept autonomous payment today, and only at these exact method-and-path pairs:

| Offer | Method and path | Price | Payable now |
| --- | --- | --- | --- |
| `context-compression` | `POST /api/v1/compress` | 1,000 USDC base units | yes |
| `deep-context-evaluation` | `POST /api/v1/compress/evaluate` | 10,000 USDC base units | yes |
| `mps-autonomous-audit` | `POST /api/v1/mps/audit` | 100,000 USDC base units | no — withheld |

A published price is not an offer to sell. Only a live `PAYMENT-REQUIRED` challenge proves an offer can be bought; the `status` and `payableNow` fields in the manifests are authoritative for everything else. Complete machine-readable declarations, including the uncompacted schemas, are at `https://www.mahastrategies.com/api/discovery/x402-offers/{offerId}`.

Matching is exact. A sub-path of a priced route is not priced by inheritance, and a `GET` beside a priced `POST` is not the priced resource. The GPU optimization routes (`/api/v1/jobs/*`) are **not** x402 products in this phase and require a provisioned API key.

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
