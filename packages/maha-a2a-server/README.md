# @mahastrategies/maha-a2a-server

An A2A agent card and task endpoint over loopback HTTP, for Maha's
context-control capability.

## Run it

```bash
npx maha-a2a-server --port 8787
curl -s http://127.0.0.1:8787/.well-known/agent-card.json
```

| Route | Purpose |
| --- | --- |
| `GET /.well-known/agent-card.json` | the agent card, including the task input schema |
| `POST /tasks` | submit one task |

The card publishes the task envelope, so a caller never has to guess it.

## Boundaries

- **Loopback by default.** Binding anything else requires
  `--allow-non-loopback`, so a reviewer grepping for that flag finds every
  deliberate exposure.
- **No credentials.** Refused as arguments and refused in a task body, and never
  echoed in the refusal.
- **No outbound calls.** It serves; it does not fetch.
- **No payment.** Forbidden, with no code path.

## Fail-closed behaviour

| Request | Result |
| --- | --- |
| No `policy.tokenBudget` | `rejected` / `policy_required` — never defaulted |
| Unknown `skillId` | `rejected` / `unknown_skill` |
| Any credential field | `credential_rejected`, value not echoed |
| Repeated `taskId` | the original result, `replayed: true` — not re-run |
| Any other route | 404 |

## What this is not

Not a deployed service — you start it, on your own machine. Validation to date
is **local protocol validation, not third-party interoperability**: the client
exercising it is written for this repo, because no independent A2A client was
installable without a network fetch. A caller that avoids importing Maha is
still not a second implementation.

See `docs/integrations/transport-evaluation-guide.md`.
