"""HTTP client for the Maha Strategies API.

Mirrors the TypeScript client in `lib/sdk`. The agent frameworks this is
distributed through -- LangChain, CrewAI, LlamaIndex -- are Python-first, and a
tool adapter cannot depend on an npm package.

Deliberately dependency-free. It installs into any agent environment without
resolving against whatever HTTP library that environment already pins, and it
cannot drag a transitive vulnerability into someone else's agent.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "https://www.mahastrategies.com"
DEFAULT_TIMEOUT_SECONDS = 30.0

__all__ = [
    "MahaClient",
    "MahaApiError",
    "MahaAuthenticationError",
    "MahaCreditError",
    "CompressionResult",
    "ClaimVerification",
]


class MahaApiError(Exception):
    """A non-2xx response from the API."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"[{self.status} {self.code}] {self.message}"


class MahaAuthenticationError(MahaApiError):
    """The API key is missing, invalid, or revoked."""


class MahaCreditError(MahaApiError):
    """The key has no credits left. Carries the purchase URL when the API sends one."""

    def __init__(self, status: int, code: str, message: str, purchase_url: str | None = None) -> None:
        super().__init__(status, code, message)
        self.purchase_url = purchase_url


@dataclass(frozen=True)
class CompressionResult:
    pack_id: str
    context: str
    original_estimated_tokens: int
    compiled_estimated_tokens: int
    estimated_reduction_percent: float
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class ClaimVerification:
    claim_id: str
    title: str
    summary: str
    status: str
    sources: tuple[str, ...]
    canonical_url: str

    @property
    def is_evidence_backed(self) -> bool:
        """VERIFIED and SOURCED identify evidence status. ILLUSTRATIVE and
        UNVERIFIED must not be treated as established fact -- the status label
        is material, and collapsing it misrepresents the record."""
        return self.status in ("VERIFIED", "SOURCED")


def _new_request_id() -> str:
    return uuid.uuid4().hex


class MahaClient:
    """Client for the credentialed Maha API.

    >>> client = MahaClient(api_key="maha_live_sk_...")
    >>> client.balance()["balance_credits"]
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        *,
        opener: Any | None = None,
    ) -> None:
        if not api_key or not api_key.strip():
            raise ValueError("api_key is required.")
        self._api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        # Injectable so tests exercise the real request-building and
        # error-mapping paths without network access.
        self._opener = opener or urllib.request.urlopen

    # -- transport -------------------------------------------------------

    def _request(self, path: str, method: str = "GET", body: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
            "User-Agent": "maha-sdk-python/0.1.0",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self._opener(request, timeout=self.timeout) as response:
                payload = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            raise self._to_error(error) from None
        except urllib.error.URLError as error:  # pragma: no cover - network dependent
            raise MahaApiError(0, "connection_failed", f"Could not reach {self.base_url}: {error.reason}") from None

        if not payload:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            raise MahaApiError(0, "invalid_response", "The API returned a body that was not JSON.") from None

    @staticmethod
    def _to_error(error: urllib.error.HTTPError) -> MahaApiError:
        status = error.code
        code, message, purchase_url = f"http_{status}", error.reason or "Request failed.", None
        try:
            body = json.loads(error.read().decode("utf-8"))
            detail = body.get("error") if isinstance(body, dict) else None
            if isinstance(detail, dict):
                code = detail.get("code") or code
                message = detail.get("message") or message
                purchase_url = detail.get("href") or detail.get("purchaseUrl")
        except Exception:  # noqa: BLE001 - an unparseable error body must not mask the status
            pass

        if status in (401, 403):
            return MahaAuthenticationError(status, code, message)
        if status == 402:
            return MahaCreditError(status, code, message, purchase_url)
        return MahaApiError(status, code, message)

    # -- API -------------------------------------------------------------

    def balance(self) -> dict[str, Any]:
        """Remaining credits for this key."""
        return self._request("/api/v1/keys/balance")

    def compress(
        self,
        task: str,
        documents: list[dict[str, str]],
        token_budget: int,
        client_request_id: str | None = None,
    ) -> CompressionResult:
        """Compile documents into a context pack that fits a token budget."""
        if not task.strip():
            raise ValueError("task is required.")
        if not documents:
            raise ValueError("at least one document is required.")
        if token_budget <= 0:
            raise ValueError("token_budget must be positive.")

        payload = self._request(
            "/api/v1/compress",
            method="POST",
            body={
                "clientRequestId": client_request_id or _new_request_id(),
                "task": task,
                "tokenBudget": token_budget,
                "documents": documents,
            },
        )
        metrics = payload.get("metrics", {})
        return CompressionResult(
            pack_id=payload["packId"],
            context=payload["context"],
            original_estimated_tokens=metrics.get("originalEstimatedTokens", 0),
            compiled_estimated_tokens=metrics.get("compiledEstimatedTokens", 0),
            estimated_reduction_percent=metrics.get("estimatedReductionPercent", 0),
            warnings=tuple(payload.get("warnings") or ()),
        )

    def verify_claim(self, claim_id: str) -> ClaimVerification:
        """Resolve a published claim and its sources."""
        if not claim_id or not claim_id.replace("-", "").isalnum() or claim_id != claim_id.lower():
            raise ValueError("claim_id must be a lowercase slug.")
        payload = self._request(f"/api/v1/claims/{urllib.parse.quote(claim_id)}")
        return ClaimVerification(
            claim_id=payload["claim_id"],
            title=payload["title"],
            summary=payload["summary"],
            status=payload["status"],
            sources=tuple(payload.get("sources") or ()),
            canonical_url=payload["canonical_url"],
        )

    def call_mcp_tool(self, server_id: str, method: str, params: dict[str, Any] | None = None) -> Any:
        """Invoke a tool on a registered MCP server through the gateway.

        The gateway applies the tenant's rate limit, timeout, and circuit
        breaker, so a slow or failing upstream surfaces as 504 or 503 rather
        than hanging the caller.
        """
        if not server_id.strip():
            raise ValueError("server_id is required.")
        if not method.strip():
            raise ValueError("method is required.")
        payload = self._request(
            f"/api/v1/mcp/gateway/{urllib.parse.quote(server_id)}",
            method="POST",
            body={"jsonrpc": "2.0", "id": _new_request_id(), "method": method, "params": params or {}},
        )
        if isinstance(payload, dict) and "error" in payload and payload["error"]:
            error = payload["error"]
            raise MahaApiError(200, str(error.get("code", "jsonrpc_error")), str(error.get("message", "Tool call failed.")))
        return payload.get("result") if isinstance(payload, dict) else payload

    def list_mcp_servers(self) -> list[dict[str, Any]]:
        """Registered MCP servers for this tenant. Never includes credentials."""
        payload = self._request("/api/v1/mcp/servers")
        return payload if isinstance(payload, list) else payload.get("servers", [])
