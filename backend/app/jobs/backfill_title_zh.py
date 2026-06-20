"""
为已有 GlobalEvent 补写 title_zh（LLM API 译英文标题；中文原标题则直接复制）。
仅在 merge 上线前入库的事件需要跑一次；需配置 LLM_API_KEY + LLM_MODEL，或旧的 DOUBAO_*。

用法：
  cd /opt/ai-pulse/backend && .venv/bin/python -m app.jobs.backfill_title_zh
  .venv/bin/python -m app.jobs.backfill_title_zh --limit 100
"""

from __future__ import annotations

import argparse
import logging
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import GlobalEvent
from app.services.title_translate_service import ensure_global_event_title_zh

_log = logging.getLogger("uvicorn.error")


def run(db: Session, *, limit: int, pause_s: float) -> None:
    settings = get_settings()
    if not settings.effective_llm_api_key or not settings.effective_llm_model:
        print(
            "backfill_title_zh: WARN — LLM_API_KEY / LLM_MODEL or legacy DOUBAO_* unset; "
            "events with Chinese canonical_title will still get title_zh; English-only rows stay empty."
        )

    rows = list(
        db.scalars(
            select(GlobalEvent)
            .where(GlobalEvent.status == "active")
            .where(GlobalEvent.title_zh == "")
            .where(GlobalEvent.canonical_title != "")
            .order_by(GlobalEvent.ranking_score.desc())
            .limit(limit)
        ).all()
    )
    if not rows:
        print("backfill_title_zh: no rows need title_zh.")
        return

    ok = 0
    for i, ge in enumerate(rows):
        try:
            ensure_global_event_title_zh(ge)
            db.commit()
            if (ge.title_zh or "").strip():
                ok += 1
            print(f"[{i + 1}/{len(rows)}] id={ge.id} title_zh={'set' if (ge.title_zh or '').strip() else 'empty'}")
        except Exception as exc:
            db.rollback()
            _log.exception("backfill_title_zh id=%s: %s", ge.id, exc)
        if pause_s > 0 and i + 1 < len(rows):
            time.sleep(pause_s)

    print(f"backfill_title_zh: done rows={len(rows)} title_zh_filled={ok}")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=500, help="max events to process")
    ap.add_argument("--pause", type=float, default=0.25, help="seconds between rows (rate limit)")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        run(db, limit=max(1, args.limit), pause_s=max(0.0, args.pause))
    finally:
        db.close()


if __name__ == "__main__":
    main()
