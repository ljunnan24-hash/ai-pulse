from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final, Iterable

from app.services.phase35_compat import (
    apply_backward_compat_from_phase35,
    backfill_top3_judgments_category_from_top3,
    extract_clean_phase35_normal,
    pick_category_fields,
)

# PRD v3 分类（与 prd.md 4.2.2 一致，无 emoji 键名便于 JSON）
SECTION_TITLES: Final[frozenset[str]] = frozenset({"大模型更新", "工具/产品", "行业动态"})
# 渲染与组装顺序（sorted(set) 不可靠）
SECTION_ORDER: Final[tuple[str, ...]] = ("大模型更新", "工具/产品", "行业动态")

# 历史 payload 中的板块名 -> 升级映射
_LEGACY_SECTION_MAP = {
    "AI工具/产品发布": "工具/产品",
    "行业重要动态": "行业动态",
}

_WORTH = frozenset({"High", "Medium", "Low"})
_WORTHING_TOOL = frozenset({"Yes", "No"})


@dataclass(frozen=True)
class ValidationError:
    path: str
    message: str


def _is_str(x: Any) -> bool:
    return isinstance(x, str)


def _clip(s: str, n: int) -> str:
    t = (s or "").replace("\n", " ").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def ensure_payload_v3(raw: dict[str, Any] | None) -> dict[str, Any]:
    """
    将历史/混合格式统一为 PRD v3 结构，供校验与渲染使用。
    """
    if not isinstance(raw, dict):
        raw = {}
    simple = raw.get("simple")
    if not isinstance(simple, dict):
        simple = {}
    lines_in = simple.get("lines") if isinstance(simple.get("lines"), list) else []
    clean_lines: list[dict[str, str]] = []
    for ln in lines_in:
        if not isinstance(ln, dict):
            continue
        title = str(ln.get("title") or ln.get("text") or "").strip()
        url = str(ln.get("url") or "").strip()
        wh = str(ln.get("what_happened") or "").strip()
        wu = str(ln.get("what_it_means_for_you") or "").strip()
        if not title and url:
            title = url
        if not wh and title:
            wh = _clip(title, 30)
        if not wu:
            wu = "帮助你判断此事是否与你的工作场景相关。"
        if title:
            clean_lines.append(
                {
                    "title": title[:300],
                    "what_happened": _clip(wh, 30) if wh else _clip(title, 30),
                    "what_it_means_for_you": wu[:400],
                    "url": url[:2048],
                }
            )

    normal = raw.get("normal")
    if not isinstance(normal, dict):
        normal = {}
    # 延迟导入：避免 payload_schema ↔ top3_selector ↔ digest_builder 循环依赖
    from app.services.top3_selector import _dedupe_ids_ordered, _dedupe_urls_ordered

    top3_in = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    clean_top3: list[dict[str, Any]] = []
    for t in top3_in:
        if not isinstance(t, dict):
            continue
        title = str(t.get("title") or "").strip()
        url = str(t.get("url") or "").strip()
        if not title:
            continue
        row: dict[str, Any] = {
            "title": title[:200],
            "url": url[:2048],
            "what_happened": str(t.get("what_happened") or "")[:800] or _clip(title, 120),
            "why_important": str(t.get("why_important") or "")[:800],
            "what_it_means_for_you": str(t.get("what_it_means_for_you") or "")[:800],
            "attention_level": str(t.get("attention_level") or "3")[:8],
        }
        cat_top = pick_category_fields(t if isinstance(t, dict) else {})
        if cat_top:
            row["category"] = cat_top[:64]
        eid_top = str(t.get("event_id") if t.get("event_id") is not None else "").strip()
        if eid_top:
            row["event_id"] = eid_top
        su = t.get("source_urls")
        if isinstance(su, list):
            extras_u = [str(x).strip() for x in su if str(x).strip()]
            row["source_urls"] = _dedupe_urls_ordered(url or None, extras_u, max_n=8)
        rel = t.get("related_event_ids")
        if isinstance(rel, list):
            rel_list = [str(x).strip() for x in rel if str(x).strip()]
            row["related_event_ids"] = list(_dedupe_ids_ordered(eid_top or None, rel_list, max_n=12))
        rsk = t.get("related_stable_keys")
        if isinstance(rsk, list):
            row["related_stable_keys"] = [str(x).strip() for x in rsk if str(x).strip()][:12]
        for ext_k in ("pulse_score", "ranking_score", "weekly_score", "weekly_rank", "detail_url", "category_slug"):
            if ext_k not in t:
                continue
            v = t[ext_k]
            if v is None:
                continue
            if isinstance(v, str) and not v.strip():
                continue
            row[ext_k] = v
        if isinstance(t.get("weekly_score_reasons"), dict):
            row["weekly_score_reasons"] = t["weekly_score_reasons"]
        clean_top3.append(row)

    sections_out: list[dict[str, Any]] = []
    for sec in normal.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        sec_title = str(sec.get("title") or "")
        sec_title = _LEGACY_SECTION_MAP.get(sec_title, sec_title)
        if "items" in sec and isinstance(sec.get("items"), list):
            items = sec["items"]
        else:
            # 旧版整段 paragraph
            para = str(sec.get("paragraph") or "")
            if para.strip():
                items = [
                    {
                        "title": "本分类要点",
                        "url": "",
                        "what_happened": _clip(para, 500),
                        "suitable_for": "",
                        "worth_attention": "Medium",
                        "what_it_means_for_you": "",
                        "see_top3": False,
                    }
                ]
            else:
                items = []
        fixed_items: list[dict[str, Any]] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            tit = str(it.get("title") or "").strip()
            if not tit:
                continue
            fixed_items.append(
                {
                    "title": tit[:300],
                    "url": str(it.get("url") or "")[:2048],
                    "what_happened": str(it.get("what_happened") or "")[:800],
                    "suitable_for": str(it.get("suitable_for") or "")[:400],
                    "worth_attention": str(it.get("worth_attention") or "Medium"),
                    "what_it_means_for_you": str(it.get("what_it_means_for_you") or "")[:800],
                    "see_top3": bool(it.get("see_top3")),
                }
            )
        if sec_title in SECTION_TITLES and fixed_items:
            sections_out.append({"title": sec_title, "items": fixed_items})

    cap_in = normal.get("capabilities")
    if not isinstance(cap_in, list):
        cap_in = []
    capabilities: list[dict[str, str]] = []
    for c in cap_in:
        if not isinstance(c, dict):
            continue
        theme = str(c.get("theme") or "").strip()
        if not theme:
            continue
        capabilities.append(
            {
                "theme": theme[:200],
                "can_do": str(c.get("can_do") or "")[:1200],
                "cannot_do": str(c.get("cannot_do") or "")[:1200],
                "cost": str(c.get("cost") or "")[:400],
                "suitable_for": str(c.get("suitable_for") or "")[:400],
                "conclusion": str(c.get("conclusion") or "")[:500],
            }
        )

    tools_in = normal.get("tools")
    if not isinstance(tools_in, list):
        tools_in = []
    tools: list[dict[str, str]] = []
    for t in tools_in:
        if not isinstance(t, dict):
            continue
        name = str(t.get("name") or "").strip()
        if not name:
            continue
        tools.append(
            {
                "name": name[:200],
                "can_do": str(t.get("can_do") or "")[:800],
                "suitable_for": str(t.get("suitable_for") or "")[:400],
                "worth_trying": str(t.get("worth_trying") or "No"),
                "what_it_means_for_you": str(t.get("what_it_means_for_you") or "")[:800],
            }
        )

    glossary_in = raw.get("glossary") if isinstance(raw.get("glossary"), list) else []
    glossary: list[dict[str, str]] = []
    for g in glossary_in:
        if isinstance(g, dict) and g.get("term"):
            glossary.append(
                {
                    "term": str(g.get("term", ""))[:64],
                    "explain": str(g.get("explain", ""))[:120],
                }
            )

    out: dict[str, Any] = {
        "simple": {
            "lines": clean_lines[:10],
            "footer": str(simple.get("footer") or ""),
        },
        "normal": {
            "top3": clean_top3[:5],
            "sections": sections_out,
            "capabilities": capabilities[:5],
            "tools": tools[:10],
        },
        "glossary": glossary,
    }
    p35 = extract_clean_phase35_normal(normal if isinstance(normal, dict) else None)
    if p35:
        out["normal"].update(p35)
    if isinstance(raw, dict):
        if raw.get("allow_short_top3"):
            out["allow_short_top3"] = True
        if raw.get("weekly_top3_global_events_only"):
            out["weekly_top3_global_events_only"] = True
        nraw = raw.get("normal")
        if isinstance(nraw, dict) and str(nraw.get("top3_section_title") or "").strip():
            out.setdefault("normal", {})["top3_section_title"] = str(nraw["top3_section_title"]).strip()[:80]
    return out


