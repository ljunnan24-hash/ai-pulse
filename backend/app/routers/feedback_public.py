"""用户建议反馈 POST /api/feedback（公开，限流 + 清洗）。"""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserFeedback
from app.services.site_identity import enforce_sliding_limit, ip_hash_from_request

router = APIRouter(prefix="/api", tags=["feedback"])
logger = logging.getLogger("uvicorn.error")

_WS = re.compile(r"\s+")


class FeedbackIn(BaseModel):
    content: str = Field(min_length=5, max_length=1000)
    contact: str | None = Field(default=None, max_length=120)
    source_page: str | None = Field(default=None, max_length=512)
    visitor_id: str | None = Field(default=None, max_length=40)


def _clean(s: str, max_len: int) -> str:
    t = _WS.sub(" ", (s or "").strip())
    return t[:max_len]


@router.post("/feedback")
def post_feedback(
    body: FeedbackIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ip_h = ip_hash_from_request(request)
    vid = (body.visitor_id or "").strip()[:40] if body.visitor_id else ""
    rate_key = f"{ip_h}:{vid}" if vid else ip_h
    enforce_sliding_limit(
        rate_key,
        bucket="fb",
        max_events=4,
        window_sec=600.0,
        detail="提交过于频繁，请稍后再试。",
    )

    content = _clean(body.content, 1000)
    contact = _clean(body.contact or "", 120) or None
    src = _clean(body.source_page or "", 512) or None
    if len(content) < 5:
        raise HTTPException(status_code=422, detail="建议内容至少 5 个字")

    ua = (request.headers.get("user-agent") or "")[:512]

    try:
        db.add(
            UserFeedback(
                content=content,
                contact=contact,
                source_page=src,
                status="new",
                user_agent=ua or None,
                ip_hash=ip_h,
                visitor_id=(vid or None),
            )
        )
        db.commit()
    except Exception as exc:
        logger.exception("feedback insert failed: %s", exc)
        db.rollback()
        raise HTTPException(status_code=503, detail="暂时无法保存，请稍后重试。") from exc

    return {"ok": True}
