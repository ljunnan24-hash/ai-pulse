"""公开排行榜与事件详情 API。"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GlobalEvent
from app.utils.time_windows import get_yesterday_window_utc
from app.services.global_event_service import (
    batch_primary_source_labels,
    build_deduped_sources_for_api,
    fallback_primary_source_label,
)
from app.services.rankings_search_utils import (
    industry_tags_from_metrics,
    normalize_rankings_q,
    sql_like_pattern,
)
from app.services.ranking_insight_service import CAPABILITY_KEYS, resolve_one_liner_for_api
from app.services.ranking_score import (
    RangeKey,
    effective_ranking_score_for_event,
    stable_pulse_score_for_global_event,
)

router = APIRouter(prefix="/api", tags=["rankings"])


def _range_delta(range_key: str) -> timedelta:
    if range_key == "today":
        return timedelta(days=1)
    if range_key == "7d":
        return timedelta(days=7)
    return timedelta(days=30)


def _parse_range(range_key: str) -> RangeKey:
    if range_key in ("today", "7d", "30d"):
        return range_key  # type: ignore[return-value]
    return "today"


@router.get("/rankings")
def list_rankings(
    range: str = "today",
    category: str = "all",
    search_q: str | None = Query(None, alias="q"),
    limit: int = 20,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    rk = _parse_range(range)
    now = datetime.now(timezone.utc)
    q_term = normalize_rankings_q(search_q)

    stmt = select(GlobalEvent).where(GlobalEvent.status == "active")
    if rk == "today":
        start_utc, end_utc, _target_date = get_yesterday_window_utc("Asia/Shanghai")
        stmt = stmt.where(
            GlobalEvent.published_at.isnot(None),
            GlobalEvent.published_at >= start_utc,
            GlobalEvent.published_at < end_utc,
        )
    else:
        delta = _range_delta(rk)
        cutoff = now - delta
        stmt = stmt.where(or_(GlobalEvent.published_at >= cutoff, GlobalEvent.last_seen_at >= cutoff))
    if category and category != "all":
        stmt = stmt.where(GlobalEvent.category == category)

    if q_term:
        pat = sql_like_pattern(q_term)
        esc = "\\"
        stmt = stmt.where(
            or_(
                GlobalEvent.canonical_title.like(pat, escape=esc),
                GlobalEvent.title_zh.like(pat, escape=esc),
                GlobalEvent.summary.like(pat, escape=esc),
                GlobalEvent.canonical_url.like(pat, escape=esc),
                GlobalEvent.metrics_json.like(pat, escape=esc),
                GlobalEvent.sources_json.like(pat, escape=esc),
                GlobalEvent.category.like(pat, escape=esc),
            )
        )

    rows = db.scalars(stmt.limit(800)).all()

    def _sort_ts(ge: GlobalEvent) -> datetime:
        """同分 tiebreak：7d/30d 用最近活跃，today 用首发日。"""
        t = ge.last_seen_at if use_effective_sort else ge.published_at
        if t is None:
            t = ge.published_at if use_effective_sort else ge.last_seen_at
        if t is None:
            t = now
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return t

    use_effective_sort = rk in ("7d", "30d")

    scored_rows: list[tuple[float, datetime, int, float, GlobalEvent]] = []
    for ge in rows:
        pulse = stable_pulse_score_for_global_event(ge)
        sort_score = (
            effective_ranking_score_for_event(ge, pulse, rk, now=now)
            if use_effective_sort
            else pulse
        )
        scored_rows.append((sort_score, _sort_ts(ge), int(ge.source_count or 0), pulse, ge))

    scored_rows.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    scored_rows = scored_rows[: max(1, min(limit, 50))]

    source_labels = batch_primary_source_labels(db, [ge.id for _, _, _, _, ge in scored_rows])

    items: list[dict[str, Any]] = []
    for _sort_score, _ts, _sc, pulse, ge in scored_rows:
        stored = float(ge.ranking_score or 0)
        eff = effective_ranking_score_for_event(ge, pulse, rk, now=now)
        delta_score = 0.0
        try:
            m = json.loads(ge.metrics_json or "{}")
            if isinstance(m, dict):
                delta_score = float(m.get("ranking_score") or 0) - float(m.get("prev_ranking_score") or 0)
        except Exception:
            delta_score = 0.0
        pulse_r = round(pulse, 2)
        items.append(
            {
                "id": ge.id,
                "title": ge.canonical_title,
                "title_zh": (ge.title_zh or "").strip(),
                "url": ge.canonical_url,
                "category": ge.category,
                "source_type": ge.source_type,
                "primary_source_name": source_labels.get(int(ge.id))
                or fallback_primary_source_label(ge),
                "source_count": ge.source_count,
                "published_at": ge.published_at.isoformat() if ge.published_at else None,
                "last_seen_at": ge.last_seen_at.isoformat() if ge.last_seen_at else None,
                "pulse_score": pulse_r,
                "ranking_score": pulse_r,
                "stored_ranking_score": round(stored, 2),
                "effective_ranking_score": round(eff, 2),
                "score_delta": round(delta_score, 2),
                "what_happened": ge.what_happened or "",
                "what_it_means_for_you": ge.what_it_means_for_you or "",
                "action_suggestion": ge.action_suggestion or "",
                "one_liner": resolve_one_liner_for_api(ge),
                "industry_tags": industry_tags_from_metrics(ge.metrics_json),
            }
        )

    return {
        "range": rk,
        "category": category or "all",
        "q": q_term,
        "updated_at": now.isoformat(),
        "sort_by": "effective_ranking_score" if use_effective_sort else "pulse_score",
        "items": items,
    }


@router.get("/events/{event_id}")
def get_event_detail(event_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    ge = db.get(GlobalEvent, event_id)
    if not ge or ge.status != "active":
        raise HTTPException(status_code=404, detail="Not found")

    now = datetime.now(timezone.utc)
    pulse = stable_pulse_score_for_global_event(ge)
    pulse_r = round(pulse, 2)
    stored_r = round(float(ge.ranking_score or 0), 2)
    eff_r = round(float(effective_ranking_score_for_event(ge, pulse, "7d", now=now)), 2)

    sources_out = build_deduped_sources_for_api(db, ge)

    breakdown: dict[str, float] = {}
    metrics: dict[str, Any] = {}
    try:
        parsed_metrics = json.loads(ge.metrics_json or "{}")
        if isinstance(parsed_metrics, dict):
            metrics = parsed_metrics
        sb = metrics.get("score_breakdown")
        if isinstance(sb, dict):
            breakdown = {
                "freshness": float(sb.get("freshness") or 0),
                "trust": float(sb.get("trust") or 0),
                "heat": float(sb.get("heat") or 0),
                "source_mix": float(sb.get("source_mix") or 0),
                "user_value": float(sb.get("user_value") or 0),
            }
    except Exception:
        breakdown = {}
    ri = metrics.get("ranking_insight")
    insight_ready = isinstance(ri, dict) and ri.get("applied") is True

    capability_tags: dict[str, float] = {k: 0.0 for k in CAPABILITY_KEYS}
    try:
        ct = json.loads(ge.capability_tags_json or "{}")
        if isinstance(ct, dict):
            for k in CAPABILITY_KEYS:
                if k not in ct:
                    continue
                try:
                    capability_tags[k] = float(max(0.0, min(1.0, float(ct[k]))))
                except (TypeError, ValueError):
                    pass
    except Exception:
        pass

    related_rows = db.scalars(
        select(GlobalEvent)
        .where(GlobalEvent.status == "active", GlobalEvent.category == ge.category, GlobalEvent.id != ge.id)
        .order_by(GlobalEvent.ranking_score.desc())
        .limit(12)
    ).all()
    related_scored: list[tuple[float, GlobalEvent]] = []
    for r in related_rows:
        rp = stable_pulse_score_for_global_event(r)
        related_scored.append((rp, r))
    related_scored.sort(key=lambda x: x[0], reverse=True)

    related_events = []
    for rp, r in related_scored[:4]:
        pr = round(float(rp), 2)
        related_events.append(
            {
                "id": r.id,
                "title": r.canonical_title,
                "title_zh": (r.title_zh or "").strip(),
                "pulse_score": pr,
                "ranking_score": pr,
                "stored_ranking_score": round(float(r.ranking_score or 0), 2),
                "category": r.category,
            }
        )

    return {
        "id": ge.id,
        "title": ge.canonical_title,
        "title_zh": (ge.title_zh or "").strip(),
        "category": ge.category,
        "published_at": ge.published_at.isoformat() if ge.published_at else None,
        "pulse_score": pulse_r,
        "ranking_score": pulse_r,
        "stored_ranking_score": stored_r,
        "effective_ranking_score": eff_r,
        "what_happened": ge.what_happened or "",
        "why_important": ge.why_important or "",
        "what_it_means_for_you": ge.what_it_means_for_you or "",
        "action_suggestion": ge.action_suggestion or "",
        "insight_ready": insight_ready,
        "capability_tags": capability_tags,
        "sources": sources_out,
        "score_breakdown": breakdown,
        "related_events": related_events,
        "industry_tags": industry_tags_from_metrics(ge.metrics_json),
    }
