"""后台：访问统计与用户反馈（依赖 admin JWT）。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnalyticsPageView, AnalyticsRankingEvent, UserFeedback
from app.routers.admin import require_admin
from app.timeutil import BEIJING, now_beijing

router = APIRouter(tags=["admin-site"])


def _shanghai_midnight_utc(days_before_today: int) -> datetime:
    """北京时间「今日」往前推若干天的 0 点，转 UTC。"""
    n = now_beijing().replace(hour=0, minute=0, second=0, microsecond=0)
    start_local = n - timedelta(days=days_before_today)
    return start_local.astimezone(timezone.utc)


def _pv_uv_since(db: Session, since: datetime) -> tuple[int, int]:
    pv = db.scalar(
        select(func.count(AnalyticsPageView.id))
        .select_from(AnalyticsPageView)
        .where(AnalyticsPageView.created_at >= since)
    )
    uv = db.scalar(
        select(func.count(func.distinct(AnalyticsPageView.visitor_id))).where(
            AnalyticsPageView.created_at >= since
        )
    )
    return int(pv or 0), int(uv or 0)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _daily_traffic(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    today = now_beijing().date()
    start_day = today - timedelta(days=days - 1)
    start_utc = _shanghai_midnight_utc(days - 1)
    raw_rows = db.execute(
        select(AnalyticsPageView.created_at, AnalyticsPageView.visitor_id).where(
            AnalyticsPageView.created_at >= start_utc
        )
    ).all()

    buckets: dict[str, dict[str, Any]] = {}
    for i in range(days):
        d = start_day + timedelta(days=i)
        buckets[d.isoformat()] = {"date": d.isoformat(), "pv": 0, "visitors": set()}

    for created_at, visitor_id in raw_rows:
        if created_at is None:
            continue
        local_day = _to_utc(created_at).astimezone(BEIJING).date()
        if local_day < start_day or local_day > today:
            continue
        key = local_day.isoformat()
        bucket = buckets.get(key)
        if bucket is None:
            continue
        bucket["pv"] += 1
        if visitor_id:
            bucket["visitors"].add(str(visitor_id))

    return [
        {"date": key, "pv": int(bucket["pv"]), "dau": len(bucket["visitors"])}
        for key, bucket in buckets.items()
    ]


@router.get("/analytics/summary")
def admin_analytics_summary(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    today_start = _shanghai_midnight_utc(0)
    d7_start = _shanghai_midnight_utc(6)
    d30_start = _shanghai_midnight_utc(29)

    t_pv, t_uv = _pv_uv_since(db, today_start)
    w7_pv, w7_uv = _pv_uv_since(db, d7_start)
    w30_pv, w30_uv = _pv_uv_since(db, d30_start)

    pv_c = func.count(AnalyticsPageView.id).label("pv")
    uv_c = func.count(func.distinct(AnalyticsPageView.visitor_id)).label("uv")
    top_stmt = (
        select(AnalyticsPageView.path, pv_c, uv_c)
        .where(AnalyticsPageView.created_at >= d7_start)
        .group_by(AnalyticsPageView.path)
        .order_by(desc(pv_c))
        .limit(10)
    )
    rows = db.execute(top_stmt).all()
    top_pages = [{"path": r[0], "pv": int(r[1]), "uv": int(r[2])} for r in rows]
    daily_traffic = _daily_traffic(db, days=30)

    return {
        "timezone_note": "统计按 Asia/Shanghai 自然日窗口聚合。DAU = 当天去重 visitor_id 数。",
        "today": {"pv": t_pv, "uv": t_uv, "dau": t_uv},
        "last_7_days": {"pv": w7_pv, "uv": w7_uv},
        "last_30_days": {"pv": w30_pv, "uv": w30_uv},
        "daily_traffic": daily_traffic,
        "top_pages": top_pages,
    }


@router.get("/analytics/pageviews")
def admin_analytics_pageviews(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    stmt = (
        select(AnalyticsPageView)
        .order_by(desc(AnalyticsPageView.created_at))
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    items = [
        {
            "id": r.id,
            "visitor_id": r.visitor_id,
            "session_id": r.session_id,
            "path": r.path,
            "referrer": r.referrer,
            "user_agent": r.user_agent,
            "ip_hash": r.ip_hash,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return {"items": items}


def _ctr(clicks: int, impressions: int) -> float:
    if impressions <= 0:
        return 0.0
    return round((clicks / impressions) * 100, 2)


@router.get("/analytics/ranking-interest")
def admin_analytics_ranking_interest(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    since = _shanghai_midnight_utc(days - 1)
    clicks_c = func.sum(case((AnalyticsRankingEvent.action == "click", 1), else_=0)).label("clicks")
    impressions_c = func.sum(case((AnalyticsRankingEvent.action == "impression", 1), else_=0)).label("impressions")
    click_uv_c = func.count(
        func.distinct(case((AnalyticsRankingEvent.action == "click", AnalyticsRankingEvent.visitor_id), else_=None))
    ).label("click_uv")

    event_rows = db.execute(
        select(
            AnalyticsRankingEvent.event_id,
            AnalyticsRankingEvent.title_snapshot,
            AnalyticsRankingEvent.category,
            AnalyticsRankingEvent.source_label,
            AnalyticsRankingEvent.source_type,
            clicks_c,
            impressions_c,
            click_uv_c,
            func.min(AnalyticsRankingEvent.rank_position).label("best_rank"),
            func.max(AnalyticsRankingEvent.created_at).label("last_seen_at"),
        )
        .where(AnalyticsRankingEvent.created_at >= since)
        .group_by(
            AnalyticsRankingEvent.event_id,
            AnalyticsRankingEvent.title_snapshot,
            AnalyticsRankingEvent.category,
            AnalyticsRankingEvent.source_label,
            AnalyticsRankingEvent.source_type,
        )
        .order_by(desc(clicks_c), desc(impressions_c))
        .limit(limit)
    ).all()

    top_events = []
    for r in event_rows:
        clicks = int(r.clicks or 0)
        impressions = int(r.impressions or 0)
        top_events.append(
            {
                "event_id": int(r.event_id) if r.event_id is not None else None,
                "title": r.title_snapshot or "",
                "category": r.category,
                "source_label": r.source_label,
                "source_type": r.source_type,
                "clicks": clicks,
                "impressions": impressions,
                "ctr": _ctr(clicks, impressions),
                "click_uv": int(r.click_uv or 0),
                "best_rank": int(r.best_rank) if r.best_rank is not None else None,
                "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            }
        )

    source_rows = db.execute(
        select(
            AnalyticsRankingEvent.source_label,
            AnalyticsRankingEvent.source_type,
            clicks_c,
            impressions_c,
            click_uv_c,
            func.count(func.distinct(AnalyticsRankingEvent.event_id)).label("event_count"),
        )
        .where(AnalyticsRankingEvent.created_at >= since)
        .where(AnalyticsRankingEvent.source_label.isnot(None))
        .group_by(AnalyticsRankingEvent.source_label, AnalyticsRankingEvent.source_type)
        .order_by(desc(clicks_c), desc(impressions_c))
        .limit(limit)
    ).all()

    top_sources = []
    for r in source_rows:
        clicks = int(r.clicks or 0)
        impressions = int(r.impressions or 0)
        top_sources.append(
            {
                "source_label": r.source_label or "",
                "source_type": r.source_type,
                "clicks": clicks,
                "impressions": impressions,
                "ctr": _ctr(clicks, impressions),
                "click_uv": int(r.click_uv or 0),
                "event_count": int(r.event_count or 0),
            }
        )

    recent_click_rows = db.scalars(
        select(AnalyticsRankingEvent)
        .where(AnalyticsRankingEvent.created_at >= since, AnalyticsRankingEvent.action == "click")
        .order_by(desc(AnalyticsRankingEvent.created_at))
        .limit(30)
    ).all()
    recent_clicks = [
        {
            "id": r.id,
            "event_id": r.event_id,
            "title": r.title_snapshot,
            "source_label": r.source_label,
            "surface": r.surface,
            "range_key": r.range_key,
            "rank_position": r.rank_position,
            "path": r.path,
            "target_url": r.target_url,
            "visitor_id": r.visitor_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in recent_click_rows
    ]

    return {
        "days": days,
        "since": since.isoformat(),
        "top_events": top_events,
        "top_sources": top_sources,
        "recent_clicks": recent_clicks,
    }


class FeedbackPatchIn(BaseModel):
    status: str | None = Field(default=None, max_length=16)
    admin_note: str | None = Field(default=None, max_length=8000)


_ALLOWED_STATUSES = frozenset({"new", "reviewed", "archived"})


@router.get("/feedback")
def admin_feedback_list(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    q = select(UserFeedback).order_by(desc(UserFeedback.created_at))
    if status:
        q = q.where(UserFeedback.status == status)
    rows = db.scalars(q.offset(offset).limit(limit)).all()
    items = [
        {
            "id": r.id,
            "content": r.content,
            "contact": r.contact,
            "source_page": r.source_page,
            "status": r.status,
            "admin_note": r.admin_note,
            "user_agent": r.user_agent,
            "ip_hash": r.ip_hash,
            "visitor_id": r.visitor_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]
    return {"items": items, "total_returned": len(items)}


@router.patch("/feedback/{feedback_id}")
def admin_feedback_patch(
    feedback_id: int,
    body: FeedbackPatchIn,
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    fb = db.get(UserFeedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Not found")

    if body.status is not None:
        if body.status not in _ALLOWED_STATUSES:
            raise HTTPException(status_code=422, detail="invalid status")
        fb.status = body.status
    if body.admin_note is not None:
        fb.admin_note = body.admin_note.strip()[:8000] or None

    db.commit()
    db.refresh(fb)
    return {
        "id": fb.id,
        "status": fb.status,
        "admin_note": fb.admin_note,
        "updated_at": fb.updated_at.isoformat() if fb.updated_at else None,
    }
