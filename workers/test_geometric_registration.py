import unittest

from workers.geometric_registration import GeometricRegistrationError, normalize_registration, solve_kabsch_torch


class GeometricRegistrationTests(unittest.TestCase):
    def test_recovers_known_rigid_transform(self):
        try:
            import torch  # noqa: F401
        except ImportError:
            self.skipTest("Torch is not installed in the local test runtime")
        source = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]
        target = [[2, -1, 3], [2, 0, 3], [1, -1, 3], [2, -1, 4]]
        result = solve_kabsch_torch({"sourcePoints": source, "targetPoints": target}, {}, "cpu")
        self.assertLess(result["solution"]["rmse"], 1e-10)
        self.assertAlmostEqual(result["solution"]["determinant"], 1.0, places=10)
        self.assertLess(result["diagnostics"]["orthogonalityResidual"], 1e-10)

    def test_rejects_unpaired_or_nonfinite_points(self):
        with self.assertRaises(GeometricRegistrationError):
            normalize_registration({"sourcePoints": [[0, 0, 0]] * 3, "targetPoints": [[0, 0, 0]] * 2})
        with self.assertRaises(GeometricRegistrationError):
            normalize_registration({"sourcePoints": [[0, 0, float("inf")]] * 3, "targetPoints": [[0, 0, 0]] * 3})


if __name__ == "__main__":
    unittest.main()
