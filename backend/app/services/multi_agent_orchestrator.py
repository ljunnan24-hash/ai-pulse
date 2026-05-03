from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.services.deliverability_pipeline import (
    apply_deliverability_pipeline,
    should_fallback_after_deliverability,
)
from app.services.digest_builder import build_payload_from_raw_items
from app.services.llm_json_client import LlmJsonClient
from app.services.payload_schema import finalize_payload_v3, format_errors, validate_payload
from app.services.slim_weekly_render import is_full_prd_v3_payload, slim_merge_to_prd_v3


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def _force_replace_text(obj: Any) -> Any:
    """弱化模糊措辞（Composer/Editor 后兜底，不改变 URL 结构）。"""
    if isinstance(obj, dict):
        return {k: _force_replace_text(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_force_replace_text(i) for i in obj]
    if isinstance(obj, str):
        replacements = (
            ("可尝试", "建议使用"),
            ("可参考", "可以直接用"),
            ("有望", "将会"),
        )
        out = obj
        for k, v in replacements:
            out = out.replace(k, v)
        # 弱化「可能」，但保留「可能性」等固定词
        out = re.sub(r"(?<!性)可能(?!性)", "可以", out)
        return out
    return obj


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
    Capability → Trend → Glossary → Composer → Editor(可选) → Quality Auditor(可选) →
    Email Deliverability Auditor → Rewriter(按需) → finalize

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

        # Impact Analyst（决策增强：每条必须有明确 action）
        impact = self.llm.complete_json(
            system=(
                "You output JSON only. "
                "You are an AI decision analyst for non-technical users. "
                "You MUST translate events into actionable decisions. "
                "Avoid vague language like '可尝试','可参考','可能'. "
                "Every output must include a clear action suggestion."
            ),
            user=(
                "基于 fact_sheet 和事件摘要，为每条事件输出：\n"
                "- one_liner（<=40字，事实）\n"
                "- impact_bullets（最多2条）\n"
                "- action（必须是明确动作：现在用 / 可以替代 / 建议忽略 / 先观望）\n\n"
                "要求：\n"
                "1. 必须是“你”视角\n"
                "2. 禁止使用：可尝试、可参考、可能\n"
                "3. 必须替用户做判断\n\n"
                f"fact_sheet：{_safe_json(verifier)}\n\n"
                f"事件列表：{_safe_json(events)}\n\n"
                '输出结构：{ "events": [ {"event_id","one_liner","impact_bullets","action"} ] }\n'
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

        # Capability Analyst（结论型：强判断 + 禁止模糊总结段落）
        capability = self.llm.complete_json(
            system=(
                "You output JSON only. "
                "You analyze AI capability boundaries. "
                "Your goal is to answer: Can AI replace something now?"
            ),
            user=(
                "从 event_cards 中选择 1-2 个最重要能力主题，输出结构化判断：\n\n"
                "每个主题必须包含：\n"
                "- theme（问题形式，如：AI编程工具现在能不能替代付费工具？）\n"
                "- can_do（3条以内）\n"
                "- cannot_do（2条以内）\n"
                "- cost（低/中/高）\n"
                "- suitable_for\n"
                "- conclusion（必须是强判断：可以替代 / 不建议现在用 / 仅适合部分场景）\n\n"
                "要求：\n"
                "1. 必须给结论\n"
                "2. 不允许写总结段落\n"
                "3. 不允许模糊表达\n\n"
                f"event_cards：{_safe_json(cards_list[:24])}\n\n"
                '输出 JSON：{ "capabilities": [ ... ] }\n'
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

        cards_compact: list[dict[str, Any]] = []
        for c in cards_list[:48]:
            if not isinstance(c, dict):
                continue
            cards_compact.append(
                {
                    "event_id": c.get("event_id"),
                    "title": c.get("title"),
                    "url": c.get("url"),
                    "one_liner": c.get("one_liner"),
                }
            )

        # Composer：短 JSON；capabilities 仍由 slim_merge 注入；此处强调 Top3=决策、分类=补充事实、去重
        composer_raw = self.llm.complete_json(
            system=(
                "You output JSON only. "
                "You are generating a high-value AI decision newsletter. "
                "Top3 is for decision. Sections are for facts. "
                "NEVER repeat the same explanation in both Top3 and sections. "
                "Top3 must include actionable decisions."
            ),
            user=(
                "根据下列材料写中文周报要点。禁止输出 capabilities 字段（由服务端注入 capability 分析结果）。\n\n"
                "【输出 JSON 键名固定】\n"
                "{\n"
                '  "simple_lines": [ {"title","what_happened"(<=30字),"what_it_means_for_you","url"} ] 约5条,\n'
                '  "top3": [ {"title","url","what_happened","why_important","what_it_means_for_you","attention_level":"1"-"5"} ] 恰好3条,\n'
                '  "sections": [ {"title":"大模型更新"|"工具/产品"|"行业动态",'
                ' "items":[{"title","url","what_happened","suitable_for","worth_attention":"High|Medium|Low",'
                '"what_it_means_for_you","see_top3":bool}] } ] 恰好3个板块,\n'
                '  "tools": [ {"name","can_do","suitable_for","worth_trying":"Yes|No","what_it_means_for_you"} ] 0-3条,\n'
                '  "footer": "",\n'
                '  "glossary": [ {"term","explain"} ] 可填空数组（空则服务端用 glossary_hint）\n'
                "}\n\n"
                "重要规则：\n"
                "1. 如果事件已在 Top3 中出现：\n"
                "   - sections 中该事件必须 see_top3=true\n"
                "   - 不得重复 why_important 和 what_it_means_for_you\n"
                "   - 只写事实补充\n\n"
                "2. Top3 必须提供决策建议：\n"
                "   - 是否现在使用\n"
                "   - 是否替代现有方案\n\n"
                "3. 所有 what_it_means_for_you 必须包含行动词：\n"
                "   - 现在用 / 可以替代 / 建议忽略 / 先观望\n\n"
                "4. 禁止泛化表达：\n"
                "   - 不允许 '可尝试','可参考','可能','有望'\n\n"
                "5. tools 模块必须包含：\n"
                "   - worth_trying: Yes 或 No\n\n"
                "6. 所有 url 必须从 event_cards_compact 逐字复制。\n\n"
                "capability 正文参考（勿写入 JSON 的 capabilities 键）：\n"
                f"{_safe_json(caps_for_prompt)}\n\n"
                f"event_cards_compact：{_safe_json(cards_compact)}\n\n"
                f"trends：{_safe_json(trends)}\n\n"
                f"glossary_hint：{_safe_json(glossary_out)}\n\n"
                "只输出一个 JSON 对象。\n"
            ),
            temperature=0.2,
            timeout_s=240.0,
        )

        cr = composer_raw if isinstance(composer_raw, dict) else {}
        if is_full_prd_v3_payload(cr):
            composer_out = cr
        else:
            composer_out = slim_merge_to_prd_v3(
                cr,
                capabilities=caps_for_prompt,
                glossary_fallback=glossary_out if isinstance(glossary_out, dict) else {},
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
                timeout_s=240.0,
            )
            if not isinstance(editor_out, dict):
                editor_out = composer_out if isinstance(composer_out, dict) else {}
        else:
            editor_out = composer_out if isinstance(composer_out, dict) else {}

        editor_out = _force_replace_text(editor_out)
        if not isinstance(editor_out, dict):
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

        payload_in = editor_out if isinstance(editor_out, dict) else {}

        deliverability_artifact: dict[str, Any]
        d_min = int(getattr(settings, "multi_agent_deliverability_min_score", 70))
        d_rw = int(getattr(settings, "multi_agent_deliverability_rewrite_below", 85))
        d_en = getattr(settings, "multi_agent_enable_deliverability", True)
        payload_in, deliverability_artifact = apply_deliverability_pipeline(
            self.llm,
            payload_in,
            enabled=d_en,
            rewrite_score_threshold=d_rw,
        )
        if d_en and getattr(settings, "multi_agent_deliverability_strict", True):
            fb_d, reason_d = should_fallback_after_deliverability(
                deliverability_artifact, min_score=d_min
            )
            if fb_d:
                return _fallback(
                    f"deliverability: {reason_d}",
                    extra_notes=[_safe_json(deliverability_artifact)],
                )

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
                "deliverability"
                if getattr(settings, "multi_agent_enable_deliverability", True)
                else "deliverability_skipped",
            ],
            "issues": (scoring.get("issues") if isinstance(scoring, dict) else []) or [],
            "notes": [],
            "auditor": auditor_report if isinstance(auditor_report, dict) else {},
            "deliverability": deliverability_artifact,
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
            "composer_slim_raw": composer_raw if isinstance(composer_raw, dict) else {},
            "composer": composer_out,
            "editor": editor_out,
            "auditor": auditor_report,
            "deliverability": deliverability_artifact,
        }
        return MultiAgentResult(payload=f_out, audit_report=audit, artifacts=artifacts)
