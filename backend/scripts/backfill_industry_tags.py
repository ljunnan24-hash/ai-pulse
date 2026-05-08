"""
回填 GlobalEvent.metrics_json.industry_tags（仅 category=industry）。

用法（必须用项目 venv，不要用系统 python —— CentOS 默认可能是 Python 3.6）：
  cd /opt/ai-pulse/backend && .venv/bin/python -m scripts.backfill_industry_tags --dry-run
  cd /opt/ai-pulse/backend && .venv/bin/python -m scripts.backfill_industry_tags
"""

from __future__ import annotations

import argparse
import json

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GlobalEvent
from app.services.industry_tags import infer_industry_tags_for_global_event


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill metrics_json.industry_tags for industry global_events")
    ap.add_argument("--dry-run", action="store_true", help="只打印统计，不写库")
    args = ap.parse_args()

    db = SessionLocal()
    processed = 0
    hit_tags = 0
    empty_tags = 0
    try:
        rows = list(
            db.scalars(
                select(GlobalEvent).where(GlobalEvent.status == "active", GlobalEvent.category == "industry")
            ).all()
        )
        for ge in rows:
            processed += 1
            try:
                m0 = json.loads(ge.metrics_json or "{}")
            except json.JSONDecodeError:
                m0 = {}
            if not isinstance(m0, dict):
                m0 = {}

            tags = infer_industry_tags_for_global_event(ge, m0)
            if tags:
                hit_tags += 1
            else:
                empty_tags += 1

            m0["industry_tags"] = tags

            if not args.dry_run:
                ge.metrics_json = json.dumps(m0, ensure_ascii=False)

        if not args.dry_run:
            db.commit()
    finally:
        db.close()

    print(
        f"backfill_industry_tags: processed={processed} with_tags={hit_tags} empty_tags={empty_tags} dry_run={args.dry_run}"
    )


if __name__ == "__main__":
    main()
