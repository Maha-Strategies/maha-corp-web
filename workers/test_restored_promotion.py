import unittest

from workers.restored_promotion import RestoredPromotionError, validate_restored_evidence


def evidence():
    return {
        "schema": "maha.restored-engines-benchmark.v1", "commit": "abc123",
        "tensorNetwork": {"backend": "cuda", "device": "NVIDIA A10G", "cases": [
            {"size": size, "repeats": 7, "bondDimension": 256, "latencyP95Ms": 100, "runs": [{"objectiveVerified": True, "provenOptimal": False}] * 7}
            for size in (64, 128, 256)
        ]},
        "geometricRegistration": {"backend": "cuda", "device": "NVIDIA A10G", "cases": [
            {"pointCount": size, "repeats": 7, "latencyP95Ms": 150, "runs": [{"transformVerified": True}] * 7}
            for size in (256, 4096, 16384)
        ]},
    }


class RestoredPromotionTests(unittest.TestCase):
    def test_accepts_complete_verified_a10g_evidence(self):
        validate_restored_evidence(evidence())

    def test_rejects_latency_or_verification_regressions(self):
        slow = evidence(); slow["tensorNetwork"]["cases"][2]["latencyP95Ms"] = 151
        with self.assertRaises(RestoredPromotionError): validate_restored_evidence(slow)
        wrong = evidence(); wrong["geometricRegistration"]["cases"][0]["runs"][0]["transformVerified"] = False
        with self.assertRaises(RestoredPromotionError): validate_restored_evidence(wrong)


if __name__ == "__main__":
    unittest.main()
