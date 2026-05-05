"""邮件打开像素、点击重定向；写入 weekly_click_logs。"""

from __future__ import annotations

import base64
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import WeeklyClickLog
from app.services.publish_weekly_page import weekly_main_link_prefix
from app.services.tracking_tokens import sign_tracking_payload, verify_tracking_token

router = APIRouter(prefix="/api/track", tags=["tracking"])

# 1×1 透明 GIF
_GIF_1X1 = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")


def _safe_http_dest(dest: str) -> bool:
    d = (dest or "").strip()
    return d.startswith("https://") or d.startswith("http://")


def _weekly_prefix_ok(dest: str, settings) -> bool:
    pfx = weekly_main_link_prefix(settings=settings)
    return dest.strip().startswith(pfx)


def _append_t_param(dest: str, token: str) -> str:
    sep = "&" if "?" in dest else "?"
    return f"{dest}{sep}t={quote(token, safe='')}"


@router.get("/open.gif")
def track_open(request: Request, t: str, db: Session = Depends(get_db)) -> Response:
    settings = get_settings()
    secret = (settings.tracking_hmac_secret or "").strip()
    ua = (request.headers.get("user-agent") or "")[:512]

    if secret:
        p = verify_tracking_token(t, secret)
        if p and p.get("evt") == "open":
            try:
                rd = p.get("rd")
                rd_date = date.fromisoformat(str(rd)) if rd else None
            except Exception:
                rd_date = None
            db.add(
                WeeklyClickLog(
                    subscriber_id=int(p["sub"]) if p.get("sub") is not None else None,
                    weekly_issue_id=int(p["iss"]) if p.get("iss") is not None else None,
                    report_date=rd_date,
                    event_type="open",
                    click_target=None,
                    top3_slot=None,
                    dest_url=None,
                    user_agent=ua or None,
                )
            )
            db.commit()

    return Response(content=_GIF_1X1, media_type="image/gif")


@router.get("/go")
def track_go(request: Request, t: str, db: Session = Depends(get_db)) -> RedirectResponse:
    settings = get_settings()
    secret = (settings.tracking_hmac_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=404, detail="Not found")

    p = verify_tracking_token(t, secret)
    if not p or p.get("evt") != "click":
        raise HTTPException(status_code=404, detail="Not found")

    dest = str(p.get("dest") or "").strip()
    if not _safe_http_dest(dest):
        raise HTTPException(status_code=400, detail="bad dest")

    kind = str(p.get("kind") or "")
    if kind == "weekly_main":
        if not _weekly_prefix_ok(dest, settings):
            raise HTTPException(status_code=400, detail="bad dest")
    elif kind == "top3":
        if not dest.lower().startswith("https:"):
            raise HTTPException(status_code=400, detail="bad dest")
    else:
        raise HTTPException(status_code=400, detail="bad kind")

    try:
        rd = p.get("rd")
        rd_date = date.fromisoformat(str(rd)) if rd else None
    except Exception:
        rd_date = None

    ua = (request.headers.get("user-agent") or "")[:512]
    slot = p.get("slot")
    top3_slot = int(slot) if slot is not None and str(slot).isdigit() else None

    db.add(
        WeeklyClickLog(
            subscriber_id=int(p["sub"]) if p.get("sub") is not None else None,
            weekly_issue_id=int(p["iss"]) if p.get("iss") is not None else None,
            report_date=rd_date,
            event_type="click",
            click_target="weekly_main" if kind == "weekly_main" else "top3",
            top3_slot=top3_slot,
            dest_url=dest[:2048],
            user_agent=ua or None,
        )
    )
    db.commit()

    if kind == "weekly_main":
        exp = int(p.get("exp") or 0)
        page_payload = {
            "v": 1,
            "evt": "page",
            "sub": int(p["sub"]) if p.get("sub") is not None else None,
            "iss": int(p["iss"]) if p.get("iss") is not None else None,
            "rd": p.get("rd"),
            "exp": exp,
        }
        pt = sign_tracking_payload(page_payload, secret)
        dest2 = _append_t_param(dest, pt)
        return RedirectResponse(dest2, status_code=302)

    return RedirectResponse(dest, status_code=302)
