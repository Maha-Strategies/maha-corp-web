import os
import unittest
from unittest.mock import patch

from workers.maha_workers import _callback_signing_secret, _valid_worker_token


class WorkerTokenTests(unittest.TestCase):
    def test_production_and_preview_tokens_are_independently_accepted(self):
        with patch.dict(os.environ, {"MAHA_WORKER_TOKEN": "production-token", "MAHA_WORKER_PREVIEW_TOKEN": "preview-token"}, clear=True):
            self.assertTrue(_valid_worker_token("production-token"))
            self.assertTrue(_valid_worker_token("preview-token"))
            self.assertFalse(_valid_worker_token("wrong-token"))

    def test_empty_configuration_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(_valid_worker_token("anything"))

    def test_preview_and_production_callbacks_use_distinct_secrets(self):
        environment = {
            "MAHA_WORKER_WEBHOOK_SECRET": "production-signing-secret",
            "MAHA_WORKER_PREVIEW_WEBHOOK_SECRET": "preview-signing-secret",
        }
        with patch.dict(os.environ, environment, clear=True):
            self.assertEqual(_callback_signing_secret("www.mahastrategies.com"), "production-signing-secret")
            self.assertEqual(_callback_signing_secret("maha-corp-example.vercel.app"), "preview-signing-secret")

    def test_preview_callback_does_not_fall_back_to_production_secret(self):
        with patch.dict(os.environ, {"MAHA_WORKER_WEBHOOK_SECRET": "production-signing-secret"}, clear=True):
            self.assertEqual(_callback_signing_secret("maha-corp-example.vercel.app"), "")


if __name__ == "__main__":
    unittest.main()
