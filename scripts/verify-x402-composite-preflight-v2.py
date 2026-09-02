#!/usr/bin/env python3
"""Verify the frozen NS Goods composite preflight v2 fixtures offline.

The verifier intentionally makes no network calls and performs no payment. It
checks the exact archived bytes, JSON Schema boundary, manifest authorization,
EIP-191 signatures, consumer-side invariants, tamper refusal, and v1 rejection.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any

from eth_account import Account
from eth_account.messages import encode_defunct
from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = ROOT / "fixtures" / "x402-composite-preflight-v2"
FIXTURE_ROOT = ARCHIVE_ROOT / "fixtures"
V1_ROOT = ARCHIVE_ROOT / "superseded-v1"
EXPECTED_SIGNER = "0x57fF0F084Cba33e6761503f90eEF0Da9F159350c"
MANIFEST_URL = "https://x402.nsgoods.org/proof/index.json"
SIGNED_FIXTURES = ("clean-pass.json", "sanctions-match.json", "partial-not-evaluated.json")
REFUSAL_FIXTURES = {
    "invalid-subject.json": (400, "invalid_subject"),
    "signing-unavailable.json": (503, "signing_unavailable"),
}
V1_FIXTURES = (
    "clean-pass.json",
    "sanctions-match.json",
    "partial-not-evaluated.json",
    "invalid-subject.json",
)
SOURCE_SERVICE = {
    "payability": "payable-address",
    "sanctions": "sanctions",
    "trust": "trust",
}
SHA256_LINE = re.compile(r"^([0-9a-f]{64})  (.+)$")
COMBINED_LINE = re.compile(r"^# combined .*: ([0-9a-f]{64})$")


class AuditFailure(ValueError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def recover_signer(payload: Any, signature: str) -> str:
    return Account.recover_message(
        encode_defunct(text=canonical_json(payload)),
        signature=signature,
    )


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AuditFailure(message)


def parse_digest_file(path: Path) -> tuple[list[tuple[str, str]], str]:
    entries: list[tuple[str, str]] = []
    combined = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        if match := SHA256_LINE.match(line):
            entries.append((match.group(2), match.group(1)))
        elif match := COMBINED_LINE.match(line):
            combined = match.group(1)
    expect(bool(entries), "DIGEST contains no file entries")
    expect(bool(combined), "DIGEST omits the combined digest")
    return entries, combined


def verify_archived_digests() -> dict[str, Any]:
    entries, expected_combined = parse_digest_file(FIXTURE_ROOT / "DIGEST")
    concatenated = bytearray()
    verified: dict[str, str] = {}
    for relative, expected in entries:
        path = (FIXTURE_ROOT / relative).resolve()
        expect(path.is_relative_to(ARCHIVE_ROOT.resolve()), f"DIGEST path escapes archive root: {relative}")
        raw = path.read_bytes()
        actual = sha256_bytes(raw)
        expect(actual == expected, f"digest mismatch for {relative}")
        verified[relative] = actual
        concatenated.extend(raw)
    actual_combined = sha256_bytes(bytes(concatenated))
    expect(actual_combined == expected_combined, "combined fixture digest mismatch")
    return {"files": verified, "combined": actual_combined}


def verify_manifest() -> dict[str, Any]:
    manifest = load_json(ARCHIVE_ROOT / "proof-index.json")
    registry = manifest.get("signer_registry", {})
    registry_entry = registry.get(EXPECTED_SIGNER)
    expect(isinstance(registry_entry, dict), "composite signer is absent from signer_registry")
    expect(registry_entry.get("status") == "active", "composite signer is not active")
    expect("preflight" in registry_entry.get("services", []), "registry does not authorize preflight")
    services = [item for item in manifest.get("services", []) if item.get("name") == "preflight"]
    expect(len(services) == 1, "proof manifest must contain exactly one preflight service")
    service = services[0]
    expect(service.get("signer") == EXPECTED_SIGNER, "preflight service signer mismatch")
    expect(service.get("status") == "schema published, endpoint not built", "unexpected endpoint status")
    expect(service.get("schema") == "preflight_v2 (supersedes preflight_v1 at an announced version boundary, 2026-09-01)", "unexpected schema boundary")
    return {
        "manifestSha256": sha256_bytes((ARCHIVE_ROOT / "proof-index.json").read_bytes()),
        "generatedAt": manifest.get("generated_at"),
        "registryStatus": registry_entry.get("status"),
        "authorizedServices": registry_entry.get("services"),
        "endpointStatus": service.get("status"),
    }


def validate_schema(validator: Draft202012Validator, value: Any, label: str) -> None:
    errors = sorted(validator.iter_errors(value), key=lambda item: list(item.absolute_path))
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.absolute_path) or "root"
        raise AuditFailure(f"{label} schema failure at {location}: {first.message}")


def verify_signed_fixture(value: dict[str, Any], label: str) -> dict[str, int]:
    subject = value["request"]["subject"]
    components = value["components"]
    expect([item["component"] for item in components] == ["payability", "sanctions", "trust"], f"{label}: component order mismatch")
    expected_count = sum(item["verdict"] != "not_evaluated" for item in components)
    expect(value["components_evaluated"] == expected_count, f"{label}: components_evaluated mismatch")

    component_signatures = 0
    subject_checks = 0
    for component in components:
        name = component["component"]
        expect(component["subject_echo"] == subject, f"{label}: {name} subject_echo mismatch")
        subject_checks += 1
        expect(component["signer"] == EXPECTED_SIGNER, f"{label}: {name} signer mismatch")
        expect(component["manifest"]["url"] == MANIFEST_URL, f"{label}: {name} manifest URL mismatch")
        expect(component["manifest"]["entry"] == "preflight", f"{label}: {name} manifest entry mismatch")
        expect(component["manifest"]["source_service"] == SOURCE_SERVICE[name], f"{label}: {name} source service mismatch")

        signed_payload = deepcopy(component)
        declared_digest = signed_payload.pop("component_digest")
        signature = signed_payload.pop("component_signature")
        actual_digest = sha256_bytes(canonical_json(signed_payload).encode("utf-8"))
        expect(actual_digest == declared_digest, f"{label}: {name} component digest mismatch")
        expect(recover_signer(signed_payload, signature) == EXPECTED_SIGNER, f"{label}: {name} signature mismatch")
        component_signatures += 1

    expect(value["envelope"]["signer"] == EXPECTED_SIGNER, f"{label}: envelope signer mismatch")
    envelope_payload = deepcopy(value)
    envelope_signature = envelope_payload["envelope"].pop("signature")
    expect(recover_signer(envelope_payload, envelope_signature) == EXPECTED_SIGNER, f"{label}: envelope signature mismatch")
    return {
        "componentSignatures": component_signatures,
        "envelopeSignatures": 1,
        "subjectChecks": subject_checks,
        "countChecks": 1,
    }


def verify_refusal(value: dict[str, Any], label: str, status: int, reason: str) -> None:
    expect(value.get("http_status") == status, f"{label}: HTTP status mismatch")
    expect(value.get("charged") is False, f"{label}: refusal must not be charged")
    expect(reason in value.get("reason_codes", []), f"{label}: refusal reason missing")
    expect("envelope" not in value, f"{label}: refusal must not contain an envelope")
    expect("components" not in value, f"{label}: refusal must not contain components")


def expect_rejected(action, label: str) -> None:
    try:
        action()
    except Exception:
        return
    raise AuditFailure(f"tamper case was accepted: {label}")


def run_tamper_tests(validator: Draft202012Validator, clean: dict[str, Any]) -> dict[str, Any]:
    cases = 0

    mutated = deepcopy(clean)
    mutated["components"][0]["verdict"] = "NOT_PAYABLE"
    expect_rejected(lambda: verify_signed_fixture(mutated, "tampered-verdict"), "signed verdict substitution")
    cases += 1

    mutated = deepcopy(clean)
    mutated["components"][0]["subject_echo"]["address"] = "0x0000000000000000000000000000000000000000"
    expect_rejected(lambda: verify_signed_fixture(mutated, "tampered-subject"), "subject substitution")
    cases += 1

    mutated = deepcopy(clean)
    mutated["components_evaluated"] = 2
    expect_rejected(lambda: verify_signed_fixture(mutated, "tampered-count"), "component count substitution")
    cases += 1

    mutated = deepcopy(clean)
    mutated["unexpected"] = True
    expect_rejected(lambda: validate_schema(validator, mutated, "unknown-field"), "unknown root field")
    cases += 1

    mutated = deepcopy(clean)
    mutated["envelope"]["signer"] = "0x0000000000000000000000000000000000000000"
    expect_rejected(lambda: verify_signed_fixture(mutated, "tampered-envelope"), "envelope signer substitution")
    cases += 1

    refusal_schema_rejections = 0
    refusal_consumer_rejections = 0
    findings: list[str] = []
    for filename, (status, reason) in REFUSAL_FIXTURES.items():
        refusal = load_json(FIXTURE_ROOT / filename)
        refusal["envelope"] = {"signer": EXPECTED_SIGNER, "signature": "0x" + "00" * 65}
        try:
            validate_schema(validator, refusal, f"{filename}-envelope-injection")
        except Exception:
            refusal_schema_rejections += 1
        try:
            verify_refusal(refusal, filename, status, reason)
        except Exception:
            refusal_consumer_rejections += 1
        cases += 1
    if refusal_schema_rejections != len(REFUSAL_FIXTURES):
        findings.append(
            "refusal-schema-allows-unknown-fields: both refusal branches omit "
            "additionalProperties=false and accept an injected envelope"
        )
    expect(
        refusal_consumer_rejections == len(REFUSAL_FIXTURES),
        "consumer refusal checks accepted an injected envelope",
    )
    return {
        "casesAttempted": cases,
        "consumerRejections": cases,
        "refusalEnvelopeInjectionsRejectedBySchema": refusal_schema_rejections,
        "refusalEnvelopeInjectionsRejectedByConsumer": refusal_consumer_rejections,
        "findings": findings,
    }


def run_audit() -> dict[str, Any]:
    digest_result = verify_archived_digests()
    manifest_result = verify_manifest()
    schema = load_json(ARCHIVE_ROOT / "preflight_v2.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())

    totals = {"componentSignatures": 0, "envelopeSignatures": 0, "subjectChecks": 0, "countChecks": 0}
    for filename in SIGNED_FIXTURES:
        value = load_json(FIXTURE_ROOT / filename)
        validate_schema(validator, value, filename)
        result = verify_signed_fixture(value, filename)
        for key in totals:
            totals[key] += result[key]

    for filename, (status, reason) in REFUSAL_FIXTURES.items():
        value = load_json(FIXTURE_ROOT / filename)
        validate_schema(validator, value, filename)
        verify_refusal(value, filename, status, reason)

    rejected_v1 = 0
    for filename in V1_FIXTURES:
        value = load_json(V1_ROOT / "fixtures" / filename)
        if list(validator.iter_errors(value)):
            rejected_v1 += 1
    expect(rejected_v1 == len(V1_FIXTURES), "v2 schema did not reject every archived v1 fixture")

    tamper = run_tamper_tests(validator, load_json(FIXTURE_ROOT / "clean-pass.json"))
    findings = tamper["findings"]
    passed = not findings
    return {
        "auditKind": "fixture-only-offline-consumer-verification",
        "schemaVersion": "preflight_v2",
        "status": "passed" if passed else "blocked",
        "auditedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "provider": "NS Goods",
        "sourceUrls": {
            "contract": "https://x402.nsgoods.org/preflight/schema/preflight_v2.html",
            "schema": "https://x402.nsgoods.org/preflight/schema/preflight_v2.schema.json",
            "fixtureDigest": "https://x402.nsgoods.org/preflight/fixtures/preflight_v2/DIGEST",
            "proofManifest": MANIFEST_URL,
        },
        "authorizedCompositeSigner": EXPECTED_SIGNER,
        "artifacts": {
            "schemaSha256": digest_result["files"]["../preflight_v2.schema.json"],
            "digestFileSha256": sha256_bytes((FIXTURE_ROOT / "DIGEST").read_bytes()),
            "combinedFixtureAndSchemaSha256": digest_result["combined"],
            "proofManifestSha256": manifest_result["manifestSha256"],
            "documentationSha256": sha256_bytes((ARCHIVE_ROOT / "preflight_v2.html").read_bytes()),
            "supersededV1SchemaSha256": sha256_bytes((V1_ROOT / "preflight_v1.schema.json").read_bytes()),
            "supersededV1DigestFileSha256": sha256_bytes((V1_ROOT / "fixtures" / "DIGEST").read_bytes()),
        },
        "verification": {
            "fixtureDigestsVerified": len(digest_result["files"]),
            "signedFixturesVerified": len(SIGNED_FIXTURES),
            "unsignedRefusalFixturesVerified": len(REFUSAL_FIXTURES),
            "componentSignaturesVerified": totals["componentSignatures"],
            "envelopeSignaturesVerified": totals["envelopeSignatures"],
            "signerAuthorizationVerified": True,
            "subjectEqualityChecks": totals["subjectChecks"],
            "componentCountChecks": totals["countChecks"],
            "tamperCasesAttempted": tamper["casesAttempted"],
            "tamperCasesRejectedByConsumer": tamper["consumerRejections"],
            "refusalEnvelopeInjectionsRejectedBySchema": tamper["refusalEnvelopeInjectionsRejectedBySchema"],
            "refusalEnvelopeInjectionsRejectedByConsumer": tamper["refusalEnvelopeInjectionsRejectedByConsumer"],
            "v1FixturesRejectedByV2Schema": rejected_v1,
        },
        "findings": findings,
        "manifest": manifest_result,
        "boundary": {
            "networkCallsMadeByVerifier": 0,
            "paymentsMade": 0,
            "credentialsUsed": False,
            "liveEndpointInvoked": False,
            "providerEndpointStatus": manifest_result["endpointStatus"],
            "partialNotEvaluatedFixtureContainsDeclaredSyntheticCondition": True,
            "assertsCurrentPayabilityOrSanctionsStatus": False,
        },
        "recommendation": {
            "providerMayBuildEndpoint": passed,
            "consumerMayPayOrRelyOnFixturesAsCurrentEvidence": False,
            "nextGate": (
                "review the implemented endpoint against the pinned contract before any paid call"
                if passed
                else "publish a new immutable schema version whose refusal branches declare and enforce all allowed fields with additionalProperties=false, then rerun this audit"
            ),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, help="Write the sanitized audit report to this path")
    args = parser.parse_args()
    report = run_audit()
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
