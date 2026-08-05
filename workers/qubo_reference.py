"""Transparent reference solver for sparse QUBO and Ising minimization.

This is intentionally a baseline, not a tensor-network implementation. Small
instances are solved by exhaustive enumeration and can claim optimality. Larger
instances use deterministic, multi-start simulated annealing on a Torch device
and never claim a certified bound or proof of optimality.
"""

from __future__ import annotations

from itertools import product
from math import exp
from random import Random
from statistics import median
from time import perf_counter
from typing import Any, Dict, Iterable, List, Sequence, Tuple

Term = Tuple[int, int, float]


class QuboReferenceError(ValueError):
    """A bounded, customer-safe solver input error."""


def normalize_terms(problem: Dict[str, Any]) -> tuple[str, int, List[Term]]:
    formulation = problem.get("formulation")
    if formulation not in {"qubo", "ising"}:
        raise QuboReferenceError("problem.formulation must be qubo or ising")

    size = problem.get("size")
    if not isinstance(size, int) or isinstance(size, bool) or size < 1:
        raise QuboReferenceError("problem.size must be a positive integer")

    if problem.get("termsUrl"):
        raise QuboReferenceError("remote term files are disabled until signed object ingestion is available")
    raw_terms = problem.get("terms")
    if not isinstance(raw_terms, list) or not raw_terms:
        raise QuboReferenceError("problem.terms must be a non-empty sparse term list")

    terms: List[Term] = []
    for index, raw in enumerate(raw_terms):
        if not isinstance(raw, dict):
            raise QuboReferenceError(f"problem.terms[{index}] must be an object")
        i, j, value = raw.get("i"), raw.get("j"), raw.get("value")
        if not isinstance(i, int) or isinstance(i, bool) or not isinstance(j, int) or isinstance(j, bool):
            raise QuboReferenceError(f"problem.terms[{index}] indices must be integers")
        if i < 0 or j < i or j >= size:
            raise QuboReferenceError(f"problem.terms[{index}] must satisfy 0 <= i <= j < size")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise QuboReferenceError(f"problem.terms[{index}].value must be finite")
        coefficient = float(value)
        if coefficient != coefficient or coefficient in {float("inf"), float("-inf")}:
            raise QuboReferenceError(f"problem.terms[{index}].value must be finite")
        terms.append((i, j, coefficient))
    return formulation, size, terms


def objective_value(formulation: str, terms: Iterable[Term], assignment: Sequence[int]) -> float:
    allowed = {0, 1} if formulation == "qubo" else {-1, 1}
    if formulation not in {"qubo", "ising"} or any(value not in allowed for value in assignment):
        raise QuboReferenceError("assignment does not match the submitted formulation")
    return float(sum(coefficient * assignment[i] * assignment[j] for i, j, coefficient in terms))


def solve_exact(problem: Dict[str, Any], maximum_variables: int = 18) -> Dict[str, Any]:
    formulation, size, terms = normalize_terms(problem)
    if size > maximum_variables:
        raise QuboReferenceError(f"exact enumeration is limited to {maximum_variables} variables")

    domain = (0, 1) if formulation == "qubo" else (-1, 1)
    best_assignment: tuple[int, ...] | None = None
    best_value = float("inf")
    evaluations = 0
    for candidate in product(domain, repeat=size):
        value = objective_value(formulation, terms, candidate)
        evaluations += 1
        if value < best_value:
            best_value, best_assignment = value, candidate

    return {
        "solution": {
            "objectiveValue": best_value,
            "assignment": list(best_assignment or ()),
            "bestBound": best_value,
            "provenOptimal": True,
        },
        "diagnostics": {
            "algorithm": "exhaustive-enumeration",
            "evaluations": evaluations,
            "sweepsCompleted": 0,
            "bondDimensionUsed": None,
            "discardedWeight": None,
        },
    }


