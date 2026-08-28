from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from maha_witness import (
    ArtifactSpec,
    WitnessRecorder,
    docker_metadata,
    qiskit_metadata,
    slurm_metadata,
    submit_receipt,
    verify_receipt,
    witness,
)
from maha_witness.canonical import canonical_json
from maha_witness.receipt import build_receipt


class WitnessTests(unittest.TestCase):
    def test_frozen_receipt_regenerates_byte_identically(self) -> None:
        fixture_path = Path(__file__).parents[1] / "fixtures" / "success-receipt.json"
        fixture = fixture_path.read_text(encoding="utf-8").strip()
        regenerated = build_receipt(
            job_id="cryogenic-model-001",
            callable_identity={"module": "models.thermal", "qualname": "solve"},
            status="succeeded",
            started_at="2026-08-28T10:00:00Z",
            finished_at="2026-08-28T10:00:04Z",
            artifacts=[
                {"name": "model-input", "role": "input", "mediaType": "application/json", "bytes": 25, "sha256": "sha256:" + "a" * 64},
                {"name": "model-output", "role": "output", "mediaType": "application/json", "bytes": 19, "sha256": "sha256:" + "b" * 64},
            ],
            environment={"declaredPackages": {"solver": "1.2.0"}, "platformMachine": "fixture", "platformSystem": "Linux", "pythonImplementation": "CPython", "pythonVersion": "3.11.9"},
            random_seeds={"solver": 17},
            configuration={"method": "fixed-point"},
            dossier_id="urn:maha:dossier:thermal-001",
            claim_ids=["claim-thermal-rise"],
            calculation_receipt_ids=["sha256:" + "1" * 64],
        )
        self.assertEqual(canonical_json(regenerated), fixture)

    def test_canonicalization_matches_dossier_rules(self) -> None:
        self.assertEqual(canonical_json({"B": 2, "a": 1}), '{"B":2,"a":1}')
        self.assertEqual(canonical_json({"Å": "A\u030a", "when": "2026-08-28T15:30:00+05:30"}), '{"when":"2026-08-28T10:00:00Z","Å":"Å"}')
        with self.assertRaisesRegex(ValueError, "decimal strings"):
            canonical_json({"unsafe": 0.1})

    def test_recorder_hashes_declared_artifacts_without_paths_or_secrets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, output = root / "secret-input.json", root / "output.json"
            source.write_text('{"temperature":"4.2 K"}', encoding="utf-8")
            output.write_text('{"result":"stable"}', encoding="utf-8")
            times = iter(("2026-08-28T10:00:00Z", "2026-08-28T10:00:04Z"))
            recorder = WitnessRecorder(
                job_id="cryogenic-model-001",
                callable_identity={"module": "models.thermal", "qualname": "solve"},
                input_artifacts=[ArtifactSpec("model-input", source, "input", "application/json")],
                output_artifacts=[ArtifactSpec("model-output", output, "output", "application/json")],
                environment={"pythonVersion": "3.11.9", "declaredPackages": {"solver": "1.2.0"}},
                random_seeds={"solver": 17},
                configuration={"method": "fixed-point"},
                dossier_id="urn:maha:dossier:thermal-001",
                claim_ids=["claim-thermal-rise"],
                calculation_receipt_ids=["sha256:" + "1" * 64],
                clock=lambda: next(times),
            )
            with recorder:
                pass
            receipt = recorder.receipt
            self.assertIsNotNone(receipt)
            valid, findings = verify_receipt(receipt or {})
            self.assertTrue(valid, findings)
            serialized = canonical_json(receipt)
            self.assertNotIn(str(root), serialized)
            self.assertNotIn("secret-input", serialized)
            self.assertNotIn("4.2 K", serialized)
            self.assertFalse(receipt["assurance"]["independentlyReproduced"])
            self.assertFalse(receipt["assurance"]["scientificValidityCertified"])

    def test_receipt_is_order_independent_and_tamper_evident(self) -> None:
        common = dict(
            job_id="job-001",
            callable_identity={"module": "m", "qualname": "f"},
            status="succeeded",
            started_at="2026-08-28T10:00:00Z",
            finished_at="2026-08-28T10:00:01Z",
            environment={"machine": "fixture"},
        )
        first = build_receipt(
            **common,
            artifacts=[
                {"name": "z", "role": "output", "mediaType": "text/plain", "bytes": 1, "sha256": "sha256:" + "2" * 64},
                {"name": "a", "role": "input", "mediaType": "text/plain", "bytes": 1, "sha256": "sha256:" + "1" * 64},
            ],
        )
        second = build_receipt(**common, artifacts=list(reversed(first["artifacts"])))
        self.assertEqual(first, second)
        tampered = json.loads(json.dumps(first))
        tampered["environment"]["machine"] = "different"
        self.assertEqual(verify_receipt(tampered)[1], ("witness-environment-digest-invalid", "witness-receipt-digest-invalid"))

    def test_failed_execution_emits_bounded_receipt_and_reraises(self) -> None:
        receipts = []
        times = iter(("2026-08-28T10:00:00Z", "2026-08-28T10:00:01Z"))

        @witness(job_id="failed-job", clock=lambda: next(times), sink=receipts.append)
        def fail(secret: str) -> None:
            raise RuntimeError("message contains " + secret)

        with self.assertRaisesRegex(RuntimeError, "message contains private-token"):
            fail("private-token")
        self.assertEqual(len(receipts), 1)
        self.assertEqual(receipts[0]["execution"]["failureType"], "RuntimeError")
        self.assertNotIn("private-token", canonical_json(receipts[0]))
        self.assertTrue(verify_receipt(receipts[0])[0])

    def test_adapters_are_bounded_and_fail_closed(self) -> None:
        with self.assertRaises(ValueError):
            docker_metadata(image_digest="ubuntu:latest")
        docker = docker_metadata(image_digest="sha256:" + "a" * 64)
        self.assertEqual(docker["imageDigest"], "sha256:" + "a" * 64)
        slurm = slurm_metadata({"SLURM_JOB_ID": "42", "DATABASE_URL": "secret", "HOME": "/private"})
        self.assertEqual(slurm["fields"], {"jobId": "42"})
        qiskit = qiskit_metadata(backend_name="ibm_fixture", shots=1024, seed_transpiler=9)
        self.assertEqual(qiskit["shots"], 1024)
        self.assertNotIn("credentials", qiskit)

    def test_credential_shaped_metadata_is_refused(self) -> None:
        with self.assertRaisesRegex(ValueError, "Credential-shaped"):
            build_receipt(
                job_id="job-001",
                callable_identity={"module": "m", "qualname": "f"},
                status="succeeded",
                started_at="2026-08-28T10:00:00Z",
                finished_at="2026-08-28T10:00:01Z",
                artifacts=[],
                environment={"nested": {"apiKey": "must-not-enter-receipt"}},
            )

    def test_registry_is_explicit_https_and_validates_before_transport(self) -> None:
        receipt = build_receipt(
            job_id="job-001",
            callable_identity={"module": "m", "qualname": "f"},
            status="succeeded",
            started_at="2026-08-28T10:00:00Z",
            finished_at="2026-08-28T10:00:01Z",
            artifacts=[],
            environment={"machine": "fixture"},
        )
        with self.assertRaises(ValueError):
            submit_receipt(receipt, registry_url="http://localhost/receipts", bearer_token="token")
        tampered = dict(receipt, jobId="changed")
        with self.assertRaisesRegex(ValueError, "invalid receipt"):
            submit_receipt(tampered, registry_url="https://registry.invalid/receipts", bearer_token="token")

    def test_arbitrary_cli_json_fails_closed(self) -> None:
        self.assertEqual(verify_receipt([]), (False, ("witness-unparseable",)))  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()
