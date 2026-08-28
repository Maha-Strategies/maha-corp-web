"""Receipt construction and offline verification."""

from __future__ import annotations

import re
from collections.abc import Mapping as RuntimeMapping
from typing import Any, Mapping, Sequence

from .canonical import CANONICALIZATION_VERSION, canonical_json, digest

SCHEMA_VERSION = "maha-computational-witness/0.1"
WITNESS_VERSION = "0.1.0"
_DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
_SECRET_KEY = re.compile(
    r"(^|[_-])(token|secret|password|authorization|credential)(s)?($|[_-])|api[_-]?key|private[_-]?key|access[_-]?token|bearer[_-]?token",
    re.IGNORECASE,
)


def _reject_secret_keys(value: object, path: str) -> None:
    if isinstance(value, Mapping):
        for key, item in value.items():
            normalized = re.sub(r"(?<!^)(?=[A-Z])", "_", str(key))
            if _SECRET_KEY.search(normalized):
                raise ValueError(f"Credential-shaped field is prohibited in witness metadata: {path}.{key}")
            _reject_secret_keys(item, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _reject_secret_keys(item, f"{path}[{index}]")


def _ordered_artifacts(artifacts: Sequence[Mapping[str, object]]) -> list[dict[str, object]]:
    copied = [dict(item) for item in artifacts]
    if any(not _DIGEST.fullmatch(str(item.get("sha256", ""))) for item in copied):
        raise ValueError("Every artifact requires a SHA-256 digest.")
    if len({str(item.get("name", "")) for item in copied}) != len(copied):
        raise ValueError("Artifact logical names must be unique.")
    if any(
        not str(item.get("name", "")).strip()
        or item.get("role") not in ("input", "output", "code")
        or not isinstance(item.get("bytes"), int)
        or int(item["bytes"]) < 0
        for item in copied
    ):
        raise ValueError("Artifact identity, role, and byte count are invalid.")
    return sorted(copied, key=lambda item: str(item["name"]).encode("utf-16-be"))


def build_receipt(
    *,
    job_id: str,
    callable_identity: Mapping[str, str],
    status: str,
    started_at: str,
    finished_at: str,
    artifacts: Sequence[Mapping[str, object]],
    environment: Mapping[str, object],
    random_seeds: Mapping[str, str | int] | None = None,
    configuration: Mapping[str, object] | None = None,
    adapters: Sequence[Mapping[str, object]] = (),
    dossier_id: str | None = None,
    claim_ids: Sequence[str] = (),
    calculation_receipt_ids: Sequence[str] = (),
    environment_complete: bool = False,
    failure_type: str | None = None,
) -> dict[str, Any]:
    if not job_id.strip():
        raise ValueError("job_id is required.")
    if status not in ("succeeded", "failed"):
        raise ValueError("status must be succeeded or failed.")
    if status == "succeeded" and failure_type is not None:
        raise ValueError("A successful execution cannot carry a failure type.")
    if len(set(claim_ids)) != len(claim_ids):
        raise ValueError("Dossier claim ids must be unique.")
    if any(not _DIGEST.fullmatch(item) for item in calculation_receipt_ids):
        raise ValueError("Calculation receipt ids must be SHA-256 digests.")
    for name, value in (
        ("environment", environment),
        ("randomSeeds", random_seeds or {}),
        ("configuration", configuration or {}),
        ("adapters", adapters),
    ):
        _reject_secret_keys(value, name)
    ordered = _ordered_artifacts(artifacts)
    input_artifacts = [item for item in ordered if item.get("role") in ("input", "code")]
    output_artifacts = [item for item in ordered if item.get("role") == "output"]
    snapshot: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "canonicalizationVersion": CANONICALIZATION_VERSION,
        "witnessVersion": WITNESS_VERSION,
        "jobId": job_id,
        "callable": dict(callable_identity),
        "execution": {
            "status": status,
            "startedAt": started_at,
            "finishedAt": finished_at,
            "failureType": failure_type,
        },
        "artifacts": ordered,
        "inputSha256": digest(input_artifacts),
        "outputSha256": digest(output_artifacts),
        "environment": dict(environment),
        "environmentSha256": digest(environment),
        "randomSeeds": dict(random_seeds or {}),
        "configuration": dict(configuration or {}),
        "adapters": [dict(item) for item in adapters],
        "bindings": {
            "dossierId": dossier_id,
            "claimIds": sorted(claim_ids),
            "calculationReceiptIds": sorted(calculation_receipt_ids),
        },
        "assurance": {
            "executionObserved": True,
            "independentlyReproduced": False,
            "scientificValidityCertified": False,
            "environmentComplete": environment_complete,
            "secretsCaptured": False,
        },
    }
    return {**snapshot, "receiptSha256": digest(snapshot)}


