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

Maha's `lib/maha-mcp` and `lib/maha-a2a` ship **tool/skill definitions and a
dispatcher — not a wire-protocol server**. There is no stdio server, no
JSON-RPC loop, no HTTP listener in either module.

So these harnesses supply the transport themselves. What that establishes is
that Maha's schemas and dispatch are **consumable by a real client when bound to
a standard transport**. It does *not* establish that Maha ships a server a
client can connect to, because it does not.

## Running them

```bash
npm run interop:mcp
npm run interop:a2a
```

`interop:mcp` needs `@modelcontextprotocol/sdk`, which is deliberately **not** a
dependency of this repo — the product does not depend on it and should not start
to. Install it into the harness directory only:

```bash
npm --prefix interop/mcp install
```

## Why A2A is local-only

No independent A2A client was installable from the local npm cache, and pulling
one would need network authorization. Rather than dress a self-written caller up
as third-party validation, the A2A harness is labelled local-only and does the
most that is honestly available: it puts a real HTTP loopback and a JSON
serialization boundary between caller and handler, and the caller imports
nothing from Maha — it builds every request from the published agent card.

That constraint is what surfaced the finding in `docs/integrations/interoperability-evidence.md`.
