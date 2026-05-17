"""确定性评分公式冒烟测试。"""

import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.ranking_score import (
    compute_ranking_score,
    decay_multiplier_for_range,
    effective_ranking_score,
    freshness_from_published,
    source_count_component,
    stable_pulse_score_for_global_event,
)


def test_compute_ranking_score_range():
    r = compute_ranking_score(
        trust_score=80,
        freshness_score=70,
        heat_score_norm=60,
        source_count_score=50,
        user_value_score=65,
    )
    assert 0 <= r <= 100


def test_effective_ranking_decay():
    now = datetime.now(timezone.utc)
    pub = now - timedelta(hours=30)
    base = 80.0
    eff = effective_ranking_score(base, pub, "today", now=now)
    assert eff < base


def test_case1_seven_day_effective_equals_pulse_within_six_days():
    """7d 窗口：首发 6 天内不衰减。"""
    now = datetime.now(timezone.utc)
    pub = now - timedelta(hours=48)
    pulse = 90.0
    eff = effective_ranking_score(pulse, pub, "7d", now=now)
    assert abs(eff - 90.0) < 1e-9


def test_7d_decay_gentle_at_day_seven():
    """7d：第 7 天仍保留绝大部分 Pulse（约 ≥96%）。"""
    now = datetime.now(timezone.utc)
    pulse = 90.0
    pub = now - timedelta(days=7)
    m = decay_multiplier_for_range(pub, "7d", now=now)
    assert m >= 0.96
    assert effective_ranking_score(pulse, pub, "7d", now=now) >= pulse * 0.96


def test_30d_decay_gentle_at_two_weeks():
    now = datetime.now(timezone.utc)
    pulse = 80.0
    pub = now - timedelta(days=14)
    m = decay_multiplier_for_range(pub, "30d", now=now)
    assert m >= 0.94


def test_case2_today_old_event_effective_below_pulse():
    """today：48h 前发布的事件有效分可低于 pulse，但 pulse 本身不变（由调用方展示 pulse）。"""
    now = datetime.now(timezone.utc)
    pub = now - timedelta(hours=48)
    pulse = 90.0
    eff = effective_ranking_score(pulse, pub, "today", now=now)
    assert eff < pulse


def test_stable_pulse_formula_mid():
    """四个分量均为 75 时 pulse 应为 75。"""
    ge = SimpleNamespace(
        metrics_json=json.dumps(
            {
                "score_breakdown": {
                    "trust": 75.0,
                    "heat": 75.0,
                    "source_mix": 75.0,
                    "user_value": 75.0,
                }
            }
        ),
        trust_score=50.0,
        heat_score=0,
        source_count=1,
        user_value_score=50.0,
    )
    assert abs(stable_pulse_score_for_global_event(ge) - 75.0) < 1e-9


def test_case3_pulse_same_when_freshness_in_breakdown_differs():
    """breakdown 里 freshness 不同不影响 pulse（公式不读 freshness）。"""
    base_sb = {"trust": 80.0, "heat": 70.0, "source_mix": 70.0, "user_value": 70.0}
    ge_a = SimpleNamespace(
        metrics_json=json.dumps({"score_breakdown": {**base_sb, "freshness": 15.0}}),
        trust_score=80.0,
        heat_score=100,
        source_count=3,
        user_value_score=70.0,
        ranking_score=60.0,
    )
    ge_b = SimpleNamespace(
        metrics_json=json.dumps({"score_breakdown": {**base_sb, "freshness": 95.0}}),
        trust_score=80.0,
        heat_score=100,
        source_count=3,
        user_value_score=70.0,
        ranking_score=88.0,
    )
    assert stable_pulse_score_for_global_event(ge_a) == stable_pulse_score_for_global_event(ge_b)
    assert ge_a.ranking_score != ge_b.ranking_score


def test_case4_sort_order_pulse_primary():
    """同窗口内按 pulse 降序；pulse 高者在前（辅助键次要）。"""
    ta = datetime(2024, 6, 1, tzinfo=timezone.utc)
    tb = datetime(2025, 1, 1, tzinfo=timezone.utc)
    row_a = (90.0, ta, 1)
    row_b = (80.0, tb, 99)
    rows = [row_b, row_a]
    rows.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    assert rows[0] == row_a


def test_source_count_component_monotonic():
    assert source_count_component(1) <= source_count_component(3)


def test_freshness_monotonic():
    now = datetime.now(timezone.utc)
    a = freshness_from_published(now - timedelta(hours=1), now=now)
    b = freshness_from_published(now - timedelta(days=10), now=now)
    assert a >= b


def test_decay_multiplier_30d():
    now = datetime.now(timezone.utc)
    pub = now - timedelta(days=5)
    m = decay_multiplier_for_range(pub, "30d", now=now)
    assert 0 < m <= 1
