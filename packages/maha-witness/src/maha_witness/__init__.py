"""Maha Computational Provenance Witness.

The package records what ran and commits to explicitly declared artifacts. It
does not certify scientific correctness or independent reproduction.
"""

from .adapters import docker_metadata, qiskit_metadata, slurm_metadata
from .artifacts import ArtifactSpec
from .recorder import WitnessRecorder, witness
from .receipt import build_receipt, canonical_json, verify_receipt
from .registry import submit_receipt

__all__ = [
    "ArtifactSpec",
    "WitnessRecorder",
    "build_receipt",
    "canonical_json",
    "docker_metadata",
    "qiskit_metadata",
    "slurm_metadata",
    "submit_receipt",
    "verify_receipt",
    "witness",
]

__version__ = "0.1.0"
