from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.services.digest_builder import build_payload_from_raw_items
from app.services.llm_json_client import LlmJsonClient
from app.services.payload_schema import finalize_payload_v3, format_errors, validate_payload


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def _read_pool_item(it: Any, idx: int) -> tuple[str, str, str, int]:
    if isinstance(it, dict):
        title = str(it.get("title", ""))
        summary = str(it.get("summary", ""))
        url = str(it.get("link") or it.get("url", ""))
        st = int(it.get("score_total") or it.get("_score_total") or 0)
    else:
        title = str(getattr(it, "title", "") or "")
        summary = str(getattr(it, "summary", "") or "")
        url = str(getattr(it, "link", "") or "")
        st = int(getattr(it, "score_total", 0) or 0)
    return title, summary, url, st


def _cleaner_filter(pool: list[Any]) -> tuple[list[Any], dict[str, Any]]:
    """PRD [Cleaner]：过滤明显垃圾/空条目（确定性，不调用 LLM）。"""
    dropped: list[dict[str, str]] = []
    kept: list[Any] = []
    spam_kw = ("casino", "viagra", "博彩", "六合彩", "click here to win")
    for it in pool:
        title, summary, _, _ = _read_pool_item(it, 0)
        t = (title or "").strip()
        s = (summary or "").strip()
        blob = f"{t}\n{s}".lower()
        if len(t) < 4 and len(s) < 8:
            dropped.append({"reason": "too_empty", "preview": t[:120]})
            continue
        if any(k in blob for k in spam_kw):
            dropped.append({"reason": "spam_heuristic", "preview": t[:120]})
            continue
        kept.append(it)
    report = {
        "stage": "cleaner",
        "input_count": len(pool),
        "kept_count": len(kept),
        "dropped": dropped[:50],
    }
    return kept, report


@dataclass
class MultiAgentResult:
    payload: dict[str, Any]
    audit_report: dict[str, Any]
    artifacts: dict[str, Any]


