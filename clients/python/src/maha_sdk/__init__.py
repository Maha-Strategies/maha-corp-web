"""Maha Strategies Python SDK.

Zero-dependency client for the credentialed Maha API, and the base the
LangChain and CrewAI tool adapters are built on.
"""

from ._client import (
    ClaimVerification,
    CompressionResult,
    MahaApiError,
    MahaAuthenticationError,
    MahaClient,
    MahaCreditError,
)

__version__ = "0.2.0"

__all__ = [
    "MahaClient",
    "MahaApiError",
    "MahaAuthenticationError",
    "MahaCreditError",
    "CompressionResult",
    "ClaimVerification",
    "__version__",
]
