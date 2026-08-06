#!/usr/bin/env python3
"""Verify private A10G evidence before promoting the restored engines."""

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from workers.restored_promotion import validate_restored_evidence


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence")
    parser.add_argument("--tensor-p95-ms", type=float, default=150.0)
    parser.add_argument("--geometric-p95-ms", type=float, default=200.0)
    arguments = parser.parse_args()
    with open(arguments.evidence, encoding="utf-8") as handle:
        evidence = json.load(handle)
    validate_restored_evidence(evidence, arguments.tensor_p95_ms, arguments.geometric_p95_ms)
    print("Restored-engine promotion evidence passed.")


if __name__ == "__main__":
    main()
