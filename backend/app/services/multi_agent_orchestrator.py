from __future__ import annotations

import copy
import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.deliverability_pipeline import (
    apply_email_notification_pipeline,
    sanitize_urls_in_payload,
)
from app.services.email_notification import format_email_validation_errors, validate_email_payload
from app.services.publish_weekly_page import publish_weekly_report, weekly_report_public_url
from app.services.digest_builder import build_payload_from_raw_items
from app.services.llm_json_client import LlmJsonClient
from app.services.payload_schema import finalize_payload_v3, format_errors, validate_payload
from app.services.phase35_compat import (
    apply_locked_top3_merge_judgments,
    compute_weekly_quality_v2_audit,
    sync_legacy_top3_from_judgments,
    weekly_prompt_hard_rules,
)
from app.services.slim_weekly_render import (
    is_full_prd_v3_payload,
    merge_phase35_into_payload,
    slim_merge_to_prd_v3,
)
from app.services.top3_selector import (
    apply_locked_top3_merge,
    build_enriched_event_cards,
    build_top3_comparison_log,
    build_top3_selection_audit,
    calculate_top3_score,
    compact_for_section_prompt,
    compact_for_top3_prompt,
    count_candidates_passing_user_value_gate,
    select_top3,
)

_log = logging.getLogger("uvicorn.error")

# EventCards LLM：控制单次请求体量（规则预筛选 + 分批）
MAX_LLM_EVENTS = 40
EVENT_CARD_BATCH_SIZE = 10


