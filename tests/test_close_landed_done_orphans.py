"""OVERSEER_CLOSE_LANDED_DONE_2026_09_04 — check landed Done opens in-place."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import project_automation as auto  # noqa: E402


class CloseLandedDoneOrphansTests(unittest.TestCase):
    def test_checks_proof_green_leaves_unknown(self) -> None:
        md = (
            "## Active\n"
            "- [x] **keep** — already done\n"
            "## Done\n"
            "- [ ] **[flaw-research] mark_local_verify on deferred arms cooldown → auto-commit theater** — "
            "should close when peer_loop land needle present\n"
            "- [ ] **[flaw-research] unknown unfinished under Done** — stay open for promote\n"
        )
        new_md, n = auto.close_landed_done_orphans(md)
        self.assertEqual(n, 1)
        self.assertIn(
            "- [x] **[flaw-research] mark_local_verify on deferred arms cooldown",
            new_md,
        )
        self.assertIn(
            "- [ ] **[flaw-research] unknown unfinished under Done**",
            new_md,
        )
        orphans = auto.open_done_orphan_items(new_md)
        self.assertEqual(len(orphans), 1)
        self.assertIn("unknown unfinished", orphans[0])

    def test_compact_wires_close_before_promote(self) -> None:
        src = (ROOT / "scripts" / "project_automation.py").read_text(encoding="utf-8")
        self.assertIn("OVERSEER_CLOSE_LANDED_DONE_2026_09_04", src)
        self.assertIn("landed_closed = close_landed_done_orphans", src)
        close_at = src.find("landed_closed = close_landed_done_orphans")
        promote_at = src.find("promoted = promote_open_done_orphans", close_at)
        self.assertGreater(promote_at, close_at)



    def test_closes_repo_flaw_hub_protect_and_false_eval_repoison(self) -> None:
        """OVERSEER_CLOSE_REPO_FLAW_HUB_PROTECT_2026_09_04 + FALSE_EVAL_REPOISON."""
        md = (
            "## Active\n"
            "- [ ] **[flaw-research] REPO_FLAW_RESEARCH.md missing from HUB_PROTECT_PULL_EXCLUDES** — add\n"
            "- [ ] **[flaw-research] Stale peer worktrees re-poison false eval() flaws** — peer DIFF\n"
            "- [ ] **[flaw-research] unknown unfinished** — stay open\n"
        )
        new_md, n = auto.close_landed_done_orphans(md)
        self.assertEqual(n, 2)
        self.assertIn("- [x] **[flaw-research] REPO_FLAW_RESEARCH.md missing from HUB_PROTECT", new_md)
        self.assertIn("- [x] **[flaw-research] Stale peer worktrees re-poison false eval", new_md)
        self.assertIn("- [ ] **[flaw-research] unknown unfinished**", new_md)


    def test_closes_kit_run_tenth_when_receipt_exists(self) -> None:
        """OVERSEER_CLOSE_KIT_RUN_RECEIPT_2026_09_08 — receipt beats peer reopen."""
        receipt = ROOT / "notes" / "KIT_A_TO_Z_TENTH_TARGET.md"
        self.assertTrue(receipt.is_file(), "tenth receipt must exist for live close")
        md = (
            "## Active\n"
            "- [ ] **[factory] Kit-run tenth registry target** — pick next repos/registry.json "
            "target with .git on CLEAN; prefer residual RAM reaffirm; NO PAY\n"
            "- [ ] **[top10] TOP10_NEXT T10-04 non-noop ≥8/day** — keep open\n"
        )
        new_md, n = auto.close_landed_done_orphans(md)
        self.assertEqual(n, 1)
        self.assertIn("- [x] **[factory] Kit-run tenth registry target**", new_md)
        self.assertIn("KIT_A_TO_Z_TENTH_TARGET.md", new_md)
        self.assertIn("- [ ] **[top10] TOP10_NEXT T10-04", new_md)
        self.assertNotIn("- [ ] **[factory] Kit-run tenth", new_md)

    def test_closes_kit_run_twelfth_when_receipt_exists(self) -> None:
        """OVERSEER_KIT_RUN_ORDINAL_THIRTEENTH_PLUS_2026_09_08 — twelfth still maps."""
        receipt = ROOT / "notes" / "KIT_A_TO_Z_TWELFTH_TARGET.md"
        self.assertTrue(receipt.is_file(), "twelfth receipt must exist for live close")
        md = (
            "## Active\n"
            "- [ ] **[factory] Kit-run twelfth registry target** — Marketplace seed; NO PAY\n"
            "- [ ] **[top10] TOP10_NEXT T10-04 non-noop ≥8/day** — keep open\n"
        )
        new_md, n = auto.close_landed_done_orphans(md)
        self.assertEqual(n, 1)
        self.assertIn("- [x] **[factory] Kit-run twelfth registry target**", new_md)
        self.assertIn("KIT_A_TO_Z_TWELFTH_TARGET.md", new_md)
        self.assertNotIn("- [ ] **[factory] Kit-run twelfth", new_md)

    def test_kit_run_thirteenth_ordinal_parses(self) -> None:
        """Ordinal map must recognize thirteenth+ (auto-close when receipt lands)."""
        item = (
            "- [ ] **[factory] Kit-run thirteenth registry target** — "
            "SaaS Health Dashboard; NO PAY"
        )
        self.assertEqual(auto._kit_run_ordinal_from_item(item), 13)
        self.assertEqual(auto._KIT_RUN_ORDINAL_WORDS.get("thirteenth"), 13)
        self.assertEqual(auto._KIT_RUN_ORDINAL_WORDS.get("twentieth"), 20)


if __name__ == "__main__":
    unittest.main()
