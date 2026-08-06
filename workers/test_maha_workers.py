import os
import unittest
from unittest.mock import patch

from workers.maha_workers import _valid_worker_token


class WorkerTokenTests(unittest.TestCase):
    def test_production_and_preview_tokens_are_independently_accepted(self):
        with patch.dict(os.environ, {"MAHA_WORKER_TOKEN": "production-token", "MAHA_WORKER_PREVIEW_TOKEN": "preview-token"}, clear=True):
            self.assertTrue(_valid_worker_token("production-token"))
            self.assertTrue(_valid_worker_token("preview-token"))
            self.assertFalse(_valid_worker_token("wrong-token"))

    def test_empty_configuration_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(_valid_worker_token("anything"))


if __name__ == "__main__":
    unittest.main()
