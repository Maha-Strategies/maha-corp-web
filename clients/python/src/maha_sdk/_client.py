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
import os
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
        consented_capture: str | None = None,
    ) -> None:
        """Create a client.

        ``consented_capture`` is a directory path. When set, every payload this
        client sends to /compress is also written there as a benchmark corpus
        file, on the caller's own disk.

        It exists because the service keeps nothing. /compress answers
        ``sourceTextStored: false`` and that is a deliberate property, not a gap
        to be closed later, so there is no server-side corpus to improve the
        compiler against and there never will be. The only way to benchmark
        against real payloads is for the party who owns them to choose to keep
        a copy.

        So this writes locally and transmits nothing extra. Nothing is uploaded,
        no flag is sent to the server, and the request is byte-identical to one
        made without it. Sharing a captured corpus is a separate, deliberate act
        by whoever owns the data. Off unless a path is passed: a capture that
        could switch itself on would be a retention policy, not a courtesy.
        """
        if not api_key or not api_key.strip():
            raise ValueError("api_key is required.")
        self._api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._capture_dir = consented_capture
        # Injectable so tests exercise the real request-building and
        # error-mapping paths without network access.
        self._opener = opener or urllib.request.urlopen

    # -- consented capture -----------------------------------------------

    def _capture(
        self,
        request_id: str,
        task: str,
        documents: list[dict[str, Any]],
        token_budget: int,
    ) -> None:
        """Write one payload to the capture directory, if one was configured.

        Written in the harness's corpus format so a captured directory can be
        measured directly. ``needles`` is left empty because only a human who
        knows the question can say which passages answer it; the harness
        reports retention as unavailable rather than inventing a value.

        Failures are swallowed. A full disk or an unwritable path must never
        turn a benchmarking convenience into a failed API call.
        """
        if not self._capture_dir:
            return
        try:
            os.makedirs(self._capture_dir, exist_ok=True)
            corpus = {
                "name": f"captured-{request_id}",
                "task": task,
                "description": (
                    "Consented client-side capture. Real payload, unlabelled: "
                    "retention cannot be measured without ground truth."
                ),
                "documents": documents,
                "needles": [],
                "tokenBudget": token_budget,
            }
            path = os.path.join(self._capture_dir, f"captured-{request_id}.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(corpus, handle, indent=2)
        except OSError:
            pass

    # -- transport -------------------------------------------------------

    def _request(self, path: str, method: str = "GET", body: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
            "User-Agent": "maha-sdk-python/0.2.0",
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

        request_id = client_request_id or _new_request_id()
        self._capture(request_id, task, documents, token_budget)
        payload = self._request(
            "/api/v1/compress",
            method="POST",
            body={
                "clientRequestId": request_id,
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

    # -- Maha Celestial Evidence API ------------------------------------

    def create_celestial_report(self, request: dict[str, Any]) -> dict[str, Any]:
        """Compile a consent- and retention-bound report under API v1."""
        return self._request("/api/v1/celestial/reports", method="POST", body=request)

    def get_celestial_report(self, report_id: str) -> dict[str, Any]:
        """Read an unexpired report saved by this tenant."""
        return self._request(f"/api/v1/celestial/reports/{urllib.parse.quote(report_id)}")

    def export_celestial_report(self, report_id: str, format: str = "json") -> tuple[bytes, str]:
        """Download canonical JSON or the human-readable evidence PDF."""
        if format not in ("json", "pdf"):
            raise ValueError("format must be json or pdf.")
        url = f"{self.base_url}/api/v1/celestial/reports/{urllib.parse.quote(report_id)}/export?format={format}"
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {self._api_key}", "Accept": "application/json, application/pdf"})
        try:
            with self._opener(request, timeout=self.timeout) as response:
                data = response.read()
                disposition = response.headers.get("Content-Disposition", "") if getattr(response, "headers", None) else ""
        except urllib.error.HTTPError as error:
            raise self._to_error(error) from None
        filename = f"{report_id}-evidence.{format}"
        if 'filename="' in disposition:
            filename = disposition.split('filename="', 1)[1].split('"', 1)[0]
        return data, filename

    def delete_celestial_report(self, report_id: str) -> dict[str, Any]:
        """Immediately redact a saved report and retain only its tombstone."""
        return self._request(f"/api/v1/celestial/reports/{urllib.parse.quote(report_id)}", method="DELETE")

    def create_celestial_batch(self, client_request_id: str, requests: list[dict[str, Any]]) -> dict[str, Any]:
        """Compile 1-25 isolated reports and persist a non-sensitive manifest."""
        return self._request("/api/v1/celestial/batches", method="POST", body={"clientRequestId": client_request_id, "requests": requests})

    def list_celestial_packs(self) -> dict[str, Any]:
        return self._request("/api/v1/celestial/packs")

    def install_celestial_pack(self, pack_id: str, version: str, report_type: str) -> dict[str, Any]:
        return self._request("/api/v1/celestial/packs", method="POST", body={"packId": pack_id, "version": version, "reportType": report_type})

    def register_celestial_webhook(self, target_url: str, event_types: list[str]) -> dict[str, Any]:
        return self._request("/api/v1/celestial/webhooks", method="POST", body={"targetUrl": target_url, "eventTypes": event_types})

    def celestial_usage(self, start: str | None = None, end: str | None = None) -> dict[str, Any]:
        query = urllib.parse.urlencode({key: value for key, value in (("start", start), ("end", end)) if value})
        return self._request(f"/api/v1/celestial/usage{'?' + query if query else ''}")
