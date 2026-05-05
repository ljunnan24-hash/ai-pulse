"""weekly_from_rankings_service：选题、配额、dict 转换（不依赖真实 MySQL）。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.weekly_from_rankings_service import (
    DEFAULT_CATEGORY_CAPS,
    global_events_to_orchestrator_dicts,
    select_with_category_caps,
)


def _ge(
    eid: int,
    *,
    category: str = "model",
    ranking_score: float = 70.0,
    last_days: float = 1.0,
    title: str = "Test title",
    url: str = "https://example.com/a",
    **extra: object,
) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    ls = now - timedelta(days=last_days)
    base = dict(
        id=eid,
        canonical_title=title,
        canonical_url=url,
        summary="Base summary.",
        category=category,
        ranking_score=ranking_score,
        source_count=2,
        what_happened="",
        why_important="",
        what_it_means_for_you="",
        action_suggestion="",
        last_seen_at=ls,
        published_at=ls,
        status="active",
    )
    base.update(extra)
    return SimpleNamespace(**base)


def test_global_events_to_orchestrator_dicts_has_insight_lines() -> None:
    ge = _ge(
        1,
        what_happened="WH",
        why_important="WI",
        what_it_means_for_you="WM",
        action_suggestion="先观望",
    )
    out = global_events_to_orchestrator_dicts([ge])
    assert len(out) == 1
    d = out[0]
    assert d["global_event_id"] == 1
    assert d["title"] == "Test title"
    assert d["link"] == "https://example.com/a"
    assert d["_score_total"] == 70
    assert "发生了什么：WH" in d["summary"]
    assert "为什么重要：WI" in d["summary"]
    assert "对你意味着什么：WM" in d["summary"]
    assert "建议：先观望" in d["summary"]


def test_global_events_to_orchestrator_dicts_empty_insight_ok() -> None:
    ge = _ge(2)
    out = global_events_to_orchestrator_dicts([ge])
    assert len(out) == 1
    assert "Base summary" in out[0]["summary"]


def test_category_caps_limits_then_relaxed() -> None:
    """model 配额用尽后二轮补齐。"""
    events = [
        _ge(1, category="model"),
        _ge(2, category="model"),
        _ge(3, category="model"),
        _ge(4, category="tool"),
    ]
    caps = dict(DEFAULT_CATEGORY_CAPS)
    caps["model"] = 1
    picked, relaxed = select_with_category_caps(events, caps=caps, limit=4)
    assert len(picked) == 4
    assert relaxed is True
    cats = [e.category for e in picked]
    assert cats.count("model") >= 2


def test_category_caps_sort_preserves_order_within_cap() -> None:
    events = [_ge(i, category="tool", ranking_score=80 - i) for i in range(1, 5)]
    picked, _ = select_with_category_caps(events, caps=DEFAULT_CATEGORY_CAPS, limit=4)
    assert [e.id for e in picked] == [1, 2, 3, 4]