_GLOSS_PAD: Final[list[dict[str, str]]] = [
    {"term": "大模型", "explain": "用海量数据训练、可处理多种任务的通用模型，多通过对话或 API 使用。"},
    {"term": "多模态", "explain": "同时理解文本、图片、音频等多种输入形式的能力。"},
    {"term": "Agent", "explain": "能自动规划步骤并调用工具完成任务的智能体，而非只会聊天。"},
    {"term": "RAG", "explain": "检索相关文档再生成回答，提升专业领域回答的可追溯性。"},
    {"term": "提示词", "explain": "你告诉模型的任务描述与约束，会明显影响输出质量与风格。"},
]


def _clip_short(s: str, n: int) -> str:
    t = (s or "").replace("\n", " ").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def _empty_section_item() -> dict[str, Any]:
    return {
        "title": "本周该分类暂无强信号",
        "url": "",
        "what_happened": "本周期收录到的条目较少或置信度有限，未单独展开。",
        "suitable_for": "持续关注的读者",
        "worth_attention": "Low",
        "what_it_means_for_you": "可跳过，等待下期更新。",
        "see_top3": False,
    }


def _pad_top3_row() -> dict[str, str]:
    return {
        "title": "本期可跟进条目较少或仍在核实",
        "url": "",
        "what_happened": "本周有效来源有限，先把现有信号看清楚再行动更稳妥。",
        "why_important": "信息稀缺时，噪声更容易被放大；谨慎比误读更可取。",
        "what_it_means_for_you": "你可以把精力放回既定目标，不必强行制造跟进动作。",
        "attention_level": "2",
    }


