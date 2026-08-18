# Maha orchestration deployment package

This package deploys the governed workflow control plane in either Maha-hosted
multi-tenant mode or a customer-owned private environment. Both modes expose
the operator console, orchestration task API and exact-bound approval API. They
do not gain authority to dispatch tools, sign payments or retry actions.

## Hosted mode

Set `ORCHESTRATION_DEPLOYMENT_MODE=hosted` and provide
`ORCHESTRATION_TENANT_TOKENS` as a JSON array of tenant/token pairs. The server
hashes each token at runtime; API responses and readiness output never return
the token. A valid bearer resolves its tenant server-side. A mismatching
`X-Maha-Tenant-Id` is refused rather than switching tenancy.

The static token registry is bounded to 500 tenants and is intended for paid
pilots and early managed deployments. It is not SSO, SCIM, delegated RBAC or a
substitute for an enterprise identity provider.

## Private mode

Copy `.env.private.example` to `.env.private`, replace every placeholder, then:

```bash
npm run verify:orchestration-deployment
docker compose -f deploy/orchestration/compose.yaml up --build
```

Build the image on a worker with at least 8 GiB of memory. A 4 GiB Docker VM is
insufficient for this repository's Next.js production compilation; the build
is intentionally bounded to two static-generation workers in standalone mode,
but it is not made less safe or less complete to fit a development VM.

Private mode binds the installation to `ORCHESTRATION_PRIVATE_TENANT_ID` and
withholds every unrelated Maha page and API at the request boundary. `/`
redirects to `/admin/orchestration`. Put a TLS reverse proxy, authenticated VPN
or identity-aware proxy in front of the service; do not expose the Node server
directly to the public internet.

For Kubernetes, create `maha-orchestration-secrets` with the customer's secret
manager, pin the image by digest, review the egress policy, then apply
`kubernetes.yaml`. `secret.example.yaml` is a shape reference only and must not
be applied with placeholder values.

## Storage and retention

This release supports the Redis REST protocol consumed by `@upstash/redis`.
Private deployment means the application and keyspace are customer-controlled;
it does not imply compatibility with a raw Redis TCP endpoint, AWS MemoryDB or
PostgreSQL. Use a customer-owned compatible endpoint or approve the external
processor explicitly.

`ORCHESTRATION_RETENTION_DAYS` accepts 1–365 days and controls task state,
event indexes and recovery claims. Approval expiry remains action-specific and
shorter. All retained records are metadata and digests; task inputs and outputs
are not retained by this control plane.

## Production checklist

1. Generate distinct 32-byte-or-longer operator and Redis credentials.
2. Set a unique `MAHA_REDIS_NAMESPACE` for every environment.
3. Run `npm run verify:orchestration-deployment`; it prints names and verdicts,
   never values.
4. Terminate TLS and enforce request/body/rate limits at a reverse proxy.
5. Restrict ingress to the operator network and egress to DNS plus the storage
   endpoint.
6. For multiple replicas, use one immutable image/build, set a common
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and configure version-skew/cache
   coordination before scaling.
7. Back up and test expiry/recovery behavior against a non-production keyspace.
8. Confirm the authenticated readiness route returns `ready: true` before use.
9. Review the dependency audit, generate an SBOM and scan the final image before
   promotion. The reference build does not claim a vulnerability-free supply
   chain merely because application tests pass.

No mainnet payment, external integration, or production deployment is part of
this package build.
