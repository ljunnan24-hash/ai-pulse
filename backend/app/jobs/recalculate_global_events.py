"""
批量对 active global_events 执行 recalculate_global_event（纠正 published_at=min(来源)、ranking_score、metrics_json 等）。

适用：published_at 曾按 max(来源) 写入的旧数据，或手工改过来源后需全量刷新分数。

用法：
  cd backend && .venv/bin/python -m app.jobs.recalculate_global_events --dry-run
  cd backend && .venv/bin/python -m app.jobs.recalculate_global_events --apply
  cd backend && .venv/bin/python -m app.jobs.recalculate_global_events --apply --limit 500
"""

from __future__ import annotations

import argparse
import logging

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GlobalEvent
from app.services.global_event_service import recalculate_global_event

_log = logging.getLogger("uvicorn.error")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk recalculate global_events scores and published_at")
    parser.add_argument("--dry-run", action="store_true", help="只统计数量，不写库")
    parser.add_argument("--apply", action="store_true", help="执行重算并 commit")
    parser.add_argument("--limit", type=int, default=0, help="最多处理条数，0=不限制")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        parser.error("请指定 --dry-run 或 --apply")

    db = SessionLocal()
    try:
        q = select(GlobalEvent.id).where(GlobalEvent.status == "active").order_by(GlobalEvent.id.asc())
        if args.limit and args.limit > 0:
            q = q.limit(int(args.limit))
        ids = [int(x) for x in db.scalars(q).all()]
        print(f"recalculate_global_events: active events to process={len(ids)} dry_run={args.dry_run}")

        if args.dry_run:
            return

        ok = 0
        fail = 0
        for gid in ids:
            try:
                recalculate_global_event(db, gid)
                ok += 1
            except Exception as exc:
                fail += 1
                _log.exception("recalculate failed id=%s: %s", gid, exc)
        db.commit()
        print(f"recalculate_global_events: done ok={ok} fail={fail}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
