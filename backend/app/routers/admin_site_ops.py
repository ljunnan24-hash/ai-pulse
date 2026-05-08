"""后台：访问统计与用户反馈（依赖 admin JWT）。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnalyticsPageView, UserFeedback
from app.routers.admin import require_admin
from app.timeutil import now_beijing

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

    return {
        "timezone_note": "统计按 Asia/Shanghai 自然日窗口聚合（今日 / 近 7 天 / 近 30 天）。",
        "today": {"pv": t_pv, "uv": t_uv},
        "last_7_days": {"pv": w7_pv, "uv": w7_uv},
        "last_30_days": {"pv": w30_pv, "uv": w30_uv},
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
