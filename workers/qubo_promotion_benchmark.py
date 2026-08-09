"""Latency-and-quality promotion benchmark for the standalone QUBO reference engine.

The 2026-08-05 baseline gated on warm p95 alone. That gate cannot distinguish a
solver that got faster from one that got faster by searching less, and the
vectorized candidate changed exactly the code that decides how much searching
happens. Re-running a latency-only benchmark would therefore answer the wrong
question: it could promote an engine that returns worse assignments quickly.

So every case here carries a quality measurement alongside the timing, against
two independent references:

  * Exact enumeration, for sizes small enough to enumerate. This yields a true
    optimality gap rather than a comparison against another heuristic.
  * The bounded-bond tensor-network engine, which is already promoted on this
    hardware. This answers the differentiation question directly: an engine
    that is slower and never finds a better assignment than the one already
    shipping has no product reason to exist, however well it scores in
    isolation.

Objectives are minimized, so lower is better and a positive gap is worse than
the reference. Every returned objective is independently recomputed from the
assignment before it is trusted, which is what makes a quality number evidence
rather than a solver's self-report.
"""

from __future__ import annotations

from statistics import median
from time import perf_counter
from typing import Any, Dict, List, Sequence

from workers.qubo_reference import (
    QuboReferenceError,
    normalize_terms,
    objective_value,
    solve_exact,
    solve_torch,
    _benchmark_problem,
)
from workers.tensor_network import solve_transfer_torch

SCHEMA = "maha.qubo-promotion-benchmark.v2"

#: Sizes at or below this are enumerated exactly, giving a true optimality gap.
#: 20 variables is about a million evaluations -- affordable once per case, and
#: far cheaper than the alternative of having no ground truth at all.
EXACT_LIMIT = 20

#: Small sizes establish solution quality against ground truth; large sizes
#: establish latency and head-to-head quality where no ground truth exists.
DEFAULT_SIZES = (16, 20, 64, 128, 256)


def _relative_gap(candidate: float, reference: float) -> float:
    """Signed gap, normalized so cases of different magnitudes can be compared.

    Positive means the candidate is worse than the reference. The denominator
    is floored at 1.0 because these objectives pass through zero, and dividing
    by a near-zero reference would manufacture enormous gaps out of rounding.
    """

    return (candidate - reference) / max(1.0, abs(reference))


def _percentile_95(ordered: Sequence[float]) -> float:
    index = max(0, min(len(ordered) - 1, int(len(ordered) * 0.95 + 0.999999) - 1))
    return ordered[index]


def _verified_objective(problem: Dict[str, Any], result: Dict[str, Any]) -> tuple[float, bool]:
    """Recompute the objective from the assignment rather than trusting the solver."""

    assignment = result["solution"]["assignment"]
    recomputed = objective_value("qubo", normalize_terms(problem)[2], assignment)
    reported = float(result["solution"]["objectiveValue"])
    agrees = abs(recomputed - reported) <= 1e-6 * max(1.0, abs(recomputed))
    return recomputed, agrees


