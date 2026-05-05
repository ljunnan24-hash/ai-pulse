"""
每日抓取 → raw_items（issue_id NULL）→ global_events 合并与评分。
用法：cd backend && .venv/bin/python -m app.jobs.daily_rankings
Cron 示例见 deploy/crontab.example
"""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import desc, inspect as sa_inspect, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import RawItem
from app.services.crawler_service import collect_all_feed_items
from app.services.global_event_service import upsert_global_events_from_raw_items
from app.services.ranking_insight_service import enrich_ranking_insights
from app.services.scoring_service import score_item

_log = logging.getLogger("uvicorn.error")


def _crawler_item_to_extra_json(it: dict) -> str:
    out: dict[str, Any] = {}
    for key in ("feed_url", "source_name", "crawl_time", "language", "author"):
        v = it.get(key)
        if v is not None and str(v).strip() != "":
            out[key] = v
    m = it.get("metrics")
    if isinstance(m, dict):
        out["metrics"] = m
    raw = it.get("raw_text")
    if raw:
        out["raw_text"] = str(raw)[:12000]
    gh = it.get("github")
    if isinstance(gh, dict) and gh:
        out["github"] = gh
    if not out:
        return "{}"
    return json.dumps(out, ensure_ascii=False)


def run(db: Session) -> None:
    bind = db.get_bind()
    insp = sa_inspect(bind) if bind else None
    existing_cols: set[str] = set()
    if insp and insp.has_table("raw_items"):
        existing_cols = {c["name"] for c in insp.get_columns("raw_items")}

    has_source_type = "source_type" in existing_cols
    has_score_total = "score_total" in existing_cols
    has_score_breakdown = "score_breakdown_json" in existing_cols
    has_extra_json = "extra_json" in existing_cols

    items = collect_all_feed_items()
    if not items:
        print("daily_rankings: no feed items collected.")
        return

    for it in items:
        bd = score_item(it)
        it["_score_total"] = int(bd.total)
        try:
            breakdown_obj = json.loads(bd.to_json())
            if isinstance(breakdown_obj, dict):
                breakdown_obj["meta"] = {"source_tier": int(it.get("source_tier", 2))}
            it["_score_breakdown_json"] = json.dumps(breakdown_obj, ensure_ascii=False)
        except Exception:
            it["_score_breakdown_json"] = bd.to_json()

    mappings: list[dict[str, Any]] = []
    for it in items:
        row: dict[str, Any] = {
            "issue_id": None,
            "source": it.get("source", ""),
            "title": it.get("title", ""),
            "summary": it.get("summary", ""),
            "link": it.get("link", ""),
            "published_at": it.get("published_at"),
            "heat_score": int(it.get("heat_score") or 0),
        }
        if has_source_type:
            row["source_type"] = it.get("source_type", "rss")
        if has_score_total:
            row["score_total"] = int(it.get("_score_total") or 0)
        if has_score_breakdown:
            row["score_breakdown_json"] = str(it.get("_score_breakdown_json") or "{}")
        if has_extra_json:
            row["extra_json"] = _crawler_item_to_extra_json(it)
        mappings.append(row)

    if not mappings:
        print("daily_rankings: empty mappings.")
        return

    n = len(mappings)
    db.bulk_insert_mappings(RawItem, mappings)
    db.commit()

    # 取最新 n 条 id（与本次插入条数一致；并发下为近似，生产可改为逐条 insert 取 id）
    ids = list(db.scalars(select(RawItem.id).order_by(desc(RawItem.id)).limit(n)).all())
    ids.reverse()

    print(f"daily_rankings: inserted {len(ids)} raw_items (issue_id=null).")
    touched = upsert_global_events_from_raw_items(db, ids)
    print(f"daily_rankings: upserted global_events touched={len(touched)} ids sample={touched[:10]}")

    settings = get_settings()
    if settings.ranking_insight_enabled:
        try:
            n = enrich_ranking_insights(db, limit=settings.ranking_insight_limit)
            print(f"daily_rankings: ranking_insight enriched ~{n} events.")
        except Exception as exc:
            _log.exception("daily_rankings: enrich_ranking_insights failed (job continues): %s", exc)


def main() -> None:
    db = SessionLocal()
    try:
        run(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
