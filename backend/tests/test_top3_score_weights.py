"""calculate_top3_score 权重与 base fallback 确定性回归。"""

from __future__ import annotations

from app.services.top3_selector import (
    actionability_score_for_top3,
    calculate_top3_score,
    select_top3,
)


def _minimal_valid_ev(**kwargs: float | str) -> dict:
    base = {
        "event_id": "e_test",
        "title": "T",
        "url": "https://example.com/x",
        "category": "industry",
        "confidence": 0.9,
        "fact_status": "ok",
        "heat_score": 50,
        "freshness_score": 75,
        "source_trust_score": 70,
        "source_type": "media",
        "attention_level": "Medium",
        "user_value_score": 72,
        "actionability": "watch",
        "relevance_score": 60,
    }
    base.update(kwargs)
    return base


def test_base_score_fallback_ranking_without_score_total_case1():
    ev = _minimal_valid_ev(
        ranking_score=82.0,
        user_value_score=70,
        relevance_score=50,
        actionability="watch",
    )
    assert "score_total" not in ev
    assert calculate_top3_score(ev) == calculate_top3_score({**ev, "score_total": 82.0})


def test_high_ranking_low_uv_gate_and_ordering_case2():
    """相同基础重要性下，高 user_value 得分更高；UV 低于硬门槛则无法入选。"""
    high_rank_low_uv = _minimal_valid_ev(
        event_id="e_low_uv",
        title="Low UV",
        ranking_score=72,
        user_value_score=56,
        relevance_score=55,
        actionability="watch",
    )
    mid_rank_high_uv = _minimal_valid_ev(
        event_id="e_high_uv",
        title="High UV",
        ranking_score=72,
        user_value_score=88,
        relevance_score=60,
        actionability="watch",
    )
    assert calculate_top3_score(mid_rank_high_uv) > calculate_top3_score(high_rank_low_uv)

    gated = _minimal_valid_ev(
        event_id="e_gate",
        ranking_score=99,
        user_value_score=54,
    )
    picked = select_top3([gated, mid_rank_high_uv, high_rank_low_uv])
    ids = [p["event_id"] for p in picked]
    assert "e_gate" not in ids


def test_balanced_medium_rank_high_uv_rel_action_case3():
    balanced = _minimal_valid_ev(
        event_id="e_bal",
        ranking_score=52,
        user_value_score=92,
        relevance_score=92,
        actionability="now_try",
    )
    baseline = _minimal_valid_ev(
        event_id="e_base",
        ranking_score=52,
        user_value_score=72,
        relevance_score=60,
        actionability="watch",
    )
    assert calculate_top3_score(balanced) > calculate_top3_score(baseline)


def test_now_try_beats_watch_when_other_fields_equal_case4():
    a = _minimal_valid_ev(actionability="now_try", event_id="a")
    b = _minimal_valid_ev(actionability="watch", event_id="b")
    assert calculate_top3_score(a) > calculate_top3_score(b)


def test_missing_relevance_score_defaults_stable_case5():
    ev = _minimal_valid_ev()
    ev.pop("relevance_score", None)
    assert calculate_top3_score(ev) == calculate_top3_score({**_minimal_valid_ev(), "relevance_score": 0})


def test_actionability_score_mapping():
    assert actionability_score_for_top3({"actionability": "now_try"}) == 100.0
    assert actionability_score_for_top3({"actionability": "watch"}) == 70.0
    assert actionability_score_for_top3({"actionability": "ignore"}) == 35.0
    assert actionability_score_for_top3({"actionability": "not_for_general_user"}) == 0.0
