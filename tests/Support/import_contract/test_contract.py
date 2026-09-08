"""Run the exact files also consumed by Pest, without contacting a source."""
import json
import unittest

from contract import ROOT, check

FIXTURES = ROOT / "tests/Fixtures/import/v1"


class SnapshotContractTest(unittest.TestCase):
    def test_shared_contract_decisions(self):
        for case in json.loads((FIXTURES / "cases.json").read_text()):
            with self.subTest(case=case["name"]):
                directory = FIXTURES / case["name"]
                context = json.loads((directory / "context.json").read_text())
                self.assertEqual(check((directory / "manifest.json").read_bytes(), directory / "records.jsonl", context), case["expected"])

    def test_monotonic_deadline(self):
        directory = FIXTURES / "unknown-capacity"
        ticks = iter([0, 31])
        self.assertEqual(check((directory / "manifest.json").read_bytes(), directory / "records.jsonl", json.loads((directory / "context.json").read_text()), clock=lambda: next(ticks)), "invalid")


if __name__ == "__main__":
    unittest.main()
