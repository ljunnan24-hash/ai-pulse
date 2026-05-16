"""weekly_global_pipeline：Top3 与 payload 结构（无 LLM）。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.weekly_global_pipeline import _simple_lines_from_top3, build_global_weekly_payload


def test_simple_lines_from_top3_uses_event_fields() -> None:
    lines = _simple_lines_from_top3(
        [
            {
                "title": "标题",
                "what_happened": "发生了什么。",
                "what_it_means_for_you": "对你意味着测试。",
                "url": "https://example.com",
                "event_id": 1,
            }
        ]
    )
    assert len(lines) == 1
    assert lines[0]["title"] == "标题"
    assert "发生了什么" in lines[0]["what_happened"]


def test_build_global_weekly_payload_structure_without_llm() -> None:
    period = date(2026, 5, 11)
    ge = SimpleNamespace(
        id=1,
        status="active",
        canonical_title="Event A",
        canonical_url="https://example.com/a",
        title_zh="事件A",
        summary="sum",
        category="model",
        ranking_score=80.0,
        source_count=2,
        what_happened="WH",
        why_important="WI",
        what_it_means_for_you="WM",
        action_suggestion="先观望",
        last_seen_at=datetime.now(timezone.utc),
        published_at=datetime.now(timezone.utc),
    )
    wes = SimpleNamespace(
        global_event_id=1,
        weekly_score=88.5,
        score_reasons={"final_weekly_score": 88.5},
    )

    db = MagicMock()

    def _get(model, pk):
        if model.__name__ == "GlobalEvent":
            return ge if pk == 1 else None
        return None

    db.get.side_effect = _get
    db.scalars.return_value.all.return_value = [wes]

    with (
        patch("app.services.weekly_global_pipeline.recompute_weekly_event_scores_for_period", return_value=1),
        patch(
            "app.services.weekly_global_pipeline.resolve_global_weekly_top3_rows",
            return_value=(
                [
                    {
                        "event_id": 1,
                        "title": "事件A",
                        "url": "https://example.com/a",
                        "what_happened": "WH",
                        "why_important": "WI",
                        "what_it_means_for_you": "WM",
                        "weekly_score": 88.5,
                        "detail_url": "/events/1",
                    }
                ],
                {"method": "weekly_score_fallback"},
            ),
        ),
        patch(
            "app.services.weekly_global_pipeline.publish_weekly_report",
            return_value="https://weekly.example/weekly/2026-05-11",
        ),
    ):
        res = build_global_weekly_payload(
            db,
            period_start=period,
            pool_events=[ge],
            top_n_llm=5,
            enable_llm=False,
        )

    assert res.payload["weekly_top3_global_events_only"] is True
    norm = res.payload["normal"]
    assert len(norm["top3"]) == 1
    assert str(norm["top3"][0]["event_id"]) == "1"
    assert norm.get("weekly_thesis")
    assert res.audit_report.get("mode") == "weekly_global_slim"
