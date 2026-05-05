"""
将已定稿的 PRD v3 周报发布到 weekly_reports；对外 weekly_url 仍为 /weekly/:date（SPA）；可选 HTML 版 GET /weekly-html/:date。
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import WeeklyReport


def weekly_report_public_url(report_date: date, *, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    base = s.weekly_public_base_url.rstrip("/")
    return f"{base}/weekly/{report_date.isoformat()}"


def weekly_main_link_prefix(*, settings: Settings | None = None) -> str:
    """邮件 main_link 必须与此前缀匹配（同一公开域名 + /weekly/）。"""
    s = settings or get_settings()
    return f"{s.weekly_public_base_url.rstrip('/')}/weekly/"


def _prd_for_storage(payload_v3: dict[str, Any]) -> dict[str, Any]:
    """入库周报页：保留渲染所需 PRD 字段与 weekly_url，不含 email_payload。"""
    out: dict[str, Any] = {}
    for k in ("simple", "normal", "glossary"):
        if k in payload_v3:
            out[k] = payload_v3[k]
    if isinstance(payload_v3.get("weekly_url"), str) and payload_v3["weekly_url"].strip():
        out["weekly_url"] = payload_v3["weekly_url"].strip()
    return out


def publish_weekly_report(
    db: Session,
    payload_v3: dict[str, Any],
    report_date: date,
    *,
    title: str | None = None,
    settings: Settings | None = None,
) -> str:
    """
    Upsert weekly_reports（同日覆盖），返回对外 weekly_url。
    """
    s = settings or get_settings()
    weekly_url = weekly_report_public_url(report_date, settings=s)
    slug = report_date.isoformat()
    ttl = (title or "").strip() or f"AI Pulse 周报 · {slug}"

    store = _prd_for_storage(payload_v3)
    store["weekly_url"] = weekly_url
    blob = json.dumps(store, ensure_ascii=False)

    now = datetime.now(timezone.utc)
    row = db.execute(select(WeeklyReport).where(WeeklyReport.report_date == report_date)).scalar_one_or_none()
    if row is None:
        db.add(
            WeeklyReport(
                report_date=report_date,
                slug=slug,
                title=ttl,
                payload_json=blob,
                html_content=None,
                status="published",
                published_at=now,
            )
        )
    else:
        row.slug = slug
        row.title = ttl
        row.payload_json = blob
        row.status = "published"
        row.updated_at = now
        row.published_at = now

    db.flush()
    return weekly_url
