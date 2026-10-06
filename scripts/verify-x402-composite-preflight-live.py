#!/usr/bin/env python3
"""Verify an NSGoods preflight envelope against Maha's pinned v3 boundary.

Paid-canary mode binds the envelope to locally captured settlement evidence.
Re-issue mode is deliberately narrower: it verifies a provider-supplied signed
envelope offline and never represents that verification as payment evidence.
"""

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

# Bumped with the canary's settlement evidence. A 1.0 file carries only the
# racing one-shot balance delta, which could reject a good asynchronous
# settlement and could not bind a debit to a transaction, so it is refused here
# rather than silently accepted as if it proved the same thing.
PAYMENT_EVIDENCE_SCHEMA = "maha-nsgoods-preflight-live-canary/1.1"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def verify_reissued_envelope(envelope_path: Path) -> dict:
    offline = v3.run_audit()
    v3.expect(offline["status"] == "passed", "pinned v3 fixture audit no longer passes")
    response_bytes = envelope_path.read_bytes()
    response = json.loads(response_bytes)
    schema = load(v3.ARCHIVE_ROOT / "preflight_v3.schema.json")
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    v3.validate_schema(validator, response, "reissued-envelope")
    signature_counts = v3.verify_signed_fixture(response, "reissued-envelope")

    actual_subject = response["request"]["subject"]
    v3.expect(actual_subject["address"].lower() == SUBJECT["address"], "re-issued subject address mismatch")
    v3.expect(actual_subject["chain"] == SUBJECT["chain"], "re-issued subject chain mismatch")
    v3.expect(actual_subject["role"] == SUBJECT["role"], "re-issued subject role mismatch")
    v3.expect(response["request"]["request_id"] == "pf_be2a8c76d0e7dcc7", "re-issued request id mismatch")
    v3.expect(response["components_evaluated"] == 3, "re-issued envelope did not evaluate all three components")
    trust = next(item for item in response["components"] if item["component"] == "trust")
    v3.expect(trust["verdict"] == "NO_DATA", "re-issued trust verdict was not the expected NO_DATA")
    v3.expect("insufficient_data" in trust["reason_codes"], "re-issued trust response omitted insufficient_data")
    v3.expect("synthetic_condition" not in trust, "re-issued envelope contains a synthetic fixture marker")

    request_time = datetime.fromisoformat(response["request"]["request_time"])
    observed = [datetime.fromisoformat(item["observed_at"]) for item in response["components"]]
    v3.expect(all(item.tzinfo is not None for item in [request_time, *observed]), "re-issued timestamps must carry timezones")
    v3.expect(observed == sorted(observed), "re-issued component observations are not sequential")
    v3.expect(all(item <= request_time for item in observed), "re-issued component observation follows request time")
    measured_spread_ms = round((max(observed) - min(observed)).total_seconds() * 1000)
    v3.expect(response["observation"]["mode"] == "sequential-within-one-request", "unexpected observation mode")
    v3.expect(measured_spread_ms == response["observation"]["spread_ms"], "declared observation spread mismatch")

    return {
        "type": "ExternalIntegrationEnvelopeValidation",
        "version": "1",
        "provider": "NSGoods",
        "auditKind": "provider-reissued-signed-envelope-offline-verification",
        "schemaVersion": "preflight_v3",
        "status": "passed",
        "auditedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "subject": SUBJECT,
        "requestId": response["request"]["request_id"],
        "requestTime": response["request"]["request_time"],
        "sourceArtifact": {
            "repositoryPath": "fixtures/x402-composite-preflight-v3/reissues/preflight_v3_reissue_pf_be2a8c76d0e7dcc7.json",
            "sha256": hashlib.sha256(response_bytes).hexdigest(),
            "sizeBytes": len(response_bytes),
        },
        "authorizedCompositeSigner": v3.EXPECTED_SIGNER,
        "verification": {
            **signature_counts,
            "schemaValidated": True,
            "signerAuthorizationVerifiedAgainstPinnedManifest": True,
            "subjectAndRoleMatched": True,
            "componentsEvaluated": response["components_evaluated"],
            "trustVerdict": trust["verdict"],
            "trustReasonCodes": trust["reason_codes"],
            "sequentialObservationSpreadMs": measured_spread_ms,
            "pinnedOfflineFixtureAuditPassed": True,
        },
        "boundary": {
            "networkCallsMadeByVerifier": 0,
            "paymentsMade": 0,
            "credentialsUsed": False,
            "liveEndpointInvoked": False,
            "downloadedArtifactModified": False,
            "providerSuppliedReissue": True,
            "reissueLabelOutsideSignedEnvelope": True,
            "originalPaidResponseBytesAvailable": False,
            "settlementEvidenceIncluded": False,
            "isPaidLiveImplementationCanary": False,
            "assertsOriginalPaidResponseContents": False,
            "assertsCurrentOrFutureStatus": False,
            "note": "This proves that the preserved re-issued envelope conforms to the pinned preflight_v3 schema and that its component and envelope signatures verify under the pinned signer authority. It does not reconstruct the lost original response, prove payment settlement, or constitute a paid live-canary result.",
        },
        "classification": "external-integration-evidence",
        "commercialBoundary": "This is offline interoperability evidence, not a customer engagement, certification, endorsement or authorization to transact.",
    }


