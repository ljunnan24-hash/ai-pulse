"""匿名页面浏览埋点 POST /api/analytics/pageview（公开，限流）。"""

from __future__ import annotations

import re
import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AnalyticsPageView
from app.services.site_identity import allow_sliding, client_ip, hash_ip

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger("uvicorn.error")

_PATH_OK = re.compile(r"^/[A-Za-z0-9/_\-@.~%!*'()]*$")


class PageviewIn(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=40)
    session_id: str | None = Field(default=None, max_length=40)
    path: str = Field(min_length=1, max_length=512)
    referrer: str | None = Field(default=None, max_length=1024)


def _sanitize_path(path: str) -> str | None:
    p = path.strip()
    if not p.startswith("/") or ".." in p or len(p) > 512:
        return None
    if not _PATH_OK.match(p):
        return None
    return p


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
