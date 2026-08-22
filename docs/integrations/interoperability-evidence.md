# MCP and A2A interoperability evidence

Recorded 2026-08-22. Metadata only: no credentials, no source text, no provider
calls, no payments, no production effect.

## The gap this addresses

MCP and A2A were previously exercised **in process** — the tests import
`callMcpTool` and `handleA2ATask` directly. That proves the dispatcher works. It
cannot prove a client could reach it, because the test author constructs request
shapes by reading the implementation, which is precisely what an outside caller
cannot do.

## What was found first

Both modules ship **definitions and a dispatcher, and no transport**. There is no
stdio server, no JSON-RPC loop, and no HTTP listener in either. So neither can be
connected to as shipped, and both harnesses supply the transport themselves.

**This bounds every claim below.** What is validated is that Maha's schemas and
dispatch are *consumable by a client when bound to a standard transport*. That
Maha ships a connectable server is **not** claimed, because it does not.

---

## MCP — third-party validated

| | |
| --- | --- |
| Client | `@modelcontextprotocol/sdk` **1.29.0** — the official MCP reference implementation |
| Runtime | Node v26.5.0 |
| Transport | stdio to a child process |
| Egress | none; no credential read; 0 provider calls |

Reproduce with `npm run interop:mcp`.

| Surface | Result |
| --- | --- |
| `initialize` | ok — server identified as `maha-context-control` 0.1.0 |
| `tools/list` | ok — 5 tools, every one carrying an object `inputSchema` |
| `tools/call` ×5 | all dispatched; 4 returned `ok: true` |
| `tools/call` unknown tool | refused |
| Evidence boundary | declared on all 5 responses |

`context_control.compile_sanitized` returns `ok: false` with
`compile_failed: Configuration is incomplete`. That is **correct fail-closed
behaviour** in a probe environment with no gateway configuration, and it wrote
no output file. It was not forced green by supplying a secret, because doing so
would have meant a provider call.

### A note on the first run

The first probe reported 2 tool failures and no evidence boundary anywhere. Both
were **probe defects, not product defects**: arguments had been guessed rather
than read from each tool's advertised `inputSchema`, and `EVIDENCE_BOUNDARY` is
an object while the check tested for a string. Once arguments were derived from
the protocol itself, the results above followed. Recorded because the failure
mode — a probe that misreports its subject — is worth knowing about.

---

## A2A — local-only, **not** third-party validated

No independent A2A client was installable from the local npm cache
(`@a2a-js/sdk`, `a2a-js`, `@artifacts/a2a`, `a2a-protocol`, `@google-a2a/sdk`,
`@a2aproject/a2a-js` — all missed), and obtaining one needs network
authorization. Rather than present a self-written caller as third-party
validation, this is labelled local-only.

| | |
| --- | --- |
| Caller | purpose-built; imports **nothing** from Maha; builds requests from the published agent card |
| Transport | HTTP/1.1 over 127.0.0.1 loopback, real JSON serialization |
| Egress | loopback only; no credential read; 0 provider calls |

Reproduce with `npm run interop:a2a`.

### Finding 1 — the agent card was not sufficient to call the agent

A caller with only the card **could not construct an accepted task**.

`handleA2ATask` requires `taskId`, `policy.tokenBudget` and `request`. The card
published none of them: `skills[0]` carried only `id, name, description, tags,
inputModes, outputModes`, and no schema at card level either. The natural
readings — `id` rather than `taskId`, a nested `input.payload` rather than
`request`, an assumed default budget — are all rejected.

Demonstrated both ways: the card-derived task was rejected
(`invalid_task: taskId is required`) while the same handler accepted the
undocumented shape and returned `completed`. The defect was in the contract's
discoverability, not the handler.

MCP has no equivalent gap because the protocol obliges each tool to publish an
`inputSchema`, and reading those is what made the MCP probe work.

**Fixed** — the card now publishes `A2A_TASK_INPUT_SCHEMA`. A caller building
strictly from the card is now accepted, and `test/a2a-card-contract.test.ts`
holds the card and the handler together: it drops each required field in turn
and requires rejection, so a field the card calls required but the handler
ignores fails the suite.

### Finding 2 — a task addressed to another skill was answered anyway

Found only because finding 1 was fixed and the probe got far enough to try it.

`handleA2ATask` never read `skillId`. A task addressed to
`maha.context-control.__nope` was **accepted and completed**, and the response
still declared `capability: maha.context-control.evaluate`. With one advertised
skill the practical effect is nil; the day a second is added, callers aimed at it
would silently receive this one's results.

**Fixed** — a `skillId` that names another capability is rejected as
`unknown_skill`. Omitting it is still allowed, so the check filters rather than
bans.

### Verified in the same run

| Property | Result |
| --- | --- |
| Agent card discovery at `/.well-known/agent-card.json` | 200, protocol 0.2, `payments: false` |
| Task built strictly from the published schema | `completed` |
| Replay of the same `taskId` | `completed`, `replayed: true` — not re-run |
| Task naming an unknown skill | `rejected` |
| Malformed task | `rejected` |
| Source text echoed in any response | none |

---

## Claims this evidence supports

- Maha's five MCP tool schemas and its dispatcher are consumable by the official
  MCP client over stdio, and every response declares its evidence boundary.
- Maha's A2A agent card is now sufficient for an independent caller to construct
  an accepted task, verified by a caller that imports no Maha code.
- Neither surface accepted a credential, called a provider, or echoed source text.

## Claims it does **not** support

- That Maha ships an MCP server or an A2A endpoint a client can connect to. It
  ships neither; both harnesses supply the transport.
- That A2A has been validated against an independent implementation. It has not.
- That `compile_sanitized` works end to end. It fail-closed on absent
  configuration and was never exercised against a configured compiler.
- Anything about performance, concurrency, or behaviour under load.
