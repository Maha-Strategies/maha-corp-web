# @mahastrategies/context-control-core

The gateway-neutral half of Maha's context-control middleware contract.

**This package is not a compiler.** It gives you the envelope rules, the header
construction, the fail-closed error model and the boundaries; you supply the
compile step. Nothing here pulls the Context Compiler or any Maha application
dependency into your tree, and the published tarball is asserted to contain
neither.

## Install

```sh
npm install @mahastrategies/context-control-core
```

## Use

```ts
import { gateContextRequest, evidenceHeaders } from '@mahastrategies/context-control-core'

const gated = gateContextRequest({
  body: llmRequestBody,
  bodyBytes: Buffer.byteLength(raw, 'utf8'),
  suppliedSecret: request.headers.get('x-maha-interceptor-token'),
  configuredSecret: process.env.MAHA_CONTEXT_INTERCEPTOR_SECRET,
  contentType: request.headers.get('content-type'),
  alreadyCompiled: request.headers.get('x-maha-compiled') === 'true',
})

if (gated.outcome === 'rejected') return refuse(gated.status, gated.code)
if (gated.outcome === 'passthrough') return forwardUnchanged()
// gated.outcome === 'proceed' — compile gated.body, then:
return forward(rewrittenBody, evidenceHeaders(evidence))
```

## What it enforces

Configuration → credential → payload size → JSON → idempotence → opt-in →
media type → shape. In that order, so a caller cannot learn whether a secret is
correct by sending a large body, and an unconfigured deployment never reports a
credential problem it has not checked.

Every outcome except `proceed` and `passthrough` is a refusal. There is no
pass-through-on-error path.

## Idempotence

A request carrying `x-maha-compiled: true` is passed through. Compiling twice
rewrites an already-rewritten prompt and produces evidence describing the wrong
input.

## Boundaries

Defaults: 512,000-byte payload cap, 3,000 ms timeout, 1,024-token minimum
compile size, 32-character minimum secret. All overridable through
`gatewayLimitsFrom(env)`.

MIT licensed. Prerelease: `0.1.0`.
