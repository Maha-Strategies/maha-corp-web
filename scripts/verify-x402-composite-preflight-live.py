#!/usr/bin/env python3
"""Verify one paid NSGoods preflight response against Maha's pinned v3 boundary."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
V3_SCRIPT = ROOT / "scripts" / "verify-x402-composite-preflight-v3.py"
spec = importlib.util.spec_from_file_location("preflight_v3", V3_SCRIPT)
v3 = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(v3)

SUBJECT = {"address": "0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28", "chain": "eip155:8453", "role": "payee"}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--response", type=Path, required=True)
    parser.add_argument("--payment", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    offline = v3.run_audit()
    v3.expect(offline["status"] == "passed", "pinned v3 fixture audit no longer passes")
    response = load(args.response)
    payment = load(args.payment)
    manifest = load(args.manifest)
    schema = load(v3.ARCHIVE_ROOT / "preflight_v3.schema.json")
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    v3.validate_schema(validator, response, "live-response")
    signature_counts = v3.verify_signed_fixture(response, "live-response")

    actual_subject = response["request"]["subject"]
    v3.expect(actual_subject["address"].lower() == SUBJECT["address"], "live subject address mismatch")
    v3.expect(actual_subject["chain"] == SUBJECT["chain"], "live subject chain mismatch")
    v3.expect(actual_subject["role"] == SUBJECT["role"], "live subject role mismatch")
    v3.expect(response["components_evaluated"] == 3, "live response did not evaluate all three components")
    trust = next(item for item in response["components"] if item["component"] == "trust")
    v3.expect(trust["verdict"] == "NO_DATA", "trust verdict was not the expected contract-correct NO_DATA")
    v3.expect("insufficient_data" in trust["reason_codes"], "trust response omitted insufficient_data")
    v3.expect("synthetic_condition" not in trust, "live response contains a synthetic fixture marker")

    registry = manifest.get("signer_registry", {}).get(v3.EXPECTED_SIGNER, {})
    services = [item for item in manifest.get("services", []) if item.get("name") == "preflight"]
    v3.expect(registry.get("status") == "active" and "preflight" in registry.get("services", []), "live manifest does not authorize signer")
    v3.expect(len(services) == 1 and services[0].get("signer") == v3.EXPECTED_SIGNER, "live preflight service signer mismatch")
    v3.expect("preflight_v3" in str(services[0].get("schema")), "live manifest does not bind preflight_v3")
    v3.expect("live" in str(services[0].get("status", "")).lower(), "live manifest does not report endpoint availability")

    response_bytes = args.response.read_bytes()
    v3.expect(hashlib.sha256(response_bytes).hexdigest() == payment["responseSha256"], "response digest differs from payment evidence")
    paid = payment["payment"]
    v3.expect(paid["amountBaseUnits"] == "15000" and paid["debitedBaseUnits"] == "15000", "settlement amount mismatch")
    v3.expect(payment["execution"] == {"challengeCount": 1, "signatureCount": 1, "paidHttpStatus": 200}, "execution cardinality mismatch")

    report = {
        "auditKind": "paid-live-implementation-canary",
        "schemaVersion": "preflight_v3",
        "status": "passed",
        "auditedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "provider": "NS Goods",
        "subject": SUBJECT,
        "responseSha256": payment["responseSha256"],
        "manifestSha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
        "settlement": {
            "network": paid["network"], "asset": paid["asset"], "payTo": paid["payTo"],
            "amountBaseUnits": paid["amountBaseUnits"], "amountUsdc": paid["amountUsdc"],
            "buyer": paid["buyer"], "transaction": paid["transaction"],
        },
        "verification": {
            **signature_counts,
            "signerAuthorizationVerified": True,
            "schemaValidated": True,
            "subjectAndRoleMatched": True,
            "componentsEvaluated": 3,
            "trustVerdict": trust["verdict"],
            "trustReasonCodes": trust["reason_codes"],
            "responseDigestMatched": True,
            "exactlyOneChallengeAndSignature": True,
            "exactDebitVerified": True,
            "pinnedOfflineFixtureAuditPassed": True,
        },
        "boundary": {
            "callsPaid": 1, "amountPaidUsdc": "0.015", "privateKeyPreserved": True,
            "assertsFutureStatus": False, "providerFrozenDuringCanary": True,
        },
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