def _chunk_list(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _deterministic_event_card(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": event.get("event_id"),
        "title": event.get("title") or "",
        "url": event.get("url") or "",
        "published_at": None,
        "one_liner": (str(event.get("summary") or event.get("title") or ""))[:80],
        "impact_bullets": [],
        "evidence": [{"url": event.get("url")}] if event.get("url") else [],
        "confidence": {"level": "medium", "reasons": ["fallback deterministic card"]},
        "score": event.get("score_total", 0),
    }


def _preselect_events_for_llm(events: list[dict[str, Any]], max_items: int = MAX_LLM_EVENTS) -> list[dict[str, Any]]:
    def _score(e: dict[str, Any]) -> int:
        return int(e.get("score_total") or 0)

    valid = [e for e in events if e.get("title") and e.get("url")]
    valid.sort(key=_score, reverse=True)
    return valid[:max_items]


def _dedupe_event_cards_by_id(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for c in cards:
        eid = str(c.get("event_id") or "")
        if not eid or eid in seen:
            continue
        seen.add(eid)
        out.append(c)
    return out


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


def _stable_event_id_for_pool_item(it: Any, pool_index: int) -> str:
    """
    周报候选池 event_id：优先 GlobalEvent 主键（与 /api/events/:id 一致），否则池内序号 e01（legacy）。
    """
    if isinstance(it, dict):
        gid = it.get("global_event_id")
        if gid is not None:
            try:
                return str(int(gid))
            except (TypeError, ValueError):
                pass
    return f"e{pool_index:02d}"


def _build_url_to_event_id_map(events: list[dict[str, Any]]) -> dict[str, str]:
    from app.services.top3_selector import normalize_url

    m: dict[str, str] = {}
    for e in events:
        if not isinstance(e, dict):
            continue
        u = normalize_url(str(e.get("url") or ""))
        if u:
            m[u] = str(e.get("event_id") or "")
    return m


def _align_json_pack_events_by_url(pack: Any, url_to_id: dict[str, str]) -> None:
    """将 Verifier / Impact 等 JSON 里的 events[].event_id 按 URL 对齐到稳定 id。"""
    from app.services.top3_selector import normalize_url

    if not isinstance(pack, dict) or not url_to_id:
        return
    for ev in pack.get("events") or []:
        if not isinstance(ev, dict):
            continue
        for key in ("canonical_url", "url"):
            u = normalize_url(str(ev.get(key) or ""))
            if u and u in url_to_id:
                ev["event_id"] = url_to_id[u]
                break


def _align_event_cards_by_url(cards: list[dict[str, Any]], url_to_id: dict[str, str]) -> None:
    from app.services.top3_selector import normalize_url

    if not url_to_id:
        return
    for c in cards:
        if not isinstance(c, dict):
            continue
        u = normalize_url(str(c.get("url") or ""))
        if u in url_to_id:
            c["event_id"] = url_to_id[u]


def _align_scoring_issues_event_ids(scoring: Any, canonical_events: list[dict[str, Any]]) -> None:
    """
    Scoring 仅输出 event_id（无 URL）；模型仍可能写 e04。
    按与传入 LLM 相同的事件顺序，把 eNN 映射为 canonical_events 里对应条的稳定 id。
    """
    if not isinstance(scoring, dict) or not canonical_events:
        return
    alias: dict[str, str] = {}
    for i, ev in enumerate(canonical_events, start=1):
        if not isinstance(ev, dict):
            continue
        cid = str(ev.get("event_id") or "").strip()
        if cid:
            alias[f"e{i:02d}"] = cid
    if not alias:
        return
    for iss in scoring.get("issues") or []:
        if not isinstance(iss, dict):
            continue
        eid = str(iss.get("event_id") or "").strip()
        if eid in alias:
            iss["event_id"] = alias[eid]


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
    Cleaner → … → Composer → Editor(可选) → Quality Auditor(可选) →
    finalize_payload_v3 + validate_payload → Publish Weekly Page →
    Email Packager / 通知邮件 → validate_email_payload

    候选池默认已由 IssueEvent 预合并；Merger 阶段仅记录说明，不二次调用 LLM。
    """

    def __init__(self) -> None:
        self.llm = LlmJsonClient()

    def build(
        self,
        *,
        raw_items: list[Any],
        top_n: int = 20,
        weekly_main_link: str | None = None,
        report_date: date | None = None,
        db: Session | None = None,
    ) -> MultiAgentResult:
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

        events: list[dict[str, Any]] = []
        for i, it in enumerate(pool, 1):
            title, summary, url, score_total = _read_pool_item(it, i)
            events.append(
                {
                    "event_id": _stable_event_id_for_pool_item(it, i),
                    "title": title,
                    "summary": summary[:800],
                    "url": url,
                    "score_total": int(score_total),
                }
            )

        url_to_canonical_event_id = _build_url_to_event_id_map(events)

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
        _align_json_pack_events_by_url(verifier, url_to_canonical_event_id)

        # Impact Analyst（决策增强：每条必须有明确 action）
        impact = self.llm.complete_json(
            system=(
                "You output JSON only. "
                "You are an AI decision analyst for NON-TECHNICAL readers (busy professionals, not developers). "
                "You MUST translate events into actionable decisions AND score direct user value. "
                "Avoid vague language like '可尝试','可参考','可能'. "
                "Every output must include a clear action suggestion."
            ),
            user=(
                "基于 fact_sheet 和事件摘要，为每条事件输出（缺一不可）：\n"
                "- one_liner（<=40字，事实）\n"
                "- impact_bullets（最多2条）\n"
                "- action（必须是明确动作：现在用 / 可以替代 / 建议忽略 / 先观望）\n"
                "- user_value_score：整数 0-100，衡量「普通非技术读者是否有直接可用价值」"
                "（产品可试用、明确省时间/省钱、对日常工作有帮助 → 高分；"
                "纯论文/基准/GitHub star、融资八卦、仅开发者关心的框架细节 → 低分）\n"
                "- user_value_reason：<=120字，一句话解释分数依据（中文）\n"
                "- audience_type：必须是下列之一："
                "general_user | founder | manager | student | developer | enterprise\n"
                "- actionability：必须是下列之一："
                "now_try（现在可试用）| watch（值得关注但不必马上动手）| ignore（可对本期忽略）| "
                "not_for_general_user（主要面向开发者/研究者，不适合作为本周大众 Top3）\n\n"
                "要求：\n"
                "1. 必须是“你”视角\n"
                "2. 禁止使用：可尝试、可参考、可能\n"
                "3. 必须替用户做判断；若条目只对开发者重要，actionability 必须 not_for_general_user\n\n"
                f"fact_sheet：{_safe_json(verifier)}\n\n"
                f"事件列表：{_safe_json(events)}\n\n"
                '输出结构：{ "events": [ {"event_id","one_liner","impact_bullets","action",'
                '"user_value_score","user_value_reason","audience_type","actionability"} ] }\n'
            ),
            temperature=0.4,
        )
        _align_json_pack_events_by_url(impact, url_to_canonical_event_id)

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
        _align_scoring_issues_event_ids(scoring, events)

        # EventCards（分批组装；失败批次降级为确定性卡片，避免单次 80 条超时）
        selected_events = _preselect_events_for_llm(events, max_items=MAX_LLM_EVENTS)
        all_event_cards: list[dict[str, Any]] = []
        event_card_errors: list[dict[str, Any]] = []

        for batch_index, batch in enumerate(_chunk_list(selected_events, EVENT_CARD_BATCH_SIZE), start=1):
            try:
                batch_result = self.llm.complete_json(
                    system=(
                        "You output JSON only. "
                        "You are an orchestrator assembling compact EventCards. "
                        "Keep every field short. Do not output HTML. "
                        "Do not invent facts. Use only the provided events and fact_sheet."
                    ),
                    user=(
                        "把 fact_sheet + impact_notes 合并成 EventCard 列表。\n"
                        "每条 EventCard 必须包含：\n"
                        "- event_id\n"
                        "- title\n"
                        "- url\n"
                        "- published_at: null\n"
                        "- one_liner: <=40字\n"
                        "- impact_bullets: 最多2条，每条<=25字\n"
                        "- evidence: 至少1条url\n"
                        "- confidence\n"
                        "- score\n\n"
                        "注意：\n"
                        "1. 只处理本批事件\n"
                        "2. 不要输出长段落\n"
                        "3. 不要输出 HTML\n"
                        "4. 不要输出 Markdown\n\n"
                        f"fact_sheet：{_safe_json(verifier)}\n\n"
                        f"impact_notes：{_safe_json(impact)}\n\n"
                        f"score_audit：{_safe_json(scoring)}\n\n"
                        f"本批事件：{_safe_json(batch)}\n\n"
                        '输出结构：{ "event_cards": [ ... ] }\n'
                    ),
                    temperature=0.2,
                    timeout_s=120.0,
                )

                if isinstance(batch_result, dict) and isinstance(batch_result.get("event_cards"), list):
                    all_event_cards.extend(batch_result["event_cards"])
                else:
                    raise ValueError("event_cards batch result invalid")

            except Exception as exc:
                event_card_errors.append(
                    {
                        "batch_index": batch_index,
                        "error": str(exc),
                        "event_ids": [e.get("event_id") for e in batch],
                    }
                )
                for event in batch:
                    all_event_cards.append(_deterministic_event_card(event))

        all_event_cards = _dedupe_event_cards_by_id(all_event_cards)
        _align_event_cards_by_url(all_event_cards, url_to_canonical_event_id)
        event_cards = {"event_cards": all_event_cards}

        ev_pack = event_cards if isinstance(event_cards, dict) else {}
        cards_list = ev_pack.get("event_cards") if isinstance(ev_pack.get("event_cards"), list) else []

        enriched_events = build_enriched_event_cards(
            cards_list,
            pool,
            verifier=verifier if isinstance(verifier, dict) else None,
            impact=impact if isinstance(impact, dict) else None,
            scoring=scoring if isinstance(scoring, dict) else None,
        )
        for ee in enriched_events:
            ee["top3_score"] = calculate_top3_score(ee)

        top3_locked = select_top3(enriched_events)
        if not top3_locked:
            return _fallback(
                "Top3 为空：候选池内无任何条目同时满足置信度/品类/事实校验与用户价值门槛。",
                extra_notes=["检查 Impact user_value / actionability，或放宽入库噪声过滤。"],
            )

        uv_gate_count = count_candidates_passing_user_value_gate(enriched_events)
        insufficient_high_value_events = uv_gate_count < 3
        top3_comparison_log = build_top3_comparison_log(enriched_events, top3_locked)

        top3_selection_audit = build_top3_selection_audit(enriched_events, top3_locked)
        top3_ids = {str(x.get("event_id")) for x in top3_locked if x.get("event_id")}
        section_enriched = [e for e in enriched_events if str(e.get("event_id")) not in top3_ids]
        top3_prompt_rows = [compact_for_top3_prompt(e) for e in top3_locked]

        n_top = len(top3_locked)
        heading_cn = "本周重点事件" if insufficient_high_value_events else "Top3 关键事件"

        _log.info(
            "top3_p0_compare final=%s uv_gate_count=%s insufficient_uv=%s hi_heat_uv_blocked=%d",
            [x.get("event_id") for x in top3_locked],
            uv_gate_count,
            insufficient_high_value_events,
            len(top3_comparison_log.get("high_heat_blocked_by_user_value") or []),
        )

        # Capability Analyst：legacy capabilities + Phase 3.5 capability_boundaries
        capability = self.llm.complete_json(
            system=(
                "You output JSON only. "
                "You analyze AI capability boundaries. "
                "Your goal is to answer: Can AI do X now — yes or no, under what limits?"
            ),
            user=(
                weekly_prompt_hard_rules()
                + "\n\n从 event_cards 中选择 1-2 个最重要能力主题，输出两部分：\n\n"
                "A) capabilities（兼容旧渲染）：每项含 theme/can_do/cannot_do/cost/suitable_for/conclusion。\n"
                "B) capability_boundaries（新版）：每项必须含 question、conclusion（明确能不能）、"
                "can_do（最多3条字符串）、cannot_do（最多3条）、best_for、recommendation（行动建议）、"
                "confidence（高|中|低）、related_event_ids（可为空数组）。\n\n"
                "硬规则：conclusion 必须明确；不能只提问不给答案。\n\n"
                f"event_cards：{_safe_json(cards_list[:24])}\n\n"
                '输出 JSON：{ "capabilities": [ ... ], "capability_boundaries": [ ... ] }\n'
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

        # Glossary（只允许技术/能力概念；禁止公司名、活动名当术语）
        glossary_out = self.llm.complete_json(
            system="You output JSON only. You write a concise Chinese glossary.",
            user=(
                weekly_prompt_hard_rules()
                + "\n\n基于 event_cards 输出 glossary 数组（5-10条，不要超过10条），每条 {term,explain<=50字}。\n"
                "只允许：技术概念、模型能力、Agent/工作流概念、本周反复出现的新能力名词。\n"
                "禁止：普通公司名、活动名、新闻标题、人名、一次性品牌动作。\n\n"
                f"event_cards：{_safe_json(event_cards)}\n\n"
                "输出结构：{ \"glossary\": [ ... ] }\n"
            ),
            temperature=0.3,
        )

        # Thesis Agent（本周主线判断）
        thesis_out = self.llm.complete_json(
            system="You output JSON only. You are the editor-in-chief of AI Pulse.",
            user=(
                weekly_prompt_hard_rules()
                + "\n\n你是主编。任务不是汇总新闻，而是提炼本周 AI 行业主线判断。\n"
                "必须输出 JSON：{ \"weekly_thesis\": { \"headline\", \"summary\", \"trend_lines\": [] } }\n"
                "headline 必须是一句判断式陈述（不是标题党）。summary 2-3 句解释主线。trend_lines 最多 3 条。\n"
                "禁止罗列新闻标题；禁止空泛词。\n\n"
                f"event_cards：{_safe_json(cards_list[:28])}\n\n"
                "只输出 JSON。\n"
            ),
            temperature=0.35,
        )

        noise_compact = [
            {
                "event_id": e.get("event_id"),
                "title": e.get("title"),
                "category": e.get("category"),
                "user_value_score": e.get("user_value_score"),
                "actionability": e.get("actionability"),
                "source_type": e.get("source_type"),
            }
            for e in enriched_events[:48]
        ]
        noise_out = self.llm.complete_json(
            system="You output JSON only. You filter noisy AI news for busy readers.",
            user=(
                weekly_prompt_hard_rules()
                + "\n\n你是噪音过滤器：帮用户节省注意力。\n"
                "找出至少 2 条：看起来热闹但对普通用户/创业者行动价值弱的事件（活动预告、品牌 PR、节日内容、弱相关营销等）。\n"
                '输出 JSON：{ "noise_to_ignore": [ {"name","why_not_important","recommendation":"可以忽略","related_event_ids":[]} ] }\n'
                "related_event_ids 使用下列 event_id。\n\n"
                f"候选事件：{_safe_json(noise_compact)}\n\n"
                "只输出 JSON。\n"
            ),
            temperature=0.35,
        )

        cap_block = capability if isinstance(capability, dict) else {}
        caps_for_prompt = cap_block.get("capabilities") if isinstance(cap_block.get("capabilities"), list) else []

        cards_compact = [compact_for_section_prompt(e) for e in section_enriched[:48]]

        # Composer：短 JSON；capabilities 仍由 slim_merge 注入；Top3 条目由算法锁定，模型仅润色
        composer_raw = self.llm.complete_json(
            system=(
                "You output JSON only. "
                "You are generating a high-value AI judgment weekly — not a news digest. "
                "Top3 entries are FIXED by the server: you must NOT change Top3 URLs or order. "
                "Sections are for facts. NEVER repeat the same explanation in both Top3 and sections."
            ),
            user=(
                weekly_prompt_hard_rules()
                + "\n\n根据下列材料写中文周报 JSON。禁止输出 capabilities / capability_boundaries（由服务端注入）。\n\n"
                f"【{heading_cn}】已由系统算法选定：共 {n_top} 条；top3 与 top3_judgments 必须与 top3_candidates 顺序、条数一致；"
                "不得更换 URL。\n\n"
                "【weekly_thesis 草案】（正文须与之共振，可改写措辞）：\n"
                f"{_safe_json(thesis_out)}\n\n"
                "【输出 JSON 键名固定】\n"
                "{\n"
                '  "simple_lines": [ {"title","what_happened"(<=30字),"what_it_means_for_you","url"} ] 约5条,\n'
                f'  "top3": [ {{"title","url","what_happened","why_important","what_it_means_for_you","attention_level":"1"-"5"}} ] 恰好{n_top}条,\n'
                f'  "top3_judgments": [ {{"title","related_event_ids":[],"what_happened","why_it_matters","who_should_care","what_to_do_now",'
                f'"action_level":"现在试用|先观望|可以忽略","pulse_score":0,"source_urls":[]}} ] 恰好{n_top}条（判断式，不得写成纯新闻摘要；'
                "三条不得全部同一 category；不得全部为 GitHub/开源项目叙事；必须与 weekly_thesis 主线一致），\n"
                '  "sections": [ {"title":"大模型更新"|"工具/产品"|"行业动态",'
                ' "items":[{"title","url","what_happened","suitable_for","worth_attention":"High|Medium|Low",'
                '"what_it_means_for_you","see_top3":bool}] } ] 恰好3个板块,\n'
                '  "tools": [ {"name","can_do","suitable_for","worth_trying":"Yes|No","what_it_means_for_you"} ] 0-3条,\n'
                '  "tools_to_try": [ {"name","what_it_does","best_for","barrier":"低|中|高","recommendation":"现在试用|先观望",'
                '"related_event_ids":[],"url":""} ] 2-4条（强调怎么试、适合谁；勿复述 Top3 叙事角度）,\n'
                '  "category_recap": [ {"category":"大模型更新"|"工具与产品"|"行业动态"|"开源项目","trend","representative_events":[],"'
                ' "what_to_watch"} ] 至少3条（trend 写趋势不写流水账；representative_events 每项为简短中文标题字符串，最多4条）,\n'
                '  "footer": "",\n'
                '  "glossary": [ {"term","explain"} ] 可填空数组（空则服务端用 glossary_hint）\n'
                "}\n\n"
                "重要规则：\n"
                "1. Top3 / top3_judgments：每条必须包含明确「现在怎么做」；judgments.action_level 只能是三种枚举之一。\n"
                "2. 如果事件已在 Top3 中出现：sections 中 see_top3=true，且不重复展开。\n"
                "3. tools_to_try 选真实可试用工具；纯热度但不可用则不写。\n"
                "4. section 条目 url 来自 section_candidates；Top3 url 与 top3_candidates 完全一致。\n\n"
                f"top3_candidates：{_safe_json(top3_prompt_rows)}\n\n"
                f"section_candidates：{_safe_json(cards_compact)}\n\n"
                "capability 参考（勿写入 capabilities 键）：\n"
                f"{_safe_json(caps_for_prompt)}\n\n"
                f"trends：{_safe_json(trends)}\n\n"
                f"glossary_hint：{_safe_json(glossary_out)}\n\n"
                "只输出一个 JSON 对象。\n"
            ),
            temperature=0.2,
            timeout_s=300.0,
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

        composer_out = merge_phase35_into_payload(
            composer_out,
            capability_block=cap_block,
            thesis_block=thesis_out if isinstance(thesis_out, dict) else {},
            noise_block=noise_out if isinstance(noise_out, dict) else {},
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

        editor_out = _force_replace_text(editor_out)
        if not isinstance(editor_out, dict):
            editor_out = composer_out if isinstance(composer_out, dict) else {}

        apply_locked_top3_merge(editor_out, top3_locked)
        norm_ed = editor_out.setdefault("normal", {})
        if isinstance(norm_ed, dict):
            apply_locked_top3_merge_judgments(norm_ed, top3_locked)
            sync_legacy_top3_from_judgments(norm_ed)
        if len(top3_locked) < 3:
            editor_out["allow_short_top3"] = True
        if insufficient_high_value_events:
            editor_out.setdefault("normal", {})["top3_section_title"] = "本周重点事件"

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
        sanitized_prd = sanitize_urls_in_payload(copy.deepcopy(payload_in))

        weekly_global = (settings.weekly_source or "legacy").strip().lower() == "global_events"
        if db is not None and report_date is not None and weekly_global:
            try:
                from app.services.weekly_event_score_service import apply_global_event_weekly_top3_to_payload

                apply_global_event_weekly_top3_to_payload(db, sanitized_prd, report_date)
            except Exception:
                logging.getLogger(__name__).exception("apply_global_event_weekly_top3_to_payload failed")

        f_out = finalize_payload_v3(sanitized_prd)
        errors = validate_payload(f_out)
        if errors:
            return _fallback(
                "payload schema validation failed after compose/edit.",
                extra_notes=[format_errors(errors)],
            )

        d_min = int(getattr(settings, "multi_agent_deliverability_min_score", 70))
        d_rw = int(getattr(settings, "multi_agent_deliverability_rewrite_below", 85))
        d_en = getattr(settings, "multi_agent_enable_deliverability", True)
        d_strict = getattr(settings, "multi_agent_deliverability_strict", True)

        if report_date is not None:
            if db is not None:
                weekly_url = publish_weekly_report(db, f_out, report_date, settings=settings)
            else:
                weekly_url = weekly_report_public_url(report_date, settings=settings)
        else:
            weekly_url = (weekly_main_link or "").strip() or (
                f"{settings.weekly_public_base_url.rstrip('/')}/weekly/latest"
            )
        f_out["weekly_url"] = weekly_url

        f_out, email_notification_artifact = apply_email_notification_pipeline(
            self.llm,
            f_out,
            enabled=d_en,
            weekly_main_link=weekly_url,
            rewrite_score_threshold=d_rw,
            min_score=d_min,
            strict=d_strict,
        )

        ev_errors = validate_email_payload(f_out.get("email_payload") or {}, settings=settings)

        audit = {
            "generated_at": _now_iso(),
            "mode": "multi_agent_prd_v3",
            "top3_comparison_log": top3_comparison_log,
            "insufficient_high_value_events": insufficient_high_value_events,
            "top3_selection_audit": top3_selection_audit,
            "pipeline": [
                "cleaner",
                "merger",
                "verifier",
                "impact_analyst",
                "scoring",
                "event_cards",
                "top3_selector",
                "capability",
                "trends",
                "glossary",
                "thesis",
                "noise_filter",
                "composer",
                "editor" if getattr(settings, "multi_agent_enable_editor", False) else "editor_skipped",
                "auditor" if getattr(settings, "multi_agent_enable_auditor", False) else "auditor_skipped",
                "finalize_payload_v3",
                "validate_payload",
                "publish_weekly_page",
                "email_notification"
                if getattr(settings, "multi_agent_enable_deliverability", True)
                else "email_notification_skipped",
                "validate_email_payload",
            ],
            "issues": (scoring.get("issues") if isinstance(scoring, dict) else []) or [],
            "notes": [
                f"event_cards generated in batches; selected={len(selected_events)}, "
                f"cards={len(all_event_cards)}, errors={len(event_card_errors)}"
            ],
            "auditor": auditor_report if isinstance(auditor_report, dict) else {},
            "publish_weekly_page": {
                "weekly_url": weekly_url,
                "report_date": report_date.isoformat() if report_date else None,
            },
            "validate_email_payload": {
                "ok": not bool(ev_errors),
                "errors": [f"{e.path}: {e.message}" for e in ev_errors] if ev_errors else [],
            },
            "email_notification": email_notification_artifact,
        }
        audit.update(compute_weekly_quality_v2_audit(f_out))

        artifacts: dict[str, Any] = {
            "cleaner": cleaner_report,
            "merger": merger_report,
            "verifier": verifier,
            "impact_analyst": impact,
            "scoring": scoring,
            "event_cards": event_cards,
            "event_card_errors": event_card_errors,
            "selected_events_count": len(selected_events),
            "event_card_count": len(all_event_cards),
            "top3_locked": top3_locked,
            "top3_comparison_log": top3_comparison_log,
            "insufficient_high_value_events": insufficient_high_value_events,
            "top3_selection_audit": top3_selection_audit,
            "capability": capability,
            "trends": trends,
            "glossary": glossary_out,
            "thesis": thesis_out if isinstance(thesis_out, dict) else {},
            "noise_filter": noise_out if isinstance(noise_out, dict) else {},
            "composer_slim_raw": composer_raw if isinstance(composer_raw, dict) else {},
            "composer": composer_out,
            "editor": editor_out,
            "auditor": auditor_report,
            "publish_weekly_page": {"weekly_url": weekly_url, "report_date": report_date.isoformat() if report_date else None},
            "validate_email_payload": {"ok": not bool(ev_errors), "errors": [f"{e.path}: {e.message}" for e in ev_errors] if ev_errors else []},
            "email_notification": email_notification_artifact,
        }
        return MultiAgentResult(payload=f_out, audit_report=audit, artifacts=artifacts)
