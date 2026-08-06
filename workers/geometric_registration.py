"""Weighted SE(3) point-cloud registration with independently checked residuals."""

from __future__ import annotations

from math import isfinite, sqrt
from statistics import median
from time import perf_counter
from typing import Any, Dict, List, Sequence


class GeometricRegistrationError(ValueError):
    """A bounded, customer-safe registration input error."""


def normalize_registration(problem: Dict[str, Any]) -> tuple[List[List[float]], List[List[float]], List[float]]:
    source = problem.get("sourcePoints")
    target = problem.get("targetPoints")
    if not isinstance(source, list) or not isinstance(target, list) or len(source) != len(target):
        raise GeometricRegistrationError("sourcePoints and targetPoints must be equal-length arrays")
    if len(source) < 3 or len(source) > 16_384:
        raise GeometricRegistrationError("point clouds must contain 3 to 16384 paired points")

    def points(value: List[Any], field: str) -> List[List[float]]:
        normalized: List[List[float]] = []
        for index, point in enumerate(value):
            if not isinstance(point, list) or len(point) != 3 or any(
                not isinstance(coordinate, (int, float)) or isinstance(coordinate, bool) or not isfinite(float(coordinate))
                for coordinate in point
            ):
                raise GeometricRegistrationError(f"{field}[{index}] must contain three finite coordinates")
            normalized.append([float(coordinate) for coordinate in point])
        return normalized

    weights = problem.get("weights")
    if weights is None:
        normalized_weights = [1.0] * len(source)
    elif not isinstance(weights, list) or len(weights) != len(source) or any(
        not isinstance(weight, (int, float)) or isinstance(weight, bool) or not isfinite(float(weight)) or float(weight) <= 0
        for weight in weights
    ):
        raise GeometricRegistrationError("weights must be positive finite numbers matching the point count")
    else:
        normalized_weights = [float(weight) for weight in weights]
    return points(source, "sourcePoints"), points(target, "targetPoints"), normalized_weights


def solve_kabsch_torch(problem: Dict[str, Any], solver: Dict[str, Any] | None, device: str) -> Dict[str, Any]:
    source, target, weights = normalize_registration(problem)
    allow_reflection = bool((solver or {}).get("allowReflection", False))

    import torch

    dtype = torch.float64
    source_tensor = torch.tensor(source, dtype=dtype, device=device)
    target_tensor = torch.tensor(target, dtype=dtype, device=device)
    weight_tensor = torch.tensor(weights, dtype=dtype, device=device)
    normalized_weights = weight_tensor / weight_tensor.sum()
    source_centroid = (source_tensor * normalized_weights[:, None]).sum(dim=0)
    target_centroid = (target_tensor * normalized_weights[:, None]).sum(dim=0)
    source_centered = source_tensor - source_centroid
    target_centered = target_tensor - target_centroid
    covariance = (source_centered * normalized_weights[:, None]).T @ target_centered
    u, singular_values, vh = torch.linalg.svd(covariance)
    rotation = vh.T @ u.T
    reflection_corrected = False
    if not allow_reflection and float(torch.linalg.det(rotation).item()) < 0:
        vh = vh.clone()
        vh[-1, :] *= -1
        rotation = vh.T @ u.T
        reflection_corrected = True
    translation = target_centroid - rotation @ source_centroid
    transformed = source_tensor @ rotation.T + translation
    residuals = torch.linalg.vector_norm(transformed - target_tensor, dim=1)
    weighted_mse = float((normalized_weights * residuals.square()).sum().item())
    rmse = sqrt(max(weighted_mse, 0.0))
    determinant = float(torch.linalg.det(rotation).item())
    orthogonality = float(torch.linalg.matrix_norm(rotation.T @ rotation - torch.eye(3, dtype=dtype, device=device)).item())
    return {
        "solution": {
            "rotation": [[float(value) for value in row] for row in rotation.cpu().tolist()],
            "translation": [float(value) for value in translation.cpu().tolist()],
            "rmse": rmse,
            "maxError": float(residuals.max().item()),
            "determinant": determinant,
        },
        "diagnostics": {
            "algorithm": "weighted-kabsch-svd-torch-v1",
            "pointCount": len(source),
            "reflectionCorrected": reflection_corrected,
            "orthogonalityResidual": orthogonality,
            "singularValues": [float(value) for value in singular_values.cpu().tolist()],
        },
    }


def benchmark_geometric_registration(device: str, sizes: Sequence[int] = (256, 4096, 16384), repeats: int = 7) -> Dict[str, Any]:
    import torch

    if not device.startswith("cuda") or not torch.cuda.is_available():
        raise RuntimeError("promotion benchmarks must run on a CUDA device")
    if repeats < 5:
        raise GeometricRegistrationError("benchmark repeats must be at least 5")
    generator = torch.Generator(device=device)
    generator.manual_seed(720_019)
    angle = 0.37
    cosine, sine = float(__import__("math").cos(angle)), float(__import__("math").sin(angle))
    expected_rotation = torch.tensor([[cosine, -sine, 0.0], [sine, cosine, 0.0], [0.0, 0.0, 1.0]], dtype=torch.float64, device=device)
    expected_translation = torch.tensor([1.25, -0.75, 2.5], dtype=torch.float64, device=device)
    cases: List[Dict[str, Any]] = []
    for size in sizes:
        source = torch.randn((int(size), 3), dtype=torch.float64, device=device, generator=generator)
        target = source @ expected_rotation.T + expected_translation
        problem = {"sourcePoints": source.cpu().tolist(), "targetPoints": target.cpu().tolist()}
        solve_kabsch_torch(problem, {}, device)
        torch.cuda.synchronize(device)
        durations: List[float] = []
        runs: List[Dict[str, Any]] = []
        for repeat in range(repeats):
            torch.cuda.synchronize(device)
            started = perf_counter()
            result = solve_kabsch_torch(problem, {}, device)
            torch.cuda.synchronize(device)
            duration = (perf_counter() - started) * 1_000
            rotation = torch.tensor(result["solution"]["rotation"], dtype=torch.float64, device=device)
            translation = torch.tensor(result["solution"]["translation"], dtype=torch.float64, device=device)
            rotation_error = float(torch.linalg.matrix_norm(rotation - expected_rotation).item())
            translation_error = float(torch.linalg.vector_norm(translation - expected_translation).item())
            durations.append(duration)
            runs.append({"repeat": repeat, "latencyMs": round(duration, 3), "rmse": result["solution"]["rmse"], "rotationError": rotation_error, "translationError": translation_error, "determinant": result["solution"]["determinant"], "transformVerified": rotation_error <= 1e-9 and translation_error <= 1e-9 and result["solution"]["rmse"] <= 1e-9})
        ordered = sorted(durations)
        p95_index = max(0, min(len(ordered) - 1, int(len(ordered) * 0.95 + 0.999999) - 1))
        cases.append({"pointCount": size, "repeats": repeats, "algorithm": "weighted-kabsch-svd-torch-v1", "latencyP50Ms": round(median(ordered), 3), "latencyP95Ms": round(ordered[p95_index], 3), "runs": runs})
    properties = torch.cuda.get_device_properties(device)
    return {"schema": "maha.geometric-registration-benchmark.v1", "backend": "cuda", "device": torch.cuda.get_device_name(device), "deviceTotalMemoryBytes": int(properties.total_memory), "torchVersion": str(torch.__version__), "cudaVersion": torch.version.cuda, "cases": cases}
