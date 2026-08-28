"""Offline CLI. Network submission is deliberately not exposed as a command."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .receipt import verify_receipt


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="maha-witness")
    commands = parser.add_subparsers(dest="command", required=True)
    verify = commands.add_parser("verify", help="Verify a receipt entirely offline.")
    verify.add_argument("receipt", type=Path)
    args = parser.parse_args(argv)
    if args.command == "verify":
        try:
            payload = json.loads(args.receipt.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(json.dumps({"ok": False, "findings": ["witness-file-unparseable"], "detail": type(error).__name__}))
            return 2
        valid, findings = verify_receipt(payload)
        print(json.dumps({"ok": valid, "findings": list(findings)}, separators=(",", ":")))
        return 0 if valid else 1
    return 2
