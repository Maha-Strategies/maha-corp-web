"""Fail-closed validation for QUBO hardware benchmark evidence."""

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
        if case.get("algorithm") != "multi-start-simulated-annealing-torch":
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
