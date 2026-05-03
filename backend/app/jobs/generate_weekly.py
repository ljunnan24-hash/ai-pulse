"""
周一 00:30（北京时间）由 cron 调用：
  cd backend && python -m app.jobs.generate_weekly

默认多 Agent（Cleaner→Verifier→Impact→…→Composer）。
单次豆包 summarize：MULTI_AGENT_WEEKLY=false（可选 MULTI_AGENT_DIGEST_TOP_N=20）
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import IssueEvent, IssueStatus, RawItem, WeeklyIssue
from app.services.crawler_service import collect_all_feed_items
from app.services.issue_events_service import (
    candidates_to_summarize_input,
    fetch_digest_candidates,
    rebuild_issue_events,
)
from app.services.multi_agent_orchestrator import MultiAgentOrchestrator
from app.services.scoring_service import score_item
from app.services.summarizer_service import normalize_payload, payload_to_texts, summarize_items
from app.timeutil import current_period_monday


def _require_migrations_applied(db: Session) -> None:
    """
    ORM 模型含 raw_items.extra_json 等列；若库未迁移，INSERT 会在运行时失败。
    在此失败并给出迁移文件名，避免难以排查的 MySQL 报错。
    """
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    if not insp.has_table("raw_items"):
        raise RuntimeError("数据库缺少表 raw_items，请先执行仓库 sql/schema.sql（或按迁移文档初始化）。")
    cols = {c["name"] for c in insp.get_columns("raw_items")}
    required = {
        "source_type": "sql/migrations/2026-04-24_add_scoring_and_sources.sql",
        "score_total": "sql/migrations/2026-04-24_add_scoring_and_sources.sql",
        "score_breakdown_json": "sql/migrations/2026-04-24_add_scoring_and_sources.sql",
        "extra_json": "sql/migrations/2026-05-03_raw_items_extra_json.sql",
        "event_id": "sql/migrations/2026-05-02_issue_events.sql",
    }
    missing = [f"{c} ← {required[c]}" for c in required if c not in cols]
    if missing:
        raise RuntimeError(
            "raw_items 与当前 ORM 不一致，缺少列：\n"
            + "\n".join(missing)
            + "\n请在 MySQL 上按顺序执行 sql/migrations/ 下对应脚本（见 docs/NEXT_STEPS.md）。"
        )
    if not insp.has_table("issue_events"):
        raise RuntimeError(
            "缺少表 issue_events，请执行 sql/migrations/2026-05-02_issue_events.sql（事件合并依赖该表）。"
        )


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
    _require_migrations_applied(db)

    period = current_period_monday()
    # 若库中曾有重复 period_start（未跑 UNIQUE 迁移前），取最小 id 以免 scalar_one 抛错
    existing_ready = db.execute(
        select(WeeklyIssue)
        .where(WeeklyIssue.period_start == period, WeeklyIssue.status == IssueStatus.ready.value)
        .order_by(WeeklyIssue.id.asc())
    ).scalars().first()
    if existing_ready:
        print(f"Issue for {period} already ready, skip.")
        return

    issue = db.execute(
        select(WeeklyIssue).where(WeeklyIssue.period_start == period).order_by(WeeklyIssue.id.asc())
    ).scalars().first()
    if not issue:
        issue = WeeklyIssue(
            period_start=period,
            simple_text="",
            normal_text="",
            glossary_json="[]",
            payload_json="{}",
            status=IssueStatus.draft.value,
        )
        db.add(issue)
        db.commit()
        db.refresh(issue)
    else:
        issue.status = IssueStatus.draft.value
        db.commit()

    db.execute(delete(IssueEvent).where(IssueEvent.issue_id == issue.id))
    db.execute(delete(RawItem).where(RawItem.issue_id == issue.id))
    db.commit()

    items = collect_all_feed_items()
    if not items:
        print("No feed items collected; abort without marking ready.")
        return

    # Pre-compute PRD scoring once (deterministic) and keep it in-memory for sorting & prompt.
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

    # Detect whether DB schema already has new columns.
    existing_cols = set()
    try:
        insp = inspect(db.get_bind())
        existing_cols = {c["name"] for c in insp.get_columns("raw_items")}
    except Exception:
        existing_cols = set()

    has_source_type = "source_type" in existing_cols
    has_score_total = "score_total" in existing_cols
    has_score_breakdown = "score_breakdown_json" in existing_cols
    has_extra_json = "extra_json" in existing_cols

    mappings: list[dict[str, Any]] = []
    for it in items:
        row: dict[str, Any] = {
            "issue_id": issue.id,
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

    if mappings:
        db.bulk_insert_mappings(RawItem, mappings)
    db.commit()

    try:
        n_ev = rebuild_issue_events(db, issue.id)
        print(f"Issue events rebuilt for issue {issue.id}: {n_ev} clusters.")
    except Exception as exc:
        print(f"rebuild_issue_events failed (apply sql/migrations/2026-05-02_issue_events.sql?): {exc}")

    candidates = fetch_digest_candidates(db, issue.id)
    items = candidates_to_summarize_input(candidates)
    if not items:
        print("No digest candidates after merge; abort without marking ready.")
        return

    settings = get_settings()
    use_ma = bool(getattr(settings, "multi_agent_weekly", False))
    top_n = max(5, min(int(getattr(settings, "multi_agent_digest_top_n", 20) or 20), 60))

    if use_ma:
        orch = MultiAgentOrchestrator()
        res = orch.build(raw_items=list(candidates), top_n=top_n)
        payload = normalize_payload(res.payload)
        audit_path = os.path.join(os.getcwd(), f"audit_report_{period.isoformat()}.json")
        try:
            with open(audit_path, "w", encoding="utf-8") as f:
                json.dump(res.audit_report, f, ensure_ascii=False, indent=2)
            print(f"Multi-agent pipeline OK; audit: {audit_path}")
        except OSError as exc:
            print(f"audit report write failed: {exc}")
    else:
        try:
            payload = summarize_items(items)
        except Exception as e:
            print(f"Summarizer failed: {e}")
            raise

    simple_text, normal_text, glossary_json = payload_to_texts(payload)

    issue.simple_text = simple_text
    issue.normal_text = normal_text
    issue.glossary_json = glossary_json
    issue.payload_json = json.dumps(payload, ensure_ascii=False)
    issue.status = IssueStatus.ready.value
    issue.ready_at = datetime.now(timezone.utc)
    db.commit()
    print(f"Weekly issue {issue.id} for {period} marked ready.")


def main():
    db = SessionLocal()
    try:
        run(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
