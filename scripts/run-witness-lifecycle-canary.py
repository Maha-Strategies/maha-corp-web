"""Private, scope-guarded lifecycle canary for the computational witness registry."""

from __future__ import annotations

import json
import os
import platform
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from maha_witness import build_receipt


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required.")
    return value


scope = required("WITNESS_CANARY_SCOPE")
if scope not in {"preview", "production"}:
    raise RuntimeError("WITNESS_CANARY_SCOPE must be preview or production.")

base_url = required("TEST_API_URL").rstrip("/")
parsed = urllib.parse.urlparse(base_url)
if parsed.scheme != "https" or not parsed.netloc or parsed.path or parsed.params or parsed.query or parsed.fragment:
    raise RuntimeError("TEST_API_URL must be an origin-only HTTPS URL.")

hostname = parsed.hostname or ""
if scope == "preview":
    if hostname.endswith("mahastrategies.com"):
        raise RuntimeError("Refusing to run a Preview canary against an apex or custom domain.")
elif base_url != "https://www.mahastrategies.com":
    raise RuntimeError("Production witness canary target must be exactly https://www.mahastrategies.com.")

api_key = os.environ.get("WITNESS_CANARY_API_KEY", "").strip()
provision_disposable = os.environ.get("WITNESS_CANARY_PROVISION_DISPOSABLE_KEY", "").strip() == "true"
if scope == "preview" and (not api_key or provision_disposable):
    raise RuntimeError("Preview requires its protected WITNESS_CANARY_API_KEY and cannot provision a Production key.")
if scope == "production" and (api_key or not provision_disposable):
    raise RuntimeError("Production must provision a disposable canary key and cannot accept a shared API key.")
bypass = os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET", "").strip()
run_id = required("GITHUB_RUN_ID")
run_attempt = required("GITHUB_RUN_ATTEMPT")
evidence_path = Path(required("WITNESS_CANARY_EVIDENCE"))


def utc_second() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def request(method: str, path: str, *, body: Mapping[str, Any] | None = None, headers: Mapping[str, str] | None = None, expected: int, authenticate: bool = True) -> Mapping[str, Any]:
    if authenticate and not api_key:
        raise RuntimeError("The lifecycle request requires an active canary API key.")
    merged = {
        "Accept": "application/json",
        **({"Authorization": f"Bearer {api_key}"} if authenticate else {}),
        **({"x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "false"} if bypass else {}),
        **dict(headers or {}),
    }
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        merged["Content-Type"] = "application/json"
    call = urllib.request.Request(f"{base_url}{path}", data=data, headers=merged, method=method)
    try:
        with urllib.request.urlopen(call, timeout=30) as response:
            status, payload = response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read().decode("utf-8")
    if status != expected:
        raise RuntimeError(f"{method} {path} returned HTTP {status}, expected {expected}: {payload[:240]}")
    parsed_payload = json.loads(payload)
    if not isinstance(parsed_payload, dict):
        raise RuntimeError(f"{method} {path} returned non-object JSON.")
    return parsed_payload


if scope == "production":
    generated = request("POST", "/api/v1/keys/generate", body={
        "email": f"production-witness-canary+{run_id}-{run_attempt}@mahastrategies.com",
    }, expected=201, authenticate=False)
    generated_key = generated.get("apiKey")
    if not isinstance(generated_key, str) or not generated_key:
        raise RuntimeError("Disposable Production key provisioning returned no API key.")
    api_key = generated_key

lifecycle_state: dict[str, Any] = {"digest": None, "created": False, "purged": False}


def run_lifecycle() -> dict[str, Any]:
    started_at = utc_second()
    # This bounded computation is the execution being witnessed. Its output is
    # not a scientific claim and is intentionally not persisted as an artifact.
    sum(index * index for index in range(128))
    finished_at = utc_second()
    receipt = build_receipt(
        job_id=f"{scope}-witness-canary-{run_id}-{run_attempt}",
        callable_identity={"module": "scripts.run-witness-lifecycle-canary", "qualname": "bounded_canary_computation"},
        status="succeeded",
        started_at=started_at,
        finished_at=finished_at,
        artifacts=[],
        environment={"pythonImplementation": platform.python_implementation(), "pythonVersion": platform.python_version(), "system": platform.system()},
        configuration={"purpose": f"private-{scope}-registry-lifecycle-canary"},
    )
    digest = str(receipt["receiptSha256"])
    lifecycle_state["digest"] = digest
    encoded_digest = urllib.parse.quote(digest, safe="")
    idempotency_key = f"{scope}-witness-{run_id}-{run_attempt}"

    created = request("POST", "/api/v1/witness/receipts", body=receipt, headers={
        "Idempotency-Key": idempotency_key,
        "X-Maha-Witness-Retention-Consent": "persist-receipt",
        "X-Maha-Witness-Retention-Days": "1",
    }, expected=201)
    if created.get("status") != "created" or created.get("receiptSha256") != digest:
        raise RuntimeError("Receipt creation response did not bind the expected digest.")
    lifecycle_state["created"] = True

    verified = request("POST", "/api/v1/witness/verify", body=receipt, expected=200)
    if verified.get("ok") is not True or verified.get("contentRetained") is not False:
        raise RuntimeError("Verification endpoint did not return the required non-retention contract.")

    read_before = request("GET", f"/api/v1/witness/receipts/{encoded_digest}", expected=200)
    if read_before.get("payloadAvailable") is not True or read_before.get("verification", {}).get("ok") is not True:
        raise RuntimeError("Stored receipt was unavailable or failed server verification before purge.")

    purged = request("DELETE", f"/api/v1/witness/receipts/{encoded_digest}", expected=200)
    if purged.get("payloadPurged") is not True or purged.get("immutableIdentityRetained") is not True:
        raise RuntimeError("Payload purge did not preserve immutable receipt identity.")
    lifecycle_state["purged"] = True

    read_after = request("GET", f"/api/v1/witness/receipts/{encoded_digest}", expected=410)
    if read_after.get("payloadAvailable") is not False or read_after.get("receipt") is not None or read_after.get("immutableIdentityRetained") is not True:
        raise RuntimeError("Post-purge read did not return immutable identity without payload.")

    return {
        "schemaVersion": "maha-witness-lifecycle-canary-evidence/1.0",
        "targetScope": scope,
        "targetHost": parsed.netloc,
        "receiptSha256": digest,
        "created": True,
        "verifiedWithoutPersistence": True,
        "readBeforePurge": True,
        "payloadPurged": True,
        "immutableIdentityRetained": True,
        "postPurgeStatus": 410,
        "scientificValidityCertified": False,
        "independentlyReproduced": False,
    }


try:
    evidence = run_lifecycle()
finally:
    if scope == "production":
        digest = lifecycle_state["digest"]
        if lifecycle_state["created"] and not lifecycle_state["purged"] and isinstance(digest, str):
            request("DELETE", f"/api/v1/witness/receipts/{urllib.parse.quote(digest, safe='')}", expected=200)
        revoked = request("POST", "/api/v1/keys/revoke", expected=200)
        if revoked.get("revoked") is not True:
            raise RuntimeError("Disposable Production canary key was not revoked.")

evidence["disposableCredentialRevoked"] = scope == "production"
evidence_path.parent.mkdir(parents=True, exist_ok=True)
evidence_path.write_text(json.dumps(evidence, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Private {scope.title()} witness lifecycle passed for {digest}.")
