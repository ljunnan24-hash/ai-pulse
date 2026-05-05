"""确定性评分公式冒烟测试。"""

from datetime import datetime, timedelta, timezone

from app.services.ranking_score import (
    compute_ranking_score,
    decay_multiplier_for_range,
    effective_ranking_score,
    freshness_from_published,
    source_count_component,
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