def _pad_simple_line() -> dict[str, str]:
    return {
        "title": "本期条目仍在补充",
        "what_happened": "有效来源不足，下期会继续汇总。",
        "what_it_means_for_you": "先把本周已知信号消化完，再追新更省力。",
        "url": "",
    }


def finalize_payload_v3(raw: dict[str, Any] | None) -> dict[str, Any]:
    """
    LLM 或混合格式收口：补齐 PRD v3 必填结构以便通过 validate_payload。
    """
    p = ensure_payload_v3(raw)

    simp = dict(p.get("simple") or {})
    lines = list(simp.get("lines") or [])
    while len(lines) < 3:
        lines.append(dict(_pad_simple_line()))
    simp["lines"] = lines[:5]
    for ln in simp["lines"]:
        if isinstance(ln, dict) and _is_str(ln.get("what_happened")):
            ln["what_happened"] = _clip_short(str(ln.get("what_happened") or ""), 30)
    p["simple"] = simp

    norm = dict(p.get("normal") or {})
    top3 = list(norm.get("top3") or [])
    weekly_ge_only = bool(p.get("weekly_top3_global_events_only"))
    allow_short = bool(p.get("allow_short_top3"))
    short_or_ge = weekly_ge_only or allow_short
    if not short_or_ge:
        while len(top3) < 3:
            top3.append(dict(_pad_top3_row()))
        norm["top3"] = top3[:3]
    else:
        norm["top3"] = top3[:3]

    by_title: dict[str, dict[str, Any]] = {}
    for s in norm.get("sections") or []:
        if isinstance(s, dict) and _is_str(s.get("title")):
            by_title[str(s["title"])] = s
    new_secs: list[dict[str, Any]] = []
    for title in SECTION_ORDER:
        sec = by_title.get(title)
        if not isinstance(sec, dict):
            sec = {"title": title, "items": [_empty_section_item()]}
        items = sec.get("items")
        if not isinstance(items, list) or len(items) < 1:
            sec = {"title": title, "items": [_empty_section_item()]}
        else:
            fixed: list[dict[str, Any]] = []
            for it in items:
                if not isinstance(it, dict):
                    continue
                row = dict(it)
                row["see_top3"] = bool(row.get("see_top3"))
                fixed.append(row)
            sec = {"title": title, "items": fixed}
        new_secs.append(sec)
    norm["sections"] = new_secs

    caps = norm.get("capabilities")
    if not isinstance(caps, list):
        caps = []
    norm["capabilities"] = caps[:3]

    tools = norm.get("tools")
    if not isinstance(tools, list):
        tools = []
    fixed_tools: list[dict[str, str]] = []
    for t in tools[:10]:
        if not isinstance(t, dict):
            continue
        fixed_tools.append(
            {
                "name": _clip_short(str(t.get("name") or "未命名工具"), 200),
                "can_do": _clip_short(str(t.get("can_do") or "用于常见办公与信息整理场景的加速。"), 800),
                "suitable_for": _clip_short(str(t.get("suitable_for") or "希望低成本试错的用户"), 400),
                "worth_trying": str(t.get("worth_trying") or "No"),
                "what_it_means_for_you": _clip_short(
                    str(t.get("what_it_means_for_you") or "建议用小任务验证是否匹配你的流程。"), 800
                ),
            }
        )
        if str(fixed_tools[-1]["worth_trying"]) not in _WORTHING_TOOL:
            fixed_tools[-1]["worth_trying"] = "No"
    norm["tools"] = fixed_tools

    gloss = list(p.get("glossary") or [])
    gi = 0
    while len(gloss) < 5 and gi < len(_GLOSS_PAD):
        gloss.append(dict(_GLOSS_PAD[gi]))
        gi += 1
    while len(gloss) < 5:
        gloss.append({"term": "上下文窗口", "explain": "模型一次能读入的最大文本长度，越长越能处理长文档。"})
    p["glossary"] = gloss[:12]
    p["normal"] = norm
    backfill_top3_judgments_category_from_top3(norm)
    apply_backward_compat_from_phase35(norm, weekly_top3_global_events_only=weekly_ge_only)
    return p


