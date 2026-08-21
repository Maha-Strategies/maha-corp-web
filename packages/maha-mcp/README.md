# @mahastrategies/maha-mcp

An MCP surface exposing read-only context-control evaluation tools.

## Tools

| Tool | Read-only | Purpose |
| --- | --- | --- |
| `context_control.describe` | yes | Contract version, extension, placeholder, headers, boundaries. |
| `context_control.validate_request` | yes | Validate an envelope without compiling it. |
| `context_control.compile_sanitized` | no | Compile a sanitized fixture against a configured local or test endpoint. |
| `context_control.verify_evidence` | yes | Structural verification of an evidence record. |
| `context_control.gateway_status` | yes | Static gateway artifact validation. |

## The safety property is structural

Those five are the complete dispatch table. Nothing that deploys, pays,
registers, or reaches a model provider exists in this module to be enabled.
**A hidden dangerous tool is one flag away from being a live one; an absent one
is not.**

No tool accepts a credential. `compile_sanitized` reads the secret from the
environment, so a model driving this surface cannot supply, learn, or exfiltrate
one through a tool call — and any argument whose name looks like a credential is
rejected before dispatch, whatever the schema said.

Every response carries an evidence boundary declaring `providerCallsMade: 0`,
`credentialsAccepted: false`, and the limitations that apply.

## Configure

```jsonc
{
  "mcpServers": {
    "maha-context-control": {
      "command": "node",
      "args": ["./node_modules/@mahastrategies/maha-mcp/dist/maha-mcp/index.js"],
      "env": {
        "MAHA_COMPILER_URL": "http://localhost:3000/api/integrations/gateway/context-compiler"
      }
    }
  }
}
```

Point `MAHA_COMPILER_URL` at a local or test endpoint. Set the secret in the
environment, never in the client configuration.

MIT licensed. Prerelease: `0.1.0`.
