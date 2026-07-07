"""SEO discovery endpoints: robots.txt and sitemap.xml."""

from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import Iterable

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import GlobalEvent, WeeklyReport

router = APIRouter(tags=["seo"])


def _site_base() -> str:
    return (get_settings().weekly_public_base_url or get_settings().frontend_url or "https://www.aipulse.asia").rstrip("/")


def _iso_date(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).date().isoformat()
    try:
        return value.isoformat()  # type: ignore[attr-defined]
    except Exception:
        return None


def _url(loc: str, *, lastmod: str | None = None, changefreq: str | None = None, priority: str | None = None) -> str:
    lines = ["  <url>", f"    <loc>{escape(loc, quote=True)}</loc>"]
    if lastmod:
        lines.append(f"    <lastmod>{escape(lastmod)}</lastmod>")
    if changefreq:
        lines.append(f"    <changefreq>{escape(changefreq)}</changefreq>")
    if priority:
        lines.append(f"    <priority>{escape(priority)}</priority>")
    lines.append("  </url>")
    return "\n".join(lines)


def _xml(urls: Iterable[str]) -> str:
    body = "\n".join(urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'


@router.get("/robots.txt", response_class=PlainTextResponse)
def robots_txt() -> PlainTextResponse:
    base = _site_base()
    text = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "",
            "Disallow: /admin",
            "Disallow: /manage",
            "Disallow: /api/",
            "",
            f"Sitemap: {base}/sitemap.xml",
            "",
        ]
    )
    return PlainTextResponse(text)


@router.head("/robots.txt")
def robots_txt_head() -> Response:
    return Response(media_type="text/plain; charset=utf-8")


@router.get("/sitemap.xml")
def sitemap_xml(db: Session = Depends(get_db)) -> Response:
    base = _site_base()
    now_date = datetime.now(timezone.utc).date().isoformat()
    urls: list[str] = [
        _url(f"{base}/", lastmod=now_date, changefreq="daily", priority="1.0"),
        _url(f"{base}/rankings", lastmod=now_date, changefreq="daily", priority="0.9"),
        _url(f"{base}/weekly/latest", lastmod=now_date, changefreq="weekly", priority="0.8"),
        _url(f"{base}/archive", lastmod=now_date, changefreq="weekly", priority="0.7"),
        _url(f"{base}/about", changefreq="monthly", priority="0.5"),
        _url(f"{base}/subscribe", changefreq="monthly", priority="0.4"),
    ]

    weekly_rows = db.scalars(
        select(WeeklyReport)
        .where(WeeklyReport.status == "published")
        .order_by(desc(WeeklyReport.report_date))
        .limit(120)
    ).all()
    for row in weekly_rows:
        report_date = row.report_date.isoformat()
        lastmod = _iso_date(row.updated_at) or report_date
        urls.append(_url(f"{base}/weekly/{report_date}", lastmod=lastmod, changefreq="monthly", priority="0.75"))

    event_rows = db.scalars(
        select(GlobalEvent)
        .where(GlobalEvent.status == "active")
        .order_by(desc(GlobalEvent.ranking_score), desc(GlobalEvent.last_seen_at))
        .limit(1000)
    ).all()
    for row in event_rows:
        lastmod = _iso_date(row.updated_at) or _iso_date(row.last_seen_at) or _iso_date(row.published_at)
        urls.append(_url(f"{base}/events/{row.id}", lastmod=lastmod, changefreq="weekly", priority="0.65"))

    return Response(_xml(urls), media_type="application/xml; charset=utf-8")


@router.head("/sitemap.xml")
def sitemap_xml_head() -> Response:
    return Response(media_type="application/xml; charset=utf-8")
