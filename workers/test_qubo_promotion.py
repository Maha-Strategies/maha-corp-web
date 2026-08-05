import unittest

from workers.qubo_promotion import validate_promotion_evidence


def valid_evidence():
    run = {
        "repeat": 0,
        "latencyMs": 12.0,
        "objectiveValue": -2.0,
        "objectiveVerified": True,
        "provenOptimal": False,
    }
    case = {
        "size": 64,
        "repeats": 5,
        "algorithm": "multi-start-simulated-annealing-torch",
        "latencyP95Ms": 20.0,
        "runs": [{**run, "repeat": index} for index in range(5)],
    }
    return {
        "schema": "maha.qubo-benchmark.v1",
        "backend": "cuda",
        "device": "NVIDIA A10G",
        "commit": "1234567890abcdef",
        "generatedAt": "2026-08-05T00:00:00Z",
        "cases": [{**case, "size": size} for size in (64, 128, 256)],
    }


class PromotionEvidenceTests(unittest.TestCase):
    def test_accepts_complete_cuda_evidence(self):
        self.assertEqual(validate_promotion_evidence(valid_evidence(), 50.0), [])

    def test_rejects_cpu_evidence(self):
        evidence = valid_evidence()
        evidence["backend"] = "cpu"
        evidence["device"] = "cpu"
        self.assertTrue(validate_promotion_evidence(evidence, 50.0))

    def test_rejects_false_optimality_and_failed_verification(self):
        evidence = valid_evidence()
        evidence["cases"][0]["runs"][0]["provenOptimal"] = True
        evidence["cases"][1]["runs"][0]["objectiveVerified"] = False
        failures = validate_promotion_evidence(evidence, 50.0)
        self.assertTrue(any("claimed optimality" in failure for failure in failures))
        self.assertTrue(any("unverified objective" in failure for failure in failures))

    def test_rejects_latency_over_reviewed_sla(self):
        evidence = valid_evidence()
        evidence["cases"][2]["latencyP95Ms"] = 50.1
        self.assertTrue(validate_promotion_evidence(evidence, 50.0))


if __name__ == "__main__":
    unittest.main()
