import unittest

from workers.qubo_reference import objective_value, normalize_terms
from workers.tensor_network import solve_transfer_cpu


class TensorNetworkTests(unittest.TestCase):
    def test_exact_path_proves_small_problem(self):
        problem = {"formulation": "qubo", "size": 3, "terms": [
            {"i": 0, "j": 0, "value": -1}, {"i": 1, "j": 1, "value": -1},
            {"i": 2, "j": 2, "value": 2}, {"i": 0, "j": 1, "value": -2},
        ]}
        result = solve_transfer_cpu(problem, {"exactThreshold": 18, "bondDimension": 8})
        self.assertTrue(result["solution"]["provenOptimal"])
        self.assertEqual(result["solution"]["assignment"], [1, 1, 0])

    def test_truncated_contraction_returns_verified_assignment(self):
        problem = {"formulation": "ising", "size": 8, "terms": [
            {"i": i, "j": i + 1, "value": 1.0} for i in range(7)
        ]}
        result = solve_transfer_cpu(problem, {"exactThreshold": 0, "bondDimension": 4})
        assignment = result["solution"]["assignment"]
        verified = objective_value("ising", normalize_terms(problem)[2], assignment)
        self.assertEqual(result["solution"]["objectiveValue"], verified)
        self.assertFalse(result["solution"]["provenOptimal"])
        self.assertGreater(result["diagnostics"]["truncations"], 0)


if __name__ == "__main__":
    unittest.main()
