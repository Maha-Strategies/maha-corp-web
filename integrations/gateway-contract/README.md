# Maha gateway middleware contract v1.0.0

One decision, four gateways. This directory documents the envelope every
adapter speaks; the implementation is `lib/integrations/gateway-context-contract.ts`.

## Request

`POST` the LLM request body, unchanged, plus the `maha_context` extension.

| Header | Required | Meaning |
| --- | --- | --- |
| `x-maha-interceptor-token` | yes | Shared secret, inserted by the gateway. Never accepted from the end user. |
| `content-type` | yes | Must be `application/json`. |
| `x-maha-compiled` | no | `true` when an upstream hop already compiled. Suppresses recompilation. |

```jsonc
{
  "model": "your-model",
  "messages": [
    { "role": "system", "content": "Use only this evidence:\n\n{{MAHA_CONTEXT_PACK}}" },
    { "role": "user", "content": "Identify the rollback trigger." }
  ],
  "maha_context": {
    "clientRequestId": "stable-idempotency-key",
    "task": "Identify the rollback trigger.",
    "tokenBudget": 800,
    "documents": [{ "id": "runbook", "title": "Runbook", "text": "..." }],
    "provenance": "compact",
    "scoring": "bm25",
    "budgetMode": "guaranteed"
  }
}
```

The marker must appear exactly once, in a string-valued `content` field.

## Response

`200` with the rewritten body and evidence headers, `200` with a passthrough
outcome, or a fail-closed error.

| Header | Example | Meaning |
| --- | --- | --- |
| `x-maha-compiled` | `true` | This body was compiled. Forward it to prevent a second compile. |
| `x-maha-input-hash` | `sha256:…` | Commitment over task, budget and per-document digests. |
| `x-maha-output-hash` | `sha256:…` | Commitment over the exact forwarded context. |
| `x-maha-token-budget` | `800` | The declared budget the pack was fitted to. |
| `x-maha-retained-passages` | `26` | Passages in the pack. `0` when bypassed. |
| `x-maha-source-coverage-bps` | `10000` | Source coverage in basis points. Integer, locale-free. |
| `x-maha-policy-version` | `2026-08-16` | The decision version that produced this. |

No header carries source text, prompt content, task text, or any credential.

## Outcomes

| Outcome | Status | When |
| --- | --- | --- |
| `compiled` | 200 | Opted in, compiled, body rewritten. |
| `passthrough` `no_context_extension` | 200 | No `maha_context`. Forward the original unchanged. |
| `passthrough` `already_compiled` | 200 | `x-maha-compiled: true` inbound. Idempotence. |
| `interceptor_not_configured` | 503 | Secret unset or under 32 characters. |
| `invalid_interceptor_credential` | 401 | Missing or wrong secret. |
| `payload_too_large` | 413 | Over the configured cap. Refused, never truncated. |
| `unsupported_media_type` | 415 | Not `application/json`. |
| `invalid_envelope` / `invalid_llm_request` | 400 | Not JSON, or no `messages[]`. |
| `context_compilation_rejected` | 400 | The `maha_context` block is invalid. |
| `invalid_compiler_output` | 502 | The compiler returned an unusable result. |

**Every one of these fails closed.** No path forwards a request to the provider
after an error, and no adapter is configured to pass through on error.

## Check order

Configuration → credential → payload size → JSON → idempotence → opt-in →
media type → shape → compile. A caller must not be able to learn whether a
secret is correct by sending a large body, and an unconfigured deployment must
not report a credential problem it never checked.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `MAHA_CONTEXT_INTERCEPTOR_SECRET` | — | Shared secret. Preferred name. |
| `WSO2_CONTEXT_INTERCEPTOR_SECRET` | — | Accepted for existing WSO2 deployments. |
| `MAHA_GATEWAY_MAX_BODY_BYTES` | `512000` | Payload cap. |
| `MAHA_GATEWAY_TIMEOUT_MS` | `3000` | Adapter's timeout when calling the compiler. |
| `MAHA_GATEWAY_MINIMUM_COMPILE_TOKENS` | `1024` | Below this, forward the original. |

Secrets live in environment variables only. No bundle, config file or artifact
in this repository contains one.
