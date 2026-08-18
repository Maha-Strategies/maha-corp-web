"""Tests for the Maha Python client.

Uses a fake opener rather than mocking the client's own methods, so request
construction, header assembly, and error mapping are all genuinely exercised.
stdlib unittest only, so CI needs no test framework.
"""

from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from maha_sdk import (  # noqa: E402
    MahaApiError,
    MahaAuthenticationError,
    MahaClient,
    MahaCreditError,
)


class FakeResponse(io.BytesIO):
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def opener_returning(payload: object, captured: list | None = None):
    def _open(request, timeout=None):  # noqa: ANN001
        if captured is not None:
            captured.append(request)
        return FakeResponse(json.dumps(payload).encode("utf-8"))

    return _open


def opener_raising(status: int, body: object):
    def _open(request, timeout=None):  # noqa: ANN001
        raise urllib.error.HTTPError(
            url="https://www.mahastrategies.com",
            code=status,
            msg="error",
            hdrs=None,
            fp=io.BytesIO(json.dumps(body).encode("utf-8")),
        )

    return _open


class ConstructionTests(unittest.TestCase):
    def test_api_key_is_required(self) -> None:
        for bad in ("", "   "):
            with self.assertRaises(ValueError):
                MahaClient(api_key=bad)

    def test_trailing_slash_is_normalised(self) -> None:
        client = MahaClient(api_key="k", base_url="https://example.com/")
        self.assertEqual(client.base_url, "https://example.com")


class RequestTests(unittest.TestCase):
    def test_the_key_is_sent_as_a_bearer_token(self) -> None:
        captured: list = []
        client = MahaClient(api_key="maha_live_sk_example", opener=opener_returning({"balance_credits": 5}, captured))
        client.balance()

        request = captured[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer maha_live_sk_example")
        self.assertEqual(request.full_url, "https://www.mahastrategies.com/api/v1/keys/balance")
        self.assertEqual(request.get_method(), "GET")

    def test_a_post_carries_json(self) -> None:
        captured: list = []
        client = MahaClient(api_key="k", opener=opener_returning(
            {"packId": "pack_1", "context": "compiled", "metrics": {}, "warnings": []}, captured))
        client.compress(task="summarise", documents=[{"id": "d1", "text": "body"}], token_budget=500)

        request = captured[0]
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Content-type"), "application/json")
        body = json.loads(request.data)
        self.assertEqual(body["task"], "summarise")
        self.assertEqual(body["tokenBudget"], 500)
        # Generated per call so a retry is not mistaken for a fresh request.
        self.assertTrue(body["clientRequestId"])

    def test_celestial_report_uses_the_versioned_enterprise_route(self) -> None:
        captured: list = []
        client = MahaClient(api_key="k", opener=opener_returning({"report": {"reportId": "celrep_1"}}, captured))
        payload = {"apiVersion": "maha-celestial-api/1", "clientRequestId": "case_0001"}
        result = client.create_celestial_report(payload)
        self.assertEqual(result["report"]["reportId"], "celrep_1")
        self.assertEqual(captured[0].full_url, "https://www.mahastrategies.com/api/v1/celestial/reports")
        self.assertEqual(json.loads(captured[0].data), payload)


class ErrorMappingTests(unittest.TestCase):
    def test_401_becomes_an_authentication_error(self) -> None:
        client = MahaClient(api_key="k", opener=opener_raising(401, {"error": {"code": "invalid_api_key", "message": "This API key is invalid."}}))
        with self.assertRaises(MahaAuthenticationError) as caught:
            client.balance()
        self.assertEqual(caught.exception.code, "invalid_api_key")
        self.assertEqual(caught.exception.status, 401)

    def test_402_carries_the_purchase_url(self) -> None:
        # Depleted credit is the error an agent is most likely to hit, and the
        # one where the next action matters.
        client = MahaClient(api_key="k", opener=opener_raising(
            402, {"error": {"code": "credit_balance_depleted", "message": "No credits remain.", "href": "/tools/token-calc"}}))
        with self.assertRaises(MahaCreditError) as caught:
            client.balance()
        self.assertEqual(caught.exception.purchase_url, "/tools/token-calc")

    def test_an_unparseable_error_body_still_reports_the_status(self) -> None:
        def _open(request, timeout=None):  # noqa: ANN001
            raise urllib.error.HTTPError("u", 503, "unavailable", None, io.BytesIO(b"<html>gateway</html>"))

        client = MahaClient(api_key="k", opener=_open)
        with self.assertRaises(MahaApiError) as caught:
            client.balance()
        self.assertEqual(caught.exception.status, 503)


class ValidationTests(unittest.TestCase):
    def test_compress_rejects_incoherent_input_before_spending_a_credit(self) -> None:
        client = MahaClient(api_key="k", opener=opener_returning({}))
        with self.assertRaises(ValueError):
            client.compress(task="  ", documents=[{"id": "d", "text": "t"}], token_budget=100)
        with self.assertRaises(ValueError):
            client.compress(task="t", documents=[], token_budget=100)
        with self.assertRaises(ValueError):
            client.compress(task="t", documents=[{"id": "d", "text": "t"}], token_budget=0)

    def test_claim_ids_must_be_lowercase_slugs(self) -> None:
        client = MahaClient(api_key="k", opener=opener_returning({}))
        for bad in ("Not-Lower", "has space", "under_score"):
            with self.assertRaises(ValueError):
                client.verify_claim(bad)


class ResponseShapeTests(unittest.TestCase):
    def test_claim_status_drives_the_evidence_flag(self) -> None:
        # The status label is material: ILLUSTRATIVE and UNVERIFIED records must
        # not be presented to an agent as established fact.
        for status, expected in (("VERIFIED", True), ("SOURCED", True), ("ILLUSTRATIVE", False), ("UNVERIFIED", False)):
            client = MahaClient(api_key="k", opener=opener_returning({
                "claim_id": "c-1", "title": "T", "summary": "S", "status": status,
                "sources": ["https://example.com/paper"], "canonical_url": "https://example.com/c-1",
            }))
            claim = client.verify_claim("c-1")
            self.assertEqual(claim.is_evidence_backed, expected, status)

    def test_a_jsonrpc_error_is_raised_rather_than_returned(self) -> None:
        client = MahaClient(api_key="k", opener=opener_returning(
            {"jsonrpc": "2.0", "id": "1", "error": {"code": -32601, "message": "Method not found"}}))
        with self.assertRaises(MahaApiError) as caught:
            client.call_mcp_tool("mcp_srv_1", "tools/missing")
        self.assertIn("Method not found", str(caught.exception))

    def test_a_successful_tool_call_returns_the_result(self) -> None:
        client = MahaClient(api_key="k", opener=opener_returning(
            {"jsonrpc": "2.0", "id": "1", "result": {"score": 0.42}}))
        self.assertEqual(client.call_mcp_tool("mcp_srv_1", "tools/score"), {"score": 0.42})


if __name__ == "__main__":
    unittest.main()
