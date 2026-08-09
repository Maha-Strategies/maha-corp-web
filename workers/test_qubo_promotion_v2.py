import unittest

from workers.qubo_promotion import validate_promotion_evidence_v2

SLA = {"maximumWarmP95Ms": 500.0, "maximumWorstOptimalityGap": 0.02}


def run(index=0, objective=-2.0):
    return {
        "repeat": index,
        "latencyMs": 120.0,
        "objectiveValue": objective,
        "objectiveVerified": True,
        "provenOptimal": False,
    }


def case(size=64, exact=None, reference_wins=True, reference_faster=True, p95=200.0):
    return {
        "size": size,
        "termCount": 245,
        "repeats": 5,
        "algorithm": "parallel-update-simulated-annealing-torch-v1",
        "sweeps": 64,
        "replicas": 64,
        "latencyP50Ms": 110.0,
        "latencyP95Ms": p95,
        "bestObjective": -2.0,
        "worstObjective": -1.99,
        "exact": exact,
        "tensorNetwork": {
            "bondDimension": 256,
            "objectiveValue": -1.5,
            "objectiveVerified": True,
            "latencyMs": 300.0,
            "bestGap": -0.33,
            "referenceWins": reference_wins,
            "referenceTies": False,
            "referenceFaster": reference_faster,
        },
        "runs": [run(index) for index in range(5)],
    }


def evidence(cases=None):
    return {
        "schema": "maha.qubo-promotion-benchmark.v2",
        "backend": "cuda",
        "device": "NVIDIA A10G",
        "commit": "1234567890abcdef",
        "generatedAt": "2026-08-09T00:00:00Z",
        "exactLimit": 20,
        "cases": cases if cases is not None else [
            case(16, exact={"objectiveValue": -2.0, "bestGap": 0.0, "worstGap": 0.005, "bestIsOptimal": True}),
            case(64),
            case(256),
        ],
    }


class PromotionEvidenceV2Tests(unittest.TestCase):
    def test_accepts_complete_evidence(self):
        self.assertEqual(validate_promotion_evidence_v2(evidence(), SLA), [])

    def test_rejects_cpu_evidence(self):
        payload = evidence()
        payload["backend"] = "cpu"
        payload["device"] = "cpu"
        self.assertTrue(validate_promotion_evidence_v2(payload, SLA))

    def test_rejects_v1_schema(self):
        payload = evidence()
        payload["schema"] = "maha.qubo-benchmark.v1"
        self.assertIn("unsupported benchmark schema", validate_promotion_evidence_v2(payload, SLA))

    def test_latency_alone_cannot_pass_a_poor_solver(self):
        # The defect the v1 gate could not see: fast, but far from the optimum
        # it can be checked against.
        payload = evidence([
            case(16, exact={"objectiveValue": -10.0, "bestGap": 0.05, "worstGap": 0.35, "bestIsOptimal": False}),
            case(64, p95=10.0),
            case(256, p95=12.0),
        ])
        failures = validate_promotion_evidence_v2(payload, SLA)
        self.assertTrue(any("optimality gap" in failure for failure in failures))

    def test_worst_seed_decides_quality_not_best(self):
        # A caller gets one seed. Best-of-seven would flatter the engine.
        payload = evidence([
            case(16, exact={"objectiveValue": -10.0, "bestGap": 0.0, "worstGap": 0.9, "bestIsOptimal": True}),
            case(64),
            case(256),
        ])
        self.assertTrue(any("optimality gap" in failure for failure in validate_promotion_evidence_v2(payload, SLA)))

    def test_rejects_evidence_with_no_ground_truth_case(self):
        payload = evidence([case(64), case(128), case(256)])
        failures = validate_promotion_evidence_v2(payload, SLA)
        self.assertIn("no case was small enough to establish an optimality gap", failures)

    def test_rejects_an_undifferentiated_engine(self):
        # Beaten on quality everywhere and slower everywhere: passing a latency
        # threshold does not make this a product.
        payload = evidence([
            case(16, exact={"objectiveValue": -2.0, "bestGap": 0.0, "worstGap": 0.001, "bestIsOptimal": True},
                 reference_wins=False, reference_faster=False),
            case(64, reference_wins=False, reference_faster=False),
            case(256, reference_wins=False, reference_faster=False),
        ])
        failures = validate_promotion_evidence_v2(payload, SLA)
        self.assertTrue(any("undifferentiated" in failure for failure in failures))

    def test_winning_on_speed_alone_is_differentiation_enough(self):
        payload = evidence([
            case(16, exact={"objectiveValue": -2.0, "bestGap": 0.0, "worstGap": 0.001, "bestIsOptimal": True},
                 reference_wins=False, reference_faster=True),
            case(64, reference_wins=False, reference_faster=True),
            case(256, reference_wins=False, reference_faster=True),
        ])
        self.assertEqual(validate_promotion_evidence_v2(payload, SLA), [])

    def test_rejects_a_claimed_optimum_from_a_heuristic(self):
        payload = evidence()
        payload["cases"][1]["runs"][0]["provenOptimal"] = True
        self.assertTrue(any("claimed optimality" in failure for failure in validate_promotion_evidence_v2(payload, SLA)))

    def test_rejects_an_unverified_objective(self):
        payload = evidence()
        payload["cases"][1]["runs"][2]["objectiveVerified"] = False
        self.assertTrue(any("unverified objective" in failure for failure in validate_promotion_evidence_v2(payload, SLA)))

    def test_rejects_a_missing_tensor_network_comparison(self):
        payload = evidence()
        del payload["cases"][2]["tensorNetwork"]
        self.assertTrue(any("tensor-network comparison" in failure for failure in validate_promotion_evidence_v2(payload, SLA)))

    def test_rejects_latency_over_the_sla(self):
        payload = evidence([
            case(16, exact={"objectiveValue": -2.0, "bestGap": 0.0, "worstGap": 0.001, "bestIsOptimal": True}),
            case(64),
            case(256, p95=5_464.895),
        ])
        self.assertTrue(any("exceeds 500.0ms" in failure for failure in validate_promotion_evidence_v2(payload, SLA)))

    def test_requires_the_sla_to_carry_both_thresholds(self):
        self.assertIn("SLA is missing maximumWorstOptimalityGap",
                      validate_promotion_evidence_v2(evidence(), {"maximumWarmP95Ms": 500.0}))


if __name__ == "__main__":
    unittest.main()
