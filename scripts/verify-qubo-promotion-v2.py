#!/usr/bin/env python3
"""Verify, but never generate, v2 QUBO promotion evidence.

Thresholds come from docs/qubo-promotion-sla.json rather than the command
line. That file is committed before the benchmark runs, so git history shows
whether the gate predates the evidence it is judging -- which is the only
thing that makes "we chose the SLA honestly" checkable rather than asserted.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from workers.qubo_promotion import validate_promotion_evidence_v2

DEFAULT_SLA = Path(__file__).resolve().parents[1] / "docs" / "qubo-promotion-sla.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--sla", type=Path, default=DEFAULT_SLA)
    arguments = parser.parse_args()

    sla = json.loads(arguments.sla.read_text(encoding="utf-8"))
    evidence = json.loads(arguments.evidence.read_text(encoding="utf-8"))
    failures = validate_promotion_evidence_v2(evidence, sla)

    print(f"SLA: {arguments.sla} (chosen {sla.get('chosenOn', 'unknown')}, status {sla.get('status', 'unknown')})")
    print(f"  warm p95 <= {sla.get('maximumWarmP95Ms')} ms, worst optimality gap <= {sla.get('maximumWorstOptimalityGap')}")

    if failures:
        print("QUBO promotion gate: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("QUBO promotion gate: PASS")
    print(f"Device: {evidence['device']}")
    print(f"Commit: {evidence['commit']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
