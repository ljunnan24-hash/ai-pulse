"""
确定性排行榜评分（0–100）。MVP：分量加权求 ranking_score，列表查询时再套时间衰减。
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Literal

RangeKey = Literal["today", "7d", "30d"]


def trust_from_source_type(source_type: str) -> float:
    st = (source_type or "").lower().strip()
    if st in ("official",):
        return 92.0
    if st in ("media",):
        return 78.0
    if st == "github":
        return 72.0
    if st in ("rss",):
        return 68.0
    if st in ("community", "social"):
        return 58.0
    return 65.0


def freshness_from_published(published_at: datetime | None, *, now: datetime | None = None) -> float:
    """距发布时间越近越高；无发布时间则中等分。"""
    if published_at is None:
        return 55.0
    now = now or datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    hours = max(0.0, (now - published_at).total_seconds() / 3600.0)
    # 24h 内满分倾向，10 天后趋近 15
    return float(max(15.0, 100.0 - min(hours, 240.0) * 0.35))


def heat_normalized(heat_score: int, *, cap: int = 1200) -> float:
    h = max(0, int(heat_score or 0))
    return float(min(100.0, (h / float(cap)) * 100.0))


def user_value_from_raw_score(score_total: int) -> float:
    # raw_items.score_total 典型 ~0–几百；压到 0–100
    s = max(0, int(score_total or 0))
    return float(min(100.0, 35.0 + math.sqrt(min(s, 400)) * 3.25))


def source_count_component(source_count: int) -> float:
    """
    映射到 0–100，多源增益递减；对应加权后贡献封顶意图由总分权重控制。
    """
    c = max(1, int(source_count or 1))
    # 1->45 2->70 3->85 4->92 5+->min(100, ...)
    base = 40.0 + 15.0 * min(c - 1, 4)
    return float(min(100.0, base + max(0, c - 5) * 2.0))


def compute_ranking_score(
    *,
    trust_score: float,
    freshness_score: float,
    heat_score_norm: float,
    source_count_score: float,
    user_value_score: float,
) -> float:
    total = (
        float(trust_score) * 0.30
        + float(freshness_score) * 0.25
        + float(heat_score_norm) * 0.20
        + float(source_count_score) * 0.15
        + float(user_value_score) * 0.10
    )
    return float(max(0.0, min(100.0, total)))


def decay_multiplier_for_range(
    published_at: datetime | None,
    range_key: RangeKey,
    *,
    now: datetime | None = None,
) -> float:
    """
    在存储的 ranking_score 基础上再乘衰减因子（列表接口使用）。
    """
    if published_at is None:
        return 1.0
    now = now or datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age = now - published_at

    if range_key == "today":
        if age <= timedelta(hours=24):
            return 1.0
        over = (age - timedelta(hours=24)).total_seconds() / 3600.0
        return float(max(0.35, 1.0 - min(over, 120.0) * 0.008))

    if range_key == "7d":
        if age <= timedelta(hours=72):
            return 1.0
        over_h = (age - timedelta(hours=72)).total_seconds() / 3600.0
        return float(max(0.4, 1.0 - min(over_h, 200.0) * 0.004))

    # 30d：按天轻度衰减
    days = age.total_seconds() / 86400.0
    return float(max(0.3, 1.0 - min(days, 30.0) * 0.018))


def effective_ranking_score(
    base_ranking: float,
    published_at: datetime | None,
    range_key: RangeKey,
    *,
    now: datetime | None = None,
) -> float:
    m = decay_multiplier_for_range(published_at, range_key, now=now)
    return float(max(0.0, min(100.0, base_ranking * m)))
