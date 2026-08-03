"""Tests for the framework adapters.

Neither LangChain nor CrewAI is installed in CI, which is deliberate: the
adapters must fail with a usable instruction when the optional dependency is
absent, and the tool behaviour must be testable without either framework.
"""

from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from maha_sdk import MahaClient  # noqa: E402
from maha_sdk.crewai import _tool_specs, maha_tools  # noqa: E402
from maha_sdk.langchain import MahaToolkit  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def client_returning(payload: object) -> MahaClient:
    def _open(request, timeout=None):  # noqa: ANN001
        return FakeResponse(json.dumps(payload).encode("utf-8"))

    return MahaClient(api_key="k", opener=_open)


class OptionalDependencyTests(unittest.TestCase):
    def test_langchain_adapter_explains_how_to_install(self) -> None:
        with self.assertRaises(ImportError) as caught:
            MahaToolkit(client_returning({}))
        self.assertIn("maha-sdk[langchain]", str(caught.exception))

    def test_crewai_adapter_explains_how_to_install(self) -> None:
        with self.assertRaises(ImportError) as caught:
            maha_tools(client_returning({}))
        self.assertIn("maha-sdk[crewai]", str(caught.exception))


class ToolBehaviourTests(unittest.TestCase):
    """The tool bodies are reachable without either framework installed."""

    def test_claim_output_states_the_evidence_standing(self) -> None:
        client = client_returning({
            "claim_id": "c-1", "title": "A claim", "summary": "Body.", "status": "ILLUSTRATIVE",
            "sources": ["https://example.com/p"], "canonical_url": "https://example.com/c-1",
        })
        _, _, verify = _tool_specs(client)[1]
        output = verify("c-1")
        # An agent that cannot see the label will present this as fact.
        self.assertIn("ILLUSTRATIVE", output)
        self.assertIn("NOT evidence-backed", output)
        self.assertIn("https://example.com/p", output)

    def test_a_verified_claim_is_marked_evidence_backed(self) -> None:
        client = client_returning({
            "claim_id": "c-2", "title": "T", "summary": "S", "status": "VERIFIED",
            "sources": [], "canonical_url": "https://example.com/c-2",
        })
        _, _, verify = _tool_specs(client)[1]
        output = verify("c-2")
        self.assertIn("evidence-backed", output)
        self.assertNotIn("NOT evidence-backed", output)
        self.assertIn("none listed", output)

    def test_compress_returns_the_compiled_context(self) -> None:
        client = client_returning({"packId": "p1", "context": "compiled text", "metrics": {}, "warnings": []})
        _, _, compress = _tool_specs(client)[0]
        self.assertEqual(compress("task", [{"id": "d", "text": "t"}], 100), "compiled text")

    def test_balance_is_reported_in_words_an_agent_can_act_on(self) -> None:
        client = client_returning({"balance_credits": 1250})
        _, _, balance = _tool_specs(client)[2]
        self.assertIn("1250", balance())


class ParityTests(unittest.TestCase):
    def test_both_adapters_expose_the_same_tools(self) -> None:
        # Drift between frameworks is the failure mode here: an agent author on
        # CrewAI should not silently get fewer tools than one on LangChain.
        crew_names = [name for name, _, _ in _tool_specs(client_returning({}))]
        self.assertEqual(crew_names, ["maha_compress_context", "maha_verify_claim", "maha_credit_balance"])

        toolkit = MahaToolkit.__new__(MahaToolkit)  # bypass the import guard
        toolkit._client = client_returning({})
        langchain_bodies = [toolkit._compress, toolkit._verify_claim, toolkit._balance]
        self.assertEqual(len(langchain_bodies), len(crew_names))

    def test_every_tool_description_says_when_to_use_it(self) -> None:
        for name, description, _ in _tool_specs(client_returning({})):
            self.assertGreater(len(description), 60, name)
            self.assertIn("Use", description, name)


if __name__ == "__main__":
    unittest.main()
