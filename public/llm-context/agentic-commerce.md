# Maha Strategies Agentic Commerce Discovery

Canonical JSON manifest: https://www.mahastrategies.com/agent-offers.json

Read-only discovery API: https://www.mahastrategies.com/api/agentic-commerce/offers

OpenAPI: https://www.mahastrategies.com/api/docs/openapi

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
