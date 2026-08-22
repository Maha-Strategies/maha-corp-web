# @mahastrategies/maha-mcp-server

An executable MCP server, over stdio, exposing Maha's five read-only
context-control tools.

The tool table and dispatcher already existed in `@mahastrategies/maha-mcp`.
What was missing was the wire: evaluating them meant writing a transport shim
first. This is that shim, shipped.

## Run it

```bash
npx maha-mcp-server
```

It speaks MCP on stdin/stdout, so it looks inert in a terminal. That is correct
— point a client at it.

**stdout carries protocol frames only.** Diagnostics, including `--help`, go to
stderr; anything else printed to stdout would corrupt the stream and surface as
an unexplained client parse error.

## Tools

| Tool | Reads |
| --- | --- |
| `context_control.describe` | nothing |
| `context_control.validate_request` | a request envelope you supply |
| `context_control.compile_sanitized` | a local file you name |
| `context_control.verify_evidence` | an evidence record you supply |
| `context_control.gateway_status` | a local gateway artifact |

There is no sixth tool, and none deploys, pays, or calls a provider.

## Boundaries

- **No credentials.** Refused as arguments (exit 2) and refused in tool
  arguments, rather than silently ignored. Configuration comes from the
  environment.
- **No network.** stdio only; there is no socket to bind.
- **Fails closed.** A compile without runtime configuration refuses rather than
  guessing.
- **Every response states its boundary**, grading each field
  `locally_verified`, `trusted_pass_through`, or `not_established`.

## A note on the dependency

This package declares `@modelcontextprotocol/sdk` as a real dependency, because
a server that speaks MCP needs it. The Maha web application does **not**: the SDK
is a devDependency there, used to compile and exercise this package. That
distinction is load-bearing — the SDK pulls in `express-rate-limit` and, through
it, an `ip-address` release carrying a high-severity SSRF advisory, which has no
business in a web application that never imports any of it.

## What this is not

Not a deployed service — you start it. Not evidence of provider compatibility;
no provider is contacted. A digest commits two parties to the same bytes and
establishes nothing about their truth or authorship.

Validated against the official `@modelcontextprotocol/sdk` over a real stdio
process. See `docs/integrations/transport-evaluation-guide.md`.