def verify_receipt(receipt: Mapping[str, Any]) -> tuple[bool, tuple[str, ...]]:
    if not isinstance(receipt, RuntimeMapping):
        return False, ("witness-unparseable",)
    findings: list[str] = []
    try:
        if receipt.get("schemaVersion") != SCHEMA_VERSION:
            findings.append("witness-schema-invalid")
        if receipt.get("canonicalizationVersion") != CANONICALIZATION_VERSION:
            findings.append("witness-canonicalization-invalid")
        if not isinstance(receipt.get("jobId"), str) or not receipt.get("jobId"):
            findings.append("witness-identity-invalid")
        callable_identity = receipt.get("callable")
        if not isinstance(callable_identity, dict) or not all(
            isinstance(callable_identity.get(key), str) and callable_identity.get(key)
            for key in ("module", "qualname")
        ):
            findings.append("witness-identity-invalid")
        execution = receipt.get("execution")
        if not isinstance(execution, dict) or execution.get("status") not in ("succeeded", "failed"):
            findings.append("witness-execution-invalid")
        artifacts = receipt.get("artifacts")
        if not isinstance(artifacts, list):
            findings.append("witness-artifacts-invalid")
            artifacts = []
        elif len({str(item.get("name", "")) for item in artifacts if isinstance(item, dict)}) != len(artifacts) or any(
            not isinstance(item, dict)
            or item.get("role") not in ("input", "output", "code")
            or not _DIGEST.fullmatch(str(item.get("sha256", "")))
            or not isinstance(item.get("bytes"), int)
            or int(item["bytes"]) < 0
            for item in artifacts
        ):
            findings.append("witness-artifacts-invalid")
        elif artifacts != sorted(artifacts, key=lambda item: str(item["name"]).encode("utf-16-be")):
            findings.append("witness-artifacts-invalid")
        expected_input = digest(
            [item for item in artifacts if isinstance(item, dict) and item.get("role") in ("input", "code")]
        )
        expected_output = digest(
            [item for item in artifacts if isinstance(item, dict) and item.get("role") == "output"]
        )
        if receipt.get("inputSha256") != expected_input:
            findings.append("witness-input-digest-invalid")
        if receipt.get("outputSha256") != expected_output:
            findings.append("witness-output-digest-invalid")
        if receipt.get("environmentSha256") != digest(receipt.get("environment")):
            findings.append("witness-environment-digest-invalid")
        assurance = receipt.get("assurance")
        if not isinstance(assurance, dict) or any(
            assurance.get(key) is not expected
            for key, expected in (
                ("executionObserved", True),
                ("independentlyReproduced", False),
                ("scientificValidityCertified", False),
                ("secretsCaptured", False),
            )
        ):
            findings.append("witness-assurance-invalid")
        supplied = receipt.get("receiptSha256")
        snapshot = {key: value for key, value in receipt.items() if key != "receiptSha256"}
        if supplied != digest(snapshot):
            findings.append("witness-receipt-digest-invalid")
    except (TypeError, ValueError, KeyError):
        findings.append("witness-unparseable")
    unique = tuple(dict.fromkeys(findings))
    return not unique, unique


__all__ = ["build_receipt", "canonical_json", "verify_receipt"]
