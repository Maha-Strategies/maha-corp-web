"""Bounded-bond transfer-tensor heuristic for sparse QUBO and Ising models.

The solver contracts one binary variable at a time.  The exact transfer
frontier doubles at every step; after each contraction it retains the best
``bondDimension`` partial states.  That truncation is the declared heuristic
boundary.  Small instances use exhaustive enumeration and may claim
optimality; truncated runs never do.
"""

from __future__ import annotations

from random import Random
from statistics import median
from time import perf_counter
from typing import Any, Dict, List, Sequence

from workers.qubo_reference import QuboReferenceError, normalize_terms, objective_value, solve_exact


def solve_transfer_cpu(problem: Dict[str, Any], solver: Dict[str, Any] | None = None) -> Dict[str, Any]:
    formulation, size, terms = normalize_terms(problem)
    options = solver or {}
    exact_threshold = int(options.get("exactThreshold", 18))
    bond_dimension = int(options.get("bondDimension", 128))
    if exact_threshold < 0 or exact_threshold > 18:
        raise QuboReferenceError("solver.exactThreshold must be an integer from 0 to 18")
    if bond_dimension < 2 or bond_dimension > 4096:
        raise QuboReferenceError("solver.bondDimension must be an integer from 2 to 4096")
    if size <= exact_threshold:
        return solve_exact(problem, exact_threshold)

    domain = (0, 1) if formulation == "qubo" else (-1, 1)
    states: List[tuple[List[int], float]] = [([], 0.0)]
    peak_frontier = 1
    truncations = 0
    for variable in range(size):
        candidates: List[tuple[List[int], float]] = []
        for assignment, partial_energy in states:
            for value in domain:
                expanded = assignment + [value]
                local = sum(
                    coefficient * expanded[i] * expanded[j]
                    for i, j, coefficient in terms
                    if j == variable
                )
                candidates.append((expanded, partial_energy + local))
        candidates.sort(key=lambda item: (item[1], item[0]))
        peak_frontier = max(peak_frontier, len(candidates))
        if len(candidates) > bond_dimension:
            candidates = candidates[:bond_dimension]
            truncations += 1
        states = candidates

    assignment, _ = min(states, key=lambda item: (item[1], item[0]))
    verified = objective_value(formulation, terms, assignment)
    return {
        "solution": {
            "objectiveValue": verified,
            "assignment": assignment,
            "bestBound": None,
            "provenOptimal": False,
        },
        "diagnostics": {
            "algorithm": "bounded-bond-transfer-contraction-cpu-v1",
            "bondDimension": bond_dimension,
            "peakFrontier": peak_frontier,
            "truncations": truncations,
            "sweepsCompleted": 1,
            "replicas": None,
            "acceptedMoves": None,
        },
    }


