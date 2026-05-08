"""
周一凌晨由 cron 调用（推荐北京时间 04:10，见 deploy/crontab.example）：
  cd backend && python -m app.jobs.generate_weekly

默认多 Agent（Cleaner→Verifier→Impact→…→Composer）。
单次豆包 summarize：MULTI_AGENT_WEEKLY=false（可选 MULTI_AGENT_DIGEST_TOP_N=20）

本期已是 ready 时默认跳过；若要**不改 period、整期重跑**（仍对应当周周一）：
  python -m app.jobs.generate_weekly --force
或环境变量 GENERATE_WEEKLY_FORCE=1

**不重爬**（沿用库里本期已入库的 raw_items / issue_events，只重做评分池之后的生成）：
  python -m app.jobs.generate_weekly --reuse-crawl --force
或仅生成：`python -m app.jobs.build_weekly_multi_agent`
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
from app.services.crawler_service import collect_all_feed_items
from app.services.issue_events_service import (
    candidates_to_summarize_input,
    fetch_digest_candidates,
    rebuild_issue_events,
)
from app.services.weekly_from_rankings_service import (
    global_events_to_orchestrator_dicts,
    select_global_events_for_weekly,
)
from app.services.weekly_issue_snapshot import append_weekly_issue_snapshot
from app.services.deliverability_pipeline import apply_email_notification_pipeline
from app.services.llm_json_client import LlmJsonClient
from app.services.multi_agent_orchestrator import MultiAgentOrchestrator
from app.services.publish_weekly_page import publish_weekly_report, weekly_report_public_url
from app.services.scoring_service import score_item
from app.services.summarizer_service import normalize_payload, payload_to_texts, summarize_items
from app.services.email_notification import validate_email_payload
from app.timeutil import current_period_monday


def _top3_titles_from_payload(payload: dict[str, Any]) -> list[str]:
    normal = payload.get("normal") if isinstance(payload.get("normal"), dict) else {}
    top3 = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    out: list[str] = []
    for t in top3:
        if isinstance(t, dict):
            tit = str(t.get("title") or "").strip()
            if tit:
                out.append(tit[:300])
    return out


def _weekly_quality_summary_multi_agent(
    audit: dict[str, Any] | None,
    artifacts: dict[str, Any] | None,
    payload: dict[str, Any],
    *,
    settings: Any,
) -> dict[str, Any]:
    """generate_weekly 多 Agent 成功路径后的质量摘要（写入 audit_report_json）。"""
    warnings: list[str] = []
    audit = audit if isinstance(audit, dict) else {}
    artifacts = artifacts if isinstance(artifacts, dict) else {}

    normal = payload.get("normal") if isinstance(payload.get("normal"), dict) else {}
    top3 = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    final_top3_count = len(top3)
    top3_titles = _top3_titles_from_payload(payload)

    comp = audit.get("top3_comparison_log")
    if not isinstance(comp, dict):
        comp = {}

    final_entries = comp.get("final_top3")
    if not isinstance(final_entries, list) or not final_entries:
        sel_audit = audit.get("top3_selection_audit")
        if isinstance(sel_audit, list):
            uvs = []
            sel_ids = {str(x.get("event_id")) for x in (artifacts.get("top3_locked") or []) if isinstance(x, dict)}
            for row in sel_audit:
                if not isinstance(row, dict):
                    continue
                if str(row.get("event_id")) in sel_ids and row.get("selected_for_top3"):
                    uvs.append(float(row.get("user_value_score") or 0))
            avg_user_value_score = round(sum(uvs) / len(uvs), 1) if uvs else 0.0
        else:
            avg_user_value_score = 0.0
    else:
        uvs = [float(x.get("user_value_score") or 0) for x in final_entries if isinstance(x, dict)]
        avg_user_value_score = round(sum(uvs) / len(uvs), 1) if uvs else 0.0

    locked = artifacts.get("top3_locked")
    github_count_in_top3 = 0
    if isinstance(locked, list):
        for row in locked:
            if isinstance(row, dict) and str(row.get("source_type") or "").lower() == "github":
                github_count_in_top3 += 1

    blocked = comp.get("high_heat_blocked_by_user_value")
    high_heat_blocked_count = len(blocked) if isinstance(blocked, list) else 0

    insufficient_high_value_events = bool(audit.get("insufficient_high_value_events"))

    ep_direct = validate_email_payload(payload.get("email_payload") or {}, settings=settings)
    email_payload_valid = len(ep_direct) == 0
    if ep_direct:
        warnings.append("email_payload: " + "; ".join(f"{e.path}: {e.message}" for e in ep_direct[:3]))

    weekly_url = str(payload.get("weekly_url") or "").strip()

    if audit.get("mode") == "fallback":
        warnings.append("multi_agent_mode=fallback")
    if insufficient_high_value_events:
        warnings.append("insufficient_high_value_events")
    if final_top3_count < 3:
        warnings.append(f"short_top3_count={final_top3_count}")

    return {
        "final_top3_count": final_top3_count,
        "top3_titles": top3_titles,
        "avg_user_value_score": avg_user_value_score,
        "github_count_in_top3": github_count_in_top3,
        "high_heat_blocked_count": high_heat_blocked_count,
        "insufficient_high_value_events": insufficient_high_value_events,
        "email_payload_valid": email_payload_valid,
        "weekly_url": weekly_url,
        "warnings": warnings,
    }


def _weekly_quality_summary_summarize_path(payload: dict[str, Any], *, settings: Any) -> dict[str, Any]:
    """单次 summarize 路径（无多 Agent / 无 UV 审计）。"""
    warnings: list[str] = []
    normal = payload.get("normal") if isinstance(payload.get("normal"), dict) else {}
    top3 = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    final_top3_count = len(top3)
    top3_titles = _top3_titles_from_payload(payload)

    ep_errs = validate_email_payload(payload.get("email_payload") or {}, settings=settings)
    email_payload_valid = len(ep_errs) == 0
    if not email_payload_valid:
        warnings.append("email_payload: " + "; ".join(f"{e.path}: {e.message}" for e in ep_errs[:3]))

    weekly_url = str(payload.get("weekly_url") or "").strip()

    return {
        "final_top3_count": final_top3_count,
        "top3_titles": top3_titles,
        "avg_user_value_score": 0.0,
        "github_count_in_top3": 0,
        "high_heat_blocked_count": 0,
        "insufficient_high_value_events": False,
        "email_payload_valid": email_payload_valid,
        "weekly_url": weekly_url,
        "warnings": warnings + ["pipeline=summarize_items_only"],
    }


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
    if existing_ready and force and not reuse_crawl:
        print(f"generate_weekly: --force / GENERATE_WEEKLY_FORCE，将重新爬取并覆盖本期 {period} 的 payload（period_start 不变）。")
    if existing_ready and force and reuse_crawl:
        print(
            f"generate_weekly: --reuse-crawl + --force，将沿用库内抓取数据并覆盖本期 {period} 的 payload。"
        )

    issue = db.execute(
        select(WeeklyIssue).where(WeeklyIssue.period_start == period).order_by(WeeklyIssue.id.asc())
    ).scalars().first()
    if not issue:
        if reuse_crawl:
            print("reuse_crawl: 本期尚无 weekly_issues 记录，请先完整运行一次 generate_weekly（含抓取）。")
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
    weekly_global = (settings.weekly_source or "legacy").strip().lower() == "global_events"
    selection_report_global: dict[str, Any] | None = None

    if weekly_global:
        _require_global_events_table(db)

    if reuse_crawl:
        print(
            "generate_weekly: --reuse-crawl，跳过清空表、抓取与 rebuild_issue_events；"
            "直接使用本期已有 raw_items / issue_events。"
        )
        if weekly_global:
            print(
                "generate_weekly: WEEKLY_SOURCE=global_events — 仍从 global_events 选题（不使用本期 issue 内抓取数据）。"
            )
    elif weekly_global:
        db.execute(delete(IssueEvent).where(IssueEvent.issue_id == issue.id))
        db.execute(delete(RawItem).where(RawItem.issue_id == issue.id))
        db.commit()
        print("generate_weekly: WEEKLY_SOURCE=global_events，已清空本期周刊专用 raw/issue_events，跳过 RSS 抓取。")
    else:
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

    if weekly_global:
        selected, selection_report_global = select_global_events_for_weekly(
            db,
            period_start=period,
            limit=max(1, int(getattr(settings, "global_events_pool_limit", 40) or 40)),
            lookback_days=max(1, int(getattr(settings, "global_events_lookback_days", 7) or 7)),
            min_candidates=max(0, int(getattr(settings, "global_events_min_candidates", 8) or 8)),
            fallback_lookback_days=max(
                1, int(getattr(settings, "global_events_fallback_lookback_days", 14) or 14)
            ),
        )
        candidates = global_events_to_orchestrator_dicts(selected)
        items = candidates
        if selection_report_global.get("insufficient_global_events"):
            print(
                "generate_weekly: 警告 — global_events 候选少于 min_candidates；仍将生成（薄周报 / orchestrator fallback）。"
            )
        print(
            f"generate_weekly: global_events 选题 {len(candidates)} 条 "
            f"(fallback_lookback_used={selection_report_global.get('fallback_lookback_used')})."
        )
    else:
        candidates = fetch_digest_candidates(db, issue.id)
        items = candidates_to_summarize_input(candidates)
        if not items:
            print("No digest candidates after merge; abort without marking ready.")
            return
    use_ma = bool(getattr(settings, "multi_agent_weekly", False))
    top_n = max(5, min(int(getattr(settings, "multi_agent_digest_top_n", 20) or 20), 60))

    if not use_ma and not items:
        print(
            "generate_weekly: 选题池为空，无法使用单次 summarize；请开启 MULTI_AGENT_WEEKLY 或补充 global_events / 抓取数据。"
        )
        return

    audit_report_to_store: dict[str, Any] | None = None
    weekly_quality_summary: dict[str, Any] | None = None

    if use_ma:
        orch = MultiAgentOrchestrator()
        res = orch.build(
            raw_items=list(candidates),
            top_n=top_n,
            report_date=period,
            db=db,
        )
        payload = normalize_payload(res.payload)
        audit_report_to_store = res.audit_report if isinstance(res.audit_report, dict) else {}
        weekly_quality_summary = _weekly_quality_summary_multi_agent(
            audit_report_to_store,
            res.artifacts,
            payload,
            settings=settings,
        )
        audit_report_to_store["weekly_quality_summary"] = weekly_quality_summary
        if selection_report_global:
            audit_report_to_store["weekly_global_selection"] = selection_report_global

        audit_path = os.path.join(os.getcwd(), f"audit_report_{period.isoformat()}.json")
        try:
            with open(audit_path, "w", encoding="utf-8") as f:
                json.dump(audit_report_to_store, f, ensure_ascii=False, indent=2)
            print(f"Multi-agent pipeline OK; audit: {audit_path}")
        except OSError as exc:
            print(f"audit report write failed: {exc}")
    else:
        try:
            payload = summarize_items(items)
        except Exception as e:
            print(f"Summarizer failed: {e}")
            raise
        publish_weekly_report(db, payload, period, settings=settings)
        payload["weekly_url"] = weekly_report_public_url(period, settings=settings)
        llm = LlmJsonClient()
        payload, _ = apply_email_notification_pipeline(
            llm,
            payload,
            enabled=bool(getattr(settings, "multi_agent_enable_deliverability", True)),
            weekly_main_link=payload["weekly_url"],
            rewrite_score_threshold=int(getattr(settings, "multi_agent_deliverability_rewrite_below", 85)),
            min_score=int(getattr(settings, "multi_agent_deliverability_min_score", 70)),
            strict=bool(getattr(settings, "multi_agent_deliverability_strict", True)),
        )
        weekly_quality_summary = _weekly_quality_summary_summarize_path(payload, settings=settings)
        audit_report_to_store = {"weekly_quality_summary": weekly_quality_summary}
        if selection_report_global:
            audit_report_to_store["weekly_global_selection"] = selection_report_global

    simple_text, normal_text, glossary_json = payload_to_texts(payload)

    issue.simple_text = simple_text
    issue.normal_text = normal_text
    issue.glossary_json = glossary_json
    issue.payload_json = json.dumps(payload, ensure_ascii=False)
    issue.status = IssueStatus.ready.value
    issue.ready_at = datetime.now(timezone.utc)
    if weekly_global:
        if reuse_crawl:
            snap_src = "generate_weekly_global_events_reuse_force" if force else "generate_weekly_global_events_reuse"
        else:
            snap_src = "generate_weekly_global_events_force" if force else "generate_weekly_global_events"
    elif reuse_crawl:
        snap_src = "generate_weekly_reuse_force" if force else "generate_weekly_reuse"
    else:
        snap_src = "generate_weekly_force" if force else "generate_weekly"
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
