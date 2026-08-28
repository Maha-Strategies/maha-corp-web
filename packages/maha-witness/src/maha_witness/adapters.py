"""Bounded adapters. They normalize caller-supplied metadata; they run no tools."""

from __future__ import annotations

import re
from typing import Mapping

_DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
_SLURM_FIELDS = {
    "SLURM_ARRAY_JOB_ID": "arrayJobId",
    "SLURM_ARRAY_TASK_ID": "arrayTaskId",
    "SLURM_CLUSTER_NAME": "clusterName",
    "SLURM_CPUS_PER_TASK": "cpusPerTask",
    "SLURM_JOB_ID": "jobId",
    "SLURM_JOB_NAME": "jobName",
    "SLURM_JOB_NUM_NODES": "nodeCount",
    "SLURM_JOB_PARTITION": "partition",
}


def docker_metadata(*, image_digest: str, runtime: str = "docker") -> dict[str, object]:
    if not _DIGEST.fullmatch(image_digest):
        raise ValueError("Docker identity requires an immutable sha256 image digest.")
    return {"adapter": "docker/0.1", "runtime": runtime, "imageDigest": image_digest}


def slurm_metadata(environment: Mapping[str, str]) -> dict[str, object]:
    values = {
        target: str(environment[source])
        for source, target in _SLURM_FIELDS.items()
        if source in environment and str(environment[source]).strip()
    }
    return {"adapter": "slurm/0.1", "fields": values}


def qiskit_metadata(
    *,
    backend_name: str,
    backend_version: str | None = None,
    job_id: str | None = None,
    shots: int | None = None,
    seed_simulator: int | None = None,
    seed_transpiler: int | None = None,
    circuit_sha256: str | None = None,
) -> dict[str, object]:
    if not backend_name.strip():
        raise ValueError("Qiskit backend_name is required.")
    if shots is not None and shots <= 0:
        raise ValueError("Qiskit shots must be positive when supplied.")
    if circuit_sha256 is not None and not _DIGEST.fullmatch(circuit_sha256):
        raise ValueError("circuit_sha256 must be a SHA-256 digest.")
    return {
        "adapter": "qiskit/0.1",
        "backendName": backend_name,
        "backendVersion": backend_version,
        "jobId": job_id,
        "shots": shots,
        "seedSimulator": seed_simulator,
        "seedTranspiler": seed_transpiler,
        "circuitSha256": circuit_sha256,
    }
