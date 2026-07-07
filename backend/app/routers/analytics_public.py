"""匿名页面浏览埋点 POST /api/analytics/pageview（公开，限流）。"""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AnalyticsPageView, AnalyticsRankingEvent
from app.services.site_identity import allow_sliding, client_ip, hash_ip

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger("uvicorn.error")

_PATH_OK = re.compile(r"^/[A-Za-z0-9/_\-@.~%!*'()]*$")
_PATH_WITH_QUERY_OK = re.compile(r"^/[A-Za-z0-9/_\-@.~%!*'(),?=&:#]*$")
_ALLOWED_RANKING_ACTIONS = frozenset({"impression", "click"})


class PageviewIn(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=40)
    session_id: str | None = Field(default=None, max_length=40)
    path: str = Field(min_length=1, max_length=512)
    referrer: str | None = Field(default=None, max_length=1024)


class RankingEventItemIn(BaseModel):
    action: str = Field(min_length=3, max_length=24)
    event_id: int | None = Field(default=None, ge=1)
    event_key: str | None = Field(default=None, max_length=128)
    surface: str = Field(default="", max_length=64)
    range_key: str | None = Field(default=None, max_length=32)
    rank_position: int | None = Field(default=None, ge=1, le=500)
    category: str | None = Field(default=None, max_length=64)
    title: str = Field(default="", max_length=512)
    title_en: str | None = Field(default=None, max_length=512)
    source_label: str | None = Field(default=None, max_length=256)
    source_type: str | None = Field(default=None, max_length=32)
    path: str | None = Field(default=None, max_length=512)
    target_url: str | None = Field(default=None, max_length=1024)
    referrer: str | None = Field(default=None, max_length=1024)


class RankingEventsIn(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=40)
    session_id: str | None = Field(default=None, max_length=40)
    events: list[RankingEventItemIn] = Field(min_length=1, max_length=80)


def _sanitize_path(path: str) -> str | None:
    p = path.strip()
    if not p.startswith("/") or ".." in p or len(p) > 512:
        return None
    if not _PATH_OK.match(p):
        return None
    return p


def _sanitize_path_with_query(path: str | None) -> str | None:
    if not path:
        return None
    p = path.strip()
    if not p:
        return None
    if not p.startswith("/") or ".." in p or len(p) > 512:
        return None
    if not _PATH_WITH_QUERY_OK.match(p):
        return None
    return p


def _clean_optional_text(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    v = re.sub(r"\s+", " ", value).strip()
    return v[:limit] or None


@router.post("/pageview")
def post_pageview(
    body: PageviewIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    settings = get_settings()
    pepper = (getattr(settings, "analytics_ip_pepper", None) or settings.admin_jwt_secret or "aipulse-analytics").strip()
    ip = client_ip(request)
    ip_h = hash_ip(ip, pepper)

    if not allow_sliding(ip_h, bucket="pv", max_events=180, window_sec=300.0):
        return {"ok": True, "accepted": False, "reason": "rate_limited"}

    path = _sanitize_path(body.path)
    if path is None:
        return {"ok": True, "accepted": False, "reason": "invalid_path"}

    ua = (request.headers.get("user-agent") or "")[:512]
    ref = (body.referrer or "")[:1024] if body.referrer else None
    sid = (body.session_id or "")[:40] if body.session_id else None
    vid = body.visitor_id.strip()[:40]

    try:
        db.add(
            AnalyticsPageView(
                visitor_id=vid,
                session_id=sid,
                path=path,
                referrer=ref,
                user_agent=ua or None,
                ip_hash=ip_h,
            )
        )
        db.commit()
    except Exception as exc:
        logger.warning("analytics pageview insert failed: %s", exc)
        db.rollback()
        return {"ok": False, "accepted": False, "reason": "server"}

    return {"ok": True, "accepted": True}


@router.post("/ranking-events")
def post_ranking_events(
    body: RankingEventsIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    settings = get_settings()
    pepper = (getattr(settings, "analytics_ip_pepper", None) or settings.admin_jwt_secret or "aipulse-analytics").strip()
    ip = client_ip(request)
    ip_h = hash_ip(ip, pepper)

    if not allow_sliding(ip_h, bucket="ranking_events", max_events=360, window_sec=300.0):
        return {"ok": True, "accepted": False, "reason": "rate_limited", "inserted": 0}

    ua = (request.headers.get("user-agent") or "")[:512]
    sid = (body.session_id or "")[:40] if body.session_id else None
    vid = body.visitor_id.strip()[:40]

    rows: list[AnalyticsRankingEvent] = []
    rejected = 0
    for ev in body.events:
        action = ev.action.strip().lower()
        if action not in _ALLOWED_RANKING_ACTIONS:
            rejected += 1
            continue
        title = _clean_optional_text(ev.title, 512) or ""
        if not title and ev.event_id is None and not ev.event_key:
            rejected += 1
            continue
        rows.append(
            AnalyticsRankingEvent(
                visitor_id=vid,
                session_id=sid,
                action=action,
                event_id=ev.event_id,
                event_key=_clean_optional_text(ev.event_key, 128),
                surface=_clean_optional_text(ev.surface, 64) or "",
                range_key=_clean_optional_text(ev.range_key, 32),
                rank_position=ev.rank_position,
                category=_clean_optional_text(ev.category, 64),
                title_snapshot=title,
                title_en_snapshot=_clean_optional_text(ev.title_en, 512),
                source_label=_clean_optional_text(ev.source_label, 256),
                source_type=_clean_optional_text(ev.source_type, 32),
                path=_sanitize_path_with_query(ev.path),
                target_url=_clean_optional_text(ev.target_url, 1024),
                referrer=_clean_optional_text(ev.referrer, 1024),
                user_agent=ua or None,
                ip_hash=ip_h,
            )
        )

    if not rows:
        return {"ok": True, "accepted": False, "reason": "empty", "inserted": 0, "rejected": rejected}

    try:
        db.add_all(rows)
        db.commit()
    except Exception as exc:
        logger.warning("analytics ranking event insert failed: %s", exc)
        db.rollback()
        return {"ok": False, "accepted": False, "reason": "server", "inserted": 0, "rejected": rejected}

    return {"ok": True, "accepted": True, "inserted": len(rows), "rejected": rejected}
