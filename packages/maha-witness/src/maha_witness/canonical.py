"""Canonical JSON compatible with maha-dossier-canonical/1.0."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

CANONICALIZATION_VERSION = "maha-dossier-canonical/1.0"
_DIGEST_FIELDS = frozenset(("provenanceDigest", "dossierDigest"))
_INSTANT = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$"
)


def _utf16_key(value: str) -> bytes:
    """Match JavaScript Array.sort() UTF-16 code-unit ordering."""

    return value.encode("utf-16-be", errors="surrogatepass")


def _instant(value: str) -> str:
    candidate = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(candidate).astimezone(timezone.utc)
    except ValueError:
        return unicodedata.normalize("NFC", value)
    return parsed.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonicalize(value: Any) -> Any:
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = unicodedata.normalize("NFC", value)
        return _instant(normalized) if _INSTANT.fullmatch(normalized) else normalized
    if isinstance(value, int):
        if abs(value) > 9_007_199_254_740_991:
            raise ValueError("Integer exceeds the cross-runtime safe range.")
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Non-finite number cannot be canonicalized.")
        raise ValueError("Floating-point witness values must be declared as decimal strings.")
    if isinstance(value, (list, tuple)):
        return [canonicalize(item) for item in value]
    if isinstance(value, dict):
        output: dict[str, Any] = {}
        if any(not isinstance(key, str) for key in value):
            raise TypeError("Canonical JSON object keys must be strings.")
        for key in sorted(value, key=_utf16_key):
            if key in _DIGEST_FIELDS:
                continue
            output[key] = canonicalize(value[key])
        return output
    raise TypeError(f"Unsupported value of type {type(value).__name__} in canonicalization.")


def canonical_json(value: Any) -> str:
    return json.dumps(
        canonicalize(value), ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )


def digest(value: Any) -> str:
    return f"sha256:{sha256(canonical_json(value).encode('utf-8')).hexdigest()}"