class MultiAgentOrchestrator:
    """
    PRD §6.3 多 Agent 流水线（串行 JSON 调用 + 确定性 Cleaner）：
    Cleaner → Merger(说明) → Verifier → Impact → Scoring → EventCards →
    Capability → Trend → Glossary → Composer → Editor(可选) → Auditor(可选)

    候选池默认已由 IssueEvent 预合并；Merger 阶段仅记录说明，不二次调用 LLM。
    """

    def __init__(self) -> None:
        self.llm = LlmJsonClient()

    def build(self, *, raw_items: list[Any], top_n: int = 20) -> MultiAgentResult:
        settings = get_settings()
        pool_all = list(raw_items)[: max(int(top_n), 1)]

        def _fallback(reason: str, extra_notes: list[str] | None = None) -> MultiAgentResult:
            payload, _ = build_payload_from_raw_items(pool_all, mode="normal", keywords=[])
            audit = {
                "generated_at": _now_iso(),
                "mode": "fallback",
                "pipeline": [],
                "notes": [reason] + (extra_notes or []),
                "issues": [],
            }
            return MultiAgentResult(payload=payload, audit_report=audit, artifacts={})

        if not self.llm.is_configured():
            return _fallback("LLM not configured; payload assembled deterministically from raw_items.")

        cleaned, cleaner_report = _cleaner_filter(pool_all)
        if not cleaned:
            return _fallback("cleaner removed all candidates; empty pool after filter.")

        pool = cleaned
        merger_report = {
            "stage": "merger",
            "note": "事件已在入库阶段按 IssueEvent 合并；本流水线不再对同源重复做 LLM 合并。",
        }

        events = []
        for i, it in enumerate(pool, 1):
            title, summary, url, score_total = _read_pool_item(it, i)
            events.append(
                {
                    "event_id": f"e{i:02d}",
                    "title": title,
                    "summary": summary[:800],
                    "url": url,
                    "score_total": int(score_total),
                }
            )

        # Verifier（PRD）
        verifier = self.llm.complete_json(
            system="You output JSON only. You are a cautious fact checker for AI news.",
            user=(
                "给定事件列表（含标题/摘要/链接），输出严格 JSON。\n"
                "对每条事件：\n"
                "- canonical_title/canonical_url\n"
                "- confidence.level=high|medium|low\n"
                "- confidence.reasons: 数组\n"
                "- verified_facts: 数组（尽量简短，允许为空）\n"
                "- conflicts: 数组（字段冲突则写，没有则空数组）\n\n"
                f"事件列表：\n{_safe_json(events)}\n\n"
                "输出结构：{ \"events\": [ ... ] }\n"
            ),
            temperature=0.2,
        )

        # Impact Analyst
        impact = self.llm.complete_json(
            system="You output JSON only. You write for non-technical Chinese professionals.",
            user=(
                "基于 fact_sheet 和事件摘要，为每条事件输出：\n"
                "- one_liner（<=40字）\n"
                "- impact_bullets（2-3条，每条<=25字）\n\n"
                f"fact_sheet：{_safe_json(verifier)}\n\n"
                f"事件列表：{_safe_json(events)}\n\n"
                "输出结构：{ \"events\": [ {\"event_id\":\"...\",\"one_liner\":\"...\",\"impact_bullets\":[...]} ] }\n"
            ),
            temperature=0.4,
        )

        # Scoring（审计噪声/重复）
        scoring = self.llm.complete_json(
            system="You output JSON only. You audit ranking for noise and duplication.",
            user=(
                "基于事件分数与摘要，找出可能的：噪音霸榜、重复事件、低可信高分等问题。\n"
                "输出 issues 数组，每项包含 severity=high|medium|low、event_id、message、suggestion。\n\n"
                f"fact_sheet：{_safe_json(verifier)}\n\n"
                f"事件列表：{_safe_json(events)}\n\n"
                "输出结构：{ \"issues\": [ ... ] }\n"
            ),
            temperature=0.2,
        )

        # EventCards（组装草稿，对应 PRD EventCard Pool）
        event_cards = self.llm.complete_json(
            system="You output JSON only. You are an orchestrator assembling event cards.",
            user=(
                "把 fact_sheet + impact_notes 合并成 EventCard 列表。\n"
                "每条 EventCard 至少包含：event_id,title,url,published_at(null),one_liner,impact_bullets,evidence[],confidence,score。\n"
                "evidence 至少 1 条 url。\n\n"
                f"fact_sheet：{_safe_json(verifier)}\n\n"
                f"impact_notes：{_safe_json(impact)}\n\n"
                f"score_audit：{_safe_json(scoring)}\n\n"
                f"事件列表：{_safe_json(events)}\n\n"
                "输出结构：{ \"event_cards\": [ ... ] }\n"
            ),
            temperature=0.2,
        )

        ev_pack = event_cards if isinstance(event_cards, dict) else {}
        cards_list = ev_pack.get("event_cards") if isinstance(ev_pack.get("event_cards"), list) else []

        # Capability Analyst（PRD：AI 能力进展独立工种）
        capability = self.llm.complete_json(
            system="You output JSON only. You analyze AI capability boundaries for non-technical readers.",
            user=(
                "基于下列 event_cards，输出 PRD「AI 能力进展」模块：1-3 条，每条含：\n"
                "theme（面向用户的短问题）, can_do, cannot_do, cost, suitable_for, conclusion（一句话）。\n"
                "不要编造具体产品参数；不确定写保守表述。\n\n"
                f"event_cards：{_safe_json(cards_list[:24])}\n\n"
                "只输出 JSON：{ \"capabilities\": [ ... ] }\n"
            ),
            temperature=0.35,
        )

        # Trend
        trends = self.llm.complete_json(
            system="You output JSON only. You synthesize trends from events.",
            user=(
                "基于 event_cards 输出 1-3 条趋势，每条包含：title,summary,evidence_event_ids。\n\n"
                f"event_cards：{_safe_json(event_cards)}\n\n"
                "输出结构：{ \"trends\": [ ... ] }\n"
            ),
            temperature=0.4,
        )

        # Glossary
        glossary_out = self.llm.complete_json(
            system="You output JSON only. You write a concise Chinese glossary.",
            user=(
                "基于 event_cards 输出 glossary 数组（5-12条），每条 {term,explain<=50字}。\n\n"
                f"event_cards：{_safe_json(event_cards)}\n\n"
                "输出结构：{ \"glossary\": [ ... ] }\n"
            ),
            temperature=0.3,
        )

        cap_block = capability if isinstance(capability, dict) else {}
        caps_for_prompt = cap_block.get("capabilities") if isinstance(cap_block.get("capabilities"), list) else []

        # Composer：组装 payload v3
        composer_out = self.llm.complete_json(
            system="You output JSON only. You assemble the weekly payload; do not invent URLs.",
            user=(
                "根据 event_cards + capability分析 + trends + glossary 组装最终 payload.json，必须严格为 PRD v3：\n"
                "{\n"
                '  "simple": {"lines": ['
                '{"title","what_happened"(<=30字),"what_it_means_for_you","url"}], "footer": "" },\n'
                '  "normal": {\n'
                '    "top3": ['
                '{"title","url","what_happened","why_important","what_it_means_for_you","attention_level":"1-5"} x3 ],\n'
                '    "sections": [ {"title":"大模型更新"|"工具/产品"|"行业动态", '
                '"items": [{ "title","url","what_happened","suitable_for",'
                '"worth_attention":"High|Medium|Low","what_it_means_for_you","see_top3": bool }] } ] x3 ,\n'
                '    "capabilities": 直接使用下列 capability 数组（可微调措辞但保留事实级别）,\n'
                '    "tools": [{ "name","can_do","suitable_for","worth_trying":"Yes|No","what_it_means_for_you" }] （0-3条）\n'
                "  },\n"
                '  "glossary": [{"term","explain": "<=50字"}] （5-12条）\n'
                "}\n"
                "normal.capabilities 必须与下列 capability 分析一致（条目数量与主题一致）：\n"
                f"{_safe_json(caps_for_prompt)}\n\n"
                "规则：Top3 与分类重复项 see_top3=true；用「你」视角；不确定不写进事实句。\n\n"
                f"event_cards：{_safe_json(event_cards)}\n\n"
                f"trends：{_safe_json(trends)}\n\n"
                f"glossary：{_safe_json(glossary_out)}\n\n"
                "只输出 JSON。\n"
            ),
            temperature=0.2,
        )

        # Editor（可选）：文体收口
        editor_out: dict[str, Any]
        if getattr(settings, "multi_agent_enable_editor", False):
            editor_out = self.llm.complete_json(
                system="You output JSON only. You are a Chinese editor: tighten wording, 你视角, no jargon stacking; do not change URLs or schema.",
                user=(
                    "下列为周报 JSON，请润色中文表述并保持结构与键名完全一致；不得删减必填数组长度约束。\n\n"
                    f"{_safe_json(composer_out if isinstance(composer_out, dict) else {})}\n"
                ),
                temperature=0.15,
            )
            if not isinstance(editor_out, dict):
                editor_out = composer_out if isinstance(composer_out, dict) else {}
        else:
            editor_out = composer_out if isinstance(composer_out, dict) else {}

        # Auditor（可选）：高风险则回退确定性组装
        auditor_report: dict[str, Any] = {"stage": "auditor", "skipped": True}
        if getattr(settings, "multi_agent_enable_auditor", False):
            auditor_report = self.llm.complete_json(
                system="You output JSON only. You audit newsletter safety and grounding.",
                user=(
                    "给定 event_cards（证据锚点）与即将发出的 payload，检查是否存在明显编造事实、"
                    "与证据 URL 严重冲突的断言。\n"
                    "输出严格 JSON："
                    '{ "risk_level": "low|medium|high", "use_fallback": false, "reasons": ["..."] }\n'
                    "仅在确信存在严重编造或危险误导时置 use_fallback=true。\n\n"
                    f"event_cards：{_safe_json(event_cards)}\n\n"
                    f"payload：{_safe_json(editor_out)}\n"
                ),
                temperature=0.05,
            )
            if isinstance(auditor_report, dict):
                if str(auditor_report.get("risk_level") or "").lower() == "high" or auditor_report.get("use_fallback") is True:
                    return _fallback(
                        "auditor requested fallback (high risk or use_fallback).",
                        extra_notes=[_safe_json(auditor_report)],
                    )

        payload_in = editor_out
        f_out = finalize_payload_v3(payload_in if isinstance(payload_in, dict) else {})
        errors = validate_payload(f_out)
        if errors:
            return _fallback(
                "payload schema validation failed after compose/edit.",
                extra_notes=[format_errors(errors)],
            )

        audit = {
            "generated_at": _now_iso(),
            "mode": "multi_agent_prd_v3",
            "pipeline": [
                "cleaner",
                "merger",
                "verifier",
                "impact_analyst",
                "scoring",
                "event_cards",
                "capability",
                "trends",
                "glossary",
                "composer",
                "editor" if getattr(settings, "multi_agent_enable_editor", False) else "editor_skipped",
                "auditor" if getattr(settings, "multi_agent_enable_auditor", False) else "auditor_skipped",
            ],
            "issues": (scoring.get("issues") if isinstance(scoring, dict) else []) or [],
            "notes": [],
            "auditor": auditor_report if isinstance(auditor_report, dict) else {},
        }

        artifacts: dict[str, Any] = {
            "cleaner": cleaner_report,
            "merger": merger_report,
            "verifier": verifier,
            "impact_analyst": impact,
            "scoring": scoring,
            "event_cards": event_cards,
            "capability": capability,
            "trends": trends,
            "glossary": glossary_out,
            "composer": composer_out,
            "editor": editor_out,
            "auditor": auditor_report,
        }
        return MultiAgentResult(payload=f_out, audit_report=audit, artifacts=artifacts)
