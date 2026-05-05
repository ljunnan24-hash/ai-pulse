"""服务端渲染的公开周报 HTML：GET /weekly-html/:date（/weekly/* 交给前端 SPA + /api/weekly/* JSON）。"""

from __future__ import annotations

import json
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import WeeklyClickLog, WeeklyReport
from app.services.digest_builder import render_weekly_public_page
from app.services.tracking_tokens import sign_tracking_payload, verify_tracking_token

router = APIRouter(tags=["weekly"])


@router.get("/weekly-html/{report_date}", response_class=HTMLResponse)
def weekly_report_public(
    report_date: str,
    request: Request,
    db: Session = Depends(get_db),
    t: str | None = None,
) -> HTMLResponse:
    try:
        d = date.fromisoformat(report_date)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    row = db.execute(select(WeeklyReport).where(WeeklyReport.report_date == d)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        payload = json.loads(row.payload_json or "{}")
    except json.JSONDecodeError:
        payload = {}

    settings = get_settings()
    secret = (settings.tracking_hmac_secret or "").strip()
    ua = (request.headers.get("user-agent") or "")[:512]

    top3_link_wrap = None
    if t and secret:
        page_p = verify_tracking_token(t, secret)
        if page_p and page_p.get("evt") == "page":
            try:
                rd_raw = page_p.get("rd")
                rd_date = date.fromisoformat(str(rd_raw)) if rd_raw else None
            except Exception:
                rd_date = d
            db.add(
                WeeklyClickLog(
                    subscriber_id=int(page_p["sub"]) if page_p.get("sub") is not None else None,
                    weekly_issue_id=int(page_p["iss"]) if page_p.get("iss") is not None else None,
                    report_date=rd_date,
                    event_type="page_view",
                    click_target=None,
                    top3_slot=None,
                    dest_url=None,
                    user_agent=ua or None,
                )
            )
            db.commit()

            exp = int(page_p.get("exp") or 0)
            base = settings.public_app_url.rstrip("/")

            def _wrap(url: str, slot: int) -> str:
                u = (url or "").strip()
                if not u:
                    return u
                tok = sign_tracking_payload(
                    {
                        "v": 1,
                        "evt": "click",
                        "kind": "top3",
                        "sub": page_p.get("sub"),
                        "iss": page_p.get("iss"),
                        "rd": page_p.get("rd"),
                        "slot": slot,
                        "dest": u,
                        "exp": exp,
                    },
                    secret,
                )
                return f"{base}/api/track/go?t={quote(tok, safe='')}"

            top3_link_wrap = _wrap

    html = render_weekly_public_page(payload, page_heading=row.title or None, top3_link_wrap=top3_link_wrap)
    return HTMLResponse(html)
