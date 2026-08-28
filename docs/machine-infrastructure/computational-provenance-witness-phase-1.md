# Computational Provenance Witness — Phase 1

Status: private machine infrastructure; no public route, persistence, or
canonical publication.

## Purpose

The witness commits to the execution metadata and explicitly named files around
a scientific workload. A Python workload can emit a receipt, verify it offline,
and bind it to Evidence Dossier claims and deterministic calculation receipts.
The Python and TypeScript verifiers use `maha-dossier-canonical/1.0`, so the same
receipt has the same bytes and SHA-256 identity in both runtimes.

## Trust boundary

The receipt establishes tamper evidence after capture. It does not prove that:

- the submitted metadata was truthful or complete;
- the code or model was scientifically valid;
- the workload ran in a trusted execution environment;
- another party independently reproduced the output;
- the result meets a regulatory, safety, or fitness standard.

Those non-claims are encoded in every receipt. `environmentComplete` defaults to
false; independent reproduction and scientific certification are always false
in this schema version.

## Privacy and security defaults

- No function arguments or arbitrary environment variables are captured.
- File paths and contents do not enter receipts; only explicit logical names,
  byte counts, media types, roles, and SHA-256 digests do.
- Symlinks and files over the caller's declared byte limit fail closed.
- Docker requires an immutable image digest.
- SLURM captures a fixed allowlist and ignores credentials and host paths.
- Qiskit metadata is supplied explicitly; importing Qiskit is not required.
- Registry submission is a separate HTTPS-only call. Receipt creation and
  verification perform no network access.

## Phase map

Phase 1 (this change): local receipts, decorator/context manager, bounded
adapters, offline CLI verification, cross-language dossier attachment.

Phase 2: immutable registry persistence, tenant/RBAC policy, replay and
idempotency controls, retention/deletion policy, and a separately authenticated
submission endpoint.

Phase 3: production SLURM prolog/epilog integration, Docker/OCI attestation
ingestion, Qiskit/Braket job reconciliation, signed identities, and independent
reproduction links. None should promote scientific claims automatically.
