"""Fail-closed promotion gate for the restored production GPU engines."""

from __future__ import annotations

from typing import Any, Dict


class RestoredPromotionError(ValueError):
    pass


def validate_restored_evidence(evidence: Dict[str, Any], tensor_p95_ms: float = 150.0, geometric_p95_ms: float = 200.0) -> None:
    if evidence.get("schema") != "maha.restored-engines-benchmark.v1":
        raise RestoredPromotionError("unexpected evidence schema")
    if not isinstance(evidence.get("commit"), str) or not evidence["commit"]:
        raise RestoredPromotionError("evidence must identify the tested revision")

    tensor = evidence.get("tensorNetwork")
    geometric = evidence.get("geometricRegistration")
    for name, engine in (("tensor", tensor), ("geometric", geometric)):
        if not isinstance(engine, dict) or engine.get("backend") != "cuda" or "A10G" not in str(engine.get("device")):
            raise RestoredPromotionError(f"{name} evidence must come from CUDA on an A10G")
        if not isinstance(engine.get("cases"), list) or not engine["cases"]:
            raise RestoredPromotionError(f"{name} evidence has no benchmark cases")

    tensor_sizes = {case.get("size") for case in tensor["cases"]}
    if tensor_sizes != {64, 128, 256}:
        raise RestoredPromotionError("tensor evidence must cover 64, 128, and 256 variables")
    for case in tensor["cases"]:
        if case.get("repeats", 0) < 7 or case.get("bondDimension") != 256:
            raise RestoredPromotionError("tensor cases must use seven repeats and bond dimension 256")
        if case.get("latencyP95Ms", float("inf")) > tensor_p95_ms:
            raise RestoredPromotionError("tensor p95 exceeds the reviewed threshold")
        if not all(run.get("objectiveVerified") is True and run.get("provenOptimal") is False for run in case.get("runs", [])):
            raise RestoredPromotionError("tensor results are unverified or overclaim optimality")

    point_counts = {case.get("pointCount") for case in geometric["cases"]}
    if point_counts != {256, 4096, 16384}:
        raise RestoredPromotionError("geometric evidence must cover 256, 4096, and 16384 points")
    for case in geometric["cases"]:
        if case.get("repeats", 0) < 7:
            raise RestoredPromotionError("geometric cases must use at least seven repeats")
        if case.get("latencyP95Ms", float("inf")) > geometric_p95_ms:
            raise RestoredPromotionError("geometric p95 exceeds the reviewed threshold")
        if not all(run.get("transformVerified") is True for run in case.get("runs", [])):
            raise RestoredPromotionError("geometric transform verification failed")
