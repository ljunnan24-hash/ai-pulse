"""公开排行榜与事件详情 API。"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GlobalEvent, GlobalEventSource
from app.services.ranking_insight_service import CAPABILITY_KEYS
from app.services.ranking_score import RangeKey, effective_ranking_score

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
    limit: int = 20,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    rk = _parse_range(range)
    delta = _range_delta(rk)
    now = datetime.now(timezone.utc)
    cutoff = now - delta

    q = select(GlobalEvent).where(GlobalEvent.status == "active")
    q = q.where(or_(GlobalEvent.published_at >= cutoff, GlobalEvent.last_seen_at >= cutoff))
    if category and category != "all":
        q = q.where(GlobalEvent.category == category)

    rows = db.scalars(q.limit(800)).all()
    scored: list[tuple[float, GlobalEvent]] = []
    for ge in rows:
        eff = effective_ranking_score(float(ge.ranking_score or 0), ge.published_at, rk, now=now)
        scored.append((eff, ge))
    scored.sort(key=lambda x: x[0], reverse=True)
    scored = scored[: max(1, min(limit, 100))]

    items: list[dict[str, Any]] = []
    for eff, ge in scored:
        delta_score = 0.0
        try:
            m = json.loads(ge.metrics_json or "{}")
            if isinstance(m, dict):
                delta_score = float(m.get("ranking_score") or 0) - float(m.get("prev_ranking_score") or 0)
        except Exception:
            delta_score = 0.0
        items.append(
            {
                "id": ge.id,
                "title": ge.canonical_title,
                "url": ge.canonical_url,
                "category": ge.category,
                "source_type": ge.source_type,
                "source_count": ge.source_count,
                "published_at": ge.published_at.isoformat() if ge.published_at else None,
                "ranking_score": round(eff, 2),
                "score_delta": round(delta_score, 2),
                "what_happened": ge.what_happened or "",
                "what_it_means_for_you": ge.what_it_means_for_you or "",
                "action_suggestion": ge.action_suggestion or "",
            }
        )

    return {
        "range": rk,
        "category": category or "all",
        "updated_at": now.isoformat(),
        "items": items,
    }


@router.get("/events/{event_id}")
def get_event_detail(event_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    ge = db.get(GlobalEvent, event_id)
    if not ge or ge.status != "active":
        raise HTTPException(status_code=404, detail="Not found")

    sources_out: list[dict[str, Any]] = []
    for ges in db.scalars(
        select(GlobalEventSource).where(GlobalEventSource.global_event_id == ge.id).order_by(GlobalEventSource.id.asc())
    ).all():
        sources_out.append(
            {
                "source_name": ges.source_name,
                "source_type": ges.source_type,
                "url": ges.url,
                "published_at": ges.published_at.isoformat() if ges.published_at else None,
                "raw_item_id": ges.raw_item_id,
            }
        )

    breakdown: dict[str, float] = {}
    try:
        m = json.loads(ge.metrics_json or "{}")
        sb = m.get("score_breakdown") if isinstance(m, dict) else None
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
        .limit(6)
    ).all()
    related_events = [
        {
            "id": r.id,
            "title": r.canonical_title,
            "ranking_score": round(float(r.ranking_score or 0), 2),
            "category": r.category,
        }
        for r in related_rows[:4]
    ]

    return {
        "id": ge.id,
        "title": ge.canonical_title,
        "category": ge.category,
        "published_at": ge.published_at.isoformat() if ge.published_at else None,
        "ranking_score": round(float(ge.ranking_score or 0), 2),
        "what_happened": ge.what_happened or "",
        "why_important": ge.why_important or "",
        "what_it_means_for_you": ge.what_it_means_for_you or "",
        "action_suggestion": ge.action_suggestion or "",
        "capability_tags": capability_tags,
        "sources": sources_out,
        "score_breakdown": breakdown,
        "related_events": related_events,
    }
