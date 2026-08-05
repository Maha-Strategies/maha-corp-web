import unittest

from workers.qubo_reference import (
    QuboReferenceError,
    objective_value,
    solve_cpu_annealing,
    solve_exact,
)


class QuboReferenceTests(unittest.TestCase):
    def test_qubo_exact_matches_known_minimum(self):
        problem = {
            "formulation": "qubo",
            "size": 2,
            "terms": [
                {"i": 0, "j": 0, "value": -1},
                {"i": 1, "j": 1, "value": -1},
                {"i": 0, "j": 1, "value": 3},
            ],
            "termsUrl": None,
        }
        result = solve_exact(problem)
        self.assertEqual(result["solution"]["objectiveValue"], -1)
        self.assertIn(result["solution"]["assignment"], ([0, 1], [1, 0]))
        self.assertTrue(result["solution"]["provenOptimal"])
        self.assertEqual(result["solution"]["bestBound"], -1)

    def test_ising_diagonal_is_constant(self):
        terms = [(0, 0, 4.0), (0, 1, -2.0)]
        self.assertEqual(objective_value("ising", terms, [-1, -1]), 2.0)
        self.assertEqual(objective_value("ising", terms, [1, 1]), 2.0)

    def test_small_cpu_path_is_exact_and_deterministic(self):
        problem = {
            "formulation": "ising",
            "size": 3,
            "terms": [
                {"i": 0, "j": 1, "value": 1},
                {"i": 1, "j": 2, "value": 1},
                {"i": 0, "j": 2, "value": 1},
            ],
            "termsUrl": None,
        }
        first = solve_cpu_annealing(problem, {"seed": 7})
        second = solve_cpu_annealing(problem, {"seed": 7})
        self.assertEqual(first, second)
        self.assertEqual(first["solution"]["objectiveValue"], -1)
        self.assertTrue(first["solution"]["provenOptimal"])

    def test_remote_terms_fail_closed(self):
        with self.assertRaisesRegex(QuboReferenceError, "remote term files are disabled"):
            solve_exact({
                "formulation": "qubo",
                "size": 2,
                "terms": None,
                "termsUrl": "https://example.com/problem.json",
            })


if __name__ == "__main__":
    unittest.main()
