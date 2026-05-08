"""
仅重跑 Ranking Insight（不调爬虫、不写 raw_items）。
可选每日 cron，接在 daily_rankings 之后（见 deploy/crontab.example，默认 02:40）。

用法：
  cd backend && python -m app.jobs.enrich_rankings --limit 50
  cd backend && python -m app.jobs.enrich_rankings --force --limit 50

--force：忽略 RANKING_INSIGHT_ENABLED=false；候选不足时用高分事件补足；写入 applied=true（见 enrich_ranking_insights）。
"""

from __future__ import annotations

import argparse

from app.config import get_settings
from app.database import SessionLocal
from app.services.ranking_insight_service import enrich_ranking_insights


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Ranking Insight enrichment only")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="候选上限（默认取配置 RANKING_INSIGHT_LIMIT）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="绕过 RANKING_INSIGHT_ENABLED；不足时用高分事件补足并覆盖旧兜底文案",
    )
    args = parser.parse_args()

    settings = get_settings()
    lim = args.limit if args.limit is not None else settings.ranking_insight_limit

    db = SessionLocal()
    try:
        n = enrich_ranking_insights(db, limit=lim, force=args.force)
        print(f"enrich_rankings: enriched ~{n} events (limit={lim}, force={args.force}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