def verify_paid_canary(response_path: Path, payment_path: Path, manifest_path: Path) -> dict:
    offline = v3.run_audit()
    v3.expect(offline["status"] == "passed", "pinned v3 fixture audit no longer passes")
    response = load(response_path)
    payment = load(payment_path)
    manifest = load(manifest_path)
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

    response_bytes = response_path.read_bytes()
    v3.expect(hashlib.sha256(response_bytes).hexdigest() == payment["responseSha256"], "response digest differs from payment evidence")
    v3.expect(payment.get("schemaVersion") == PAYMENT_EVIDENCE_SCHEMA, "payment evidence schema version is not the confirmed-settlement one")
    paid = payment["payment"]
    v3.expect(paid["amountBaseUnits"] == "15000" and paid["debitedBaseUnits"] == "15000", "settlement amount mismatch")
    v3.expect(payment["execution"] == {"challengeCount": 1, "signatureCount": 1, "paidHttpStatus": 200}, "execution cardinality mismatch")

    # The settlement is only established when the chain agrees, bound to the
    # transaction the receipt declared. A receipt saying "success", a balance
    # that moved, or a run that simply could not reach a node are each refused:
    # "unconfirmed" and "unknown" are honest states, not passing ones.
    settlement = payment["settlement"]
    v3.expect(settlement["state"] == "confirmed", f"settlement state is {settlement['state']}, not confirmed")
    v3.expect(settlement["evidence"] == "transaction", "settlement was not bound to an on-chain transaction")
    v3.expect(settlement["confirmedOnChain"] is True, "settlement was not confirmed on chain")
    v3.expect(settlement["reason"] == "settlement_confirmed", "settlement reason is not a confirmation")
    v3.expect(settlement["amountBaseUnits"] == "15000", "confirmed transfer amount is not the authorized price")
    v3.expect(settlement["debitedBaseUnits"] == "15000", "reconciled wallet debit is not the authorized price")
    v3.expect(settlement["transaction"] == paid["transaction"], "confirmed transaction differs from the recorded settlement")
    v3.expect(settlement["elapsedMs"] <= settlement["window"]["timeoutMs"], "settlement confirmation exceeded its own window")

    report = {
        "auditKind": "paid-live-implementation-canary",
        "schemaVersion": "preflight_v3",
        "status": "passed",
        "auditedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "provider": "NS Goods",
        "subject": SUBJECT,
        "responseSha256": payment["responseSha256"],
        "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "settlement": {
            "network": paid["network"], "asset": paid["asset"], "payTo": paid["payTo"],
            "amountBaseUnits": paid["amountBaseUnits"], "amountUsdc": paid["amountUsdc"],
            "buyer": paid["buyer"], "transaction": paid["transaction"],
            "onChainConfirmation": {
                "state": settlement["state"],
                "evidence": settlement["evidence"],
                "amountBaseUnits": settlement["amountBaseUnits"],
                "blockNumber": settlement.get("blockNumber"),
                "elapsedMs": settlement["elapsedMs"],
                "windowTimeoutMs": settlement["window"]["timeoutMs"],
            },
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
            "onChainTransferConfirmed": True,
            "settlementBoundToTransaction": True,
            "pinnedOfflineFixtureAuditPassed": True,
        },
        "boundary": {
            "callsPaid": 1, "amountPaidUsdc": "0.015", "privateKeyPreserved": True,
            "assertsFutureStatus": False, "providerFrozenDuringCanary": True,
        },
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--response", type=Path)
    mode.add_argument("--envelope", type=Path)
    parser.add_argument("--payment", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    if args.envelope:
        if args.payment or args.manifest:
            parser.error("--envelope is read-only and cannot be combined with --payment or --manifest")
        report = verify_reissued_envelope(args.envelope)
    else:
        if not args.payment or not args.manifest:
            parser.error("paid-canary mode requires --response, --payment and --manifest")
        report = verify_paid_canary(args.response, args.payment, args.manifest)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
