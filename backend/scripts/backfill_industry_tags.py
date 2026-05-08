"""
回填 GlobalEvent.metrics_json.industry_tags（全大类 active 事件；规则推断）。

用法（必须用项目 venv，不要用系统 python —— CentOS 默认可能是 Python 3.6）：
  cd /opt/ai-pulse/backend && .venv/bin/python -m scripts.backfill_industry_tags --dry-run
  cd /opt/ai-pulse/backend && .venv/bin/python -m scripts.backfill_industry_tags
  cd /opt/ai-pulse/backend && .venv/bin/python -m scripts.backfill_industry_tags --category tool
"""

from __future__ import annotations

import argparse
import json
from collections import Counter

from sqlalchemy import select

from app.database import SessionLocal
from app.models import GlobalEvent
from app.services.industry_tags import infer_industry_tags_for_global_event


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill metrics_json.industry_tags for global_events")
    ap.add_argument("--dry-run", action="store_true", help="只打印统计，不写库")
    ap.add_argument(
        "--category",
        type=str,
        default=None,
        help="只处理该大类（与 GlobalEvent.category 精确匹配，如 tool、model、open_source、industry）",
    )
    args = ap.parse_args()

    db = SessionLocal()
    processed = 0
    hit_tags = 0
    empty_tags = 0
    slug_hits: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()

    try:
        stmt = select(GlobalEvent).where(GlobalEvent.status == "active")
        if args.category:
            stmt = stmt.where(GlobalEvent.category == args.category.strip())
        rows = list(db.scalars(stmt).all())

        for ge in rows:
            processed += 1
            cat = (ge.category or "").strip() or "(empty)"
            category_counts[cat] += 1

            try:
                m0 = json.loads(ge.metrics_json or "{}")
            except json.JSONDecodeError:
                m0 = {}
            if not isinstance(m0, dict):
                m0 = {}

            tags = infer_industry_tags_for_global_event(ge, m0)
            if tags:
                hit_tags += 1
                for t in tags:
                    slug_hits[t.get("slug") or "?"] += 1
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
        "backfill_industry_tags: "
        f"processed={processed} with_tags={hit_tags} empty_tags={empty_tags} "
        f"dry_run={args.dry_run} category_filter={args.category!r}"
    )
    print("by_category:")
    for k, v in sorted(category_counts.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {k}: {v}")
    print("tag_slug_hit_counts:")
    for slug, n in slug_hits.most_common():
        print(f"  {slug}: {n}")


if __name__ == "__main__":
    main()
