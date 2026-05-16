"""weekly_score 候选池 + LLM 选 Top3。"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.weekly_event_score_service import (
    _parse_llm_selected_event_ids,
    resolve_global_weekly_top3_rows,
    select_top3_event_ids_with_llm,
)


def test_parse_llm_selected_event_ids_filters_and_dedupes() -> None:
    allowed = {1, 2, 3, 4}
    got = _parse_llm_selected_event_ids(
        {"selected_event_ids": [3, 99, 3, 2, "2", 1]},
        allowed=allowed,
        limit=3,
    )
    assert got == [3, 2, 1]


def test_select_top3_event_ids_with_llm_returns_parsed_ids() -> None:
    client = MagicMock()
    client.is_configured.return_value = True
    client.complete_json.return_value = {"selected_event_ids": [2, 5, 1], "rationale": "ok"}
    candidates = [
        {"event_id": 1, "weekly_score": 90},
        {"event_id": 2, "weekly_score": 88},
        {"event_id": 3, "weekly_score": 70},
        {"event_id": 4, "weekly_score": 65},
    ]
    ids, audit = select_top3_event_ids_with_llm(client, candidates, limit=3)
    assert ids == [2, 1]
    assert audit.get("selected_event_ids") == [2, 1]


def test_resolve_global_weekly_top3_rows_llm_path() -> None:
    period = date(2026, 5, 11)
    base_ge = dict(
        status="active",
        summary="s",
        what_happened="wh",
        why_important="wi",
        what_it_means_for_you="wm",
        action_suggestion="观望",
        trust_score=None,
        metrics_json="{}",
        heat_score=0,
        source_count=1,
    )
    ge1 = SimpleNamespace(
        id=1,
        canonical_title="A",
        title_zh="甲",
        canonical_url="https://a",
        category="model",
        ranking_score=80.0,
        **base_ge,
    )
    ge2 = SimpleNamespace(
        id=2,
        canonical_title="B",
        title_zh="乙",
        canonical_url="https://b",
        category="tool",
        ranking_score=75.0,
        **base_ge,
    )
    ge3 = SimpleNamespace(
        id=3,
        canonical_title="C",
        title_zh="丙",
        canonical_url="https://c",
        category="industry",
        ranking_score=70.0,
        **base_ge,
    )
    ge4 = SimpleNamespace(
        id=4,
        canonical_title="D",
        title_zh="丁",
        canonical_url="https://d",
        category="open_source",
        ranking_score=65.0,
        **base_ge,
    )
    wes1 = SimpleNamespace(global_event_id=1, weekly_score=90.0, score_reasons={})
    wes2 = SimpleNamespace(global_event_id=2, weekly_score=85.0, score_reasons={})
    wes3 = SimpleNamespace(global_event_id=3, weekly_score=80.0, score_reasons={})
    wes4 = SimpleNamespace(global_event_id=4, weekly_score=75.0, score_reasons={})

    db = MagicMock()
    db.scalars.return_value.all.return_value = [wes1, wes2, wes3, wes4]

    def _get(model, pk):
        return {1: ge1, 2: ge2, 3: ge3, 4: ge4}.get(pk)

    db.get.side_effect = _get

    client = MagicMock()
    client.is_configured.return_value = True
    client.complete_json.return_value = {"selected_event_ids": [2, 4, 1]}

    fake_rows = [
        {"event_id": 2, "title": "乙"},
        {"event_id": 4, "title": "丁"},
        {"event_id": 1, "title": "甲"},
    ]
    with patch(
        "app.services.weekly_event_score_service.build_normal_top3_payload_rows_for_event_ids",
        return_value=fake_rows,
    ):
        rows, audit = resolve_global_weekly_top3_rows(
            db,
            period,
            [ge1, ge2, ge3, ge4],
            client=client,
            enable_llm=True,
            limit=3,
        )
    assert audit["method"] == "llm_with_score_backfill"
    assert audit["final_event_ids"] == [2, 4, 1]
    assert rows == fake_rows
