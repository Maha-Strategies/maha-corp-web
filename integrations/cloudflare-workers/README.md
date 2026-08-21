# Cloudflare Workers adapter

A Worker that sits between a client and a model provider: compile, forward,
return the provider response with evidence attached.

## Configure

`wrangler.toml` contains **placeholders only**:

- URLs point at a reserved `.invalid` host that cannot resolve;
- the `routes` block is commented out, so `wrangler deploy` publishes no route;
- the secret is not in the file.

```bash
wrangler secret put MAHA_CONTEXT_INTERCEPTOR_SECRET
```

Then set `MAHA_COMPILER_URL` and `MAHA_PROVIDER_URL` to real values and
uncomment a route only for a deployment you intend.

## Local verification

```bash
cd integrations/cloudflare-workers
wrangler dev
```

With placeholder URLs the compile call fails and the Worker returns
`503 compiler_unavailable`. **That is the expected result** — it proves the
fail-closed path, not a working provider call.

## Behaviour

Missing or short secret → 503. Body over the cap → 413. Compiler timeout or
transport failure → 503, via `AbortSignal.timeout`. Non-200 from the compiler →
that status with the compiler's code. `x-maha-compiled: true` inbound →
forwarded untouched. No `maha_context` → forwarded untouched.

The caller's `authorization` / `x-api-key` is passed through to the provider.
**The interceptor secret is never forwarded.** Nothing from the request body is
logged; the only thing the Worker says about a request is its outcome.
