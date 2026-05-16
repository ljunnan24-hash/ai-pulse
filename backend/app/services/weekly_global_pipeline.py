"""
基于每日 global_events + weekly_score 的精简周刊流水线。

页面仅需要：本周判断、Top3（链事件详情）、能力边界、术语。
不再跑 legacy 全量抓取式多 Agent（Impact / EventCards / Composer sections 等）。
"""

from __future__ import annotations

import copy
import logging
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.deliverability_pipeline import (
    apply_email_notification_pipeline,
    sanitize_urls_in_payload,
)
from app.services.email_notification import validate_email_payload
from app.services.llm_json_client import LlmJsonClient
from app.services.multi_agent_orchestrator import MultiAgentResult, _force_replace_text, _now_iso, _safe_json
from app.services.payload_schema import finalize_payload_v3, format_errors, validate_payload
from app.services.phase35_compat import compute_weekly_quality_v2_audit, weekly_prompt_hard_rules
from app.services.publish_weekly_page import publish_weekly_report, weekly_report_public_url
from app.services.slim_weekly_render import merge_phase35_into_payload
from app.services.weekly_event_score_service import (
    recompute_weekly_event_scores_for_period,
    resolve_global_weekly_top3_rows,
)
from app.services.weekly_from_rankings_service import global_events_to_orchestrator_dicts

_log = logging.getLogger("uvicorn.error")