def solve_transfer_torch(problem: Dict[str, Any], solver: Dict[str, Any] | None, device: str) -> Dict[str, Any]:
    formulation, size, terms = normalize_terms(problem)
    options = solver or {}
    exact_threshold = int(options.get("exactThreshold", 18))
    bond_dimension = int(options.get("bondDimension", 256))
    if exact_threshold < 0 or exact_threshold > 18:
        raise QuboReferenceError("solver.exactThreshold must be an integer from 0 to 18")
    if bond_dimension < 2 or bond_dimension > 4096:
        raise QuboReferenceError("solver.bondDimension must be an integer from 2 to 4096")
    if size <= exact_threshold:
        return solve_exact(problem, exact_threshold)

    import torch

    dtype = torch.float64
    states = torch.empty((1, 0), dtype=dtype, device=device)
    energies = torch.zeros(1, dtype=dtype, device=device)
    peak_frontier = 1
    truncations = 0
    domain = torch.tensor([0.0, 1.0] if formulation == "qubo" else [-1.0, 1.0], dtype=dtype, device=device)

    terms_by_last: List[List[tuple[int, float]]] = [[] for _ in range(size)]
    for i, j, coefficient in terms:
        terms_by_last[j].append((i, coefficient))

    for variable in range(size):
        frontier = states.shape[0]
        expanded = states.repeat_interleave(2, dim=0)
        values = domain.repeat(frontier).reshape(-1, 1)
        expanded = torch.cat((expanded, values), dim=1)
        candidate_energies = energies.repeat_interleave(2)
        for i, coefficient in terms_by_last[variable]:
            candidate_energies = candidate_energies + coefficient * expanded[:, i] * expanded[:, variable]
        peak_frontier = max(peak_frontier, int(expanded.shape[0]))
        keep = min(bond_dimension, int(expanded.shape[0]))
        if keep < expanded.shape[0]:
            truncations += 1
        selected = torch.topk(candidate_energies, k=keep, largest=False, sorted=True).indices
        states = expanded[selected]
        energies = candidate_energies[selected]

    best = int(torch.argmin(energies).item())
    assignment = [int(value) for value in states[best].cpu().tolist()]
    verified = objective_value(formulation, terms, assignment)
    reported = float(energies[best].item())
    if abs(verified - reported) > 1e-8 * max(1.0, abs(verified)):
        raise RuntimeError("tensor contraction objective verification failed")
    return {
        "solution": {
            "objectiveValue": verified,
            "assignment": assignment,
            "bestBound": None,
            "provenOptimal": False,
        },
        "diagnostics": {
            "algorithm": "bounded-bond-transfer-contraction-torch-v1",
            "bondDimension": bond_dimension,
            "peakFrontier": peak_frontier,
            "truncations": truncations,
            "sweepsCompleted": 1,
            "replicas": None,
            "acceptedMoves": None,
        },
    }


def benchmark_tensor_network(device: str, sizes: Sequence[int] = (64, 128, 256), repeats: int = 7, bond_dimension: int = 256) -> Dict[str, Any]:
    import torch

    if not device.startswith("cuda") or not torch.cuda.is_available():
        raise RuntimeError("promotion benchmarks must run on a CUDA device")
    if repeats < 5:
        raise QuboReferenceError("benchmark repeats must be at least 5")
    cases: List[Dict[str, Any]] = []
    for case_index, size in enumerate(sizes):
        random = Random(810_001 + case_index)
        problem = {"formulation": "qubo", "size": int(size), "terms": []}
        for variable in range(size):
            problem["terms"].append({"i": variable, "j": variable, "value": random.uniform(-1, 1)})
            for distance in (1, 2, 5):
                if variable + distance < size:
                    problem["terms"].append({"i": variable, "j": variable + distance, "value": random.uniform(-0.5, 0.5)})
        options = {"bondDimension": bond_dimension, "exactThreshold": 18}
        solve_transfer_torch(problem, options, device)
        torch.cuda.synchronize(device)
        durations: List[float] = []
        runs: List[Dict[str, Any]] = []
        normalized = normalize_terms(problem)[2]
        for repeat in range(repeats):
            torch.cuda.synchronize(device)
            started = perf_counter()
            result = solve_transfer_torch(problem, options, device)
            torch.cuda.synchronize(device)
            duration = (perf_counter() - started) * 1_000
            assignment = result["solution"]["assignment"]
            verified = objective_value("qubo", normalized, assignment)
            reported = float(result["solution"]["objectiveValue"])
            durations.append(duration)
            runs.append({"repeat": repeat, "latencyMs": round(duration, 3), "objectiveValue": reported, "objectiveVerified": abs(verified - reported) <= 1e-8 * max(1.0, abs(verified)), "provenOptimal": False})
        ordered = sorted(durations)
        p95_index = max(0, min(len(ordered) - 1, int(len(ordered) * 0.95 + 0.999999) - 1))
        cases.append({"size": size, "termCount": len(problem["terms"]), "repeats": repeats, "bondDimension": bond_dimension, "algorithm": "bounded-bond-transfer-contraction-torch-v1", "latencyP50Ms": round(median(ordered), 3), "latencyP95Ms": round(ordered[p95_index], 3), "runs": runs})
    properties = torch.cuda.get_device_properties(device)
    return {"schema": "maha.tensor-network-benchmark.v1", "backend": "cuda", "device": torch.cuda.get_device_name(device), "deviceTotalMemoryBytes": int(properties.total_memory), "torchVersion": str(torch.__version__), "cudaVersion": torch.version.cuda, "cases": cases}