def solve_cpu_annealing(problem: Dict[str, Any], solver: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Deterministic CPU oracle for tests and environments without Torch."""

    formulation, size, terms = normalize_terms(problem)
    options = solver or {}
    if size <= int(options.get("exactThreshold", 18)):
        return solve_exact(problem, int(options.get("exactThreshold", 18)))

    seed = int(options.get("seed") or 0)
    sweeps = max(1, min(int(options.get("maxSweeps") or 64), 10_000))
    replicas = max(1, min(int(options.get("replicas") or 16), 256))
    coefficient_scale = max(sum(abs(term[2]) for term in terms) / len(terms), 1e-9)
    initial_temperature = float(options.get("initialTemperature") or coefficient_scale * 4)
    final_temperature = max(float(options.get("finalTemperature") or coefficient_scale * 0.01), 1e-12)
    domain = (0, 1) if formulation == "qubo" else (-1, 1)

    best_value = float("inf")
    best_assignment: List[int] = []
    evaluations = 0
    for replica in range(replicas):
        random = Random(seed + replica * 1_000_003)
        candidate = [domain[random.randrange(2)] for _ in range(size)]
        value = objective_value(formulation, terms, candidate)
        evaluations += 1
        if value < best_value:
            best_value, best_assignment = value, list(candidate)

        for sweep in range(sweeps):
            ratio = sweep / max(sweeps - 1, 1)
            temperature = initial_temperature * (final_temperature / initial_temperature) ** ratio
            order = list(range(size))
            random.shuffle(order)
            for variable in order:
                original = candidate[variable]
                candidate[variable] = 1 - original if formulation == "qubo" else -original
                changed = objective_value(formulation, terms, candidate)
                evaluations += 1
                delta = changed - value
                if delta <= 0 or random.random() < exp(-delta / temperature):
                    value = changed
                    if value < best_value:
                        best_value, best_assignment = value, list(candidate)
                else:
                    candidate[variable] = original

    verified = objective_value(formulation, terms, best_assignment)
    if abs(verified - best_value) > 1e-8:
        raise RuntimeError("reference solver objective verification failed")
    return {
        "solution": {
            "objectiveValue": verified,
            "assignment": best_assignment,
            "bestBound": None,
            "provenOptimal": False,
        },
        "diagnostics": {
            "algorithm": "multi-start-simulated-annealing-cpu",
            "evaluations": evaluations,
            "replicas": replicas,
            "sweepsCompleted": sweeps,
            "bondDimensionUsed": None,
            "discardedWeight": None,
        },
    }


def solve_torch(problem: Dict[str, Any], solver: Dict[str, Any] | None, device: str) -> Dict[str, Any]:
    """Run batched simulated annealing on the requested Torch device."""

    formulation, size, terms = normalize_terms(problem)
    options = solver or {}
    exact_threshold = int(options.get("exactThreshold", 18))
    if size <= exact_threshold:
        return solve_exact(problem, exact_threshold)

    import torch

    seed = int(options.get("seed") or 0)
    sweeps = max(1, min(int(options.get("maxSweeps") or 64), 10_000))
    replicas = max(1, min(int(options.get("replicas") or min(64, max(8, 16_384 // size))), 256))
    generator = torch.Generator(device=device)
    generator.manual_seed(seed)

    if formulation == "qubo":
        states = torch.randint(0, 2, (replicas, size), device=device, generator=generator, dtype=torch.int8)
    else:
        states = torch.randint(0, 2, (replicas, size), device=device, generator=generator, dtype=torch.int8) * 2 - 1

    coefficient_scale = max(sum(abs(term[2]) for term in terms) / len(terms), 1e-9)
    initial_temperature = float(options.get("initialTemperature") or coefficient_scale * 4)
    final_temperature = max(float(options.get("finalTemperature") or coefficient_scale * 0.01), 1e-12)
    adjacency: List[List[Term]] = [[] for _ in range(size)]
    for term in terms:
        adjacency[term[0]].append(term)
        if term[1] != term[0]:
            adjacency[term[1]].append(term)

    def batch_energy() -> Any:
        result = torch.zeros(replicas, device=device, dtype=torch.float64)
        for i, j, coefficient in terms:
            result += coefficient * states[:, i].to(torch.float64) * states[:, j].to(torch.float64)
        return result

    energies = batch_energy()
    best_index = int(torch.argmin(energies).item())
    best_value = float(energies[best_index].item())
    best_assignment = states[best_index].clone()
    accepted_moves = 0

    for sweep in range(sweeps):
        ratio = sweep / max(sweeps - 1, 1)
        temperature = initial_temperature * (final_temperature / initial_temperature) ** ratio
        for variable_tensor in torch.randperm(size, generator=generator, device=device):
            variable = int(variable_tensor.item())
            current = states[:, variable].to(torch.float64)
            delta = torch.zeros(replicas, device=device, dtype=torch.float64)
            for i, j, coefficient in adjacency[variable]:
                if i == j:
                    if formulation == "qubo":
                        delta += coefficient * (1 - 2 * current)
                    continue
                other = j if i == variable else i
                other_state = states[:, other].to(torch.float64)
                if formulation == "qubo":
                    delta += coefficient * (1 - 2 * current) * other_state
                else:
                    delta += -2 * coefficient * current * other_state

            probabilities = torch.exp(torch.clamp(-delta / temperature, max=0))
            accepted = (delta <= 0) | (torch.rand(replicas, device=device, generator=generator) < probabilities)
            if bool(accepted.any()):
                states[accepted, variable] = (1 - states[accepted, variable]) if formulation == "qubo" else -states[accepted, variable]
                energies[accepted] += delta[accepted]
                accepted_moves += int(accepted.sum().item())

        current_index = int(torch.argmin(energies).item())
        current_value = float(energies[current_index].item())
        if current_value < best_value:
            best_value = current_value
            best_assignment = states[current_index].clone()

    assignment = [int(value) for value in best_assignment.cpu().tolist()]
    verified = objective_value(formulation, terms, assignment)
    if abs(verified - best_value) > 1e-6 * max(1.0, abs(verified)):
        raise RuntimeError("GPU solver objective verification failed")
    return {
        "solution": {
            "objectiveValue": verified,
            "assignment": assignment,
            "bestBound": None,
            "provenOptimal": False,
        },
        "diagnostics": {
            "algorithm": "multi-start-simulated-annealing-torch",
            "replicas": replicas,
            "acceptedMoves": accepted_moves,
            "sweepsCompleted": sweeps,
            "bondDimensionUsed": None,
            "discardedWeight": None,
        },
    }


def _benchmark_problem(size: int, seed: int) -> Dict[str, Any]:
    """Build a deterministic sparse QUBO instance without claiming a known optimum."""

    random = Random(seed)
    terms: List[Dict[str, Any]] = []
    for variable in range(size):
        terms.append({"i": variable, "j": variable, "value": random.uniform(-1.0, 1.0)})
        for distance in (1, 3, 7):
            other = variable + distance
            if other < size:
                terms.append({"i": variable, "j": other, "value": random.uniform(-0.5, 0.5)})
    return {"formulation": "qubo", "size": size, "terms": terms}


def benchmark_torch(
    device: str,
    sizes: Sequence[int] = (64, 128, 256),
    repeats: int = 7,
    sweeps: int = 64,
    replicas: int = 64,
) -> Dict[str, Any]:
    """Measure warm solver latency and return machine-verifiable evidence.

    Container startup is deliberately excluded and reported separately by the
    caller. The production gate requires CUDA evidence, multiple repetitions,
    and an independently recomputed objective for every run.
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
        problem = _benchmark_problem(int(size), 17_171 + case_index)
        options = {
            "seed": 91_001 + case_index,
            "maxSweeps": sweeps,
            "replicas": replicas,
            "exactThreshold": 18,
        }

        # One unreported warm-up removes CUDA initialization and kernel loading
        # from the warm-latency distribution without disguising cold start.
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
            assignment = result["solution"]["assignment"]
            verified = objective_value("qubo", normalize_terms(problem)[2], assignment)
            objective = float(result["solution"]["objectiveValue"])
            objective_verified = abs(verified - objective) <= 1e-6 * max(1.0, abs(verified))
            durations.append(duration_ms)
            runs.append({
                "repeat": repeat,
                "latencyMs": round(duration_ms, 3),
                "objectiveValue": objective,
                "objectiveVerified": objective_verified,
                "provenOptimal": bool(result["solution"]["provenOptimal"]),
            })

        ordered = sorted(durations)
        p95_index = max(0, min(len(ordered) - 1, int(len(ordered) * 0.95 + 0.999999) - 1))
        cases.append({
            "size": size,
            "termCount": len(problem["terms"]),
            "repeats": repeats,
            "algorithm": "multi-start-simulated-annealing-torch",
            "sweeps": sweeps,
            "replicas": replicas,
            "latencyP50Ms": round(median(ordered), 3),
            "latencyP95Ms": round(ordered[p95_index], 3),
            "runs": runs,
        })

    properties = torch.cuda.get_device_properties(device)
    return {
        "schema": "maha.qubo-benchmark.v1",
        "backend": "cuda",
        "device": torch.cuda.get_device_name(device),
        "deviceTotalMemoryBytes": int(properties.total_memory),
        "torchVersion": torch.__version__,
        "cudaVersion": torch.version.cuda,
        "cases": cases,
    }
