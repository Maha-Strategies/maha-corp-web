# Maha MPS Preflight MCP server

**Endpoint:** `https://www.mahastrategies.com/api/mcp/mps-preflight`  
**Transport:** Streamable HTTP  
**Authentication:** None; rate-limited per visitor

The server exposes one read-only tool: `mps_claim_preflight`.

Supply one **sanitized** nonfiction passage of no more than 6,000 characters. It returns a Maha Provenance Standard (MPS/0.1) claim map with provenance tags and suggested review actions. It does not retain the passage in the returned record, but it is a public service: do not send confidential, personal, regulated, or sensitive material.

The tool provides automated triage only. It does not verify facts, certify a document, or replace specialist review. The public quota is intentionally limited. For private, longer document processing, use [MPS Preflight](https://www.mahastrategies.com/mps/preflight).

Registry submission metadata: [`mps-preflight.server.json`](https://www.mahastrategies.com/mcp/mps-preflight.server.json).
