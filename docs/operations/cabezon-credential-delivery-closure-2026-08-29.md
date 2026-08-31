# CABEZON credential-to-delivery closure

Date: 2026-08-29  
Result: **passed**  
Workflow: `33246355908`  
Branch: `codex/cabezon-product-federation`  
Commit: `23353d62aae7aea5cac15023b641cfd5e2f7fd35`

## Outcome

The private machine-commerce lifecycle completed end to end in a fresh, ephemeral, schema-only Supabase Preview branch. The run created one fully governed and explicitly synthetic Preview release, issued one ephemeral machine credential, attached one zero-dollar internal-evaluation license, retrieved the exact released evidence through the licensed MCP tool, proved replay safety and selector-substitution refusal, and bound the result into a CABEZON delivery reference and acknowledgement.

The run did not enable payment, escrow, entitlement mutation, broader canonical-release authority, external delivery or any Production mutation.

## Verified lifecycle

- Product federation discovery: pass
- Stale product projection: blocked
- Substituted CARP endpoint: blocked
- Unavailable enquiry: blocked
- Bounded licensed-evidence enquiry: pass
- Enquiry replay: idempotent
- Licensed MCP evidence retrieval: pass
- MCP request replay: idempotent
- Selector substitution under a reused request ID: blocked
- Unavailable release: blocked
- Digest-bound CABEZON delivery reference: pass
- Delivery acknowledgement: pass

The lifecycle evidence digest is `sha256:811ea1cba4e5f5dc09e72fc9ac015fe7664a0198d5b79e010160b6482d4fc8bf`.

## Governed synthetic release

The release was Preview-only, synthetic and internally reviewed against four explicit scopes: source fidelity, domain fidelity, rights and locator, and boundary adequacy. Operations and release-authority credentials were distinct. No external review, scientific validation or commercial transaction was claimed.

The governed-release evidence digest is `sha256:9fcea54693da8bbf0928e2bf209bce3babedf4a177de7ddbd846674a692f941a`.

## Migration correction

The first lifecycle attempt revealed that a schema-only branch does not inherit the private CABEZON lifecycle ledger. The workflow now applies and verifies exactly two private migrations, in order:

1. `20260828110000_cabezon_preview_seller_adapter.sql`
2. `20260829000100_mcp_evidence_tool_licensing.sql`

The workflow verifies 18 required tables and functions and records both migration digests. It does not apply a migration glob or touch Production.

The first attempt created and then revoked its credential and grant. A second attempt encountered the intentionally append-only synthetic target from that first branch. The branch was destroyed rather than mutating or silently reusing immutable history, and the final run used a new clean schema-only branch.

## Temporary bypass boundary

Vercel automation bypass secrets are project-level; the owner explicitly authorized that temporary scope after being informed of the constraint. The secret was stored and used only for the exact CABEZON Preview workflow and deployment. Only its SHA-256 fingerprint was retained: `sha256:754a53d5d4f41014a4a88dbeb4c37e35ad22da090619ebe9e36142c1981ac2ab`.

The bypass was revoked immediately after the successful canary.

## Cleanup

- Ephemeral MCP license grant revoked
- Ephemeral machine credential revoked
- Temporary Vercel bypass revoked
- Protected GitHub Preview environment deleted
- Eleven exact-branch Vercel variables deleted
- Four credential-bearing Preview deployments deleted
- Ephemeral Supabase branch deleted
- Local secret files deleted after evidence validation

No credential, bearer token, database URL, service-role key, participant data or confidential corpus material appears in this report.
