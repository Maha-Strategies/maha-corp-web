#!/usr/bin/env python3
"""Verify, but never generate, QUBO production-promotion evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from workers.qubo_promotion import validate_promotion_evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--maximum-p95-ms", type=float, required=True)
    arguments = parser.parse_args()
    evidence = json.loads(arguments.evidence.read_text(encoding="utf-8"))
    failures = validate_promotion_evidence(evidence, arguments.maximum_p95_ms)
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
