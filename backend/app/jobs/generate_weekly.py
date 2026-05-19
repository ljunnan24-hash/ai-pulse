"""
周一凌晨由 cron 调用（推荐北京时间 04:10，见 deploy/crontab.example）：
  cd backend && python -m app.jobs.generate_weekly

生产路径：`WEEKLY_SOURCE=global_events`（默认）+ `weekly_global_slim`
（daily_rankings → global_events → weekly_score Top3 → 3×LLM thesis/capability/glossary）。

`MULTI_AGENT_WEEKLY=false` 时仍生成周刊，但跳过 thesis/capability/glossary 的 LLM（Top3 仍按分数）。

本期已是 ready 时默认跳过；整期重跑（period_start 不变）：
  python -m app.jobs.generate_weekly --force
或环境变量 GENERATE_WEEKLY_FORCE=1

前置：本周已跑过 `daily_rankings`（表 global_events 有数据）。详见 docs/MULTI_AGENT_V1.md。

已停用：`WEEKLY_SOURCE=legacy` 全量多 Agent，见 docs/archive/LEGACY_WEEKLY_MULTI_AGENT.md。
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import IssueEvent, IssueStatus, RawItem, WeeklyIssue
from app.services.weekly_event_score_service import (
    recompute_weekly_event_scores_for_period,
    select_global_events_by_weekly_score,
)
from app.services.weekly_global_pipeline import build_global_weekly_payload
from app.services.weekly_issue_snapshot import append_weekly_issue_snapshot
from app.services.summarizer_service import normalize_payload, payload_to_texts
from app.timeutil import current_period_monday


def _ensure_global_weekly_source(settings: Any) -> None:
    src = (settings.weekly_source or "global_events").strip().lower()
    if src != "global_events":
        raise RuntimeError(
            f"WEEKLY_SOURCE={settings.weekly_source!r} 已停用。"
            "请设 WEEKLY_SOURCE=global_events（见 docs/MULTI_AGENT_V1.md）。"
            "旧版全量多 Agent 说明见 docs/archive/LEGACY_WEEKLY_MULTI_AGENT.md。"
        )


def _print_weekly_quality_line(qs: dict[str, Any]) -> None:
    print(
        "AI Pulse Weekly Quality: "
        f"Top3={qs.get('final_top3_count')}, "
        f"AvgUV={qs.get('avg_user_value_score')}, "
        f"GitHubTop3={qs.get('github_count_in_top3')}, "
        f"BlockedHighHeat={qs.get('high_heat_blocked_count')}, "
        f"EmailOK={str(qs.get('email_payload_valid')).lower()}, "
        f"URL={qs.get('weekly_url') or ''}"
    )


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


def _require_global_events_table(db: Session) -> None:
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    if not insp.has_table("global_events"):
        raise RuntimeError(
            "WEEKLY_SOURCE=global_events 需要表 global_events，请执行 sql/migrations/2026-05-08_global_events.sql。"
        )


def _require_weekly_event_scores_table(db: Session) -> None:
    bind = db.get_bind()
    if bind is None:
        return
    insp = inspect(bind)
    if not insp.has_table("weekly_event_scores"):
        raise RuntimeError(
            "缺少表 weekly_event_scores，请执行 sql/migrations/2026-05-13_weekly_event_scores.sql。"
        )


def run(db: Session, *, force: bool = False, reuse_crawl: bool = False) -> None:
    _require_migrations_applied(db)

    if not force:
        force = (os.getenv("GENERATE_WEEKLY_FORCE") or "").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
    if not reuse_crawl:
        reuse_crawl = (os.getenv("GENERATE_WEEKLY_REUSE_CRAWL") or "").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )

    period = current_period_monday()
    # 若库中曾有重复 period_start（未跑 UNIQUE 迁移前），取最小 id 以免 scalar_one 抛错
    existing_ready = db.execute(
        select(WeeklyIssue)
        .where(WeeklyIssue.period_start == period, WeeklyIssue.status == IssueStatus.ready.value)
        .order_by(WeeklyIssue.id.asc())
    ).scalars().first()
    if existing_ready and not force:
        print(f"Issue for {period} already ready, skip.")
        return
    if existing_ready and force:
        print(
            f"generate_weekly: --force / GENERATE_WEEKLY_FORCE，将覆盖本期 {period} 的 payload（period_start 不变；选题来自 global_events）。"
        )

    issue = db.execute(
        select(WeeklyIssue).where(WeeklyIssue.period_start == period).order_by(WeeklyIssue.id.asc())
    ).scalars().first()
    if not issue:
        if reuse_crawl:
            print("reuse_crawl: 本期尚无 weekly_issues 记录，请先运行一次 generate_weekly。")
            return
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
    elif not reuse_crawl:
        issue.status = IssueStatus.draft.value
        db.commit()

    settings = get_settings()
    _ensure_global_weekly_source(settings)
    _require_global_events_table(db)
    _require_weekly_event_scores_table(db)

    if reuse_crawl:
        print(
            "generate_weekly: --reuse-crawl 对 global_events 路径无实质影响（本任务不抓周刊 RSS）；"
            "仍从 global_events + weekly_score 选题。"
        )
    else:
        db.execute(delete(IssueEvent).where(IssueEvent.issue_id == issue.id))
        db.execute(delete(RawItem).where(RawItem.issue_id == issue.id))
        db.commit()
        print("generate_weekly: 已清空本期周刊专用 raw/issue_events（选题来自 global_events，不抓周刊 RSS）。")

    pool_limit = max(1, int(getattr(settings, "global_events_pool_limit", 40) or 40))
    min_cand = max(0, int(getattr(settings, "global_events_min_candidates", 8) or 8))
    n_scored = recompute_weekly_event_scores_for_period(db, period, report_date=period)
    print(
        f"generate_weekly: weekly_event_scores 已重算（上一自然周 last_seen），"
        f"period={period}，写入 {n_scored} 条。"
    )
    selected, selection_report_global = select_global_events_by_weekly_score(
        db,
        period_start=period,
        limit=pool_limit,
        min_candidates=min_cand,
    )
    if selection_report_global.get("insufficient_global_events"):
        print(
            "generate_weekly: 警告 — weekly_score 候选少于 min_candidates；仍将生成（可能为薄周报）。"
        )
    print(
        f"generate_weekly: global_events 按 weekly_score 选题 {len(selected)} 条 "
        f"(pool_limit={pool_limit})."
    )
    if not selected:
        print("generate_weekly: 选题池为空；请先跑 daily_rankings 或检查 GLOBAL_EVENTS_* 窗口。")
        return

    use_ma = bool(getattr(settings, "multi_agent_weekly", False))
    top_n = max(5, min(int(getattr(settings, "multi_agent_digest_top_n", 20) or 20), 60))

    res = build_global_weekly_payload(
        db,
        period_start=period,
        pool_events=list(selected),
        top_n_llm=top_n,
        enable_llm=use_ma,
    )
    payload = normalize_payload(res.payload)
    audit_report_to_store = res.audit_report if isinstance(res.audit_report, dict) else {}
    weekly_quality_summary = dict(audit_report_to_store.get("weekly_quality_summary") or {})
    weekly_quality_summary["mode"] = "weekly_global_slim"
    weekly_quality_summary["llm_enabled"] = use_ma
    audit_report_to_store["weekly_quality_summary"] = weekly_quality_summary
    if selection_report_global:
        audit_report_to_store["weekly_global_selection"] = selection_report_global
    audit_path = os.path.join(os.getcwd(), f"audit_report_{period.isoformat()}.json")
    try:
        with open(audit_path, "w", encoding="utf-8") as f:
            json.dump(audit_report_to_store, f, ensure_ascii=False, indent=2)
        print(f"Weekly global slim pipeline OK; audit: {audit_path}")
    except OSError as exc:
        print(f"audit report write failed: {exc}")

    simple_text, normal_text, glossary_json = payload_to_texts(payload)

    issue.simple_text = simple_text
    issue.normal_text = normal_text
    issue.glossary_json = glossary_json
    issue.payload_json = json.dumps(payload, ensure_ascii=False)
    issue.status = IssueStatus.ready.value
    issue.ready_at = datetime.now(timezone.utc)
    if reuse_crawl:
        snap_src = "generate_weekly_global_events_reuse_force" if force else "generate_weekly_global_events_reuse"
    else:
        snap_src = "generate_weekly_global_events_force" if force else "generate_weekly_global_events"
    append_weekly_issue_snapshot(
        db, issue, source=snap_src, audit_report=audit_report_to_store
    )
    db.commit()
    print(f"Weekly issue {issue.id} for {period} marked ready.")
    if weekly_quality_summary:
        _print_weekly_quality_line(weekly_quality_summary)


def main():
    ap = argparse.ArgumentParser(description="抓取 + 生成周刊 payload 并标记 ready")
    ap.add_argument(
        "--force",
        action="store_true",
        help="本期已是 ready 时也重新生成（不清 period_start；默认仍清空并重爬 raw/issue_events）",
    )
    ap.add_argument(
        "--reuse-crawl",
        action="store_true",
        dest="reuse_crawl",
        help="不重爬：沿用库里本期 raw_items / issue_events，仅重做摘要与 payload（常与 --force 同用）",
    )
    args = ap.parse_args()
    db = SessionLocal()
    try:
        run(db, force=args.force, reuse_crawl=args.reuse_crawl)
    finally:
        db.close()


if __name__ == "__main__":
    main()
