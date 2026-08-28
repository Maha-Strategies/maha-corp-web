"""Explicit, optional registry transport. Receipt creation never calls it."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any, Callable, Mapping

from .canonical import canonical_json
from .receipt import verify_receipt


def submit_receipt(
    receipt: Mapping[str, Any],
    *,
    registry_url: str,
    bearer_token: str,
    timeout_seconds: float = 15.0,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> Mapping[str, Any]:
    valid, findings = verify_receipt(receipt)
    if not valid:
        raise ValueError(f"Refusing to submit invalid receipt: {','.join(findings)}")
    parsed = urllib.parse.urlparse(registry_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Registry submission requires an absolute HTTPS URL.")
    if not bearer_token.strip():
        raise ValueError("Registry bearer token is required.")
    request = urllib.request.Request(
        registry_url,
        data=canonical_json(receipt).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "maha-witness/0.1.0",
        },
        method="POST",
    )
    with opener(request, timeout=timeout_seconds) as response:
        payload = response.read().decode("utf-8")
    parsed_payload = json.loads(payload)
    if not isinstance(parsed_payload, dict):
        raise ValueError("Registry returned a non-object JSON response.")
    return parsed_payload