def benchmark_promotion(
    device: str,
    sizes: Sequence[int] = DEFAULT_SIZES,
    repeats: int = 7,
    sweeps: int = 64,
    replicas: int = 64,
    bond_dimension: int = 256,
) -> Dict[str, Any]:
    """Measure warm latency and solution quality for the reference engine.

    Container startup is excluded and reported separately by the caller. The
    unreported warm-up run removes CUDA initialization from the latency
    distribution without disguising cold start.
    """

    import torch

    if not device.startswith("cuda") or not torch.cuda.is_available():
        raise RuntimeError("promotion benchmarks must run on a CUDA device")
    if repeats < 5:
        raise QuboReferenceError("benchmark repeats must be at least 5")

    def synchronize() -> None:
        torch.cuda.synchronize(device)

    cases: List[Dict[str, Any]] = []
    for case_index, size in enumerate(sizes):
        size = int(size)
        problem = _benchmark_problem(size, 17_171 + case_index)
        options = {
            "seed": 91_001 + case_index,
            "maxSweeps": sweeps,
            "replicas": replicas,
            # Forced above the enumeration limit so the annealer is always the
            # thing under test. Without this the small cases would silently
            # measure exact enumeration and report a perfect zero gap.
            "exactThreshold": 0,
        }

        solve_torch(problem, options, device)
        synchronize()

        durations: List[float] = []
        runs: List[Dict[str, Any]] = []
        for repeat in range(repeats):
            run_options = {**options, "seed": options["seed"] + repeat}
            synchronize()
            started = perf_counter()
            result = solve_torch(problem, run_options, device)
            synchronize()
            duration_ms = (perf_counter() - started) * 1_000

            objective, agrees = _verified_objective(problem, result)
            durations.append(duration_ms)
            runs.append({
                "repeat": repeat,
                "latencyMs": round(duration_ms, 3),
                "objectiveValue": objective,
                "objectiveVerified": agrees,
                "provenOptimal": bool(result["solution"]["provenOptimal"]),
            })

        # The engine is seeded per repeat, so quality is a distribution rather
        # than a number. Both ends are reported: the best is what a caller who
        # retries would see, the worst is what a caller who does not will.
        objectives = [run["objectiveValue"] for run in runs]
        best_objective = min(objectives)
        worst_objective = max(objectives)

        exact: Dict[str, Any] | None = None
        if size <= EXACT_LIMIT:
            exact_result = solve_exact(problem, maximum_variables=EXACT_LIMIT)
            exact_objective = float(exact_result["solution"]["objectiveValue"])
            exact = {
                "objectiveValue": exact_objective,
                "bestGap": _relative_gap(best_objective, exact_objective),
                "worstGap": _relative_gap(worst_objective, exact_objective),
                "bestIsOptimal": abs(best_objective - exact_objective) <= 1e-9 * max(1.0, abs(exact_objective)),
            }

        synchronize()
        tensor_started = perf_counter()
        tensor_result = solve_transfer_torch(
            problem, {"bondDimension": bond_dimension, "exactThreshold": 0}, device
        )
        synchronize()
        tensor_latency_ms = (perf_counter() - tensor_started) * 1_000
        tensor_objective, tensor_agrees = _verified_objective(problem, tensor_result)

        ordered = sorted(durations)
        reference_p95 = _percentile_95(ordered)
        cases.append({
            "size": size,
            "termCount": len(problem["terms"]),
            "repeats": repeats,
            "algorithm": "parallel-update-simulated-annealing-torch-v1",
            "sweeps": sweeps,
            "replicas": replicas,
            "latencyP50Ms": round(median(ordered), 3),
            "latencyP95Ms": round(reference_p95, 3),
            "bestObjective": best_objective,
            "worstObjective": worst_objective,
            "exact": exact,
            "tensorNetwork": {
                "bondDimension": bond_dimension,
                "objectiveValue": tensor_objective,
                "objectiveVerified": tensor_agrees,
                "latencyMs": round(tensor_latency_ms, 3),
                # Positive means the reference engine did worse than the engine
                # already in production at this case.
                "bestGap": _relative_gap(best_objective, tensor_objective),
                "referenceWins": best_objective < tensor_objective - 1e-9,
                "referenceTies": abs(best_objective - tensor_objective) <= 1e-9 * max(1.0, abs(tensor_objective)),
                "referenceFaster": reference_p95 < tensor_latency_ms,
            },
            "runs": runs,
        })

    properties = torch.cuda.get_device_properties(device)
    return {
        "schema": SCHEMA,
        "backend": "cuda",
        "device": torch.cuda.get_device_name(device),
        "deviceTotalMemoryBytes": int(properties.total_memory),
        "torchVersion": str(torch.__version__),
        "cudaVersion": torch.version.cuda,
        "exactLimit": EXACT_LIMIT,
        "cases": cases,
    }
