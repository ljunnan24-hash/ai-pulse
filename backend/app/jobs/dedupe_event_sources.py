"""
存量 global_event_sources：同一 global_event_id + 规范化 URL 仅保留一条。

用法：
  cd backend && python -m app.jobs.dedupe_event_sources --dry-run
  cd backend && python -m app.jobs.dedupe_event_sources --apply

不会自动运行；需显式传入 --dry-run 或 --apply。

验收 SQL（原始 URL 维度；规范化后重复需在应用层核对）::

  SELECT global_event_id, url, COUNT(*) AS cnt
  FROM global_event_sources
  GROUP BY global_event_id, url
  HAVING cnt > 1
  ORDER BY cnt DESC
  LIMIT 20;
"""

from __future__ import annotations

import argparse
import logging
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GlobalEventSource
from app.services.global_event_service import recalculate_global_event
from app.services.url_normalize import normalize_event_source_url, source_type_trust_rank

_log = logging.getLogger("uvicorn.error")


def _pick_kept(rows: list[GlobalEventSource]) -> GlobalEventSource:
    def score(r: GlobalEventSource) -> tuple:
        pa = r.published_at
        if pa is None:
            ts = datetime.min.replace(tzinfo=timezone.utc)
        elif pa.tzinfo is None:
            ts = pa.replace(tzinfo=timezone.utc)
        else:
            ts = pa
        return (source_type_trust_rank(r.source_type), ts, r.id)

    return max(rows, key=score)


def main() -> None:
    parser = argparse.ArgumentParser(description="Dedupe global_event_sources by normalized URL")
    parser.add_argument("--dry-run", action="store_true", help="仅统计与打印样例，不写库")
    parser.add_argument("--apply", action="store_true", help="删除重复行并 recalculate_global_event")
    args = parser.parse_args()
    if not args.dry_run and not args.apply:
        parser.error("请指定 --dry-run 或 --apply")

    db = SessionLocal()
    try:
        rows = list(db.scalars(select(GlobalEventSource)).all())
        groups: dict[tuple, list[GlobalEventSource]] = defaultdict(list)
        for r in rows:
            nu = normalize_event_source_url(r.url)
            key_ge = r.global_event_id
            key_u = nu if nu else f"empty:{r.id}"
            groups[(key_ge, key_u)].append(r)

        dup_groups = [(k, v) for k, v in groups.items() if len(v) > 1]
        total_extra = sum(len(v) - 1 for _, v in dup_groups)
        print(f"duplicate_groups={len(dup_groups)} rows_to_delete={total_extra}")

        for i, (_, members) in enumerate(dup_groups[:5]):
            kept = _pick_kept(members)
            nu = normalize_event_source_url(kept.url)
            print(
                f"sample[{i}] global_event_id={kept.global_event_id} "
                f"keep_id={kept.id} normalized_url={nu!r} group_size={len(members)}"
            )

        if args.dry_run:
            return

        affected_ge: set[int] = set()
        deleted = 0
        for _, members in dup_groups:
            kept = _pick_kept(members)
            affected_ge.add(int(kept.global_event_id))
            for r in members:
                if r.id != kept.id:
                    db.delete(r)
                    deleted += 1

        db.commit()
        print(f"deleted_rows={deleted}")

        for gid in sorted(affected_ge):
            try:
                recalculate_global_event(db, gid)
            except Exception:
                _log.exception("recalculate_global_event failed id=%s", gid)
        db.commit()
        print(f"recalculated_global_events={len(affected_ge)}")
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
