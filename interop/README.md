# Interoperability validation

Two harnesses, at deliberately different evidence grades. The difference is the
point: one exercises Maha through software Maha did not write, the other only
crosses a wire boundary. Reporting both as "validated" would erase the
distinction that matters to an architect.

| Harness | Grade | Client |
| --- | --- | --- |
| `interop/mcp` | **Third-party** | `@modelcontextprotocol/sdk` — the official MCP reference implementation |
| `interop/a2a` | **Local-only** | A caller written for this repo; no independent A2A client was available |

Neither harness uses credentials, calls a provider, makes a payment, or touches
production. Both record metadata only.

## What is being validated, precisely

Maha's `lib/maha-mcp` and `lib/maha-a2a` contain the tool/skill definitions and
dispatchers. The shipped `@mahastrategies/maha-mcp-server` package adds the MCP
stdio transport; `interop/mcp` drives that binary directly. The A2A server is a
loopback HTTP server supplied by the local harness.

The MCP result establishes that the shipped stdio server is consumable by the
official MCP client. The A2A result establishes only local wire compatibility:
the caller is purpose-built and is not third-party validation.

## Running them

```bash
npm run interop:mcp
npm run interop:a2a
```

`interop:mcp` drives the built server binary. Build it first:

```bash
npm --prefix packages/maha-mcp-server run build
npm run interop:mcp
```

## Why A2A is local-only

No independent A2A client was installable from the local npm cache, and pulling
one would need network authorization. Rather than dress a self-written caller up
as third-party validation, the A2A harness is labelled local-only and does the
most that is honestly available: it puts a real HTTP loopback and a JSON
serialization boundary between caller and handler, and the caller imports
nothing from Maha — it builds every request from the published agent card.

That constraint is what surfaced the finding in `docs/integrations/interoperability-evidence.md`.

## Why `interop/` is excluded from the repo typecheck

`tsconfig.json` and the ESLint config both skip this directory. The MCP probe is
plain JavaScript and imports the MCP SDK as a client-only compatibility check;
the production server package carries its own SDK dependency. Keeping the probe
outside the product compilation boundary avoids making application typechecking
depend on evaluation-only code.