def _clip_short(s: str, n: int) -> str:
    t = (s or "").replace("\n", " ").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def _simple_lines_from_top3(top3: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for row in top3[:5]:
        if not isinstance(row, dict):
            continue
        lines.append(
            {
                "title": str(row.get("title") or "")[:200],
                "what_happened": _clip_short(str(row.get("what_happened") or row.get("title") or ""), 30),
                "what_it_means_for_you": _clip_short(str(row.get("what_it_means_for_you") or ""), 120),
                "url": str(row.get("url") or row.get("detail_url") or ""),
            }
        )
    return lines


def _compact_pool_for_llm(pool_events: list[Any], *, top_n: int) -> list[dict[str, Any]]:
    """GlobalEvent → 轻量 dict，供 Thesis / Capability / Glossary 引用。"""
    dicts = global_events_to_orchestrator_dicts(list(pool_events))
    return dicts[: max(1, top_n)]


def _deterministic_thesis(top3: list[dict[str, Any]]) -> dict[str, Any]:
    if not top3:
        return {
            "weekly_thesis": {
                "headline": "本周有效 AI 信号较少，宜先消化已有信息再行动。",
                "summary": "候选事件不足，下期将继续从每日榜单汇总。",
                "trend_lines": [],
            }
        }
    t0 = top3[0]
    title = str(t0.get("title") or "本周重点事件")[:80]
    return {
        "weekly_thesis": {
            "headline": f"本周最值得跟进的线索集中在：{title} 等相关动态。",
            "summary": "以下三条来自本周每日榜单高分事件，正文解读以榜单与详情页为准。",
            "trend_lines": [],
        }
    }


def build_global_weekly_payload(
    db: Session,
    *,
    period_start: date,
    pool_events: list[Any],
    top_n_llm: int = 20,
    enable_llm: bool = True,
) -> MultiAgentResult:
    """
  生成周刊 payload（global_events 路径）。

  - Top3：weekly_score 定候选池，LLM 选最重要 3 条（失败则分数 Top3）；字段来自 GlobalEvent / 日榜 Insight
  - LLM（可选）：Top3 选题 + weekly_thesis、capability_boundaries、glossary
  - 校验：finalize_payload_v3、validate_payload、邮件送达率（若开启）
    """
    settings = get_settings()
    recompute_weekly_event_scores_for_period(db, period_start, report_date=period_start)

    client = LlmJsonClient()
    top3_rows, top3_selection_audit = resolve_global_weekly_top3_rows(
        db,
        period_start,
        list(pool_events),
        client=client,
        enable_llm=enable_llm,
        hard_rules=weekly_prompt_hard_rules(),
        limit=3,
    )
    pool_compact = _compact_pool_for_llm(pool_events, top_n=top_n_llm)

    thesis_block: dict[str, Any] = {}
    capability_block: dict[str, Any] = {}
    glossary_block: dict[str, Any] = {"glossary": []}
    llm_notes: list[str] = []

    if enable_llm and client.is_configured():
        thesis_block = client.complete_json(
            system="You output JSON only. You are the editor-in-chief of AI Pulse weekly report.",
            user=(
                weekly_prompt_hard_rules()
                + "\n\n你是主编。根据下列「本周每日榜单高分事件」写主线判断，不是新闻摘要合集。\n"
                '输出 JSON：{ "weekly_thesis": { "headline", "summary", "trend_lines": [] } }\n'
                "headline 必须是一句判断式陈述；summary 2-3 句；trend_lines 最多 3 条。\n\n"
                f"候选事件（已按 weekly_score 排序）：\n{_safe_json(pool_compact)}\n\n"
                f"本周 Top3 已由主编选定（勿改 event_id/url）：\n{_safe_json(top3_rows)}\n"
            ),
            temperature=0.35,
        )
        capability_block = client.complete_json(
            system="You output JSON only. You analyze AI capability boundaries for non-technical readers.",
            user=(
                weekly_prompt_hard_rules()
                + "\n\n从候选事件中选 1-2 个能力主题，输出 capability_boundaries：\n"
                "每项含 question、conclusion（明确能不能）、can_do、cannot_do、best_for、recommendation、confidence（高|中|低）。\n\n"
                f"候选事件：\n{_safe_json(pool_compact)}\n\n"
                '输出 JSON：{ "capability_boundaries": [ ... ] }\n'
            ),
            temperature=0.35,
        )
        glossary_block = client.complete_json(
            system="You output JSON only. You write a concise Chinese glossary.",
            user=(
                weekly_prompt_hard_rules()
                + "\n\n基于候选事件输出 glossary 5-8 条，每条 {term, explain<=50字}。\n"
                "只允许技术/能力概念；禁止公司名、活动名、新闻标题。\n\n"
                f"候选事件：\n{_safe_json(pool_compact)}\n\n"
                '输出 JSON：{ "glossary": [ ... ] }\n'
            ),
            temperature=0.3,
        )
    else:
        llm_notes.append("LLM skipped or not configured; thesis/capability/glossary use fallbacks.")
        thesis_block = _deterministic_thesis(top3_rows)

    gloss_list = glossary_block.get("glossary") if isinstance(glossary_block, dict) else []
    if not isinstance(gloss_list, list):
        gloss_list = []

    payload: dict[str, Any] = {
        "weekly_top3_global_events_only": True,
        "allow_short_top3": len(top3_rows) < 3,
        "simple": {
            "lines": _simple_lines_from_top3(top3_rows),
            "footer": "",
        },
        "normal": {
            "top3": top3_rows,
            "sections": [],
            "capabilities": [],
            "tools": [],
        },
        "glossary": gloss_list,
    }

    payload = merge_phase35_into_payload(
        payload,
        capability_block=capability_block if isinstance(capability_block, dict) else {},
        thesis_block=thesis_block if isinstance(thesis_block, dict) else _deterministic_thesis(top3_rows),
        noise_block=None,
    )
    payload = _force_replace_text(payload)
    payload = finalize_payload_v3(payload)

    errors = validate_payload(payload)
    if errors:
        _log.warning("weekly_global_pipeline: validate_payload issues: %s", format_errors(errors))

    weekly_url = publish_weekly_report(db, payload, period_start, settings=settings)
    payload["weekly_url"] = weekly_url

    d_en = bool(getattr(settings, "multi_agent_enable_deliverability", True))
    email_artifact: dict[str, Any] = {}
    if enable_llm and client.is_configured() and d_en:
        sanitized = sanitize_urls_in_payload(copy.deepcopy(payload))
        sanitized, email_artifact = apply_email_notification_pipeline(
            client,
            sanitized,
            enabled=True,
            weekly_main_link=weekly_url,
            rewrite_score_threshold=int(getattr(settings, "multi_agent_deliverability_rewrite_below", 85)),
            min_score=int(getattr(settings, "multi_agent_deliverability_min_score", 70)),
            strict=bool(getattr(settings, "multi_agent_deliverability_strict", True)),
        )
        payload = sanitized

    ev_errors = validate_email_payload(payload.get("email_payload") or {}, settings=settings)

    audit: dict[str, Any] = {
        "generated_at": _now_iso(),
        "mode": "weekly_global_slim",
        "pipeline": [
            "recompute_weekly_event_scores",
            "select_pool_by_weekly_score",
            "select_top3_llm_from_weekly_score_pool",
            "thesis_agent",
            "capability_boundaries",
            "glossary",
            "finalize_payload_v3",
            "validate_payload",
            "publish_weekly_page",
            "email_notification" if d_en and enable_llm else "email_notification_skipped",
        ],
        "notes": llm_notes,
        "top3_event_ids": [r.get("event_id") for r in top3_rows],
        "top3_selection": top3_selection_audit,
        "pool_event_ids": [d.get("global_event_id") for d in pool_compact],
        "publish_weekly_page": {
            "weekly_url": weekly_url,
            "report_date": period_start.isoformat(),
        },
        "validate_email_payload": {
            "ok": not bool(ev_errors),
            "errors": [f"{e.path}: {e.message}" for e in ev_errors] if ev_errors else [],
        },
        "email_notification": email_artifact,
    }
    audit.update(compute_weekly_quality_v2_audit(payload))

    artifacts: dict[str, Any] = {
        "thesis": thesis_block,
        "capability": capability_block,
        "glossary": glossary_block,
        "top3_rows": top3_rows,
        "top3_selection": top3_selection_audit,
        "pool_compact": pool_compact,
    }
    return MultiAgentResult(payload=payload, audit_report=audit, artifacts=artifacts)
