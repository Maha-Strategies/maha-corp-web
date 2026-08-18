# Maha governed orchestration control plane

## Product boundary

The control plane packages Maha's protocol-neutral governance envelope,
durable multi-agent task state, policy inheritance, exact-bound approvals and
replay-safe recovery behind one operator API and visual console. It can observe
and authorize bounded workflow transitions across A2A and MCP adapters. It
cannot independently execute a tool, create an upstream credential, sign a
payment, or treat an indeterminate action as permission to retry.

## Delivery models

### Maha-hosted control plane

Maha operates the application and durable Redis REST keyspace. Each customer
bearer resolves to one tenant before any caller-supplied tenant attribution is
accepted. Operational retention is configurable from 1–365 days. The initial
commercial shape is a managed subscription or bounded design-partner pilot,
with deployment support and retained-history terms stated separately.

This first hosted identity implementation is a static, environment-managed
registry capped at 500 tenant credentials. Promotion beyond pilots requires an
external identity system, credential rotation/revocation workflow, scoped
operator roles, administrative audit export and service-level monitoring.

### Private enterprise deployment

Maha supplies an immutable container and Kubernetes reference manifest. The
customer operates the application, secrets, ingress and compatible Redis REST
storage. The installation is cryptographically bound to one configured tenant;
the request proxy exposes only the orchestration console and control APIs.
Commercially, this is suited to an annual software licence plus deployment,
integration and support—not a claim that the current package already satisfies
any named regulatory certification.

## Data and security properties

- Tokens never enter the browser bundle; the operator enters one into tab-only
  React state and it is sent only to the same-origin control API.
- Hosted and private modes derive tenant identity from the authenticated token.
- Task, approval and recovery indexes are tenant-scoped and expire.
- Records contain identifiers, state, timestamps, status codes and SHA-256
  evidence bindings, not prompts, arguments, health records or outputs.
- Private mode returns 404 for unrelated Maha pages and APIs and redirects the
  root to the operator console.
- The authenticated readiness route reports only mode, storage kind, retention,
  tenant attribution and configuration verdicts.

## Known limits before a general enterprise release

- Only Upstash-compatible Redis REST storage is implemented.
- Hosted identity is not yet OIDC/SAML, SCIM or role-based access control.
- The container is built from the unified Maha application; the private proxy
  restricts exposure, but a separately traceable control-plane-only source and
  SBOM/release-signing pipeline should precede regulated distribution.
- No automated backup, disaster-recovery exercise or multi-region consistency
  claim is included.
- No dispatch scheduler is included. That omission preserves the current
  authority boundary and should change only with a separate reviewed design.

The deployable files live in `deploy/orchestration/`; the protocol and state
semantics remain documented in `docs/maha-governance-envelope.md`.
