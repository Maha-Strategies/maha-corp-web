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

Compatibility manifest: https://www.mahastrategies.com/api/mcp-bridge/manifest

This local commercial bridge is distinct from the hosted Maha Cognitive Gateway at https://mcp.maha-os.com/mcp. The two services use separate credentials and tool sets.

## Other available products

- **MPS Preflight**: $49 self-service private document review. Product page: https://www.mahastrategies.com/mps/preflight. A human authorizes Stripe Checkout; it is automated triage, not a certification or source-by-source human verification.
- **Books & Essays**: Four free public web editions: https://www.mahastrategies.com/books. The paid entitlement adds heading-addressable structured API access for the local MCP bridge; it does not restrict the free web text. Terms: https://www.mahastrategies.com/books/mcp-access. The current price appears in Stripe Checkout before payment is authorized; the checkout endpoint is `POST https://www.mahastrategies.com/api/books/checkout`.
- **Maha OS**: Local-first mobile application. Product page: https://www.mahastrategies.com/software. It is acquired under Apple App Store or Google Play terms; no autonomous purchase endpoint is offered here.
- **Rapid Intelligence Brief**: Starting at $500; inquiry only after authenticated intake and human scope confirmation. https://www.mahastrategies.com/rapid-intelligence-brief
- **Verified Research Brief**: $2,500 fixed-scope research synthesis; inquiry only after authenticated intake and human scope confirmation. https://www.mahastrategies.com/consulting
