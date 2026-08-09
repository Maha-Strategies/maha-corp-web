"""Fail-closed validation for QUBO hardware benchmark evidence.

Two validators live here. ``validate_promotion_evidence`` gates the v1
latency-only schema and is retained because the 2026-08-05 baseline was
recorded under it. ``validate_promotion_evidence_v2`` gates the v2 schema,
which adds the quality and differentiation axes -- a latency-only gate cannot
tell a solver that got faster from one that got faster by searching less.
"""

from __future__ import annotations

from typing import Any, Dict, List


def validate_promotion_evidence(
    evidence: Dict[str, Any],
    maximum_p95_ms: float,
    minimum_cases: int = 3,
    minimum_repeats: int = 5,
) -> List[str]:
    failures: List[str] = []
    if evidence.get("schema") != "maha.qubo-benchmark.v1":
        failures.append("unsupported benchmark schema")
    if evidence.get("backend") != "cuda":
        failures.append("benchmark backend must be cuda")
    device = evidence.get("device")
    if not isinstance(device, str) or not device.strip() or device.lower() == "cpu":
        failures.append("a named GPU device is required")
    if not isinstance(evidence.get("commit"), str) or len(evidence["commit"].strip()) < 7:
        failures.append("benchmark evidence must identify the tested commit")
    if not isinstance(evidence.get("generatedAt"), str) or not evidence["generatedAt"].strip():
        failures.append("benchmark evidence must include generatedAt")

    cases = evidence.get("cases")
    if not isinstance(cases, list) or len(cases) < minimum_cases:
        failures.append(f"at least {minimum_cases} benchmark cases are required")
        return failures

    for index, case in enumerate(cases):
        label = f"case[{index}]"
        if not isinstance(case, dict):
            failures.append(f"{label} must be an object")
            continue
        if case.get("algorithm") != "parallel-update-simulated-annealing-torch-v1":
            failures.append(f"{label} used an unapproved algorithm")
        repeats = case.get("repeats")
        if not isinstance(repeats, int) or repeats < minimum_repeats:
            failures.append(f"{label} needs at least {minimum_repeats} repetitions")
        p95 = case.get("latencyP95Ms")
        if not isinstance(p95, (int, float)) or isinstance(p95, bool) or p95 < 0:
            failures.append(f"{label} has invalid p95 latency")
        elif p95 > maximum_p95_ms:
            failures.append(f"{label} p95 {p95}ms exceeds {maximum_p95_ms}ms")
        runs = case.get("runs")
        if not isinstance(runs, list) or not isinstance(repeats, int) or len(runs) != repeats:
            failures.append(f"{label} run count does not match repeats")
            continue
        if any(run.get("objectiveVerified") is not True for run in runs if isinstance(run, dict)):
            failures.append(f"{label} contains an unverified objective")
        if any(run.get("provenOptimal") is not False for run in runs if isinstance(run, dict)):
            failures.append(f"{label} heuristic result claimed optimality")
        if any(not isinstance(run, dict) for run in runs):
            failures.append(f"{label} contains an invalid run")
    return failures


