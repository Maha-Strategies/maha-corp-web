"""Explicit, content-only artifact commitments."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Literal

DEFAULT_MAX_ARTIFACT_BYTES = 64 * 1024 * 1024


@dataclass(frozen=True)
class ArtifactSpec:
    name: str
    path: str | Path
    role: Literal["input", "output", "code"]
    media_type: str = "application/octet-stream"
    max_bytes: int = DEFAULT_MAX_ARTIFACT_BYTES


def commit_artifact(spec: ArtifactSpec) -> dict[str, object]:
    if not spec.name.strip() or "/" in spec.name or "\\" in spec.name:
        raise ValueError("Artifact name must be a non-empty logical name, not a path.")
    path = Path(spec.path)
    if path.is_symlink():
        raise ValueError(f"Refusing to hash symlink artifact: {spec.name}")
    if not path.is_file():
        raise ValueError(f"Artifact is not a regular file: {spec.name}")
    size = path.stat().st_size
    if size > spec.max_bytes:
        raise ValueError(f"Artifact exceeds declared byte limit: {spec.name}")
    hasher = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    # Deliberately omit the host path. Receipts expose logical identity and
    # content, not workstation directory structure.
    return {
        "name": spec.name,
        "role": spec.role,
        "mediaType": spec.media_type,
        "bytes": size,
        "sha256": f"sha256:{hasher.hexdigest()}",
    }
