"""LangChain tool adapter.

Pillar 2 of the go-to-market plan: an agent author should get Maha's tools with
one line rather than by reading an API reference.

`langchain-core` is an optional dependency. Importing this module without it
raises a clear instruction instead of a bare ImportError, because the person
hitting that is mid-way through wiring an agent and needs the fix, not a stack
trace.
"""

from __future__ import annotations

from typing import Any

from ._client import MahaClient

try:  # pragma: no cover - exercised by whether langchain-core is installed
    from langchain_core.tools import StructuredTool

    _LANGCHAIN_AVAILABLE = True
except ImportError:  # pragma: no cover
    StructuredTool = None  # type: ignore[assignment]
    _LANGCHAIN_AVAILABLE = False

__all__ = ["MahaToolkit"]

_INSTALL_HINT = (
    "langchain-core is required for the LangChain adapter. Install it with "
    "`pip install 'maha-sdk[langchain]'`."
)


class MahaToolkit:
    """Maha's API as LangChain tools.

    >>> toolkit = MahaToolkit(MahaClient(api_key="maha_live_sk_..."))
    >>> agent = create_react_agent(llm, toolkit.get_tools())
    """

    def __init__(self, client: MahaClient) -> None:
        if not _LANGCHAIN_AVAILABLE:
            raise ImportError(_INSTALL_HINT)
        if not isinstance(client, MahaClient):
            raise TypeError("client must be a MahaClient.")
        self._client = client

    # Tool bodies are plain methods so they stay unit-testable without
    # LangChain installed, and so the descriptions live next to the behaviour.

    def _compress(self, task: str, documents: list[dict[str, str]], token_budget: int) -> str:
        result = self._client.compress(task=task, documents=documents, token_budget=token_budget)
        return result.context

    def _verify_claim(self, claim_id: str) -> str:
        claim = self._client.verify_claim(claim_id)
        # State the evidence status rather than returning the summary alone. An
        # agent that cannot see the label will treat an ILLUSTRATIVE record as
        # established fact.
        standing = "evidence-backed" if claim.is_evidence_backed else "NOT evidence-backed; do not treat as established fact"
        sources = "; ".join(claim.sources) or "none listed"
        return (
            f"{claim.title} [{claim.status} - {standing}]\n"
            f"{claim.summary}\n"
            f"Sources: {sources}\n"
            f"Canonical URL: {claim.canonical_url}"
        )

    def _balance(self) -> str:
        balance = self._client.balance()
        return f"{balance.get('balance_credits', 0)} credits remaining."

    def get_tools(self) -> list[Any]:
        """Every Maha tool, ready to hand to an agent."""
        return [
            StructuredTool.from_function(
                func=self._compress,
                name="maha_compress_context",
                description=(
                    "Compile a set of documents into a single context pack that fits a token budget. "
                    "Use when source material is too large for the model's context window. "
                    "Arguments: task (what the context is for), documents (list of {id, text}), "
                    "token_budget (integer)."
                ),
            ),
            StructuredTool.from_function(
                func=self._verify_claim,
                name="maha_verify_claim",
                description=(
                    "Resolve a published research claim by its lowercase slug and return its evidence "
                    "status and primary sources. Use before asserting a scientific claim. The returned "
                    "status is material: only VERIFIED and SOURCED records are evidence-backed."
                ),
            ),
            StructuredTool.from_function(
                func=self._balance,
                name="maha_credit_balance",
                description=(
                    "Report remaining API credits for the configured key. Use to check affordability "
                    "before a batch of calls."
                ),
            ),
        ]