def validate_payload(payload: dict[str, Any]) -> list[ValidationError]:
    """
    校验 PRD v3 周报 payload（邮件渲染 / multi-agent 收口）。
    建议先对原始 JSON 调用 ensure_payload_v3。
    """
    errs: list[ValidationError] = []

    if not isinstance(payload, dict):
        return [ValidationError(path="$", message="payload must be an object")]

    p = ensure_payload_v3(payload)
    simple = p.get("simple")
    normal = p.get("normal")
    glossary = p.get("glossary")

    if not isinstance(simple, dict):
        errs.append(ValidationError("$.simple", "must be an object"))
    else:
        lines = simple.get("lines")
        footer = simple.get("footer")
        if not isinstance(lines, list):
            errs.append(ValidationError("$.simple.lines", "must be an array"))
            lines = []
        if footer is not None and not _is_str(footer):
            errs.append(ValidationError("$.simple.footer", "must be a string"))

        if isinstance(lines, list):
            if len(lines) < 3 or len(lines) > 5:
                errs.append(ValidationError("$.simple.lines", "must have 3-5 items"))
            for i, ln in enumerate(lines):
                path = f"$.simple.lines[{i}]"
                if not isinstance(ln, dict):
                    errs.append(ValidationError(path, "must be an object"))
                    continue
                for key in ("title", "what_happened", "what_it_means_for_you", "url"):
                    if not _is_str(ln.get(key)):
                        errs.append(ValidationError(f"{path}.{key}", "must be a string"))
                    elif key != "url" and not str(ln.get(key, "")).strip():
                        errs.append(ValidationError(f"{path}.{key}", "must be non-empty"))
                wh = str(ln.get("what_happened") or "")
                if len(wh) > 36:
                    errs.append(ValidationError(f"{path}.what_happened", "must be <= 30 字量级（最长 36）"))

    if not isinstance(normal, dict):
        errs.append(ValidationError("$.normal", "must be an object"))
    else:
        top3 = normal.get("top3")
        sections = normal.get("sections")
        capabilities = normal.get("capabilities")
        tools = normal.get("tools")

        if not isinstance(top3, list):
            errs.append(ValidationError("$.normal.top3", "must be an array"))
            top3 = []
        allow_short = bool(p.get("allow_short_top3"))
        weekly_ge_only = bool(p.get("weekly_top3_global_events_only"))
        if isinstance(top3, list):
            if weekly_ge_only:
                if len(top3) > 3:
                    errs.append(
                        ValidationError(
                            "$.normal.top3",
                            "must have at most 3 items when weekly_top3_global_events_only",
                        )
                    )
            elif allow_short:
                if len(top3) < 1 or len(top3) > 3:
                    errs.append(ValidationError("$.normal.top3", "must have 1-3 items when allow_short_top3"))
            elif len(top3) != 3:
                errs.append(ValidationError("$.normal.top3", "must have exactly 3 items"))
            for i, t in enumerate(top3):
                path = f"$.normal.top3[{i}]"
                if not isinstance(t, dict):
                    errs.append(ValidationError(path, "must be an object"))
                    continue
                for key in ("title", "url", "what_happened", "why_important", "what_it_means_for_you", "attention_level"):
                    if not _is_str(t.get(key)):
                        errs.append(ValidationError(f"{path}.{key}", "must be a string"))
                    elif key != "url" and not str(t.get(key, "")).strip():
                        errs.append(ValidationError(f"{path}.{key}", "must be non-empty"))

        if not isinstance(sections, list):
            errs.append(ValidationError("$.normal.sections", "must be an array"))
            sections = []
        if isinstance(sections, list):
            titles_seen: set[str] = set()
            for i, s in enumerate(sections):
                path = f"$.normal.sections[{i}]"
                if not isinstance(s, dict):
                    errs.append(ValidationError(path, "must be an object"))
                    continue
                st = s.get("title")
                if not _is_str(st) or st not in SECTION_TITLES:
                    errs.append(
                        ValidationError(
                            f"{path}.title",
                            f"must be one of {sorted(SECTION_TITLES)}",
                        )
                    )
                elif st in titles_seen:
                    errs.append(ValidationError(f"{path}.title", "duplicate section title"))
                else:
                    titles_seen.add(st)
                items = s.get("items")
                if not isinstance(items, list) or len(items) < 1:
                    errs.append(ValidationError(f"{path}.items", "must be a non-empty array"))
                else:
                    for j, it in enumerate(items):
                        ip = f"{path}.items[{j}]"
                        if not isinstance(it, dict):
                            errs.append(ValidationError(ip, "must be an object"))
                            continue
                        for key in ("title", "url", "what_happened", "suitable_for", "worth_attention", "what_it_means_for_you"):
                            if key == "worth_attention":
                                w = it.get("worth_attention")
                                if not _is_str(w) or w not in _WORTH:
                                    errs.append(ValidationError(f"{ip}.worth_attention", "must be High|Medium|Low"))
                            elif not _is_str(it.get(key)):
                                errs.append(ValidationError(f"{ip}.{key}", "must be a string"))
                            elif key not in ("url", "what_it_means_for_you") and not str(it.get(key, "")).strip():
                                errs.append(ValidationError(f"{ip}.{key}", "must be non-empty"))
                        if "see_top3" in it and not isinstance(it.get("see_top3"), bool):
                            errs.append(ValidationError(f"{ip}.see_top3", "must be boolean"))

            if len(sections) != 3:
                errs.append(ValidationError("$.normal.sections", "must have exactly 3 section blocks"))

        if capabilities is not None:
            if not isinstance(capabilities, list):
                errs.append(ValidationError("$.normal.capabilities", "must be an array"))
            elif len(capabilities) > 3:
                errs.append(ValidationError("$.normal.capabilities", "must have at most 3 items"))

        if tools is not None:
            if not isinstance(tools, list):
                errs.append(ValidationError("$.normal.tools", "must be an array"))
            else:
                for i, t in enumerate(tools):
                    path = f"$.normal.tools[{i}]"
                    if not isinstance(t, dict):
                        errs.append(ValidationError(path, "must be an object"))
                        continue
                    for key in ("name", "can_do", "suitable_for", "worth_trying", "what_it_means_for_you"):
                        if key == "worth_trying":
                            w = t.get("worth_trying")
                            if not _is_str(w) or w not in _WORTHING_TOOL:
                                errs.append(ValidationError(f"{path}.worth_trying", "must be Yes|No"))
                        elif not _is_str(t.get(key)):
                            errs.append(ValidationError(f"{path}.{key}", "must be a string"))

    if not isinstance(glossary, list):
        errs.append(ValidationError("$.glossary", "must be an array"))
    else:
        if len(glossary) < 5 or len(glossary) > 12:
            errs.append(ValidationError("$.glossary", "must have 5-12 items"))
        for i, g in enumerate(glossary):
            path = f"$.glossary[{i}]"
            if not isinstance(g, dict):
                errs.append(ValidationError(path, "must be an object"))
                continue
            if not _is_str(g.get("term")):
                errs.append(ValidationError(path + ".term", "must be a string"))
            if not _is_str(g.get("explain")):
                errs.append(ValidationError(path + ".explain", "must be a string"))

    return errs


def format_errors(errors: Iterable[ValidationError]) -> str:
    parts = []
    for e in errors:
        parts.append(f"{e.path}: {e.message}")
    return "; ".join(parts)
