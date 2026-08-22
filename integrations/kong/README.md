# Kong adapter

A Kong plugin that runs in the **access phase**, before Kong proxies upstream.

## Files

| File | Purpose |
| --- | --- |
| `maha-context-compiler.lua` | The handler. Calls the compiler, rewrites the body, attaches evidence. |
| `schema.lua` | Declarative schema. **No secret field** — a secret in a declarative config is a secret in version control. |
| `kong.declarative.yaml` | Local verification config. Upstream is a `.invalid` host that cannot resolve. |
| `docker-compose.yaml` | Local verification path. |

## Install

```bash
cp -r integrations/kong /usr/local/share/lua/5.1/kong/plugins/maha-context-compiler
# handler.lua and schema.lua must sit in that directory
export KONG_PLUGINS=bundled,maha-context-compiler
```

## Local verification

```bash
export MAHA_CONTEXT_INTERCEPTOR_SECRET=<32+ characters>
cd integrations/kong && docker compose up
```

The upstream is deliberately unresolvable. This proves the plugin loads, reads
its secret from the environment, calls the compiler and **fails closed** — not
that a provider call succeeds. A real upstream is a deployment decision.

## Behaviour

Missing or short secret → 503. Body over the cap → 413, never truncated.
Compiler unavailable or slow → 503. Non-200 from the compiler → that status,
with the compiler's own code. `x-maha-compiled: true` inbound → forwarded
untouched. No `maha_context` → forwarded untouched.

`kong.response.exit` is terminal on every error path. There is no
passthrough-on-error branch, because forwarding an uncompiled prompt to a paid
provider and reporting success is the failure worth designing against.
