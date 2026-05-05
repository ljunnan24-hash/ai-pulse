"""周报 JSON API（供 SPA）；HTML 旧版见 GET /weekly-html/:date。"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WeeklyReport

router = APIRouter(prefix="/api", tags=["weekly-json"])


def _payload_obj(row: WeeklyReport) -> dict[str, Any]:
    try:
        d = json.loads(row.payload_json or "{}")
        return d if isinstance(d, dict) else {}
    except json.JSONDecodeError:
        return {}


@router.get("/weekly/latest")
def weekly_latest(db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.scalars(
        select(WeeklyReport)
        .where(WeeklyReport.status == "published")
        .order_by(desc(WeeklyReport.report_date))
        .limit(1)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No weekly report")
    pl = _payload_obj(row)
    wurl = str(pl.get("weekly_url") or "").strip()
    return {
        "report_date": row.report_date.isoformat(),
        "title": row.title,
        "weekly_url": wurl,
        "payload": pl,
    }


@router.get("/weekly/{report_date}")
def weekly_by_date(report_date: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        d = date.fromisoformat(report_date)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid date")
    row = db.scalars(select(WeeklyReport).where(WeeklyReport.report_date == d)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    pl = _payload_obj(row)
    return {
        "report_date": row.report_date.isoformat(),
        "title": row.title,
        "weekly_url": str(pl.get("weekly_url") or "").strip(),
        "payload": pl,
    }


@router.get("/archive")
def weekly_archive(limit: int = 52, db: Session = Depends(get_db)) -> dict[str, Any]:
    lim = max(1, min(limit, 100))
    rows = db.scalars(
        select(WeeklyReport)
        .where(WeeklyReport.status == "published")
        .order_by(desc(WeeklyReport.report_date))
        .limit(lim)
    ).all()
    items: list[dict[str, Any]] = []
    for r in rows:
        pl = _payload_obj(r)
        items.append(
            {
                "report_date": r.report_date.isoformat(),
                "title": r.title,
                "weekly_url": str(pl.get("weekly_url") or "").strip(),
            }
        )
    return {"items": items}
