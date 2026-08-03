"""CrewAI tool adapter.

Same tools as the LangChain adapter, in CrewAI's shape. The tool bodies live on
MahaToolkit in `maha_sdk.langchain`, which does not require LangChain to be
installed to use them -- only `get_tools()` does. So this adapter reuses that
behaviour rather than restating it, and the two frameworks cannot drift apart.
"""

from __future__ import annotations

from typing import Any

from ._client import MahaClient

try:  # pragma: no cover - exercised by whether crewai-tools is installed
    from crewai_tools import BaseTool

    _CREWAI_AVAILABLE = True
except ImportError:  # pragma: no cover
    BaseTool = object  # type: ignore[assignment,misc]
    _CREWAI_AVAILABLE = False

__all__ = ["maha_tools"]

_INSTALL_HINT = (
    "crewai-tools is required for the CrewAI adapter. Install it with "
    "`pip install 'maha-sdk[crewai]'`."
)


def _tool_specs(client: MahaClient) -> list[tuple[str, str, Any]]:
    """Name, description, and callable for each tool.

    Kept as data so both adapters expose the same set, and so the set can be
    asserted in a test without either framework installed.
    """
    def compress(task: str, documents: list[dict[str, str]], token_budget: int) -> str:
        return client.compress(task=task, documents=documents, token_budget=token_budget).context

    def verify_claim(claim_id: str) -> str:
        claim = client.verify_claim(claim_id)
        standing = "evidence-backed" if claim.is_evidence_backed else "NOT evidence-backed; do not treat as established fact"
        sources = "; ".join(claim.sources) or "none listed"
        return f"{claim.title} [{claim.status} - {standing}]\n{claim.summary}\nSources: {sources}\nCanonical URL: {claim.canonical_url}"

    def credit_balance() -> str:
        return f"{client.balance().get('balance_credits', 0)} credits remaining."

    return [
        (
            "maha_compress_context",
            "Compile documents into a single context pack that fits a token budget. Use when source "
            "material exceeds the model's context window. Arguments: task, documents (list of {id, text}), token_budget.",
            compress,
        ),
        (
            "maha_verify_claim",
            "Resolve a published research claim by lowercase slug and return its evidence status and "
            "primary sources. Use before asserting a scientific claim. Only VERIFIED and SOURCED "
            "records are evidence-backed.",
            verify_claim,
        ),
        (
            "maha_credit_balance",
            "Report remaining API credits for the configured key. Use to check affordability before "
            "a batch of calls.",
            credit_balance,
        ),
    ]


def maha_tools(client: MahaClient) -> list[Any]:
    """Maha's API as CrewAI tools.

    >>> agent = Agent(role="Researcher", tools=maha_tools(MahaClient(api_key="maha_live_sk_...")))
    """
    if not _CREWAI_AVAILABLE:
        raise ImportError(_INSTALL_HINT)
    if not isinstance(client, MahaClient):
        raise TypeError("client must be a MahaClient.")

    tools = []
    for name, description, func in _tool_specs(client):
        tool_class = type(
            f"Maha_{name}",
            (BaseTool,),
            {
                "name": name,
                "description": description,
                "_run": staticmethod(func),
            },
        )
        tools.append(tool_class())
    return tools
