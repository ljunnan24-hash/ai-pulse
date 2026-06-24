"""后台：RSS 信源管理与抓取健康观测。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, inspect as sa_inspect, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import FeedCrawlRun, RssSource
from app.routers.admin import require_admin
from app.services.rss_source_registry import (
    CHANNEL_TIERS,
    db_rss_source_count,
    db_rss_sources,
    default_source_name,
    env_rss_sources,
    normalize_channel,
    rss_sources_table_available,
    rss_url_hash,
    source_to_dict,
    tier_for_channel,
    validate_rss_url,
)

router = APIRouter(tags=["admin-sources"])

OK_HEALTH = frozenset({"ok", "no_new_items", "skipped_duplicate_feed"})
WARN_HEALTH = frozenset({"empty_feed", "all_filtered"})


class RssSourceIn(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    url: str = Field(min_length=8, max_length=2048)
    channel: str = Field(default="official", max_length=64)
    is_enabled: bool = True
    note: str | None = Field(default=None, max_length=8000)


class RssSourcePatchIn(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    url: str | None = Field(default=None, min_length=8, max_length=2048)
    channel: str | None = Field(default=None, max_length=64)
    is_enabled: bool | None = None
    note: str | None = Field(default=None, max_length=8000)


def _source_row(row: RssSource) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name or default_source_name(row.url),
        "url": row.url,
        "url_hash": row.url_hash,
        "channel": row.channel,
        "tier": int(row.tier),
        "is_enabled": bool(row.is_enabled),
        "note": row.note,
        "readonly": False,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _ensure_sources_table(db: Session) -> None:
    if not rss_sources_table_available(db):
        raise HTTPException(status_code=500, detail="rss_sources table is not available.")


def _table_available(db: Session, table_name: str) -> bool:
    bind = db.get_bind()
    if not bind:
        return False
    try:
        return bool(sa_inspect(bind).has_table(table_name))
    except Exception:
        return False


@router.get("/rss-sources")
def admin_rss_sources(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _ensure_sources_table(db)
    rows = db_rss_sources(db)
    env_items = [source_to_dict(src, readonly=True) for src in env_rss_sources(get_settings())]
    using_database = len(rows) > 0
    effective_items = [_source_row(r) for r in rows if int(r.is_enabled or 0) == 1] if using_database else env_items
    return {
        "using_database": using_database,
        "items": [_source_row(r) for r in rows],
        "env_items": env_items,
        "effective_count": len(effective_items),
        "effective_items": effective_items,
        "channels": [{"value": k, "tier": v} for k, v in CHANNEL_TIERS.items()],
    }


@router.post("/rss-sources/import-env")
def admin_rss_sources_import_env(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _ensure_sources_table(db)
    imported = 0
    for src in env_rss_sources(get_settings()):
        url = validate_rss_url(src.url)
        h = rss_url_hash(url)
        exists = db.scalar(select(RssSource.id).where(RssSource.url_hash == h))
        if exists:
            continue
        db.add(
            RssSource(
                name=(src.name or default_source_name(url))[:256],
                url=url,
                url_hash=h,
                channel=normalize_channel(src.channel),
                tier=int(src.tier),
                is_enabled=1,
            )
        )
        imported += 1
    db.commit()
    return {"ok": True, "imported": imported, "total": db_rss_source_count(db)}


@router.post("/rss-sources")
def admin_rss_source_create(
    body: RssSourceIn,
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _ensure_sources_table(db)
    try:
        url = validate_rss_url(body.url)
        channel = normalize_channel(body.channel)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    h = rss_url_hash(url)
    if db.scalar(select(RssSource.id).where(RssSource.url_hash == h)):
        raise HTTPException(status_code=409, detail="RSS source already exists.")
    row = RssSource(
        name=(body.name or default_source_name(url)).strip()[:256],
        url=url,
        url_hash=h,
        channel=channel,
        tier=tier_for_channel(channel),
        is_enabled=1 if body.is_enabled else 0,
        note=(body.note or "").strip()[:8000] or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _source_row(row)


@router.patch("/rss-sources/{source_id}")
def admin_rss_source_patch(
    source_id: int,
    body: RssSourcePatchIn,
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _ensure_sources_table(db)
    row = db.get(RssSource, source_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if body.url is not None:
        try:
            url = validate_rss_url(body.url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        h = rss_url_hash(url)
        existing = db.scalar(select(RssSource.id).where(RssSource.url_hash == h, RssSource.id != source_id))
        if existing:
            raise HTTPException(status_code=409, detail="RSS source already exists.")
        row.url = url
        row.url_hash = h
        if not (body.name or "").strip() and not row.name:
            row.name = default_source_name(url)

    if body.channel is not None:
        try:
            row.channel = normalize_channel(body.channel)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        row.tier = tier_for_channel(row.channel)
    if body.name is not None:
        row.name = body.name.strip()[:256] or default_source_name(row.url)
    if body.is_enabled is not None:
        row.is_enabled = 1 if body.is_enabled else 0
    if body.note is not None:
        row.note = body.note.strip()[:8000] or None

    db.commit()
    db.refresh(row)
    return _source_row(row)


@router.delete("/rss-sources/{source_id}")
def admin_rss_source_delete(
    source_id: int,
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _ensure_sources_table(db)
    row = db.get(RssSource, source_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _run_row(r: FeedCrawlRun) -> dict[str, Any]:
    return {
        "id": r.id,
        "run_id": r.run_id,
        "job_name": r.job_name,
        "feed_url": r.feed_url,
        "feed_channel": r.feed_channel,
        "http_status": r.http_status,
        "content_type": r.content_type,
        "fetch_ok": bool(r.fetch_ok),
        "parse_ok": bool(r.parse_ok),
        "raw_entry_count": int(r.raw_entry_count or 0),
        "emitted_item_count": int(r.emitted_item_count or 0),
        "inserted_item_count": r.inserted_item_count,
        "health_status": r.health_status,
        "error_class": r.error_class,
        "error_message": r.error_message,
        "duration_ms": int(r.duration_ms or 0),
        "run_at": r.run_at.isoformat() if r.run_at else None,
    }


def _severity(status: str | None) -> str:
    s = (status or "").strip()
    if not s:
        return "no_data"
    if s in OK_HEALTH:
        return "ok"
    if s in WARN_HEALTH:
        return "warning"
    return "failing"


@router.get("/rss-health")
def admin_rss_health(
    _: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
    days: int = Query(14, ge=1, le=90),
    only_unhealthy: bool = Query(False),
) -> dict[str, Any]:
    if not _table_available(db, "feed_crawl_runs"):
        return {
            "days": days,
            "summary": {"total": 0, "failing": 0, "warning": 0, "no_data": 0, "ok": 0},
            "items": [],
        }
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(FeedCrawlRun)
        .where(FeedCrawlRun.run_at >= since, FeedCrawlRun.feed_url != "")
        .order_by(desc(FeedCrawlRun.run_at))
        .limit(5000)
    )
    runs = list(db.scalars(stmt).all())
    grouped: dict[str, list[FeedCrawlRun]] = {}
    for r in runs:
        grouped.setdefault((r.feed_url or "").strip(), []).append(r)

    source_rows = db_rss_sources(db, enabled_only=True) if rss_sources_table_available(db) and db_rss_source_count(db) > 0 else []
    active_urls = {(r.url or "").strip(): r for r in source_rows if (r.url or "").strip()}
    for url in active_urls:
        grouped.setdefault(url, [])

    items: list[dict[str, Any]] = []
    for feed_url, rows in grouped.items():
        latest = rows[0] if rows else None
        status = latest.health_status if latest else ""
        severity = _severity(status)
        failure_count = sum(1 for r in rows if _severity(r.health_status) == "failing")
        warning_count = sum(1 for r in rows if _severity(r.health_status) == "warning")
        ok_count = sum(1 for r in rows if _severity(r.health_status) == "ok")
        consecutive_failures = 0
        for r in rows:
            if _severity(r.health_status) == "ok":
                break
            if _severity(r.health_status) == "failing":
                consecutive_failures += 1
        last_ok = next((r for r in rows if _severity(r.health_status) == "ok"), None)
        source = active_urls.get(feed_url)
        item = {
            "feed_url": feed_url,
            "source_id": source.id if source else None,
            "source_name": (source.name if source else "") or default_source_name(feed_url),
            "feed_channel": (source.channel if source else (latest.feed_channel if latest else "")),
            "tier": int(source.tier) if source else None,
            "is_enabled": bool(source.is_enabled) if source else None,
            "severity": severity,
            "latest": _run_row(latest) if latest else None,
            "run_count": len(rows),
            "ok_count": ok_count,
            "warning_count": warning_count,
            "failure_count": failure_count,
            "consecutive_failures": consecutive_failures,
            "last_ok_at": last_ok.run_at.isoformat() if last_ok and last_ok.run_at else None,
        }
        if only_unhealthy and severity == "ok":
            continue
        items.append(item)

    order = {"failing": 0, "warning": 1, "no_data": 2, "ok": 3}
    items.sort(key=lambda x: (order.get(str(x["severity"]), 9), str(x.get("source_name") or ""), str(x.get("feed_url") or "")))
    return {
        "days": days,
        "summary": {
            "total": len(items),
            "failing": sum(1 for x in items if x["severity"] == "failing"),
            "warning": sum(1 for x in items if x["severity"] == "warning"),
            "no_data": sum(1 for x in items if x["severity"] == "no_data"),
            "ok": sum(1 for x in items if x["severity"] == "ok"),
        },
        "items": items,
    }
