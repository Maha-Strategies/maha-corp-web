# WSO2 AI Gateway adapter

WSO2 predates the neutral contract and keeps its own transport: the Interceptor
Service v1 envelope, base64 bodies, its own credential header, and percent-based
evidence headers. Its **decision** is the shared core in
`lib/integrations/gateway-context-contract.ts`, so it cannot drift from the
other adapters on the budget, the bypass rule or the hashes.

Nothing about the published WSO2 contract changed. The existing policy bundle,
evaluation corpus, reproduction manifest and live-evidence artifact are all
unmodified, and the interceptor's ten contract tests pass unchanged.

## What is already here

The deployable artifacts live where they always have:

- `content/integrations/wso2-policy-bundle/` — secret-free `LlmProxy` template,
  compatibility manifest with SHA-256 digests, create-only installer,
  confirmation-gated uninstaller.
- `content/integrations/wso2-apis/` — the three evaluation proxy definitions.
- `docs/integrations/wso2-context-interceptor.md` — the full integration notes.

## Install and verify

```bash
npm run validate:wso2-policy-bundle      # bundle shape and digests, deploys nothing
npm run verify:gateway-adapters          # contract + all four adapters, no credentials
```

Against a reviewed gateway checkout:

```bash
npm run test:wso2-failure-paths -- --wso2-source=/path/to/wso2-gateway-controllers
```

## Endpoints

| Phase | Path |
| --- | --- |
| Request | `POST /api/integrations/wso2/context-compiler/handle-request` |
| Response | `POST /api/integrations/wso2/context-compiler/handle-response` |

Configure the Interceptor Service policy base URL as
`https://<host>/api/integrations/wso2/context-compiler`; the policy appends the
phase itself.

## Credential

`WSO2_CONTEXT_INTERCEPTOR_SECRET`, or the neutral
`MAHA_CONTEXT_INTERCEPTOR_SECRET`. Both are read from the environment; the
gateway inserts the header and the interceptor strips it before the request
continues upstream.

**This remains an evaluation credential.** WSO2's Interceptor Service policy has
no separate call-authentication parameter, so the secret travels in a header the
Set Headers policy inserts, and WSO2's own documentation warns that headers may
be logged or forwarded. Production promotion needs a non-logged secret
reference, an authenticated service identity, mTLS, or an equivalent reviewed
mechanism. That is a WSO2-side prerequisite, not something this adapter can
close.
