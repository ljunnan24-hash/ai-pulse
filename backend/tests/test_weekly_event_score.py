"""新版 weekly_score：payload 收口（不依赖 SQLAlchemy 2 导入路径）+ 公式辅助（需 SA2 ORM）。"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.services.phase35_compat import apply_backward_compat_from_phase35
from app.services.payload_schema import finalize_payload_v3, validate_payload

try:
    from datetime import date

    from sqlalchemy.orm import mapped_column as _SA2_MAPPED  # noqa: F401

    from app.services.weekly_event_score_service import (
        _active_days_shanghai,
        active_day_boost_from_days,
        authority_boost,
        calculate_weekly_score,
        independent_source_keys_from_merged,
        shanghai_week_window_utc,
        source_boost_from_count,
    )

    _HAS_WEEKLY_SCORE_SERVICE = True
except ImportError:  # pragma: no cover
    _HAS_WEEKLY_SCORE_SERVICE = False


class TestWeeklyPayloadWeeklyGe(unittest.TestCase):
    def test_backward_compat_weekly_ge_does_not_fill_top3_from_judgments(self):
        normal = {
            "top3": [],
            "top3_judgments": [
                {
                    "title": "Judged",
                    "what_happened": "w",
                    "why_it_matters": "i",
                    "what_to_do_now": "n",
                    "related_event_ids": [],
                    "source_urls": [],
                }
            ],
        }
        apply_backward_compat_from_phase35(normal, weekly_top3_global_events_only=True)
        self.assertEqual(normal.get("top3"), [])

    def test_finalize_weekly_ge_two_rows_no_pad(self):
        raw = {
            "weekly_top3_global_events_only": True,
            "allow_short_top3": True,
            "simple": {"lines": [], "footer": ""},
            "normal": {
                "top3": [
                    {
                        "title": "A",
                        "url": "/events/1",
                        "what_happened": "x",
                        "why_important": "y",
                        "what_it_means_for_you": "现在用",
                        "attention_level": "3",
                        "event_id": 1,
                        "weekly_score": 88.0,
                        "weekly_rank": 1,
                        "detail_url": "/events/1",
                    },
                    {
                        "title": "B",
                        "url": "/events/2",
                        "what_happened": "x",
                        "why_important": "y",
                        "what_it_means_for_you": "先观望",
                        "attention_level": "3",
                        "event_id": 2,
                        "weekly_score": 100.0,
                        "weekly_rank": 2,
                        "detail_url": "/events/2",
                    },
                ],
                "sections": [],
                "capabilities": [],
                "tools": [],
            },
            "glossary": [],
        }
        fin = finalize_payload_v3(raw)
        errs = validate_payload(fin)
        self.assertEqual(errs, [])
        self.assertEqual(len(fin["normal"]["top3"]), 2)


@unittest.skipUnless(_HAS_WEEKLY_SCORE_SERVICE, "需要 SQLAlchemy 2.x ORM 以导入 weekly_event_score_service")
class TestWeeklyScoreFormula(unittest.TestCase):
    def test_formula_a_vs_b_order(self):
        s_a, _ = calculate_weekly_score(
            max_pulse_score=88,
            independent_source_count=1,
            active_days=1,
            has_official_source=False,
            has_authority_media=False,
        )
        self.assertEqual(s_a, 88.0)
        s_b, reasons_b = calculate_weekly_score(
            max_pulse_score=84,
            independent_source_count=4,
            active_days=3,
            has_official_source=True,
            has_authority_media=True,
        )
        self.assertEqual(s_b, 100.0)
        self.assertEqual(reasons_b["final_weekly_score"], 100.0)
        self.assertGreater(s_b, s_a)

    def test_source_boost_same_host_deduped(self):
        merged = [
            {"url": "https://news.example.com/a", "source_name": "A"},
            {"url": "https://news.example.com/b", "source_name": "B"},
        ]
        self.assertEqual(len(independent_source_keys_from_merged(merged)), 1)
        self.assertEqual(source_boost_from_count(1), 0.0)
        self.assertEqual(source_boost_from_count(4), 7.0)

    def test_active_days_three_shanghai_days(self):
        week_start = datetime(2026, 5, 10, 16, 0, tzinfo=timezone.utc)
        week_end = datetime(2026, 5, 17, 16, 0, tzinfo=timezone.utc)
        merged = [
            {"published_at": "2026-05-11T10:00:00+08:00"},
            {"published_at": "2026-05-12T10:00:00+08:00"},
            {"published_at": "2026-05-13T10:00:00+08:00"},
        ]

        class _Ge:
            published_at = None

        d = _active_days_shanghai(merged, _Ge(), week_start, week_end)
        self.assertEqual(d, 3)
        self.assertEqual(active_day_boost_from_days(d), 4.0)

    def test_authority_boost_official_media_cap(self):
        self.assertEqual(authority_boost(True, False), 5.0)
        self.assertEqual(authority_boost(False, True), 3.0)
        self.assertEqual(authority_boost(True, True), 8.0)

    def test_shanghai_week_window_is_previous_calendar_week(self):
        """发行周一 2026-05-18 → 内容覆盖 5/11～5/17（上周一至上周日）。"""
        start_utc, end_utc, period_end = shanghai_week_window_utc(date(2026, 5, 18))
        self.assertEqual(period_end, date(2026, 5, 17))
        # 2026-05-11 00:00 Asia/Shanghai = 2026-05-10 16:00 UTC
        self.assertEqual(start_utc, datetime(2026, 5, 10, 16, 0, tzinfo=timezone.utc))
        # 2026-05-18 00:00 Asia/Shanghai = 2026-05-17 16:00 UTC
        self.assertEqual(end_utc, datetime(2026, 5, 17, 16, 0, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
