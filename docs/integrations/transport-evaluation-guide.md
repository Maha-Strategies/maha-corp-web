# Evaluating the Maha transports

Two runnable transports over the existing dispatchers. Everything below runs on
your machine: MCP speaks stdio, A2A binds loopback, and neither reads a
credential or contacts anything.

Before this, evaluating the MCP and A2A surfaces meant writing a transport shim
first — a strange thing to ask of someone still deciding whether to evaluate you.
These packages are that shim, shipped.

---

## A useful local success path

```bash
npm run demo:context-control
```

This starts the shipped MCP stdio binary and returns a metadata-only JSON
record for three successful, locally useful checks:

1. a synthetic request envelope is admissible under the Context Control gate;
2. the WSO2 gateway artifact passes static contract validation; and
3. a synthetic compiled-evidence record is structurally coherent, with hash
   binding labelled trusted pass-through rather than claimed as verified.

The demo has no credential, network endpoint, provider call, payment, or
customer source text. It is an evaluator journey, not a compression benchmark
or a production compilation claim.

---

## One command

```bash
npm run evaluate:transports
```

Starts both transports against sanitized fixtures and checks **19** behaviours,
weighted towards the safe failure paths — the ones a reviewer cannot confirm
from a README. Expected: `19/19 checks passed.`

| Check | Expected safe outcome |
| --- | --- |
| `mcp.cli.refuses-credential-argument` | exit 2; the value never appears in output |
| `mcp.cli.help-on-stderr-only` | stdout stays empty so it cannot corrupt the protocol stream |
| `a2a.binds.loopback-only` | bound to `127.0.0.1` |
| `a2a.card.publishes-input-schema` | a caller can build a task from the card alone |
| `a2a.card.declares-boundary` | exposure `loopback`, `paymentsInitiated: false` |
| `a2a.task.labels-verification` | envelope `locally_verified`, documents `trusted_pass_through` |
| `a2a.fail.no-implicit-token-budget` | `rejected` / `policy_required` — never defaulted |
| `a2a.fail.unknown-skill-rejected` | `rejected` / `unknown_skill` |
| `a2a.fail.credential-refused` | `credential_rejected`, value not echoed |
| `a2a.fail.replay-returns-original` | `replayed: true`, task not re-run |
| `a2a.fail.unknown-path-404` | no route beyond the card and the task endpoint |
| `a2a.responses.no-credential-values` | no response carries a credential value |
| `compile.fails-closed-without-configuration` | refuses rather than guessing configuration |

---

## Running each transport by hand

### MCP over stdio

```bash
npm --prefix packages/maha-mcp-server run build
node packages/maha-mcp-server/dist/maha-mcp-server/cli.js
```

It speaks MCP on stdin/stdout, so it looks inert in a terminal — that is
correct. Point a client at it. Diagnostics go to stderr; **stdout carries
protocol frames only**, which is why `--help` prints to stderr.

Drive it with the official MCP SDK:

```bash
npm run interop:mcp
```

### A2A over loopback HTTP

```bash
npm --prefix packages/maha-a2a-server run build
node packages/maha-a2a-server/dist/maha-a2a-server/cli.js --port 8787
```

```bash
curl -s http://127.0.0.1:8787/.well-known/agent-card.json
```

The card publishes the task envelope, so a caller never has to guess it.

```bash
npm run interop:a2a
```

---

## Things that should fail, and how

Worth running yourself — refusals are the product.

```bash
node packages/maha-a2a-server/dist/maha-a2a-server/cli.js --host 0.0.0.0
```
Exits 2: `Refusing to bind 0.0.0.0`. Exposure requires `--allow-non-loopback`,
so a reviewer grepping for that flag finds every deliberate exposure.

```bash
node packages/maha-mcp-server/dist/maha-mcp-server/cli.js --api-key anything
```
Exits 2. A credential in an argument lands in shell history and process
listings, so it is refused rather than accepted by a route that leaks it.

```bash
curl -s -X POST http://127.0.0.1:8787/tasks -H 'content-type: application/json' \
  -d '{"taskId":"t1","policy":{},"request":{}}'
```
`rejected` / `policy_required`. There is no default token budget and none is
invented.

---

## Reading a response

Every response carries a boundary statement:

```json
{
  "transport": { "kind": "http_loopback", "networkExposure": "loopback" },
  "verification": {
    "taskEnvelope": "locally_verified",
    "documentContents": "trusted_pass_through",
    "documentAuthenticity": "not_established"
  },
  "credentialsAccepted": false,
  "providerCallsMade": 0,
  "paymentsInitiated": false
}
```

`locally_verified` — this process computed or checked it.
`trusted_pass_through` — you supplied it and nothing here confirmed it.
`not_established` — not checked by anything in this stack.

The distinction is never inferred; each field is graded where it is produced.

---

## What this does and does not establish

**Established.** The official MCP SDK 1.29.0 connects to the shipped
`maha-mcp-server` binary over a real stdio process, lists five tools, calls
each, and is refused on an unknown tool. A loopback HTTP client that imports
nothing from Maha discovers the agent card, builds a task from its published
schema, and gets the documented refusal on each unsafe path.

**Not established.**

- **No deployed service.** These bind loopback and are started by you.
- **A2A is local protocol validation, not third-party interoperability.** The
  caller is written for this repo. No independent A2A client was installable
  without a network fetch, and a self-written caller is not a second
  implementation however carefully it avoids importing Maha.
- **No end-to-end compilation.** `compile_sanitized` fails closed without
  runtime configuration, and is left that way here. Nothing has exercised a
  configured compile.
- **No provider compatibility.** No provider was contacted.
- **No performance claim.** Nothing is measured under load.
- **No payment capability.** Payment is forbidden and no code path exists.