def validate_promotion_evidence_v2(
    evidence: Dict[str, Any],
    sla: Dict[str, Any],
    minimum_cases: int = 3,
    minimum_repeats: int = 5,
) -> List[str]:
    """Gate v2 evidence on latency, solution quality, and differentiation.

    The SLA is passed in rather than defaulted so the thresholds live in a
    reviewed file with its own commit date. A gate whose numbers can be chosen
    while looking at the result is not a gate.
    """

    failures: List[str] = []
    if evidence.get("schema") != "maha.qubo-promotion-benchmark.v2":
        failures.append("unsupported benchmark schema")
    if evidence.get("backend") != "cuda":
        failures.append("benchmark backend must be cuda")
    device = evidence.get("device")
    if not isinstance(device, str) or not device.strip() or device.lower() == "cpu":
        failures.append("a named GPU device is required")
    if not isinstance(evidence.get("commit"), str) or len(evidence.get("commit", "").strip()) < 7:
        failures.append("benchmark evidence must identify the tested commit")
    if not isinstance(evidence.get("generatedAt"), str) or not evidence.get("generatedAt", "").strip():
        failures.append("benchmark evidence must include generatedAt")

    maximum_p95_ms = sla.get("maximumWarmP95Ms")
    maximum_gap = sla.get("maximumWorstOptimalityGap")
    if not isinstance(maximum_p95_ms, (int, float)) or isinstance(maximum_p95_ms, bool):
        failures.append("SLA is missing maximumWarmP95Ms")
    if not isinstance(maximum_gap, (int, float)) or isinstance(maximum_gap, bool):
        failures.append("SLA is missing maximumWorstOptimalityGap")
    if failures:
        return failures

    cases = evidence.get("cases")
    if not isinstance(cases, list) or len(cases) < minimum_cases:
        return failures + [f"at least {minimum_cases} benchmark cases are required"]

    exact_cases = 0
    quality_wins = 0
    speed_wins = 0

    for index, case in enumerate(cases):
        label = f"case[{index}]"
        if not isinstance(case, dict):
            failures.append(f"{label} must be an object")
            continue
        if case.get("algorithm") != "parallel-update-simulated-annealing-torch-v1":
            failures.append(f"{label} used an unapproved algorithm")

        repeats = case.get("repeats")
        if not isinstance(repeats, int) or repeats < minimum_repeats:
            failures.append(f"{label} needs at least {minimum_repeats} repetitions")

        p95 = case.get("latencyP95Ms")
        if not isinstance(p95, (int, float)) or isinstance(p95, bool) or p95 < 0:
            failures.append(f"{label} has invalid p95 latency")
        elif p95 > maximum_p95_ms:
            failures.append(f"{label} p95 {p95}ms exceeds {maximum_p95_ms}ms")

        runs = case.get("runs")
        if not isinstance(runs, list) or not isinstance(repeats, int) or len(runs) != repeats:
            failures.append(f"{label} run count does not match repeats")
            continue
        if any(not isinstance(run, dict) for run in runs):
            failures.append(f"{label} contains an invalid run")
            continue
        if any(run.get("objectiveVerified") is not True for run in runs):
            failures.append(f"{label} contains an unverified objective")
        if any(run.get("provenOptimal") is not False for run in runs):
            failures.append(f"{label} heuristic result claimed optimality")

        # Quality against ground truth, where ground truth exists. The worst
        # gap is used rather than the best: a caller gets one seed, not the
        # best of seven.
        exact = case.get("exact")
        if isinstance(exact, dict):
            exact_cases += 1
            worst_gap = exact.get("worstGap")
            if not isinstance(worst_gap, (int, float)) or isinstance(worst_gap, bool):
                failures.append(f"{label} has an invalid optimality gap")
            elif worst_gap > maximum_gap:
                failures.append(f"{label} worst optimality gap {worst_gap:.4f} exceeds {maximum_gap}")

        tensor = case.get("tensorNetwork")
        if not isinstance(tensor, dict):
            failures.append(f"{label} is missing the tensor-network comparison")
            continue
        if tensor.get("objectiveVerified") is not True:
            failures.append(f"{label} tensor-network comparison objective is unverified")
        if tensor.get("referenceWins") is True or tensor.get("referenceTies") is True:
            quality_wins += 1
        if tensor.get("referenceFaster") is True:
            speed_wins += 1

    if exact_cases == 0:
        failures.append("no case was small enough to establish an optimality gap")

    # The differentiation gate. An engine that is beaten on quality in every
    # case and beaten on latency in every case has no reason to be a separate
    # product, however well it scores against a threshold in isolation.
    if quality_wins == 0 and speed_wins == 0:
        failures.append(
            "engine is undifferentiated: the promoted tensor-network engine was better on quality "
            "in every case and faster in every case"
        )

    return failures
